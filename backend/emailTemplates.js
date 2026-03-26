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

function appointmentConfirmation(clientName, date, time, treatments) {
  return {
    subject: 'Appointment Confirmed',
    html: `
      <h2>Appointment Confirmed ✓</h2>
      <p>Hi <strong>${clientName}</strong>,</p>
      <p>Your appointment has been confirmed. We look forward to seeing you!</p>
      <p>
        <strong>Date:</strong> ${formatDate(date)}<br>
        <strong>Time:</strong> ${formatTime(time)}<br>
        <strong>Service:</strong> ${treatments ? treatments.split('\n').filter(Boolean).join(', ') : 'Appointment'}
      </p>
      <p>If you need to reschedule or have any questions, feel free to contact us.</p>
    `,
  };
}

function confirmButton(confirmUrl) {
  if (!confirmUrl) return '';
  return `
    <div style="margin: 20px 0;">
      <a href="${confirmUrl}" style="display:inline-block;padding:12px 24px;background:#0f9d58;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;">
        ✓ Confirm My Attendance
      </a>
    </div>
    <p style="font-size:12px;color:#999;">If the button doesn't work, copy and paste this link into your browser:<br>${confirmUrl}</p>
  `;
}

function cancelButton(cancelUrl) {
  if (!cancelUrl) return '';
  return `
    <div style="margin: 8px 0 20px;">
      <a href="${cancelUrl}" style="display:inline-block;padding:10px 20px;background:#fff;color:#cc3333;text-decoration:none;border-radius:6px;font-weight:bold;font-size:13px;border:1px solid #cc3333;">
        ✕ Cancel Appointment
      </a>
    </div>
    <p style="font-size:12px;color:#999;">Cancellations must be made more than 6 hours before your appointment.</p>
  `;
}

function appointmentReminder24h(clientName, date, time, treatments, confirmUrl, cancelUrl) {
  return {
    subject: 'Initial Reminder',
    html: `
      <h2>Initial Reminder: Appointment Tomorrow</h2>
      <p>Hi <strong>${clientName}</strong>,</p>
      <p>Just a friendly reminder that you have an appointment with us tomorrow.</p>
      <p>
        <strong>Date:</strong> ${formatDate(date)}<br>
        <strong>Time:</strong> ${formatTime(time)}<br>
        <strong>Service:</strong> ${treatments ? treatments.split('\n').filter(Boolean).join(', ') : 'Appointment'}
      </p>
      ${confirmButton(confirmUrl)}
      ${cancelButton(cancelUrl)}
      <p>See you soon!</p>
    `,
  };
}

function appointmentReminderSameDay(clientName, time, confirmUrl, cancelUrl) {
  return {
    subject: 'Final Reminder',
    html: `
      <h2>Final Reminder: Your Appointment is Today!</h2>
      <p>Hi <strong>${clientName}</strong>,</p>
      <p>This is a reminder that your appointment is today at <strong>${formatTime(time)}</strong>.</p>
      ${confirmButton(confirmUrl)}
      ${cancelButton(cancelUrl)}
      <p>We look forward to seeing you!</p>
    `,
  };
}

function clientConfirmedNotification(clientName, date, time) {
  return {
    subject: `Client Confirmed: ${clientName}`,
    html: `
      <h2>Attendance Confirmed by Client</h2>
      <p><strong>${clientName}</strong> has confirmed their attendance for the appointment on <strong>${formatDate(date)}</strong> at <strong>${formatTime(time)}</strong>.</p>
    `,
  };
}

function appointmentRescheduled(clientName, oldDate, oldTime, newDate, newTime, treatments) {
  return {
    subject: 'Appointment Rescheduled',
    html: `
      <h2>Your Appointment Has Been Rescheduled</h2>
      <p>Hi <strong>${clientName}</strong>,</p>
      <p>Your appointment has been moved to a new date and time.</p>
      <p>
        <strong>New Date:</strong> ${formatDate(newDate)}<br>
        <strong>New Time:</strong> ${formatTime(newTime)}<br>
        <strong>Service:</strong> ${treatments ? treatments.split('\n').filter(Boolean).join(', ') : 'Appointment'}
      </p>
      <p><em>Previous appointment was on ${formatDate(oldDate)} at ${formatTime(oldTime)}.</em></p>
      <p>If you have any questions, feel free to contact us.</p>
    `,
  };
}

function clientCancelledNotification(clientName, date, time) {
  return {
    subject: `Client Cancelled: ${clientName}`,
    html: `
      <h2>Appointment Cancelled by Client</h2>
      <p><strong>${clientName}</strong> has cancelled their appointment on <strong>${formatDate(date)}</strong> at <strong>${formatTime(time)}</strong>.</p>
    `,
  };
}

function followUpEmail(clientName) {
  return {
    subject: 'How was your treatment?',
    html: `
      <h2>How was your visit?</h2>
      <p>Hi <strong>${clientName}</strong>,</p>
      <p>Thank you for coming in! We hope you enjoyed your treatment and are feeling great.</p>
      <p>We'd love to see you again. Feel free to book your next appointment anytime.</p>
    `,
  };
}

module.exports = { appointmentConfirmation, appointmentReminder24h, appointmentReminderSameDay, followUpEmail, appointmentRescheduled, clientConfirmedNotification, clientCancelledNotification };
