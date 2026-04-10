const router = require('express').Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const svc = require('../services/therapistScheduleService');

// ── Therapists ────────────────────────────────────────────────

// GET /therapist-schedules/therapists
router.get('/therapists', asyncHandler(async (req, res) => {
  const therapists = await svc.getTherapists();
  res.json(therapists);
}));

// POST /therapist-schedules/therapists
router.post('/therapists', validate({
  body: { name: { required: true, type: 'string', maxLength: 100 } },
}), asyncHandler(async (req, res) => {
  const therapist = await svc.addTherapist(req.body.name);
  res.status(201).json(therapist);
}));

// DELETE /therapist-schedules/therapists/:id
router.delete('/therapists/:id', asyncHandler(async (req, res) => {
  const result = await svc.removeTherapist(req.params.id);
  res.json(result);
}));

// ── Schedule ──────────────────────────────────────────────────

// GET /therapist-schedules?month=YYYY-MM
router.get('/', validate({
  query: { month: { required: true, type: 'string', pattern: /^\d{4}-\d{2}$/ } },
}), asyncHandler(async (req, res) => {
  const data = await svc.getMonthlySchedule(req.query.month);
  res.json(data);
}));

// POST /therapist-schedules  (upsert)
router.post('/', validate({
  body: {
    therapist_id: { required: true,  type: 'integer', min: 1 },
    date:         { required: true,  type: 'string',  pattern: /^\d{4}-\d{2}-\d{2}$/ },
    shift_type:   { required: true,  type: 'string',  maxLength: 50 },
  },
}), asyncHandler(async (req, res) => {
  const { therapist_id, date, shift_type } = req.body;
  const record = await svc.upsertSchedule({ therapist_id, date, shift_type });
  res.status(201).json(record);
}));

// DELETE /therapist-schedules  (clear a cell)
router.delete('/', validate({
  body: {
    therapist_id: { required: true, type: 'integer', min: 1 },
    date:         { required: true, type: 'string',  pattern: /^\d{4}-\d{2}-\d{2}$/ },
  },
}), asyncHandler(async (req, res) => {
  const { therapist_id, date } = req.body;
  const result = await svc.deleteSchedule({ therapist_id, date });
  res.json(result);
}));

module.exports = router;
