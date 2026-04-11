import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { getKpi } from '../services/dashboardService';

const MANILA_TZ = 'Asia/Manila';

function getManilaTodayString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: MANILA_TZ });
}

function ymdFromParts(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d, 4, 0, 0));
}

function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

function formatYmdParts(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function addDaysStr(ymdStr, delta) {
  const { y, m, d } = parseYmd(ymdStr);
  const t = ymdFromParts(y, m, d).getTime() + delta * 86400000;
  const x = new Date(t);
  return formatYmdParts(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate());
}

function manilaWeekday(ymdStr) {
  const { y, m, d } = parseYmd(ymdStr);
  return ymdFromParts(y, m, d).getUTCDay();
}

function startOfIsoWeekMonday(ymdStr) {
  const dow = manilaWeekday(ymdStr);
  const offset = (dow + 6) % 7;
  return addDaysStr(ymdStr, -offset);
}

function endOfIsoWeekSunday(mondayStr) {
  return addDaysStr(mondayStr, 6);
}

function firstOfMonth(ymdStr) {
  const { y, m } = parseYmd(ymdStr);
  return formatYmdParts(y, m, 1);
}

function lastOfMonth(ymdStr) {
  const { y, m } = parseYmd(ymdStr);
  const last = new Date(Date.UTC(y, m, 0, 4, 0, 0)).getUTCDate();
  return formatYmdParts(y, m, last);
}

function presetRange(preset, todayStr) {
  if (preset === 'today') return { start: todayStr, end: todayStr };
  if (preset === 'week') {
    const mon = startOfIsoWeekMonday(todayStr);
    return { start: mon, end: endOfIsoWeekSunday(mon) };
  }
  if (preset === 'month') {
    return { start: firstOfMonth(todayStr), end: lastOfMonth(todayStr) };
  }
  return { start: todayStr, end: todayStr };
}

const moneyFmt = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
const moneyFmtFine = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatChange(cur, prev) {
  if (prev === 0 && cur === 0) return { label: 'No prior data', tone: 'neutral' };
  if (prev === 0) return { label: 'New vs prior period', tone: 'up' };
  const pct = ((cur - prev) / prev) * 100;
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return {
    label: `${sign}${rounded}% vs prior period`,
    tone: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral',
  };
}

const toneColor = {
  up: '#0d7a4f',
  down: '#b42318',
  neutral: '#6b7280',
};

const pillBase = {
  border: 'none',
  borderRadius: 999,
  padding: '8px 16px',
  fontSize: 13,
  fontFamily: 'var(--font-body)',
  cursor: 'pointer',
  transition: 'background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
};

function KpiCard({ title, valueDisplay, change, loading }) {
  return (
    <div
      style={{
        background: 'var(--card-bg)',
        borderRadius: 14,
        padding: '22px 24px',
        border: '1px solid var(--sidebar-border)',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
        minWidth: 0,
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        opacity: loading ? 0.72 : 1,
        transform: loading ? 'translateY(2px)' : 'none',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--label-color)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        {title}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32,
          fontWeight: 700,
          color: 'var(--text-primary)',
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
        }}
      >
        {valueDisplay}
      </div>
      <div style={{ marginTop: 10, fontSize: 13, fontWeight: 500, color: toneColor[change.tone] }}>
        {change.label}
      </div>
    </div>
  );
}

function tableShellStyle() {
  return {
    background: 'var(--card-bg)',
    borderRadius: 14,
    border: '1px solid var(--sidebar-border)',
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
  };
}

function thStyle() {
  return {
    textAlign: 'left',
    padding: '12px 16px',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--label-color)',
    borderBottom: '1px solid var(--sidebar-border)',
    background: 'var(--page-bg)',
  };
}

function tdStyle() {
  return {
    padding: '12px 16px',
    fontSize: 14,
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--sidebar-border)',
  };
}

