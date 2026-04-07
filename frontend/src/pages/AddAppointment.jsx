import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TreatmentListInput from '../components/TreatmentListInput';
import { appointmentService } from '../services/appointmentService';
import { useClients } from '../hooks/useClients';
import { useServices } from '../hooks/useServices';
import { useConflictCheck } from '../hooks/useConflictCheck';

const DURATIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180];

export default function AddAppointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { data: clients = [] } = useClients();
  const { data: services = [] } = useServices();
  const [form, setForm] = useState({
    client_id: searchParams.get('client_id') || '',
    date: searchParams.get('date') || '',
    start_time: searchParams.get('time') || '',
    duration_minutes: '60',
    therapist: '',
    treatments: '',
    notes: '',
  });
  const [error, setError] = useState('');

  const conflicts = useConflictCheck(form.date, form.start_time, form.duration_minutes);

  function applyService(id) {
    const svc = services.find(s => String(s.id) === id);
    if (!svc) return;
    setForm(f => ({
      ...f,
      duration_minutes: String(svc.duration_minutes),
      treatments: svc.name,
    }));
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const today = new Date().toISOString().slice(0, 10);
    if (form.date < today) {
      setError('Cannot book appointments on past dates');
      return;
    }

    if (conflicts && conflicts.count >= 3) {
      setError('All 3 slots are occupied at this time. Please choose a different time.');
      return;
    }

    try {
      await appointmentService.create({
        ...form,
        client_id: parseInt(form.client_id),
        duration_minutes: parseInt(form.duration_minutes),
      });
      navigate('/calendar');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    }
  }

  const fieldStyle = { display: 'block', width: '100%', padding: '8px', marginTop: 4, boxSizing: 'border-box' };
  const labelStyle = { display: 'block', marginBottom: 12 };

  return (
    <div style={{ maxWidth: 500 }}>
      <button onClick={() => navigate('/calendar')} style={{ marginBottom: 16 }}>← Back to Calendar</button>
      <h2>Add Appointment</h2>
      {error && <p style={{ color: 'red', background: '#fff0f0', padding: '8px', borderRadius: 4 }}>{error}</p>}
      {conflicts && conflicts.count > 0 && conflicts.count < 3 && (
        <p style={{ color: '#b45309', background: '#fef3c7', padding: '8px', borderRadius: 4, fontSize: 13 }}>
          {conflicts.count} of 3 slots occupied at this time. You can still book.
        </p>
      )}
      {conflicts && conflicts.count >= 3 && (
        <p style={{ color: '#cc3333', background: '#fdecea', padding: '8px', borderRadius: 4, fontSize: 13 }}>
          All 3 slots are occupied at this time. Please choose a different time.
        </p>
      )}
      <form onSubmit={handleSubmit}>
        {services.length > 0 && (
          <label style={labelStyle}>
            Service (optional)
            <select onChange={e => applyService(e.target.value)} defaultValue="" style={fieldStyle}>
              <option value="">— Pick a service to pre-fill —</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration_minutes} min{s.price ? ` · ₱${s.price}` : ''})
                </option>
              ))}
            </select>
          </label>
        )}
        <label style={labelStyle}>
          Client *
          <select name="client_id" value={form.client_id} onChange={handleChange} required style={fieldStyle}>
            <option value="">— Select client —</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Date *
          <input name="date" type="date" value={form.date} onChange={handleChange} required
            min={new Date().toISOString().slice(0, 10)} style={fieldStyle} />
        </label>
        <label style={labelStyle}>
          Start Time *
          <input name="start_time" type="time" value={form.start_time} onChange={handleChange} required style={fieldStyle} />
        </label>
        <label style={labelStyle}>
          Duration *
          <select name="duration_minutes" value={form.duration_minutes} onChange={handleChange} required style={fieldStyle}>
            {DURATIONS.map(d => (
              <option key={d} value={d}>{d} min ({d >= 60 ? `${d / 60}h` : ''})</option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Therapist
          <input name="therapist" type="text" value={form.therapist} onChange={handleChange}
            placeholder="e.g. Sarah" style={fieldStyle} />
        </label>
        <label style={labelStyle}>
          Treatments
          <TreatmentListInput
            value={form.treatments}
            onChange={v => setForm(f => ({ ...f, treatments: v }))}
            inputStyle={{ padding: '8px', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box', fontSize: 14, marginTop: 4 }}
          />
        </label>
        <label style={labelStyle}>
          Notes
          <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} style={fieldStyle} />
        </label>
        <button type="submit" disabled={conflicts && conflicts.count >= 3} style={{ padding: '8px 20px' }}>Save Appointment</button>
      </form>
    </div>
  );
}
