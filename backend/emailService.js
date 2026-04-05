const { pool } = require('./database');

async function getEmailConfig() {
  const keys = ['resend_api_key', 'from_email', 'from_name', 'email_enabled'];
  const { rows } = await pool.query(`SELECT key, value FROM settings WHERE key = ANY($1)`, [keys]);
  const m = {};
  for (const r of rows) m[r.key] = r.value;
  return {
    apiKey:   m.resend_api_key || process.env.RESEND_API_KEY || '',
    from:     m.from_email     || process.env.SMTP_FROM      || 'onboarding@resend.dev',
    fromName: m.from_name      || '',
    enabled:  m.email_enabled  !== 'false',
  };
}

async function sendEmail(to, subject, html) {
  if (!to) return;
  const cfg = await getEmailConfig();
  if (!cfg.enabled) return;
  if (!cfg.apiKey) throw new Error('Resend API key not configured');

  const fromField = cfg.fromName ? `${cfg.fromName} <${cfg.from}>` : cfg.from;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromField, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Resend error ${res.status}`);
  }

  console.log(`[Email] "${subject}" sent to ${to}`);
}

module.exports = { sendEmail, getEmailConfig };
