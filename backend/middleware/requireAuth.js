const crypto = require('crypto');

function authToken() {
  const pass = process.env.CLINIC_PASSWORD || '';
  return crypto.createHmac('sha256', pass).update(pass).digest('hex');
}

function requireAuth(req, res, next) {
  if (
    (req.method === 'GET' && /^\/appointments\/\d+\/(confirm|cancel)$/.test(req.path))
  ) {
    return next();
  }
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!process.env.CLINIC_PASSWORD || token !== authToken()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = { authToken, requireAuth };
