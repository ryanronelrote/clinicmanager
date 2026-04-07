const router = require('express').Router();
const crypto = require('crypto');
const { pool } = require('../database');
const { sendEmail, getEmailConfig } = require('../emailService');
const { appointmentConfirmation, appointmentRescheduled, appointmentReminder24h, clientConfirmedNotification, clientCancelledNotification, attendanceConfirmedReceipt } = require('../emailTemplates');
const { getWeekStart, getWeekEnd, timeToMinutes } = require('../helpers/dateHelpers');
const { escHtml, confirmPage } = require('../helpers/htmlHelpers');
const { getNotifSettings } = require('../helpers/notifSettings');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// ── Conflict checking ────────────────────────────────────────

async function checkConflicts(date, startTime, durationMinutes, excludeId) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + parseInt(durationMinutes);

  let query = `SELECT id, start_time, duration_minutes, client_id
               FROM appointments WHERE date = $1 AND status NOT IN ('cancelled', 'cancelled_by_client')`;
  const params = [date];

  if (excludeId) {
    query += ` AND id != $2`;
    params.push(parseInt(excludeId));
  }

  const { rows } = await pool.query(query, params);
  const overlapping = rows.filter(row => {
    const existStart = timeToMinutes(row.start_time);
    const existEnd = existStart + row.duration_minutes;
    return startMinutes < existEnd && endMinutes > existStart;
  });

  return { count: overlapping.length, max: 3, conflicts: overlapping };
}

// GET /appointments/check-conflicts
router.get('/check-conflicts', async (req, res) => {
  const { date, start_time, duration, exclude_id } = req.query;
  if (!date || !start_time || !duration) {
    return res.status(400).json({ error: 'date, start_time, and duration are required' });
  }
  const result = await checkConflicts(date, start_time, duration, exclude_id);
  res.json(result);
});

