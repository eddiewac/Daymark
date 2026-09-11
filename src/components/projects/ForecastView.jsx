import { useState, useMemo, useRef, useEffect } from 'react';
import { projectHealth } from '../../lib/stations.js';

const HEALTH_COLOR = {
  green: '#1d9e75',
  amber: '#ef9f27',
  red: '#e24b4a',
};

// Month key helpers ("2026-01").
function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

// Does a project have a deliverable due in this month?
function hasDeliverableInMonth(project, mKey) {
  return (project.deliverables || []).some((d) => (d.dueDate || '').slice(0, 7) === mKey);
}

export default function ForecastView({
  projects,
  tasks,
  workspaceId,
  forecastLabel = '£',
  onUpdate,
  onUpdateForecastLabel,
  onOpenProject,
}) {
  const [mKey, setMKey] = useState(() => monthKey(new Date()));
  const [editingLabel, setEditingLabel] = useState(false);

  const tasksFor = (name) => (tasks || []).filter((t) => t.project === name);

  const rows = useMemo(() => {
    return projects.map((p) => {
      const forecast = (p.forecasts && p.forecasts[mKey]) ?? '';
      const health = projectHealth(p, tasksFor(p.name));
      const delivs = p.deliverables || [];
      const delivDone = delivs.filter((d) => d.done).length;
      const dueThisMonth = hasDeliverableInMonth(p, mKey);
      return {
        project: p,
        forecast,
        forecastNum: forecast === '' ? 0 : Number(forecast) || 0,
        health,
        delivLabel: delivs.length ? `${delivDone}/${delivs.length}` : '',
        dueThisMonth,
        atRisk: health.status === 'red' || health.status === 'amber',
      };
    });
  }, [projects, tasks, mKey]);

  // Only rows with a forecast value contribute to totals.
  const withForecast = rows.filter((r) => r.forecastNum > 0);
  const total = withForecast.reduce((s, r) => s + r.forecastNum, 0);
  const atRiskTotal = withForecast.filter((r) => r.atRisk).reduce((s, r) => s + r.forecastNum, 0);

  // Sort: forecasted first (desc by value), then the rest.
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if ((b.forecastNum > 0) !== (a.forecastNum > 0)) return b.forecastNum > 0 ? 1 : -1;
      return b.forecastNum - a.forecastNum;
    });
  }, [rows]);

  const fmtValue = (n) =>
    forecastLabel === '£' || forecastLabel === '$' || forecastLabel === '€'
      ? `${forecastLabel}${n.toLocaleString()}`
      : `${n.toLocaleString()} ${forecastLabel}`;

  const setForecast = (project, val) => {
    const forecasts = { ...(project.forecasts || {}) };
    if (val === '' || Number(val) === 0) {
      delete forecasts[mKey];
    } else {
      forecasts[mKey] = Number(val);
    }
    onUpdate(project.id, { forecasts });
  };

  return (
    <div style={styles.wrap}>
      {/* Toolbar: month nav + label config */}
      <div style={styles.toolbar}>
        <div style={styles.monthNav}>
          <button onClick={() => setMKey(shiftMonth(mKey, -1))} style={styles.navBtn}>‹</button>
          <button onClick={() => setMKey(monthKey(new Date()))} style={styles.thisMonthBtn}>This month</button>
          <button onClick={() => setMKey(shiftMonth(mKey, 1))} style={styles.navBtn}>›</button>
          <span style={styles.monthLabel}>{monthLabel(mKey)}</span>
        </div>
        <div style={styles.spacer} />
        <div style={styles.labelConfig}>
          {editingLabel ? (
            <input
              autoFocus
              defaultValue={forecastLabel}
              onBlur={(e) => {
                onUpdateForecastLabel && onUpdateForecastLabel(e.target.value.trim() || '£');
                setEditingLabel(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
              style={styles.labelInput}
              title="What the forecast value represents (£, $, hours, etc.)"
            />
          ) : (
            <button
              onClick={() => setEditingLabel(true)}
              style={styles.labelBtn}
              title="Change what the forecast represents"
            >
              unit: {forecastLabel} ✎
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div style={styles.summary}>
        <div style={styles.summaryMain}>
          <span style={styles.summaryLabel}>Forecast this month</span>
          <span style={styles.summaryValue}>{fmtValue(total)}</span>
          <span style={styles.summaryCount}>
            across {withForecast.length} project{withForecast.length === 1 ? '' : 's'}
          </span>
        </div>
        {atRiskTotal > 0 && (
          <div style={styles.atRisk} title="Forecast against projects that are amber or red">
            ⚠ {fmtValue(atRiskTotal)} on at-risk projects
          </div>
        )}
      </div>

      {/* Table */}
      <div style={styles.scroll}>
        {projects.length === 0 ? (
          <div style={styles.empty}>No projects yet.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.projCol }}>Project</th>
                <th style={{ ...styles.th, ...styles.numCol }}>Forecast</th>
                <th style={{ ...styles.th, ...styles.healthCol }}>Health</th>
                <th style={{ ...styles.th, ...styles.delivCol }}>Deliverables</th>
                <th style={{ ...styles.th, ...styles.dueCol }}>Due this month</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
                <tr key={r.project.id} style={r.forecastNum > 0 ? styles.trActive : undefined}>
                  <td style={{ ...styles.td, ...styles.projCol }}>
                    <button onClick={() => onOpenProject(r.project.id)} style={styles.projBtn}>
                      {r.project.name || '(untitled)'}
                    </button>
                  </td>
                  <td style={{ ...styles.td, ...styles.numCol }}>
                    <div style={styles.forecastInputWrap}>
                      <span style={styles.unitPrefix}>
                        {forecastLabel.length <= 1 ? forecastLabel : ''}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={r.forecast}
                        onChange={(e) => setForecast(r.project, e.target.value)}
                        placeholder="—"
                        style={styles.forecastInput}
                      />
                    </div>
                  </td>
                  <td style={{ ...styles.td, ...styles.healthCol }}>
                    <span
                      style={{ ...styles.healthDot, background: HEALTH_COLOR[r.health.status] || HEALTH_COLOR.green }}
                      title={r.health.reasons?.length ? r.health.reasons.join(' · ') : 'No issues'}
                    />
                  </td>
                  <td style={{ ...styles.td, ...styles.delivCol }}>
                    <span style={styles.readMono}>{r.delivLabel}</span>
                  </td>
                  <td style={{ ...styles.td, ...styles.dueCol }}>
                    {r.dueThisMonth ? (
                      <span style={styles.dueYes}>● due</span>
                    ) : (
                      <span style={styles.dueNo}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-surface)' },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  monthNav: { display: 'flex', alignItems: 'center', gap: 6 },
  navBtn: {
    width: 28,
    height: 28,
    border: '0.5px solid var(--color-border-secondary)',
    background: 'var(--bg-surface)',
    borderRadius: 6,
    fontSize: 14,
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
  },
  thisMonthBtn: {
    padding: '4px 12px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  monthLabel: { fontSize: 13, fontWeight: 600, marginLeft: 8 },
  spacer: { flex: 1 },
  labelConfig: {},
  labelBtn: {
    fontSize: 11,
    padding: '4px 10px',
    border: '0.5px solid var(--color-border-secondary)',
    background: 'var(--bg-surface)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    cursor: 'pointer',
  },
  labelInput: {
    fontSize: 11,
    padding: '4px 8px',
    width: 90,
    border: '0.5px solid var(--accent)',
    borderRadius: 6,
    outline: 'none',
    background: 'var(--bg-surface)',
  },
  summary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 16px',
    background: 'var(--color-background-secondary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  summaryMain: { display: 'flex', alignItems: 'baseline', gap: 10 },
  summaryLabel: { fontSize: 12, color: 'var(--color-text-secondary)' },
  summaryValue: { fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' },
  summaryCount: { fontSize: 12, color: 'var(--color-text-tertiary)' },
  atRisk: {
    fontSize: 12,
    fontWeight: 600,
    color: '#BA7517',
    background: '#BA751718',
    borderRadius: 8,
    padding: '4px 10px',
  },
  scroll: { flex: 1, overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    position: 'sticky',
    top: 0,
    zIndex: 5,
    background: 'var(--bg-surface)',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '0.5px solid var(--color-border-primary)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '6px 12px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    verticalAlign: 'middle',
    fontSize: 12,
  },
  projCol: { width: '40%' },
  numCol: { width: 150 },
  healthCol: { width: 70, textAlign: 'center' },
  delivCol: { width: 110, textAlign: 'center' },
  dueCol: { width: 120, textAlign: 'center' },
  trActive: { background: 'var(--accent-soft)' },
  projBtn: {
    background: 'transparent',
    border: 'none',
    padding: 0,
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    textAlign: 'left',
  },
  forecastInputWrap: { display: 'flex', alignItems: 'center', gap: 3 },
  unitPrefix: { fontSize: 12, color: 'var(--color-text-tertiary)' },
  forecastInput: {
    width: 110,
    padding: '5px 8px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'right',
    background: 'var(--bg-surface)',
    color: 'var(--color-text-primary)',
    outline: 'none',
  },
  healthDot: { display: 'inline-block', width: 9, height: 9, borderRadius: '50%' },
  readMono: { fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-secondary)' },
  dueYes: { fontSize: 11, color: 'var(--accent)', fontWeight: 600 },
  dueNo: { fontSize: 11, color: 'var(--color-text-tertiary)' },
  empty: { padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)' },
};
