const cron = require('node-cron');
const crypto = require('crypto');
const { pool } = require('./database');
const { sendEmail } = require('./emailService');
const { appointmentReminder24h, appointmentReminderSameDay, followUpEmail } = require('./emailTemplates');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

function toDateStr(d) { return d.toISOString().slice(0, 10); }
function timeToMins(str) { const [h, m] = str.split(':').map(Number); return h * 60 + m; }

async function ensureToken(row) {
  if (row.confirmation_token) return row.confirmation_token;
  const token = crypto.randomBytes(24).toString('hex');
  await pool.query('UPDATE appointments SET confirmation_token = $1 WHERE id = $2', [token, row.id]);
  return token;
}

async function runReminders() {
  const today     = toDateStr(new Date());
  const tomorrow  = toDateStr(new Date(Date.now() + 86400000));
  const yesterday = toDateStr(new Date(Date.now() - 86400000));

  // ── 24-hour reminders ────────────────────────────────────────
  const { rows: rows24 } = await pool.query(`
    SELECT a.*, c.first_name, c.last_name, c.email
    FROM appointments a JOIN clients c ON a.client_id = c.id
    WHERE a.date = $1 AND a.reminder_24h_sent = 0 AND c.email IS NOT NULL
  `, [tomorrow]);

  for (const row of rows24) {
    const token = await ensureToken(row);
    const confirmUrl = `${BACKEND_URL}/appointments/${row.id}/confirm?token=${token}`;
    const cancelUrl  = `${BACKEND_URL}/appointments/${row.id}/cancel?token=${token}`;
    const { subject, html } = appointmentReminder24h(
      `${row.first_name} ${row.last_name}`, row.date, row.start_time, row.treatments, confirmUrl, cancelUrl
    );
    try {
      await sendEmail(row.email, subject, html);
      await pool.query(
        'UPDATE appointments SET reminder_24h_sent = 1, reminder_24h_sent_at = $1 WHERE id = $2',
        [new Date().toISOString(), row.id]
      );
    } catch (e) {
      console.error('[Reminder] 24h email failed:', e.message);
    }
  }

  // ── Same-day reminders ───────────────────────────────────────
  const { rows: rowsSame } = await pool.query(`
    SELECT a.*, c.first_name, c.last_name, c.email
    FROM appointments a JOIN clients c ON a.client_id = c.id
    WHERE a.date = $1 AND a.reminder_same_day_sent = 0 AND c.email IS NOT NULL
  `, [today]);

  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  for (const row of rowsSame) {
    if (timeToMins(row.start_time) - nowMins > 480) continue;
    const token = await ensureToken(row);
    const confirmUrl = `${BACKEND_URL}/appointments/${row.id}/confirm?token=${token}`;
    const cancelUrl  = `${BACKEND_URL}/appointments/${row.id}/cancel?token=${token}`;
    const { subject, html } = appointmentReminderSameDay(
      `${row.first_name} ${row.last_name}`, row.start_time, confirmUrl, cancelUrl
    );
    try {
      await sendEmail(row.email, subject, html);
      await pool.query(
        'UPDATE appointments SET reminder_same_day_sent = 1, reminder_same_day_sent_at = $1 WHERE id = $2',
        [new Date().toISOString(), row.id]
      );
    } catch (e) {
      console.error('[Reminder] Same-day email failed:', e.message);
    }
  }

  // ── Follow-up emails ─────────────────────────────────────────
  const { rows: rowsFollowup } = await pool.query(`
    SELECT a.*, c.first_name, c.last_name, c.email
    FROM appointments a JOIN clients c ON a.client_id = c.id
    WHERE a.date = $1 AND a.followup_sent = 0 AND c.email IS NOT NULL
  `, [yesterday]);

  for (const row of rowsFollowup) {
    const { subject, html } = followUpEmail(`${row.first_name} ${row.last_name}`);
    try {
      await sendEmail(row.email, subject, html);
      await pool.query(
        'UPDATE appointments SET followup_sent = 1, followup_sent_at = $1 WHERE id = $2',
        [new Date().toISOString(), row.id]
      );
    } catch (e) {
      console.error('[Reminder] Follow-up email failed:', e.message);
    }
  }
}

function startReminderJob() {
  cron.schedule('0 * * * *', () => {
    console.log('[Reminder Job] Running...');
    runReminders().catch(err => console.error('[Reminder Job] Error:', err));
  });
  console.log('[Reminder Job] Started — runs every hour');
}

module.exports = { startReminderJob, runReminders };
