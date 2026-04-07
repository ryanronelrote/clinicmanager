import { useEffect, useState } from 'react';
import { settingsService } from '../services/settingsService';
import { serviceService } from '../services/serviceService';
import { useClinicSettings } from '../context/SettingsContext';

const inp = { padding: '7px 10px', border: '1px solid var(--input-border)', borderRadius: 4, width: '100%', boxSizing: 'border-box', fontSize: 14 };
const lbl = { fontSize: 12, color: 'var(--label-color)', display: 'block', marginBottom: 3 };

export default function Settings() {
  const [tab, setTab] = useState('clinic');

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ marginTop: 0, marginBottom: 20 }}>Settings</h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid #eee', paddingBottom: 0 }}>
        {[['clinic', 'Clinic'], ['services', 'Services'], ['notifications', 'Notifications'], ['email', 'Email'], ['templates', 'Templates'], ['appearance', 'Appearance']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 18px', fontSize: 14, cursor: 'pointer', border: 'none',
            borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent',
            background: 'none', color: tab === key ? 'var(--primary)' : '#555',
            fontWeight: tab === key ? '600' : 'normal', marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'clinic'        && <ClinicTab />}
      {tab === 'services'      && <ServicesTab />}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'email'         && <EmailTab />}
      {tab === 'templates'     && <TemplatesTab />}
      {tab === 'appearance'    && <AppearanceTab />}
    </div>
  );
}

// ── Clinic Tab ────────────────────────────────────────────────

