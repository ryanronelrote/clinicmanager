import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import TreatmentListInput from '../components/TreatmentListInput';

const DURATIONS = [30, 60, 90, 120, 150, 180];

function formatTime(str) {
  const [h, m] = str.split(':').map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function AppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appt, setAppt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [reminderStatus, setReminderStatus] = useState(null); // null | 'sending' | 'sent' | 'error' | 'no-email'
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [rescheduleDraft, setRescheduleDraft] = useState({});
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleStatus, setRescheduleStatus] = useState(null); // null | 'success' | 'error'

  useEffect(() => {
    fetch(`/appointments/${id}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setAppt(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  function enterEdit() {
    setDraft({
      therapist:  appt.therapist || '',
      treatments: appt.treatments || '',
      notes:      appt.notes || '',
      status:     ['confirmed', 'done', 'cancelled'].includes(appt.status) ? appt.status : 'confirmed',
    });
    setEditMode(true);
  }

  function cancelEdit() { setEditMode(false); setDraft({}); }

  async function saveEdit() {
    setSaving(true);
    const res = await fetch(`/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    const updated = await res.json();
    setAppt(updated);
    setSaving(false);
    setEditMode(false);
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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`/appointments/${id}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rescheduleDraft, duration_minutes: parseInt(rescheduleDraft.duration_minutes) }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const updated = await res.json();
        setAppt(updated);
        setRescheduleMode(false);
        setRescheduleDraft({});
        setRescheduleStatus('success');
        setTimeout(() => setRescheduleStatus(null), 4000);
      } else {
        setRescheduleStatus('error');
      }
    } catch {
      setRescheduleStatus('error');
    }
    setRescheduling(false);
  }

  async function sendReminder() {
    setReminderStatus('sending');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`/appointments/${id}/send-reminder`, { method: 'POST', signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const updated = await res.json();
        setAppt(updated);
        setReminderStatus('sent');
      } else if (res.status === 400) {
        setReminderStatus('no-email');
      } else {
        setReminderStatus('error');
      }
    } catch {
      setReminderStatus('error');
    }
    setTimeout(() => setReminderStatus(null), 4000);
  }

  async function handleDelete() {
    if (!confirm('Delete this appointment?')) return;
    await fetch(`/appointments/${id}`, { method: 'DELETE' });
    navigate('/calendar');
  }

  if (loading) return <p>Loading...</p>;
  if (!appt) return <p>Appointment not found. <button onClick={() => navigate('/calendar')}>Back to Calendar</button></p>;

  const isAnyMode = editMode || rescheduleMode;
  const rowStyle = { borderBottom: '1px solid #eee', padding: '10px 0', display: 'flex', gap: 16, alignItems: 'flex-start' };
  const labelStyle = { fontWeight: 'bold', width: 130, flexShrink: 0, paddingTop: isAnyMode ? 6 : 0 };
  const inputStyle = { padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ maxWidth: 600 }}>
      <button onClick={() => navigate('/calendar')} style={{ marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0 }}>
        ← Back to Calendar
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Appointment Details</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isAnyMode ? (
            <>
              <button
                onClick={sendReminder}
                disabled={reminderStatus === 'sending'}
                style={outlineBtn('#0f9d58')}
              >
                {reminderStatus === 'sending' ? 'Sending…' : 'Send Initial Reminder'}
              </button>
              <button onClick={enterReschedule} style={outlineBtn('#e07b54')}>Reschedule</button>
              <button onClick={enterEdit} style={outlineBtn('var(--primary)')}>Edit</button>
              <button onClick={handleDelete} style={outlineBtn('#cc3333')}>Delete</button>
            </>
          ) : editMode ? (
            <>
              <button onClick={cancelEdit} style={outlineBtn('#888')}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={solidBtn('var(--primary)')}>{saving ? 'Saving…' : 'Save'}</button>
            </>
          ) : (
            <>
              <button onClick={cancelReschedule} style={outlineBtn('#888')}>Cancel</button>
              <button onClick={confirmReschedule} disabled={rescheduling} style={solidBtn('#e07b54')}>
                {rescheduling ? 'Rescheduling…' : 'Confirm Reschedule'}
              </button>
            </>
          )}
        </div>
      </div>

      {reminderStatus === 'sent' && (
        <p style={{ color: '#0f9d58', fontSize: 13, margin: '0 0 12px' }}>Reminder email sent successfully.</p>
      )}
      {reminderStatus === 'no-email' && (
        <p style={{ color: '#e07b54', fontSize: 13, margin: '0 0 12px' }}>This client has no email address on file.</p>
      )}
      {reminderStatus === 'error' && (
        <p style={{ color: '#cc3333', fontSize: 13, margin: '0 0 12px' }}>Failed to send email. Check server logs.</p>
      )}
      {rescheduleStatus === 'success' && (
        <p style={{ color: '#0f9d58', fontSize: 13, margin: '0 0 12px' }}>Appointment rescheduled. Notification email sent.</p>
      )}
      {rescheduleStatus === 'error' && (
        <p style={{ color: '#cc3333', fontSize: 13, margin: '0 0 12px' }}>Failed to reschedule. Check server logs.</p>
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

        {/* Therapist */}
        <div style={rowStyle}>
          <span style={{ ...labelStyle, paddingTop: rescheduleMode ? 0 : labelStyle.paddingTop }}>Therapist</span>
          {editMode
            ? <input type="text" value={draft.therapist} placeholder="e.g. Sarah"
                onChange={e => setDraft(d => ({ ...d, therapist: e.target.value }))} style={inputStyle} />
            : <span>{appt.therapist || '—'}</span>}
        </div>

        {/* Status */}
        <div style={rowStyle}>
          <span style={{ ...labelStyle, paddingTop: rescheduleMode ? 0 : labelStyle.paddingTop }}>Status</span>
          {editMode
            ? <select value={draft.status}
                onChange={e => setDraft(d => ({ ...d, status: e.target.value }))} style={inputStyle}>
                <option value="confirmed">Confirmed</option>
                <option value="done">Treatment Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
            : <StatusBadge status={appt.status} />}
        </div>

        {/* Treatments */}
        <div style={rowStyle}>
          <span style={{ ...labelStyle, paddingTop: rescheduleMode ? 0 : labelStyle.paddingTop }}>Treatments</span>
          {editMode
            ? <TreatmentListInput
                value={draft.treatments}
                onChange={v => setDraft(d => ({ ...d, treatments: v }))}
                inputStyle={inputStyle}
              />
            : <div>
                {appt.treatments
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
          <span style={{ ...labelStyle, width: 'auto', fontWeight: 'bold', fontSize: 13, color: '#555' }}>Email Log</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Confirmation', sentAt: appt.confirmation_sent_at },
              { label: 'Reschedule',   sentAt: appt.rescheduled_at },
              { label: 'Initial Reminder', sentAt: appt.reminder_24h_sent_at,  confirmed: appt.client_confirmed_at },
              { label: 'Final Reminder',  sentAt: appt.reminder_same_day_sent_at, confirmed: appt.client_confirmed_at },
              { label: 'Follow-up',       sentAt: appt.followup_sent_at },
              { label: 'Client Cancelled', sentAt: appt.cancelled_at },
            ].map(({ label, sentAt, confirmed }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ color: sentAt ? '#0f9d58' : '#ccc', fontWeight: 'bold', fontSize: 15 }}>
                  {sentAt ? '✓' : '○'}
                </span>
                <span style={{ width: 120, color: '#555' }}>{label}</span>
                <span style={{ color: sentAt ? '#555' : '#bbb' }}>
                  {sentAt ? new Date(sentAt).toLocaleString('en-US', { timeZone: 'Asia/Manila' }) : 'Not sent'}
                </span>
                {sentAt && confirmed !== undefined && (
                  <span style={{
                    marginLeft: 8, fontSize: 11, fontWeight: 'bold',
                    color: confirmed ? '#0f9d58' : '#bbb',
                    background: confirmed ? '#e8f5e9' : 'var(--hover-bg)',
                    border: `1px solid ${confirmed ? '#a5d6a7' : '#ddd'}`,
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
  confirmed:            { label: 'Confirmed',             color: 'var(--primary)', bg: 'var(--primary-light)' },
  confirmed_by_client:  { label: 'Confirmed by Client',   color: '#0f9d58', bg: '#e8f5e9' },
  done:                 { label: 'Treatment Done',         color: '#666',    bg: '#f0f0f0' },
  cancelled:            { label: 'Cancelled',              color: '#cc3333', bg: '#fdecea' },
  cancelled_by_client:  { label: 'Cancelled by Client',   color: '#e07b54', bg: '#fff3ee' },
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

function outlineBtn(color) {
  return { padding: '5px 14px', fontSize: 13, cursor: 'pointer', borderRadius: 4, border: `1px solid ${color}`, background: '#fff', color };
}
function solidBtn(color) {
  return { padding: '5px 14px', fontSize: 13, cursor: 'pointer', borderRadius: 4, border: 'none', background: color, color: '#fff', fontWeight: '600' };
}