// POST /appointments
router.post('/', async (req, res) => {
  const { client_id, date, start_time, duration_minutes, treatments, therapist, notes } = req.body;

  if (!client_id || !date || !start_time || !duration_minutes) {
    return res.status(400).json({ error: 'client_id, date, start_time, and duration_minutes are required' });
  }

  const { count } = await checkConflicts(date, start_time, duration_minutes);
  if (count >= 3) {
    return res.status(409).json({ error: 'This time slot is fully booked (3/3 appointments)' });
  }

  const confirmationToken = crypto.randomBytes(24).toString('hex');
  const { rows: inserted } = await pool.query(
    `INSERT INTO appointments (client_id, date, start_time, duration_minutes, treatments, therapist, notes, confirmation_token, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [client_id, date, start_time, duration_minutes, treatments || null, therapist || null, notes || null, confirmationToken, 'confirmed']
  );
  const newId = inserted[0].id;

  const { rows: apptRows } = await pool.query(
    'SELECT a.*, c.first_name, c.last_name FROM appointments a JOIN clients c ON a.client_id = c.id WHERE a.id = $1',
    [newId]
  );
  const appt = apptRows[0];

  const [{ rows: clientRows }, notif] = await Promise.all([
    pool.query('SELECT * FROM clients WHERE id = $1', [parseInt(client_id)]),
    getNotifSettings(),
  ]);
  if (notif.confirmation && clientRows.length && clientRows[0].email) {
    const c = clientRows[0];
    const { subject, html } = await appointmentConfirmation(
      `${c.first_name} ${c.last_name}`, date, start_time, treatments
    );
    try {
      await sendEmail(c.email, subject, html);
      const now = new Date().toISOString();
      await pool.query('UPDATE appointments SET confirmation_sent_at = $1 WHERE id = $2', [now, newId]);
      appt.confirmation_sent_at = now;
    } catch (e) {
      console.error('[Email] Confirmation email failed:', e);
    }
  }

  res.status(201).json(appt);
});

// GET /appointments
router.get('/', async (req, res) => {
  let query, params;

  if (req.query.week) {
    const weekStart = getWeekStart(req.query.week);
    const weekEnd = getWeekEnd(weekStart);
    query = `SELECT a.*, c.first_name, c.last_name, c.is_vip
             FROM appointments a JOIN clients c ON a.client_id = c.id
             WHERE a.date >= $1 AND a.date <= $2 ORDER BY a.date, a.start_time`;
    params = [weekStart, weekEnd];
  } else if (req.query.month) {
    const [y, m] = req.query.month.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = new Date(y, m, 0).toISOString().slice(0, 10);
    query = `SELECT a.*, c.first_name, c.last_name, c.is_vip
             FROM appointments a JOIN clients c ON a.client_id = c.id
             WHERE a.date >= $1 AND a.date <= $2 ORDER BY a.date, a.start_time`;
    params = [start, end];
  } else if (req.query.client_id) {
    query = `SELECT a.*, c.first_name, c.last_name, c.is_vip
             FROM appointments a JOIN clients c ON a.client_id = c.id
             WHERE a.client_id = $1 ORDER BY a.date DESC, a.start_time DESC`;
    params = [parseInt(req.query.client_id)];
  } else {
    query = `SELECT a.*, c.first_name, c.last_name, c.is_vip
             FROM appointments a JOIN clients c ON a.client_id = c.id
             ORDER BY a.date, a.start_time`;
    params = [];
  }

  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// GET /appointments/:id
router.get('/:id', async (req, res) => {
  if (req.params.id === 'check-conflicts') return; // handled above
  const { rows } = await pool.query(
    `SELECT a.*, c.first_name, c.last_name
     FROM appointments a JOIN clients c ON a.client_id = c.id WHERE a.id = $1`,
    [parseInt(req.params.id)]
  );
  if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
  res.json(rows[0]);
});

// PATCH /appointments/:id
router.patch('/:id', async (req, res) => {
  const { treatments, therapist, notes, date, start_time, duration_minutes, status } = req.body;

  const { rows: existing } = await pool.query('SELECT * FROM appointments WHERE id = $1', [parseInt(req.params.id)]);
  if (!existing.length) return res.status(404).json({ error: 'Appointment not found' });
  const e = existing[0];

  const newDate = date !== undefined ? date : e.date;
  const newStart = start_time !== undefined ? start_time : e.start_time;
  const newDuration = duration_minutes !== undefined ? duration_minutes : e.duration_minutes;

  if (date !== undefined || start_time !== undefined || duration_minutes !== undefined) {
    const { count } = await checkConflicts(newDate, newStart, newDuration, req.params.id);
    if (count >= 3) {
      return res.status(409).json({ error: 'This time slot is fully booked (3/3 appointments)' });
    }
  }

  const allowedStatuses = ['confirmed', 'done', 'cancelled'];
  const newStatus = (status && allowedStatuses.includes(status)) ? status : e.status;

  await pool.query(
    'UPDATE appointments SET date=$1, start_time=$2, duration_minutes=$3, treatments=$4, therapist=$5, notes=$6, status=$7 WHERE id=$8',
    [newDate, newStart, newDuration,
      treatments !== undefined ? treatments : e.treatments,
      therapist  !== undefined ? therapist  : e.therapist,
      notes      !== undefined ? notes      : e.notes,
      newStatus,
      parseInt(req.params.id),
    ]
  );

  const { rows: updated } = await pool.query(
    `SELECT a.*, c.first_name, c.last_name FROM appointments a JOIN clients c ON a.client_id = c.id WHERE a.id = $1`,
    [parseInt(req.params.id)]
  );
  res.json(updated[0]);
});

// POST /appointments/:id/send-reminder
router.post('/:id/send-reminder', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.*, c.first_name, c.last_name, c.email
     FROM appointments a JOIN clients c ON a.client_id = c.id WHERE a.id = $1`,
    [parseInt(req.params.id)]
  );
  if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
  const row = rows[0];

  if (!row.email) return res.status(400).json({ error: 'Client has no email address on file' });

  let token = row.confirmation_token;
  if (!token) {
    token = crypto.randomBytes(24).toString('hex');
    await pool.query('UPDATE appointments SET confirmation_token = $1 WHERE id = $2', [token, parseInt(req.params.id)]);
  }

  const confirmUrl = `${BACKEND_URL}/appointments/${req.params.id}/confirm?token=${token}`;
  const cancelUrl  = `${BACKEND_URL}/appointments/${req.params.id}/cancel?token=${token}`;
  const { subject, html } = await appointmentReminder24h(
    `${row.first_name} ${row.last_name}`, row.date, row.start_time, row.treatments, confirmUrl, cancelUrl
  );

  try {
    await sendEmail(row.email, subject, html);
    await pool.query(
      'UPDATE appointments SET reminder_24h_sent = 1, reminder_24h_sent_at = $1 WHERE id = $2',
      [new Date().toISOString(), parseInt(req.params.id)]
    );
    const { rows: updated } = await pool.query(
      `SELECT a.*, c.first_name, c.last_name FROM appointments a JOIN clients c ON a.client_id = c.id WHERE a.id = $1`,
      [parseInt(req.params.id)]
    );
    res.json(updated[0]);
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /appointments/:id/reschedule
router.post('/:id/reschedule', async (req, res) => {
  const { date, start_time, duration_minutes } = req.body;
  if (!date || !start_time || !duration_minutes) {
    return res.status(400).json({ error: 'date, start_time, and duration_minutes are required' });
  }

  const { count } = await checkConflicts(date, start_time, duration_minutes, req.params.id);
  if (count >= 3) {
    return res.status(409).json({ error: 'This time slot is fully booked (3/3 appointments)' });
  }

  const { rows } = await pool.query(
    `SELECT a.*, c.first_name, c.last_name, c.email
     FROM appointments a JOIN clients c ON a.client_id = c.id WHERE a.id = $1`,
    [parseInt(req.params.id)]
  );
  if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
  const row = rows[0];

  await pool.query(
    'UPDATE appointments SET date=$1, start_time=$2, duration_minutes=$3, rescheduled_at=$4 WHERE id=$5',
    [date, start_time, parseInt(duration_minutes), new Date().toISOString(), parseInt(req.params.id)]
  );

  if (row.email) {
    const { subject, html } = await appointmentRescheduled(
      `${row.first_name} ${row.last_name}`, row.date, row.start_time, date, start_time, row.treatments
    );
    try { await sendEmail(row.email, subject, html); } catch (err) {
      console.error('[Email] Reschedule email failed:', err.message);
    }
  }

  const { rows: updated } = await pool.query(
    `SELECT a.*, c.first_name, c.last_name FROM appointments a JOIN clients c ON a.client_id = c.id WHERE a.id = $1`,
    [parseInt(req.params.id)]
  );
  res.json(updated[0]);
});

// GET /appointments/:id/confirm
router.get('/:id/confirm', async (req, res) => {
  const { token } = req.query;
  const { rows } = await pool.query(
    `SELECT a.*, c.first_name, c.last_name, c.email
     FROM appointments a JOIN clients c ON a.client_id = c.id WHERE a.id = $1`,
    [parseInt(req.params.id)]
  );
  if (!rows.length) return res.send(confirmPage('Not Found', 'This appointment could not be found.', '#cc3333'));
  const row = rows[0];

  if (!token || token !== row.confirmation_token) {
    return res.send(confirmPage('Invalid Link', 'This confirmation link is invalid or has expired.', '#cc3333'));
  }

  if (!row.client_confirmed_at) {
    await pool.query(
      'UPDATE appointments SET client_confirmed_at = $1, status = $2 WHERE id = $3',
      [new Date().toISOString(), 'confirmed_by_client', parseInt(req.params.id)]
    );
    const { clinicEmail } = await getEmailConfig();
    if (clinicEmail) {
      const { subject, html } = await clientConfirmedNotification(
        `${row.first_name} ${row.last_name}`, row.date, row.start_time
      );
      try { await sendEmail(clinicEmail, subject, html); } catch (e) {}
    }
    if (row.email) {
      const { subject, html } = await attendanceConfirmedReceipt(
        `${row.first_name} ${row.last_name}`, row.date, row.start_time, row.treatments
      );
      try { await sendEmail(row.email, subject, html); } catch (e) {
        console.error('[Email] Client receipt email failed:', e.message);
      }
    }
  }

  res.send(confirmPage(
    'Attendance Confirmed!',
    `Thank you, <strong>${escHtml(row.first_name)} ${escHtml(row.last_name)}</strong>! Your appointment on ${new Date(row.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} has been confirmed. See you soon!`,
    '#0f9d58'
  ));
});

// GET /appointments/:id/cancel
router.get('/:id/cancel', async (req, res) => {
  const { token } = req.query;
  const { rows } = await pool.query(
    `SELECT a.*, c.first_name, c.last_name, c.email
     FROM appointments a JOIN clients c ON a.client_id = c.id WHERE a.id = $1`,
    [parseInt(req.params.id)]
  );
  if (!rows.length) return res.send(confirmPage('Not Found', 'This appointment could not be found.', '#cc3333'));
  const row = rows[0];

  if (!token || token !== row.confirmation_token) {
    return res.send(confirmPage('Invalid Link', 'This cancellation link is invalid or has expired.', '#cc3333'));
  }
  if (row.status === 'cancelled_by_client') {
    return res.send(confirmPage('Already Cancelled', 'This appointment has already been cancelled.', '#cc3333'));
  }

  const apptTime = new Date(`${row.date}T${row.start_time}:00`);
  const hoursUntil = (apptTime - new Date()) / 3600000;
  if (hoursUntil <= 6) {
    return res.send(confirmPage('Too Late to Cancel',
      'Appointments cannot be cancelled within 6 hours of the scheduled time. Please contact us directly.',
      '#cc3333'));
  }

  await pool.query(
    'UPDATE appointments SET cancelled_at = $1, status = $2 WHERE id = $3',
    [new Date().toISOString(), 'cancelled_by_client', parseInt(req.params.id)]
  );

  const { clinicEmail } = await getEmailConfig();
  if (clinicEmail) {
    const { subject, html } = await clientCancelledNotification(
      `${row.first_name} ${row.last_name}`, row.date, row.start_time
    );
    try { await sendEmail(clinicEmail, subject, html); } catch (e) {}
  }

  res.send(confirmPage(
    'Appointment Cancelled',
    `Your appointment on ${new Date(row.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} has been cancelled. We hope to see you again soon!`,
    '#e07b54'
  ));
});

// DELETE /appointments/:id
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM appointments WHERE id = $1', [parseInt(req.params.id)]);
  res.json({ success: true });
});

module.exports = router;
