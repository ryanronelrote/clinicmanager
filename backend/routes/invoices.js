const router = require('express').Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const invoiceService = require('../services/invoiceService');
const paymentService = require('../services/paymentService');

// ── Validation schemas ──────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = {
  body: {
    patient_id: { required: true,  type: 'integer', min: 1 },
    created_by: { required: true,  type: 'string',  maxLength: 100 },
    invoice_date: { required: false, type: 'string', pattern: ISO_DATE },
  },
};

const paymentSchema = {
  body: {
    amount:         { required: true, type: 'number', min: 0.01 },
    payment_method: { required: true, type: 'string' },
    received_by:    { required: true, type: 'string', maxLength: 100 },
    payment_date:   { required: false, type: 'string', pattern: ISO_DATE },
  },
};

const invoiceDatePatchSchema = {
  body: {
    invoice_date: { required: true, type: 'string', pattern: ISO_DATE },
  },
};

const markPaidSchema = {
  body: {
    received_by:   { required: true, type: 'string', maxLength: 100 },
    payment_date:  { required: false, type: 'string', pattern: ISO_DATE },
  },
};

// ── Routes ──────────────────────────────────────────────────

// List invoices (with optional filters)
router.get('/', asyncHandler(async (req, res) => {
  const { status, patient_id, from_date, to_date } = req.query;
  const rows = await invoiceService.listInvoices({ status, patient_id, from_date, to_date });
  res.json(rows);
}));

// Monthly sales stats
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await invoiceService.getMonthlyStats();
  res.json(stats);
}));

// Get single invoice (with items + payments)
router.get('/:id', asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getInvoice(req.params.id);
  res.json(invoice);
}));

// Patch invoice business date (before :id-only routes that could conflict — uses /:id/invoice-date)
router.patch('/:id/invoice-date', validate(invoiceDatePatchSchema), asyncHandler(async (req, res) => {
  const { invoice_date } = req.body;
  const invoice = await invoiceService.updateInvoiceDate(req.params.id, invoice_date);
  res.json(invoice);
}));

// Create invoice
router.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  const { patient_id, appointment_id, items, created_by, invoice_date, notes } = req.body;
  const invoice = await invoiceService.createInvoice({
    patient_id: parseInt(patient_id),
    appointment_id: appointment_id ? parseInt(appointment_id) : null,
    items: items || [],
    created_by,
    invoice_date,
    notes,
  });
  res.status(201).json(invoice);
}));

// Update invoice notes
router.patch('/:id/notes', asyncHandler(async (req, res) => {
  const invoice = await invoiceService.updateInvoiceNotes(req.params.id, req.body.notes);
  res.json(invoice);
}));

// Update invoice items
router.patch('/:id/items', asyncHandler(async (req, res) => {
  const { items } = req.body;
  const invoice = await invoiceService.updateInvoiceItems(req.params.id, items || []);
  res.json(invoice);
}));

// Add payment to invoice
router.post('/:id/payments', validate(paymentSchema), asyncHandler(async (req, res) => {
  const { amount, payment_method, received_by, payment_date } = req.body;
  const invoice = await paymentService.addPayment({
    invoice_id: parseInt(req.params.id),
    amount: parseFloat(amount),
    payment_method,
    received_by,
    payment_date,
  });
  res.status(201).json(invoice);
}));

// Mark as paid shortcut
router.patch('/:id/mark-paid', validate(markPaidSchema), asyncHandler(async (req, res) => {
  const { received_by, payment_date } = req.body;
  const invoice = await paymentService.markAsPaid(req.params.id, received_by.trim(), payment_date);
  res.json(invoice);
}));

// Delete invoice
router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await invoiceService.deleteInvoice(req.params.id);
  res.json(result);
}));

module.exports = router;
