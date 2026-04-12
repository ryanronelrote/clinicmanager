const router = require('express').Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const { escHtml, confirmPage } = require('../helpers/htmlHelpers');
const appointmentService = require('../services/appointmentService');

// ── Validation schemas ───────────────────────────────────────

const createSchema = {
  body: {
    client_id:        { required: true,  type: 'integer', min: 1 },
    date:             { required: true,  type: 'string',  pattern: /^\d{4}-\d{2}-\d{2}$/ },
    start_time:       { required: true,  type: 'string',  pattern: /^\d{2}:\d{2}$/ },
    duration_minutes: { required: true,  type: 'integer', min: 15, max: 480 },
    therapist:        { required: false, type: 'string',  maxLength: 100 },
    treatments:       { required: false, type: 'string' },
    notes:            { required: false, type: 'string' },
  },
};

const rescheduleSchema = {
  body: {
    date:             { required: true,  type: 'string',  pattern: /^\d{4}-\d{2}-\d{2}$/ },
    start_time:       { required: true,  type: 'string',  pattern: /^\d{2}:\d{2}$/ },
    duration_minutes: { required: true,  type: 'integer', min: 15, max: 480 },
  },
};

const conflictQuerySchema = {
  query: {
    date:       { required: true,  type: 'string',  pattern: /^\d{4}-\d{2}-\d{2}$/ },
    start_time: { required: true,  type: 'string',  pattern: /^\d{2}:\d{2}$/ },
    duration:   { required: true,  type: 'integer', min: 1 },
  },
};

// ── Routes ───────────────────────────────────────────────────

// GET /appointments/check-conflicts
router.get('/check-conflicts', validate(conflictQuerySchema), asyncHandler(async (req, res) => {
  const { date, start_time, duration, exclude_id } = req.query;
  const result = await appointmentService.checkConflicts(date, start_time, duration, exclude_id);
  res.json(result);
}));

// POST /appointments
router.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  const { client_id, date, start_time, duration_minutes, treatments, therapist, notes, status, treatment_items, appointment_type } = req.body;
  const appt = await appointmentService.create({
    client_id: parseInt(client_id),
    date, start_time,
    duration_minutes: parseInt(duration_minutes),
    treatments, therapist, notes, status, treatment_items, appointment_type,
  });
  res.status(201).json(appt);
}));

// GET /appointments
router.get('/', asyncHandler(async (req, res) => {
  const rows = await appointmentService.list({
    week: req.query.week,
    month: req.query.month,
    client_id: req.query.client_id,
  });
  res.json(rows);
}));

// GET /appointments/:id
router.get('/:id', asyncHandler(async (req, res) => {
  if (req.params.id === 'check-conflicts') return; // handled above
  const appt = await appointmentService.getById(req.params.id);
  res.json(appt);
}));

// PATCH /appointments/:id/confirm  (staff confirms a tentative appointment)
router.patch('/:id/confirm', asyncHandler(async (req, res) => {
  const updated = await appointmentService.confirmAppointment(req.params.id);
  res.json(updated);
}));

// PATCH /appointments/:id
router.patch('/:id', asyncHandler(async (req, res) => {
  const { treatments, therapist, notes, date, start_time, duration_minutes, status, treatment_items, appointment_type } = req.body;
  const updated = await appointmentService.update(req.params.id, {
    treatments, therapist, notes, date, start_time, duration_minutes, status, treatment_items, appointment_type,
  });
  res.json(updated);
}));

// POST /appointments/:id/send-reminder
router.post('/:id/send-reminder', asyncHandler(async (req, res) => {
  const updated = await appointmentService.sendReminder(req.params.id);
  res.json(updated);
}));

// POST /appointments/:id/reschedule
router.post('/:id/reschedule', validate(rescheduleSchema), asyncHandler(async (req, res) => {
  const { date, start_time, duration_minutes } = req.body;
  const updated = await appointmentService.reschedule(req.params.id, {
    date, start_time,
    duration_minutes: parseInt(duration_minutes),
  });
  res.json(updated);
}));

// GET /appointments/:id/confirm  (public — no auth, returns HTML)
router.get('/:id/confirm', asyncHandler(async (req, res) => {
  const result = await appointmentService.confirmByClient(req.params.id, req.query.token);

  if (result.type === 'error') {
    return res.send(confirmPage(result.title, result.message, '#cc3333'));
  }

  const { row, dateStr } = result;
  res.send(confirmPage(
    'Attendance Confirmed!',
    `Thank you, <strong>${escHtml(row.first_name)} ${escHtml(row.last_name)}</strong>! Your appointment on ${dateStr} has been confirmed. See you soon!`,
    '#0f9d58'
  ));
}));

// GET /appointments/:id/cancel  (public — no auth, returns HTML)
router.get('/:id/cancel', asyncHandler(async (req, res) => {
  const result = await appointmentService.cancelByClient(req.params.id, req.query.token);

  if (result.type === 'error') {
    return res.send(confirmPage(result.title, result.message, '#cc3333'));
  }

  const { dateStr } = result;
  res.send(confirmPage(
    'Appointment Cancelled',
    `Your appointment on ${dateStr} has been cancelled. We hope to see you again soon!`,
    '#e07b54'
  ));
}));

// DELETE /appointments/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await appointmentService.remove(req.params.id);
  res.json(result);
}));

module.exports = router;
