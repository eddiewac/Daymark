import { useState, useEffect, useRef, useMemo } from 'react';
import { projectColorWithGroups } from '../../lib/projectGroups.js';
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

function fmtRelative(ts) {
  if (!ts) return 'never';
  const days = Math.floor((Date.now() - ts) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(ts).toLocaleDateString();
}

// Earliest upcoming deliverable due date (or earliest overall if all past).
function nextDeadline(project) {
  const dates = (project.deliverables || [])
    .map((d) => d.dueDate)
    .filter(Boolean)
    .sort();
  if (dates.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = dates.find((d) => d >= today);
  return upcoming || dates[dates.length - 1];
}

// "Stale" = tracker notes not updated within STALE_DAYS (or never).
function isStale(project) {
  const ts = project.trackerUpdatedAt;
  if (!ts) return true;
  return Date.now() - ts > STALE_DAYS * DAY_MS;
}

export default function ProjectTracker({
  projects,
  allProjects,
  projectGroups,
  tasks,
  onUpdate,
  onOpenProject,
}) {
  const [activeId, setActiveId] = useState(projects[0]?.id || null);
  const [sortBy, setSortBy] = useState('stale'); // stale | deadline | name

  // Keep a valid selection as the list changes.
  useEffect(() => {
    if (!projects.find((p) => p.id === activeId)) {
      setActiveId(projects[0]?.id || null);
    }
  }, [projects, activeId]);

  const tasksFor = (name) => (tasks || []).filter((t) => t.project === name);

  const sorted = useMemo(() => {
    const arr = [...projects];
    if (sortBy === 'name') {
      arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortBy === 'deadline') {
      arr.sort((a, b) => (nextDeadline(a) || '9999').localeCompare(nextDeadline(b) || '9999'));
    } else {
      // stale first (never-updated, then oldest), then the rest
      arr.sort((a, b) => (a.trackerUpdatedAt || 0) - (b.trackerUpdatedAt || 0));
    }
    return arr;
  }, [projects, sortBy]);

  const active = projects.find((p) => p.id === activeId);
  const staleCount = projects.filter(isStale).length;

  // Advance to the next project in the sorted list (the "sweep" motion).
  const goNext = () => {
    const idx = sorted.findIndex((p) => p.id === activeId);
    const next = sorted[idx + 1];
    if (next) setActiveId(next.id);
  };
  const hasNext = sorted.findIndex((p) => p.id === activeId) < sorted.length - 1;

  if (projects.length === 0) {
    return <div style={styles.empty}>No projects to track.</div>;
  }

  return (
    <div style={styles.wrap}>
      {/* Left: project list */}
      <div style={styles.list}>
        <div style={styles.listHeader}>
          <span style={styles.listTitle}>
            {staleCount > 0 ? `${staleCount} need${staleCount === 1 ? 's' : ''} an update` : 'All up to date'}
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={styles.sortSelect}
            title="Sort projects"
          >
            <option value="stale">Stale first</option>
            <option value="deadline">By deadline</option>
            <option value="name">By name</option>
          </select>
        </div>
        <div style={styles.listScroll}>
          {sorted.map((p) => {
            const health = projectHealth(p, tasksFor(p.name));
            const stale = isStale(p);
            const isActive = p.id === activeId;
            const dl = nextDeadline(p);
            return (
              <button
                key={p.id}
                onClick={() => setActiveId(p.id)}
                style={{
                  ...styles.listItem,
                  ...(isActive ? styles.listItemActive : {}),
                }}
              >
                <span
                  style={{
                    ...styles.healthDot,
                    background: HEALTH_COLOR[health.status] || HEALTH_COLOR.green,
                  }}
                />
                <span style={styles.listName}>{p.name || '(untitled)'}</span>
                {dl && <span style={styles.listDeadline}>{fmtShort(dl)}</span>}
                <span
                  style={{
                    ...styles.staleMark,
                    ...(stale ? styles.staleMarkOn : styles.staleMarkOff),
                  }}
                  title={stale ? 'Notes need updating' : `Updated ${fmtRelative(p.trackerUpdatedAt)}`}
                >
                  {stale ? '✎' : '✓'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: focused editor */}
      <div style={styles.editorPane}>
        {active ? (
          <ProjectEditor
            key={active.id}
            project={active}
            projectTasks={tasksFor(active.name)}
            onUpdate={onUpdate}
            onOpenProject={onOpenProject}
            onNext={hasNext ? goNext : null}
          />
        ) : (
          <div style={styles.empty}>Select a project.</div>
        )}
      </div>
    </div>
  );
}

// ── Focused editor for one project ───────────────────────────────────────────
function ProjectEditor({ project, projectTasks, onUpdate, onOpenProject, onNext }) {
  const [nextSteps, setNextSteps] = useState(project.nextSteps || '');
  const [blockers, setBlockers] = useState(project.blockers || '');
  const [savedFlash, setSavedFlash] = useState(false);
  const saveTimer = useRef(null);

  // Reset when the project changes.
  useEffect(() => {
    setNextSteps(project.nextSteps || '');
    setBlockers(project.blockers || '');
  }, [project.id]);

  // Debounced auto-save; stamps trackerUpdatedAt so the stale marker updates.
  useEffect(() => {
    const unchanged =
      nextSteps === (project.nextSteps || '') && blockers === (project.blockers || '');
    if (unchanged) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onUpdate(project.id, {
        nextSteps,
        blockers,
        trackerUpdatedAt: Date.now(),
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    }, 700);
    return () => clearTimeout(saveTimer.current);
  }, [nextSteps, blockers]);

  // Read-only context
  const delivs = project.deliverables || [];
  const delivDone = delivs.filter((d) => d.done).length;
  const waiting = delivs
    .map((d) => ({ name: d.name, status: deliverableStatus(d) }))
    .filter((x) => x.status && (x.status.kind === 'waiting' || x.status.kind === 'awaiting'));
  const oosEntries = (projectTasks || []).flatMap((t) => t.oosEntries || []);
  const oosHours = oosEntries.reduce((s, e) => s + (e.hours || 0), 0);
  const wholeOos = (projectTasks || []).filter((t) => t.outOfScope).length;

  return (
    <div style={styles.editor}>
      <div style={styles.editorHeader}>
        <button onClick={() => onOpenProject(project.id)} style={styles.editorTitle} title="Open full project">
          {project.name || '(untitled)'}
        </button>
        <div style={styles.editorHeaderRight}>
          {savedFlash && <span style={styles.savedFlash}>✓ Saved</span>}
          {onNext && (
            <button onClick={onNext} style={styles.nextBtn} title="Next project">
              Next →
            </button>
          )}
        </div>
      </div>

      {/* Read-only context strip */}
      <div style={styles.contextStrip}>
        {project.status && <span style={styles.ctxPill}>{project.status}</span>}
        {delivs.length > 0 && (
          <span style={styles.ctxItem}>
            {delivDone}/{delivs.length} deliverables
          </span>
        )}
        {waiting.map((w, i) => (
          <span key={i} style={styles.ctxWaiting} title={w.name}>
            {w.status.icon} {w.name}
            {w.status.date ? ` · ${fmtShort(w.status.date)}` : ''}
          </span>
        ))}
        {(oosEntries.length > 0 || wholeOos > 0) && (
          <span style={styles.ctxScope}>
            ⚠ {oosEntries.length > 0 ? `${oosEntries.length} scope item${oosEntries.length === 1 ? '' : 's'}${oosHours > 0 ? ` · ${oosHours.toFixed(1)}h` : ''}` : ''}
            {wholeOos > 0 ? `${oosEntries.length > 0 ? ' · ' : ''}${wholeOos} OOS task${wholeOos === 1 ? '' : 's'}` : ''}
          </span>
        )}
      </div>

      {/* Editable working fields */}
      <div style={styles.fieldBlock}>
        <label style={styles.fieldLabel}>Next steps</label>
        <textarea
          value={nextSteps}
          onChange={(e) => setNextSteps(e.target.value)}
          placeholder="What happens next on this project…"
          style={styles.textarea}
        />
      </div>
      <div style={styles.fieldBlock}>
        <label style={styles.fieldLabel}>Blockers</label>
        <textarea
          value={blockers}
          onChange={(e) => setBlockers(e.target.value)}
          placeholder="Anything holding this up…"
          style={{ ...styles.textarea, minHeight: 90 }}
        />
      </div>
    </div>
  );
}

const styles = {
  wrap: { flex: 1, display: 'flex', minHeight: 0, background: 'var(--bg-surface)' },
  list: {
    width: 300,
    minWidth: 300,
    borderRight: '0.5px solid var(--color-border-tertiary)',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--color-background-tertiary)',
  },
  listHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '10px 12px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  listTitle: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' },
  sortSelect: {
    fontSize: 11,
    padding: '3px 6px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  listScroll: { flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 3 },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '8px 10px',
    background: 'transparent',
    border: '0.5px solid transparent',
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
  },
  listItemActive: {
    background: 'var(--bg-surface)',
    borderColor: 'var(--accent)',
  },
  healthDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  listName: {
    flex: 1,
    fontSize: 12,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  listDeadline: { fontSize: 10, color: 'var(--color-text-tertiary)', flexShrink: 0 },
  staleMark: { fontSize: 12, flexShrink: 0, width: 16, textAlign: 'center' },
  staleMarkOn: { color: '#ef9f27', fontWeight: 700 },
  staleMarkOff: { color: '#1d9e75' },
  editorPane: { flex: 1, display: 'flex', minWidth: 0 },
  editor: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: 20,
    gap: 14,
    overflowY: 'auto',
  },
  editorHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left',
    textDecoration: 'underline',
    textDecorationColor: 'transparent',
  },
  editorHeaderRight: { display: 'flex', alignItems: 'center', gap: 10 },
  savedFlash: { fontSize: 11, color: '#1d9e75', fontWeight: 500 },
  nextBtn: {
    padding: '5px 14px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  contextStrip: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  ctxPill: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    background: 'var(--color-background-secondary)',
    borderRadius: 10,
    padding: '2px 8px',
  },
  ctxItem: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    background: 'var(--color-background-secondary)',
    borderRadius: 10,
    padding: '2px 8px',
  },
  ctxWaiting: {
    fontSize: 11,
    color: '#b06a00',
    background: '#ef9f2722',
    borderRadius: 10,
    padding: '2px 8px',
    maxWidth: 220,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  ctxScope: {
    fontSize: 11,
    color: '#BA7517',
    background: '#BA751718',
    borderRadius: 10,
    padding: '2px 8px',
    fontWeight: 500,
  },
  fieldBlock: { display: 'flex', flexDirection: 'column', gap: 5 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
  },
  textarea: {
    minHeight: 130,
    padding: '10px 12px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.5,
    fontFamily: 'inherit',
    background: 'var(--bg-surface)',
    color: 'var(--color-text-primary)',
    outline: 'none',
    resize: 'vertical',
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
