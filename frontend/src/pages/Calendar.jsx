import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentService } from '../services/appointmentService';
import { blockedSlotService } from '../services/blockedSlotService';
import { toDateStr, getMondayOf, addDays, timeToMins } from '../utils/dateUtils';

// ── Constants ─────────────────────────────────────────────────
const HOUR_HEIGHT  = 80;                              // px per 1 hour
const SLOT_MINS    = 30;
const SLOT_HEIGHT  = (HOUR_HEIGHT * SLOT_MINS) / 60; // 40px per 30-min slot
const GRID_START   = 8 * 60;                          // 8:00 AM
const GRID_END     = 22 * 60;                         // 10:00 PM
const TOTAL_SLOTS  = (GRID_END - GRID_START) / SLOT_MINS;
const LABEL_W      = 64;
const CARD_GAP     = 5;
const SIDEBAR_W    = 200;
const PAGE_PAD     = 56;
const DAYS_SHORT   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Clinic hours: weekdays open at 11 AM, weekends at 9 AM
function clinicOpensAt(dayIndex) { return dayIndex < 5 ? 11 * 60 : 9 * 60; }

// ── Format helpers ────────────────────────────────────────────
function todayStr() { return toDateStr(new Date()); }

function fmtHourLabel(mins) {
  const h = Math.floor(mins / 60);
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function fmtTime12(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function getEndTimeStr(startTime, durationMinutes) {
  const startMins = timeToMins(startTime);
  const endMins = startMins + durationMinutes;
  const h = Math.floor(endMins / 60) % 24;
  const m = endMins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function fmtDuration(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}hr ${m}min` : `${h}hr`;
}

function fmtShort(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtFull(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function fmtMonthYear(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function jsDayToIndex(jsDay) { return jsDay === 0 ? 6 : jsDay - 1; }

// Pre-built slot metadata (isHour used for grid line weight)
const SLOT_META = Array.from({ length: TOTAL_SLOTS }, (_, i) => ({
  mins: GRID_START + i * SLOT_MINS,
  isHour: (GRID_START + i * SLOT_MINS) % 60 === 0,
}));

// ── Overlap column-layout algorithm ──────────────────────────
// Tags each appt with .col index and returns maxCols for the day
function getColumns(appts) {
  const sorted = [...appts].sort((a, b) => timeToMins(a.start_time) - timeToMins(b.start_time));
  const cols = [], colEnds = [];
  for (const appt of sorted) {
    const start = timeToMins(appt.start_time);
    const end   = start + appt.duration_minutes;
    let placed  = false;
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

// ── AppointmentCard ───────────────────────────────────────────
function AppointmentCard({ appt, top, height, left, width, navigate }) {
  const [hovered, setHovered] = useState(false);
  const endStr = getEndTimeStr(appt.start_time, appt.duration_minutes);
  const treatments = appt.treatments ? appt.treatments.split('\n').filter(Boolean) : [];
  const showDuration = height >= 38;
  const showTreatments = height >= 58 && treatments.length > 0;
  const isTentative = appt.status === 'tentative';

  const tooltipBase = `${appt.first_name} ${appt.last_name}${appt.therapist ? ` · ${appt.therapist}` : ''}${treatments.length ? `\n${treatments.join(', ')}` : ''}`;

  return (
    <div
      title={isTentative ? `[Tentative — not yet confirmed]\n${tooltipBase}` : tooltipBase}
      onClick={e => { e.stopPropagation(); navigate(`/appointments/${appt.id}`); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        top: top + 1,
        left: left + CARD_GAP / 2,
        width: Math.max(0, width - CARD_GAP),
        height: Math.max(0, height - 2),
        background: isTentative
          ? (hovered ? '#b45309' : '#d97706')
          : (hovered ? '#15803d' : '#16a34a'),
        border: isTentative ? '2px dashed rgba(255,255,255,0.6)' : 'none',
        opacity: isTentative ? 0.85 : 1,
        borderRadius: 6,
        padding: '5px 8px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        cursor: 'pointer',
        zIndex: 2,
        color: '#fff',
        lineHeight: 1.35,
        transition: 'background 0.15s ease',
        boxShadow: hovered
          ? (isTentative ? '0 2px 8px rgba(180,83,9,0.3)' : '0 2px 8px rgba(21,128,61,0.3)')
          : '0 1px 2px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {isTentative ? '~ ' : ''}{appt.first_name} {appt.last_name}
      </div>
      {showDuration && (
        <div style={{ fontSize: 11, opacity: 0.88, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fmtDuration(appt.duration_minutes)} · {fmtTime12(appt.start_time)}–{fmtTime12(endStr)}
        </div>
      )}
      {showTreatments && (
        <div style={{ fontSize: 11, opacity: 0.75, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {treatments[0]}{treatments.length > 1 ? ` +${treatments.length - 1}` : ''}
        </div>
      )}
    </div>
  );
}

// ── TimeLabels ────────────────────────────────────────────────
function TimeLabels() {
  return (
    <div style={{ width: LABEL_W, flexShrink: 0 }}>
      {SLOT_META.map((slot, i) => (
        <div key={i} style={{
          height: SLOT_HEIGHT,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          paddingRight: 10,
          marginTop: slot.isHour ? -7 : 0, // nudge label up to align with hour line
          color: '#9ca3af',
          fontSize: 11,
          fontWeight: 500,
          boxSizing: 'border-box',
          userSelect: 'none',
        }}>
          {slot.isHour ? fmtHourLabel(slot.mins) : ''}
        </div>
      ))}
    </div>
  );
}

// ── DayColumn ─────────────────────────────────────────────────
function DayColumn({ dateStr, dayIndex, appts, blocks, colWidth, navigate }) {
  const td = todayStr();
  const opensAt = clinicOpensAt(dayIndex);
  const isPast = dateStr < td;
  const { items: apptCols, maxCols } = getColumns(appts);
  const slotColW = colWidth / maxCols;

  return (
    <div style={{ width: colWidth, borderLeft: '1px solid #e5e7eb', position: 'relative', flexShrink: 0 }}>
      {/* Slot rows */}
      {SLOT_META.map((slot, si) => {
        const outsideHours = slot.mins < opensAt;
        const disabled = outsideHours || isPast;
        return (
          <div
            key={si}
            data-disabled={disabled}
            style={{
              height: SLOT_HEIGHT,
              borderTop: slot.isHour ? '1px solid #e5e7eb' : '1px solid #f3f4f6',
              background: disabled ? '#fdf8f4' : 'transparent',
              cursor: disabled ? 'default' : 'pointer',
              boxSizing: 'border-box',
            }}
            onClick={() => {
              if (!disabled) {
                const h = Math.floor(slot.mins / 60).toString().padStart(2, '0');
                const m = (slot.mins % 60).toString().padStart(2, '0');
                navigate(`/appointments/add?date=${dateStr}&time=${h}:${m}`);
              }
            }}
            onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#fef6ee'; }}
            onMouseLeave={e => { e.currentTarget.style.background = disabled ? '#fdf8f4' : 'transparent'; }}
          />
        );
      })}

      {/* Blocked slots */}
      {blocks.map(b => {
        const top    = ((timeToMins(b.start_time) - GRID_START) / SLOT_MINS) * SLOT_HEIGHT;
        const height = ((timeToMins(b.end_time) - timeToMins(b.start_time)) / SLOT_MINS) * SLOT_HEIGHT;
        return (
          <div key={b.id} style={{
            position: 'absolute', top, left: 0, width: '100%', height,
            background: 'repeating-linear-gradient(45deg,#fde68a,#fde68a 3px,#fef3c7 3px,#fef3c7 10px)',
            borderLeft: '3px solid #f59e0b',
            boxSizing: 'border-box', overflow: 'hidden',
            zIndex: 1, padding: '3px 6px', fontSize: 11, color: '#92400e',
            pointerEvents: 'none',
          }}>
            🔒 {b.reason || 'Blocked'}
          </div>
        );
      })}

      {/* Appointment cards — side-by-side when overlapping */}
      {apptCols.map(appt => {
        const top    = ((timeToMins(appt.start_time) - GRID_START) / SLOT_MINS) * SLOT_HEIGHT;
        const height = (appt.duration_minutes / SLOT_MINS) * SLOT_HEIGHT;
        const left   = appt.col * slotColW;
        return (
          <AppointmentCard
            key={appt.id}
            appt={appt}
            top={top}
            height={height}
            left={left}
            width={slotColW}
            navigate={navigate}
          />
        );
      })}
    </div>
  );
}

// ── DayHeader ─────────────────────────────────────────────────
function DayHeader({ days, apptsByDate }) {
  const td = todayStr();
  return (
    <div style={{ display: 'flex', marginLeft: LABEL_W, borderBottom: '2px solid #e5e7eb' }}>
      {days.map((day, di) => {
        const ds = toDateStr(day);
        const isToday = ds === td;
        const count = (apptsByDate[ds] || []).length;
        const dayIdx = jsDayToIndex(day.getDay());
        return (
          <div key={di} style={{
            flex: 1, textAlign: 'center', padding: '8px 4px 10px',
            borderLeft: '1px solid #e5e7eb',
            background: isToday ? '#fef9f0' : 'transparent',
          }}>
            <div style={{
              fontSize: 11, color: isToday ? '#b45309' : '#6b7280',
              fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              {DAYS_SHORT[dayIdx]}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: '50%', marginTop: 3,
              background: isToday ? '#f59e0b' : 'transparent',
              color: isToday ? '#fff' : '#111827',
              fontSize: 16, fontWeight: isToday ? 700 : 400,
            }}>
              {day.getDate()}
            </div>
            {count > 0 && (
              <div style={{ fontSize: 10, color: isToday ? '#b45309' : '#9ca3af', marginTop: 2, fontWeight: 500 }}>
                {count} appt{count !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── MonthGrid ─────────────────────────────────────────────────
function MonthGrid({ currentDate, apptsByDate, onDayClick }) {
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const td    = todayStr();
  const gridStart = getMondayOf(new Date(year, month, 1));
  const cells     = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <div style={{ marginTop: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '2px solid #e5e7eb' }}>
        {DAYS_SHORT.map(d => (
          <div key={d} style={{
            padding: '8px 0', textAlign: 'center', fontSize: 11,
            fontWeight: 600, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((day, i) => {
          const ds = toDateStr(day);
          const inMonth = day.getMonth() === month;
          const isToday = ds === td;
          const count   = (apptsByDate[ds] || []).length;
          return (
            <div
              key={i}
              onClick={() => onDayClick(day)}
              style={{
                minHeight: 88, padding: '8px 10px',
                border: '1px solid #e5e7eb',
                background: isToday ? '#fef9f0' : '#fff',
                cursor: 'pointer',
                opacity: inMonth ? 1 : 0.3,
              }}
              onMouseEnter={e => { if (inMonth) e.currentTarget.style.background = isToday ? '#fef3c7' : '#fdf8f4'; }}
              onMouseLeave={e => { e.currentTarget.style.background = isToday ? '#fef9f0' : '#fff'; }}
            >
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: '50%',
                background: isToday ? '#f59e0b' : 'transparent',
                color: isToday ? '#fff' : inMonth ? '#111827' : '#9ca3af',
                fontSize: 13, fontWeight: isToday ? 700 : 400,
              }}>
                {day.getDate()}
              </div>
              {count > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: '#f59e0b', color: '#fff',
                  borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 600,
                  marginLeft: 6, verticalAlign: 'middle',
                }}>
                  {count}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── CalendarHeader ────────────────────────────────────────────
function CalendarHeader({
  view, currentDate, weekDays, appointmentCount, loading,
  onPrev, onNext, onToday, onViewChange, onBlockTime,
  searchQuery, setSearchQuery,
}) {
  let periodLabel;
  if (view === 'daily') periodLabel = fmtFull(currentDate);
  else if (view === 'weekly') {
    periodLabel = `${fmtShort(weekDays[0])} – ${fmtShort(weekDays[6])}, ${weekDays[0].getFullYear()}`;
  } else {
    periodLabel = fmtMonthYear(currentDate);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0 14px', borderBottom: '1px solid #e5e7eb',
      marginBottom: 0, gap: 12, flexWrap: 'wrap',
    }}>
      {/* LEFT: Period title + appointment count */}
      <div style={{ minWidth: 200 }}>
        <div style={{ fontSize: 19, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
          {periodLabel}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
          {loading ? 'Loading…' : `${appointmentCount} appointment${appointmentCount !== 1 ? 's' : ''}`}
        </div>
      </div>

      {/* CENTER: Nav + view tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
        {/* Prev / Today / Next */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <NavBtn onClick={onPrev} title="Previous">‹</NavBtn>
          <NavBtn onClick={onToday} wide>Today</NavBtn>
          <NavBtn onClick={onNext} title="Next">›</NavBtn>
        </div>

        {/* View tabs */}
        <div style={{
          display: 'flex', border: '1px solid #e5e7eb', borderRadius: 8,
          overflow: 'hidden', flexShrink: 0,
        }}>
          {[['daily','Day'], ['weekly','Week'], ['monthly','Month']].map(([v, label]) => (
            <ViewTab key={v} label={label} active={view === v} onClick={() => onViewChange(v)} last={v === 'monthly'} />
          ))}
        </div>
      </div>

      {/* RIGHT: Search + block button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <SearchBox value={searchQuery} onChange={setSearchQuery} />
        <BlockBtn onClick={onBlockTime} />
      </div>
    </div>
  );
}

// ── Small reusable header widgets ─────────────────────────────
function NavBtn({ onClick, title, wide, children }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: wide ? '6px 13px' : '6px 11px',
        fontSize: wide ? 13 : 18,
        fontWeight: wide ? 500 : 400,
        cursor: 'pointer',
        border: '1px solid #e5e7eb',
        borderRadius: 7,
        background: hov ? '#f3f4f6' : '#fff',
        color: '#374151',
        lineHeight: 1,
        transition: 'background 0.12s',
      }}
    >
      {children}
    </button>
  );
}

function ViewTab({ label, active, onClick, last }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '6px 14px', fontSize: 13, cursor: 'pointer',
        border: 'none',
        borderRight: last ? 'none' : '1px solid #e5e7eb',
        background: active ? '#fef9f0' : hov ? '#fdf8f4' : '#fff',
        color: active ? '#b45309' : '#374151',
        fontWeight: active ? 600 : 400,
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  );
}

function SearchBox({ value, onChange }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <span style={{
        position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
        color: '#9ca3af', fontSize: 13, pointerEvents: 'none', lineHeight: 1,
      }}>🔍</span>
      <input
        type="text"
        placeholder="Search"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
          fontSize: 13, border: `1px solid ${focused ? '#16a34a' : '#e5e7eb'}`,
          borderRadius: 999, outline: 'none', width: 150,
          color: '#374151', background: '#f9fafb',
          transition: 'border-color 0.15s',
        }}
      />
    </div>
  );
}

function BlockBtn({ onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '7px 14px', fontSize: 12, fontWeight: 600,
        border: '1.5px solid #374151', borderRadius: 7,
        background: hov ? '#f3f4f6' : 'transparent',
        color: '#374151', cursor: 'pointer',
        letterSpacing: '0.04em', whiteSpace: 'nowrap',
        transition: 'background 0.12s',
      }}
    >
      BLOCK OFF TIME
    </button>
  );
}

// ── Main Calendar ─────────────────────────────────────────────
export default function Calendar() {
  const navigate = useNavigate();
  const [view, setView] = useState('weekly');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [appointments, setAppointments] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const weekStart = getMondayOf(currentDate);
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthStr  = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  // Fetch appointments + blocked slots when view or period changes
  useEffect(() => {
    setLoading(true);
    const weekParam  = toDateStr(weekStart);
    const apptP  = view === 'monthly' ? appointmentService.getByMonth(monthStr) : appointmentService.getByWeek(weekParam);
    const blockP = view === 'monthly' ? blockedSlotService.getByMonth(monthStr) : blockedSlotService.getByWeek(weekParam);
    Promise.all([apptP, blockP])
      .then(([appts, blocks]) => { setAppointments(appts); setBlockedSlots(blocks); setLoading(false); })
      .catch(() => setLoading(false));
  }, [view, toDateStr(weekStart), monthStr]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigation
  function prev() {
    if (view === 'daily')       setCurrentDate(d => addDays(d, -1));
    else if (view === 'weekly') setCurrentDate(d => addDays(d, -7));
    else { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); }
  }
  function next() {
    if (view === 'daily')       setCurrentDate(d => addDays(d, 1));
    else if (view === 'weekly') setCurrentDate(d => addDays(d, 7));
    else { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d); }
  }
  function goToday() { setCurrentDate(new Date()); }

  // Group by date
  const apptsByDate = {};
  for (const a of appointments) (apptsByDate[a.date] ??= []).push(a);

  const blocksByDate = {};
  for (const b of blockedSlots) (blocksByDate[b.date] ??= []).push(b);

  // Client-side search filter
  const displayAppts = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return apptsByDate;
    const filtered = {};
    for (const [date, list] of Object.entries(apptsByDate)) {
      const hits = list.filter(a =>
        `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
        (a.treatments || '').toLowerCase().includes(q) ||
        (a.therapist  || '').toLowerCase().includes(q)
      );
      if (hits.length) filtered[date] = hits;
    }
    return filtered;
  })();

  // Column widths
  const available  = windowWidth - SIDEBAR_W - PAGE_PAD - LABEL_W;
  const weekColW   = Math.max(120, Math.floor(available / 7));
  const dailyColW  = Math.max(400, Math.min(800, available));

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: '#111827' }}>
      {/* ── Header ── */}
      <CalendarHeader
        view={view}
        currentDate={currentDate}
        weekDays={weekDays}
        appointmentCount={appointments.length}
        loading={loading}
        onPrev={prev}
        onNext={next}
        onToday={goToday}
        onViewChange={setView}
        onBlockTime={() => navigate('/block-time')}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* ── Weekly view ── */}
      {view === 'weekly' && (
        <div style={{ overflowX: 'auto', marginTop: 0 }}>
          <div style={{ minWidth: LABEL_W + weekColW * 7 }}>
            <DayHeader days={weekDays} apptsByDate={displayAppts} />
            <div style={{ display: 'flex' }}>
              <TimeLabels />
              {weekDays.map((day, di) => (
                <DayColumn
                  key={di}
                  dateStr={toDateStr(day)}
                  dayIndex={di}
                  appts={displayAppts[toDateStr(day)] || []}
                  blocks={blocksByDate[toDateStr(day)] || []}
                  colWidth={weekColW}
                  navigate={navigate}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Daily view ── */}
      {view === 'daily' && (
        <div style={{ overflowX: 'auto', marginTop: 0 }}>
          <div style={{ minWidth: LABEL_W + dailyColW }}>
            <DayHeader days={[currentDate]} apptsByDate={displayAppts} />
            <div style={{ display: 'flex' }}>
              <TimeLabels />
              <DayColumn
                dateStr={toDateStr(currentDate)}
                dayIndex={jsDayToIndex(currentDate.getDay())}
                appts={displayAppts[toDateStr(currentDate)] || []}
                blocks={blocksByDate[toDateStr(currentDate)] || []}
                colWidth={dailyColW}
                navigate={navigate}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Monthly view ── */}
      {view === 'monthly' && (
        <MonthGrid
          currentDate={currentDate}
          apptsByDate={displayAppts}
          onDayClick={date => { setCurrentDate(date); setView('daily'); }}
        />
      )}
    </div>
  );
}
