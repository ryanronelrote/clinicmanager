import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TreatmentListInput from '../components/TreatmentListInput';
import { clientService } from '../services/clientService';
import { appointmentService } from '../services/appointmentService';
import { useClient } from '../hooks/useClient';
import { useAppointmentsByClient } from '../hooks/useAppointments';
import { toDateStr, formatDateShort, calcAge } from '../utils/dateUtils';
import { outlineBtn, solidBtn, VIP_BADGE_FULL } from '../utils/styleUtils';
import { EMPTY_MH } from '../utils/medicalHistory';

const today = toDateStr(new Date());

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: client, loading: clientLoading, setData: setClient } = useClient(id);
  const { data: appointmentsData, loading: apptsLoading, setData: setAppointments } = useAppointmentsByClient(id);

  const loading = clientLoading || apptsLoading;
  const appointments = appointmentsData || [];

  const [editMode, setEditMode] = useState(false);
  const [profileDraft, setProfileDraft] = useState({});
  const [treatmentDrafts, setTreatmentDrafts] = useState({});
  const [therapistDrafts, setTherapistDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleConfirmDelete() {
    setDeleting(true);
    setPasswordError('');
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: confirmPassword }),
      });
      if (!res.ok) {
        setPasswordError('Incorrect password');
        setDeleting(false);
        return;
      }
      await clientService.delete(id);
      navigate('/clients');
    } catch {
      setPasswordError('Something went wrong. Try again.');
      setDeleting(false);
    }
  }

  const [newPast, setNewPast] = useState({ date: '', therapist: '', treatments: '', notes: '' });
  const [addingPast, setAddingPast] = useState(false);

  function enterEdit() {
    const mh = (client.medical_history && typeof client.medical_history === 'object')
      ? { ...EMPTY_MH, ...client.medical_history }
      : { ...EMPTY_MH };
    setProfileDraft({
      first_name: client.first_name,
      last_name:  client.last_name,
      phone:      client.phone || '',
      email:      client.email || '',
      birthdate:  client.birthdate || '',
      sex:        client.sex || '',
      address:    client.address || '',
      occupation: client.occupation || '',
      civil_status: client.civil_status || '',
      notes:      client.notes || '',
      medical_history: mh,
    });
    const drafts = {}, thDrafts = {};
    appointments.forEach(a => { drafts[a.id] = a.treatments || ''; thDrafts[a.id] = a.therapist || ''; });
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
    try {
      const updatedClient = await clientService.update(id, profileDraft);
      setClient(updatedClient);

      const apptUpdates = appointments
        .filter(a =>
          treatmentDrafts[a.id] !== (a.treatments || '') ||
          (therapistDrafts[a.id] ?? '') !== (a.therapist || '')
        )
        .map(a => appointmentService.update(a.id, { treatments: treatmentDrafts[a.id], therapist: therapistDrafts[a.id] || null }));

      const updatedAppts = await Promise.all(apptUpdates);
      if (updatedAppts.length > 0) {
        setAppointments(prev => prev.map(a => updatedAppts.find(u => u.id === a.id) || a));
      }
    } catch (err) {
      console.error('Save failed:', err);
    }
    setSaving(false);
    setEditMode(false);
  }

  async function toggleVip() {
    setToggling(true);
    try {
      const updated = await clientService.update(id, { is_vip: client.is_vip ? 0 : 1 });
      setClient(updated);
    } catch (err) {
      console.error('Toggle VIP failed:', err);
    }
    setToggling(false);
  }

  async function addPastAppointment() {
    if (!newPast.date) return;
    setAddingPast(true);
    try {
      const created = await appointmentService.create({
        client_id: parseInt(id),
        date: newPast.date,
        start_time: '12:00',
        duration_minutes: 60,
        therapist: newPast.therapist || null,
        treatments: newPast.treatments || null,
        notes: newPast.notes || null,
      });
      const full = await appointmentService.getById(created.id);
      setAppointments(prev => [...prev, full]);
      setTreatmentDrafts(d => ({ ...d, [full.id]: full.treatments || '' }));
      setTherapistDrafts(d => ({ ...d, [full.id]: full.therapist || '' }));
      setNewPast({ date: '', therapist: '', treatments: '', notes: '' });
    } catch (err) {
      console.error('Add past appointment failed:', err);
    }
    setAddingPast(false);
  }

  if (loading) return <p>Loading...</p>;
  if (!client) return <p>Client not found. <button onClick={() => navigate('/clients')}>Back to list</button></p>;

  const upcoming = appointments.filter(a => a.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past     = appointments.filter(a => a.date <  today).sort((a, b) => b.date.localeCompare(a.date));

  const inputStyle = { padding: '6px 8px', border: '1px solid #e8dfd6', borderRadius: 8, width: '100%', boxSizing: 'border-box', fontSize: 14 };
  const mh = editMode
    ? (profileDraft.medical_history || EMPTY_MH)
    : ((client.medical_history && typeof client.medical_history === 'object') ? client.medical_history : EMPTY_MH);

  function setMH(key, val) {
    setProfileDraft(d => ({ ...d, medical_history: { ...d.medical_history, [key]: val } }));
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <button onClick={() => navigate('/clients')} style={{ marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#7a6a5f', padding: 0, fontSize: 14 }}>← Back</button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0 }}>{client.first_name} {client.last_name}</h2>
          {client.is_vip ? VIP_BADGE_FULL : null}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={toggleVip} disabled={toggling} style={{
            padding: '4px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 8,
            border: client.is_vip ? '1px solid #d6a45c' : '1px solid #e8dfd6',
            background: client.is_vip ? '#fdf3e3' : '#fdfaf6',
            color: client.is_vip ? '#7a5c2e' : '#7a6a5f',
            transition: 'background 0.15s ease',
          }}>
            {client.is_vip ? 'Remove VIP' : 'Mark as VIP'}
          </button>
          {!editMode ? (
            <button onClick={enterEdit} style={outlineBtn('var(--primary)')}>Edit</button>
          ) : (
            <>
              <button onClick={cancelEdit} style={outlineBtn('#7a6a5f')}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={solidBtn('var(--primary)')}>{saving ? 'Saving…' : 'Save'}</button>
            </>
          )}
          <button onClick={() => { setShowDeleteModal(true); setConfirmPassword(''); setPasswordError(''); }} style={outlineBtn('#c97b7b')}>
            Delete client
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteConfirmModal
          clientName={`${client.first_name} ${client.last_name}`}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          passwordError={passwordError}
          deleting={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => { setShowDeleteModal(false); setConfirmPassword(''); setPasswordError(''); }}
        />
      )}

      {/* ── Patient Chart ── */}
      <div style={{ border: '1px solid #e8dfd6', borderRadius: 8, padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ fontWeight: '700', fontSize: 15, textAlign: 'center', marginBottom: 16, letterSpacing: 1 }}>PATIENT CHART</div>

        {/* Personal info */}
        {editMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ flex: 1 }}>
                <span style={lblStyle}>First Name *</span>
                <input style={inputStyle} value={profileDraft.first_name} onChange={e => setProfileDraft(d => ({ ...d, first_name: e.target.value }))} required />
              </label>
              <label style={{ flex: 1 }}>
                <span style={lblStyle}>Last Name *</span>
                <input style={inputStyle} value={profileDraft.last_name} onChange={e => setProfileDraft(d => ({ ...d, last_name: e.target.value }))} required />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ flex: 2 }}>
                <span style={lblStyle}>Birthdate</span>
                <input type="date" style={inputStyle} value={profileDraft.birthdate} onChange={e => setProfileDraft(d => ({ ...d, birthdate: e.target.value }))} />
              </label>
              <label style={{ flex: 1 }}>
                <span style={lblStyle}>Sex</span>
                <select style={inputStyle} value={profileDraft.sex} onChange={e => setProfileDraft(d => ({ ...d, sex: e.target.value }))}>
                  <option value="">—</option>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </label>
              <label style={{ flex: 1 }}>
                <span style={lblStyle}>Civil Status</span>
                <select style={inputStyle} value={profileDraft.civil_status} onChange={e => setProfileDraft(d => ({ ...d, civil_status: e.target.value }))}>
                  <option value="">—</option>
                  <option>Single</option><option>Married</option><option>Widowed</option><option>Separated</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ flex: 1 }}>
                <span style={lblStyle}>Address</span>
                <input style={inputStyle} value={profileDraft.address} onChange={e => setProfileDraft(d => ({ ...d, address: e.target.value }))} />
              </label>
              <label style={{ flex: 1 }}>
                <span style={lblStyle}>Occupation</span>
                <input style={inputStyle} value={profileDraft.occupation} onChange={e => setProfileDraft(d => ({ ...d, occupation: e.target.value }))} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ flex: 1 }}>
                <span style={lblStyle}>Contact Number</span>
                <input style={inputStyle} value={profileDraft.phone} onChange={e => setProfileDraft(d => ({ ...d, phone: e.target.value }))} />
              </label>
              <label style={{ flex: 1 }}>
                <span style={lblStyle}>Email Address</span>
                <input type="email" style={inputStyle} value={profileDraft.email} onChange={e => setProfileDraft(d => ({ ...d, email: e.target.value }))} />
              </label>
            </div>
            <label>
              <span style={lblStyle}>Notes</span>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={profileDraft.notes} onChange={e => setProfileDraft(d => ({ ...d, notes: e.target.value }))} />
            </label>
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            {/* Row 1 */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e8dfd6', paddingBottom: 8, marginBottom: 8, flexWrap: 'wrap', gap: 16 }}>
              <ChartField label="Birthdate" value={client.birthdate ? new Date(client.birthdate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null} />
              <ChartField label="Age" value={calcAge(client.birthdate) != null ? `${calcAge(client.birthdate)} yrs` : null} />
              <ChartField label="Sex" value={client.sex} />
            </div>
            <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid #e8dfd6', paddingBottom: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <ChartField label="Address" value={client.address} flex={2} />
              <ChartField label="Occupation" value={client.occupation} />
              <ChartField label="Status" value={client.civil_status} />
            </div>
            <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid #e8dfd6', paddingBottom: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <ChartField label="Contact Number" value={client.phone} />
              <ChartField label="Email Address" value={client.email} flex={2} />
            </div>
            {client.notes && (
              <div style={{ borderBottom: '1px solid #e8dfd6', paddingBottom: 8, marginBottom: 8 }}>
                <ChartField label="Notes" value={client.notes} />
              </div>
            )}
            <div style={{ fontSize: 12, color: '#b8a99e', marginTop: 4 }}>
              Added: {new Date(client.created_at).toLocaleDateString()}
            </div>
          </div>
        )}

        {/* Medical History */}
        <div style={{ borderTop: '1px solid #e8dfd6', paddingTop: 14 }}>
          <div style={{ fontWeight: '600', fontSize: 14, marginBottom: 12 }}>Medical History:</div>

          {editMode ? (
            <div>
              <MHEditQ num={1} text="Are you currently taking prescription, herbal or over the counter medication?">
                <YesNoEdit value={mh.q1_medications} onChange={v => setMH('q1_medications', v)} name="mh1" />
                {mh.q1_medications === 'yes' && <ExplainEdit label="If YES please explain:" value={mh.q1_explain} onChange={v => setMH('q1_explain', v)} inp={inputStyle} />}
              </MHEditQ>
              <MHEditQ num={2} text="List all past and current medical conditions:">
                <input style={{ ...inputStyle, marginTop: 4 }} value={mh.q2_conditions} onChange={e => setMH('q2_conditions', e.target.value)} placeholder="e.g. Hypertension…" />
              </MHEditQ>
              <MHEditQ num={3} text="Have you had any surgeries?">
                <YesNoEdit value={mh.q3_surgeries} onChange={v => setMH('q3_surgeries', v)} name="mh3" />
                {mh.q3_surgeries === 'yes' && <ExplainEdit label="If YES please list:" value={mh.q3_list} onChange={v => setMH('q3_list', v)} inp={inputStyle} />}
              </MHEditQ>
              <MHEditQ num={4} text="Do you have any metal in your body including active implants (pacemaker, defibrillator, cochlear implant, screws, stents, hip/knee replacement)?">
                <YesNoEdit value={mh.q4_metal} onChange={v => setMH('q4_metal', v)} name="mh4" />
                {mh.q4_metal === 'yes' && <ExplainEdit label="If YES please list and explain:" value={mh.q4_explain} onChange={v => setMH('q4_explain', v)} inp={inputStyle} />}
              </MHEditQ>
              <MHEditQ num={5} text="Are you currently pregnant or nursing?">
                <YesNoEdit value={mh.q5_pregnant} onChange={v => setMH('q5_pregnant', v)} name="mh5" />
              </MHEditQ>
              <MHEditQ num={6} text="If you are a woman of childbearing potential are you using birth control?">
                <YesNoEdit value={mh.q6_birth_control} onChange={v => setMH('q6_birth_control', v)} name="mh6" />
                {mh.q6_birth_control === 'yes' && <ExplainEdit label="Please explain:" value={mh.q6_explain} onChange={v => setMH('q6_explain', v)} inp={inputStyle} />}
              </MHEditQ>
              <MHEditQ num={7} text="Do you have a history of any skin disease or sensitivity?">
                <YesNoEdit value={mh.q7_skin_disease} onChange={v => setMH('q7_skin_disease', v)} name="mh7" />
                {mh.q7_skin_disease === 'yes' && <ExplainEdit label="If YES please explain:" value={mh.q7_explain} onChange={v => setMH('q7_explain', v)} inp={inputStyle} />}
              </MHEditQ>
              <MHEditQ num={8} text="What is your daily intake of water (cups)?">
                <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                  {['0-2', '2-4', '4-6', '8-10'].map(opt => (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13 }}>
                      <input type="radio" name={`mh8_${id}`} checked={mh.q8_water === opt} onChange={() => setMH('q8_water', opt)} /> {opt}
                    </label>
                  ))}
                </div>
              </MHEditQ>
              <MHEditQ num={9} text="Do you engage in any light physical activity such as walking?">
                <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                  {['Never', 'Rarely', 'Sometimes', 'Always'].map(opt => (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13 }}>
                      <input type="radio" name={`mh9_${id}`} checked={mh.q9_activity === opt} onChange={() => setMH('q9_activity', opt)} /> {opt}
                    </label>
                  ))}
                </div>
              </MHEditQ>
              <MHEditQ num={10} text="Do any of discussed contraindications apply to you?">
                <YesNoEdit value={mh.q10_contraindications} onChange={v => setMH('q10_contraindications', v)} name="mh10" />
                {mh.q10_contraindications === 'yes' && <ExplainEdit label="If YES please explain:" value={mh.q10_explain} onChange={v => setMH('q10_explain', v)} inp={inputStyle} />}
              </MHEditQ>
              <MHEditQ num={11} text="Which area(s) are you interested in receiving treatments?">
                <input style={{ ...inputStyle, marginTop: 4 }} value={mh.q11_areas} onChange={e => setMH('q11_areas', e.target.value)} />
              </MHEditQ>
            </div>
          ) : (
            <div>
              <MHViewQ num={1} text="Currently taking prescription/herbal/OTC medication?" yesno={mh.q1_medications} explain={mh.q1_explain} />
              <MHViewQ num={2} text="Past and current medical conditions:" value={mh.q2_conditions} />
              <MHViewQ num={3} text="Had any surgeries?" yesno={mh.q3_surgeries} explain={mh.q3_list} />
              <MHViewQ num={4} text="Metal in body / active implants?" yesno={mh.q4_metal} explain={mh.q4_explain} />
              <MHViewQ num={5} text="Currently pregnant or nursing?" yesno={mh.q5_pregnant} />
              <MHViewQ num={6} text="Using birth control?" yesno={mh.q6_birth_control} explain={mh.q6_explain} />
              <MHViewQ num={7} text="History of skin disease or sensitivity?" yesno={mh.q7_skin_disease} explain={mh.q7_explain} />
              <MHViewQ num={8} text="Daily water intake:" value={mh.q8_water ? `${mh.q8_water} cups` : null} />
              <MHViewQ num={9} text="Physical activity level:" value={mh.q9_activity} />
              <MHViewQ num={10} text="Any contraindications apply?" yesno={mh.q10_contraindications} explain={mh.q10_explain} />
              <MHViewQ num={11} text="Treatment areas of interest:" value={mh.q11_areas} />
            </div>
          )}
        </div>
      </div>

      {/* ── Upcoming Appointments ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: '#3e2f25' }}>Upcoming Appointments</h3>
          <button onClick={() => navigate(`/appointments/add?client_id=${id}`)} style={solidBtn('#6b8f71')}>
            + Schedule Appointment
          </button>
        </div>
        {upcoming.length === 0 ? (
          <p style={{ color: '#b8a99e', fontSize: 13, margin: 0 }}>No upcoming appointments</p>
        ) : (
          <div style={{ border: '1px solid #e8dfd6', borderRadius: 8, overflow: 'hidden' }}>
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
        <h3 style={{ marginBottom: 10, fontSize: 15, color: '#3e2f25' }}>Past Appointments</h3>
        {past.length === 0 && !editMode && (
          <p style={{ color: '#b8a99e', fontSize: 13, margin: 0 }}>No past appointments</p>
        )}
        {past.length > 0 && (
          <div style={{ border: '1px solid #e8dfd6', borderRadius: 8, overflow: 'hidden', marginBottom: editMode ? 8 : 0 }}>
            {past.map((appt, i) => (
              <ApptRow key={appt.id} appt={appt} i={i} editMode={editMode}
                treatmentDrafts={treatmentDrafts} setTreatmentDrafts={setTreatmentDrafts}
                therapistDrafts={therapistDrafts} setTherapistDrafts={setTherapistDrafts}
                navigate={navigate} muted={true} />
            ))}
          </div>
        )}
        {editMode && (
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            padding: '10px 12px', border: '1px dashed #e8dfd6', borderRadius: 8, background: '#fdfaf6',
          }}>
            <input type="date" max={today} value={newPast.date}
              onChange={e => setNewPast(d => ({ ...d, date: e.target.value }))}
              style={{ padding: '5px 8px', border: '1px solid #e8dfd6', borderRadius: 8, fontSize: 13, flexShrink: 0 }} />
            <input type="text" placeholder="Therapist" value={newPast.therapist}
              onChange={e => setNewPast(d => ({ ...d, therapist: e.target.value }))}
              style={{ padding: '5px 8px', border: '1px solid #e8dfd6', borderRadius: 8, fontSize: 13, width: 110, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <TreatmentListInput value={newPast.treatments} onChange={v => setNewPast(d => ({ ...d, treatments: v }))}
                inputStyle={{ padding: '5px 8px', border: '1px solid #e8dfd6', borderRadius: 8, fontSize: 13 }}
                placeholder="Treatments" />
            </div>
            <input type="text" placeholder="Notes" value={newPast.notes}
              onChange={e => setNewPast(d => ({ ...d, notes: e.target.value }))}
              style={{ padding: '5px 8px', border: '1px solid #e8dfd6', borderRadius: 8, fontSize: 13, flex: 1 }} />
            <button onClick={addPastAppointment} disabled={!newPast.date || addingPast}
              style={{ ...solidBtn('#7a6a5f'), flexShrink: 0, alignSelf: 'flex-start' }}>
              {addingPast ? '…' : '+ Add'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function ChartField({ label, value, flex }) {
  return (
    <div style={{ flex: flex || 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: '#b8a99e', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: value ? '#3e2f25' : '#c8bdb7' }}>{value || '—'}</div>
    </div>
  );
}

function MHViewQ({ num, text, yesno, explain, value }) {
  const hasContent = yesno || value;
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #f0e8de' }}>
      <span style={{ minWidth: 22, fontSize: 12, color: '#b8a99e', paddingTop: 1 }}>{num}.</span>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 12, color: '#7a6a5f' }}>{text}</span>
        {yesno && (
          <span style={{
            marginLeft: 8, fontSize: 11, fontWeight: '700',
            color: yesno === 'yes' ? '#c97b7b' : '#6b8f71',
          }}>
            {yesno.toUpperCase()}
          </span>
        )}
        {(explain || value) && (
          <div style={{ fontSize: 12, color: '#3e2f25', marginTop: 2, fontStyle: explain ? 'italic' : 'normal' }}>
            {explain || value}
          </div>
        )}
        {!hasContent && !value && !yesno && (
          <span style={{ fontSize: 12, color: '#c8bdb7', marginLeft: 8 }}>—</span>
        )}
      </div>
    </div>
  );
}

function MHEditQ({ num, text, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ minWidth: 22, fontWeight: '500', color: '#3e2f25', fontSize: 13 }}>{num}.</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 13, color: '#3e2f25' }}>{text}</span>
          {children}
        </div>
      </div>
    </div>
  );
}

function YesNoEdit({ value, onChange, name }) {
  return (
    <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
      {['yes', 'no'].map(opt => (
        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13 }}>
          <input type="radio" name={name} checked={value === opt} onChange={() => onChange(opt)} />
          {opt.charAt(0).toUpperCase() + opt.slice(1)}
        </label>
      ))}
    </div>
  );
}

function ExplainEdit({ label, value, onChange, inp }) {
  return (
    <div style={{ marginTop: 6 }}>
      <span style={{ fontSize: 12, color: '#7a6a5f' }}>{label}</span>
      <input style={{ ...inp, marginTop: 3 }} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function ApptRow({ appt, i, editMode, treatmentDrafts, setTreatmentDrafts, therapistDrafts, setTherapistDrafts, navigate, muted }) {
  const inputStyle = { padding: '4px 8px', border: '1px solid #e8dfd6', borderRadius: 8, boxSizing: 'border-box', fontSize: 13 };
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '11px 14px',
        borderTop: i > 0 ? '1px solid #e8dfd6' : 'none',
        background: '#fdfaf6',
        cursor: editMode ? 'default' : 'pointer',
        opacity: muted ? 0.65 : 1,
      }}
      onClick={() => { if (!editMode) navigate(`/appointments/${appt.id}`); }}
      onMouseEnter={e => { if (!editMode) e.currentTarget.style.background = '#f0e8de'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#fdfaf6'; }}
    >
      <div style={{ minWidth: 150, fontSize: 13, fontWeight: '600', color: muted ? '#b8a99e' : '#3e2f25', paddingTop: editMode ? 5 : 0 }}>
        {formatDateShort(appt.date)}
      </div>
      <div style={{ flex: 1 }} onClick={e => editMode && e.stopPropagation()}>
        {editMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input value={therapistDrafts[appt.id] ?? appt.therapist ?? ''}
              onChange={e => setTherapistDrafts(d => ({ ...d, [appt.id]: e.target.value }))}
              placeholder="Therapist" style={{ ...inputStyle, width: '100%' }} />
            <TreatmentListInput value={treatmentDrafts[appt.id] ?? appt.treatments ?? ''}
              onChange={v => setTreatmentDrafts(d => ({ ...d, [appt.id]: v }))}
              inputStyle={inputStyle} placeholder="Treatments" />
          </div>
        ) : (
          <div>
            {appt.therapist && <div style={{ fontSize: 12, color: muted ? '#c8bdb7' : '#b8a99e', marginBottom: 2 }}>{appt.therapist}</div>}
            <span style={{ fontSize: 13, color: muted ? '#b8a99e' : '#7a6a5f' }}>
              {appt.treatments
                ? appt.treatments.split('\n').filter(Boolean).join(', ')
                : <span style={{ color: '#c8bdb7' }}>No treatments recorded</span>}
            </span>
          </div>
        )}
      </div>
      {!editMode && appt.notes && (
        <div style={{ fontSize: 12, color: '#c8bdb7', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {appt.notes}
        </div>
      )}
    </div>
  );
}

const lblStyle = { fontSize: 12, color: '#7a6a5f', display: 'block', marginBottom: 3 };

function DeleteConfirmModal({ clientName, confirmPassword, setConfirmPassword, passwordError, deleting, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fdfaf6', borderRadius: 12, boxShadow: '0 4px 20px rgba(62,47,37,0.10)',
        padding: '28px 32px', maxWidth: 420, width: '90%',
      }}>
        <div style={{ fontSize: 18, fontWeight: '700', color: '#c97b7b', marginBottom: 12 }}>
          ⚠️ Delete Client
        </div>
        <p style={{ margin: '0 0 8px', fontSize: 14, color: '#3e2f25', lineHeight: 1.5 }}>
          You are about to permanently delete <strong>{clientName}</strong> and all their appointment records.
        </p>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: '#7a6a5f' }}>
          This cannot be undone.
        </p>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#7a6a5f' }}>
          Enter clinic password to confirm:
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !deleting && onConfirm()}
          placeholder="Password"
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '8px 10px', border: '1px solid #e8dfd6', borderRadius: 8,
            fontSize: 14, marginBottom: 6,
          }}
        />
        {passwordError && (
          <div style={{ fontSize: 12, color: '#c97b7b', marginBottom: 10 }}>
            ⛔ {passwordError}
          </div>
        )}
        {!passwordError && <div style={{ marginBottom: 10 }} />}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button onClick={onCancel} style={outlineBtn('#7a6a5f')}>Cancel</button>
          <button
            onClick={onConfirm}
            disabled={deleting || !confirmPassword}
            style={{
              ...solidBtn('#c97b7b'),
              opacity: deleting || !confirmPassword ? 0.6 : 1,
              cursor: deleting || !confirmPassword ? 'not-allowed' : 'pointer',
            }}
          >
            {deleting ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}
