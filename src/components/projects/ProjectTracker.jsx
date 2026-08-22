import { useState, useEffect, useRef, useMemo } from 'react';
import { projectHealth } from '../../lib/stations.js';
import { deliverableStatus } from '../../lib/deliverableStatus.js';

const HEALTH_COLOR = {
  green: '#1d9e75',
  amber: '#ef9f27',
  red: '#e24b4a',
};

const STALE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function fmtShort(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// Earliest upcoming deliverable due date (or latest if all past).
function nextDeadline(project) {
  const dates = (project.deliverables || [])
    .map((d) => d.dueDate)
    .filter(Boolean)
    .sort();
  if (dates.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  return dates.find((d) => d >= today) || dates[dates.length - 1];
}

function isStale(project) {
  const ts = project.trackerUpdatedAt;
  if (!ts) return true;
  return Date.now() - ts > STALE_DAYS * DAY_MS;
}

// Compute derived fields for a project row, once.
function buildRow(project, tasks) {
  const projectTasks = (tasks || []).filter((t) => t.project === project.name);
  const health = projectHealth(project, projectTasks);
  const delivs = project.deliverables || [];
  const delivDone = delivs.filter((d) => d.done).length;
  const waiting = delivs
    .map((d) => ({ name: d.name, status: deliverableStatus(d) }))
    .filter((x) => x.status && (x.status.kind === 'waiting' || x.status.kind === 'awaiting'));
  const oosEntries = projectTasks.flatMap((t) => t.oosEntries || []);
  const oosHours = oosEntries.reduce((s, e) => s + (e.hours || 0), 0);
  const wholeOos = projectTasks.filter((t) => t.outOfScope).length;
  return {
    project,
    health,
    deadline: nextDeadline(project),
    delivLabel: delivs.length ? `${delivDone}/${delivs.length}` : '',
    waitingLabel: waiting.length
      ? waiting
          .map((w) => `${w.status.icon || ''} ${w.name}${w.status.date ? ` ${fmtShort(w.status.date)}` : ''}`)
          .join(', ')
      : '',
    scopeLabel:
      oosEntries.length > 0 || wholeOos > 0
        ? `${oosEntries.length ? `${oosEntries.length} item${oosEntries.length === 1 ? '' : 's'}${oosHours > 0 ? ` ${oosHours.toFixed(1)}h` : ''}` : ''}${wholeOos ? `${oosEntries.length ? ', ' : ''}${wholeOos} OOS` : ''}`
        : '',
    stale: isStale(project),
  };
}

// Column definitions. `sortVal` returns a comparable value.
const COLUMNS = [
  { key: 'name', label: 'Project', width: 180, sortVal: (r) => (r.project.name || '').toLowerCase() },
  { key: 'status', label: 'Status', width: 120, sortVal: (r) => (r.project.status || '').toLowerCase() },
  { key: 'health', label: 'Health', width: 68, sortVal: (r) => ({ red: 0, amber: 1, green: 2 }[r.health.status] ?? 3) },
  { key: 'deadline', label: 'Next due', width: 88, sortVal: (r) => r.deadline || '9999' },
  { key: 'deliverables', label: 'Deliv.', width: 66, sortVal: (r) => r.delivLabel },
  { key: 'waiting', label: 'Waiting on', width: 160, sortVal: (r) => r.waitingLabel },
  { key: 'scope', label: 'Scope', width: 110, sortVal: (r) => r.scopeLabel },
  { key: 'nextSteps', label: 'Next steps', width: 260, editable: true, field: 'nextSteps', sortVal: (r) => r.project.nextSteps || '' },
  { key: 'blockers', label: 'Blockers', width: 220, editable: true, field: 'blockers', sortVal: (r) => r.project.blockers || '' },
];

export default function ProjectTracker({ projects, tasks, onUpdate, onOpenProject }) {
  const [sortKey, setSortKey] = useState('deadline');
  const [sortDir, setSortDir] = useState('asc');
  const [editing, setEditing] = useState(null); // { projectId, field }

  const rows = useMemo(() => projects.map((p) => buildRow(p, tasks)), [projects, tasks]);

  const sortedRows = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey) || COLUMNS[0];
    const arr = [...rows].sort((a, b) => {
      const av = col.sortVal(a);
      const bv = col.sortVal(b);
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    return sortDir === 'desc' ? arr.reverse() : arr;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const staleCount = rows.filter((r) => r.stale).length;

  if (projects.length === 0) {
    return <div style={styles.empty}>No projects to track.</div>;
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.toolbar}>
        <span style={styles.toolbarText}>
          {projects.length} project{projects.length === 1 ? '' : 's'}
          {staleCount > 0 && <span style={styles.staleCount}> · {staleCount} need updating</span>}
        </span>
        <span style={styles.toolbarHint}>
          Click a Next steps / Blockers cell to edit · click a header to sort
        </span>
      </div>

      <div style={styles.scroll}>
        <table style={styles.table}>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  style={{ ...styles.th, width: col.width, minWidth: col.width }}
                  title="Click to sort"
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span style={styles.sortArrow}>{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr key={r.project.id} style={{ ...styles.tr, ...(r.stale ? styles.trStale : {}) }}>
                {COLUMNS.map((col) => (
                  <td key={col.key} style={{ ...styles.td, width: col.width, minWidth: col.width }}>
                    <Cell
                      col={col}
                      row={r}
                      editing={editing}
                      setEditing={setEditing}
                      onUpdate={onUpdate}
                      onOpenProject={onOpenProject}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Individual cell renderer ─────────────────────────────────────────────────
function Cell({ col, row, editing, setEditing, onUpdate, onOpenProject }) {
  const { project, health } = row;

  // Editable text cells (Next steps, Blockers)
  if (col.editable) {
    const isEditing =
      editing && editing.projectId === project.id && editing.field === col.field;
    if (isEditing) {
      return (
        <EditCell
          initial={project[col.field] || ''}
          onSave={(val) => {
            onUpdate(project.id, { [col.field]: val, trackerUpdatedAt: Date.now() });
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      );
    }
    const text = project[col.field] || '';
    return (
      <div
        style={styles.editablePreview}
        onClick={() => setEditing({ projectId: project.id, field: col.field })}
        title={text || 'Click to add'}
      >
        {text ? (
          <span style={styles.previewText}>{text}</span>
        ) : (
          <span style={styles.previewEmpty}>＋</span>
        )}
      </div>
    );
  }

  // Read-only cells
  switch (col.key) {
    case 'name':
      return (
        <button onClick={() => onOpenProject(project.id)} style={styles.nameBtn} title="Open full project">
          <span style={styles.nameText}>{project.name || '(untitled)'}</span>
        </button>
      );
    case 'status':
      return <span style={styles.readText}>{project.status || ''}</span>;
    case 'health':
      return (
        <span
          style={{ ...styles.healthDot, background: HEALTH_COLOR[health.status] || HEALTH_COLOR.green }}
          title={health.reasons?.length ? health.reasons.join(' · ') : 'No issues'}
        />
      );
    case 'deadline':
      return <span style={styles.readMono}>{fmtShort(row.deadline)}</span>;
    case 'deliverables':
      return <span style={styles.readMono}>{row.delivLabel}</span>;
    case 'waiting':
      return (
        <span style={styles.readTextClip} title={row.waitingLabel}>
          {row.waitingLabel}
        </span>
      );
    case 'scope':
      return row.scopeLabel ? (
        <span style={styles.scopeBadge} title="Out-of-scope work">
          ⚠ {row.scopeLabel}
        </span>
      ) : null;
    default:
      return null;
  }
}

// ── Inline editor for a text cell ────────────────────────────────────────────
function EditCell({ initial, onSave, onCancel }) {
  const [val, setVal] = useState(initial);
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.setSelectionRange(val.length, val.length);
  }, []);

  return (
    <div style={styles.editWrap}>
      <textarea
        ref={ref}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => onSave(val)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSave(val);
          }
        }}
        style={styles.editArea}
        placeholder="Type…  (Esc to cancel, ⌘/Ctrl+Enter to save)"
      />
    </div>
  );
}

const styles = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-surface)' },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '8px 14px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  toolbarText: { fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' },
  staleCount: { color: '#b06a00', fontWeight: 500 },
  toolbarHint: { fontSize: 11, color: 'var(--color-text-tertiary)' },
  scroll: { flex: 1, overflow: 'auto' },
  table: { borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' },
  th: {
    position: 'sticky',
    top: 0,
    zIndex: 5,
    background: 'var(--color-background-secondary)',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    textAlign: 'left',
    padding: '8px 10px',
    borderBottom: '0.5px solid var(--color-border-primary)',
    borderRight: '0.5px solid var(--color-border-tertiary)',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  sortArrow: { fontSize: 9, color: 'var(--accent)' },
  tr: { borderBottom: '0.5px solid var(--color-border-tertiary)' },
  trStale: { background: '#ef9f2708' },
  td: {
    padding: '4px 10px',
    borderRight: '0.5px solid var(--color-border-tertiary)',
    verticalAlign: 'middle',
    fontSize: 12,
    overflow: 'hidden',
  },
  nameBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    minWidth: 0,
  },
  nameText: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  readText: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
  },
  readTextClip: {
    fontSize: 11,
    color: '#b06a00',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
  },
  readMono: { fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-secondary)' },
  healthDot: { display: 'inline-block', width: 9, height: 9, borderRadius: '50%' },
  scopeBadge: {
    fontSize: 10,
    fontWeight: 600,
    color: '#BA7517',
    background: '#BA751718',
    borderRadius: 6,
    padding: '1px 6px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'inline-block',
    maxWidth: '100%',
  },
  editablePreview: {
    cursor: 'text',
    minHeight: 22,
    display: 'flex',
    alignItems: 'center',
    borderRadius: 4,
    padding: '2px 4px',
    margin: '-2px -4px',
  },
  previewText: {
    fontSize: 12,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
    width: '100%',
  },
  previewEmpty: { fontSize: 14, color: 'var(--color-text-tertiary)' },
  editWrap: { position: 'relative' },
  editArea: {
    width: '100%',
    minHeight: 80,
    padding: '6px 8px',
    border: '1px solid var(--accent)',
    borderRadius: 6,
    fontSize: 12,
    lineHeight: 1.45,
    fontFamily: 'inherit',
    background: 'var(--bg-surface)',
    color: 'var(--color-text-primary)',
    outline: 'none',
    resize: 'vertical',
    boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
    position: 'relative',
    zIndex: 20,
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    padding: 40,
  },
};
