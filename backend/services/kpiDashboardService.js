const { pool } = require('../database');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const APPT_ACTIVE = `a.status NOT IN ('cancelled', 'cancelled_by_client')`;
const INVOICE_DAY = `i.invoice_date`;
const APPT_DAY = `a.date::date`;

function svcError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function parseISODate(s) {
  if (!DATE_RE.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return { y, m, d, utc: dt };
}

function formatISODate(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Inclusive day count between two parsed dates (same calendar logic as UTC parts). */
function inclusiveDayCount(start, end) {
  const t0 = Date.UTC(start.y, start.m - 1, start.d);
  const t1 = Date.UTC(end.y, end.m - 1, end.d);
  return Math.floor((t1 - t0) / 86400000) + 1;
}

function addDays(parsed, delta) {
  const t = Date.UTC(parsed.y, parsed.m - 1, parsed.d) + delta * 86400000;
  const d = new Date(t);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    utc: d,
  };
}

/**
 * Previous comparison window per plan:
 * - Today (single day): yesterday
 * - Full ISO week Mon–Sun: previous week Mon–Sun
 * - Full calendar month: entire previous calendar month
 * - Otherwise: equal-length block ending the day before start
 */
function computePreviousWindow(startStr, endStr) {
  const start = parseISODate(startStr);
  const end = parseISODate(endStr);
  const days = inclusiveDayCount(start, end);

  if (days === 1) {
    const prev = addDays(start, -1);
    return { previousStart: formatISODate(prev.y, prev.m, prev.d), previousEnd: formatISODate(prev.y, prev.m, prev.d) };
  }

  const isMonday = (p) => {
    const dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
    return dow === 1;
  };
  const isSunday = (p) => {
    const dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
    return dow === 0;
  };

  if (days === 7 && isMonday(start) && isSunday(end)) {
    const pStart = addDays(start, -7);
    const pEnd = addDays(end, -7);
    return {
      previousStart: formatISODate(pStart.y, pStart.m, pStart.d),
      previousEnd: formatISODate(pEnd.y, pEnd.m, pEnd.d),
    };
  }

  const lastDay = daysInMonth(start.y, start.m);
  const isFullMonth =
    start.d === 1 &&
    end.y === start.y &&
    end.m === start.m &&
    end.d === lastDay;

  if (isFullMonth) {
    let py = start.y;
    let pm = start.m - 1;
    if (pm < 1) {
      pm = 12;
      py -= 1;
    }
    const pe = daysInMonth(py, pm);
    return {
      previousStart: formatISODate(py, pm, 1),
      previousEnd: formatISODate(py, pm, pe),
    };
  }

  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  return {
    previousStart: formatISODate(prevStart.y, prevStart.m, prevStart.d),
    previousEnd: formatISODate(prevEnd.y, prevEnd.m, prevEnd.d),
  };
}

function enumerateDays(startStr, endStr) {
  const start = parseISODate(startStr);
  const end = parseISODate(endStr);
  const out = [];
  let cur = { ...start };
  const endT = Date.UTC(end.y, end.m - 1, end.d);
  for (;;) {
    const t = Date.UTC(cur.y, cur.m - 1, cur.d);
    out.push(formatISODate(cur.y, cur.m, cur.d));
    if (t >= endT) break;
    cur = addDays(cur, 1);
  }
  return out;
}

function mergeDaily(revenueRows, apptRows, allDays) {
  const revMap = Object.fromEntries(revenueRows.map((r) => [r.d, parseFloat(r.revenue) || 0]));
  const apMap = Object.fromEntries(apptRows.map((r) => [r.d, parseInt(r.cnt, 10) || 0]));
  return allDays.map((date) => ({
    date,
    revenue: revMap[date] ?? 0,
    appointments: apMap[date] ?? 0,
  }));
}

async function sumRevenueForRange(startDate, endDate) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(COALESCE(i.amount_paid, 0)), 0)::float8 AS total
     FROM invoices i
     WHERE ${INVOICE_DAY} BETWEEN $1::date AND $2::date`,
    [startDate, endDate]
  );
  return parseFloat(rows[0].total) || 0;
}

async function countAppointmentsForRange(startDate, endDate) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS c
     FROM appointments a
     WHERE ${APPT_DAY} BETWEEN $1::date AND $2::date
       AND ${APPT_ACTIVE}`,
    [startDate, endDate]
  );
  return rows[0].c || 0;
}

async function revenueByDay(startDate, endDate) {
  const { rows } = await pool.query(
    `SELECT ${INVOICE_DAY}::text AS d, COALESCE(SUM(COALESCE(i.amount_paid, 0)), 0)::float8 AS revenue
     FROM invoices i
     WHERE ${INVOICE_DAY} BETWEEN $1::date AND $2::date
     GROUP BY 1
     ORDER BY 1`,
    [startDate, endDate]
  );
  return rows;
}

async function appointmentsByDay(startDate, endDate) {
  const { rows } = await pool.query(
    `SELECT ${APPT_DAY}::text AS d, COUNT(*)::int AS cnt
     FROM appointments a
     WHERE ${APPT_DAY} BETWEEN $1::date AND $2::date
       AND ${APPT_ACTIVE}
     GROUP BY 1
     ORDER BY 1`,
    [startDate, endDate]
  );
  return rows;
}

