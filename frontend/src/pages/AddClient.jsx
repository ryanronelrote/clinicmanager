import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientService } from '../services/clientService';
import { EMPTY_MH } from '../utils/medicalHistory';

const initialForm = {
  first_name: '', last_name: '', phone: '', email: '',
  birthdate: '', sex: '', address: '', occupation: '', civil_status: '',
  notes: '',
  medical_history: { ...EMPTY_MH },
};

export default function AddClient() {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  function setField(name, value) {
    setForm(f => ({ ...f, [name]: value }));
  }
  function setMH(name, value) {
    setForm(f => ({ ...f, medical_history: { ...f.medical_history, [name]: value } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const client = await clientService.create(form);
      navigate(`/clients/${client.id}`);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    }
  }

  const mh = form.medical_history;
  const inp = { padding: '6px 8px', border: '1px solid var(--input-border)', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };
  const inpFull = { ...inp, width: '100%' };

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ textAlign: 'center', letterSpacing: 1, marginBottom: 20 }}>PATIENT CHART</h2>
      {error && <p style={{ color: '#c97b7b' }}>{error}</p>}
      <form onSubmit={handleSubmit}>

        {/* ── Personal Info ── */}
        <div style={{ border: '1px solid #e8dfd6', borderRadius: 8, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <label style={{ flex: 2 }}>
              <span style={lbl}>First Name *</span>
              <input required style={inpFull} value={form.first_name} onChange={e => setField('first_name', e.target.value)} />
            </label>
            <label style={{ flex: 2 }}>
              <span style={lbl}>Last Name *</span>
              <input required style={inpFull} value={form.last_name} onChange={e => setField('last_name', e.target.value)} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <label style={{ flex: 2 }}>
              <span style={lbl}>Birthdate</span>
              <input type="date" style={inpFull} value={form.birthdate} onChange={e => setField('birthdate', e.target.value)} />
            </label>
            <label style={{ flex: 1 }}>
              <span style={lbl}>Sex</span>
              <select style={inpFull} value={form.sex} onChange={e => setField('sex', e.target.value)}>
                <option value="">—</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </label>
            <label style={{ flex: 1 }}>
              <span style={lbl}>Civil Status</span>
              <select style={inpFull} value={form.civil_status} onChange={e => setField('civil_status', e.target.value)}>
                <option value="">—</option>
                <option>Single</option>
                <option>Married</option>
                <option>Widowed</option>
                <option>Separated</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <label style={{ flex: 1 }}>
              <span style={lbl}>Address</span>
              <input style={inpFull} value={form.address} onChange={e => setField('address', e.target.value)} />
            </label>
            <label style={{ flex: 1 }}>
              <span style={lbl}>Occupation</span>
              <input style={inpFull} value={form.occupation} onChange={e => setField('occupation', e.target.value)} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ flex: 1 }}>
              <span style={lbl}>Contact Number</span>
              <input style={inpFull} value={form.phone} onChange={e => setField('phone', e.target.value)} />
            </label>
            <label style={{ flex: 1 }}>
              <span style={lbl}>Email Address</span>
              <input type="email" style={inpFull} value={form.email} onChange={e => setField('email', e.target.value)} />
            </label>
          </div>
        </div>

        {/* ── Medical History ── */}
        <div style={{ border: '1px solid #e8dfd6', borderRadius: 8, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontWeight: '600', fontSize: 15, marginBottom: 14 }}>Medical History:</div>

          <MHQuestion num={1} text="Are you currently taking prescription, herbal or over the counter medication?">
            <YesNo value={mh.q1_medications} onChange={v => setMH('q1_medications', v)} />
            {mh.q1_medications === 'yes' && (
              <ExplainField label="If YES please explain:" value={mh.q1_explain} onChange={v => setMH('q1_explain', v)} inp={inpFull} />
            )}
          </MHQuestion>

          <MHQuestion num={2} text="List all past and current medical conditions:">
            <input style={{ ...inpFull, marginTop: 4 }} value={mh.q2_conditions} onChange={e => setMH('q2_conditions', e.target.value)} placeholder="e.g. Hypertension, Diabetes…" />
          </MHQuestion>

          <MHQuestion num={3} text="Have you had any surgeries?">
            <YesNo value={mh.q3_surgeries} onChange={v => setMH('q3_surgeries', v)} />
            {mh.q3_surgeries === 'yes' && (
              <ExplainField label="If YES please list:" value={mh.q3_list} onChange={v => setMH('q3_list', v)} inp={inpFull} />
            )}
          </MHQuestion>

          <MHQuestion num={4} text="Do you have any metal in your body including active implants such as a pacemaker, cardiac defibrillator, cochlear implant or non-active implant such as screws, stents, hip replacement, knee replacement?">
            <YesNo value={mh.q4_metal} onChange={v => setMH('q4_metal', v)} />
            {mh.q4_metal === 'yes' && (
              <ExplainField label="If YES please list and explain:" value={mh.q4_explain} onChange={v => setMH('q4_explain', v)} inp={inpFull} />
            )}
          </MHQuestion>

          <MHQuestion num={5} text="Are you currently pregnant or nursing?">
            <YesNo value={mh.q5_pregnant} onChange={v => setMH('q5_pregnant', v)} />
          </MHQuestion>

          <MHQuestion num={6} text="If you are a woman of childbearing potential are you using birth control?">
            <YesNo value={mh.q6_birth_control} onChange={v => setMH('q6_birth_control', v)} />
            {mh.q6_birth_control === 'yes' && (
              <ExplainField label="Please explain:" value={mh.q6_explain} onChange={v => setMH('q6_explain', v)} inp={inpFull} />
            )}
          </MHQuestion>

          <MHQuestion num={7} text="Do you have a history of any skin disease or sensitivity?">
            <YesNo value={mh.q7_skin_disease} onChange={v => setMH('q7_skin_disease', v)} />
            {mh.q7_skin_disease === 'yes' && (
              <ExplainField label="If YES please explain:" value={mh.q7_explain} onChange={v => setMH('q7_explain', v)} inp={inpFull} />
            )}
          </MHQuestion>

          <MHQuestion num={8} text="What is your daily intake of water (cups)?">
            <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
              {['0-2', '2-4', '4-6', '8-10'].map(opt => (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                  <input type="radio" name="water" value={opt} checked={mh.q8_water === opt} onChange={() => setMH('q8_water', opt)} />
                  {opt}
                </label>
              ))}
            </div>
          </MHQuestion>

          <MHQuestion num={9} text="Do you engage in any light physical activity such as walking? Check which best applies:">
            <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
              {['Never', 'Rarely', 'Sometimes', 'Always'].map(opt => (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                  <input type="radio" name="activity" value={opt} checked={mh.q9_activity === opt} onChange={() => setMH('q9_activity', opt)} />
                  {opt}
                </label>
              ))}
            </div>
          </MHQuestion>

          <MHQuestion num={10} text="Do any of discussed contraindications apply to you?">
            <YesNo value={mh.q10_contraindications} onChange={v => setMH('q10_contraindications', v)} />
            {mh.q10_contraindications === 'yes' && (
              <ExplainField label="If YES please explain:" value={mh.q10_explain} onChange={v => setMH('q10_explain', v)} inp={inpFull} />
            )}
          </MHQuestion>

          <MHQuestion num={11} text="Which area(s) are you interested in receiving treatments?">
            <input style={{ ...inpFull, marginTop: 4 }} value={mh.q11_areas} onChange={e => setMH('q11_areas', e.target.value)} placeholder="e.g. Face, Arms, Legs…" />
          </MHQuestion>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label>
            <span style={lbl}>Additional Notes</span>
            <textarea style={{ ...inpFull, resize: 'vertical' }} rows={3} value={form.notes} onChange={e => setField('notes', e.target.value)} />
          </label>
        </div>

        <button type="submit" style={{ padding: '9px 24px', background: 'var(--primary)', color: '#3e2f25', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontWeight: '600' }}>
          Save Patient
        </button>
      </form>
    </div>
  );
}

function MHQuestion({ num, text, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ minWidth: 22, fontWeight: '500', color: '#3e2f25' }}>{num}.</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 13, color: '#3e2f25' }}>{text}</span>
          {children}
        </div>
      </div>
    </div>
  );
}

function YesNo({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
      {['yes', 'no'].map(opt => (
        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
          <input type="radio" checked={value === opt} onChange={() => onChange(opt)} />
          {opt.charAt(0).toUpperCase() + opt.slice(1)}
        </label>
      ))}
    </div>
  );
}

function ExplainField({ label, value, onChange, inp }) {
  return (
    <div style={{ marginTop: 6 }}>
      <span style={{ fontSize: 12, color: '#7a6a5f' }}>{label}</span>
      <input style={{ ...inp, marginTop: 3 }} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

const lbl = { fontSize: 12, color: '#7a6a5f', display: 'block', marginBottom: 3 };
