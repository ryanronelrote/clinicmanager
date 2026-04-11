import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { appointmentService } from '../services/appointmentService';
import { clientService } from '../services/clientService';
import { inventoryService } from '../services/inventoryService';
import { invoiceService } from '../services/invoiceService';
import { useClinicSettings } from '../context/SettingsContext';
import { toDateStr, getMondayOf, formatTime, dayLabel } from '../utils/dateUtils';
import { VIP_BADGE } from '../utils/styleUtils';

export default function Home() {
  const navigate = useNavigate();
  const { settings } = useClinicSettings();
  const clinicName = settings?.clinic_name || '';

  const todayStr = toDateStr(new Date());
  const weekParam = toDateStr(getMondayOf(new Date()));

  const { data, loading } = useAsync(async () => {
    const [appts, clients, inventory, invoiceStats] = await Promise.all([
      appointmentService.getByWeek(weekParam),
      clientService.getAll(),
      inventoryService.getAll(),
      invoiceService.getStats(),
    ]);
    return { appts, clients, inventory, invoiceStats };
  }, [weekParam]);

  const appointments = data?.appts || [];
  const clientCount = data ? data.clients.length : null;
  const vipCount = data ? data.clients.filter(c => c.is_vip).length : null;
  const monthlySales = data?.invoiceStats?.monthly_sales ?? null;
  const lowStockItems = data
    ? data.inventory.filter(i => i.low_stock_threshold > 0 && i.stock_quantity <= i.low_stock_threshold)
    : [];

  // Filter to today onwards, sort by date + time
  const upcoming = appointments
    .filter(a => a.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

  // Stats
  const todayCount = appointments.filter(a => a.date === todayStr).length;
  const weekCount  = appointments.length;

  // Group by date
  const grouped = {};
  for (const appt of upcoming) {
    (grouped[appt.date] ??= []).push(appt);
  }
  const groupedDates = Object.keys(grouped).sort();

  return (
    <div style={{ maxWidth: 720 }}>
      {clinicName && (
        <div style={{ fontSize: 22, fontWeight: '700', color: 'var(--primary)', marginBottom: 4, fontFamily: 'var(--font-display)' }}>
          {clinicName}
        </div>
      )}
      <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: 30, letterSpacing: '-0.02em' }}>Dashboard</h2>

      {/* Stats cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <StatCard label="Today's Appointments" value={loading ? '—' : todayCount} color="var(--primary)" />
        <StatCard label="This Week" value={loading ? '—' : weekCount} color="#6b8f71" />
        <StatCard label="Total Clients" value={loading ? '—' : clientCount} color="#7a6a5f" />
        <StatCard label="VIP Clients" value={loading ? '—' : vipCount} color="#d6a45c" onClick={() => navigate('/clients?vip=1')} />
      </div>

      {/* Monthly Sales */}
      <div
        onClick={() => navigate('/invoices')}
        style={{
          marginBottom: 32, padding: '24px 32px', borderRadius: 12,
          border: '1px solid #6b8f7122', background: '#6b8f710d',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 13, color: '#7a6a5f', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Monthly Sales</div>
          <div style={{ fontSize: 42, fontWeight: '700', color: '#6b8f71', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
            {loading ? '—' : `₱${(monthlySales ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          </div>
          <div style={{ fontSize: 12, color: '#b8a99e', marginTop: 6 }}>Amount collected this month</div>
        </div>
        <div style={{ fontSize: 36, opacity: 0.15 }}>₱</div>
      </div>

      {/* Low stock alerts */}
      {!loading && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ margin: 0, color: lowStockItems.length > 0 ? '#c97b7b' : '#7a6a5f' }}>
              {lowStockItems.length > 0 ? '⚠ Low Stock Alerts' : 'Low Stock Alerts'}
            </h3>
            <button onClick={() => navigate('/inventory')} style={{ padding: '6px 16px', border: '1px solid #e8dfd6', borderRadius: 8, color: '#7a6a5f', background: '#fff', cursor: 'pointer', fontSize: 13, transition: 'background 0.15s ease' }}>
              View Inventory
            </button>
          </div>
          {lowStockItems.length === 0 ? (
            <div style={{ padding: '14px 16px', border: '1px solid #e8dfd6', borderRadius: 8, color: '#b8a99e', fontSize: 13 }}>
              All stock levels are good.
            </div>
          ) : (
            <div style={{ border: '1px solid #e8dfd6', borderRadius: 8, overflow: 'hidden', background: '#fdf9f5' }}>
              {lowStockItems.map((item, i) => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 20px',
                  borderTop: i > 0 ? '1px solid #e8dfd6' : 'none',
                }}>
                  <div>
                    <span style={{ fontWeight: '600', fontSize: 14 }}>{item.name}</span>
                    {item.category && <span style={{ fontSize: 12, color: '#b8a99e', marginLeft: 8 }}>{item.category}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: '#c97b7b', fontWeight: '600' }}>
                    {item.stock_quantity} {item.unit || ''} left
                    <span style={{ fontSize: 11, color: '#c8bdb7', fontWeight: 'normal', marginLeft: 6 }}>(min {item.low_stock_threshold})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upcoming appointments */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Upcoming This Week</h3>
        <button
          onClick={() => navigate('/calendar')}
          style={{ padding: '6px 16px', border: '1px solid var(--primary)', borderRadius: 8, color: 'var(--primary)', background: '#fff', cursor: 'pointer', fontSize: 13, transition: 'background 0.15s ease' }}
        >
          View Calendar
        </button>
      </div>

      {loading && <p style={{ color: '#b8a99e' }}>Loading…</p>}

      {!loading && upcoming.length === 0 && (
        <div style={{ padding: '32px', textAlign: 'center', color: '#7a6a5f', border: '1px dashed #e8dfd6', borderRadius: 8 }}>
          No upcoming appointments this week.
        </div>
      )}

      {!loading && groupedDates.map(date => (
        <div key={date} style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: '700', fontSize: 13, color: '#7a6a5f', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {dayLabel(date)}
          </div>
          <div style={{ border: '1px solid #e8dfd6', borderRadius: 8, overflow: 'hidden' }}>
            {grouped[date].map((appt, i) => (
              <div
                key={appt.id}
                onClick={() => navigate(`/appointments/${appt.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '14px 20px',
                  borderTop: i > 0 ? '1px solid #e8dfd6' : 'none',
                  cursor: 'pointer',
                  background: '#fff',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                {/* Time */}
                <div style={{ minWidth: 80, fontWeight: '600', fontSize: 14, color: 'var(--primary)' }}>
                  {formatTime(appt.start_time)}
                </div>

                {/* Client + treatments */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: 14 }}>
                    {appt.first_name} {appt.last_name}
                    {appt.is_vip ? VIP_BADGE : null}
                  </div>
                  {appt.therapist && (
                    <div style={{ fontSize: 12, color: '#b8a99e', marginTop: 2 }}>{appt.therapist}</div>
                  )}
                  {appt.treatments && (() => {
                    const parts = appt.treatments.split('\n').filter(Boolean);
                    const label = parts[0] + (parts.length > 1 ? ` +${parts.length - 1}` : '');
                    return <div style={{ fontSize: 12, color: '#7a6a5f', marginTop: 2 }}>{label}</div>;
                  })()}
                </div>

                {/* Duration */}
                <div style={{ fontSize: 12, color: '#b8a99e', whiteSpace: 'nowrap' }}>
                  {appt.duration_minutes} min
                </div>

                {/* Status badge */}
                <ApptStatusBadge status={appt.status} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const STATUS_BADGE_CONFIG = {
  tentative:           { label: 'Tentative',          color: '#7a5c2e', bg: '#fdf3e3', border: '#d6a45c' },
  confirmed:           { label: 'Confirmed',          color: '#3d5c41', bg: '#edf4ee', border: '#6b8f71' },
  confirmed_by_client: { label: 'Client Confirmed',  color: '#3d5c41', bg: '#edf4ee', border: '#6b8f71' },
  done:                { label: 'Done',               color: '#7a6a5f', bg: '#f3eeea', border: '#e8dfd6' },
  cancelled:           { label: 'Cancelled',          color: '#8b3a3a', bg: '#faeaea', border: '#c97b7b' },
  cancelled_by_client: { label: 'Cancelled',          color: '#8b3a3a', bg: '#faeaea', border: '#c97b7b' },
};

function ApptStatusBadge({ status }) {
  const cfg = STATUS_BADGE_CONFIG[status] || STATUS_BADGE_CONFIG.confirmed;
  // Don't show badge for plain "confirmed" — it's the default, no need to clutter
  if (status === 'confirmed') return null;
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

function StatCard({ label, value, color, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: '1 1 160px', padding: '20px 24px', borderRadius: 10,
        border: `1px solid ${color}22`, background: `${color}0d`,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ fontSize: 28, fontWeight: '700', color, fontFamily: 'var(--font-display)' }}>{value}</div>
      <div style={{ fontSize: 13, color: '#7a6a5f', marginTop: 4 }}>{label}</div>
    </div>
  );
}