function ClinicTab() {
  const [form, setForm] = useState({ clinic_name: '', address: '', contact_number: '', email: '', business_hours: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    settingsService.getAll().then(data => {
      setForm(f => ({
        clinic_name:     data.clinic_name     || '',
        address:         data.address         || '',
        contact_number:  data.contact_number  || '',
        email:           data.email           || '',
        business_hours:  data.business_hours  || '',
      }));
    }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      await settingsService.save(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Save failed:', err);
    }
    setSaving(false);
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
        <button onClick={save} disabled={saving} style={{ padding: '8px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: '600', cursor: 'pointer' }}>
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
    serviceService.getAll().then(setServices).catch(() => {});
  }, []);

  async function add() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setAdding(true); setError('');
    try {
      const data = await serviceService.create(form);
      setServices(s => [...s, data]);
      setForm({ name: '', duration_minutes: '60', price: '', category: '' });
    } catch (err) {
      setError(err.message || 'Error');
    }
    setAdding(false);
  }

  async function remove(id) {
    try {
      await serviceService.delete(id);
      setServices(s => s.filter(x => x.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
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
        <button onClick={add} disabled={adding} style={{ padding: '7px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: '600', cursor: 'pointer' }}>
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
    settingsService.getEmailConfig().then(data => {
      setForm({
        apiKey:   data.apiKey   || '',
        from:     data.from     || '',
        fromName: data.fromName || '',
        enabled:  data.enabled  !== false,
      });
    }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      await settingsService.saveEmailConfig(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Save failed:', err);
    }
    setSaving(false);
  }

  async function sendTest() {
    if (!testTo.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      await settingsService.sendTestEmail(testTo);
      setTestResult('ok');
    } catch (err) {
      setTestResult(err.message || 'Unknown error');
    }
    setTesting(false);
  }

  const toggleStyle = (on) => ({
    position: 'absolute', inset: 0, cursor: 'pointer', borderRadius: 24,
    background: on ? 'var(--primary)' : '#ccc', transition: 'background 0.2s',
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
        <div style={{ fontWeight: '600', fontSize: 14, marginBottom: 2 }}>Brevo Configuration</div>
        <label>
          <span style={lbl}>API Key</span>
          <input type="password" style={inp} value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} placeholder={form.apiKey ? 'Leave blank to keep existing' : 'xkeysib-xxxxxxxxxxxx'} />
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
          Need an API key? Sign up free at <strong>brevo.com</strong>. Verify your sender email under Senders &amp; IP → Senders.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={save} disabled={saving} style={{ padding: '8px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: '600', cursor: 'pointer' }}>
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
  { key: 'enable_confirmation_email', label: 'Booking Email',         desc: 'Send booking email when appointment is created' },
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
    settingsService.getAll().then(data => {
      setToggles(t => {
        const next = { ...t };
        for (const k of NOTIF_KEYS.map(n => n.key)) {
          if (k in data) next[k] = data[k] !== 'false';
        }
        return next;
      });
    }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      const payload = {};
      for (const k of NOTIF_KEYS.map(n => n.key)) payload[k] = String(toggles[k]);
      await settingsService.save(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Save failed:', err);
    }
    setSaving(false);
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
                background: toggles[key] ? 'var(--primary)' : '#ccc',
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
        <button onClick={save} disabled={saving} style={{ padding: '8px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: '600', cursor: 'pointer' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span style={{ fontSize: 13, color: '#0f9d58' }}>Saved!</span>}
      </div>
    </div>
  );
}

// ── Templates Tab ─────────────────────────────────────────────

const TEMPLATE_META = [
  { name: 'booking',           label: 'Booking Email',            vars: ['clientName', 'date', 'time', 'treatments'] },
  { name: 'reminder_24h',      label: '24h Reminder',             vars: ['clientName', 'date', 'time', 'treatments', 'confirmButton', 'cancelButton'] },
  { name: 'reminder_same_day', label: 'Same-day Reminder',        vars: ['clientName', 'time', 'confirmButton', 'cancelButton'] },
  { name: 'confirmed_receipt', label: 'Confirmation Receipt',     vars: ['clientName', 'date', 'time', 'treatments'] },
  { name: 'rescheduled',       label: 'Rescheduled',              vars: ['clientName', 'date', 'time', 'newDate', 'newTime', 'treatments'] },
  { name: 'follow_up',         label: 'Follow-up',                vars: ['clientName'] },
  { name: 'clinic_confirmed',  label: 'Clinic: Client Confirmed', vars: ['clientName', 'date', 'time'] },
  { name: 'clinic_cancelled',  label: 'Clinic: Client Cancelled', vars: ['clientName', 'date', 'time'] },
];

function TemplatesTab() {
  const [templates, setTemplates] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    settingsService.getEmailTemplates().then(setTemplates).catch(() => {});
  }, []);

  function update(name, field, value) {
    setTemplates(t => ({ ...t, [name]: { ...t[name], [field]: value } }));
  }

  function reset(name) {
    setTemplates(t => ({ ...t, [name]: { subject: '', body: '' } }));
  }

  async function save() {
    setSaving(true);
    try {
      await settingsService.saveEmailTemplates(templates);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Save failed:', err);
    }
    setSaving(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
        Customize email subjects and bodies. Leave blank to use the built-in default. Use <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 3 }}>{'{{variable}}'}</code> placeholders shown below each template.
      </p>

      {TEMPLATE_META.map(({ name, label, vars }) => {
        const tpl = templates[name] || { subject: '', body: '' };
        return (
          <div key={name} style={{ border: '1px solid #eee', borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: '600', fontSize: 14 }}>{label}</div>
              <button
                onClick={() => reset(name)}
                style={{ fontSize: 12, color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
              >
                Reset to default
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label>
                <span style={lbl}>Subject</span>
                <input
                  style={inp}
                  value={tpl.subject}
                  onChange={e => update(name, 'subject', e.target.value)}
                  placeholder={tpl.defaultSubject || ''}
                />
              </label>
              <label>
                <span style={lbl}>Body (HTML)</span>
                <textarea
                  style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                  rows={6}
                  value={tpl.body}
                  onChange={e => update(name, 'body', e.target.value)}
                  placeholder={tpl.defaultBody || ''}
                />
              </label>
            </div>

            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {vars.map(v => (
                <span key={v} style={{ fontSize: 11, background: '#f0f4ff', color: '#3b4cc0', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={save} disabled={saving} style={{ padding: '8px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: '600', cursor: 'pointer' }}>
          {saving ? 'Saving…' : 'Save All'}
        </button>
        {saved && <span style={{ fontSize: 13, color: '#0f9d58' }}>Saved!</span>}
      </div>
    </div>
  );
}

// ── Appearance Tab ────────────────────────────────────────────

const THEMES = [
  {
    key: 'default',
    label: 'Default',
    desc: 'Clean blue and grey',
    preview: { sidebar: '#f5f5f5', primary: '#1a73e8', page: '#ffffff' },
  },
  {
    key: 'warm',
    label: 'Warm',
    desc: 'Cream and warm brown — clinic brand',
    preview: { sidebar: '#2C1A14', primary: '#8B5E52', page: '#FAF8F5' },
  },
];

function AppearanceTab() {
  const { settings, updateSettings } = useClinicSettings();
  const [current, setCurrent] = useState(settings?.app_theme || 'default');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings?.app_theme) {
      setCurrent(settings.app_theme);
    }
  }, [settings]);

  async function applyAndSave() {
    setSaving(true);
    try {
      await updateSettings({ app_theme: current });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Theme save failed:', err);
    }
    setSaving(false);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {THEMES.map(t => (
          <div
            key={t.key}
            onClick={() => setCurrent(t.key)}
            style={{
              flex: '1 1 180px', border: `2px solid ${current === t.key ? 'var(--primary)' : '#eee'}`,
              borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
              boxShadow: current === t.key ? '0 0 0 3px var(--primary-light)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ display: 'flex', height: 80 }}>
              <div style={{ width: 40, background: t.preview.sidebar }} />
              <div style={{ flex: 1, background: t.preview.page, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ height: 8, width: '60%', background: t.preview.primary, borderRadius: 4, opacity: 0.8 }} />
                <div style={{ height: 6, width: '80%', background: '#ddd', borderRadius: 4 }} />
                <div style={{ height: 6, width: '50%', background: '#ddd', borderRadius: 4 }} />
                <div style={{ marginTop: 4, height: 14, width: 40, background: t.preview.primary, borderRadius: 4 }} />
              </div>
            </div>
            <div style={{ padding: '10px 14px', borderTop: '1px solid #f0f0f0' }}>
              <div style={{ fontWeight: '600', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                {t.label}
                {current === t.key && <span style={{ fontSize: 11, color: 'var(--primary)' }}>✓ Selected</span>}
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{t.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={applyAndSave} disabled={saving} style={{ padding: '8px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: '600', cursor: 'pointer' }}>
          {saving ? 'Applying…' : 'Apply Theme'}
        </button>
        {saved && <span style={{ fontSize: 13, color: '#0f9d58' }}>Theme applied!</span>}
      </div>
    </div>
  );
}
