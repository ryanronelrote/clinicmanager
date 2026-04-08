/**
 * asyncHandler — wraps async route handlers so thrown errors reach Express error middleware.
 * Usage: router.get('/', asyncHandler(async (req, res) => { ... }));
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * Global Express error handler.  Mount AFTER all routes in server.js:
 *   app.use(errorHandler);
 */
function errorHandler(err, req, res, next) {
  // Already sent a response (e.g. HTML confirm pages) — nothing to do
  if (res.headersSent) return next(err);

  const method = req.method;
  const path = req.originalUrl || req.path;

  // ── PostgreSQL constraint errors ──────────────────────────
  if (err.code === '23503') {
    // Foreign-key violation
    console.error(`[Error] ${method} ${path}: FK violation — ${err.detail || err.message}`);
    return res.status(400).json({ error: 'Referenced record does not exist' });
  }
  if (err.code === '23514') {
    // CHECK constraint violation
    console.error(`[Error] ${method} ${path}: CHECK violation — ${err.detail || err.message}`);
    return res.status(400).json({ error: 'Value out of allowed range' });
  }
  if (err.code === '23505') {
    // Unique constraint violation
    console.error(`[Error] ${method} ${path}: Unique violation — ${err.detail || err.message}`);
    return res.status(409).json({ error: 'Duplicate entry' });
  }

  // ── Application errors with explicit status code ──────────
  if (err.statusCode) {
    console.error(`[Error] ${method} ${path}: ${err.message}`);
    return res.status(err.statusCode).json({ error: err.message });
  }

  // ── Unexpected errors ─────────────────────────────────────
  console.error(`[Error] ${method} ${path}:`, err);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { asyncHandler, errorHandler };
