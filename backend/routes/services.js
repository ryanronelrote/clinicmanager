const router = require('express').Router();
const { pool } = require('../database');

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM services ORDER BY category NULLS LAST, name');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name, duration_minutes, price, category } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const { rows } = await pool.query(
    'INSERT INTO services (name, duration_minutes, price, category) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, parseInt(duration_minutes) || 60, parseFloat(price) || null, category || null]
  );
  res.status(201).json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM services WHERE id = $1', [parseInt(req.params.id)]);
  res.json({ success: true });
});

module.exports = router;
