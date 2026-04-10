const { pool } = require('../database');
const { computeStatus } = require('./invoiceService');

function svcError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

const ALLOWED_METHODS = ['cash', 'gcash', 'card'];

async function addPayment({ invoice_id, amount, payment_method }) {
  const parsedInvoiceId = parseInt(invoice_id);
  const parsedAmount = parseFloat(amount);

  // Validate
  if (!parsedInvoiceId || isNaN(parsedInvoiceId)) throw svcError(400, 'Invalid invoice_id');
  if (!parsedAmount || parsedAmount <= 0) throw svcError(400, 'Payment amount must be greater than 0');
  if (!ALLOWED_METHODS.includes(payment_method)) {
    throw svcError(400, `Invalid payment method. Allowed: ${ALLOWED_METHODS.join(', ')}`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock invoice row
    const { rows: invRows } = await client.query(
      'SELECT * FROM invoices WHERE id = $1 FOR UPDATE',
      [parsedInvoiceId]
    );
    if (!invRows.length) throw svcError(404, 'Invoice not found');

    const invoice = invRows[0];
    const totalAmount = parseFloat(invoice.total_amount) || 0;
    const currentPaid = parseFloat(invoice.amount_paid) || 0;
    const remaining = Math.round((totalAmount - currentPaid) * 100) / 100;

    if (remaining <= 0) throw svcError(409, 'Invoice is already fully paid');
    if (parsedAmount > remaining + 0.01) {
      throw svcError(400, `Payment exceeds remaining balance of ${remaining.toFixed(2)}`);
    }

    // Cap payment at remaining balance (handle rounding)
    const finalAmount = Math.min(parsedAmount, remaining);
    const roundedAmount = Math.round(finalAmount * 100) / 100;

    // Insert payment
    await client.query(
      'INSERT INTO payments (invoice_id, amount, payment_method) VALUES ($1, $2, $3)',
      [parsedInvoiceId, roundedAmount, payment_method]
    );

    // Update invoice
    const newAmountPaid = Math.round((currentPaid + roundedAmount) * 100) / 100;
    const newStatus = computeStatus(totalAmount, newAmountPaid);
    await client.query(
      'UPDATE invoices SET amount_paid = $1, status = $2 WHERE id = $3',
      [newAmountPaid, newStatus, parsedInvoiceId]
    );

    await client.query('COMMIT');

    // Return updated invoice with items and payments
    const { getInvoice } = require('./invoiceService');
    return getInvoice(parsedInvoiceId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function markAsPaid(invoiceId) {
  const parsedId = parseInt(invoiceId);
  const { rows: invRows } = await pool.query('SELECT * FROM invoices WHERE id = $1', [parsedId]);
  if (!invRows.length) throw svcError(404, 'Invoice not found');

  const invoice = invRows[0];
  const totalAmount = parseFloat(invoice.total_amount) || 0;
  const currentPaid = parseFloat(invoice.amount_paid) || 0;
  const remaining = Math.round((totalAmount - currentPaid) * 100) / 100;

  if (remaining <= 0) throw svcError(409, 'Invoice is already fully paid');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert a payment for the remaining balance
    await client.query(
      'INSERT INTO payments (invoice_id, amount, payment_method) VALUES ($1, $2, $3)',
      [parsedId, remaining, 'cash']
    );

    // Mark as paid
    await client.query(
      'UPDATE invoices SET amount_paid = $1, status = $2 WHERE id = $3',
      [totalAmount, 'paid', parsedId]
    );

    await client.query('COMMIT');

    const { getInvoice } = require('./invoiceService');
    return getInvoice(parsedId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getPaymentsByInvoice(invoiceId) {
  const parsedId = parseInt(invoiceId);
  const { rows } = await pool.query(
    'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC',
    [parsedId]
  );
  return rows;
}

module.exports = { addPayment, markAsPaid, getPaymentsByInvoice };
