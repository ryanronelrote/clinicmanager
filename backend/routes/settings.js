const router = require('express').Router();
const { pool } = require('../database');
const { sendEmail, getEmailConfig, encrypt } = require('../emailService');
const { TEMPLATE_REGISTRY } = require('../emailTemplates');

// ── GENERAL SETTINGS ─────────────────────────────────────────

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT key, value FROM settings');
  const obj = {};
  for (const row of rows) obj[row.key] = row.value;
  res.json(obj);
});

router.post('/', async (req, res) => {
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

// ── EMAIL SETTINGS ───────────────────────────────────────────

router.get('/email', async (req, res) => {
  try {
    const cfg = await getEmailConfig();
    res.json({ ...cfg, apiKey: cfg.apiKey ? '••••••••••••••••' : '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/email', async (req, res) => {
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

router.post('/email/test', async (req, res) => {
  try {
    await sendEmail(req.body.to, 'Test Email from Clinic App', '<p>Your email settings are working correctly!</p>');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── EMAIL TEMPLATES ──────────────────────────────────────────

router.get('/email-templates', async (req, res) => {
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

router.post('/email-templates', async (req, res) => {
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

module.exports = router;
