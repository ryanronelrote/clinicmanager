import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { invoiceService } from '../services/invoiceService';
import { solidBtn, outlineBtn } from '../utils/styleUtils';

const STATUS_CONFIG = {
  unpaid:  { label: 'Unpaid',  color: '#8b3a3a', bg: '#faeaea', border: '#c97b7b' },
  partial: { label: 'Partial', color: '#7a5c2e', bg: '#fdf3e3', border: '#d6a45c' },
  paid:    { label: 'Paid',    color: '#3d5c41', bg: '#edf4ee', border: '#6b8f71' },
};

function InvoiceStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unpaid;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
      padding: '2px 8px', borderRadius: 10,
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
  );
}

export default function InvoiceList() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data: invoices = [], loading, refetch } = useAsync(
    () => invoiceService.getAll({ status: statusFilter || undefined, from_date: fromDate || undefined, to_date: toDate || undefined }),
    [statusFilter, fromDate, toDate]
  );

  const totals = invoices.reduce((acc, inv) => {
    acc.total += parseFloat(inv.total_amount) || 0;
    acc.paid  += parseFloat(inv.amount_paid)  || 0;
    return acc;
  }, { total: 0, paid: 0 });
  const outstanding = totals.total - totals.paid;

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Invoices</h2>
        <button
          onClick={() => navigate('/invoices/create')}
          style={{
            padding: '7px 18px', fontSize: 13, fontWeight: 600,
            background: 'var(--primary)', color: '#3e2f25',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            transition: 'opacity 0.15s ease',
          }}
        >
          + New Invoice
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <SummaryCard label="Total Billed" value={totals.total.toFixed(2)} color="var(--primary)" />
        <SummaryCard label="Total Collected" value={totals.paid.toFixed(2)} color="#6b8f71" />
        <SummaryCard label="Outstanding" value={outstanding.toFixed(2)} color={outstanding > 0 ? '#c97b7b' : '#6b8f71'} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e8dfd6', fontSize: 13 }}
        >
          <option value="">All Statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 13, color: '#7a6a5f' }}>From:</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #e8dfd6', fontSize: 13 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 13, color: '#7a6a5f' }}>To:</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #e8dfd6', fontSize: 13 }} />
        </div>
        {(statusFilter || fromDate || toDate) && (
          <button
            onClick={() => { setStatusFilter(''); setFromDate(''); setToDate(''); }}
            style={{ ...outlineBtn('#7a6a5f'), fontSize: 12, padding: '4px 10px' }}
          >
            Clear
          </button>
        )}
      </div>

      {invoices.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#7a6a5f', border: '1px dashed #e8dfd6', borderRadius: 8 }}>
          No invoices found.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e8dfd6' }}>
              <th style={{ padding: '8px' }}>#</th>
              <th style={{ padding: '8px' }}>Patient</th>
              <th style={{ padding: '8px' }}>Total</th>
              <th style={{ padding: '8px' }}>Paid</th>
              <th style={{ padding: '8px' }}>Balance</th>
              <th style={{ padding: '8px' }}>Status</th>
              <th style={{ padding: '8px' }}>Invoice date</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => {
              const total = parseFloat(inv.total_amount) || 0;
              const paid = parseFloat(inv.amount_paid) || 0;
              const balance = total - paid;
              return (
                <tr
                  key={inv.id}
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                  style={{ borderBottom: '1px solid #e8dfd6', cursor: 'pointer', transition: 'background 0.15s ease' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td style={{ padding: '8px', fontWeight: 600, color: 'var(--primary)' }}>INV-{String(inv.id).padStart(4, '0')}</td>
                  <td style={{ padding: '8px' }}>{inv.first_name} {inv.last_name}</td>
                  <td style={{ padding: '8px' }}>{total.toFixed(2)}</td>
                  <td style={{ padding: '8px' }}>{paid.toFixed(2)}</td>
                  <td style={{ padding: '8px', fontWeight: balance > 0 ? 600 : 'normal', color: balance > 0 ? '#c97b7b' : '#6b8f71' }}>
                    {balance.toFixed(2)}
                  </td>
                  <td style={{ padding: '8px' }}><InvoiceStatusBadge status={inv.status} /></td>
                  <td style={{ padding: '8px', fontSize: 13, color: '#7a6a5f' }}>
                    {formatInvoiceDate(inv.invoice_date)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function formatInvoiceDate(v) {
  if (v == null || v === '') return '—';
  const s = typeof v === 'string' ? v.slice(0, 10) : new Date(v).toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${m}/${d}/${y}`;
  }
  try {
    return new Date(v).toLocaleDateString();
  } catch {
    return String(v);
  }
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{
      flex: '1 1 160px', padding: '14px 18px', borderRadius: 10,
      border: `1px solid ${color}22`, background: `${color}0d`,
    }}>
      <div style={{ fontSize: 22, fontWeight: '700', color }}>{value}</div>
      <div style={{ fontSize: 13, color: '#7a6a5f', marginTop: 4 }}>{label}</div>
    </div>
  );
}
