require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./database');
const { requireAuth } = require('./middleware/requireAuth');
const { errorHandler } = require('./middleware/errorHandler');
const { startReminderJob } = require('./reminderJob');

const PORT = process.env.PORT || 3001;

const app = express();
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// ── Request logging ──────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// ── Static files (production) ────────────────────────────────
const distPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(distPath));
app.get('*', (req, res, next) => {
  if (req.headers.accept?.includes('text/html') && !/^\/appointments\/\d+\/(confirm|cancel)/.test(req.path)) {
    return res.sendFile(path.join(distPath, 'index.html'));
  }
  next();
});

// ── Public routes (no auth) ──────────────────────────────────
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.use('/auth', require('./routes/auth'));

// ── Auth middleware ───────────────────────────────────────────
app.use(requireAuth);

// ── Protected routes ─────────────────────────────────────────
app.use('/clients', require('./routes/clients'));
app.use('/appointments', require('./routes/appointments'));
app.use('/blocked-slots', require('./routes/blockedSlots'));
app.use('/inventory', require('./routes/inventory'));
app.use('/settings', require('./routes/settings'));
app.use('/services', require('./routes/services'));
app.use('/staff', require('./routes/staff'));
app.use('/therapist-schedules', require('./routes/therapistSchedule'));
app.use('/invoices', require('./routes/invoices'));
app.use('/api/dashboard', require('./routes/dashboard'));

// ── Global error handler (must be AFTER all routes) ─────────
app.use(errorHandler);

// ── Start ────────────────────────────────────────────────────
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
