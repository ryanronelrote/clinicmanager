import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ClientList() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/clients')
      .then((res) => res.json())
      .then((data) => {
        setClients(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading...</p>;

  if (clients.length === 0) {
    return (
      <div>
        <p>No clients yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>All Clients</h2>
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
          {clients.map((client) => (
            <tr
              key={client.id}
              onClick={() => navigate(`/clients/${client.id}`)}
              style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            >
              <td style={{ padding: '8px' }}>
                {client.first_name} {client.last_name}
                {client.is_vip ? (
                  <span style={{
                    display: 'inline-block', background: '#fbbf24', color: '#78350f',
                    borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: '700',
                    marginLeft: 8, verticalAlign: 'middle',
                  }}>★ VIP</span>
                ) : null}
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
    </div>
  );
}
