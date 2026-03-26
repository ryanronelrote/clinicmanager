require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { getDb, save } = require('./database');
const { sendEmail } = require('./emailService');
const { appointmentConfirmation, appointmentRescheduled, appointmentReminder24h, clientConfirmedNotification, clientCancelledNotification } = require('./emailTemplates');
const { startReminderJob } = require('./reminderJob');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// POST /clients - create a new client
app.post('/clients', async (req, res) => {
  const { first_name, last_name, phone, email, notes, is_vip } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'first_name and last_name are required' });
  }

  const db = await getDb();
  db.run(
    'INSERT INTO clients (first_name, last_name, phone, email, notes, is_vip) VALUES (?, ?, ?, ?, ?, ?)',
    [first_name, last_name, phone || null, email || null, notes || null, is_vip ? 1 : 0]
  );
  save();

  const stmt = db.prepare('SELECT * FROM clients WHERE id = last_insert_rowid()');
  stmt.step();
  const client = stmt.getAsObject();
  stmt.free();

  res.status(201).json(client);
});

// PATCH /clients/:id - update client fields (including VIP toggle)
app.patch('/clients/:id', async (req, res) => {
  const { first_name, last_name, phone, email, notes, is_vip } = req.body;
  const db = await getDb();

  const check = db.prepare('SELECT * FROM clients WHERE id = ?');
  check.bind([parseInt(req.params.id)]);
  if (!check.step()) { check.free(); return res.status(404).json({ error: 'Client not found' }); }
  const existing = check.getAsObject();
  check.free();

  db.run(
    'UPDATE clients SET first_name=?, last_name=?, phone=?, email=?, notes=?, is_vip=? WHERE id=?',
    [
      first_name  ?? existing.first_name,
      last_name   ?? existing.last_name,
      phone       !== undefined ? phone  : existing.phone,
      email       !== undefined ? email  : existing.email,
      notes       !== undefined ? notes  : existing.notes,
      is_vip      !== undefined ? (is_vip ? 1 : 0) : existing.is_vip,
      parseInt(req.params.id),
    ]
  );
  save();

  const stmt = db.prepare('SELECT * FROM clients WHERE id = ?');
  stmt.bind([parseInt(req.params.id)]);
  stmt.step();
  const client = stmt.getAsObject();
  stmt.free();

  res.json(client);
});

// POST /clients/bulk - import multiple clients from CSV
app.post('/clients/bulk', async (req, res) => {
  const { clients } = req.body;

  if (!Array.isArray(clients) || clients.length === 0) {
    return res.status(400).json({ error: 'clients array is required' });
  }

  const db = await getDb();
  const imported = [];
  const errors = [];

  for (let i = 0; i < clients.length; i++) {
    const { first_name, last_name, phone, email, notes } = clients[i];
    if (!first_name || !last_name) {
      errors.push({ row: i + 1, reason: 'Missing first_name or last_name' });
      continue;
    }
    db.run(
      'INSERT INTO clients (first_name, last_name, phone, email, notes) VALUES (?, ?, ?, ?, ?)',
      [first_name.trim(), last_name.trim(), phone || null, email || null, notes || null]
    );
    imported.push({ first_name, last_name });
  }

  save();
  res.status(201).json({ imported: imported.length, errors });
});

// GET /clients - list all clients
app.get('/clients', async (req, res) => {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM clients ORDER BY created_at DESC');
  const clients = [];
  while (stmt.step()) {
    clients.push(stmt.getAsObject());
  }
  stmt.free();
  res.json(clients);
});

// GET /clients/:id - get a single client
app.get('/clients/:id', async (req, res) => {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM clients WHERE id = ?');
  stmt.bind([parseInt(req.params.id)]);
  if (stmt.step()) {
    const client = stmt.getAsObject();
    stmt.free();
    return res.json(client);
  }
  stmt.free();
  res.status(404).json({ error: 'Client not found' });
});

// Helper: get Monday of the week for a given date string (YYYY-MM-DD)
function dateToLocalStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return dateToLocalStr(d);
}

