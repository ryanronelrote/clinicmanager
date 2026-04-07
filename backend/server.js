require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { pool, initDb } = require('./database');
const { sendEmail, getEmailConfig, encrypt } = require('./emailService');
const { appointmentConfirmation, appointmentRescheduled, appointmentReminder24h, clientConfirmedNotification, clientCancelledNotification, attendanceConfirmedReceipt, TEMPLATE_REGISTRY } = require('./emailTemplates');
const { startReminderJob } = require('./reminderJob');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const PORT = process.env.PORT || 3001;

async function getNotifSettings() {
  const keys = ['enable_confirmation_email', 'enable_24h_reminder', 'enable_same_day_reminder', 'enable_followup_email'];
  const { rows } = await pool.query(`SELECT key, value FROM settings WHERE key = ANY($1)`, [keys]);
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    confirmation:  map['enable_confirmation_email']  !== 'false',
    reminder24h:   map['enable_24h_reminder']         !== 'false',
    reminderSameDay: map['enable_same_day_reminder']  !== 'false',
    followup:      map['enable_followup_email']        !== 'false',
  };
}

const app = express();
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// ── STATIC FILES (production) ────────────────────────────────
// Must come before API routes so browser navigations (accept: text/html)
// get index.html while API fetch() calls fall through to the routes below.
const distPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(distPath));
app.get('*', (req, res, next) => {
  if (req.headers.accept?.includes('text/html') && !/^\/appointments\/\d+\/(confirm|cancel)/.test(req.path)) {
    return res.sendFile(path.join(distPath, 'index.html'));
  }
  next();
});

// ── AUTH ──────────────────────────────────────────────────────

function authToken() {
  const pass = process.env.CLINIC_PASSWORD || '';
  return crypto.createHmac('sha256', pass).update(pass).digest('hex');
}

function requireAuth(req, res, next) {
  // Public endpoints: auth routes and client-facing email confirmation/cancellation links
  if (
    (req.method === 'POST' && req.path === '/auth/login') ||
    (req.method === 'GET'  && req.path === '/auth/verify') ||
    (req.method === 'GET'  && /^\/appointments\/\d+\/(confirm|cancel)$/.test(req.path))
  ) {
    return next();
  }
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!process.env.CLINIC_PASSWORD || token !== authToken()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.use(requireAuth);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

app.post('/auth/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  if (!process.env.CLINIC_PASSWORD) return res.status(500).json({ error: 'CLINIC_PASSWORD not set' });
  if (password !== process.env.CLINIC_PASSWORD) return res.status(401).json({ error: 'Incorrect password' });
  res.json({ token: authToken() });
});

app.get('/auth/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  res.json({ valid: !!process.env.CLINIC_PASSWORD && token === authToken() });
});

// ── CLIENTS ───────────────────────────────────────────────────

