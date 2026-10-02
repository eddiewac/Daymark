import { useMemo, useState, useEffect } from 'react';
import { projectColor } from '../../lib/constants.js';
import { loadTimeForTasks } from '../../lib/time.js';
import { taskDeliverable } from '../../lib/deliverableStatus.js';

// Deliverable-level overview: one row per deliverable across all projects.
// Shows the current station, its owner (assignee), and dates. Dates and
// assignee are editable inline; the current station advances via a "complete"
// action (marking the active station done moves it to the next). Project and
// station display are read-only (click the project to open its full detail).

function fmtShort(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// The current station = first not-done; null if all done or none.
function currentStation(deliverable) {
  const stations = deliverable.stations || [];
  return stations.find((s) => !s.done) || null;
}

export default function DeliverablesView({ projects, tasks, onUpdateProject, onOpenProject }) {
  // Map each deliverable id → its tasks (via deliverableId or stationId).
  const tasksByDeliverable = useMemo(() => {
    const map = {};
    for (const t of tasks || []) {
      const d = taskDeliverable(t, projects);
      if (!d) continue;
      (map[d.id] = map[d.id] || []).push(t);
    }
    return map;
  }, [tasks, projects]);

  // Budget per deliverable = sum of its tasks' estimates.
  const budgetByDeliverable = useMemo(() => {
    const map = {};
    for (const [delivId, ts] of Object.entries(tasksByDeliverable)) {
      map[delivId] = ts.reduce((s, t) => s + (Number(t.estimate) || 0), 0);
    }
    return map;
  }, [tasksByDeliverable]);

  // Actual hours per deliverable — summed from logged blocks for its tasks,
  // across all workspaces. Loaded async (cross-workspace query by task id).
  const [actualByDeliverable, setActualByDeliverable] = useState({});
  useEffect(() => {
    const allTaskIds = (tasks || []).map((t) => t.id);
    if (allTaskIds.length === 0) {
      setActualByDeliverable({});
      return;
    }
    let cancelled = false;
    loadTimeForTasks(allTaskIds).then((perTask) => {
      if (cancelled) return;
      const perDeliv = {};
      for (const [delivId, ts] of Object.entries(tasksByDeliverable)) {
        perDeliv[delivId] = ts.reduce((s, t) => s + (perTask[t.id] || 0), 0);
      }
      setActualByDeliverable(perDeliv);
    });
    return () => { cancelled = true; };
  }, [tasks, tasksByDeliverable]);

  // Build rows: one per deliverable, carrying refs back to project for saving.
  const rows = useMemo(() => {
    const out = [];
    for (const p of projects || []) {
      for (const d of p.deliverables || []) {
        const stations = d.stations || [];
        const cur = currentStation(d);
        const doneCount = stations.filter((s) => s.done).length;
        out.push({
          project: p,
          deliverable: d,
          stations,
          current: cur,
          doneCount,
          allDone: stations.length > 0 && doneCount === stations.length,
          budget: budgetByDeliverable[d.id] || 0,
          actual: actualByDeliverable[d.id] || 0,
        });
      }
    }
    return out;
  }, [projects, budgetByDeliverable, actualByDeliverable]);

  // Group rows by project, preserving project order.
  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.project.id)) map.set(r.project.id, { project: r.project, rows: [] });
      map.get(r.project.id).rows.push(r);
    }
    return [...map.values()];
  }, [rows]);

  // ── Save helpers (nested writes into project.deliverables / stations) ──────
  const patchDeliverable = (project, deliverableId, patch) => {
    const deliverables = (project.deliverables || []).map((d) =>
      d.id === deliverableId ? { ...d, ...patch } : d
    );
    onUpdateProject(project.id, { deliverables });
  };

  const patchStation = (project, deliverableId, stationId, patch) => {
    const deliverables = (project.deliverables || []).map((d) => {
      if (d.id !== deliverableId) return d;
      return {
        ...d,
        stations: (d.stations || []).map((s) =>
          s.id === stationId ? { ...s, ...patch } : s
        ),
      };
    });
    onUpdateProject(project.id, { deliverables });
  };

  const completeCurrentStation = (project, deliverable) => {
    const cur = currentStation(deliverable);
    if (!cur) return;
    patchStation(project, deliverable.id, cur.id, {
      done: true,
      completedAt: new Date().toISOString(),
    });
  };

  if (rows.length === 0) {
    return (
      <div style={styles.empty}>
        No deliverables yet. Add deliverables to your projects and they'll appear
        here with their current station, owner, and dates.
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={styles.title}>Deliverables</span>
        <span style={styles.summary}>{rows.length} across {grouped.length} project{grouped.length === 1 ? '' : 's'}</span>
      </div>

      <div style={styles.scroll}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, ...styles.delivCol }}>Deliverable</th>
              <th style={{ ...styles.th, ...styles.stationCol }}>Current station</th>
              <th style={{ ...styles.th, ...styles.ownerCol }}>Assigned to</th>
              <th style={{ ...styles.th, ...styles.budgetCol }} title="Budgeted hours (sum of task estimates) vs actual logged">Budget / Actual</th>
              <th style={{ ...styles.th, ...styles.dateCol }}>Start</th>
              <th style={{ ...styles.th, ...styles.dateCol }}>Due</th>
              <th style={{ ...styles.th, ...styles.actionCol }}></th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((bucket) => {
              const pColor = projectColor(bucket.project.name, projects);
              return (
                <GroupRows
                  key={bucket.project.id}
                  bucket={bucket}
                  pColor={pColor}
                  onOpenProject={onOpenProject}
                  patchDeliverable={patchDeliverable}
                  patchStation={patchStation}
                  completeCurrentStation={completeCurrentStation}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupRows({ bucket, pColor, onOpenProject, patchDeliverable, patchStation, completeCurrentStation }) {
  return (
    <>
      <tr>
        <td colSpan={7} style={styles.groupRow}>
          <button onClick={() => onOpenProject(bucket.project.id)} style={styles.groupBtn}>
            <span style={{ ...styles.groupDot, background: pColor }} />
            <span style={styles.groupName}>{bucket.project.name || '(untitled)'}</span>
            <span style={styles.groupCount}>{bucket.rows.length}</span>
          </button>
        </td>
      </tr>
      {bucket.rows.map((r) => (
        <DeliverableRow
          key={r.deliverable.id}
          row={r}
          pColor={pColor}
          patchDeliverable={patchDeliverable}
          patchStation={patchStation}
          completeCurrentStation={completeCurrentStation}
        />
      ))}
    </>
  );
}

function DeliverableRow({ row, pColor, patchDeliverable, patchStation, completeCurrentStation }) {
  const { project, deliverable, stations, current, doneCount, allDone, budget, actual } = row;
  const [owner, setOwner] = useState(current?.owner || '');
  const over = budget > 0 && actual > budget;

  return (
    <tr style={{ ...styles.tr, borderLeft: `3px solid ${pColor}` }}>
      <td style={{ ...styles.td, ...styles.delivCol }}>
        <span style={{ ...styles.delivName, ...(deliverable.done ? styles.delivDone : {}) }}>
          {deliverable.name || '(deliverable)'}
        </span>
        {stations.length > 0 && (
          <span style={styles.progress}>{doneCount}/{stations.length}</span>
        )}
      </td>

      <td style={{ ...styles.td, ...styles.stationCol }}>
        {allDone ? (
          <span style={styles.allDone}>✓ All stations complete</span>
        ) : current ? (
          <span style={styles.stationName}>{current.name || '(station)'}</span>
        ) : (
          <span style={styles.noStations}>—</span>
        )}
      </td>

      <td style={{ ...styles.td, ...styles.ownerCol }}>
        {current ? (
          <input
            data-row={deliverable.id}
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            onBlur={() => {
              if (owner !== (current.owner || '')) {
                patchStation(project, deliverable.id, current.id, { owner });
              }
            }}
            placeholder="—"
            style={styles.ownerInput}
            title="Owner of the current station"
          />
        ) : (
          <span style={styles.noStations}>—</span>
        )}
      </td>

      <td style={{ ...styles.td, ...styles.budgetCol }}>
        {budget > 0 || actual > 0 ? (
          <span style={styles.budgetActual} title="Budgeted (task estimates) vs actual logged hours">
            <span style={styles.budgetNum}>{budget > 0 ? `${budget.toFixed(1)}h` : '—'}</span>
            <span style={styles.budgetSep}> / </span>
            <span style={{ ...styles.actualNum, ...(over ? styles.actualOver : {}) }}>
              {actual > 0 ? `${actual.toFixed(1)}h` : '0h'}
            </span>
          </span>
        ) : (
          <span style={styles.noStations}>—</span>
        )}
      </td>

      <td style={{ ...styles.td, ...styles.dateCol }}>
        <input
          type="date"
          value={deliverable.startDate || ''}
          onChange={(e) => patchDeliverable(project, deliverable.id, { startDate: e.target.value })}
          style={styles.dateInput}
        />
      </td>

      <td style={{ ...styles.td, ...styles.dateCol }}>
        <input
          type="date"
          value={deliverable.dueDate || ''}
          onChange={(e) => patchDeliverable(project, deliverable.id, { dueDate: e.target.value })}
          style={styles.dateInput}
        />
      </td>

      <td style={{ ...styles.td, ...styles.actionCol }}>
        {current && (
          <button
            onClick={() => completeCurrentStation(project, deliverable)}
            style={styles.advanceBtn}
            title={`Mark "${current.name}" complete and advance`}
          >
            ✓ {current.name ? 'done' : 'done'} →
          </button>
        )}
      </td>
    </tr>
  );
}

const styles = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-surface)' },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
    padding: '12px 16px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  title: { fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' },
  summary: { fontSize: 12, color: 'var(--color-text-secondary)' },
  scroll: { flex: 1, overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    position: 'sticky',
    top: 0,
    zIndex: 5,
    background: 'var(--color-background-secondary)',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '0.5px solid var(--color-border-primary)',
    whiteSpace: 'nowrap',
  },
  delivCol: { minWidth: 220 },
  stationCol: { width: 180 },
  ownerCol: { width: 140 },
  budgetCol: { width: 130 },
  dateCol: { width: 120 },
  actionCol: { width: 90, textAlign: 'right' },
  groupRow: { padding: 0, background: 'var(--bg-surface)' },
  groupBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '10px 12px',
    background: 'transparent',
    border: 'none',
    borderTop: '0.5px solid var(--color-border-tertiary)',
    cursor: 'pointer',
    textAlign: 'left',
  },
  groupDot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  groupName: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  groupCount: {
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
    background: 'var(--color-background-secondary)',
    borderRadius: 10,
    padding: '1px 8px',
  },
  tr: { borderBottom: '0.5px solid var(--color-border-tertiary)' },
  td: { padding: '6px 12px', verticalAlign: 'middle', fontSize: 12 },
  delivName: { fontSize: 13, color: 'var(--color-text-primary)' },
  delivDone: { textDecoration: 'line-through', opacity: 0.6 },
  progress: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: 'var(--color-text-tertiary)',
    marginLeft: 8,
  },
  stationName: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--accent)',
    background: 'var(--accent-soft)',
    borderRadius: 6,
    padding: '2px 8px',
  },
  allDone: { fontSize: 11, color: '#1d9e75', fontWeight: 500 },
  noStations: { color: 'var(--color-text-tertiary)' },
  budgetActual: { fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap' },
  budgetNum: { color: 'var(--color-text-secondary)' },
  budgetSep: { color: 'var(--color-text-tertiary)' },
  actualNum: { color: 'var(--color-text-primary)', fontWeight: 600 },
  actualOver: { color: '#e24b4a' },
  ownerInput: {
    width: '100%',
    padding: '4px 6px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 12,
    background: 'var(--bg-surface)',
    color: 'var(--color-text-primary)',
    outline: 'none',
  },
  dateInput: {
    padding: '4px 6px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 11,
    background: 'var(--bg-surface)',
    color: 'var(--color-text-primary)',
    outline: 'none',
  },
  advanceBtn: {
    fontSize: 11,
    fontWeight: 500,
    padding: '4px 10px',
    borderRadius: 14,
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    padding: 40,
    textAlign: 'center',
    maxWidth: 440,
    margin: '0 auto',
  },
};
