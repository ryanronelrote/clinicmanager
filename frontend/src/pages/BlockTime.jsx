import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

    const res = await fetch('/blocked-slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Something went wrong');
      return;
    }

    navigate('/calendar');
  }

  const fieldStyle = { display: 'block', width: '100%', padding: '8px', marginTop: 4, boxSizing: 'border-box' };
  const labelStyle = { display: 'block', marginBottom: 12 };

  return (
    <div style={{ maxWidth: 400 }}>
      <button onClick={() => navigate('/calendar')} style={{ marginBottom: 16 }}>← Back to Calendar</button>
      <h2>Block Time</h2>
      <p style={{ color: '#666', marginTop: 0 }}>Mark a time range as unavailable (e.g. lunch break, staff meeting).</p>
      {error && <p style={{ color: 'red' }}>{error}</p>}
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
        <button type="submit" style={{ padding: '8px 20px' }}>Block Time</button>
      </form>
    </div>
  );
}
