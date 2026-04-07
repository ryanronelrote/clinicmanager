const router = require('express').Router();
const { pool } = require('../database');

router.post('/', async (req, res) => {
  const { name, category, unit, stock_quantity, low_stock_threshold, conversion_unit, conversion_factor } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const qty = parseInt(stock_quantity) || 0;
  const threshold = parseInt(low_stock_threshold) || 0;
  const factor = parseFloat(conversion_factor) || null;

  const { rows } = await pool.query(
    `INSERT INTO inventory_items (name, category, unit, stock_quantity, low_stock_threshold, conversion_unit, conversion_factor)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [name, category || null, unit || null, qty, threshold, conversion_unit || null, factor]
  );
  const newId = rows[0].id;

  if (qty > 0) {
    await pool.query(
      'INSERT INTO stock_movements (item_id, type, quantity, reason) VALUES ($1, $2, $3, $4)',
      [newId, 'IN', qty, 'Initial stock']
    );
  }

  const { rows: itemRows } = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [newId]);
  res.status(201).json(itemRows[0]);
});

router.patch('/:id', async (req, res) => {
  const { name, category, unit, low_stock_threshold, conversion_unit, conversion_factor, preferred_unit } = req.body;

  const { rows: existing } = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [parseInt(req.params.id)]);
  if (!existing.length) return res.status(404).json({ error: 'Item not found' });
  const e = existing[0];

  await pool.query(
    `UPDATE inventory_items SET name=$1, category=$2, unit=$3, low_stock_threshold=$4,
     conversion_unit=$5, conversion_factor=$6, preferred_unit=$7 WHERE id=$8`,
    [
      name               ?? e.name,
      category           !== undefined ? category           : e.category,
      unit               !== undefined ? unit               : e.unit,
      low_stock_threshold !== undefined ? parseInt(low_stock_threshold) : e.low_stock_threshold,
      conversion_unit    !== undefined ? conversion_unit    : e.conversion_unit,
      conversion_factor  !== undefined ? (parseFloat(conversion_factor) || null) : e.conversion_factor,
      preferred_unit     !== undefined ? preferred_unit     : e.preferred_unit,
      parseInt(req.params.id),
    ]
  );

  const { rows: updated } = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [parseInt(req.params.id)]);
  res.json(updated[0]);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [parseInt(req.params.id)]);
  if (!rows.length) return res.status(404).json({ error: 'Item not found' });
  res.json(rows[0]);
});

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM inventory_items ORDER BY name ASC');
  res.json(rows);
});

router.post('/:id/add-stock', async (req, res) => {
  const { quantity, reason, date, input_unit } = req.body;
  const inputQty = parseFloat(quantity);
  if (!inputQty || inputQty <= 0) return res.status(400).json({ error: 'quantity must be a positive number' });

  const { rows: itemRows } = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [parseInt(req.params.id)]);
  if (!itemRows.length) return res.status(404).json({ error: 'Item not found' });
  const item = itemRows[0];

  const useConversion = input_unit && item.conversion_unit && input_unit === item.conversion_unit && item.conversion_factor;
  const qty = useConversion ? Math.round(inputQty * item.conversion_factor) : Math.round(inputQty);
  const newQty = item.stock_quantity + qty;
  const createdAt = date ? new Date(date).toISOString() : new Date().toISOString();
  const reasonStr = reason || (useConversion ? `${inputQty} ${item.conversion_unit}` : null);

  await pool.query('UPDATE inventory_items SET stock_quantity = $1 WHERE id = $2', [newQty, item.id]);
  await pool.query(
    'INSERT INTO stock_movements (item_id, type, quantity, reason, created_at) VALUES ($1, $2, $3, $4, $5)',
    [item.id, 'IN', qty, reasonStr, createdAt]
  );

  const { rows: updated } = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [item.id]);
  res.json(updated[0]);
});

router.post('/:id/remove-stock', async (req, res) => {
  const { quantity, reason, date, input_unit } = req.body;
  const inputQty = parseFloat(quantity);
  if (!inputQty || inputQty <= 0) return res.status(400).json({ error: 'quantity must be a positive number' });

  const { rows: itemRows } = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [parseInt(req.params.id)]);
  if (!itemRows.length) return res.status(404).json({ error: 'Item not found' });
  const item = itemRows[0];

  const useConversion = input_unit && item.conversion_unit && input_unit === item.conversion_unit && item.conversion_factor;
  const qty = useConversion ? Math.round(inputQty * item.conversion_factor) : Math.round(inputQty);
  if (item.stock_quantity < qty) return res.status(400).json({ error: 'Insufficient stock' });

  const newQty = item.stock_quantity - qty;
  const createdAt = date ? new Date(date).toISOString() : new Date().toISOString();
  const reasonStr = reason || (useConversion ? `${inputQty} ${item.conversion_unit}` : null);

  await pool.query('UPDATE inventory_items SET stock_quantity = $1 WHERE id = $2', [newQty, item.id]);
  await pool.query(
    'INSERT INTO stock_movements (item_id, type, quantity, reason, created_at) VALUES ($1, $2, $3, $4, $5)',
    [item.id, 'OUT', qty, reasonStr, createdAt]
  );

  const { rows: updated } = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [item.id]);
  res.json(updated[0]);
});

router.get('/:id/movements', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM stock_movements WHERE item_id = $1 ORDER BY created_at DESC',
    [parseInt(req.params.id)]
  );
  res.json(rows);
});

module.exports = router;
