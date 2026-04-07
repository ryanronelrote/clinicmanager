import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryService } from '../services/inventoryService';

export default function AddInventoryItem() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', category: '', unit: '', stock_quantity: '', low_stock_threshold: '', conversion_unit: '', conversion_factor: '' });
  const [error, setError] = useState('');

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await inventoryService.create(form);
      navigate('/inventory');
    } catch (err) {
      setError(err.message || 'Error');
    }
  }

  const inp = { padding: '7px 10px', border: '1px solid var(--input-border)', borderRadius: 4, width: '100%', boxSizing: 'border-box', fontSize: 14 };
  const lbl = { fontSize: 12, color: '#888', display: 'block', marginBottom: 3 };

  return (
    <div style={{ maxWidth: 480 }}>
      <button onClick={() => navigate('/inventory')} style={{ marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0 }}>← Back</button>
      <h2 style={{ marginTop: 0, marginBottom: 20 }}>Add Inventory Item</h2>
      {error && <p style={{ color: '#cc3333' }}>{error}</p>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label>
          <span style={lbl}>Item Name *</span>
          <input required style={inp} value={form.name} onChange={e => set('name', e.target.value)} />
        </label>
        <label>
          <span style={lbl}>Category</span>
          <input style={inp} value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Skincare, Equipment…" />
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}>
            <span style={lbl}>Unit</span>
            <input style={inp} value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="e.g. pcs, ml, boxes" />
          </label>
          <label style={{ flex: 1 }}>
            <span style={lbl}>Initial Stock</span>
            <input type="number" min="0" style={inp} value={form.stock_quantity} onChange={e => set('stock_quantity', e.target.value)} placeholder="0" />
          </label>
          <label style={{ flex: 1 }}>
            <span style={lbl}>Low Stock Alert</span>
            <input type="number" min="0" style={inp} value={form.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)} placeholder="0" />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}>
            <span style={lbl}>Conversion Unit <span style={{ color: '#bbb' }}>(optional)</span></span>
            <input style={inp} value={form.conversion_unit} onChange={e => set('conversion_unit', e.target.value)} placeholder="e.g. bottle, box, L" />
          </label>
          <label style={{ flex: 1 }}>
            <span style={lbl}>= how many {form.unit || 'base units'}?</span>
            <input type="number" min="0" step="any" style={inp} value={form.conversion_factor} onChange={e => set('conversion_factor', e.target.value)} placeholder="e.g. 500" />
          </label>
        </div>
        <button type="submit" style={{ padding: '8px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, cursor: 'pointer', fontWeight: '600', alignSelf: 'flex-start' }}>
          Save Item
        </button>
      </form>
    </div>
  );
}
