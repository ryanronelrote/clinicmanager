const { pool } = require('../database');

async function getNotifSettings() {
  const keys = ['enable_confirmation_email', 'enable_24h_reminder', 'enable_same_day_reminder', 'enable_followup_email'];
  const { rows } = await pool.query(`SELECT key, value FROM settings WHERE key = ANY($1)`, [keys]);
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    confirmation:    map['enable_confirmation_email']  !== 'false',
    reminder24h:     map['enable_24h_reminder']         !== 'false',
    reminderSameDay: map['enable_same_day_reminder']    !== 'false',
    followup:        map['enable_followup_email']        !== 'false',
  };
}

module.exports = { getNotifSettings };
