import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TreatmentTherapistInput from '../components/TreatmentTherapistInput';
import { appointmentService } from '../services/appointmentService';
import { useClients } from '../hooks/useClients';
import { useServices } from '../hooks/useServices';
import { useConflictCheck } from '../hooks/useConflictCheck';

const DURATIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360];

export default function AddAppointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { data: clients = [] } = useClients();
  const { data: services = [] } = useServices();

  const preselectedId = searchParams.get('client_id') || '';
  const [form, setForm] = useState({
    client_id: preselectedId,
    date: searchParams.get('date') || '',
    start_time: searchParams.get('time') || '',
    duration_minutes: '60',
    notes: '',
    status: 'confirmed',
    appointment_type: 'regular',
  });
  const [treatmentItems, setTreatmentItems] = useState([{ name: '', therapist: '' }]);
  const [error, setError] = useState('');

  // Client search state
  const [clientSearch, setClientSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Once clients load, resolve the preselected name
  useEffect(() => {
    if (preselectedId && clients.length > 0 && !clientSearch) {
      const match = clients.find(c => String(c.id) === preselectedId);
      if (match) setClientSearch(`${match.first_name} ${match.last_name}`);
    }
  }, [clients, preselectedId]);

  const filteredClients = clientSearch.trim()
    ? clients.filter(c =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(clientSearch.toLowerCase())
      )
    : clients;

  function selectClient(client) {
    setForm(f => ({ ...f, client_id: String(client.id) }));
    setClientSearch(`${client.first_name} ${client.last_name}`);
    setShowDropdown(false);
  }

  function handleClientSearchChange(e) {
    setClientSearch(e.target.value);
    setForm(f => ({ ...f, client_id: '' }));
    setShowDropdown(true);
  }

  const conflicts = useConflictCheck(form.date, form.start_time, form.duration_minutes);

  function applyService(id) {
    const svc = services.find(s => String(s.id) === id);
    if (!svc) return;
    setForm(f => ({ ...f, duration_minutes: String(svc.duration_minutes) }));
    setTreatmentItems([{ name: svc.name, therapist: '' }]);
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

    const isTentative = form.status === 'tentative';
    const isWalkIn = form.appointment_type === 'walk_in';
    if (conflicts && conflicts.blocked) {
      setError('This time overlaps a blocked period. Please choose a different time.');
      return;
    }
    if (!isTentative && !isWalkIn && conflicts && conflicts.count >= 3) {
      setError('All 3 slots are occupied at this time. Please choose a different time.');
      return;
    }

    try {
      await appointmentService.create({
        ...form,
        client_id: parseInt(form.client_id),
        duration_minutes: parseInt(form.duration_minutes),
        treatment_items: treatmentItems.filter(t => t.name.trim()),
      });
      navigate('/calendar');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    }
  }

  const fieldStyle = { display: 'block', width: '100%', padding: '8px', marginTop: 4, boxSizing: 'border-box', border: '1px solid #e8dfd6', borderRadius: 8, fontSize: 14 };
  const labelStyle = { display: 'block', marginBottom: 12 };

  return (
    <div style={{ maxWidth: 500 }}>
      <button onClick={() => navigate('/calendar')} style={{ marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#7a6a5f', padding: 0, fontSize: 14 }}>← Back to Calendar</button>
      <h2>Add Appointment</h2>
      {error && <p style={{ color: '#c97b7b', background: '#faeaea', padding: '8px', borderRadius: 8 }}>{error}</p>}
      {conflicts && conflicts.blocked && (
        <p style={{ color: '#c97b7b', background: '#faeaea', padding: '8px', borderRadius: 8, fontSize: 13 }}>
          This time overlaps a blocked period. Please choose a different time.
        </p>
      )}
      {conflicts && !conflicts.blocked && conflicts.count > 0 && conflicts.count < 3 && form.appointment_type !== 'walk_in' && (
        <p style={{ color: '#7a5c2e', background: '#fdf3e3', padding: '8px', borderRadius: 8, fontSize: 13 }}>
          {conflicts.count} of 3 slots occupied at this time. You can still book.
        </p>
      )}
      {conflicts && !conflicts.blocked && conflicts.count >= 3 && form.appointment_type !== 'walk_in' && (
        <p style={{ color: '#c97b7b', background: '#faeaea', padding: '8px', borderRadius: 8, fontSize: 13 }}>
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
          <div ref={dropdownRef} style={{ position: 'relative', marginTop: 4 }}>
            <input
              type="text"
              value={clientSearch}
              onChange={handleClientSearchChange}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              placeholder="Search by name…"
              required={!form.client_id}
              style={{ ...fieldStyle, marginTop: 0 }}
            />
            {/* hidden input so browser required validation fires on client_id */}
            <input type="hidden" name="client_id" value={form.client_id} required />
            {showDropdown && filteredClients.length > 0 && (
              <ul style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                background: '#fff', border: '1px solid #e8dfd6', borderRadius: 8,
                margin: '2px 0 0', padding: 0, listStyle: 'none',
                maxHeight: 220, overflowY: 'auto',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              }}>
                {filteredClients.map(c => (
                  <li
                    key={c.id}
                    onMouseDown={() => selectClient(c)}
                    style={{
                      padding: '9px 12px', cursor: 'pointer', fontSize: 14,
                      borderBottom: '1px solid #f3ede8',
                      background: String(c.id) === form.client_id ? 'var(--sidebar-active-bg)' : 'transparent',
                      fontWeight: String(c.id) === form.client_id ? 600 : 400,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fdf6f0'}
                    onMouseLeave={e => e.currentTarget.style.background =
                      String(c.id) === form.client_id ? 'var(--sidebar-active-bg)' : 'transparent'}
                  >
                    {c.first_name} {c.last_name}
                    {c.is_vip ? ' ★' : ''}
                  </li>
                ))}
              </ul>
            )}
            {showDropdown && clientSearch.trim() && filteredClients.length === 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                background: '#fff', border: '1px solid #e8dfd6', borderRadius: 8,
                margin: '2px 0 0', padding: '10px 12px', fontSize: 13, color: '#999',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              }}>
                No clients match "{clientSearch}"
              </div>
            )}
          </div>
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
              <option key={d} value={d}>{d} min {d >= 60 ? `(${Math.floor(d / 60)}h${d % 60 ? ` ${d % 60}m` : ''})` : ''}</option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Treatments
          <div style={{ marginTop: 6 }}>
            <TreatmentTherapistInput
              value={treatmentItems}
              onChange={setTreatmentItems}
              inputStyle={{ padding: '8px', border: '1px solid #e8dfd6', borderRadius: 8, boxSizing: 'border-box', fontSize: 14 }}
            />
          </div>
        </label>
        <label style={labelStyle}>
          Notes
          <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} style={fieldStyle} />
        </label>
        <label style={labelStyle}>
          Type
          <select name="appointment_type" value={form.appointment_type} onChange={handleChange} style={fieldStyle}>
            <option value="regular">Regular</option>
            <option value="walk_in">Walk-in (bypasses slot limit)</option>
          </select>
        </label>
        <label style={labelStyle}>
          Status
          <select name="status" value={form.status} onChange={handleChange} style={fieldStyle}>
            <option value="confirmed">Confirmed</option>
            <option value="tentative">Tentative (no emails, doesn't block slots)</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={conflicts && (conflicts.blocked || (form.status !== 'tentative' && form.appointment_type !== 'walk_in' && conflicts.count >= 3))}
          style={{ padding: '9px 22px', background: 'var(--primary)', color: '#3e2f25', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
        >
          Save Appointment
        </button>
      </form>
    </div>
  );
}
