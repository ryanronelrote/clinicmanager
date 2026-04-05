import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function InventoryList() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/inventory').then(r => r.json()).then(data => { setItems(data); setLoading(false); });
  }, []);

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Inventory</h2>
        <button onClick={() => navigate('/inventory/add')} style={solidBtn('var(--primary)')}>+ Add Item</button>
      </div>

      {loading && <p style={{ color: '#888' }}>Loading…</p>}

      {!loading && items.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: '#888', border: '1px dashed #ddd', borderRadius: 8 }}>
          No inventory items yet.
        </div>
      )}

      {!loading && items.length > 0 && (
        <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', background: '#fafafa', borderBottom: '1px solid #eee', padding: '8px 16px', fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase' }}>
            <span>Item</span>
            <span style={{ textAlign: 'right' }}>Stock</span>
            <span style={{ textAlign: 'right' }}>Unit</span>
            <span style={{ textAlign: 'right' }}>Min</span>
          </div>
          {items.map((item, i) => {
            const low = item.low_stock_threshold > 0 && item.stock_quantity <= item.low_stock_threshold;
            return (
              <div key={item.id}
                onClick={() => navigate(`/inventory/${item.id}`)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
                  alignItems: 'center', padding: '10px 16px',
                  borderTop: i > 0 ? '1px solid #f0f0f0' : 'none',
                  background: low ? '#fff8f0' : '#fff',
                  cursor: 'pointer',
                }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: 14, color: 'var(--primary)' }}>{item.name}</div>
                  {item.category && <div style={{ fontSize: 12, color: '#aaa' }}>{item.category}</div>}
                </div>
                <div style={{ textAlign: 'right', fontWeight: '700', fontSize: 15, color: low ? '#e07b54' : '#222' }}>
                  {item.stock_quantity}
                  {low && <span style={{ fontSize: 10, marginLeft: 4, color: '#e07b54' }}>▼LOW</span>}
                </div>
                <div style={{ textAlign: 'right', fontSize: 13, color: '#888' }}>{item.unit || '—'}</div>
                <div style={{ textAlign: 'right', fontSize: 13, color: '#bbb' }}>{item.low_stock_threshold || '—'}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function solidBtn(color) {
  return { padding: '5px 14px', fontSize: 13, cursor: 'pointer', borderRadius: 4, border: 'none', background: color, color: '#fff', fontWeight: '600' };
}
