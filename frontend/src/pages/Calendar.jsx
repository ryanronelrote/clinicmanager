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

// ── Status indicator colors ───────────────────────────────────
const STATUS_DOT_COLOR = {
  tentative:            '#d6a45c',   // amber
  confirmed:            'rgba(255,255,255,0.85)',  // white
  confirmed_by_client:  '#a8d9b0',   // bright mint
  done:                 '#8B5E3C',   // brown
  cancelled:            '#e07070',   // red
  cancelled_by_client:  '#e07070',   // red
};

// ── AppointmentCard ───────────────────────────────────────────
function AppointmentCard({ appt, top, height, left, width, navigate }) {
  const [hovered, setHovered] = useState(false);
  const endStr = getEndTimeStr(appt.start_time, appt.duration_minutes);
  const treatments = appt.treatments ? appt.treatments.split('\n').filter(Boolean) : [];
  const showDuration = height >= 38;
  const showTreatments = height >= 58 && treatments.length > 0;
  const isTentative = appt.status === 'tentative';
  const isWalkIn = appt.appointment_type === 'walk_in';

  const tooltipBase = `${appt.first_name} ${appt.last_name}${appt.therapist ? ` · ${appt.therapist}` : ''}${treatments.length ? `\n${treatments.join(', ')}` : ''}`;
  const typePrefix = isWalkIn ? '[Walk-in] ' : (isTentative ? '[Tentative — not yet confirmed]\n' : '');

  function cardBg() {
    if (isTentative) return hovered ? '#b8956a' : '#d6a45c';
    if (isWalkIn)    return hovered ? '#4f7a9a' : '#5f8faf';
    return hovered ? '#5a7b60' : '#6b8f71';
  }

  return (
    <div
      title={`${typePrefix}${tooltipBase}`}
      onClick={e => { e.stopPropagation(); navigate(`/appointments/${appt.id}`); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        top: top + 1,
        left: left + CARD_GAP / 2,
        width: Math.max(0, width - CARD_GAP),
        height: Math.max(0, height - 2),
        background: cardBg(),
        border: isTentative ? '2px dashed rgba(255,255,255,0.5)' : 'none',
        opacity: isTentative ? 0.9 : 1,
        borderRadius: 8,
        padding: '5px 8px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        cursor: 'pointer',
        zIndex: 2,
        color: '#fff',
        lineHeight: 1.35,
        transition: 'background 0.15s ease',
        boxShadow: hovered
          ? (isTentative ? '0 2px 8px rgba(214,164,92,0.3)' : isWalkIn ? '0 2px 8px rgba(95,143,175,0.3)' : '0 2px 8px rgba(107,143,113,0.25)')
          : '0 1px 2px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{
        position: 'absolute', top: 5, right: 5,
        width: 8, height: 8, borderRadius: 2,
        background: STATUS_DOT_COLOR[appt.status] || 'rgba(255,255,255,0.8)',
      }} />
      <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>
        {isTentative ? '~ ' : isWalkIn ? '⚡ ' : ''}{appt.first_name} {appt.last_name}
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
          color: '#b8a99e',
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
    <div style={{ width: colWidth, borderLeft: '1px solid #e8dfd6', position: 'relative', flexShrink: 0 }}>
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
              borderTop: slot.isHour ? '1px solid #e8dfd6' : '1px solid #f0e8de',
              background: disabled ? '#f5ede4' : 'transparent',
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
            onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#f0e8de'; }}
            onMouseLeave={e => { e.currentTarget.style.background = disabled ? '#f5ede4' : 'transparent'; }}
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
            background: 'repeating-linear-gradient(45deg,#e8dfd6,#e8dfd6 3px,#f5ede4 3px,#f5ede4 10px)',
            borderLeft: '3px solid #d6a45c',
            boxSizing: 'border-box', overflow: 'hidden',
            zIndex: 1, padding: '3px 6px', fontSize: 11, color: '#7a5c2e',
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
    <div style={{ display: 'flex', marginLeft: LABEL_W, borderBottom: '2px solid #e8dfd6' }}>
      {days.map((day, di) => {
        const ds = toDateStr(day);
        const isToday = ds === td;
        const count = (apptsByDate[ds] || []).length;
        const dayIdx = jsDayToIndex(day.getDay());
        return (
          <div key={di} style={{
            flex: 1, textAlign: 'center', padding: '8px 4px 10px',
            borderLeft: '1px solid #e8dfd6',
            background: isToday ? '#f5ede4' : 'transparent',
          }}>
            <div style={{
              fontSize: 11, color: isToday ? '#7a5c2e' : '#b8a99e',
              fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              {DAYS_SHORT[dayIdx]}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: '50%', marginTop: 3,
              background: isToday ? '#c8a97e' : 'transparent',
              color: isToday ? '#3e2f25' : '#3e2f25',
              fontSize: 16, fontWeight: isToday ? 700 : 400,
            }}>
              {day.getDate()}
            </div>
            {count > 0 && (
              <div style={{ fontSize: 10, color: isToday ? '#7a5c2e' : '#b8a99e', marginTop: 2, fontWeight: 500 }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '2px solid #e8dfd6' }}>
        {DAYS_SHORT.map(d => (
          <div key={d} style={{
            padding: '8px 0', textAlign: 'center', fontSize: 11,
            fontWeight: 600, color: '#b8a99e', letterSpacing: '0.06em', textTransform: 'uppercase',
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
                border: '1px solid #e8dfd6',
                background: isToday ? '#f5ede4' : '#fff',
                cursor: 'pointer',
                opacity: inMonth ? 1 : 0.3,
              }}
              onMouseEnter={e => { if (inMonth) e.currentTarget.style.background = isToday ? '#ede3d8' : '#f0e8de'; }}
              onMouseLeave={e => { e.currentTarget.style.background = isToday ? '#f5ede4' : '#fff'; }}
            >
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: '50%',
                background: isToday ? '#c8a97e' : 'transparent',
                color: isToday ? '#3e2f25' : inMonth ? '#3e2f25' : '#c8bdb7',
                fontSize: 13, fontWeight: isToday ? 700 : 400,
              }}>
                {day.getDate()}
              </div>
              {count > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: '#c8a97e', color: '#3e2f25',
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
      padding: '10px 0 14px', borderBottom: '1px solid #e8dfd6',
      marginBottom: 0, gap: 12, flexWrap: 'wrap',
    }}>
      {/* LEFT: Period title + appointment count */}
      <div style={{ minWidth: 200 }}>
        <div style={{ fontSize: 19, fontWeight: 700, color: '#3e2f25', lineHeight: 1.2, fontFamily: 'var(--font-display)' }}>
          {periodLabel}
        </div>
        <div style={{ fontSize: 12, color: '#7a6a5f', marginTop: 3 }}>
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
          display: 'flex', border: '1px solid #e8dfd6', borderRadius: 8,
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
        border: '1px solid #e8dfd6',
        borderRadius: 8,
        background: hov ? '#f0e8de' : '#fff',
        color: '#3e2f25',
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
        borderRight: last ? 'none' : '1px solid #e8dfd6',
        background: active ? '#f5ede4' : hov ? '#f0e8de' : '#fff',
        color: active ? '#7a5c2e' : '#3e2f25',
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
        color: '#b8a99e', fontSize: 13, pointerEvents: 'none', lineHeight: 1,
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
          fontSize: 13, border: `1px solid ${focused ? '#c8a97e' : '#e8dfd6'}`,
          borderRadius: 999, outline: 'none', width: 150,
          color: '#3e2f25', background: '#fdfaf6',
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
        border: '1.5px solid #e8dfd6', borderRadius: 8,
        background: hov ? '#f0e8de' : 'transparent',
        color: '#7a6a5f', cursor: 'pointer',
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
  const [view, setView] = useState('daily');
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
    <div style={{ fontFamily: 'var(--font-body)', color: '#3e2f25' }}>
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
