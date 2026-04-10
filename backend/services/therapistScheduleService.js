const { pool } = require('../database');

function svcError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// ── Therapists CRUD ───────────────────────────────────────────

async function getTherapists() {
  const { rows } = await pool.query('SELECT * FROM therapists ORDER BY name');
  return rows;
}

async function addTherapist(name) {
  const trimmed = name.trim();
  if (!trimmed) throw svcError(400, 'Therapist name is required');
  const { rows } = await pool.query(
    'INSERT INTO therapists (name) VALUES ($1) RETURNING *',
    [trimmed]
  );
  return rows[0];
}

async function removeTherapist(id) {
  const parsedId = parseInt(id);
  const { rows } = await pool.query('SELECT id FROM therapists WHERE id = $1', [parsedId]);
  if (!rows.length) throw svcError(404, 'Therapist not found');
  // Schedules are deleted via ON DELETE CASCADE
  await pool.query('DELETE FROM therapists WHERE id = $1', [parsedId]);
  return { success: true };
}

// ── Schedule ──────────────────────────────────────────────────

/**
 * Returns { therapists, schedules } for the given month string ('YYYY-MM').
 */
async function getMonthlySchedule(month) {
  const [y, m] = month.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const daysInMonth = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const [therapistsResult, schedulesResult] = await Promise.all([
    pool.query('SELECT * FROM therapists ORDER BY name'),
    pool.query(
      'SELECT * FROM therapist_schedules WHERE date >= $1 AND date <= $2 ORDER BY therapist_id, date',
      [start, end]
    ),
  ]);

  return {
    therapists: therapistsResult.rows,
    schedules: schedulesResult.rows,
  };
}

/**
 * Upsert a shift assignment.
 * If (therapist_id, date) exists → update shift_type.
 * Else → insert.
 */
async function upsertSchedule({ therapist_id, date, shift_type }) {
  const parsedId = parseInt(therapist_id);

  // Verify therapist exists
  const { rows: tRows } = await pool.query('SELECT id FROM therapists WHERE id = $1', [parsedId]);
  if (!tRows.length) throw svcError(404, 'Therapist not found');

  const { rows } = await pool.query(
    `INSERT INTO therapist_schedules (therapist_id, date, shift_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (therapist_id, date)
     DO UPDATE SET shift_type = $3, updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [parsedId, date, shift_type]
  );
  return rows[0];
}

/**
 * Remove a shift assignment (clear cell).
 */
async function deleteSchedule({ therapist_id, date }) {
  await pool.query(
    'DELETE FROM therapist_schedules WHERE therapist_id = $1 AND date = $2',
    [parseInt(therapist_id), date]
  );
  return { success: true };
}

module.exports = {
  getTherapists,
  addTherapist,
  removeTherapist,
  getMonthlySchedule,
  upsertSchedule,
  deleteSchedule,
};
