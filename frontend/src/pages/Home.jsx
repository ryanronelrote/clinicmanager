import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
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
  const tomorrow = toDateStr(new Date(Date.now() + 86400000));
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
  const [loading, setLoading] = useState(true);

  const todayStr = toDateStr(new Date());
  const weekParam = toDateStr(getMondayOf(new Date()));

  useEffect(() => {
    Promise.all([
      fetch(`/appointments?week=${weekParam}`).then(r => r.json()),
      fetch('/clients').then(r => r.json()),
    ]).then(([appts, clients]) => {
      setAppointments(appts);
      setClientCount(clients.length);
      setLoading(false);
    });
  }, []);

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
      <h2 style={{ marginTop: 0, marginBottom: 20 }}>Dashboard</h2>

      {/* Stats cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <StatCard label="Today's Appointments" value={loading ? '—' : todayCount} color="#1a73e8" />
        <StatCard label="This Week" value={loading ? '—' : weekCount} color="#0f9d58" />
        <StatCard label="Total Clients" value={loading ? '—' : clientCount} color="#9c27b0" />
      </div>

      {/* Upcoming appointments */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Upcoming This Week</h3>
        <button
          onClick={() => navigate('/calendar')}
          style={{ padding: '5px 14px', border: '1px solid #1a73e8', borderRadius: 4, color: '#1a73e8', background: '#fff', cursor: 'pointer', fontSize: 13 }}
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
                onMouseEnter={e => e.currentTarget.style.background = '#f8f9ff'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                {/* Time */}
                <div style={{ minWidth: 80, fontWeight: '600', fontSize: 14, color: '#1a73e8' }}>
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

function StatCard({ label, value, color }) {
  return (
    <div style={{
      flex: '1 1 160px', padding: '16px 20px', borderRadius: 10,
      border: `1px solid ${color}22`, background: `${color}0d`,
    }}>
      <div style={{ fontSize: 28, fontWeight: '700', color }}>{value}</div>
      <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>{label}</div>
    </div>
  );
}