// POST /clients - create a new client
app.post('/clients', async (req, res) => {
  const { first_name, last_name, phone, email, notes, is_vip,
          birthdate, sex, address, occupation, civil_status, medical_history } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'first_name and last_name are required' });
  }

  const { rows } = await pool.query(
    `INSERT INTO clients (first_name, last_name, phone, email, notes, is_vip,
       birthdate, sex, address, occupation, civil_status, medical_history)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    [first_name, last_name, phone || null, email || null, notes || null, is_vip ? 1 : 0,
     birthdate || null, sex || null, address || null, occupation || null, civil_status || null,
     medical_history ? JSON.stringify(medical_history) : null]
  );
  const { rows: clientRows } = await pool.query('SELECT * FROM clients WHERE id = $1', [rows[0].id]);
  res.status(201).json(parseClient(clientRows[0]));
});

// PATCH /clients/:id - update client fields
app.patch('/clients/:id', async (req, res) => {
  const { first_name, last_name, phone, email, notes, is_vip,
          birthdate, sex, address, occupation, civil_status, medical_history } = req.body;

  const { rows: existing } = await pool.query('SELECT * FROM clients WHERE id = $1', [parseInt(req.params.id)]);
  if (!existing.length) return res.status(404).json({ error: 'Client not found' });
  const e = existing[0];

  await pool.query(
    `UPDATE clients SET first_name=$1, last_name=$2, phone=$3, email=$4, notes=$5, is_vip=$6,
       birthdate=$7, sex=$8, address=$9, occupation=$10, civil_status=$11, medical_history=$12
     WHERE id=$13`,
    [
      first_name    ?? e.first_name,
      last_name     ?? e.last_name,
      phone         !== undefined ? phone         : e.phone,
      email         !== undefined ? email         : e.email,
      notes         !== undefined ? notes         : e.notes,
      is_vip        !== undefined ? (is_vip ? 1 : 0) : e.is_vip,
      birthdate     !== undefined ? birthdate     : e.birthdate,
      sex           !== undefined ? sex           : e.sex,
      address       !== undefined ? address       : e.address,
      occupation    !== undefined ? occupation    : e.occupation,
      civil_status  !== undefined ? civil_status  : e.civil_status,
      medical_history !== undefined ? JSON.stringify(medical_history) : e.medical_history,
      parseInt(req.params.id),
    ]
  );

  const { rows: updated } = await pool.query('SELECT * FROM clients WHERE id = $1', [parseInt(req.params.id)]);
  res.json(parseClient(updated[0]));
});

// POST /clients/bulk - import multiple clients from CSV
app.post('/clients/bulk', async (req, res) => {
  const { clients } = req.body;
  if (!Array.isArray(clients) || clients.length === 0) {
    return res.status(400).json({ error: 'clients array is required' });
  }

  const imported = [];
  const errors = [];

  await pool.query('BEGIN');
  for (let i = 0; i < clients.length; i++) {
    const { first_name, last_name, phone, email, notes } = clients[i];
    if (!first_name || !last_name) {
      errors.push({ row: i + 1, reason: 'Missing first_name or last_name' });
      continue;
    }
    await pool.query(
      'INSERT INTO clients (first_name, last_name, phone, email, notes) VALUES ($1, $2, $3, $4, $5)',
      [first_name.trim(), last_name.trim(), phone || null, email || null, notes || null]
    );
    imported.push({ first_name, last_name });
  }
  await pool.query('COMMIT');

  res.status(201).json({ imported: imported.length, errors });
});

// GET /clients - list all clients
app.get('/clients', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM clients ORDER BY created_at DESC');
  res.json(rows);
});

// GET /clients/:id - get a single client
app.get('/clients/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM clients WHERE id = $1', [parseInt(req.params.id)]);
  if (!rows.length) return res.status(404).json({ error: 'Client not found' });
  res.json(parseClient(rows[0]));
});

// Helper: parse medical_history JSON field
function parseClient(c) {
  if (c && c.medical_history && typeof c.medical_history === 'string') {
    try { c.medical_history = JSON.parse(c.medical_history); } catch (e) { c.medical_history = {}; }
  }
  return c;
}

// ── DATE HELPERS ──────────────────────────────────────────────

function dateToLocalStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return dateToLocalStr(d);
}

function getWeekEnd(weekStart) {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return dateToLocalStr(d);
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// ── APPOINTMENTS ──────────────────────────────────────────────

// POST /appointments - create appointment
app.post('/appointments', async (req, res) => {
  const { client_id, date, start_time, duration_minutes, treatments, therapist, notes } = req.body;

  if (!client_id || !date || !start_time || !duration_minutes) {
    return res.status(400).json({ error: 'client_id, date, start_time, and duration_minutes are required' });
  }

  const startMinutes = timeToMinutes(start_time);
  const endMinutes = startMinutes + parseInt(duration_minutes);

  const { rows: existing } = await pool.query(
    `SELECT start_time, duration_minutes FROM appointments WHERE date = $1 AND status NOT IN ('cancelled', 'cancelled_by_client')`,
    [date]
  );
  let overlapCount = 0;
  for (const row of existing) {
    const existStart = timeToMinutes(row.start_time);
    const existEnd = existStart + row.duration_minutes;
    if (startMinutes < existEnd && endMinutes > existStart) overlapCount++;
  }
  if (overlapCount >= 3) {
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

// GET /appointments - list all, optional ?week=YYYY-MM-DD or ?month=YYYY-MM or ?client_id=N
app.get('/appointments', async (req, res) => {
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

// GET /appointments/:id - single appointment
app.get('/appointments/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.*, c.first_name, c.last_name
     FROM appointments a JOIN clients c ON a.client_id = c.id WHERE a.id = $1`,
    [parseInt(req.params.id)]
  );
  if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
  res.json(rows[0]);
});