function getWeekEnd(weekStart) {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return dateToLocalStr(d);
}

// ── APPOINTMENTS ─────────────────────────────────────────────

// POST /appointments - create appointment
app.post('/appointments', async (req, res) => {
  const { client_id, date, start_time, duration_minutes, treatments, therapist, notes } = req.body;

  if (!client_id || !date || !start_time || !duration_minutes) {
    return res.status(400).json({ error: 'client_id, date, start_time, and duration_minutes are required' });
  }

  const db = await getDb();

  // Count overlapping appointments on this date/time (allow up to 3)
  const startMinutes = timeToMinutes(start_time);
  const endMinutes = startMinutes + parseInt(duration_minutes);

  const existing = db.prepare('SELECT start_time, duration_minutes FROM appointments WHERE date = ?');
  existing.bind([date]);
  let overlapCount = 0;
  while (existing.step()) {
    const row = existing.getAsObject();
    const existStart = timeToMinutes(row.start_time);
    const existEnd = existStart + row.duration_minutes;
    if (startMinutes < existEnd && endMinutes > existStart) {
      overlapCount++;
    }
  }
  existing.free();

  if (overlapCount >= 3) {
    return res.status(409).json({ error: 'This time slot is fully booked (3/3 appointments)' });
  }

  const confirmationToken = crypto.randomBytes(24).toString('hex');
  db.run(
    'INSERT INTO appointments (client_id, date, start_time, duration_minutes, treatments, therapist, notes, confirmation_token, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [client_id, date, start_time, duration_minutes, treatments || null, therapist || null, notes || null, confirmationToken, 'confirmed']
  );
  const newId = Number(db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
  save();
  const stmt = db.prepare('SELECT * FROM appointments WHERE id = ?');
  stmt.bind([newId]);
  stmt.step();
  const appt = stmt.getAsObject();
  stmt.free();

  // Send confirmation email if client has an email address
  const clientStmt = db.prepare('SELECT * FROM clients WHERE id = ?');
  clientStmt.bind([parseInt(client_id)]);
  if (clientStmt.step()) {
    const c = clientStmt.getAsObject();
    if (c.email) {
      const { subject, html } = appointmentConfirmation(
        `${c.first_name} ${c.last_name}`, date, start_time, treatments
      );
      try {
        await sendEmail(c.email, subject, html);
        const now = new Date().toISOString();
        db.run('UPDATE appointments SET confirmation_sent_at = ? WHERE id = ?', [now, newId]);
        appt.confirmation_sent_at = now;
        save();
      } catch (e) {
        console.error('[Email] Confirmation email failed:', e);
      }
    }
  }
  clientStmt.free();

  res.status(201).json(appt);
});

// GET /appointments - list all, optional ?week=YYYY-MM-DD or ?month=YYYY-MM
app.get('/appointments', async (req, res) => {
  const db = await getDb();
  let stmt;

  if (req.query.week) {
    const weekStart = getWeekStart(req.query.week);
    const weekEnd = getWeekEnd(weekStart);
    stmt = db.prepare(`
      SELECT a.*, c.first_name, c.last_name
      FROM appointments a
      JOIN clients c ON a.client_id = c.id
      WHERE a.date >= ? AND a.date <= ?
      ORDER BY a.date, a.start_time
    `);
    stmt.bind([weekStart, weekEnd]);
  } else if (req.query.month) {
    const [y, m] = req.query.month.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = new Date(y, m, 0).toISOString().slice(0, 10);
    stmt = db.prepare(`
      SELECT a.*, c.first_name, c.last_name
      FROM appointments a
      JOIN clients c ON a.client_id = c.id
      WHERE a.date >= ? AND a.date <= ?
      ORDER BY a.date, a.start_time
    `);
    stmt.bind([start, end]);
  } else if (req.query.client_id) {
    stmt = db.prepare(`
      SELECT a.*, c.first_name, c.last_name
      FROM appointments a
      JOIN clients c ON a.client_id = c.id
      WHERE a.client_id = ?
      ORDER BY a.date DESC, a.start_time DESC
    `);
    stmt.bind([parseInt(req.query.client_id)]);
  } else {
    stmt = db.prepare(`
      SELECT a.*, c.first_name, c.last_name
      FROM appointments a
      JOIN clients c ON a.client_id = c.id
      ORDER BY a.date, a.start_time
    `);
  }

  const appointments = [];
  while (stmt.step()) {
    appointments.push(stmt.getAsObject());
  }
  stmt.free();
  res.json(appointments);
});

// GET /appointments/:id - single appointment
app.get('/appointments/:id', async (req, res) => {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT a.*, c.first_name, c.last_name
    FROM appointments a
    JOIN clients c ON a.client_id = c.id
    WHERE a.id = ?
  `);
  stmt.bind([parseInt(req.params.id)]);
  if (stmt.step()) {
    const appt = stmt.getAsObject();
    stmt.free();
    return res.json(appt);
  }
  stmt.free();
  res.status(404).json({ error: 'Appointment not found' });
});

// PATCH /appointments/:id - update editable fields
app.patch('/appointments/:id', async (req, res) => {
  const { treatments, therapist, notes, date, start_time, duration_minutes, status } = req.body;
  const db = await getDb();

  const check = db.prepare('SELECT * FROM appointments WHERE id = ?');
  check.bind([parseInt(req.params.id)]);
  if (!check.step()) { check.free(); return res.status(404).json({ error: 'Appointment not found' }); }
  const existing = check.getAsObject();
  check.free();

  const allowedStatuses = ['confirmed', 'done', 'cancelled'];
  const newStatus = (status && allowedStatuses.includes(status)) ? status : existing.status;

  db.run(
    'UPDATE appointments SET date=?, start_time=?, duration_minutes=?, treatments=?, therapist=?, notes=?, status=? WHERE id=?',
    [
      date             !== undefined ? date             : existing.date,
      start_time       !== undefined ? start_time       : existing.start_time,
      duration_minutes !== undefined ? duration_minutes : existing.duration_minutes,
      treatments       !== undefined ? treatments       : existing.treatments,
      therapist        !== undefined ? therapist        : existing.therapist,
      notes            !== undefined ? notes            : existing.notes,
      newStatus,
      parseInt(req.params.id),
    ]
  );
  save();

  const stmt = db.prepare(`
    SELECT a.*, c.first_name, c.last_name
    FROM appointments a JOIN clients c ON a.client_id = c.id
    WHERE a.id = ?
  `);
  stmt.bind([parseInt(req.params.id)]);
  stmt.step();
  const appt = stmt.getAsObject();
  stmt.free();

  res.json(appt);
});

// POST /appointments/:id/send-reminder - manually trigger reminder email
app.post('/appointments/:id/send-reminder', async (req, res) => {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT a.*, c.first_name, c.last_name, c.email
    FROM appointments a JOIN clients c ON a.client_id = c.id
    WHERE a.id = ?
  `);
  stmt.bind([parseInt(req.params.id)]);
  if (!stmt.step()) { stmt.free(); return res.status(404).json({ error: 'Appointment not found' }); }
  const row = stmt.getAsObject();
  stmt.free();

  if (!row.email) {
    return res.status(400).json({ error: 'Client has no email address on file' });
  }

  // Ensure token exists for older appointments
  let token = row.confirmation_token;
  if (!token) {
    token = crypto.randomBytes(24).toString('hex');
    db.run('UPDATE appointments SET confirmation_token = ? WHERE id = ?', [token, parseInt(req.params.id)]);
  }

  const confirmUrl = `${BACKEND_URL}/appointments/${req.params.id}/confirm?token=${token}`;
  const cancelUrl  = `${BACKEND_URL}/appointments/${req.params.id}/cancel?token=${token}`;
  const { subject, html } = appointmentReminder24h(
    `${row.first_name} ${row.last_name}`, row.date, row.start_time, row.treatments, confirmUrl, cancelUrl
  );
  try {
    await sendEmail(row.email, subject, html);
    db.run('UPDATE appointments SET reminder_24h_sent = 1, reminder_24h_sent_at = ? WHERE id = ?', [new Date().toISOString(), parseInt(req.params.id)]);
    save();

    const updated = db.prepare('SELECT a.*, c.first_name, c.last_name FROM appointments a JOIN clients c ON a.client_id = c.id WHERE a.id = ?');
    updated.bind([parseInt(req.params.id)]);
    updated.step();
    const appt = updated.getAsObject();
    updated.free();
    res.json(appt);
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /appointments/:id/reschedule - change date/time and notify client
app.post('/appointments/:id/reschedule', async (req, res) => {
  const { date, start_time, duration_minutes } = req.body;
  if (!date || !start_time || !duration_minutes) {
    return res.status(400).json({ error: 'date, start_time, and duration_minutes are required' });
  }

  const db = await getDb();
  const stmt = db.prepare(`
    SELECT a.*, c.first_name, c.last_name, c.email
    FROM appointments a JOIN clients c ON a.client_id = c.id
    WHERE a.id = ?
  `);
  stmt.bind([parseInt(req.params.id)]);
  if (!stmt.step()) { stmt.free(); return res.status(404).json({ error: 'Appointment not found' }); }
  const row = stmt.getAsObject();
  stmt.free();

  const oldDate = row.date;
  const oldTime = row.start_time;

  db.run(
    'UPDATE appointments SET date=?, start_time=?, duration_minutes=?, rescheduled_at=? WHERE id=?',
    [date, start_time, parseInt(duration_minutes), new Date().toISOString(), parseInt(req.params.id)]
  );
  save();

  if (row.email) {
    const { subject, html } = appointmentRescheduled(
      `${row.first_name} ${row.last_name}`, oldDate, oldTime, date, start_time, row.treatments
    );
    try {
      await sendEmail(row.email, subject, html);
    } catch (err) {
      console.error('[Email] Reschedule email failed:', err.message);
    }
  }

  const updated = db.prepare(`
    SELECT a.*, c.first_name, c.last_name
    FROM appointments a JOIN clients c ON a.client_id = c.id
    WHERE a.id = ?
  `);
  updated.bind([parseInt(req.params.id)]);
  updated.step();
  const appt = updated.getAsObject();
  updated.free();

  res.json(appt);
});

// GET /appointments/:id/confirm - client clicks confirm button in email
app.get('/appointments/:id/confirm', async (req, res) => {
  const { token } = req.query;
  const db = await getDb();

  const stmt = db.prepare(`
    SELECT a.*, c.first_name, c.last_name, c.email
    FROM appointments a JOIN clients c ON a.client_id = c.id
    WHERE a.id = ?
  `);
  stmt.bind([parseInt(req.params.id)]);
  if (!stmt.step()) {
    stmt.free();
    return res.send(confirmPage('Not Found', 'This appointment could not be found.', '#cc3333'));
  }
  const row = stmt.getAsObject();
  stmt.free();

  if (!token || token !== row.confirmation_token) {
    return res.send(confirmPage('Invalid Link', 'This confirmation link is invalid or has expired.', '#cc3333'));
  }

  if (!row.client_confirmed_at) {
    db.run('UPDATE appointments SET client_confirmed_at = ?, status = ? WHERE id = ?', [new Date().toISOString(), 'confirmed_by_client', parseInt(req.params.id)]);
    save();

    const clinicEmail = process.env.SMTP_USER;
    if (clinicEmail) {
      const { subject, html } = clientConfirmedNotification(
        `${row.first_name} ${row.last_name}`, row.date, row.start_time
      );
      try { await sendEmail(clinicEmail, subject, html); } catch (e) {}
    }
  }

  const name = `${row.first_name} ${row.last_name}`;
  res.send(confirmPage(
    'Attendance Confirmed!',
    `Thank you, <strong>${name}</strong>! Your appointment on ${new Date(row.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} has been confirmed. See you soon!`,
    '#0f9d58'
  ));
});

// GET /appointments/:id/cancel - client clicks cancel button in email
app.get('/appointments/:id/cancel', async (req, res) => {
  const { token } = req.query;
  const db = await getDb();

  const stmt = db.prepare(`
    SELECT a.*, c.first_name, c.last_name, c.email
    FROM appointments a JOIN clients c ON a.client_id = c.id
    WHERE a.id = ?
  `);
  stmt.bind([parseInt(req.params.id)]);
  if (!stmt.step()) {
    stmt.free();
    return res.send(confirmPage('Not Found', 'This appointment could not be found.', '#cc3333'));
  }
  const row = stmt.getAsObject();
  stmt.free();

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

  db.run('UPDATE appointments SET cancelled_at = ?, status = ? WHERE id = ?',
    [new Date().toISOString(), 'cancelled_by_client', parseInt(req.params.id)]);
  save();

  const clinicEmail = process.env.SMTP_USER;
  if (clinicEmail) {
    const { subject, html } = clientCancelledNotification(
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

function confirmPage(title, message, color) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
  <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;">
    <div style="text-align:center;padding:40px;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.1);max-width:480px;">
      <div style="font-size:48px;margin-bottom:16px;">${color === '#0f9d58' ? '✓' : color === '#e07b54' ? '○' : '✕'}</div>
      <h2 style="color:${color};margin:0 0 12px">${title}</h2>
      <p style="color:#555;font-size:16px;line-height:1.5">${message}</p>
    </div>
  </body></html>`;
}

// DELETE /appointments/:id
app.delete('/appointments/:id', async (req, res) => {
  const db = await getDb();
  db.run('DELETE FROM appointments WHERE id = ?', [parseInt(req.params.id)]);
  save();
  res.json({ success: true });
});

// ── BLOCKED SLOTS ─────────────────────────────────────────────

// POST /blocked-slots - manually block a time range
app.post('/blocked-slots', async (req, res) => {
  const { date, start_time, end_time, reason } = req.body;

  if (!date || !start_time || !end_time) {
    return res.status(400).json({ error: 'date, start_time, and end_time are required' });
  }

  const db = await getDb();
  db.run(
    'INSERT INTO blocked_slots (date, start_time, end_time, reason) VALUES (?, ?, ?, ?)',
    [date, start_time, end_time, reason || null]
  );
  save();

  const stmt = db.prepare('SELECT * FROM blocked_slots WHERE id = last_insert_rowid()');
  stmt.step();
  const slot = stmt.getAsObject();
  stmt.free();

  res.status(201).json(slot);
});

// GET /blocked-slots - list all, optional ?week=YYYY-MM-DD or ?month=YYYY-MM
app.get('/blocked-slots', async (req, res) => {
  const db = await getDb();
  let stmt;

  if (req.query.week) {
    const weekStart = getWeekStart(req.query.week);
    const weekEnd = getWeekEnd(weekStart);
    stmt = db.prepare('SELECT * FROM blocked_slots WHERE date >= ? AND date <= ? ORDER BY date, start_time');
    stmt.bind([weekStart, weekEnd]);
  } else if (req.query.month) {
    const [y, m] = req.query.month.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = new Date(y, m, 0).toISOString().slice(0, 10);
    stmt = db.prepare('SELECT * FROM blocked_slots WHERE date >= ? AND date <= ? ORDER BY date, start_time');
    stmt.bind([start, end]);
  } else {
    stmt = db.prepare('SELECT * FROM blocked_slots ORDER BY date, start_time');
  }

  const slots = [];
  while (stmt.step()) {
    slots.push(stmt.getAsObject());
  }
  stmt.free();
  res.json(slots);
});

// DELETE /blocked-slots/:id
app.delete('/blocked-slots/:id', async (req, res) => {
  const db = await getDb();
  db.run('DELETE FROM blocked_slots WHERE id = ?', [parseInt(req.params.id)]);
  save();
  res.json({ success: true });
});

// ── HELPERS ───────────────────────────────────────────────────

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
  startReminderJob();
});
