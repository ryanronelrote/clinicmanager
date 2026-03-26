const cron = require('node-cron');
const crypto = require('crypto');
const { getDb, save } = require('./database');
const { sendEmail } = require('./emailService');
const { appointmentReminder24h, appointmentReminderSameDay, followUpEmail } = require('./emailTemplates');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

function toDateStr(d) { return d.toISOString().slice(0, 10); }
function timeToMins(str) { const [h, m] = str.split(':').map(Number); return h * 60 + m; }

function ensureToken(db, row) {
  if (row.confirmation_token) return row.confirmation_token;
  const token = crypto.randomBytes(24).toString('hex');
  db.run('UPDATE appointments SET confirmation_token = ? WHERE id = ?', [token, row.id]);
  return token;
}

async function runReminders() {
  const db = await getDb();
  const today     = toDateStr(new Date());
  const tomorrow  = toDateStr(new Date(Date.now() + 86400000));
  const yesterday = toDateStr(new Date(Date.now() - 86400000));
  let changed = false;

  // ── 24-hour reminders ────────────────────────────────────────
  const stmt24 = db.prepare(`
    SELECT a.*, c.first_name, c.last_name, c.email
    FROM appointments a JOIN clients c ON a.client_id = c.id
    WHERE a.date = ? AND a.reminder_24h_sent = 0 AND c.email IS NOT NULL
  `);
  stmt24.bind([tomorrow]);
  while (stmt24.step()) {
    const row = stmt24.getAsObject();
    const token = ensureToken(db, row);
    const confirmUrl = `${BACKEND_URL}/appointments/${row.id}/confirm?token=${token}`;
    const cancelUrl  = `${BACKEND_URL}/appointments/${row.id}/cancel?token=${token}`;
    const { subject, html } = appointmentReminder24h(
      `${row.first_name} ${row.last_name}`, row.date, row.start_time, row.treatments, confirmUrl, cancelUrl
    );
    await sendEmail(row.email, subject, html);
    db.run('UPDATE appointments SET reminder_24h_sent = 1, reminder_24h_sent_at = ? WHERE id = ?', [new Date().toISOString(), row.id]);
    changed = true;
  }
  stmt24.free();

  // ── Same-day reminders ───────────────────────────────────────
  const stmtSame = db.prepare(`
    SELECT a.*, c.first_name, c.last_name, c.email
    FROM appointments a JOIN clients c ON a.client_id = c.id
    WHERE a.date = ? AND a.reminder_same_day_sent = 0 AND c.email IS NOT NULL
  `);
  stmtSame.bind([today]);
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  while (stmtSame.step()) {
    const row = stmtSame.getAsObject();
    if (timeToMins(row.start_time) - nowMins > 480) continue; // not yet 8 hours before
    const token = ensureToken(db, row);
    const confirmUrl = `${BACKEND_URL}/appointments/${row.id}/confirm?token=${token}`;
    const cancelUrl  = `${BACKEND_URL}/appointments/${row.id}/cancel?token=${token}`;
    const { subject, html } = appointmentReminderSameDay(
      `${row.first_name} ${row.last_name}`, row.start_time, confirmUrl, cancelUrl
    );
    await sendEmail(row.email, subject, html);
    db.run('UPDATE appointments SET reminder_same_day_sent = 1, reminder_same_day_sent_at = ? WHERE id = ?', [new Date().toISOString(), row.id]);
    changed = true;
  }
  stmtSame.free();

  // ── Follow-up emails (yesterday's appointments) ──────────────
  const stmtFollowup = db.prepare(`
    SELECT a.*, c.first_name, c.last_name, c.email
    FROM appointments a JOIN clients c ON a.client_id = c.id
    WHERE a.date = ? AND a.followup_sent = 0 AND c.email IS NOT NULL
  `);
  stmtFollowup.bind([yesterday]);
  while (stmtFollowup.step()) {
    const row = stmtFollowup.getAsObject();
    const { subject, html } = followUpEmail(`${row.first_name} ${row.last_name}`);
    await sendEmail(row.email, subject, html);
    db.run('UPDATE appointments SET followup_sent = 1, followup_sent_at = ? WHERE id = ?', [new Date().toISOString(), row.id]);
    changed = true;
  }
  stmtFollowup.free();

  if (changed) save();
}

function startReminderJob() {
  // Runs every hour at :00
  cron.schedule('0 * * * *', () => {
    console.log('[Reminder Job] Running...');
    runReminders().catch(err => console.error('[Reminder Job] Error:', err));
  });
  console.log('[Reminder Job] Started — runs every hour');
}

module.exports = { startReminderJob, runReminders };
