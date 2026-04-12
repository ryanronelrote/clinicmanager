import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import TreatmentTherapistInput from '../components/TreatmentTherapistInput';
import { appointmentService } from '../services/appointmentService';
import { useAppointment } from '../hooks/useAppointment';
import { useConflictCheck } from '../hooks/useConflictCheck';
import { formatTime, formatDate } from '../utils/dateUtils';
import { outlineBtn, solidBtn } from '../utils/styleUtils';

const DURATIONS = [30, 60, 90, 120, 150, 180];

export default function AppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: appt, loading, setData: setAppt } = useAppointment(id);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [reminderStatus, setReminderStatus] = useState(null); // null | 'sending' | 'sent' | 'error' | 'no-email'
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [rescheduleDraft, setRescheduleDraft] = useState({});
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleStatus, setRescheduleStatus] = useState(null); // null | 'success' | 'error'
  const [confirming, setConfirming] = useState(false);

  const conflicts = useConflictCheck(
    rescheduleMode ? rescheduleDraft.date : null,
    rescheduleMode ? rescheduleDraft.start_time : null,
    rescheduleMode ? rescheduleDraft.duration_minutes : null,
    id
  );

  function enterEdit() {
    // Prefer structured treatment_items; fall back to splitting treatments text
    const items = appt.treatment_items && appt.treatment_items.length > 0
      ? appt.treatment_items
      : (appt.treatments
          ? appt.treatments.split('\n').filter(Boolean).map(name => ({ name, therapist: '' }))
          : [{ name: '', therapist: '' }]);
    setDraft({
      treatment_items: items,
      notes: appt.notes || '',
      status: ['tentative', 'confirmed', 'done', 'cancelled'].includes(appt.status) ? appt.status : 'confirmed',
    });
    setEditMode(true);
  }

  async function handleConfirmTentative() {
    setConfirming(true);
    try {
      const updated = await appointmentService.confirm(id);
      setAppt(updated);
    } catch {
      // stay on page if confirm fails
    } finally {
      setConfirming(false);
    }
  }

  function cancelEdit() { setEditMode(false); setDraft({}); }

  async function saveEdit() {
    setSaving(true);
    try {
      const updated = await appointmentService.update(id, draft);
      setAppt(updated);
      setEditMode(false);
    } catch {
      // keep edit mode open on failure
    } finally {
      setSaving(false);
    }
  }

  function enterReschedule() {
    setRescheduleDraft({
      date:             appt.date,
      start_time:       appt.start_time,
      duration_minutes: String(appt.duration_minutes),
    });
    setRescheduleStatus(null);
    setRescheduleMode(true);
  }

  function cancelReschedule() { setRescheduleMode(false); setRescheduleDraft({}); }

  async function confirmReschedule() {
    setRescheduling(true);
    try {
      const updated = await appointmentService.reschedule(id, {
        ...rescheduleDraft,
        duration_minutes: parseInt(rescheduleDraft.duration_minutes),
      });
      setAppt(updated);
      setRescheduleMode(false);
      setRescheduleDraft({});
      setRescheduleStatus('success');
      setTimeout(() => setRescheduleStatus(null), 4000);
    } catch {
      setRescheduleStatus('error');
    }
    setRescheduling(false);
  }

  async function sendReminder() {
    setReminderStatus('sending');
    try {
      const updated = await appointmentService.sendReminder(id);
      setAppt(updated);
      setReminderStatus('sent');
    } catch (err) {
      if (err.status === 400) {
        setReminderStatus('no-email');
      } else {
        setReminderStatus('error');
      }
    }
    setTimeout(() => setReminderStatus(null), 4000);
  }

  async function handleDelete() {
    if (!confirm('Delete this appointment?')) return;
    try {
      await appointmentService.delete(id);
      navigate('/calendar');
    } catch {
      // stay on page if delete fails
    }
  }

  if (loading) return <p>Loading...</p>;
  if (!appt) return <p>Appointment not found. <button onClick={() => navigate('/calendar')}>Back to Calendar</button></p>;

  const isAnyMode = editMode || rescheduleMode;
  const rowStyle = { borderBottom: '1px solid #e8dfd6', padding: '10px 0', display: 'flex', gap: 16, alignItems: 'flex-start' };
  const labelStyle = { fontWeight: 'bold', width: 130, flexShrink: 0, paddingTop: isAnyMode ? 6 : 0, color: '#7a6a5f' };
  const inputStyle = { padding: '6px 8px', border: '1px solid #e8dfd6', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ maxWidth: 600 }}>
      <button onClick={() => navigate('/calendar')} style={{ marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#7a6a5f', padding: 0, fontSize: 14 }}>
        ← Back to Calendar
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Appointment Details</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isAnyMode ? (
            <>
              {appt.status === 'tentative' && (
                <button
                  onClick={handleConfirmTentative}
                  disabled={confirming}
                  style={solidBtn('#d6a45c')}
                  title="Confirm this tentative appointment — sends confirmation email"
                >
                  {confirming ? 'Confirming…' : 'Confirm Appointment'}
                </button>
              )}
              <button
                onClick={sendReminder}
                disabled={reminderStatus === 'sending'}
                style={outlineBtn('#6b8f71')}
              >
                {reminderStatus === 'sending' ? 'Sending…' : 'Send Initial Reminder'}
              </button>
              <button
                onClick={() => navigate(`/invoices/create?patient_id=${appt.client_id}&appointment_id=${id}&treatments=${encodeURIComponent(appt.treatments || '')}`)}
                style={outlineBtn('#7a6a5f')}
              >
                Create Invoice
              </button>
              <button
                onClick={() => navigate(`/appointments/add?client_id=${appt.client_id}`)}
                style={solidBtn('var(--primary)')}
              >
                Schedule Next
              </button>
              <button onClick={enterReschedule} style={outlineBtn('#d6a45c')}>Reschedule</button>
              <button onClick={enterEdit} style={outlineBtn('var(--primary)')}>Edit</button>
              <button onClick={handleDelete} style={outlineBtn('#c97b7b')}>Delete</button>
            </>
          ) : editMode ? (
            <>
              <button onClick={cancelEdit} style={outlineBtn('#7a6a5f')}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={solidBtn('var(--primary)')}>{saving ? 'Saving…' : 'Save'}</button>
            </>
          ) : (
            <>
              <button onClick={cancelReschedule} style={outlineBtn('#888')}>Cancel</button>
              <button onClick={confirmReschedule} disabled={rescheduling || (conflicts && (conflicts.blocked || conflicts.count >= 3))} style={solidBtn('#d6a45c')}>
                {rescheduling ? 'Rescheduling…' : 'Confirm Reschedule'}
              </button>
            </>
          )}
        </div>
      </div>

      {reminderStatus === 'sent' && (
        <p style={{ color: '#6b8f71', fontSize: 13, margin: '0 0 12px' }}>Reminder email sent successfully.</p>
      )}
      {reminderStatus === 'no-email' && (
        <p style={{ color: '#d6a45c', fontSize: 13, margin: '0 0 12px' }}>This client has no email address on file.</p>
      )}
      {reminderStatus === 'error' && (
        <p style={{ color: '#c97b7b', fontSize: 13, margin: '0 0 12px' }}>Failed to send email. Check server logs.</p>
      )}
      {rescheduleStatus === 'success' && (
        <p style={{ color: '#6b8f71', fontSize: 13, margin: '0 0 12px' }}>Appointment rescheduled. Notification email sent.</p>
      )}
      {rescheduleStatus === 'error' && (
        <p style={{ color: '#c97b7b', fontSize: 13, margin: '0 0 12px' }}>Failed to reschedule. Check server logs.</p>
      )}
      {rescheduleMode && conflicts && conflicts.blocked && (
        <p style={{ color: '#c97b7b', background: '#faeaea', padding: '8px', borderRadius: 8, fontSize: 13, margin: '0 0 12px' }}>
          This time overlaps a blocked period. Please choose a different time.
        </p>
      )}
      {rescheduleMode && conflicts && !conflicts.blocked && conflicts.count > 0 && conflicts.count < 3 && (
        <p style={{ color: '#7a5c2e', background: '#fdf3e3', padding: '8px', borderRadius: 8, fontSize: 13, margin: '0 0 12px' }}>
          {conflicts.count} of 3 slots occupied at this time. You can still reschedule.
        </p>
      )}
      {rescheduleMode && conflicts && !conflicts.blocked && conflicts.count >= 3 && (
        <p style={{ color: '#c97b7b', background: '#faeaea', padding: '8px', borderRadius: 8, fontSize: 13, margin: '0 0 12px' }}>
          All 3 slots are occupied at this time. Please choose a different time.
        </p>
      )}

      {/* Status badge */}
      <div style={{ marginBottom: 16 }}>
        <StatusBadge status={appt.status} />
      </div>

      <div>
        {/* Client — never editable */}
        <div style={rowStyle}>
          <span style={{ ...labelStyle, paddingTop: 0 }}>Client</span>
          <Link to={`/clients/${appt.client_id}`}>{appt.first_name} {appt.last_name}</Link>
        </div>

        {/* Date */}
        <div style={rowStyle}>
          <span style={labelStyle}>Date</span>
          {rescheduleMode
            ? <input type="date" value={rescheduleDraft.date} min={new Date().toISOString().slice(0,10)}
                onChange={e => setRescheduleDraft(d => ({ ...d, date: e.target.value }))} style={inputStyle} />
            : <span>{formatDate(appt.date)}</span>}
        </div>

        {/* Start Time */}
        <div style={rowStyle}>
          <span style={labelStyle}>Start Time</span>
          {rescheduleMode
            ? <input type="time" value={rescheduleDraft.start_time}
                onChange={e => setRescheduleDraft(d => ({ ...d, start_time: e.target.value }))} style={inputStyle} />
            : <span>{formatTime(appt.start_time)}</span>}
        </div>

        {/* Duration */}
        <div style={rowStyle}>
          <span style={labelStyle}>Duration</span>
          {rescheduleMode
            ? <select value={rescheduleDraft.duration_minutes}
                onChange={e => setRescheduleDraft(d => ({ ...d, duration_minutes: e.target.value }))} style={inputStyle}>
                {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            : <span>{appt.duration_minutes} minutes</span>}
        </div>

        {/* Status */}
        <div style={rowStyle}>
          <span style={{ ...labelStyle, paddingTop: rescheduleMode ? 0 : labelStyle.paddingTop }}>Status</span>
          {editMode
            ? <select value={draft.status}
                onChange={e => setDraft(d => ({ ...d, status: e.target.value }))} style={inputStyle}>
                <option value="tentative">Tentative</option>
                <option value="confirmed">Confirmed</option>
                <option value="done">Treatment Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
            : <StatusBadge status={appt.status} />}
        </div>

        {/* Treatments (with per-item therapist) */}
        <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
          <span style={{ ...labelStyle, paddingTop: 6 }}>Treatments</span>
          {editMode
            ? <TreatmentTherapistInput
                value={draft.treatment_items}
                onChange={v => setDraft(d => ({ ...d, treatment_items: v }))}
                inputStyle={inputStyle}
              />
            : <div>
                {(appt.treatment_items && appt.treatment_items.length > 0)
                  ? appt.treatment_items.map((t, i) => (
                      <div key={i} style={{ marginBottom: 4 }}>
                        <span>{t.name}</span>
                        {t.therapist && (
                          <span style={{ marginLeft: 8, fontSize: 12, color: '#7a6a5f', background: '#f3ede8', borderRadius: 4, padding: '1px 6px' }}>
                            {t.therapist}
                          </span>
                        )}
                      </div>
                    ))
                  : appt.treatments
                    ? appt.treatments.split('\n').filter(Boolean).map((t, i) => (
                        <div key={i} style={{ marginBottom: 2 }}>{t}</div>
                      ))
                    : '—'}
              </div>}
        </div>

        {/* Notes */}
        <div style={rowStyle}>
          <span style={{ ...labelStyle, paddingTop: rescheduleMode ? 0 : labelStyle.paddingTop }}>Notes</span>
          {editMode
            ? <textarea value={draft.notes} rows={3}
                onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} />
            : <span style={{ whiteSpace: 'pre-wrap' }}>{appt.notes || '—'}</span>}
        </div>

        {/* Booked at — always read-only */}
        <div style={rowStyle}>
          <span style={{ ...labelStyle, paddingTop: 0 }}>Booked at</span>
          <span>{appt.created_at ? new Date(appt.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' }) : '—'}</span>
        </div>

        {/* Email Log */}
        <div style={{ ...rowStyle, border: 'none', flexDirection: 'column', gap: 8 }}>
          <span style={{ ...labelStyle, width: 'auto', fontWeight: 'bold', fontSize: 13, color: '#7a6a5f' }}>Email Log</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Booking Email', sentAt: appt.confirmation_sent_at },
              { label: 'Reschedule',   sentAt: appt.rescheduled_at },
              { label: 'Initial Reminder', sentAt: appt.reminder_24h_sent_at,  confirmed: appt.client_confirmed_at },
              { label: 'Final Reminder',  sentAt: appt.reminder_same_day_sent_at, confirmed: appt.client_confirmed_at },
              { label: 'Follow-up',       sentAt: appt.followup_sent_at },
              { label: 'Client Cancelled', sentAt: appt.cancelled_at },
            ].map(({ label, sentAt, confirmed }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ color: sentAt ? '#6b8f71' : '#c8bdb7', fontWeight: 'bold', fontSize: 15 }}>
                  {sentAt ? '✓' : '○'}
                </span>
                <span style={{ width: 120, color: '#7a6a5f' }}>{label}</span>
                <span style={{ color: sentAt ? '#7a6a5f' : '#c8bdb7' }}>
                  {sentAt ? new Date(sentAt).toLocaleString('en-US', { timeZone: 'Asia/Manila' }) : 'Not sent'}
                </span>
                {sentAt && confirmed !== undefined && (
                  <span style={{
                    marginLeft: 8, fontSize: 11, fontWeight: 'bold',
                    color: confirmed ? '#6b8f71' : '#c8bdb7',
                    background: confirmed ? '#edf4ee' : 'var(--hover-bg)',
                    border: `1px solid ${confirmed ? '#6b8f71' : '#e8dfd6'}`,
                    borderRadius: 10, padding: '1px 8px',
                  }}>
                    {confirmed ? '✓ Confirmed by client' : 'Awaiting confirmation'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const STATUS_CONFIG = {
  tentative:            { label: 'Tentative',              color: '#7a5c2e', bg: '#fdf3e3' },
  confirmed:            { label: 'Confirmed',             color: 'var(--primary)', bg: 'var(--primary-light)' },
  confirmed_by_client:  { label: 'Confirmed by Client',   color: '#3d5c41', bg: '#edf4ee' },
  done:                 { label: 'Treatment Done',         color: '#7a6a5f', bg: '#f3eeea' },
  cancelled:            { label: 'Cancelled',              color: '#8b3a3a', bg: '#faeaea' },
  cancelled_by_client:  { label: 'Cancelled by Client',   color: '#8b3a3a', bg: '#faeaea' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.confirmed;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33`,
    }}>
      <span style={{ fontSize: 8, lineHeight: 1 }}>●</span>
      {cfg.label}
    </span>
  );
}

