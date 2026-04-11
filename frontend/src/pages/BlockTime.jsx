import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { blockedSlotService } from '../services/blockedSlotService';

export default function BlockTime() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ date: '', start_time: '', end_time: '', reason: '' });
  const [error, setError] = useState('');

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.start_time >= form.end_time) {
      setError('End time must be after start time');
      return;
    }

    try {
      await blockedSlotService.create(form);
      navigate('/calendar');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    }
  }

  const fieldStyle = { display: 'block', width: '100%', padding: '8px', marginTop: 4, boxSizing: 'border-box', border: '1px solid #e8dfd6', borderRadius: 8, fontSize: 14 };
  const labelStyle = { display: 'block', marginBottom: 12 };

  return (
    <div style={{ maxWidth: 400 }}>
      <button onClick={() => navigate('/calendar')} style={{ marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#7a6a5f', padding: 0, fontSize: 14 }}>← Back to Calendar</button>
      <h2>Block Time</h2>
      <p style={{ color: '#7a6a5f', marginTop: 0 }}>Mark a time range as unavailable (e.g. lunch break, staff meeting).</p>
      {error && <p style={{ color: '#c97b7b' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>
          Date *
          <input name="date" type="date" value={form.date} onChange={handleChange} required style={fieldStyle} />
        </label>
        <label style={labelStyle}>
          Start Time *
          <input name="start_time" type="time" value={form.start_time} onChange={handleChange} required style={fieldStyle} />
        </label>
        <label style={labelStyle}>
          End Time *
          <input name="end_time" type="time" value={form.end_time} onChange={handleChange} required style={fieldStyle} />
        </label>
        <label style={labelStyle}>
          Reason
          <input name="reason" type="text" value={form.reason} onChange={handleChange}
            placeholder="e.g. Lunch break" style={fieldStyle} />
        </label>
        <button type="submit" style={{ padding: '9px 22px', background: 'var(--primary)', color: '#3e2f25', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Block Time</button>
      </form>
    </div>
  );
}
