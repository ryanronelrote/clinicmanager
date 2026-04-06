import { authFetch } from '../authFetch';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function InventoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  // Stock form
  const [mode, setMode] = useState(null); // 'add' | 'remove'
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState('');
  const [inputUnit, setInputUnit] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      authFetch(`/inventory/${id}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      authFetch(`/inventory/${id}/movements`).then(r => r.json()),
    ]).then(([i, m]) => { setItem(i); setMovements(m); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  function enterEdit() {
    setDraft({
      name:               item.name,
      category:           item.category || '',
      unit:               item.unit || '',
      low_stock_threshold: item.low_stock_threshold ?? 0,
      conversion_unit:    item.conversion_unit || '',
      conversion_factor:  item.conversion_factor ?? '',
      preferred_unit:     item.preferred_unit || '',
    });
    setEditMode(true);
  }

  function cancelEdit() { setEditMode(false); setDraft({}); }

  async function saveEdit() {
    setEditSaving(true);
    const res = await authFetch(`/inventory/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...draft,
        conversion_factor: draft.conversion_factor !== '' ? parseFloat(draft.conversion_factor) : null,
        conversion_unit:   draft.conversion_unit || null,
        preferred_unit:    draft.preferred_unit || null,
      }),
    });
    const updated = await res.json();
    setItem(updated);
    setEditSaving(false);
    setEditMode(false);
  }

  function openForm(m) {
    setMode(m);
    setQty('');
    setReason('');
    setDate(new Date().toISOString().slice(0, 10));
    // Default input unit to preferred unit if set
    setInputUnit(item.preferred_unit === item.conversion_unit ? item.conversion_unit : '');
    setError('');
  }
  function closeForm() { setMode(null); }

  async function submitStock() {
    const q = parseFloat(qty);
    if (!q || q <= 0) { setError('Enter a valid quantity'); return; }
    setSaving(true);
    setError('');
    const endpoint = mode === 'add' ? 'add-stock' : 'remove-stock';
    const res = await authFetch(`/inventory/${id}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: q, reason: reason || undefined, date: date || undefined, input_unit: inputUnit || undefined }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Error'); setSaving(false); return; }
    setItem(data);
    const updated = await authFetch(`/inventory/${id}/movements`).then(r => r.json());
    setMovements(updated);
    setSaving(false);
    closeForm();
  }

  if (loading) return <p>Loading…</p>;
  if (!item) return <p>Item not found. <button onClick={() => navigate('/inventory')}>Back</button></p>;

  const low = item.low_stock_threshold > 0 && item.stock_quantity <= item.low_stock_threshold;
  const inp = { padding: '7px 10px', border: '1px solid var(--input-border)', borderRadius: 4, width: '100%', boxSizing: 'border-box', fontSize: 14 };

  // Display stock in preferred unit
  const hasConversion = item.conversion_unit && item.conversion_factor;
  const showInConversion = hasConversion && item.preferred_unit === item.conversion_unit;
  const displayStock = showInConversion
    ? `${(item.stock_quantity / item.conversion_factor).toFixed(2).replace(/\.?0+$/, '')} ${item.conversion_unit}`
    : `${item.stock_quantity} ${item.unit || ''}`;

  return (
    <div style={{ maxWidth: 640 }}>
      <button onClick={() => navigate('/inventory')} style={{ marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0 }}>← Back</button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>{item.name}</h2>
          {item.category && <div style={{ fontSize: 13, color: '#aaa', marginTop: 2 }}>{item.category}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!editMode && <>
            <button onClick={enterEdit} style={outlineBtn('var(--primary)')}>Edit</button>
            <button onClick={() => openForm('add')} style={solidBtn('#0f9d58')}>+ Add Stock</button>
            <button onClick={() => openForm('remove')} style={solidBtn('#cc3333')}>− Remove</button>
          </>}
          {editMode && <>
            <button onClick={cancelEdit} style={outlineBtn('#888')}>Cancel</button>
            <button onClick={saveEdit} disabled={editSaving} style={solidBtn('var(--primary)')}>{editSaving ? '…' : 'Save'}</button>
          </>}
        </div>
      </div>

      {/* Edit form */}
      {editMode && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <label style={{ flex: 2 }}>
              <span style={lbl}>Name *</span>
              <input style={inp} value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
            </label>
            <label style={{ flex: 1 }}>
              <span style={lbl}>Category</span>
              <input style={inp} value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <label style={{ flex: 1 }}>
              <span style={lbl}>Base Unit</span>
              <input style={inp} value={draft.unit} onChange={e => setDraft(d => ({ ...d, unit: e.target.value }))} placeholder="e.g. ml, pcs, g" />
            </label>
            <label style={{ flex: 1 }}>
              <span style={lbl}>Low Stock Alert</span>
              <input type="number" min="0" style={inp} value={draft.low_stock_threshold} onChange={e => setDraft(d => ({ ...d, low_stock_threshold: e.target.value }))} />
            </label>
          </div>
          <div style={{ borderTop: '1px solid #eee', paddingTop: 10, marginTop: 4, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: '600', color: '#888', marginBottom: 8 }}>UNIT CONVERSION</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <label style={{ flex: 1 }}>
                <span style={lbl}>Conversion Unit</span>
                <input style={inp} value={draft.conversion_unit} onChange={e => setDraft(d => ({ ...d, conversion_unit: e.target.value }))} placeholder="e.g. bottle, L, box" />
              </label>
              <label style={{ flex: 1 }}>
                <span style={lbl}>1 {draft.conversion_unit || 'unit'} = how many {draft.unit || 'base units'}?</span>
                <input type="number" min="0" step="any" style={inp} value={draft.conversion_factor} onChange={e => setDraft(d => ({ ...d, conversion_factor: e.target.value }))} placeholder="e.g. 500" />
              </label>
            </div>
            {draft.conversion_unit && (
              <label>
                <span style={lbl}>Preferred display unit</span>
                <select style={inp} value={draft.preferred_unit} onChange={e => setDraft(d => ({ ...d, preferred_unit: e.target.value }))}>
                  <option value={draft.unit || ''}>{draft.unit || 'Base unit'}</option>
                  <option value={draft.conversion_unit}>{draft.conversion_unit}</option>
                </select>
              </label>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      {!editMode && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatBox label="Current Stock" value={displayStock} color={low ? '#e07b54' : 'var(--primary)'} />
          {showInConversion && (
            <StatBox label={`In ${item.unit || 'base unit'}`} value={`${item.stock_quantity} ${item.unit || ''}`} color="#888" />
          )}
          <StatBox label="Low Stock Alert" value={item.low_stock_threshold > 0 ? item.low_stock_threshold : 'Off'} color="#888" />
          {hasConversion && (
            <StatBox label="Conversion" value={`1 ${item.conversion_unit} = ${item.conversion_factor} ${item.unit || ''}`} color="#9c27b0" />
          )}
        </div>
      )}

      {!editMode && low && (
        <div style={{ marginBottom: 20, padding: '10px 16px', background: '#fff8f4', border: '1px solid #fcd9c8', borderRadius: 6, color: '#e07b54', fontWeight: '600', fontSize: 13 }}>
          ⚠ Stock is low — {displayStock} remaining
        </div>
      )}

      {/* Stock form */}
      {mode && (
        <div style={{ marginBottom: 24, padding: '16px 20px', border: `1px solid ${mode === 'add' ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 8, background: mode === 'add' ? '#f1f8f1' : '#fff5f5' }}>
          <div style={{ fontWeight: '600', marginBottom: 12, color: mode === 'add' ? '#0f9d58' : '#cc3333' }}>
            {mode === 'add' ? '+ Add Stock' : '− Remove Stock'}
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <label style={{ flex: 1 }}>
              <span style={lbl}>Quantity *</span>
              <input autoFocus type="number" min="0" step="any" value={qty} onChange={e => setQty(e.target.value)} style={inp} />
            </label>
            {hasConversion && (
              <label style={{ flex: 1 }}>
                <span style={lbl}>Unit</span>
                <select value={inputUnit} onChange={e => setInputUnit(e.target.value)} style={inp}>
                  <option value="">{item.unit || 'base unit'}</option>
                  <option value={item.conversion_unit}>{item.conversion_unit} (×{item.conversion_factor})</option>
                </select>
              </label>
            )}
            <label style={{ flex: 1 }}>
              <span style={lbl}>Date *</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
            </label>
          </div>
          {inputUnit && item.conversion_factor && qty && (
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
              = {Math.round(parseFloat(qty) * item.conversion_factor)} {item.unit || 'units'} will be {mode === 'add' ? 'added' : 'removed'}
            </div>
          )}
          <label style={{ display: 'block', marginBottom: 10 }}>
            <span style={lbl}>Reason (optional)</span>
            <input value={reason} onChange={e => setReason(e.target.value)} style={inp} />
          </label>
          {error && <p style={{ color: '#cc3333', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={closeForm} style={outlineBtn('#888')}>Cancel</button>
            <button onClick={submitStock} disabled={saving} style={solidBtn(mode === 'add' ? '#0f9d58' : '#cc3333')}>
              {saving ? '…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {/* Movement history */}
      <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Stock History</h3>
      {movements.length === 0 ? (
        <p style={{ color: '#bbb', fontSize: 13 }}>No movements recorded.</p>
      ) : (
        <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 80px 1fr 140px', padding: '8px 16px', background: '#fafafa', borderBottom: '1px solid #eee', fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase' }}>
            <span>Type</span>
            <span>Qty ({item.unit || '—'})</span>
            <span>Reason</span>
            <span style={{ textAlign: 'right' }}>Date</span>
          </div>
          {movements.map((m, i) => (
            <div key={m.id} style={{
              display: 'grid', gridTemplateColumns: '60px 80px 1fr 140px',
              alignItems: 'center', padding: '10px 16px',
              borderTop: i > 0 ? '1px solid #f0f0f0' : 'none',
            }}>
              <span style={{
                fontWeight: '700', fontSize: 11, padding: '2px 8px', borderRadius: 10, textAlign: 'center',
                background: m.type === 'IN' ? '#e8f5e9' : '#fdecea',
                color: m.type === 'IN' ? '#0f9d58' : '#cc3333',
              }}>{m.type}</span>
              <span style={{ fontWeight: '600', fontSize: 14, color: m.type === 'IN' ? '#0f9d58' : '#cc3333' }}>
                {m.type === 'IN' ? '+' : '−'}{m.quantity}
              </span>
              <span style={{ fontSize: 13, color: '#555' }}>{m.reason || <span style={{ color: '#ccc' }}>—</span>}</span>
              <span style={{ fontSize: 12, color: '#aaa', textAlign: 'right' }}>
                {new Date(m.created_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ flex: '1 1 140px', padding: '12px 16px', borderRadius: 8, border: `1px solid ${color}22`, background: `${color}0d` }}>
      <div style={{ fontSize: 20, fontWeight: '700', color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{label}</div>
    </div>
  );
}

const lbl = { fontSize: 12, color: 'var(--label-color)', display: 'block', marginBottom: 3 };
function outlineBtn(color) {
  return { padding: '5px 14px', fontSize: 13, cursor: 'pointer', borderRadius: 4, border: `1px solid ${color}`, background: '#fff', color };
}
function solidBtn(color) {
  return { padding: '5px 14px', fontSize: 13, cursor: 'pointer', borderRadius: 4, border: 'none', background: color, color: '#fff', fontWeight: '600' };
}
