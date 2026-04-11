import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClients } from '../hooks/useClients';
import { VIP_BADGE } from '../utils/styleUtils';

export default function ClientList() {
  const { data: clients, loading } = useClients();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vipOnly = searchParams.get('vip') === '1';

  const displayed = vipOnly ? (clients || []).filter(c => c.is_vip) : (clients || []);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>
            {vipOnly ? '★ VIP Clients' : 'Clients'}
          </h2>
          {vipOnly && (
            <button
              onClick={() => navigate('/clients')}
              style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #e8dfd6', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#7a6a5f', transition: 'background 0.15s ease' }}
            >
              ← All
            </button>
          )}
        </div>
        <button
          onClick={() => navigate('/add')}
          style={{
            padding: '7px 18px', fontSize: 13, fontWeight: 600,
            background: 'var(--primary)', color: '#3e2f25',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            transition: 'opacity 0.15s ease',
          }}
        >
          + Add Client
        </button>
      </div>

      {displayed.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#7a6a5f', border: '1px dashed #e8dfd6', borderRadius: 8 }}>
          {vipOnly ? 'No VIP clients yet.' : 'No clients yet.'}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e8dfd6' }}>
              <th style={{ padding: '8px' }}>Name</th>
              <th style={{ padding: '8px' }}>Phone</th>
              <th style={{ padding: '8px' }}>Email</th>
              <th style={{ padding: '8px' }}>Added</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((client) => (
              <tr
                key={client.id}
                onClick={() => navigate(`/clients/${client.id}`)}
                style={{ borderBottom: '1px solid #e8dfd6', cursor: 'pointer', transition: 'background 0.15s ease' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              >
                <td style={{ padding: '8px' }}>
                  {client.first_name} {client.last_name}
                  {client.is_vip ? VIP_BADGE : null}
                </td>
                <td style={{ padding: '8px' }}>{client.phone || '—'}</td>
                <td style={{ padding: '8px' }}>{client.email || '—'}</td>
                <td style={{ padding: '8px' }}>
                  {new Date(client.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
