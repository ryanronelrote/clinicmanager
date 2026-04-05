import { useEffect, useState } from 'react';

const inp = { padding: '7px 10px', border: '1px solid #ccc', borderRadius: 4, width: '100%', boxSizing: 'border-box', fontSize: 14 };
const lbl = { fontSize: 12, color: '#666', display: 'block', marginBottom: 3 };

export default function Settings() {
  const [tab, setTab] = useState('clinic');

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ marginTop: 0, marginBottom: 20 }}>Settings</h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid #eee', paddingBottom: 0 }}>
        {[['clinic', 'Clinic'], ['services', 'Services'], ['notifications', 'Notifications'], ['email', 'Email']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 18px', fontSize: 14, cursor: 'pointer', border: 'none',
            borderBottom: tab === key ? '2px solid #1a73e8' : '2px solid transparent',
            background: 'none', color: tab === key ? '#1a73e8' : '#555',
            fontWeight: tab === key ? '600' : 'normal', marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'clinic'        && <ClinicTab />}
      {tab === 'services'      && <ServicesTab />}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'email'         && <EmailTab />}
    </div>
  );
}

// ── Clinic Tab ────────────────────────────────────────────────

function ClinicTab() {
  const [form, setForm] = useState({ clinic_name: '', address: '', contact_number: '', email: '', business_hours: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/settings').then(r => r.json()).then(data => {
      setForm(f => ({
        clinic_name:     data.clinic_name     || '',
        address:         data.address         || '',
        contact_number:  data.contact_number  || '',
        email:           data.email           || '',
        business_hours:  data.business_hours  || '',
      }));
    });
  }, []);

  async function save() {
    setSaving(true);
    await fetch('/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <label><span style={lbl}>Clinic Name</span><input style={inp} value={form.clinic_name} onChange={e => setForm(f => ({ ...f, clinic_name: e.target.value }))} /></label>
      <label><span style={lbl}>Address</span><input style={inp} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></label>
      <div style={{ display: 'flex', gap: 12 }}>
        <label style={{ flex: 1 }}><span style={lbl}>Contact Number</span><input style={inp} value={form.contact_number} onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))} /></label>
        <label style={{ flex: 1 }}><span style={lbl}>Email</span><input style={inp} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></label>
      </div>
      <label>
        <span style={lbl}>Business Hours</span>
        <textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={form.business_hours} onChange={e => setForm(f => ({ ...f, business_hours: e.target.value }))} placeholder="e.g. Mon–Fri 9am–6pm, Sat 9am–4pm" />
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={save} disabled={saving} style={{ padding: '8px 20px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: '600', cursor: 'pointer' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span style={{ fontSize: 13, color: '#0f9d58' }}>Saved!</span>}
      </div>
    </div>
  );
}

// ── Services Tab ──────────────────────────────────────────────

const DURATIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180];