// PATCH /appointments/:id - update editable fields
app.patch('/appointments/:id', async (req, res) => {
  const { treatments, therapist, notes, date, start_time, duration_minutes, status } = req.body;

  const { rows: existing } = await pool.query('SELECT * FROM appointments WHERE id = $1', [parseInt(req.params.id)]);
  if (!existing.length) return res.status(404).json({ error: 'Appointment not found' });
  const e = existing[0];

  const allowedStatuses = ['confirmed', 'done', 'cancelled'];
  const newStatus = (status && allowedStatuses.includes(status)) ? status : e.status;

  await pool.query(
    'UPDATE appointments SET date=$1, start_time=$2, duration_minutes=$3, treatments=$4, therapist=$5, notes=$6, status=$7 WHERE id=$8',
    [
      date             !== undefined ? date             : e.date,
      start_time       !== undefined ? start_time       : e.start_time,
      duration_minutes !== undefined ? duration_minutes : e.duration_minutes,
      treatments       !== undefined ? treatments       : e.treatments,
      therapist        !== undefined ? therapist        : e.therapist,
      notes            !== undefined ? notes            : e.notes,
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
app.post('/appointments/:id/send-reminder', async (req, res) => {
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
app.post('/appointments/:id/reschedule', async (req, res) => {
  const { date, start_time, duration_minutes } = req.body;
  if (!date || !start_time || !duration_minutes) {
    return res.status(400).json({ error: 'date, start_time, and duration_minutes are required' });
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

// GET /appointments/:id/confirm - client confirms via email link
app.get('/appointments/:id/confirm', async (req, res) => {
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

// GET /appointments/:id/cancel - client cancels via email link
app.get('/appointments/:id/cancel', async (req, res) => {
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

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
  await pool.query('DELETE FROM appointments WHERE id = $1', [parseInt(req.params.id)]);
  res.json({ success: true });
});

// ── BLOCKED SLOTS ─────────────────────────────────────────────

app.post('/blocked-slots', async (req, res) => {
  const { date, start_time, end_time, reason } = req.body;
  if (!date || !start_time || !end_time) {
    return res.status(400).json({ error: 'date, start_time, and end_time are required' });
  }
  const { rows } = await pool.query(
    'INSERT INTO blocked_slots (date, start_time, end_time, reason) VALUES ($1, $2, $3, $4) RETURNING *',
    [date, start_time, end_time, reason || null]
  );
  res.status(201).json(rows[0]);
});

app.get('/blocked-slots', async (req, res) => {
  let query, params;
  if (req.query.week) {
    const weekStart = getWeekStart(req.query.week);
    const weekEnd = getWeekEnd(weekStart);
    query = 'SELECT * FROM blocked_slots WHERE date >= $1 AND date <= $2 ORDER BY date, start_time';
    params = [weekStart, weekEnd];
  } else if (req.query.month) {
    const [y, m] = req.query.month.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = new Date(y, m, 0).toISOString().slice(0, 10);
    query = 'SELECT * FROM blocked_slots WHERE date >= $1 AND date <= $2 ORDER BY date, start_time';
    params = [start, end];
  } else {
    query = 'SELECT * FROM blocked_slots ORDER BY date, start_time';
    params = [];
  }
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

app.delete('/blocked-slots/:id', async (req, res) => {
  await pool.query('DELETE FROM blocked_slots WHERE id = $1', [parseInt(req.params.id)]);
  res.json({ success: true });
});

// ── INVENTORY ─────────────────────────────────────────────────

app.post('/inventory', async (req, res) => {
  const { name, category, unit, stock_quantity, low_stock_threshold, conversion_unit, conversion_factor } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const qty = parseInt(stock_quantity) || 0;
  const threshold = parseInt(low_stock_threshold) || 0;
  const factor = parseFloat(conversion_factor) || null;

  const { rows } = await pool.query(
    `INSERT INTO inventory_items (name, category, unit, stock_quantity, low_stock_threshold, conversion_unit, conversion_factor)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [name, category || null, unit || null, qty, threshold, conversion_unit || null, factor]
  );
  const newId = rows[0].id;

  if (qty > 0) {
    await pool.query(
      'INSERT INTO stock_movements (item_id, type, quantity, reason) VALUES ($1, $2, $3, $4)',
      [newId, 'IN', qty, 'Initial stock']
    );
  }

  const { rows: itemRows } = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [newId]);
  res.status(201).json(itemRows[0]);
});

app.patch('/inventory/:id', async (req, res) => {
  const { name, category, unit, low_stock_threshold, conversion_unit, conversion_factor, preferred_unit } = req.body;

  const { rows: existing } = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [parseInt(req.params.id)]);
  if (!existing.length) return res.status(404).json({ error: 'Item not found' });
  const e = existing[0];

  await pool.query(
    `UPDATE inventory_items SET name=$1, category=$2, unit=$3, low_stock_threshold=$4,
     conversion_unit=$5, conversion_factor=$6, preferred_unit=$7 WHERE id=$8`,
    [
      name               ?? e.name,
      category           !== undefined ? category           : e.category,
      unit               !== undefined ? unit               : e.unit,
      low_stock_threshold !== undefined ? parseInt(low_stock_threshold) : e.low_stock_threshold,
      conversion_unit    !== undefined ? conversion_unit    : e.conversion_unit,
      conversion_factor  !== undefined ? (parseFloat(conversion_factor) || null) : e.conversion_factor,
      preferred_unit     !== undefined ? preferred_unit     : e.preferred_unit,
      parseInt(req.params.id),
    ]
  );

  const { rows: updated } = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [parseInt(req.params.id)]);
  res.json(updated[0]);
});

app.get('/inventory/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [parseInt(req.params.id)]);
  if (!rows.length) return res.status(404).json({ error: 'Item not found' });
  res.json(rows[0]);
});

app.get('/inventory', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM inventory_items ORDER BY name ASC');
  res.json(rows);
});

app.post('/inventory/:id/add-stock', async (req, res) => {
  const { quantity, reason, date, input_unit } = req.body;
  const inputQty = parseFloat(quantity);
  if (!inputQty || inputQty <= 0) return res.status(400).json({ error: 'quantity must be a positive number' });

  const { rows: itemRows } = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [parseInt(req.params.id)]);
  if (!itemRows.length) return res.status(404).json({ error: 'Item not found' });
  const item = itemRows[0];

  const useConversion = input_unit && item.conversion_unit && input_unit === item.conversion_unit && item.conversion_factor;
  const qty = useConversion ? Math.round(inputQty * item.conversion_factor) : Math.round(inputQty);
  const newQty = item.stock_quantity + qty;
  const createdAt = date ? new Date(date).toISOString() : new Date().toISOString();
  const reasonStr = reason || (useConversion ? `${inputQty} ${item.conversion_unit}` : null);

  await pool.query('UPDATE inventory_items SET stock_quantity = $1 WHERE id = $2', [newQty, item.id]);
  await pool.query(
    'INSERT INTO stock_movements (item_id, type, quantity, reason, created_at) VALUES ($1, $2, $3, $4, $5)',
    [item.id, 'IN', qty, reasonStr, createdAt]
  );

  const { rows: updated } = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [item.id]);
  res.json(updated[0]);
});

app.post('/inventory/:id/remove-stock', async (req, res) => {
  const { quantity, reason, date, input_unit } = req.body;
  const inputQty = parseFloat(quantity);
  if (!inputQty || inputQty <= 0) return res.status(400).json({ error: 'quantity must be a positive number' });

  const { rows: itemRows } = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [parseInt(req.params.id)]);
  if (!itemRows.length) return res.status(404).json({ error: 'Item not found' });
  const item = itemRows[0];

  const useConversion = input_unit && item.conversion_unit && input_unit === item.conversion_unit && item.conversion_factor;
  const qty = useConversion ? Math.round(inputQty * item.conversion_factor) : Math.round(inputQty);
  if (item.stock_quantity < qty) return res.status(400).json({ error: 'Insufficient stock' });

  const newQty = item.stock_quantity - qty;
  const createdAt = date ? new Date(date).toISOString() : new Date().toISOString();
  const reasonStr = reason || (useConversion ? `${inputQty} ${item.conversion_unit}` : null);

  await pool.query('UPDATE inventory_items SET stock_quantity = $1 WHERE id = $2', [newQty, item.id]);
  await pool.query(
    'INSERT INTO stock_movements (item_id, type, quantity, reason, created_at) VALUES ($1, $2, $3, $4, $5)',
    [item.id, 'OUT', qty, reasonStr, createdAt]
  );

  const { rows: updated } = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [item.id]);
  res.json(updated[0]);
});

app.get('/inventory/:id/movements', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM stock_movements WHERE item_id = $1 ORDER BY created_at DESC',
    [parseInt(req.params.id)]
  );
  res.json(rows);
});

// ── SETTINGS ──────────────────────────────────────────────────

app.get('/settings', async (req, res) => {
  const { rows } = await pool.query('SELECT key, value FROM settings');
  const obj = {};
  for (const row of rows) obj[row.key] = row.value;
  res.json(obj);
});

app.post('/settings', async (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, String(value)]
    );
  }
  const { rows } = await pool.query('SELECT key, value FROM settings');
  const obj = {};
  for (const row of rows) obj[row.key] = row.value;
  res.json(obj);
});

// ── EMAIL SETTINGS ────────────────────────────────────────────

app.get('/settings/email', async (req, res) => {
  try {
    const cfg = await getEmailConfig();
    res.json({ ...cfg, apiKey: cfg.apiKey ? '••••••••••••••••' : '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/settings/email', async (req, res) => {
  try {
    const { apiKey, from, fromName, enabled } = req.body;
    const pairs = [
      ['from_email', from || ''],
      ['from_name', fromName || ''],
      ['email_enabled', String(enabled !== false)],
    ];
    if (apiKey && !apiKey.startsWith('••')) pairs.push(['brevo_api_key', encrypt(apiKey)]);
    for (const [k, v] of pairs) {
      await pool.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        [k, v]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/settings/email/test', async (req, res) => {
  try {
    await sendEmail(req.body.to, 'Test Email from Clinic App', '<p>Your email settings are working correctly!</p>');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── EMAIL TEMPLATES ───────────────────────────────────────────

app.get('/settings/email-templates', async (req, res) => {
  const keys = TEMPLATE_REGISTRY.flatMap(t => [
    `email_tpl_${t.name}_subject`,
    `email_tpl_${t.name}_body`,
  ]);
  const { rows } = await pool.query('SELECT key, value FROM settings WHERE key = ANY($1)', [keys]);
  const stored = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const result = {};
  for (const t of TEMPLATE_REGISTRY) {
    result[t.name] = {
      subject:        stored[`email_tpl_${t.name}_subject`] || '',
      body:           stored[`email_tpl_${t.name}_body`]    || '',
      defaultSubject: t.defaultSubject,
      defaultBody:    t.defaultBody,
    };
  }
  res.json(result);
});

app.post('/settings/email-templates', async (req, res) => {
  for (const [name, tpl] of Object.entries(req.body)) {
    for (const field of ['subject', 'body']) {
      const key = `email_tpl_${name}_${field}`;
      const val = tpl[field] ?? '';
      await pool.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        [key, val]
      );
    }
  }
  res.json({ ok: true });
});

// ── SERVICES ──────────────────────────────────────────────────

app.get('/services', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM services ORDER BY category NULLS LAST, name');
  res.json(rows);
});

app.post('/services', async (req, res) => {
  const { name, duration_minutes, price, category } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const { rows } = await pool.query(
    'INSERT INTO services (name, duration_minutes, price, category) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, parseInt(duration_minutes) || 60, parseFloat(price) || null, category || null]
  );
  res.status(201).json(rows[0]);
});

app.delete('/services/:id', async (req, res) => {
  await pool.query('DELETE FROM services WHERE id = $1', [parseInt(req.params.id)]);
  res.json({ success: true });
});

// ── START ─────────────────────────────────────────────────────
async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
    startReminderJob();
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
