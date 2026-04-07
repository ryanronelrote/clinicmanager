const { pool } = require('./database');
const crypto = require('crypto');

function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) return null;
  return crypto.createHash('sha256').update(secret).digest(); // 32-byte key
}

function encrypt(text) {
  const key = getEncryptionKey();
  if (!key || !text) return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return 'enc:' + iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text || !text.startsWith('enc:')) return text; // plaintext or empty
  const key = getEncryptionKey();
  if (!key) return ''; // encrypted but no key — return empty
  try {
    const parts = text.slice(4).split(':'); // strip 'enc:'
    const iv        = Buffer.from(parts[0], 'hex');
    const authTag   = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');
    const decipher  = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
  } catch {
    return ''; // corrupted value — return empty
  }
}

async function getEmailConfig() {
  const keys = ['brevo_api_key', 'from_email', 'from_name', 'email_enabled', 'email'];
  const { rows } = await pool.query(`SELECT key, value FROM settings WHERE key = ANY($1)`, [keys]);
  const m = {};
  for (const r of rows) m[r.key] = r.value;
  return {
    apiKey:      decrypt(m.brevo_api_key) || process.env.BREVO_API_KEY || '',
    from:        m.from_email    || process.env.SMTP_FROM     || '',
    fromName:    m.from_name     || '',
    enabled:     m.email_enabled !== 'false',
    clinicEmail: m.email         || process.env.SMTP_USER     || '',
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

module.exports = { sendEmail, getEmailConfig, encrypt };
