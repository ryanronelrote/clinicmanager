const { pool } = require('../database');

function svcError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

const INVOICE_WITH_CLIENT = `
  SELECT i.*, c.first_name, c.last_name, c.phone, c.email
  FROM invoices i
  JOIN clients c ON i.patient_id = c.id
  WHERE i.id = $1`;

const INVOICE_LIST = `
  SELECT i.*, c.first_name, c.last_name
  FROM invoices i
  JOIN clients c ON i.patient_id = c.id`;

function computeStatus(totalAmount, amountPaid) {
  const total = parseFloat(totalAmount) || 0;
  const paid  = parseFloat(amountPaid)  || 0;
  if (paid <= 0) return 'unpaid';
  if (paid < total) return 'partial';
  return 'paid';
}

async function createInvoice({ patient_id, appointment_id, items }) {
  if (!items || items.length === 0) {
    throw svcError(400, 'Invoice must have at least 1 item');
  }

  // Validate items
  for (const item of items) {
    if (!item.name || !item.name.trim()) throw svcError(400, 'Each item must have a name');
    if (!item.quantity || item.quantity <= 0) throw svcError(400, 'Item quantity must be greater than 0');
    if (item.unit_price == null || item.unit_price < 0) throw svcError(400, 'Item unit price cannot be negative');
  }

  // Verify patient exists
  const { rows: clientRows } = await pool.query('SELECT id FROM clients WHERE id = $1', [parseInt(patient_id)]);
  if (!clientRows.length) throw svcError(404, 'Patient not found');

  // Verify appointment if provided
  if (appointment_id) {
    const { rows: apptRows } = await pool.query('SELECT id FROM appointments WHERE id = $1', [parseInt(appointment_id)]);
    if (!apptRows.length) throw svcError(404, 'Appointment not found');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Calculate total from items
    let totalAmount = 0;
    const processedItems = items.map(item => {
      const qty = parseFloat(item.quantity);
      const price = parseFloat(item.unit_price);
      const lineTotal = Math.round(qty * price * 100) / 100;
      totalAmount += lineTotal;
      return { name: item.name.trim(), quantity: qty, unit_price: price, total_price: lineTotal };
    });
    totalAmount = Math.round(totalAmount * 100) / 100;

    // Insert invoice
    const { rows: invoiceRows } = await client.query(
      `INSERT INTO invoices (appointment_id, patient_id, total_amount, amount_paid, status)
       VALUES ($1, $2, $3, 0, 'unpaid') RETURNING id`,
      [appointment_id ? parseInt(appointment_id) : null, parseInt(patient_id), totalAmount]
    );
    const invoiceId = invoiceRows[0].id;

    // Insert line items
    for (const item of processedItems) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, name, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [invoiceId, item.name, item.quantity, item.unit_price, item.total_price]
      );
    }

    await client.query('COMMIT');

    return getInvoice(invoiceId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getInvoice(id) {
  const parsedId = parseInt(id);
  const { rows } = await pool.query(INVOICE_WITH_CLIENT, [parsedId]);
  if (!rows.length) throw svcError(404, 'Invoice not found');

  const invoice = rows[0];

  // Get line items
  const { rows: items } = await pool.query(
    'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id',
    [parsedId]
  );

  // Get payments
  const { rows: payments } = await pool.query(
    'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC',
    [parsedId]
  );

  return { ...invoice, items, payments };
}

async function listInvoices({ status, patient_id, from_date, to_date }) {
  let query = INVOICE_LIST;
  const conditions = [];
  const params = [];
  let idx = 1;

  if (status) {
    conditions.push(`i.status = $${idx++}`);
    params.push(status);
  }
  if (patient_id) {
    conditions.push(`i.patient_id = $${idx++}`);
    params.push(parseInt(patient_id));
  }
  if (from_date) {
    conditions.push(`i.created_at >= $${idx++}`);
    params.push(from_date);
  }
  if (to_date) {
    conditions.push(`i.created_at < ($${idx++}::date + interval '1 day')`);
    params.push(to_date);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY i.created_at DESC';

  const { rows } = await pool.query(query, params);
  return rows;
}

async function updateInvoiceItems(invoiceId, items) {
  const parsedId = parseInt(invoiceId);

  // Verify invoice exists
  const { rows: invRows } = await pool.query('SELECT * FROM invoices WHERE id = $1', [parsedId]);
  if (!invRows.length) throw svcError(404, 'Invoice not found');
  if (invRows[0].status === 'paid') throw svcError(409, 'Cannot modify a fully paid invoice');

  if (!items || items.length === 0) {
    throw svcError(400, 'Invoice must have at least 1 item');
  }

  for (const item of items) {
    if (!item.name || !item.name.trim()) throw svcError(400, 'Each item must have a name');
    if (!item.quantity || item.quantity <= 0) throw svcError(400, 'Item quantity must be greater than 0');
    if (item.unit_price == null || item.unit_price < 0) throw svcError(400, 'Item unit price cannot be negative');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete existing items
    await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [parsedId]);

    // Re-insert items and calculate total
    let totalAmount = 0;
    for (const item of items) {
      const qty = parseFloat(item.quantity);
      const price = parseFloat(item.unit_price);
      const lineTotal = Math.round(qty * price * 100) / 100;
      totalAmount += lineTotal;
      await client.query(
        'INSERT INTO invoice_items (invoice_id, name, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5)',
        [parsedId, item.name.trim(), qty, price, lineTotal]
      );
    }
    totalAmount = Math.round(totalAmount * 100) / 100;

    // Update invoice total and recalculate status
    const amountPaid = parseFloat(invRows[0].amount_paid) || 0;
    const newStatus = computeStatus(totalAmount, amountPaid);
    await client.query(
      'UPDATE invoices SET total_amount = $1, status = $2 WHERE id = $3',
      [totalAmount, newStatus, parsedId]
    );

    await client.query('COMMIT');
    return getInvoice(parsedId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function deleteInvoice(id) {
  const parsedId = parseInt(id);
  const { rows } = await pool.query('SELECT * FROM invoices WHERE id = $1', [parsedId]);
  if (!rows.length) throw svcError(404, 'Invoice not found');

  // Delete in order: payments → items → invoice
  await pool.query('DELETE FROM payments WHERE invoice_id = $1', [parsedId]);
  await pool.query('DELETE FROM invoice_items WHERE invoice_id = $1', [parsedId]);
  await pool.query('DELETE FROM invoices WHERE id = $1', [parsedId]);
  return { success: true };
}

module.exports = { createInvoice, getInvoice, listInvoices, updateInvoiceItems, deleteInvoice, computeStatus };
