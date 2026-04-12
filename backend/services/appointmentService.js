const crypto = require('crypto');
const { pool } = require('../database');
const { sendEmail, getEmailConfig } = require('../emailService');
const {
  appointmentConfirmation,
  appointmentRescheduled,
  appointmentReminder24h,
  clientConfirmedNotification,
  clientCancelledNotification,
  attendanceConfirmedReceipt,
} = require('../emailTemplates');
const { getWeekStart, getWeekEnd, timeToMinutes } = require('../helpers/dateHelpers');
const { getNotifSettings } = require('../helpers/notifSettings');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// ── Helpers ──────────────────────────────────────────────────

function svcError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

const APPT_WITH_CLIENT = `
  SELECT a.*, c.first_name, c.last_name, c.is_vip
  FROM appointments a JOIN clients c ON a.client_id = c.id
  WHERE a.id = $1`;

const APPT_WITH_CLIENT_EMAIL = `
  SELECT a.*, c.first_name, c.last_name, c.email
  FROM appointments a JOIN clients c ON a.client_id = c.id
  WHERE a.id = $1`;

// ── Conflict checking (works inside or outside transactions) ─

function _checkOverlaps(rows, startTime, durationMinutes, excludeId) {
  const startMins = timeToMinutes(startTime);
  const endMins = startMins + parseInt(durationMinutes);

  return rows.filter(row => {
    if (excludeId && row.id === parseInt(excludeId)) return false;
    const existStart = timeToMinutes(row.start_time);
    const existEnd = existStart + row.duration_minutes;
    return startMins < existEnd && endMins > existStart;
  });
}

/**
 * Check global slot conflicts (max 3 concurrent).
 * Accepts an optional `client` (pg client inside a transaction) or falls back to pool.
 */
async function checkConflicts(date, startTime, durationMinutes, excludeId, txClient) {
  const db = txClient || pool;
  let query = `SELECT id, start_time, duration_minutes, client_id
               FROM appointments WHERE date = $1 AND status NOT IN ('cancelled', 'cancelled_by_client', 'tentative')`;
  const params = [date];

  if (excludeId) {
    query += ` AND id != $2`;
    params.push(parseInt(excludeId));
  }

  const { rows } = await db.query(query, params);
  const overlapping = _checkOverlaps(rows, startTime, durationMinutes, null);

  // Check blocked slots
  const { rows: blocks } = await db.query(
    `SELECT start_time, end_time FROM blocked_slots WHERE date = $1`,
    [date]
  );
  const startMins = timeToMinutes(startTime);
  const endMins = startMins + parseInt(durationMinutes);
  const blocked = blocks.some(b => {
    const bStart = timeToMinutes(b.start_time);
    const bEnd = timeToMinutes(b.end_time);
    return startMins < bEnd && endMins > bStart;
  });

  return { count: overlapping.length, max: 3, conflicts: overlapping, blocked };
}

/**
 * Check per-therapist conflict (only when therapist is assigned).
 * Returns true if the therapist already has an overlapping appointment.
 */
async function checkTherapistConflict(therapist, date, startTime, durationMinutes, excludeId, txClient) {
  if (!therapist) return false;

  const db = txClient || pool;
  let query = `SELECT id, start_time, duration_minutes
               FROM appointments
               WHERE date = $1 AND therapist = $2
               AND status NOT IN ('cancelled', 'cancelled_by_client', 'tentative')`;
  const params = [date, therapist];

  if (excludeId) {
    query += ` AND id != $3`;
    params.push(parseInt(excludeId));
  }

  const { rows } = await db.query(query, params);
  const overlapping = _checkOverlaps(rows, startTime, durationMinutes, null);
  return overlapping.length > 0;
}

// ── CRUD ─────────────────────────────────────────────────────

