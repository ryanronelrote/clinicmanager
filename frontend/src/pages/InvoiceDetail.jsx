import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { invoiceService } from '../services/invoiceService';
import { solidBtn, outlineBtn } from '../utils/styleUtils';

const STATUS_CONFIG = {
  unpaid:  { label: 'Unpaid',  color: '#8b3a3a', bg: '#faeaea' },
  partial: { label: 'Partial', color: '#7a5c2e', bg: '#fdf3e3' },
  paid:    { label: 'Paid',    color: '#3d5c41', bg: '#edf4ee' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unpaid;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33`,
    }}>
      <span style={{ fontSize: 8, lineHeight: 1 }}>●</span>
      {cfg.label}
    </span>
  );
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef(null);
  const { data: invoice, loading, setData: setInvoice } = useAsync(() => invoiceService.getById(id), [id]);

  // Payment form
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payError, setPayError] = useState('');
  const [paying, setPaying] = useState(false);

  // Mark as paid
  const [marking, setMarking] = useState(false);

  // Edit items
  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState([]);
  const [editSaving, setEditSaving] = useState(false);

  async function handleAddPayment(e) {
    e.preventDefault();
    setPayError('');
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      setPayError('Enter a valid amount');
      return;
    }
    setPaying(true);
    try {
      const updated = await invoiceService.addPayment(id, { amount, payment_method: payMethod });
      setInvoice(updated);
      setPayAmount('');
    } catch (err) {
      setPayError(err.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  }

  async function handleMarkPaid() {
    setMarking(true);
    try {
      const updated = await invoiceService.markPaid(id);
      setInvoice(updated);
    } catch {
      // stay on page
    } finally {
      setMarking(false);
    }
  }

  function enterEditItems() {
    setEditItems(invoice.items.map(i => ({
      name: i.name,
      quantity: String(i.quantity),
      unit_price: String(i.unit_price),
    })));
    setEditMode(true);
  }

  function addEditItem() {
    setEditItems(prev => [...prev, { name: '', quantity: '1', unit_price: '' }]);
  }

  function removeEditItem(index) {
    if (editItems.length <= 1) return;
    setEditItems(prev => prev.filter((_, i) => i !== index));
  }

  function updateEditItem(index, field, value) {
    setEditItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  async function saveEditItems() {
    setEditSaving(true);
    try {
      const updated = await invoiceService.updateItems(id, editItems.map(i => ({
        name: i.name,
        quantity: parseFloat(i.quantity) || 0,
        unit_price: parseFloat(i.unit_price) || 0,
      })));
      setInvoice(updated);
      setEditMode(false);
    } catch {
      // keep edit mode
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this invoice and all its payments?')) return;
    try {
      await invoiceService.delete(id);
      navigate('/invoices');
    } catch {
      // stay on page
    }
  }

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
      <head><title>Invoice INV-${String(invoice.id).padStart(4, '0')}</title>
      <style>
        body { font-family: sans-serif; padding: 40px; color: #333; max-width: 700px; margin: 0 auto; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { font-weight: 600; border-bottom: 2px solid #999; }
        .total-row { font-weight: 700; font-size: 16px; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 12px; font-weight: 600; }
        .unpaid { color: #8b3a3a; background: #faeaea; }
        .partial { color: #7a5c2e; background: #fdf3e3; }
        .paid { color: #3d5c41; background: #edf4ee; }
        @media print { button { display: none; } }
      </style>
      </head>
      <body>
        ${content.innerHTML}
        <script>window.print();window.close();<\/script>
      </body>
      </html>
    `);
    win.document.close();
  }

  if (loading) return <p>Loading...</p>;
  if (!invoice) return <p>Invoice not found. <button onClick={() => navigate('/invoices')}>Back</button></p>;

  const total    = parseFloat(invoice.total_amount) || 0;
  const paid     = parseFloat(invoice.amount_paid) || 0;
  const balance  = Math.round((total - paid) * 100) / 100;
  const items    = invoice.items || [];
  const payments = invoice.payments || [];

  const rowStyle = { borderBottom: '1px solid #e8dfd6', padding: '10px 0', display: 'flex', gap: 16, alignItems: 'flex-start' };
  const labelStyle = { fontWeight: '600', width: 140, flexShrink: 0 };
  const inputStyle = { padding: '6px 8px', border: '1px solid #e8dfd6', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ maxWidth: 700 }}>
      <button onClick={() => navigate('/invoices')} style={{ marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#7a6a5f', padding: 0, fontSize: 14 }}>
        ← Back to Invoices
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>INV-{String(invoice.id).padStart(4, '0')}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {invoice.status !== 'paid' && !editMode && (
            <button onClick={handleMarkPaid} disabled={marking} style={solidBtn('#6b8f71')}>
              {marking ? 'Processing…' : 'Mark as Paid'}
            </button>
          )}
          <button onClick={handlePrint} style={outlineBtn('var(--primary)')}>Print</button>
          {!editMode && invoice.status !== 'paid' && (
            <button onClick={enterEditItems} style={outlineBtn('var(--primary)')}>Edit Items</button>
          )}
          <button onClick={handleDelete} style={outlineBtn('#c97b7b')}>Delete</button>
        </div>
      </div>

      {/* Printable section */}
      <div ref={printRef}>
        {/* Status */}
        <div style={{ marginBottom: 16 }}>
          <StatusBadge status={invoice.status} />
        </div>

        {/* Invoice info */}
        <div>
          <div style={rowStyle}>
            <span style={labelStyle}>Patient</span>
            <Link to={`/clients/${invoice.patient_id}`}>{invoice.first_name} {invoice.last_name}</Link>
          </div>
          {invoice.appointment_id && (
            <div style={rowStyle}>
              <span style={labelStyle}>Appointment</span>
              <Link to={`/appointments/${invoice.appointment_id}`}>View Appointment #{invoice.appointment_id}</Link>
            </div>
          )}
          <div style={rowStyle}>
            <span style={labelStyle}>Created</span>
            <span>{new Date(invoice.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}</span>
          </div>
        </div>

        {/* Line items */}
        <h3 style={{ marginTop: 24, marginBottom: 8 }}>Items</h3>
        {editMode ? (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 12, fontWeight: 600, color: '#7a6a5f' }}>
              <div style={{ flex: 2 }}>Name</div>
              <div style={{ width: 70 }}>Qty</div>
              <div style={{ width: 100 }}>Price</div>
              <div style={{ width: 80, textAlign: 'right' }}>Total</div>
              <div style={{ width: 30 }}></div>
            </div>
            {editItems.map((item, index) => {
              const qty = parseFloat(item.quantity) || 0;
              const price = parseFloat(item.unit_price) || 0;
              const lineTotal = Math.round(qty * price * 100) / 100;
              return (
                <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                  <input type="text" value={item.name} onChange={e => updateEditItem(index, 'name', e.target.value)}
                    style={{ ...inputStyle, flex: 2 }} placeholder="Name" />
                  <input type="number" value={item.quantity} onChange={e => updateEditItem(index, 'quantity', e.target.value)}
                    style={{ ...inputStyle, width: 70 }} min="0.01" step="0.01" />
                  <input type="number" value={item.unit_price} onChange={e => updateEditItem(index, 'unit_price', e.target.value)}
                    style={{ ...inputStyle, width: 100 }} min="0" step="0.01" />
                  <div style={{ width: 80, textAlign: 'right', fontWeight: 600 }}>{lineTotal.toFixed(2)}</div>
                  <button type="button" onClick={() => removeEditItem(index)} disabled={editItems.length <= 1}
                    style={{ width: 30, border: 'none', background: 'none', cursor: editItems.length > 1 ? 'pointer' : 'default', fontSize: 16, color: editItems.length > 1 ? '#c97b7b' : '#c8bdb7' }}>×</button>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={addEditItem} style={{ ...outlineBtn('var(--primary)'), fontSize: 12, padding: '3px 10px' }}>+ Add Item</button>
              <button onClick={() => setEditMode(false)} style={outlineBtn('#7a6a5f')}>Cancel</button>
              <button onClick={saveEditItems} disabled={editSaving} style={solidBtn('var(--primary)')}>
                {editSaving ? 'Saving…' : 'Save Items'}
              </button>
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e8dfd6' }}>
                <th style={{ padding: '8px' }}>Treatment / Service</th>
                <th style={{ padding: '8px', width: 60 }}>Qty</th>
                <th style={{ padding: '8px', width: 100 }}>Price</th>
                <th style={{ padding: '8px', width: 100, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #e8dfd6' }}>
                  <td style={{ padding: '8px' }}>{item.name}</td>
                  <td style={{ padding: '8px' }}>{parseFloat(item.quantity)}</td>
                  <td style={{ padding: '8px' }}>{parseFloat(item.unit_price).toFixed(2)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{parseFloat(item.total_price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Totals summary */}
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#fdfaf6', borderRadius: 8, border: '1px solid #e8dfd6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
            <span>Total Amount</span>
            <span style={{ fontWeight: 600 }}>{total.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14, color: '#6b8f71' }}>
            <span>Amount Paid</span>
            <span style={{ fontWeight: 600 }}>{paid.toFixed(2)}</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            paddingTop: 8, borderTop: '2px solid #e8dfd6', fontSize: 16,
            color: balance > 0 ? '#c97b7b' : '#6b8f71', fontWeight: 700,
          }}>
            <span>Remaining Balance</span>
            <span>{balance.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Payment section */}
      {invoice.status !== 'paid' && (
        <div style={{ marginTop: 28, padding: '20px', background: '#fdfaf6', borderRadius: 8, border: '1px solid #e8dfd6' }}>
          <h3 style={{ margin: '0 0 12px' }}>Add Payment</h3>
          {payError && (
            <p style={{ color: '#c97b7b', background: '#faeaea', padding: '6px 10px', borderRadius: 8, fontSize: 13, marginBottom: 8 }}>
              {payError}
            </p>
          )}
          <form onSubmit={handleAddPayment} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 120px' }}>
              <span style={{ fontSize: 12, color: '#7a6a5f' }}>Amount</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={balance}
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder={balance.toFixed(2)}
                style={{ ...inputStyle, marginTop: 4 }}
                required
              />
            </label>
            <label style={{ flex: '1 1 120px' }}>
              <span style={{ fontSize: 12, color: '#7a6a5f' }}>Method</span>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
                <option value="card">Card</option>
              </select>
            </label>
            <button type="submit" disabled={paying} style={{ ...solidBtn('var(--primary)'), padding: '8px 20px', marginBottom: 0 }}>
              {paying ? 'Processing…' : 'Record Payment'}
            </button>
          </form>
        </div>
      )}

      {/* Payment history */}
      {payments.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 8 }}>Payment History</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e8dfd6' }}>
                <th style={{ padding: '8px' }}>Date</th>
                <th style={{ padding: '8px' }}>Amount</th>
                <th style={{ padding: '8px' }}>Method</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #e8dfd6' }}>
                  <td style={{ padding: '8px', fontSize: 13 }}>
                    {new Date(p.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}
                  </td>
                  <td style={{ padding: '8px', fontWeight: 600, color: '#6b8f71' }}>
                    {parseFloat(p.amount).toFixed(2)}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                      padding: '2px 8px', borderRadius: 10,
                      background: p.payment_method === 'cash' ? '#edf4ee' : p.payment_method === 'gcash' ? '#f5ede4' : '#f3eeea',
                      color: p.payment_method === 'cash' ? '#3d5c41' : p.payment_method === 'gcash' ? '#7a5c2e' : '#7a6a5f',
                    }}>
                      {p.payment_method}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
