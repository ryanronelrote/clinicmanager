const { pool } = require('./database');

// ── Helpers ───────────────────────────────────────────────────

function formatDate(str) {
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatTime(str) {
  if (!str) return '';
  const [h, m] = str.split(':').map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function formatTreatments(treatments) {
  return treatments ? treatments.split('\n').filter(Boolean).join(', ') : 'Appointment';
}

function render(str, vars) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

async function buildEmail(name, defaultSubject, defaultBody, vars) {
  const { rows } = await pool.query(
    `SELECT key, value FROM settings WHERE key = ANY($1)`,
    [[`email_tpl_${name}_subject`, `email_tpl_${name}_body`]]
  );
  const m = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const subject = m[`email_tpl_${name}_subject`] || defaultSubject;
  const body    = m[`email_tpl_${name}_body`]    || defaultBody;
  return { subject: render(subject, vars), html: render(body, vars) };
}

function confirmButtonHtml(confirmUrl) {
  if (!confirmUrl) return '';
  return `<div style="margin:20px 0;"><a href="${confirmUrl}" style="display:inline-block;padding:12px 24px;background:#0f9d58;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;">✓ Confirm My Attendance</a></div><p style="font-size:12px;color:#999;">If the button doesn't work, copy and paste this link into your browser:<br>${confirmUrl}</p>`;
}

function cancelButtonHtml(cancelUrl) {
  if (!cancelUrl) return '';
  return `<div style="margin:8px 0 20px;"><a href="${cancelUrl}" style="display:inline-block;padding:10px 20px;background:#fff;color:#cc3333;text-decoration:none;border-radius:6px;font-weight:bold;font-size:13px;border:1px solid #cc3333;">✕ Cancel Appointment</a></div><p style="font-size:12px;color:#999;">Cancellations must be made more than 6 hours before your appointment.</p>`;
}

// ── Templates ─────────────────────────────────────────────────

async function appointmentConfirmation(clientName, date, time, treatments) {
  return buildEmail('booking',
    'Your Appointment Has Been Booked',
    `<h2>Appointment Booked!</h2><p>Hi <strong>{{clientName}}</strong>,</p><p>Thank you for booking with us! We have received your appointment and look forward to seeing you.</p><p><strong>Date:</strong> {{date}}<br><strong>Time:</strong> {{time}}<br><strong>Service:</strong> {{treatments}}</p><p>If you need to reschedule or have any questions, feel free to contact us.</p>`,
    { clientName, date: formatDate(date), time: formatTime(time), treatments: formatTreatments(treatments) }
  );
}

async function appointmentReminder24h(clientName, date, time, treatments, confirmUrl, cancelUrl) {
  return buildEmail('reminder_24h',
    'Initial Reminder',
    `<h2>Initial Reminder: Appointment Tomorrow</h2><p>Hi <strong>{{clientName}}</strong>,</p><p>Just a friendly reminder that you have an appointment with us tomorrow.</p><p><strong>Date:</strong> {{date}}<br><strong>Time:</strong> {{time}}<br><strong>Service:</strong> {{treatments}}</p>{{confirmButton}}{{cancelButton}}<p>See you soon!</p>`,
    { clientName, date: formatDate(date), time: formatTime(time), treatments: formatTreatments(treatments), confirmButton: confirmButtonHtml(confirmUrl), cancelButton: cancelButtonHtml(cancelUrl) }
  );
}

async function appointmentReminderSameDay(clientName, time, confirmUrl, cancelUrl) {
  return buildEmail('reminder_same_day',
    'Final Reminder',
    `<h2>Final Reminder: Your Appointment is Today!</h2><p>Hi <strong>{{clientName}}</strong>,</p><p>This is a reminder that your appointment is today at <strong>{{time}}</strong>.</p>{{confirmButton}}{{cancelButton}}<p>We look forward to seeing you!</p>`,
    { clientName, time: formatTime(time), confirmButton: confirmButtonHtml(confirmUrl), cancelButton: cancelButtonHtml(cancelUrl) }
  );
}

async function clientConfirmedNotification(clientName, date, time) {
  return buildEmail('clinic_confirmed',
    `Client Confirmed: {{clientName}}`,
    `<h2>Attendance Confirmed by Client</h2><p><strong>{{clientName}}</strong> has confirmed their attendance for the appointment on <strong>{{date}}</strong> at <strong>{{time}}</strong>.</p>`,
    { clientName, date: formatDate(date), time: formatTime(time) }
  );
}

async function appointmentRescheduled(clientName, oldDate, oldTime, newDate, newTime, treatments) {
  return buildEmail('rescheduled',
    'Appointment Rescheduled',
    `<h2>Your Appointment Has Been Rescheduled</h2><p>Hi <strong>{{clientName}}</strong>,</p><p>Your appointment has been moved to a new date and time.</p><p><strong>New Date:</strong> {{newDate}}<br><strong>New Time:</strong> {{newTime}}<br><strong>Service:</strong> {{treatments}}</p><p><em>Previous appointment was on {{date}} at {{time}}.</em></p><p>If you have any questions, feel free to contact us.</p>`,
    { clientName, date: formatDate(oldDate), time: formatTime(oldTime), newDate: formatDate(newDate), newTime: formatTime(newTime), treatments: formatTreatments(treatments) }
  );
}

async function clientCancelledNotification(clientName, date, time) {
  return buildEmail('clinic_cancelled',
    `Client Cancelled: {{clientName}}`,
    `<h2>Appointment Cancelled by Client</h2><p><strong>{{clientName}}</strong> has cancelled their appointment on <strong>{{date}}</strong> at <strong>{{time}}</strong>.</p>`,
    { clientName, date: formatDate(date), time: formatTime(time) }
  );
}

async function attendanceConfirmedReceipt(clientName, date, startTime, treatments) {
  return buildEmail('confirmed_receipt',
    'Your appointment is confirmed ✓',
    `<h2>Attendance Confirmed ✓</h2><p>Hi <strong>{{clientName}}</strong>,</p><p>We have received your confirmation. We look forward to seeing you!</p><p><strong>Date:</strong> {{date}}<br><strong>Time:</strong> {{time}}<br><strong>Service:</strong> {{treatments}}</p><p>If you need to make any changes, please contact us as soon as possible.</p><p>See you soon!</p>`,
    { clientName, date: formatDate(date), time: formatTime(startTime), treatments: formatTreatments(treatments) }
  );
}

async function followUpEmail(clientName) {
  return buildEmail('follow_up',
    'How was your treatment?',
    `<h2>How was your visit?</h2><p>Hi <strong>{{clientName}}</strong>,</p><p>Thank you for coming in! We hope you enjoyed your treatment and are feeling great.</p><p>We'd love to see you again. Feel free to book your next appointment anytime.</p>`,
    { clientName }
  );
}

// ── Template registry (for UI) ────────────────────────────────

const TEMPLATE_REGISTRY = [
  { name: 'booking',           label: 'Booking Email',            vars: ['clientName', 'date', 'time', 'treatments'] },
  { name: 'reminder_24h',      label: '24h Reminder',             vars: ['clientName', 'date', 'time', 'treatments', 'confirmButton', 'cancelButton'] },
  { name: 'reminder_same_day', label: 'Same-day Reminder',        vars: ['clientName', 'time', 'confirmButton', 'cancelButton'] },
  { name: 'confirmed_receipt', label: 'Confirmation Receipt',     vars: ['clientName', 'date', 'time', 'treatments'] },
  { name: 'rescheduled',       label: 'Rescheduled',              vars: ['clientName', 'date', 'time', 'newDate', 'newTime', 'treatments'] },
  { name: 'follow_up',         label: 'Follow-up',                vars: ['clientName'] },
  { name: 'clinic_confirmed',  label: 'Clinic: Client Confirmed', vars: ['clientName', 'date', 'time'] },
  { name: 'clinic_cancelled',  label: 'Clinic: Client Cancelled', vars: ['clientName', 'date', 'time'] },
];

module.exports = {
  appointmentConfirmation, appointmentReminder24h, appointmentReminderSameDay,
  followUpEmail, appointmentRescheduled, clientConfirmedNotification,
  clientCancelledNotification, attendanceConfirmedReceipt,
  TEMPLATE_REGISTRY,
};
