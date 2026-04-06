import { authFetch } from '../authFetch';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

function formatTime(str) {
  const [h, m] = str.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function dayLabel(dateStr) {
  const today = toDateStr(new Date());
  const tomorrow = toDateStr(new Date(new Date().setDate(new Date().getDate() + 1)));
  const date = new Date(dateStr + 'T00:00:00');
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  if (dateStr === today) return `Today — ${weekday}`;
  if (dateStr === tomorrow) return `Tomorrow — ${weekday}`;
  return weekday;
}

const VIP_BADGE = (
  <span style={{
    display: 'inline-block', background: '#fbbf24', color: '#78350f',
    borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: '700',
    marginLeft: 6, verticalAlign: 'middle',
  }}>
    ★ VIP
  </span>
);

export default function Home() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [clientCount, setClientCount] = useState(null);
  const [vipCount, setVipCount] = useState(null);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [clinicName, setClinicName] = useState('');
  const [loading, setLoading] = useState(true);

  const todayStr = toDateStr(new Date());
  const weekParam = toDateStr(getMondayOf(new Date()));

  useEffect(() => {
    Promise.all([
      authFetch(`/appointments?week=${weekParam}`).then(r => r.json()),
      authFetch('/clients').then(r => r.json()),
      authFetch('/inventory').then(r => r.json()),
      authFetch('/settings').then(r => r.json()),
    ]).then(([appts, clients, inventory, settings]) => {
      setAppointments(appts);
      setClientCount(clients.length);
      setVipCount(clients.filter(c => c.is_vip).length);
      setLowStockItems(inventory.filter(i => i.low_stock_threshold > 0 && i.stock_quantity <= i.low_stock_threshold));
      setClinicName(settings.clinic_name || '');
      setLoading(false);
    });
  }, [weekParam]);

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
        <div style={{ fontSize: 22, fontWeight: '700', color: 'var(--primary)', marginBottom: 4 }}>
          {clinicName}
        </div>
      )}
      <h2 style={{ marginTop: 0, marginBottom: 20 }}>Dashboard</h2>

      {/* Stats cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <StatCard label="Today's Appointments" value={loading ? '—' : todayCount} color="var(--primary)" />
        <StatCard label="This Week" value={loading ? '—' : weekCount} color="#0f9d58" />
        <StatCard label="Total Clients" value={loading ? '—' : clientCount} color="#9c27b0" />
        <StatCard label="VIP Clients" value={loading ? '—' : vipCount} color="#f59e0b" onClick={() => navigate('/clients?vip=1')} />
      </div>

      {/* Low stock alerts */}
      {!loading && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ margin: 0, color: lowStockItems.length > 0 ? '#e07b54' : '#555' }}>
              {lowStockItems.length > 0 ? '⚠ Low Stock Alerts' : 'Low Stock Alerts'}
            </h3>
            <button onClick={() => navigate('/inventory')} style={{ padding: '5px 14px', border: '1px solid #ccc', borderRadius: 4, color: '#555', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
              View Inventory
            </button>
          </div>
          {lowStockItems.length === 0 ? (
            <div style={{ padding: '14px 16px', border: '1px solid #eee', borderRadius: 8, color: '#aaa', fontSize: 13 }}>
              All stock levels are good.
            </div>
          ) : (
            <div style={{ border: '1px solid #fcd9c8', borderRadius: 8, overflow: 'hidden', background: '#fff8f4' }}>
              {lowStockItems.map((item, i) => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderTop: i > 0 ? '1px solid #fcd9c8' : 'none',
                }}>
                  <div>
                    <span style={{ fontWeight: '600', fontSize: 14 }}>{item.name}</span>
                    {item.category && <span style={{ fontSize: 12, color: '#aaa', marginLeft: 8 }}>{item.category}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: '#e07b54', fontWeight: '600' }}>
                    {item.stock_quantity} {item.unit || ''} left
                    <span style={{ fontSize: 11, color: '#bbb', fontWeight: 'normal', marginLeft: 6 }}>(min {item.low_stock_threshold})</span>
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
          style={{ padding: '5px 14px', border: '1px solid var(--primary)', borderRadius: 4, color: 'var(--primary)', background: '#fff', cursor: 'pointer', fontSize: 13 }}
        >
          View Calendar
        </button>
      </div>

      {loading && <p style={{ color: '#888' }}>Loading…</p>}

      {!loading && upcoming.length === 0 && (
        <div style={{ padding: '32px', textAlign: 'center', color: '#888', border: '1px dashed #ddd', borderRadius: 8 }}>
          No upcoming appointments this week.
        </div>
      )}

      {!loading && groupedDates.map(date => (
        <div key={date} style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: '700', fontSize: 13, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {dayLabel(date)}
          </div>
          <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
            {grouped[date].map((appt, i) => (
              <div
                key={appt.id}
                onClick={() => navigate(`/appointments/${appt.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '12px 16px',
                  borderTop: i > 0 ? '1px solid #f0f0f0' : 'none',
                  cursor: 'pointer',
                  background: '#fff',
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
                    <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{appt.therapist}</div>
                  )}
                  {appt.treatments && (() => {
                    const parts = appt.treatments.split('\n').filter(Boolean);
                    const label = parts[0] + (parts.length > 1 ? ` +${parts.length - 1}` : '');
                    return <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{label}</div>;
                  })()}
                </div>

                {/* Duration */}
                <div style={{ fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' }}>
                  {appt.duration_minutes} min
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, color, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: '1 1 160px', padding: '16px 20px', borderRadius: 10,
        border: `1px solid ${color}22`, background: `${color}0d`,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ fontSize: 28, fontWeight: '700', color }}>{value}</div>
      <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>{label}</div>
    </div>
  );
}
