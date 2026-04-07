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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>
          {vipOnly ? '★ VIP Clients' : 'All Clients'}
        </h2>
        {vipOnly && (
          <button
            onClick={() => navigate('/clients')}
            style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#555' }}
          >
            ← All Clients
          </button>
        )}
      </div>

      {displayed.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#888', border: '1px dashed #ddd', borderRadius: 8 }}>
          {vipOnly ? 'No VIP clients yet.' : 'No clients yet.'}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
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
                style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
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
