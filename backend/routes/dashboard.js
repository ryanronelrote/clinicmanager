const router = require('express').Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { getKpiDashboard } = require('../services/kpiDashboardService');

router.get('/kpi', asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const data = await getKpiDashboard({ startDate, endDate });
  res.json(data);
}));

module.exports = router;
