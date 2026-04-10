import { useState, useEffect, useRef } from 'react';
import { therapistScheduleService } from '../services/therapistScheduleService';

// ── Shift color system ────────────────────────────────────────
// Colors are stored per shift-type key in localStorage.
// Each entry is a hex bg color; text color is auto-derived from luminance.
// Any unknown shift_type gets a deterministic generated color — future-proof.

const DEFAULT_COLORS = {
  AM:  '#bbf7d0',   // soft green
  PM:  '#bfdbfe',   // soft blue
  OFF: '#e5e7eb',   // light gray
};

const STORAGE_KEY        = 'clinic_shift_colors_v1';
const CUSTOM_SHIFTS_KEY  = 'clinic_custom_shifts_v1';

function loadColors() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...DEFAULT_COLORS, ...stored };
  } catch {
    return { ...DEFAULT_COLORS };
  }
}

function saveColors(c) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

function loadCustomShifts() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_SHIFTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveCustomShifts(arr) {
  localStorage.setItem(CUSTOM_SHIFTS_KEY, JSON.stringify(arr));
}

/** Pick a pleasant auto-color for a new custom shift. */
function autoHexColor(shiftType) {
  const hash = [...shiftType].reduce((a, c) => a + c.charCodeAt(0), 0);
  const palette = ['#fde68a', '#a7f3d0', '#bfdbfe', '#ddd6fe', '#fbcfe8', '#fed7aa', '#cffafe', '#d1fae5'];
  return palette[hash % palette.length];
}

/** Relative luminance (0 = black, 1 = white). */
function luminance(hex) {
  try {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  } catch {
    return 0.5;
  }
}

/** Pick a readable text color for a given bg hex. */
function textFor(bg) {
  if (typeof bg !== 'string' || !bg.startsWith('#')) return '#374151';
  return luminance(bg) > 0.55 ? '#374151' : '#ffffff';
}

/** Generate a stable color for unknown shift types. */
function autoColor(shiftType) {
  const hash = [...shiftType].reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = (hash * 67) % 360;
  return `hsl(${hue}, 55%, 83%)`;
}

/** Returns { bg, text } for a given shiftType + color config. */
function shiftColors(colorMap, shiftType) {
  if (!shiftType) return { bg: 'transparent', text: 'transparent' };
  const bg = colorMap[shiftType] ?? autoColor(shiftType);
  return { bg, text: textFor(typeof bg === 'string' && bg.startsWith('#') ? bg : '#cccccc') };
}

// ── Date helpers ──────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toMonthStr(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// ── Component ─────────────────────────────────────────────────

const PRESET_SHIFTS = ['AM', 'PM', 'OFF'];

