const { pool } = require('./database');

async function getEmailConfig() {
  const keys = ['brevo_api_key', 'from_email', 'from_name', 'email_enabled'];
  const { rows } = await pool.query(`SELECT key, value FROM settings WHERE key = ANY($1)`, [keys]);
  const m = {};
  for (const r of rows) m[r.key] = r.value;
  return {
    apiKey:   m.brevo_api_key || process.env.BREVO_API_KEY || '',
    from:     m.from_email    || process.env.SMTP_FROM     || '',
    fromName: m.from_name     || '',
    enabled:  m.email_enabled !== 'false',
  };
}

async function sendEmail(to, subject, html) {
  if (!to) return;
  const cfg = await getEmailConfig();
  if (!cfg.enabled) return;
  if (!cfg.apiKey) throw new Error('Brevo API key not configured');

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': cfg.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: cfg.fromName || cfg.from, email: cfg.from },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Brevo error ${res.status}`);
  }

  console.log(`[Email] "${subject}" sent to ${to}`);
}

module.exports = { sendEmail, getEmailConfig };
