const router = require('express').Router();
const { pool } = require('../database');
const { getWeekStart, getWeekEnd } = require('../helpers/dateHelpers');

router.post('/', async (req, res) => {
  const { date, start_time, end_time, reason } = req.body;
  if (!date || !start_time || !end_time) {
    return res.status(400).json({ error: 'date, start_time, and end_time are required' });
  }
  const { rows } = await pool.query(
    'INSERT INTO blocked_slots (date, start_time, end_time, reason) VALUES ($1, $2, $3, $4) RETURNING *',
    [date, start_time, end_time, reason || null]
  );
  res.status(201).json(rows[0]);
});

router.get('/', async (req, res) => {
  let query, params;
  if (req.query.week) {
    const weekStart = getWeekStart(req.query.week);
    const weekEnd = getWeekEnd(weekStart);
    query = 'SELECT * FROM blocked_slots WHERE date >= $1 AND date <= $2 ORDER BY date, start_time';
    params = [weekStart, weekEnd];
  } else if (req.query.month) {
    const [y, m] = req.query.month.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = new Date(y, m, 0).toISOString().slice(0, 10);
    query = 'SELECT * FROM blocked_slots WHERE date >= $1 AND date <= $2 ORDER BY date, start_time';
    params = [start, end];
  } else {
    query = 'SELECT * FROM blocked_slots ORDER BY date, start_time';
    params = [];
  }
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM blocked_slots WHERE id = $1', [parseInt(req.params.id)]);
  res.json({ success: true });
});

module.exports = router;
