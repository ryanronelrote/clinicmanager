import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Constants ────────────────────────────────────────────────
const SLOT_HEIGHT = 48;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GRID_START = 9 * 60;
const GRID_END   = 22 * 60;
const SLOT_MINS  = 30;
const TOTAL_SLOTS = (GRID_END - GRID_START) / SLOT_MINS;
const APPT_COLORS = ['#4a90d9', '#e07b54', '#6dbf67', '#9b6dbd', '#d4a843'];

// Weekdays open at 11:00, weekends at 09:00
function clinicOpensAt(dayIndex) { return dayIndex < 5 ? 11 * 60 : 9 * 60; }

// ── Helpers ──────────────────────────────────────────────────
function timeToMins(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}
function minsToTime(mins) {
  return `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`;
}
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function today() { return toDateStr(new Date()); }

function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}
function addDays(date, n) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}
function formatShort(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function formatFull(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function formatMonthYear(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
// dayIndex: 0=Mon…6=Sun  (JS getDay: 0=Sun,1=Mon…6=Sat)
function jsDayToIndex(jsDay) { return jsDay === 0 ? 6 : jsDay - 1; }

// ── Column layout for overlapping appointments ───────────────
function getColumns(appts) {
  const sorted = [...appts].sort((a, b) => timeToMins(a.start_time) - timeToMins(b.start_time));
  const cols = [], colEnds = [];
  for (const appt of sorted) {
    const start = timeToMins(appt.start_time);
    const end = start + appt.duration_minutes;
    let placed = false;
    for (let c = 0; c < colEnds.length; c++) {
      if (colEnds[c] <= start) {
        cols.push({ ...appt, col: c });
        colEnds[c] = end;
        placed = true;
        break;
      }
    }
    if (!placed) { cols.push({ ...appt, col: colEnds.length }); colEnds.push(end); }
  }
  return { items: cols, maxCols: colEnds.length || 1 };
}

const timeLabels = Array.from({ length: TOTAL_SLOTS }, (_, i) => minsToTime(GRID_START + i * SLOT_MINS));

// ── Shared time-grid column ──────────────────────────────────
function DayColumn({ dateStr, dayIndex, appts, blocks, colWidth, navigate }) {
  const opensAt = clinicOpensAt(dayIndex);
  const isPast = dateStr < today();
  const { items: apptCols, maxCols } = getColumns(appts);

  return (
    <div style={{ width: colWidth, borderLeft: '1px solid #ddd', position: 'relative', flexShrink: 0 }}>
      {timeLabels.map((label, si) => {
        const slotMins = GRID_START + si * SLOT_MINS;
        const outsideHours = slotMins < opensAt;
        const disabled = outsideHours || isPast;
        return (
          <div
            key={si}
            style={{
              height: SLOT_HEIGHT,
              borderTop: '1px solid #eee',
              background: disabled ? '#f0f0f0' : 'transparent',
              cursor: disabled ? 'default' : 'pointer',
              boxSizing: 'border-box',
            }}
            onClick={() => { if (!disabled) navigate(`/appointments/add?date=${dateStr}&time=${label}`); }}
            onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#f0f7ff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = disabled ? '#f0f0f0' : 'transparent'; }}
          />
        );
      })}

      {blocks.map(b => {
        const top = ((timeToMins(b.start_time) - GRID_START) / SLOT_MINS) * SLOT_HEIGHT;
        const height = ((timeToMins(b.end_time) - timeToMins(b.start_time)) / SLOT_MINS) * SLOT_HEIGHT;
        return (
          <div key={b.id} style={{
            position: 'absolute', top, left: 0, width: '100%', height,
            background: 'repeating-linear-gradient(45deg,#ccc,#ccc 4px,#e8e8e8 4px,#e8e8e8 10px)',
            border: '1px solid #aaa', boxSizing: 'border-box', overflow: 'hidden',
            zIndex: 1, padding: '2px 4px', fontSize: 11, color: '#555', pointerEvents: 'none',
          }}>
            {b.reason || 'Blocked'}
          </div>
        );
      })}

      {apptCols.map((appt, ai) => {
        const top = ((timeToMins(appt.start_time) - GRID_START) / SLOT_MINS) * SLOT_HEIGHT;
        const height = (appt.duration_minutes / SLOT_MINS) * SLOT_HEIGHT;
        const apptWidth = colWidth / maxCols;
        return (
          <div key={appt.id}
            onClick={e => { e.stopPropagation(); navigate(`/appointments/${appt.id}`); }}
            style={{
              position: 'absolute', top: top + 1, left: appt.col * apptWidth + 1,
              width: apptWidth - 3, height: height - 2,
              background: APPT_COLORS[ai % APPT_COLORS.length],
              borderRadius: 4, padding: '3px 5px', boxSizing: 'border-box',
              overflow: 'hidden', cursor: 'pointer', zIndex: 2,
              color: '#fff', fontSize: 11, fontWeight: 'bold', lineHeight: 1.3,
            }}
          >
            <div>{appt.first_name} {appt.last_name}</div>
            {appt.therapist && (
              <div style={{ fontWeight: 'normal', opacity: 0.8, fontSize: 10 }}>{appt.therapist}</div>
            )}
            {appt.treatments && (() => {
              const parts = appt.treatments.split('\n').filter(Boolean);
              const first = parts[0].length > 18 ? parts[0].slice(0, 18) + '…' : parts[0];
              return (
                <div style={{ fontWeight: 'normal', opacity: 0.9 }}>
                  {first}{parts.length > 1 ? ` +${parts.length - 1}` : ''}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Calendar component ──────────────────────────────────
export default function Calendar() {
  const navigate = useNavigate();
  const [view, setView] = useState('weekly');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [appointments, setAppointments] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  // Derived period info
  const weekStart = getMondayOf(currentDate);
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthStr  = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  // Fetch data whenever view or date changes
  useEffect(() => {
    setLoading(true);
    let apptUrl, blockUrl;
    if (view === 'monthly') {
      apptUrl  = `/appointments?month=${monthStr}`;
      blockUrl = `/blocked-slots?month=${monthStr}`;
    } else {
      const weekParam = toDateStr(weekStart);
      apptUrl  = `/appointments?week=${weekParam}`;
      blockUrl = `/blocked-slots?week=${weekParam}`;
    }
    Promise.all([fetch(apptUrl).then(r => r.json()), fetch(blockUrl).then(r => r.json())])
      .then(([appts, blocks]) => { setAppointments(appts); setBlockedSlots(blocks); setLoading(false); });
  }, [view, toDateStr(weekStart), monthStr]);

  // Navigation
  function prev() {
    if (view === 'daily')   setCurrentDate(d => addDays(d, -1));
    else if (view === 'weekly') setCurrentDate(d => addDays(d, -7));
    else { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); }
  }
  function next() {
    if (view === 'daily')   setCurrentDate(d => addDays(d, 1));
    else if (view === 'weekly') setCurrentDate(d => addDays(d, 7));
    else { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d); }
  }
  function goToday() { setCurrentDate(new Date()); }

  // Group by date
  const apptsByDate = {};
  for (const a of appointments) {
    (apptsByDate[a.date] ??= []).push(a);
  }
  const blocksByDate = {};
  for (const b of blockedSlots) {
    (blocksByDate[b.date] ??= []).push(b);
  }

  // Appointment count summary
  function countSummary() {
    const n = appointments.length;
    if (view === 'daily') {
      const ds = toDateStr(currentDate);
      const c = (apptsByDate[ds] || []).length;
      return `${c} appointment${c !== 1 ? 's' : ''} on ${formatFull(currentDate)}`;
    }
    if (view === 'weekly') {
      return `${n} appointment${n !== 1 ? 's' : ''} this week (${formatShort(weekDays[0])} – ${formatShort(weekDays[6])})`;
    }
    return `${n} appointment${n !== 1 ? 's' : ''} in ${formatMonthYear(currentDate)}`;
  }

  // Period label
  function periodLabel() {
    if (view === 'daily')   return formatFull(currentDate);
    if (view === 'weekly')  return `${formatShort(weekDays[0])} – ${formatShort(weekDays[6])}, ${weekDays[0].getFullYear()}`;
    return formatMonthYear(currentDate);
  }

  const labelWidth = 52;
  const weekColWidth = 120;
  const dailyColWidth = 600;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prev} style={btn}>{'<'}</button>
          <button onClick={goToday} style={btn}>Today</button>
          <button onClick={next} style={btn}>{'>'}</button>
          <strong style={{ marginLeft: 8, fontSize: 14 }}>{periodLabel()}</strong>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {['daily', 'weekly', 'monthly'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              ...btn,
              background: view === v ? '#1a73e8' : '#fff',
              color: view === v ? '#fff' : '#333',
              borderColor: view === v ? '#1a73e8' : '#ccc',
              textTransform: 'capitalize',
            }}>{v}</button>
          ))}
          <button onClick={() => navigate('/block-time')} style={{ ...btn, background: '#555', color: '#fff', marginLeft: 8 }}>
            + Block time
          </button>
        </div>
      </div>

      {/* Appointment count banner */}
      <div style={{ marginBottom: 14, padding: '6px 12px', background: '#f0f7ff', borderRadius: 6, fontSize: 13, color: '#1a73e8', display: 'inline-block' }}>
        {loading ? 'Loading…' : countSummary()}
      </div>

      {/* ── WEEKLY VIEW ── */}
      {view === 'weekly' && (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ width: labelWidth + weekColWidth * 7, fontFamily: 'sans-serif', fontSize: 12 }}>
            <div style={{ display: 'flex', marginLeft: labelWidth }}>
              {weekDays.map((day, di) => (
                <div key={di} style={{
                  width: weekColWidth, textAlign: 'center', padding: '4px 0',
                  fontWeight: 'bold', borderLeft: '1px solid #ddd',
                  background: toDateStr(day) === today() ? '#e8f4ff' : '#fafafa',
                }}>
                  {DAYS[di]} {formatShort(day)}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex' }}>
              <TimeLabels />
              {weekDays.map((day, di) => (
                <DayColumn key={di}
                  dateStr={toDateStr(day)}
                  dayIndex={di}
                  appts={apptsByDate[toDateStr(day)] || []}
                  blocks={blocksByDate[toDateStr(day)] || []}
                  colWidth={weekColWidth}
                  navigate={navigate}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── DAILY VIEW ── */}
      {view === 'daily' && (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ width: labelWidth + dailyColWidth, fontFamily: 'sans-serif', fontSize: 12 }}>
            <div style={{ display: 'flex', marginLeft: labelWidth }}>
              <div style={{
                width: dailyColWidth, textAlign: 'center', padding: '4px 0',
                fontWeight: 'bold', borderLeft: '1px solid #ddd',
                background: toDateStr(currentDate) === today() ? '#e8f4ff' : '#fafafa',
              }}>
                {DAYS[jsDayToIndex(currentDate.getDay())]} {formatShort(currentDate)}
              </div>
            </div>
            <div style={{ display: 'flex' }}>
              <TimeLabels />
              <DayColumn
                dateStr={toDateStr(currentDate)}
                dayIndex={jsDayToIndex(currentDate.getDay())}
                appts={apptsByDate[toDateStr(currentDate)] || []}
                blocks={blocksByDate[toDateStr(currentDate)] || []}
                colWidth={dailyColWidth}
                navigate={navigate}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── MONTHLY VIEW ── */}
      {view === 'monthly' && (
        <MonthGrid
          currentDate={currentDate}
          apptsByDate={apptsByDate}
          onDayClick={date => { setCurrentDate(date); setView('daily'); }}
        />
      )}
    </div>
  );
}

// ── Time label column (shared) ───────────────────────────────
function TimeLabels() {
  return (
    <div style={{ width: 52, flexShrink: 0 }}>
      {timeLabels.map((label, i) => (
        <div key={i} style={{
          height: SLOT_HEIGHT, borderTop: '1px solid #eee',
          paddingRight: 6, textAlign: 'right', color: '#888', lineHeight: `${SLOT_HEIGHT}px`, fontSize: 11,
        }}>
          {label.endsWith(':00') ? label : ''}
        </div>
      ))}
    </div>
  );
}

// ── Monthly grid ─────────────────────────────────────────────
function MonthGrid({ currentDate, apptsByDate, onDayClick }) {
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const todayStr = today();

  // First day of month, find its Mon-aligned grid start
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = getMondayOf(firstOfMonth);

  // Build 6-week grid (42 cells)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const cellStyle = (dateStr, inMonth) => ({
    border: '1px solid #eee',
    padding: '6px 8px',
    minHeight: 80,
    background: dateStr === todayStr ? '#e8f4ff' : inMonth ? '#fff' : '#fafafa',
    cursor: 'pointer',
    verticalAlign: 'top',
    opacity: inMonth ? 1 : 0.4,
  });

  return (
    <div style={{ fontFamily: 'sans-serif', fontSize: 13 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            {DAYS.map(d => (
              <th key={d} style={{ padding: '6px 0', textAlign: 'center', color: '#888', fontWeight: '600', fontSize: 12, borderBottom: '2px solid #ddd' }}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, row) => (
            <tr key={row}>
              {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                const ds = toDateStr(day);
                const inMonth = day.getMonth() === month;
                const count = (apptsByDate[ds] || []).length;
                const isPast = ds < todayStr;
                return (
                  <td
                    key={col}
                    style={{
                      ...cellStyle(ds, inMonth),
                      color: isPast && inMonth ? '#aaa' : '#222',
                    }}
                    onClick={() => onDayClick(day)}
                  >
                    <div style={{ fontWeight: ds === todayStr ? 'bold' : 'normal', marginBottom: 4 }}>
                      {day.getDate()}
                    </div>
                    {count > 0 && (
                      <div style={{
                        display: 'inline-block', background: '#1a73e8', color: '#fff',
                        borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 'bold',
                      }}>
                        {count} appt{count !== 1 ? 's' : ''}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const btn = {
  padding: '4px 10px', cursor: 'pointer',
  border: '1px solid #ccc', borderRadius: 4, background: '#fff', fontSize: 13,
};
