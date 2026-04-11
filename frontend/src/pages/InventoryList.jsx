import { useNavigate } from 'react-router-dom';
import { useInventory } from '../hooks/useInventory';
import { solidBtn } from '../utils/styleUtils';

export default function InventoryList() {
  const navigate = useNavigate();
  const { data: items, loading } = useInventory();

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Inventory</h2>
        <button onClick={() => navigate('/inventory/add')} style={solidBtn('var(--primary)')}>+ Add Item</button>
      </div>

      {loading && <p style={{ color: '#b8a99e' }}>Loading…</p>}

      {!loading && (items || []).length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: '#7a6a5f', border: '1px dashed #e8dfd6', borderRadius: 8 }}>
          No inventory items yet.
        </div>
      )}

      {!loading && (items || []).length > 0 && (
        <div style={{ border: '1px solid #e8dfd6', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', background: '#fdfaf6', borderBottom: '1px solid #e8dfd6', padding: '8px 16px', fontSize: 12, fontWeight: '700', color: '#b8a99e', textTransform: 'uppercase' }}>
            <span>Item</span>
            <span style={{ textAlign: 'right' }}>Stock</span>
            <span style={{ textAlign: 'right' }}>Unit</span>
            <span style={{ textAlign: 'right' }}>Min</span>
          </div>
          {(items || []).map((item, i) => {
            const low = item.low_stock_threshold > 0 && item.stock_quantity <= item.low_stock_threshold;
            return (
              <div key={item.id}
                onClick={() => navigate(`/inventory/${item.id}`)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
                  alignItems: 'center', padding: '10px 16px',
                  borderTop: i > 0 ? '1px solid #e8dfd6' : 'none',
                  background: low ? '#fdf3e3' : '#fff',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: 14, color: 'var(--primary)' }}>{item.name}</div>
                  {item.category && <div style={{ fontSize: 12, color: '#b8a99e' }}>{item.category}</div>}
                </div>
                <div style={{ textAlign: 'right', fontWeight: '700', fontSize: 15, color: low ? '#c97b7b' : '#3e2f25' }}>
                  {item.stock_quantity}
                  {low && <span style={{ fontSize: 10, marginLeft: 4, color: '#c97b7b' }}>▼LOW</span>}
                </div>
                <div style={{ textAlign: 'right', fontSize: 13, color: '#7a6a5f' }}>{item.unit || '—'}</div>
                <div style={{ textAlign: 'right', fontSize: 13, color: '#c8bdb7' }}>{item.low_stock_threshold || '—'}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