function ServicesTab() {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({ name: '', duration_minutes: '60', price: '', category: '' });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/services').then(r => r.json()).then(setServices);
  }, []);

  async function add() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setAdding(true); setError('');
    const res = await fetch('/services', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) { setError(data.error); return; }
    setServices(s => [...s, data]);
    setForm({ name: '', duration_minutes: '60', price: '', category: '' });
  }

  async function remove(id) {
    await fetch(`/services/${id}`, { method: 'DELETE' });
    setServices(s => s.filter(x => x.id !== id));
  }

  const categories = [...new Set(services.map(s => s.category).filter(Boolean))];

  return (
    <div>
      {/* Add form */}
      <div style={{ border: '1px solid #eee', borderRadius: 8, padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ fontWeight: '600', fontSize: 14, marginBottom: 12 }}>Add Service</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <label style={{ flex: 2, minWidth: 140 }}>
            <span style={lbl}>Service Name *</span>
            <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Facial, Massage" />
          </label>
          <label style={{ flex: 1, minWidth: 100 }}>
            <span style={lbl}>Duration</span>
            <select style={inp} value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}>
              {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
            </select>
          </label>
          <label style={{ flex: 1, minWidth: 100 }}>
            <span style={lbl}>Price (₱)</span>
            <input type="number" min="0" step="any" style={inp} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0" />
          </label>
          <label style={{ flex: 1, minWidth: 120 }}>
            <span style={lbl}>Category</span>
            <input style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Skin, Body" />
          </label>
        </div>
        {error && <p style={{ color: '#cc3333', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}
        <button onClick={add} disabled={adding} style={{ padding: '7px 18px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: '600', cursor: 'pointer' }}>
          {adding ? '…' : '+ Add Service'}
        </button>
      </div>

      {/* Services list */}
      {services.length === 0 ? (
        <p style={{ color: '#bbb', fontSize: 13 }}>No services yet.</p>
      ) : (
        <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px 40px', padding: '8px 16px', background: '#fafafa', borderBottom: '1px solid #eee', fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase' }}>
            <span>Service</span><span style={{ textAlign: 'right' }}>Duration</span><span style={{ textAlign: 'right' }}>Price</span><span>Category</span><span></span>
          </div>
          {services.map((s, i) => (
            <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px 40px', alignItems: 'center', padding: '10px 16px', borderTop: i > 0 ? '1px solid #f0f0f0' : 'none' }}>
              <span style={{ fontWeight: '600', fontSize: 14 }}>{s.name}</span>
              <span style={{ textAlign: 'right', fontSize: 13, color: '#555' }}>{s.duration_minutes} min</span>
              <span style={{ textAlign: 'right', fontSize: 13, color: '#555' }}>{s.price ? `₱${s.price}` : '—'}</span>
              <span style={{ fontSize: 13, color: '#aaa' }}>{s.category || '—'}</span>
              <button onClick={() => remove(s.id)} style={{ background: 'none', border: 'none', color: '#cc3333', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Email Tab ─────────────────────────────────────────────────

function EmailTab() {
  const [form, setForm] = useState({ apiKey: '', from: '', fromName: '', enabled: true });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    fetch('/settings/email').then(r => r.json()).then(data => {
      setForm({
        apiKey:   data.apiKey   || '',
        from:     data.from     || '',
        fromName: data.fromName || '',
        enabled:  data.enabled  !== false,
      });
    });
  }, []);

  async function save() {
    setSaving(true);
    await fetch('/settings/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function sendTest() {
    if (!testTo.trim()) return;
    setTesting(true);
    setTestResult(null);
    const res = await fetch('/settings/email/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: testTo }),
    });
    const data = await res.json();
    setTesting(false);
    setTestResult(res.ok ? 'ok' : data.error || 'Unknown error');
  }

  const toggleStyle = (on) => ({
    position: 'absolute', inset: 0, cursor: 'pointer', borderRadius: 24,
    background: on ? '#1a73e8' : '#ccc', transition: 'background 0.2s',
  });
  const knobStyle = (on) => ({
    position: 'absolute', height: 18, width: 18, left: on ? 23 : 3, bottom: 3,
    background: '#fff', borderRadius: '50%', transition: 'left 0.2s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Enable toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', border: '1px solid #eee', borderRadius: 8 }}>
        <div>
          <div style={{ fontWeight: '600', fontSize: 14 }}>Enable Email Sending</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Disable to stop all outgoing emails</div>
        </div>
        <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, flexShrink: 0 }}>
          <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} style={{ opacity: 0, width: 0, height: 0 }} />
          <span style={toggleStyle(form.enabled)}><span style={knobStyle(form.enabled)} /></span>
        </label>
      </div>

      {/* Resend config */}
      <div style={{ border: '1px solid #eee', borderRadius: 8, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontWeight: '600', fontSize: 14, marginBottom: 2 }}>Resend Configuration</div>
        <label>
          <span style={lbl}>API Key</span>
          <input type="password" style={inp} value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} placeholder={form.apiKey ? 'Leave blank to keep existing' : 're_xxxxxxxxxxxxxxxxxxxx'} />
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}>
            <span style={lbl}>From Address</span>
            <input style={inp} value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} placeholder="you@yourdomain.com" />
          </label>
          <label style={{ flex: 1 }}>
            <span style={lbl}>From Name</span>
            <input style={inp} value={form.fromName} onChange={e => setForm(f => ({ ...f, fromName: e.target.value }))} placeholder="e.g. Gentle Skin Aesthetics" />
          </label>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>
          Need an API key? Sign up free at <strong>resend.com</strong>. To send from your own domain, verify it in the Resend dashboard.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={save} disabled={saving} style={{ padding: '8px 20px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: '600', cursor: 'pointer' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span style={{ fontSize: 13, color: '#0f9d58' }}>Saved!</span>}
      </div>

      {/* Test email */}
      <div style={{ border: '1px solid #eee', borderRadius: 8, padding: '16px 20px' }}>
        <div style={{ fontWeight: '600', fontSize: 14, marginBottom: 10 }}>Send Test Email</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <label style={{ flex: 1 }}>
            <span style={lbl}>Recipient</span>
            <input style={inp} type="email" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="test@example.com" />
          </label>
          <button onClick={sendTest} disabled={testing || !testTo.trim()} style={{ padding: '7px 18px', background: '#555', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {testing ? 'Sending…' : 'Send Test'}
          </button>
        </div>
        {testResult === 'ok' && <p style={{ margin: '10px 0 0', fontSize: 13, color: '#0f9d58' }}>Test email sent successfully!</p>}
        {testResult && testResult !== 'ok' && <p style={{ margin: '10px 0 0', fontSize: 13, color: '#cc3333' }}>{testResult}</p>}
      </div>
    </div>
  );
}

// ── Notifications Tab ─────────────────────────────────────────

const NOTIF_KEYS = [
  { key: 'enable_confirmation_email', label: 'Confirmation Email',    desc: 'Send confirmation when appointment is booked' },
  { key: 'enable_24h_reminder',       label: '24-hour Reminder',      desc: 'Send reminder the day before the appointment' },
  { key: 'enable_same_day_reminder',  label: 'Same-day Reminder',     desc: 'Send reminder on the day of the appointment' },
  { key: 'enable_followup_email',     label: 'Follow-up Email',       desc: 'Send follow-up email after the appointment' },
];

function NotificationsTab() {
  const [toggles, setToggles] = useState({
    enable_confirmation_email: true,
    enable_24h_reminder: true,
    enable_same_day_reminder: true,
    enable_followup_email: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/settings').then(r => r.json()).then(data => {
      setToggles(t => {
        const next = { ...t };
        for (const k of NOTIF_KEYS.map(n => n.key)) {
          if (k in data) next[k] = data[k] !== 'false';
        }
        return next;
      });
    });
  }, []);

  async function save() {
    setSaving(true);
    const payload = {};
    for (const k of NOTIF_KEYS.map(n => n.key)) payload[k] = String(toggles[k]);
    await fetch('/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid #eee', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
        {NOTIF_KEYS.map(({ key, label, desc }, i) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: i > 0 ? '1px solid #f0f0f0' : 'none' }}>
            <div>
              <div style={{ fontWeight: '600', fontSize: 14 }}>{label}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{desc}</div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, flexShrink: 0 }}>
              <input type="checkbox" checked={toggles[key]} onChange={e => setToggles(t => ({ ...t, [key]: e.target.checked }))} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{
                position: 'absolute', inset: 0, cursor: 'pointer', borderRadius: 24,
                background: toggles[key] ? '#1a73e8' : '#ccc',
                transition: 'background 0.2s',
              }}>
                <span style={{
                  position: 'absolute', height: 18, width: 18, left: toggles[key] ? 23 : 3, bottom: 3,
                  background: '#fff', borderRadius: '50%', transition: 'left 0.2s',
                }} />
              </span>
            </label>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={save} disabled={saving} style={{ padding: '8px 20px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: '600', cursor: 'pointer' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span style={{ fontSize: 13, color: '#0f9d58' }}>Saved!</span>}
      </div>
    </div>
  );
}
