const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { authToken } = require('../middleware/requireAuth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

router.post('/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  if (!process.env.CLINIC_PASSWORD) return res.status(500).json({ error: 'CLINIC_PASSWORD not set' });
  if (password !== process.env.CLINIC_PASSWORD) return res.status(401).json({ error: 'Incorrect password' });
  res.json({ token: authToken() });
});

router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  res.json({ valid: !!process.env.CLINIC_PASSWORD && token === authToken() });
});

module.exports = router;
