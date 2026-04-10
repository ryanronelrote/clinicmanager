const router = require('express').Router();
const { pool } = require('../database');

function parseClient(c) {
  if (c && c.medical_history && typeof c.medical_history === 'string') {
    try { c.medical_history = JSON.parse(c.medical_history); } catch (e) { c.medical_history = {}; }
  }
  return c;
}

router.post('/', async (req, res) => {
  const { first_name, last_name, phone, email, notes, is_vip,
          birthdate, sex, address, occupation, civil_status, medical_history } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'first_name and last_name are required' });
  }

  const { rows } = await pool.query(
    `INSERT INTO clients (first_name, last_name, phone, email, notes, is_vip,
       birthdate, sex, address, occupation, civil_status, medical_history)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    [first_name, last_name, phone || null, email || null, notes || null, is_vip ? 1 : 0,
     birthdate || null, sex || null, address || null, occupation || null, civil_status || null,
     medical_history ? JSON.stringify(medical_history) : null]
  );
  const { rows: clientRows } = await pool.query('SELECT * FROM clients WHERE id = $1', [rows[0].id]);
  res.status(201).json(parseClient(clientRows[0]));
});

router.patch('/:id', async (req, res) => {
  const { first_name, last_name, phone, email, notes, is_vip,
          birthdate, sex, address, occupation, civil_status, medical_history } = req.body;

  const { rows: existing } = await pool.query('SELECT * FROM clients WHERE id = $1', [parseInt(req.params.id)]);
  if (!existing.length) return res.status(404).json({ error: 'Client not found' });
  const e = existing[0];

  await pool.query(
    `UPDATE clients SET first_name=$1, last_name=$2, phone=$3, email=$4, notes=$5, is_vip=$6,
       birthdate=$7, sex=$8, address=$9, occupation=$10, civil_status=$11, medical_history=$12
     WHERE id=$13`,
    [
      first_name    ?? e.first_name,
      last_name     ?? e.last_name,
      phone         !== undefined ? phone         : e.phone,
      email         !== undefined ? email         : e.email,
      notes         !== undefined ? notes         : e.notes,
      is_vip        !== undefined ? (is_vip ? 1 : 0) : e.is_vip,
      birthdate     !== undefined ? birthdate     : e.birthdate,
      sex           !== undefined ? sex           : e.sex,
      address       !== undefined ? address       : e.address,
      occupation    !== undefined ? occupation    : e.occupation,
      civil_status  !== undefined ? civil_status  : e.civil_status,
      medical_history !== undefined ? JSON.stringify(medical_history) : e.medical_history,
      parseInt(req.params.id),
    ]
  );

  const { rows: updated } = await pool.query('SELECT * FROM clients WHERE id = $1', [parseInt(req.params.id)]);
  res.json(parseClient(updated[0]));
});

router.post('/bulk', async (req, res) => {
  const { clients } = req.body;
  if (!Array.isArray(clients) || clients.length === 0) {
    return res.status(400).json({ error: 'clients array is required' });
  }

  const imported = [];
  const errors = [];

  await pool.query('BEGIN');
  for (let i = 0; i < clients.length; i++) {
    const { first_name, last_name, phone, email, notes } = clients[i];
    if (!first_name || !last_name) {
      errors.push({ row: i + 1, reason: 'Missing first_name or last_name' });
      continue;
    }
    await pool.query(
      'INSERT INTO clients (first_name, last_name, phone, email, notes) VALUES ($1, $2, $3, $4, $5)',
      [first_name.trim(), last_name.trim(), phone || null, email || null, notes || null]
    );
    imported.push({ first_name, last_name });
  }
  await pool.query('COMMIT');

  res.status(201).json({ imported: imported.length, errors });
});

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM clients ORDER BY created_at DESC');
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM clients WHERE id = $1', [parseInt(req.params.id)]);
  if (!rows.length) return res.status(404).json({ error: 'Client not found' });
  res.json(parseClient(rows[0]));
});

// DELETE /clients/:id
// Deletes the client and all their appointments (FK constraint requires appointments removed first)
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { rows } = await pool.query('SELECT id FROM clients WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Client not found' });

    await pool.query('DELETE FROM appointments WHERE client_id = $1', [id]);
    await pool.query('DELETE FROM clients WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[Delete client]', err.message);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

module.exports = router;
