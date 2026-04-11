const router = require('express').Router();
const { pool } = require('../database');

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM staff ORDER BY name');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name, role } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  const { rows } = await pool.query(
    'INSERT INTO staff (name, role) VALUES ($1, $2) RETURNING *',
    [name.trim(), (role || '').trim()]
  );
  res.status(201).json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM staff WHERE id = $1', [parseInt(req.params.id)]);
  res.json({ success: true });
});

module.exports = router;
