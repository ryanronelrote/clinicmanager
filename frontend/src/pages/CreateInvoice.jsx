import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { invoiceService } from '../services/invoiceService';
import { clientService } from '../services/clientService';
import { staffService } from '../services/staffService';
import { authFetch } from '../authFetch';
import { solidBtn, outlineBtn } from '../utils/styleUtils';

function manilaTodayYmd() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

export default function CreateInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetClientId = searchParams.get('patient_id') || '';
  const presetAppointmentId = searchParams.get('appointment_id') || '';
  const presetTreatments = searchParams.get('treatments') || '';

  const { data: clients = [] } = useAsync(() => clientService.getAll(), []);
  const { data: staffList = [] } = useAsync(() => staffService.getAll(), []);
  const { data: services = [] } = useAsync(async () => {
    const res = await authFetch('/services');
    if (!res.ok) return [];
    return res.json();
  }, []);

  const [patientId, setPatientId] = useState(presetClientId);
  const [appointmentId] = useState(presetAppointmentId);
  const [items, setItems] = useState(() => {
    if (presetTreatments) {
      return presetTreatments.split('\n').filter(Boolean).map(name => ({
        name, quantity: '1', unit_price: '',
      }));
    }
    return [{ name: '', quantity: '1', unit_price: '' }];
  });
  const [createdBy, setCreatedBy] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(manilaTodayYmd);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function addItem() {
    setItems(prev => [...prev, { name: '', quantity: '1', unit_price: '' }]);
  }

  function removeItem(index) {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  function updateItem(index, field, value) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  function applyService(index, serviceId) {
    const svc = services.find(s => String(s.id) === serviceId);
    if (!svc) return;
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, name: svc.name, unit_price: svc.price ? String(svc.price) : '' } : item
    ));
  }

  // Calculate totals
  const lineItems = items.map(item => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    return { ...item, total: Math.round(qty * price * 100) / 100 };
  });
  const grandTotal = lineItems.reduce((sum, li) => sum + li.total, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!patientId) {
      setError('Please select a patient');
      return;
    }
    if (!createdBy.trim()) {
      setError('Please enter who is creating this invoice');
      return;
    }

    const validItems = items.filter(i => i.name.trim());
    if (validItems.length === 0) {
      setError('Add at least one item');
      return;
    }

    for (const item of validItems) {
      if (!parseFloat(item.quantity) || parseFloat(item.quantity) <= 0) {
        setError(`Item "${item.name}" has an invalid quantity`);
        return;
      }
      if (parseFloat(item.unit_price) < 0) {
        setError(`Item "${item.name}" has a negative price`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const invoice = await invoiceService.create({
        patient_id: parseInt(patientId),
        appointment_id: appointmentId ? parseInt(appointmentId) : null,
        items: validItems.map(i => ({
          name: i.name.trim(),
          quantity: parseFloat(i.quantity),
          unit_price: parseFloat(i.unit_price) || 0,
        })),
        created_by: createdBy.trim(),
        invoice_date: invoiceDate,
      });
      navigate(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  }

  const fieldStyle = { display: 'block', width: '100%', padding: '8px', marginTop: 4, boxSizing: 'border-box', border: '1px solid #e8dfd6', borderRadius: 8, fontSize: 14 };
  const labelStyle = { display: 'block', marginBottom: 12 };

  return (
    <div style={{ maxWidth: 700 }}>
      <button onClick={() => navigate('/invoices')} style={{ marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#7a6a5f', padding: 0, fontSize: 14 }}>
        ← Back to Invoices
      </button>

      <h2 style={{ margin: '0 0 20px' }}>Create Invoice</h2>

      {error && (
        <p style={{ color: '#c97b7b', background: '#faeaea', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit}>
        {/* Patient */}
        <label style={labelStyle}>
          <strong>Patient *</strong>
          <select value={patientId} onChange={e => setPatientId(e.target.value)} style={fieldStyle} required>
            <option value="">Select a patient…</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
            ))}
          </select>
        </label>

        {appointmentId && (
          <div style={{ fontSize: 13, color: '#7a6a5f', marginBottom: 12, padding: '6px 10px', background: 'var(--hover-bg)', borderRadius: 8 }}>
            Linked to Appointment #{appointmentId}
          </div>
        )}

        <label style={labelStyle}>
          <strong>Invoice date *</strong>
          <input
            type="date"
            value={invoiceDate}
            onChange={e => setInvoiceDate(e.target.value)}
            style={fieldStyle}
            required
          />
          <span style={{ fontSize: 12, color: '#7a6a5f', display: 'block', marginTop: 4 }}>
            Business date for reporting (use for backdated or migrated invoices).
          </span>
        </label>

        {/* Line items */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong>Items</strong>
            <button type="button" onClick={addItem} style={{ ...outlineBtn('var(--primary)'), fontSize: 12, padding: '3px 10px' }}>
              + Add Item
            </button>
          </div>

          {/* Header row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 12, fontWeight: 600, color: '#7a6a5f' }}>
            {services.length > 0 && <div style={{ width: 120 }}>Service</div>}
            <div style={{ flex: 2 }}>Name</div>
            <div style={{ width: 70 }}>Qty</div>
            <div style={{ width: 100 }}>Price</div>
            <div style={{ width: 90, textAlign: 'right' }}>Total</div>
            <div style={{ width: 30 }}></div>
          </div>

          {items.map((item, index) => {
            const li = lineItems[index];
            return (
              <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                {services.length > 0 && (
                  <select
                    value=""
                    onChange={e => applyService(index, e.target.value)}
                    style={{ ...fieldStyle, width: 120, marginTop: 0, fontSize: 12, padding: '6px', color: '#7a6a5f' }}
                    title="Auto-fill from service"
                  >
                    <option value="">Quick fill…</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.price ? ` (${s.price})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  placeholder="Treatment / service name"
                  value={item.name}
                  onChange={e => updateItem(index, 'name', e.target.value)}
                  style={{ ...fieldStyle, flex: 2, marginTop: 0 }}
                  required
                />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={e => updateItem(index, 'quantity', e.target.value)}
                  style={{ ...fieldStyle, width: 70, marginTop: 0 }}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price"
                  value={item.unit_price}
                  onChange={e => updateItem(index, 'unit_price', e.target.value)}
                  style={{ ...fieldStyle, width: 100, marginTop: 0 }}
                />
                <div style={{ width: 90, textAlign: 'right', fontWeight: 600, fontSize: 14 }}>
                  {li.total.toFixed(2)}
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length <= 1}
                  style={{ width: 30, border: 'none', background: 'none', cursor: items.length > 1 ? 'pointer' : 'default', fontSize: 16, color: items.length > 1 ? '#c97b7b' : '#c8bdb7' }}
                  title="Remove item"
                >
                  ×
                </button>
              </div>
            );
          })}

          {/* Grand total */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', paddingTop: 10,
            borderTop: '2px solid #e8dfd6', marginTop: 8,
          }}>
            <span style={{ fontWeight: 700, fontSize: 16, marginRight: 8 }}>Total:</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>{grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Created by */}
        <label style={labelStyle}>
          <strong>Created by *</strong>
          {staffList.length > 0 ? (
            <select value={createdBy} onChange={e => setCreatedBy(e.target.value)} style={fieldStyle} required>
              <option value="">— Select staff —</option>
              {staffList.map(s => (
                <option key={s.id} value={s.name}>{s.name}{s.role ? ` (${s.role})` : ''}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={createdBy}
              onChange={e => setCreatedBy(e.target.value)}
              placeholder="Staff name"
              style={fieldStyle}
              required
            />
          )}
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !patientId || !createdBy.trim()}
          style={{
            ...solidBtn('var(--primary)'),
            padding: '10px 28px', fontSize: 14, opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Creating…' : 'Create Invoice'}
        </button>
      </form>
    </div>
  );
}
