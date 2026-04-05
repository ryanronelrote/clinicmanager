const nodemailer = require('nodemailer');
const { pool } = require('./database');

async function getEmailConfig() {
  const keys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'from_email', 'from_name', 'email_enabled'];
  const { rows } = await pool.query(`SELECT key, value FROM settings WHERE key = ANY($1)`, [keys]);
  const m = {};
  for (const r of rows) m[r.key] = r.value;
  return {
    host:     m.smtp_host  || process.env.SMTP_HOST || 'smtp.gmail.com',
    port:     parseInt(m.smtp_port || process.env.SMTP_PORT || '587'),
    user:     m.smtp_user  || process.env.SMTP_USER || '',
    pass:     m.smtp_pass  || process.env.SMTP_PASS || '',
    from:     m.from_email || m.smtp_user || process.env.SMTP_FROM || process.env.SMTP_USER || '',
    fromName: m.from_name  || '',
    enabled:  m.email_enabled !== 'false',
  };
}

async function sendEmail(to, subject, html) {
  if (!to) return;
  const cfg = await getEmailConfig();
  if (!cfg.enabled) return;
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: false,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
  const fromField = cfg.fromName ? `"${cfg.fromName}" <${cfg.from}>` : cfg.from;
  await transporter.sendMail({ from: fromField, to, subject, html });
  console.log(`[Email] "${subject}" sent to ${to}`);
}

module.exports = { sendEmail, getEmailConfig };
