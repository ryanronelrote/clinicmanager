import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { invoiceService } from '../services/invoiceService';

function manilaTodayYmd() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

function manilaStartOfWeekYmd() {
  const now = new Date();
  const manila = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const day = manila.getDay(); // 0=Sun
  manila.setDate(manila.getDate() - day);
  return manila.toLocaleDateString('en-CA');
}

function manilaStartOfMonthYmd() {
  const now = new Date();
  const manila = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  manila.setDate(1);
  return manila.toLocaleDateString('en-CA');
}

const METHOD_STYLE = {
  cash:  { bg: '#edf4ee', color: '#3d5c41' },
  gcash: { bg: '#f5ede4', color: '#7a5c2e' },
  bdo:   { bg: '#e8eef8', color: '#2e4a7a' },
  card:  { bg: '#f3eeea', color: '#7a6a5f' },
};

const PRESETS = [
  { label: 'Today',      key: 'today' },
  { label: 'This Week',  key: 'week' },
  { label: 'This Month', key: 'month' },
  { label: 'Custom',     key: 'custom' },
];

function resolvePreset(key) {
  const today = manilaTodayYmd();
  if (key === 'today')  return { from_date: today, to_date: today };
  if (key === 'week')   return { from_date: manilaStartOfWeekYmd(), to_date: today };
  if (key === 'month')  return { from_date: manilaStartOfMonthYmd(), to_date: today };
  return null; // custom
}

export default function PaymentList() {
  const navigate = useNavigate();
  const today = manilaTodayYmd();

  const [preset, setPreset] = useState('month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [applied, setApplied] = useState(() => resolvePreset('month'));

  function selectPreset(key) {
    setPreset(key);
    if (key !== 'custom') {
      setApplied(resolvePreset(key));
    }
  }

  function applyCustom() {
    setApplied({ from_date: fromDate, to_date: toDate });
  }

  function clearCustom() {
    setFromDate('');
    setToDate('');
    setApplied({ from_date: '', to_date: '' });
  }

  const { data: payments = [], loading } = useAsync(
    () => invoiceService.listPayments({ from_date: applied.from_date, to_date: applied.to_date }),
    [applied]
  );

  const total = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  const fieldStyle = {
    padding: '7px 10px', border: '1px solid #e8dfd6', borderRadius: 8,
    fontSize: 13, fontFamily: 'var(--font-body)', background: '#fff',
  };

  const presetBtnStyle = (active) => ({
    padding: '7px 16px',
    border: active ? '2px solid var(--primary)' : '1px solid #e8dfd6',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: active ? 700 : 400,
    background: active ? '#fdf6ee' : '#fff',
    color: active ? '#3e2f25' : '#7a6a5f',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    transition: 'all 0.15s ease',
  });

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Payment History</h2>
      </div>

      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => selectPreset(p.key)} style={presetBtnStyle(preset === p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      {preset === 'custom' && (
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
            onClick={applyCustom}
            style={{ padding: '7px 18px', background: 'var(--primary)', color: '#3e2f25', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            Apply
          </button>
          {(applied.from_date || applied.to_date) && (
            <button
              onClick={clearCustom}
              style={{ padding: '7px 14px', background: 'none', border: '1px solid #e8dfd6', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#7a6a5f' }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Spacer when not showing custom inputs */}
      {preset !== 'custom' && <div style={{ marginBottom: 20 }} />}

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