export default function TherapistSchedule() {
  const todayFull = new Date().toISOString().slice(0, 10);
  const now = new Date();

  const [curYear,  setCurYear]  = useState(now.getFullYear());
  const [curMonth, setCurMonth] = useState(now.getMonth()); // 0-indexed

  const [therapists,   setTherapists]   = useState([]);
  const [scheduleMap,  setScheduleMap]  = useState({}); // `${tid}-${date}` → shift_type
  const [loading,      setLoading]      = useState(true);

  const [activeCell,   setActiveCell]   = useState(null); // { therapistId, date, x, y }
  const [colorMap,     setColorMap]     = useState(loadColors);
  const [showColors,   setShowColors]   = useState(false);
  const [customShifts, setCustomShifts] = useState(loadCustomShifts);
  const [newShiftName, setNewShiftName] = useState('');

  const [newName,      setNewName]      = useState('');
  const [savingName,   setSavingName]   = useState(false);

  const popupRef = useRef(null);

  // All shift types available in the selector (preset + user-defined)
  const allShifts = [...PRESET_SHIFTS, ...customShifts];

  const monthStr  = toMonthStr(curYear, curMonth);
  const numDays   = daysInMonth(curYear, curMonth);

  // Pre-compute day metadata once per month render
  const dayMeta = Array.from({ length: numDays }, (_, i) => {
    const day = i + 1;
    const ds  = toDateStr(curYear, curMonth, day);
    const dow = new Date(ds + 'T00:00:00').getDay();
    return { day, ds, dow, isToday: ds === todayFull, isWeekend: dow === 0 || dow === 6 };
  });

  // ── Load data ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { therapists: tList, schedules } = await therapistScheduleService.getMonthly(monthStr);
        if (cancelled) return;
        setTherapists(tList);
        const map = {};
        for (const s of schedules) map[`${s.therapist_id}-${s.date}`] = s.shift_type;
        setScheduleMap(map);
      } catch (e) {
        console.error('[TherapistSchedule] load error:', e);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [monthStr]);

  // ── Navigation ──────────────────────────────────────────────
  function prev() {
    if (curMonth === 0) { setCurYear(y => y - 1); setCurMonth(11); }
    else setCurMonth(m => m - 1);
  }
  function next() {
    if (curMonth === 11) { setCurYear(y => y + 1); setCurMonth(0); }
    else setCurMonth(m => m + 1);
  }

  // ── Cell click ──────────────────────────────────────────────
  function handleCellClick(therapistId, date, e) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    // Show popup below the cell, clamped to viewport
    const x = Math.min(rect.left, window.innerWidth - 165);
    const popupH = allShifts.length * 38 + 48; // approximate
    const y = rect.bottom + 6 + popupH > window.innerHeight
      ? rect.top - popupH - 4
      : rect.bottom + 4;
    setActiveCell({ therapistId, date, x, y });
  }

  // ── Assign shift (optimistic) ───────────────────────────────
  async function assignShift(shiftType) {
    const { therapistId, date } = activeCell;
    const key = `${therapistId}-${date}`;

    setScheduleMap(prev => {
      const next = { ...prev };
      if (shiftType === null) delete next[key]; else next[key] = shiftType;
      return next;
    });
    setActiveCell(null);

    try {
      if (shiftType === null) {
        await therapistScheduleService.remove(therapistId, date);
      } else {
        await therapistScheduleService.upsert({ therapist_id: therapistId, date, shift_type: shiftType });
      }
    } catch (e) {
      console.error('[TherapistSchedule] upsert error:', e);
      // Rollback: re-fetch schedules for the month
      try {
        const { schedules } = await therapistScheduleService.getMonthly(monthStr);
        const map = {};
        for (const s of schedules) map[`${s.therapist_id}-${s.date}`] = s.shift_type;
        setScheduleMap(map);
      } catch {}
    }
  }

  // ── Close popup on outside click ────────────────────────────
  useEffect(() => {
    if (!activeCell) return;
    function handler(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) setActiveCell(null);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeCell]);

  // ── Color management ────────────────────────────────────────
  function updateColor(shiftType, newColor) {
    const updated = { ...colorMap, [shiftType]: newColor };
    setColorMap(updated);
    saveColors(updated);
  }

  function resetColors() {
    setColorMap({ ...DEFAULT_COLORS });
    saveColors(DEFAULT_COLORS);
  }

  function addCustomShift() {
    const name = newShiftName.trim().toUpperCase();
    if (!name || allShifts.includes(name)) return;
    const updated = [...customShifts, name];
    setCustomShifts(updated);
    saveCustomShifts(updated);
    // Auto-assign a color if none exists yet
    if (!colorMap[name]) updateColor(name, autoHexColor(name));
    setNewShiftName('');
  }

  function removeCustomShift(name) {
    const updated = customShifts.filter(s => s !== name);
    setCustomShifts(updated);
    saveCustomShifts(updated);
  }

  // ── Therapist management ─────────────────────────────────────
  async function handleAddTherapist() {
    const name = newName.trim();
    if (!name) return;
    setSavingName(true);
    try {
      const t = await therapistScheduleService.addTherapist(name);
      setTherapists(prev => [...prev, t].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
    } catch (e) {
      console.error(e);
    }
    setSavingName(false);
  }

  async function handleRemoveTherapist(id, name) {
    if (!confirm(`Remove "${name}" from the schedule? All their shift assignments will be deleted.`)) return;
    try {
      await therapistScheduleService.removeTherapist(id);
      setTherapists(prev => prev.filter(t => t.id !== id));
      setScheduleMap(prev => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (k.startsWith(`${id}-`)) delete next[k];
        }
        return next;
      });
    } catch (e) {
      console.error(e);
    }
  }

  // ── All unique shift types in current view (for legend) ─────
  const visibleShifts = [
    ...new Set([...allShifts, ...Object.values(scheduleMap)]),
  ];

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: '#111827' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Shift Schedule</h2>
          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Click any cell to assign a shift</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={prev} style={NAV_BTN}>‹</button>
          <span style={{ fontWeight: 700, fontSize: 17, minWidth: 170, textAlign: 'center' }}>
            {MONTH_NAMES[curMonth]} {curYear}
          </span>
          <button onClick={next} style={NAV_BTN}>›</button>
          <button
            onClick={() => setShowColors(v => !v)}
            style={{ ...NAV_BTN, padding: '6px 12px', fontSize: 13, marginLeft: 6, background: showColors ? '#fef9f0' : '#fff', color: showColors ? '#b45309' : '#374151' }}
          >
            🎨 Colors
          </button>
        </div>
      </div>

      {/* ── Color config panel ── */}
      {showColors && (
        <div style={{
          marginBottom: 16, padding: '14px 18px',
          border: '1px solid #e5e7eb', borderRadius: 10,
          background: '#fafafa',
        }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Shift types:</span>

            {/* All shifts — preset (no delete) + custom (with delete) */}
            {allShifts.map(shift => {
              const { bg, text } = shiftColors(colorMap, shift);
              const isCustom = !PRESET_SHIFTS.includes(shift);
              return (
                <div key={shift} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="color"
                      value={colorMap[shift] || '#e5e7eb'}
                      onChange={e => updateColor(shift, e.target.value)}
                      style={{ width: 30, height: 30, padding: 0, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}
                      title={`Change color for ${shift}`}
                    />
                    <span style={{ background: bg, color: text, padding: '3px 12px', borderRadius: 6, fontWeight: 700, fontSize: 13 }}>
                      {shift}
                    </span>
                  </label>
                  {isCustom && (
                    <button
                      onClick={() => removeCustomShift(shift)}
                      title={`Remove ${shift} shift`}
                      style={{ fontSize: 13, color: '#d1d5db', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
                      onMouseEnter={e => e.currentTarget.style.color = '#cc3333'}
                      onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}
                    >×</button>
                  )}
                </div>
              );
            })}

            <button
              onClick={resetColors}
              style={{ fontSize: 12, color: '#888', background: 'none', border: '1px solid #ddd', borderRadius: 5, padding: '4px 10px', cursor: 'pointer' }}
            >
              Reset colors
            </button>
          </div>

          {/* Add custom shift */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
            <span style={{ fontSize: 12, color: '#888' }}>Add custom shift:</span>
            <input
              type="text"
              placeholder="e.g. NIGHT"
              value={newShiftName}
              onChange={e => setNewShiftName(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && addCustomShift()}
              maxLength={12}
              style={{ padding: '5px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, width: 110 }}
            />
            <button
              onClick={addCustomShift}
              disabled={!newShiftName.trim() || allShifts.includes(newShiftName.trim().toUpperCase())}
              style={{
                padding: '5px 14px', fontSize: 13, fontWeight: 600,
                background: 'var(--primary)', color: '#fff',
                border: 'none', borderRadius: 6, cursor: 'pointer',
                opacity: !newShiftName.trim() || allShifts.includes(newShiftName.trim().toUpperCase()) ? 0.5 : 1,
              }}
            >
              + Add
            </button>
            {allShifts.includes(newShiftName.trim().toUpperCase()) && newShiftName.trim() && (
              <span style={{ fontSize: 12, color: '#e07b54' }}>Already exists</span>
            )}
          </div>
        </div>
      )}

      {/* ── Grid ── */}
      {loading ? (
        <p style={{ color: '#888', padding: '32px 0' }}>Loading…</p>
      ) : therapists.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#aaa', border: '1px dashed #ddd', borderRadius: 10 }}>
          No therapists yet. Add one below to get started.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: '100%', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 150 }} />
              {dayMeta.map(({ day }) => <col key={day} style={{ width: 46 }} />)}
            </colgroup>

            {/* Header row */}
            <thead>
              <tr>
                <th style={{ ...TH, position: 'sticky', left: 0, zIndex: 3, background: '#f9fafb', textAlign: 'left', paddingLeft: 14, borderRight: '2px solid #e5e7eb' }}>
                  Therapist
                </th>
                {dayMeta.map(({ day, dow, isToday, isWeekend, ds }) => (
                  <th key={day} style={{
                    ...TH,
                    background: isToday ? '#fef9f0' : isWeekend ? '#fafafa' : '#f9fafb',
                    color:      isToday ? '#b45309' : isWeekend ? '#9ca3af' : '#6b7280',
                    borderBottom: isToday ? '3px solid #f59e0b' : '2px solid #e5e7eb',
                    fontWeight: isToday ? 700 : 500,
                  }}>
                    <div style={{ fontSize: 10, lineHeight: 1.2 }}>{DAY_ABBR[dow]}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.4 }}>{day}</div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Therapist rows */}
            <tbody>
              {therapists.map((t, ti) => {
                const rowBg = ti % 2 === 0 ? '#ffffff' : '#fafafa';
                return (
                  <tr key={t.id}>
                    {/* Sticky name cell */}
                    <td style={{
                      position: 'sticky', left: 0, zIndex: 2,
                      background: rowBg,
                      borderRight: '2px solid #e5e7eb',
                      borderTop: '1px solid #f0f0f0',
                      padding: '0 8px 0 14px',
                      height: 40,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.name}
                        </span>
                        <button
                          onClick={() => handleRemoveTherapist(t.id, t.name)}
                          style={{ fontSize: 14, color: '#d1d5db', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
                          onMouseEnter={e => e.currentTarget.style.color = '#cc3333'}
                          onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}
                          title="Remove therapist"
                        >×</button>
                      </div>
                    </td>

                    {/* Day cells */}
                    {dayMeta.map(({ day, ds, isToday, isWeekend }) => {
                      const key   = `${t.id}-${ds}`;
                      const shift = scheduleMap[key];
                      const { bg: shiftBg, text: shiftText } = shift ? shiftColors(colorMap, shift) : {};
                      const baseBg = isToday ? '#fefdf8' : isWeekend ? '#fdf8f4' : rowBg;

                      return (
                        <td
                          key={day}
                          onClick={e => handleCellClick(t.id, ds, e)}
                          style={{
                            height: 40,
                            padding: 3,
                            borderLeft: '1px solid #f0f0f0',
                            borderTop: '1px solid #f0f0f0',
                            cursor: 'pointer',
                            background: baseBg,
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = shift ? baseBg : '#fef3c7'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = baseBg; }}
                        >
                          {shift && (
                            <div style={{
                              height: '100%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: shiftBg,
                              color: shiftText,
                              borderRadius: 5,
                              fontSize: 11, fontWeight: 700,
                              letterSpacing: '0.04em',
                              userSelect: 'none',
                            }}>
                              {shift}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Shift selector popup ── */}
      {activeCell && (
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            left: activeCell.x,
            top: activeCell.y,
            zIndex: 1000,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
            padding: 6,
            minWidth: 130,
          }}
        >
          {allShifts.map(shift => {
            const { bg, text } = shiftColors(colorMap, shift);
            const isActive = scheduleMap[`${activeCell.therapistId}-${activeCell.date}`] === shift;
            return (
              <button
                key={shift}
                onClick={() => assignShift(shift)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: bg, color: text,
                  border: isActive ? `2px solid ${text}` : '2px solid transparent',
                  borderRadius: 6, padding: '7px 14px',
                  fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', marginBottom: 3,
                  transition: 'opacity 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                {shift}{isActive && ' ✓'}
              </button>
            );
          })}
          <div style={{ height: 1, background: '#f0f0f0', margin: '4px 0' }} />
          <button
            onClick={() => assignShift(null)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: 'none', border: 'none', color: '#9ca3af',
              fontSize: 12, padding: '5px 14px', cursor: 'pointer', borderRadius: 5,
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#cc3333'}
            onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Add therapist ── */}
      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="text"
          placeholder="New therapist name…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddTherapist()}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 7, fontSize: 13, width: 220 }}
        />
        <button
          onClick={handleAddTherapist}
          disabled={!newName.trim() || savingName}
          style={{
            padding: '8px 18px', fontSize: 13, fontWeight: 600,
            background: 'var(--primary)', color: '#fff',
            border: 'none', borderRadius: 7, cursor: 'pointer',
            opacity: !newName.trim() || savingName ? 0.6 : 1,
          }}
        >
          {savingName ? 'Adding…' : '+ Add Therapist'}
        </button>
      </div>

      {/* ── Legend ── */}
      {!loading && (
        <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>Legend:</span>
          {visibleShifts.map(shift => {
            const { bg, text } = shiftColors(colorMap, shift);
            return (
              <span key={shift} style={{ background: bg, color: text, padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                {shift}
              </span>
            );
          })}
          <span style={{ fontSize: 12, color: '#d1d5db', marginLeft: 6 }}>· 🎨 click Colors to customize</span>
        </div>
      )}
    </div>
  );
}

// ── Static styles ─────────────────────────────────────────────

const NAV_BTN = {
  padding: '6px 13px', fontSize: 18, cursor: 'pointer',
  border: '1px solid #e5e7eb', borderRadius: 7,
  background: '#fff', color: '#374151', lineHeight: 1,
  transition: 'background 0.12s',
};

const TH = {
  padding: '6px 2px', textAlign: 'center',
  borderBottom: '2px solid #e5e7eb',
  fontSize: 12, fontWeight: 600,
  userSelect: 'none', whiteSpace: 'nowrap',
};
