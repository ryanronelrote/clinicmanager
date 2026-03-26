import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const initialForm = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  notes: '',
};

export default function AddClient() {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const res = await fetch('/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Something went wrong');
      return;
    }

    const client = await res.json();
    navigate(`/clients/${client.id}`);
  }

  const fieldStyle = { display: 'block', width: '100%', padding: '8px', marginTop: 4, boxSizing: 'border-box' };
  const labelStyle = { display: 'block', marginBottom: 12 };

  return (
    <div style={{ maxWidth: 500 }}>
      <h2>Add New Client</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>
          First Name *
          <input name="first_name" value={form.first_name} onChange={handleChange} required style={fieldStyle} />
        </label>
        <label style={labelStyle}>
          Last Name *
          <input name="last_name" value={form.last_name} onChange={handleChange} required style={fieldStyle} />
        </label>
        <label style={labelStyle}>
          Phone
          <input name="phone" value={form.phone} onChange={handleChange} style={fieldStyle} />
        </label>
        <label style={labelStyle}>
          Email
          <input name="email" type="email" value={form.email} onChange={handleChange} style={fieldStyle} />
        </label>
        <label style={labelStyle}>
          Notes
          <textarea name="notes" value={form.notes} onChange={handleChange} rows={4} style={fieldStyle} />
        </label>
        <button type="submit" style={{ padding: '8px 20px' }}>Save Client</button>
      </form>
    </div>
  );
}