async function topTreatments(startDate, endDate) {
  const { rows } = await pool.query(
    `SELECT ii.name,
            COALESCE(SUM(ii.quantity), 0)::float8 AS count,
            COALESCE(SUM(ii.total_price), 0)::float8 AS revenue
     FROM invoice_items ii
     JOIN invoices i ON i.id = ii.invoice_id
     WHERE ${INVOICE_DAY} BETWEEN $1::date AND $2::date
     GROUP BY ii.name
     ORDER BY revenue DESC NULLS LAST, count DESC
     LIMIT 50`,
    [startDate, endDate]
  );
  return rows.map((r) => ({
    name: r.name,
    count: Math.round((parseFloat(r.count) || 0) * 100) / 100,
    revenue: Math.round((parseFloat(r.revenue) || 0) * 100) / 100,
  }));
}

async function therapistStats(startDate, endDate) {
  const { rows } = await pool.query(
    `WITH appts AS (
       SELECT id,
              COALESCE(NULLIF(TRIM(therapist), ''), 'Unassigned') AS tname,
              client_id
       FROM appointments a
       WHERE ${APPT_DAY} BETWEEN $1::date AND $2::date
         AND ${APPT_ACTIVE}
     ),
     by_therapist AS (
       SELECT tname,
              COUNT(*)::int AS appointments_handled,
              COUNT(DISTINCT client_id)::int AS clients_handled
       FROM appts
       GROUP BY tname
     ),
     rev AS (
       SELECT COALESCE(NULLIF(TRIM(a.therapist), ''), 'Unassigned') AS tname,
              COALESCE(SUM(COALESCE(i.amount_paid, 0)), 0)::float8 AS revenue
       FROM invoices i
       JOIN appointments a ON a.id = i.appointment_id
       WHERE ${INVOICE_DAY} BETWEEN $1::date AND $2::date
         AND ${APPT_DAY} BETWEEN $1::date AND $2::date
         AND ${APPT_ACTIVE}
       GROUP BY 1
     )
     SELECT bt.tname AS name,
            COALESCE(r.revenue, 0)::float8 AS revenue,
            bt.appointments_handled,
            bt.clients_handled
     FROM by_therapist bt
     LEFT JOIN rev r ON r.tname = bt.tname
     ORDER BY revenue DESC NULLS LAST, bt.appointments_handled DESC`,
    [startDate, endDate]
  );
  return rows.map((r) => ({
    name: r.name,
    revenue: Math.round((parseFloat(r.revenue) || 0) * 100) / 100,
    appointmentsHandled: r.appointments_handled,
    clientsHandled: r.clients_handled,
  }));
}

function avgOrNull(revenue, count) {
  if (!count || count <= 0) return null;
  return Math.round((revenue / count) * 100) / 100;
}

async function getKpiDashboard({ startDate, endDate }) {
  if (!startDate || !endDate) {
    throw svcError(400, 'startDate and endDate are required (YYYY-MM-DD)');
  }
  if (!parseISODate(startDate) || !parseISODate(endDate)) {
    throw svcError(400, 'Invalid date format; use YYYY-MM-DD');
  }
  if (startDate > endDate) {
    throw svcError(400, 'startDate must be on or before endDate');
  }

  const { previousStart, previousEnd } = computePreviousWindow(startDate, endDate);

  const [
    totalRevenue,
    previousRevenue,
    appointmentCount,
    previousAppointmentCount,
    revDays,
    apptDays,
    topTreatmentsRows,
    therapistRows,
  ] = await Promise.all([
    sumRevenueForRange(startDate, endDate),
    sumRevenueForRange(previousStart, previousEnd),
    countAppointmentsForRange(startDate, endDate),
    countAppointmentsForRange(previousStart, previousEnd),
    revenueByDay(startDate, endDate),
    appointmentsByDay(startDate, endDate),
    topTreatments(startDate, endDate),
    therapistStats(startDate, endDate),
  ]);

  const allDays = enumerateDays(startDate, endDate);
  const dailyBreakdown = mergeDaily(revDays, apptDays, allDays);
  const revenueByDayOut = dailyBreakdown.map(({ date, revenue }) => ({ date, revenue }));
  const appointmentsByDayOut = dailyBreakdown.map(({ date, appointments: count }) => ({ date, count }));

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    previousRevenue: Math.round(previousRevenue * 100) / 100,
    appointmentCount,
    previousAppointmentCount,
    avgRevenue: avgOrNull(totalRevenue, appointmentCount),
    previousAvgRevenue: avgOrNull(previousRevenue, previousAppointmentCount),
    topTreatments: topTreatmentsRows,
    therapistStats: therapistRows,
    revenueByDay: revenueByDayOut,
    appointmentsByDay: appointmentsByDayOut,
    dailyBreakdown,
    meta: {
      previousStart,
      previousEnd,
    },
  };
}

module.exports = { getKpiDashboard, computePreviousWindow };
