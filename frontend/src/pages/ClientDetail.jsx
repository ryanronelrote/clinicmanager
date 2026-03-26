import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TreatmentListInput from '../components/TreatmentListInput';

function toDateStr(date) { return date.toISOString().slice(0, 10); }
const today = toDateStr(new Date());

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

const VIP_BADGE = (
  <span style={{
    background: '#fbbf24', color: '#78350f',
    borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: '700',
  }}>★ VIP Client</span>
);

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editMode, setEditMode] = useState(false);
  const [profileDraft, setProfileDraft] = useState({});
  const [treatmentDrafts, setTreatmentDrafts] = useState({});
  const [therapistDrafts, setTherapistDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Inline add-past-appointment row state
  const [newPast, setNewPast] = useState({ date: '', therapist: '', treatments: '', notes: '' });
  const [addingPast, setAddingPast] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/clients/${id}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch(`/appointments?client_id=${id}`).then(r => r.json()),
    ])
      .then(([c, appts]) => { setClient(c); setAppointments(appts); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  function enterEdit() {
    setProfileDraft({
      first_name: client.first_name,
      last_name:  client.last_name,
      phone:      client.phone || '',
      email:      client.email || '',
      notes:      client.notes || '',
    });
    const drafts = {};
    const thDrafts = {};
    appointments.forEach(a => {
      drafts[a.id] = a.treatments || '';
      thDrafts[a.id] = a.therapist || '';
    });
    setTreatmentDrafts(drafts);
    setTherapistDrafts(thDrafts);
    setNewPast({ date: '', therapist: '', treatments: '', notes: '' });
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setProfileDraft({});
    setTreatmentDrafts({});
    setTherapistDrafts({});
    setNewPast({ date: '', therapist: '', treatments: '', notes: '' });
  }

  async function saveEdit() {
    setSaving(true);

    const profileRes = await fetch(`/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileDraft),
    });
    setClient(await profileRes.json());

    const apptUpdates = appointments
      .filter(a =>
        treatmentDrafts[a.id] !== (a.treatments || '') ||
        (therapistDrafts[a.id] ?? '') !== (a.therapist || '')
      )
      .map(a =>
        fetch(`/appointments/${a.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            treatments: treatmentDrafts[a.id],
            therapist: therapistDrafts[a.id] || null,
          }),
        }).then(r => r.json())
      );

    const updatedAppts = await Promise.all(apptUpdates);
    if (updatedAppts.length > 0) {
      setAppointments(prev => prev.map(a => updatedAppts.find(u => u.id === a.id) || a));
    }

    setSaving(false);
    setEditMode(false);
  }

  async function toggleVip() {
    setToggling(true);
    const res = await fetch(`/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_vip: client.is_vip ? 0 : 1 }),
    });
    setClient(await res.json());
    setToggling(false);
  }

  async function addPastAppointment() {
    if (!newPast.date) return;
    setAddingPast(true);
    const res = await fetch('/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: parseInt(id),
        date: newPast.date,
        start_time: '12:00',
        duration_minutes: 60,
        therapist: newPast.therapist || null,
        treatments: newPast.treatments || null,
        notes: newPast.notes || null,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      // Re-fetch to get the joined client name fields
      const full = await fetch(`/appointments/${created.id}`).then(r => r.json());
      setAppointments(prev => [...prev, full]);
      // Reset add row and add drafts for new appt
      setTreatmentDrafts(d => ({ ...d, [full.id]: full.treatments || '' }));
      setTherapistDrafts(d => ({ ...d, [full.id]: full.therapist || '' }));
      setNewPast({ date: '', therapist: '', treatments: '', notes: '' });
    }
    setAddingPast(false);
  }

  if (loading) return <p>Loading...</p>;
  if (!client) return <p>Client not found. <button onClick={() => navigate('/clients')}>Back to list</button></p>;

  const upcoming = appointments.filter(a => a.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past     = appointments.filter(a => a.date <  today).sort((a, b) => b.date.localeCompare(a.date));

  const inputStyle = { padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, width: '100%', boxSizing: 'border-box', fontSize: 14 };
  const rowStyle   = { borderBottom: '1px solid #eee', padding: '10px 0', display: 'flex', gap: 16, alignItems: 'flex-start' };
  const labelStyle = { fontWeight: 'bold', width: 100, flexShrink: 0, paddingTop: 2 };

  return (
    <div style={{ maxWidth: 680 }}>
      <button onClick={() => navigate('/clients')} style={{ marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0 }}>← Back</button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0 }}>{client.first_name} {client.last_name}</h2>
          {client.is_vip ? VIP_BADGE : null}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!editMode ? (
            <button onClick={enterEdit} style={outlineBtn('#1a73e8')}>Edit</button>
          ) : (
            <>
              <button onClick={cancelEdit} style={outlineBtn('#888')}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={solidBtn('#1a73e8')}>{saving ? 'Saving…' : 'Save'}</button>
            </>
          )}
        </div>
      </div>

      {/* VIP toggle */}
      <div style={{ marginBottom: 16 }}>
        <button onClick={toggleVip} disabled={toggling} style={{
          padding: '4px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 4,
          border: client.is_vip ? '1px solid #d97706' : '1px solid #ccc',
          background: client.is_vip ? '#fffbeb' : '#fafafa',
          color: client.is_vip ? '#92400e' : '#555',
        }}>
          {client.is_vip ? 'Remove VIP' : 'Mark as VIP'}
        </button>
      </div>

      {/* Profile fields */}
      <div style={{ marginBottom: 24 }}>
        {editMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ flex: 1 }}>
                <span style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 3 }}>First Name</span>
                <input style={inputStyle} value={profileDraft.first_name} onChange={e => setProfileDraft(d => ({ ...d, first_name: e.target.value }))} />
              </label>
              <label style={{ flex: 1 }}>
                <span style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 3 }}>Last Name</span>
                <input style={inputStyle} value={profileDraft.last_name} onChange={e => setProfileDraft(d => ({ ...d, last_name: e.target.value }))} />
              </label>
            </div>
            <label>
              <span style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 3 }}>Phone</span>
              <input style={inputStyle} value={profileDraft.phone} onChange={e => setProfileDraft(d => ({ ...d, phone: e.target.value }))} />
            </label>
            <label>
              <span style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 3 }}>Email</span>
              <input style={inputStyle} type="email" value={profileDraft.email} onChange={e => setProfileDraft(d => ({ ...d, email: e.target.value }))} />
            </label>
            <label>
              <span style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 3 }}>Notes</span>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={profileDraft.notes} onChange={e => setProfileDraft(d => ({ ...d, notes: e.target.value }))} />
            </label>
          </div>
        ) : (
          <>
            <div style={rowStyle}><span style={labelStyle}>Phone</span><span>{client.phone || '—'}</span></div>
            <div style={rowStyle}><span style={labelStyle}>Email</span><span>{client.email || '—'}</span></div>
            <div style={rowStyle}><span style={labelStyle}>Notes</span><span style={{ whiteSpace: 'pre-wrap' }}>{client.notes || '—'}</span></div>
            <div style={rowStyle}><span style={labelStyle}>Added</span><span>{new Date(client.created_at).toLocaleDateString()}</span></div>
          </>
        )}
      </div>

      {/* ── Upcoming Appointments ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: '#333' }}>Upcoming Appointments</h3>
          <button
            onClick={() => navigate(`/appointments/add?client_id=${id}`)}
            style={solidBtn('#0f9d58')}
          >
            + Schedule Appointment
          </button>
        </div>
        {upcoming.length === 0 ? (
          <p style={{ color: '#aaa', fontSize: 13, margin: 0 }}>No upcoming appointments</p>
        ) : (
          <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
            {upcoming.map((appt, i) => (
              <ApptRow key={appt.id} appt={appt} i={i} editMode={editMode}
                treatmentDrafts={treatmentDrafts} setTreatmentDrafts={setTreatmentDrafts}
                therapistDrafts={therapistDrafts} setTherapistDrafts={setTherapistDrafts}
                navigate={navigate} muted={false} />
            ))}
          </div>
        )}
      </div>

      {/* ── Past Appointments ── */}
      <div style={{ marginBottom: 28 }}>
        <h3 style={{ marginBottom: 10, fontSize: 15, color: '#333' }}>Past Appointments</h3>
        {past.length === 0 && !editMode && (
          <p style={{ color: '#aaa', fontSize: 13, margin: 0 }}>No past appointments</p>
        )}
        {past.length > 0 && (
          <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden', marginBottom: editMode ? 8 : 0 }}>
            {past.map((appt, i) => (
              <ApptRow key={appt.id} appt={appt} i={i} editMode={editMode}
                treatmentDrafts={treatmentDrafts} setTreatmentDrafts={setTreatmentDrafts}
                therapistDrafts={therapistDrafts} setTherapistDrafts={setTherapistDrafts}
                navigate={navigate} muted={true} />
            ))}
          </div>
        )}

        {/* Inline add-past row (edit mode only) */}
        {editMode && (
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            padding: '10px 12px', border: '1px dashed #ccc', borderRadius: 8, background: '#fafafa',
          }}>
            <input
              type="date"
              max={today}
              value={newPast.date}
              onChange={e => setNewPast(d => ({ ...d, date: e.target.value }))}
              style={{ padding: '5px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, flexShrink: 0 }}
            />
            <input
              type="text"
              placeholder="Therapist"
              value={newPast.therapist}
              onChange={e => setNewPast(d => ({ ...d, therapist: e.target.value }))}
              style={{ padding: '5px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, width: 110, flexShrink: 0 }}
            />
            <div style={{ flex: 1 }}>
              <TreatmentListInput
                value={newPast.treatments}
                onChange={v => setNewPast(d => ({ ...d, treatments: v }))}
                inputStyle={{ padding: '5px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13 }}
                placeholder="Treatments"
              />
            </div>
            <input
              type="text"
              placeholder="Notes"
              value={newPast.notes}
              onChange={e => setNewPast(d => ({ ...d, notes: e.target.value }))}
              style={{ padding: '5px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, flex: 1 }}
            />
            <button
              onClick={addPastAppointment}
              disabled={!newPast.date || addingPast}
              style={{ ...solidBtn('#555'), flexShrink: 0, alignSelf: 'flex-start' }}
            >
              {addingPast ? '…' : '+ Add'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ApptRow({ appt, i, editMode, treatmentDrafts, setTreatmentDrafts, therapistDrafts, setTherapistDrafts, navigate, muted }) {
  const inputStyle = { padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box', fontSize: 13 };
  return (
    <div
      key={appt.id}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '11px 14px',
        borderTop: i > 0 ? '1px solid #f0f0f0' : 'none',
        background: '#fff',
        cursor: editMode ? 'default' : 'pointer',
        opacity: muted ? 0.65 : 1,
      }}
      onClick={() => { if (!editMode) navigate(`/appointments/${appt.id}`); }}
      onMouseEnter={e => { if (!editMode) e.currentTarget.style.background = '#f8f9ff'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
    >
      <div style={{ minWidth: 150, fontSize: 13, fontWeight: '600', color: muted ? '#888' : '#333', paddingTop: editMode ? 5 : 0 }}>
        {formatDate(appt.date)}
      </div>
      <div style={{ flex: 1 }} onClick={e => editMode && e.stopPropagation()}>
        {editMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input
              value={therapistDrafts[appt.id] ?? appt.therapist ?? ''}
              onChange={e => setTherapistDrafts(d => ({ ...d, [appt.id]: e.target.value }))}
              placeholder="Therapist"
              style={{ ...inputStyle, width: '100%' }}
            />
            <TreatmentListInput
              value={treatmentDrafts[appt.id] ?? appt.treatments ?? ''}
              onChange={v => setTreatmentDrafts(d => ({ ...d, [appt.id]: v }))}
              inputStyle={inputStyle}
              placeholder="Treatments"
            />
          </div>
        ) : (
          <div>
            {appt.therapist && (
              <div style={{ fontSize: 12, color: muted ? '#aaa' : '#888', marginBottom: 2 }}>{appt.therapist}</div>
            )}
            <span style={{ fontSize: 13, color: muted ? '#999' : '#555' }}>
              {appt.treatments
                ? appt.treatments.split('\n').filter(Boolean).join(', ')
                : <span style={{ color: '#ccc' }}>No treatments recorded</span>}
            </span>
          </div>
        )}
      </div>
      {!editMode && appt.notes && (
        <div style={{ fontSize: 12, color: '#bbb', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {appt.notes}
        </div>
      )}
    </div>
  );
}

function outlineBtn(color) {
  return { padding: '5px 14px', fontSize: 13, cursor: 'pointer', borderRadius: 4, border: `1px solid ${color}`, background: '#fff', color };
}
function solidBtn(color) {
  return { padding: '5px 14px', fontSize: 13, cursor: 'pointer', borderRadius: 4, border: 'none', background: color, color: '#fff', fontWeight: '600' };
}