function exportDailyCsv(dailyBreakdown, filename) {
  const headers = ['date', 'revenue', 'appointments'];
  const escape = (v) => {
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.join(','),
    ...dailyBreakdown.map((r) => [escape(r.date), escape(r.revenue), escape(r.appointments)].join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Dashboard() {
  const todayStr = useMemo(() => getManilaTodayString(), []);
  const [preset, setPreset] = useState('month');
  const [customStart, setCustomStart] = useState(() => firstOfMonth(todayStr));
  const [customEnd, setCustomEnd] = useState(() => todayStr);
  const [startDate, setStartDate] = useState(() => presetRange('month', todayStr).start);
  const [endDate, setEndDate] = useState(() => presetRange('month', todayStr).end);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  const applyPreset = useCallback((p) => {
    const t = getManilaTodayString();
    if (p === 'custom') {
      setPreset('custom');
      setCustomStart(startDate);
      setCustomEnd(endDate);
      return;
    }
    setPreset(p);
    const r = presetRange(p, t);
    setStartDate(r.start);
    setEndDate(r.end);
  }, [startDate, endDate]);

  useEffect(() => {
    if (preset !== 'custom') return;
    if (customStart && customEnd && customStart <= customEnd) {
      setStartDate(customStart);
      setEndDate(customEnd);
    }
  }, [preset, customStart, customEnd]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await getKpi({ startDate, endDate });
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, reloadTick]);

  function refreshDashboard() {
    const t = getManilaTodayString();
    if (preset !== 'custom') {
      const r = presetRange(preset, t);
      setStartDate(r.start);
      setEndDate(r.end);
    }
    setReloadTick((n) => n + 1);
  }

  const revChange = data ? formatChange(data.totalRevenue, data.previousRevenue) : { label: '—', tone: 'neutral' };
  const apptChange = data ? formatChange(data.appointmentCount, data.previousAppointmentCount) : { label: '—', tone: 'neutral' };
  const avgCur = data?.avgRevenue;
  const avgPrev = data?.previousAvgRevenue;
  const avgChange =
    avgCur != null && avgPrev != null ? formatChange(avgCur, avgPrev) : { label: '—', tone: 'neutral' };

  const hasSeriesActivity =
    data &&
    (data.dailyBreakdown.some((d) => d.revenue > 0) || data.dailyBreakdown.some((d) => d.appointments > 0));

  const chartData = data?.dailyBreakdown.map((d) => ({
    ...d,
    short: d.date.slice(5),
  }));

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto' }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 34, color: 'var(--text-primary)' }}>Sales KPIs</h1>
        <p style={{ margin: '10px 0 0', fontSize: 15, color: 'var(--label-color)', maxWidth: 560, lineHeight: 1.5 }}>
          Revenue from paid invoice amounts, appointment volume, and performance by treatment and therapist. Revenue and treatments use each invoice’s{' '}
          <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>invoice date</strong>; appointment metrics use scheduled appointment dates.
        </p>
      </header>

      <section
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          { id: 'today', label: 'Today' },
          { id: 'week', label: 'This week' },
          { id: 'month', label: 'This month' },
          { id: 'custom', label: 'Custom' },
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p.id)}
            style={{
              ...pillBase,
              background: preset === p.id ? 'var(--primary)' : 'var(--card-bg)',
              color: preset === p.id ? '#fff' : 'var(--text-primary)',
              border: preset === p.id ? 'none' : '1px solid var(--input-border)',
              boxShadow: preset === p.id ? '0 2px 8px rgba(26, 115, 232, 0.25)' : 'none',
            }}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              style={{
                border: '1px solid var(--input-border)',
                borderRadius: 8,
                padding: '8px 12px',
                background: 'var(--card-bg)',
                color: 'var(--text-primary)',
              }}
            />
            <span style={{ color: 'var(--label-color)' }}>to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              style={{
                border: '1px solid var(--input-border)',
                borderRadius: 8,
                padding: '8px 12px',
                background: 'var(--card-bg)',
                color: 'var(--text-primary)',
              }}
            />
          </span>
        )}
        <button
          type="button"
          onClick={refreshDashboard}
          style={{
            ...pillBase,
            marginLeft: 'auto',
            background: 'transparent',
            color: 'var(--primary)',
            border: '1px solid var(--primary)',
          }}
        >
          Refresh
        </button>
      </section>

      <p style={{ fontSize: 13, color: 'var(--label-color)', margin: '-12px 0 20px' }}>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          {startDate} — {endDate}
        </span>
        {data?.meta && (
          <>
            {' · '}
            Compared to <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{data.meta.previousStart}</span> —{' '}
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{data.meta.previousEnd}</span>
          </>
        )}
      </p>

      {error && (
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            background: '#fef2f2',
            color: '#b42318',
            marginBottom: 20,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 18,
          marginBottom: 28,
        }}
      >
        <KpiCard
          title="Total revenue"
          valueDisplay={data ? moneyFmt.format(data.totalRevenue) : '—'}
          change={revChange}
          loading={loading}
        />
        <KpiCard
          title="Appointments"
          valueDisplay={data ? String(data.appointmentCount) : '—'}
          change={apptChange}
          loading={loading}
        />
        <KpiCard
          title="Avg revenue / appointment"
          valueDisplay={data && data.avgRevenue != null ? moneyFmtFine.format(data.avgRevenue) : '—'}
          change={avgChange}
          loading={loading}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 22, marginBottom: 28 }}>
        <div style={tableShellStyle()}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--sidebar-border)' }}>
            <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-primary)' }}>Revenue over time</h2>
          </div>
          <div style={{ height: 280, padding: '8px 12px 16px' }}>
            {!data || !hasSeriesActivity ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--label-color)', fontSize: 14 }}>
                No revenue in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--sidebar-border)" vertical={false} />
                  <XAxis dataKey="short" tick={{ fontSize: 11, fill: 'var(--label-color)' }} axisLine={{ stroke: 'var(--sidebar-border)' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--label-color)' }}
                    axisLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                  />
                  <Tooltip
                    formatter={(v) => [moneyFmt.format(v), 'Revenue']}
                    labelFormatter={(_, payload) => (payload?.[0]?.payload?.date ? payload[0].payload.date : '')}
                    contentStyle={{ borderRadius: 8, border: '1px solid var(--sidebar-border)' }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div style={tableShellStyle()}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--sidebar-border)' }}>
            <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-primary)' }}>Appointments over time</h2>
          </div>
          <div style={{ height: 280, padding: '8px 12px 16px' }}>
            {!data || !data.dailyBreakdown.some((d) => d.appointments > 0) ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--label-color)', fontSize: 14 }}>
                No appointments in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--sidebar-border)" vertical={false} />
                  <XAxis dataKey="short" tick={{ fontSize: 11, fill: 'var(--label-color)' }} axisLine={{ stroke: 'var(--sidebar-border)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--label-color)' }} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    formatter={(v) => [v, 'Appointments']}
                    labelFormatter={(_, payload) => (payload?.[0]?.payload?.date ? payload[0].payload.date : '')}
                    contentStyle={{ borderRadius: 8, border: '1px solid var(--sidebar-border)' }}
                  />
                  <Line type="monotone" dataKey="appointments" stroke="#0d7a4f" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 22, marginBottom: 28 }}>
        <div style={tableShellStyle()}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--sidebar-border)' }}>
            <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-primary)' }}>Top treatments</h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--label-color)' }}>Line items on invoices in range (billed amounts)</p>
          </div>
          {!data || data.topTreatments.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--label-color)', fontSize: 14 }}>No data available</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle()}>Name</th>
                  <th style={{ ...thStyle(), textAlign: 'right' }}>Count</th>
                  <th style={{ ...thStyle(), textAlign: 'right' }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.topTreatments.map((row) => (
                  <tr key={row.name}>
                    <td style={tdStyle()}>{row.name}</td>
                    <td style={{ ...tdStyle(), textAlign: 'right' }}>{row.count}</td>
                    <td style={{ ...tdStyle(), textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{moneyFmtFine.format(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={tableShellStyle()}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--sidebar-border)' }}>
            <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-primary)' }}>Therapist performance</h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--label-color)' }}>From appointment schedule; revenue via linked invoices</p>
          </div>
          {!data || data.therapistStats.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--label-color)', fontSize: 14 }}>No data available</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle()}>Name</th>
                  <th style={{ ...thStyle(), textAlign: 'right' }}>Revenue</th>
                  <th style={{ ...thStyle(), textAlign: 'right' }}>Appointments</th>
                  <th style={{ ...thStyle(), textAlign: 'right' }}>Clients</th>
                </tr>
              </thead>
              <tbody>
                {data.therapistStats.map((row) => (
                  <tr key={row.name}>
                    <td style={tdStyle()}>{row.name}</td>
                    <td style={{ ...tdStyle(), textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{moneyFmtFine.format(row.revenue)}</td>
                    <td style={{ ...tdStyle(), textAlign: 'right' }}>{row.appointmentsHandled}</td>
                    <td style={{ ...tdStyle(), textAlign: 'right' }}>{row.clientsHandled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={tableShellStyle()}>
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid var(--sidebar-border)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-primary)' }}>Daily breakdown</h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--label-color)' }}>Export for spreadsheets or board packs</p>
          </div>
          <button
            type="button"
            disabled={!data?.dailyBreakdown?.length}
            onClick={() => exportDailyCsv(data.dailyBreakdown, `kpi-daily-${startDate}_${endDate}.csv`)}
            style={{
              ...pillBase,
              background: 'var(--primary)',
              color: '#fff',
              opacity: data?.dailyBreakdown?.length ? 1 : 0.45,
              cursor: data?.dailyBreakdown?.length ? 'pointer' : 'not-allowed',
            }}
          >
            Export CSV
          </button>
        </div>
        {!data || data.dailyBreakdown.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--label-color)', fontSize: 14 }}>No data available</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 360 }}>
              <thead>
                <tr>
                  <th style={thStyle()}>Date</th>
                  <th style={{ ...thStyle(), textAlign: 'right' }}>Revenue</th>
                  <th style={{ ...thStyle(), textAlign: 'right' }}>Appointments</th>
                </tr>
              </thead>
              <tbody>
                {data.dailyBreakdown.map((row) => (
                  <tr key={row.date}>
                    <td style={tdStyle()}>{row.date}</td>
                    <td style={{ ...tdStyle(), textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{moneyFmtFine.format(row.revenue)}</td>
                    <td style={{ ...tdStyle(), textAlign: 'right' }}>{row.appointments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
