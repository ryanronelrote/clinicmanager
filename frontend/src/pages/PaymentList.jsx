import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { invoiceService } from '../services/invoiceService';

function manilaTodayYmd() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

const METHOD_STYLE = {
  cash:  { bg: '#edf4ee', color: '#3d5c41' },
  gcash: { bg: '#f5ede4', color: '#7a5c2e' },
  bdo:   { bg: '#e8eef8', color: '#2e4a7a' },
  card:  { bg: '#f3eeea', color: '#7a6a5f' },
};

export default function PaymentList() {
  const navigate = useNavigate();
  const today = manilaTodayYmd();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [applied, setApplied] = useState({ from_date: '', to_date: '' });

  const { data: payments = [], loading } = useAsync(
    () => invoiceService.listPayments({ from_date: applied.from_date, to_date: applied.to_date }),
    [applied]
  );

  function applyFilter() {
    setApplied({ from_date: fromDate, to_date: toDate });
  }

  function clearFilter() {
    setFromDate('');
    setToDate('');
    setApplied({ from_date: '', to_date: '' });
  }

  const total = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  const fieldStyle = {
    padding: '7px 10px', border: '1px solid #e8dfd6', borderRadius: 8,
    fontSize: 13, fontFamily: 'var(--font-body)', background: '#fff',
  };

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Payment History</h2>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13 }}>
          <span style={{ display: 'block', marginBottom: 4, color: '#7a6a5f', fontWeight: 600 }}>From</span>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={fieldStyle} />
        </label>
        <label style={{ fontSize: 13 }}>
          <span style={{ display: 'block', marginBottom: 4, color: '#7a6a5f', fontWeight: 600 }}>To</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} max={today} style={fieldStyle} />
        </label>
        <button
          onClick={applyFilter}
          style={{ padding: '7px 18px', background: 'var(--primary)', color: '#3e2f25', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
        >
          Apply
        </button>
        {(applied.from_date || applied.to_date) && (
          <button
            onClick={clearFilter}
            style={{ padding: '7px 14px', background: 'none', border: '1px solid #e8dfd6', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#7a6a5f' }}
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : payments.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#7a6a5f', border: '1px dashed #e8dfd6', borderRadius: 8 }}>
          No payments found.
        </div>
      ) : (
        <>
          {/* Summary */}
          <div style={{ marginBottom: 16, padding: '10px 16px', background: '#fdfaf6', border: '1px solid #e8dfd6', borderRadius: 8, display: 'flex', gap: 32 }}>
            <span style={{ fontSize: 13, color: '#7a6a5f' }}>
              {payments.length} payment{payments.length !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
              Total: ₱{total.toFixed(2)}
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e8dfd6' }}>
                <th style={{ padding: '8px' }}>Date</th>
                <th style={{ padding: '8px' }}>Patient</th>
                <th style={{ padding: '8px' }}>Invoice</th>
                <th style={{ padding: '8px' }}>Method</th>
                <th style={{ padding: '8px' }}>Received by</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => {
                const ms = METHOD_STYLE[p.payment_method] || METHOD_STYLE.card;
                return (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/invoices/${p.invoice_id}`)}
                    style={{ borderBottom: '1px solid #e8dfd6', cursor: 'pointer', transition: 'background 0.15s ease' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '8px', fontSize: 13 }}>{p.payment_date}</td>
                    <td style={{ padding: '8px' }}>{p.first_name} {p.last_name}</td>
                    <td style={{ padding: '8px', color: 'var(--primary)', fontWeight: 600 }}>
                      INV-{String(p.invoice_id).padStart(4, '0')}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                        padding: '2px 8px', borderRadius: 10,
                        background: ms.bg, color: ms.color,
                      }}>
                        {p.payment_method}
                      </span>
                    </td>
                    <td style={{ padding: '8px', fontSize: 13, color: '#7a6a5f' }}>{p.received_by || '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>
                      ₱{parseFloat(p.amount).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