async function create({ client_id, date, start_time, duration_minutes, treatments, therapist, notes, status }) {
  const apptStatus = status === 'tentative' ? 'tentative' : 'confirmed';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock non-cancelled appointments on target date to serialize concurrent bookings
    await client.query(
      `SELECT id FROM appointments WHERE date = $1 AND status NOT IN ('cancelled','cancelled_by_client') FOR UPDATE`,
      [date]
    );

    // Blocked slot check applies to all appointments (including tentative)
    const { count, blocked } = await checkConflicts(date, start_time, duration_minutes, null, client);
    if (blocked) {
      throw svcError(409, 'This time overlaps a blocked period. Please choose a different time.');
    }

    // Slot capacity and therapist checks only apply to confirmed bookings
    if (apptStatus !== 'tentative') {
      if (count >= 3) {
        throw svcError(409, 'This time slot is fully booked (3/3 appointments)');
      }

    }

    const confirmationToken = crypto.randomBytes(24).toString('hex');
    const { rows: inserted } = await client.query(
      `INSERT INTO appointments (client_id, date, start_time, duration_minutes, treatments, therapist, notes, confirmation_token, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [client_id, date, start_time, duration_minutes, treatments || null, therapist || null, notes || null, confirmationToken, apptStatus]
    );
    const newId = inserted[0].id;

    await client.query('COMMIT');

    // Fetch full record (read-only, outside transaction)
    const { rows: apptRows } = await pool.query(APPT_WITH_CLIENT, [newId]);
    const appt = apptRows[0];

    // Send confirmation email only for confirmed bookings
    if (apptStatus !== 'tentative') {
      try {
        const [{ rows: clientRows }, notif] = await Promise.all([
          pool.query('SELECT * FROM clients WHERE id = $1', [parseInt(client_id)]),
          getNotifSettings(),
        ]);
        if (notif.confirmation && clientRows.length && clientRows[0].email) {
          const c = clientRows[0];
          const { subject, html } = await appointmentConfirmation(
            `${c.first_name} ${c.last_name}`, date, start_time, treatments
          );
          await sendEmail(c.email, subject, html);
          const now = new Date().toISOString();
          await pool.query('UPDATE appointments SET confirmation_sent_at = $1 WHERE id = $2', [now, newId]);
          appt.confirmation_sent_at = now;
        }
      } catch (e) {
        console.error('[Email] Confirmation email failed:', e);
      }
    }

    return appt;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function list({ week, month, client_id }) {
  let query, params;

  if (week) {
    const weekStart = getWeekStart(week);
    const weekEnd = getWeekEnd(weekStart);
    query = `SELECT a.*, c.first_name, c.last_name, c.is_vip
             FROM appointments a JOIN clients c ON a.client_id = c.id
             WHERE a.date >= $1 AND a.date <= $2 ORDER BY a.date, a.start_time`;
    params = [weekStart, weekEnd];
  } else if (month) {
    const [y, m] = month.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = new Date(y, m, 0).toISOString().slice(0, 10);
    query = `SELECT a.*, c.first_name, c.last_name, c.is_vip
             FROM appointments a JOIN clients c ON a.client_id = c.id
             WHERE a.date >= $1 AND a.date <= $2 ORDER BY a.date, a.start_time`;
    params = [start, end];
  } else if (client_id) {
    query = `SELECT a.*, c.first_name, c.last_name, c.is_vip
             FROM appointments a JOIN clients c ON a.client_id = c.id
             WHERE a.client_id = $1 ORDER BY a.date DESC, a.start_time DESC`;
    params = [parseInt(client_id)];
  } else {
    query = `SELECT a.*, c.first_name, c.last_name, c.is_vip
             FROM appointments a JOIN clients c ON a.client_id = c.id
             ORDER BY a.date, a.start_time`;
    params = [];
  }

  const { rows } = await pool.query(query, params);
  return rows;
}

async function getById(id) {
  const { rows } = await pool.query(
    `SELECT a.*, c.first_name, c.last_name
     FROM appointments a JOIN clients c ON a.client_id = c.id WHERE a.id = $1`,
    [parseInt(id)]
  );
  if (!rows.length) throw svcError(404, 'Appointment not found');
  return rows[0];
}

async function update(id, updates) {
  const parsedId = parseInt(id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query('SELECT * FROM appointments WHERE id = $1 FOR UPDATE', [parsedId]);
    if (!existing.length) throw svcError(404, 'Appointment not found');
    const e = existing[0];

    const { treatments, therapist, notes, date, start_time, duration_minutes, status } = updates;

    const newDate = date !== undefined ? date : e.date;
    const newStart = start_time !== undefined ? start_time : e.start_time;
    const newDuration = duration_minutes !== undefined ? duration_minutes : e.duration_minutes;
    const newTherapist = therapist !== undefined ? therapist : e.therapist;

    // If date/time/duration changed, check slot conflicts within the transaction
    const timeChanged = date !== undefined || start_time !== undefined || duration_minutes !== undefined;

    if (timeChanged) {
      // Lock appointments on the target date
      await client.query(
        `SELECT id FROM appointments WHERE date = $1 AND status NOT IN ('cancelled','cancelled_by_client') AND id != $2 FOR UPDATE`,
        [newDate, parsedId]
      );

      const { count, blocked } = await checkConflicts(newDate, newStart, newDuration, parsedId, client);
      if (blocked) throw svcError(409, 'This time overlaps a blocked period. Please choose a different time.');
      if (count >= 3) throw svcError(409, 'This time slot is fully booked (3/3 appointments)');
    }

    const allowedStatuses = ['tentative', 'confirmed', 'done', 'cancelled'];
    const newStatus = (status && allowedStatuses.includes(status)) ? status : e.status;

    await client.query(
      `UPDATE appointments SET date=$1, start_time=$2, duration_minutes=$3, treatments=$4, therapist=$5, notes=$6, status=$7 WHERE id=$8`,
      [
        newDate, newStart, newDuration,
        treatments !== undefined ? treatments : e.treatments,
        newTherapist || null,
        notes !== undefined ? notes : e.notes,
        newStatus,
        parsedId,
      ]
    );

    await client.query('COMMIT');

    const { rows: updated } = await pool.query(APPT_WITH_CLIENT, [parsedId]);
    return updated[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function remove(id) {
  await pool.query('DELETE FROM appointments WHERE id = $1', [parseInt(id)]);
  return { success: true };
}

async function reschedule(id, { date, start_time, duration_minutes }) {
  const parsedId = parseInt(id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(APPT_WITH_CLIENT_EMAIL, [parsedId]);
    if (!rows.length) throw svcError(404, 'Appointment not found');
    const row = rows[0];

    // Lock target date
    await client.query(
      `SELECT id FROM appointments WHERE date = $1 AND status NOT IN ('cancelled','cancelled_by_client') AND id != $2 FOR UPDATE`,
      [date, parsedId]
    );

    // Global capacity + blocked slot check
    const { count, blocked } = await checkConflicts(date, start_time, duration_minutes, parsedId, client);
    if (blocked) throw svcError(409, 'This time overlaps a blocked period. Please choose a different time.');
    if (count >= 3) throw svcError(409, 'This time slot is fully booked (3/3 appointments)');

    await client.query(
      'UPDATE appointments SET date=$1, start_time=$2, duration_minutes=$3, rescheduled_at=$4 WHERE id=$5',
      [date, start_time, parseInt(duration_minutes), new Date().toISOString(), parsedId]
    );

    await client.query('COMMIT');

    // Send reschedule email (side-effect)
    if (row.email) {
      try {
        const { subject, html } = await appointmentRescheduled(
          `${row.first_name} ${row.last_name}`, row.date, row.start_time, date, start_time, row.treatments
        );
        await sendEmail(row.email, subject, html);
      } catch (err) {
        console.error('[Email] Reschedule email failed:', err.message);
      }
    }

    const { rows: updated } = await pool.query(APPT_WITH_CLIENT, [parsedId]);
    return updated[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function sendReminder(id) {
  const parsedId = parseInt(id);
  const { rows } = await pool.query(APPT_WITH_CLIENT_EMAIL, [parsedId]);
  if (!rows.length) throw svcError(404, 'Appointment not found');
  const row = rows[0];

  if (!row.email) throw svcError(400, 'Client has no email address on file');

  let token = row.confirmation_token;
  if (!token) {
    token = crypto.randomBytes(24).toString('hex');
    await pool.query('UPDATE appointments SET confirmation_token = $1 WHERE id = $2', [token, parsedId]);
  }

  const confirmUrl = `${BACKEND_URL}/appointments/${parsedId}/confirm?token=${token}`;
  const cancelUrl  = `${BACKEND_URL}/appointments/${parsedId}/cancel?token=${token}`;
  const { subject, html } = await appointmentReminder24h(
    `${row.first_name} ${row.last_name}`, row.date, row.start_time, row.treatments, confirmUrl, cancelUrl
  );

  await sendEmail(row.email, subject, html);
  await pool.query(
    'UPDATE appointments SET reminder_24h_sent = 1, reminder_24h_sent_at = $1 WHERE id = $2',
    [new Date().toISOString(), parsedId]
  );

  const { rows: updated } = await pool.query(APPT_WITH_CLIENT, [parsedId]);
  return updated[0];
}

async function confirmByClient(id, token) {
  const parsedId = parseInt(id);
  const { rows } = await pool.query(APPT_WITH_CLIENT_EMAIL, [parsedId]);
  if (!rows.length) return { type: 'error', title: 'Not Found', message: 'This appointment could not be found.' };
  const row = rows[0];

  if (!token || token !== row.confirmation_token) {
    return { type: 'error', title: 'Invalid Link', message: 'This confirmation link is invalid or has expired.' };
  }

  if (!row.client_confirmed_at) {
    await pool.query(
      'UPDATE appointments SET client_confirmed_at = $1, status = $2 WHERE id = $3',
      [new Date().toISOString(), 'confirmed_by_client', parsedId]
    );

    // Notify clinic
    try {
      const { clinicEmail } = await getEmailConfig();
      if (clinicEmail) {
        const { subject, html } = await clientConfirmedNotification(
          `${row.first_name} ${row.last_name}`, row.date, row.start_time
        );
        await sendEmail(clinicEmail, subject, html);
      }
    } catch (e) { /* non-critical */ }

    // Send receipt to client
    try {
      if (row.email) {
        const { subject, html } = await attendanceConfirmedReceipt(
          `${row.first_name} ${row.last_name}`, row.date, row.start_time, row.treatments
        );
        await sendEmail(row.email, subject, html);
      }
    } catch (e) {
      console.error('[Email] Client receipt email failed:', e.message);
    }
  }

  const dateStr = new Date(row.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return {
    type: 'success',
    title: 'Attendance Confirmed!',
    row,
    dateStr,
  };
}

async function cancelByClient(id, token) {
  const parsedId = parseInt(id);
  const { rows } = await pool.query(APPT_WITH_CLIENT_EMAIL, [parsedId]);
  if (!rows.length) return { type: 'error', title: 'Not Found', message: 'This appointment could not be found.' };
  const row = rows[0];

  if (!token || token !== row.confirmation_token) {
    return { type: 'error', title: 'Invalid Link', message: 'This cancellation link is invalid or has expired.' };
  }
  if (row.status === 'cancelled_by_client') {
    return { type: 'error', title: 'Already Cancelled', message: 'This appointment has already been cancelled.' };
  }

  const apptTime = new Date(`${row.date}T${row.start_time}:00`);
  const hoursUntil = (apptTime - new Date()) / 3600000;
  if (hoursUntil <= 6) {
    return {
      type: 'error',
      title: 'Too Late to Cancel',
      message: 'Appointments cannot be cancelled within 6 hours of the scheduled time. Please contact us directly.',
    };
  }

  await pool.query(
    'UPDATE appointments SET cancelled_at = $1, status = $2 WHERE id = $3',
    [new Date().toISOString(), 'cancelled_by_client', parsedId]
  );

  // Notify clinic
  try {
    const { clinicEmail } = await getEmailConfig();
    if (clinicEmail) {
      const { subject, html } = await clientCancelledNotification(
        `${row.first_name} ${row.last_name}`, row.date, row.start_time
      );
      await sendEmail(clinicEmail, subject, html);
    }
  } catch (e) { /* non-critical */ }

  const dateStr = new Date(row.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return { type: 'cancelled', title: 'Appointment Cancelled', row, dateStr };
}

/**
 * Staff confirms a tentative appointment → status becomes 'confirmed' + sends confirmation email.
 */
async function confirmAppointment(id) {
  const parsedId = parseInt(id);
  const { rows } = await pool.query('SELECT * FROM appointments WHERE id = $1', [parsedId]);
  if (!rows.length) throw svcError(404, 'Appointment not found');
  const appt = rows[0];
  if (appt.status !== 'tentative') {
    throw svcError(409, 'Only tentative appointments can be confirmed this way');
  }

  await pool.query('UPDATE appointments SET status = $1 WHERE id = $2', ['confirmed', parsedId]);

  // Send confirmation email (same as regular create)
  try {
    const [{ rows: clientRows }, notif] = await Promise.all([
      pool.query('SELECT * FROM clients WHERE id = $1', [appt.client_id]),
      getNotifSettings(),
    ]);
    if (notif.confirmation && clientRows.length && clientRows[0].email) {
      const c = clientRows[0];
      const { subject, html } = await appointmentConfirmation(
        `${c.first_name} ${c.last_name}`, appt.date, appt.start_time, appt.treatments
      );
      await sendEmail(c.email, subject, html);
      await pool.query(
        'UPDATE appointments SET confirmation_sent_at = $1 WHERE id = $2',
        [new Date().toISOString(), parsedId]
      );
    }
  } catch (e) {
    console.error('[Email] Confirmation email failed:', e);
  }

  const { rows: updated } = await pool.query(APPT_WITH_CLIENT, [parsedId]);
  return updated[0];
}

module.exports = {
  checkConflicts,
  checkTherapistConflict,
  create,
  list,
  getById,
  update,
  remove,
  reschedule,
  sendReminder,
  confirmByClient,
  cancelByClient,
  confirmAppointment,
};
