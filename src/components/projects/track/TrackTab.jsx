import { useState, useEffect } from 'react';
import TrackView from './TrackView.jsx';
import { projectColor } from '../../../lib/constants.js';

// ── TrackTab ────────────────────────────────────────────────────────────────
// Makes Track a top-level destination. Track itself is per-project, so this
// wrapper provides a project picker, then renders TrackView for the chosen
// project. The last-picked project is remembered (localStorage) so the tab
// doesn't reset every visit.

const LAST_PROJECT_KEY = 'daymark-track-last-project';

export default function TrackTab({
  projects,
  allProjects,
  tasks,
  members,
  workspaceId,
  initialProjectId,
  initialFocusKey,
  initialFocusNonce,
  stationTemplates,
  categories,
  priorities,
  statuses,
  onUpdateProject,
  onAddTask,
  onUpdateTask,
  onToggleTask,
  onDeleteTask,
  onAssignTask,
  onUnassignTask,
  onOpenTasks,
  onContextProject,
  blocks,
  runningTimer,
  onStartTimer,
  onStopTimer,
  onOpenProject,
}) {
  const activeProjects = (projects || []).filter((p) => !p.archived);

  // Restore last-picked project if it still exists, else first project.
  // An incoming initialProjectId (a "jump to Track" from a task) takes
  // precedence — see the effect below.
  const [selectedId, setSelectedId] = useState(() => {
    if (initialProjectId && activeProjects.some((p) => p.id === initialProjectId)) {
      return initialProjectId;
    }
    try {
      const stored = localStorage.getItem(LAST_PROJECT_KEY);
      if (stored && activeProjects.some((p) => p.id === stored)) return stored;
    } catch {}
    return activeProjects[0]?.id || null;
  });

  // When a task elsewhere jumps to Track, initialProjectId changes — honour it.
  useEffect(() => {
    if (initialProjectId && activeProjects.some((p) => p.id === initialProjectId)) {
      setSelectedId(initialProjectId);
      try {
        localStorage.setItem(LAST_PROJECT_KEY, initialProjectId);
      } catch {}
    }
  }, [initialProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // If the selected project disappears (deleted / switched workspace),
  // fall back to the first available one.
  useEffect(() => {
    if (selectedId && activeProjects.some((p) => p.id === selectedId)) return;
    setSelectedId(activeProjects[0]?.id || null);
  }, [activeProjects, selectedId]);

  useEffect(() => {
    if (selectedId && onContextProject) onContextProject(selectedId);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectProject = (id) => {
    setSelectedId(id);
    try {
      localStorage.setItem(LAST_PROJECT_KEY, id);
    } catch {}
    onContextProject && onContextProject(id);
  };

  const selected = activeProjects.find((p) => p.id === selectedId) || null;

  if (activeProjects.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyTitle}>No projects yet</div>
        <div style={styles.emptySub}>
          Track shows a project's deliverables as a train of stations. Create a
          project first — from the Projects tab — and it'll appear here.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      {/* Project picker bar */}
      <div style={styles.pickerBar}>
        <span style={styles.pickerLabel}>Track project</span>
        <select
          value={selectedId || ''}
          onChange={(e) => selectProject(e.target.value)}
          style={styles.picker}
        >
          {activeProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {/* Quick chips for fast switching when there aren't too many */}
        {activeProjects.length <= 8 && (
          <div style={styles.chipRow}>
            {activeProjects.map((p) => {
              const isActive = p.id === selectedId;
              const c = projectColor(p.name, allProjects);
              return (
                <button
                  key={p.id}
                  onClick={() => selectProject(p.id)}
                  style={{
                    ...styles.chip,
                    borderColor: isActive ? c : 'var(--color-border-tertiary)',
                    background: isActive ? c + '18' : 'transparent',
                    color: isActive ? c : 'var(--color-text-secondary)',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* The train itself. key forces a fresh TrackView when switching
          projects so internal state (open station, etc.) resets cleanly. */}
      <div style={styles.trackArea}>
        {selected && (
          <TrackView
            key={selected.id}
            project={selected}
            allProjects={allProjects}
            tasks={tasks}
            members={members}
            workspaceId={workspaceId}
            stationTemplates={stationTemplates}
            categories={categories}
            priorities={priorities}
            statuses={statuses}
            onUpdateProject={onUpdateProject}
            onAddTask={onAddTask}
            onUpdateTask={onUpdateTask}
            onToggleTask={onToggleTask}
            onDeleteTask={onDeleteTask}
            onAssignTask={onAssignTask}
            onUnassignTask={onUnassignTask}
            onOpenTasks={onOpenTasks}
            initialFocusKey={initialProjectId === selected.id ? initialFocusKey : null}
            initialFocusNonce={initialFocusNonce}
            blocks={blocks}
            runningTimer={runningTimer}
            onStartTimer={onStartTimer}
            onStopTimer={onStopTimer}
            onOpenProject={onOpenProject}
            onClose={null}
          />
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    background: 'var(--bg-surface)',
  },
  pickerBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    flexWrap: 'wrap',
  },
  pickerLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-secondary)',
  },
  picker: {
    padding: '5px 10px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 8,
    fontSize: 12,
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  chipRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  chip: {
    padding: '4px 12px',
    borderRadius: 16,
    border: '0.5px solid',
    fontSize: 11,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  trackArea: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    maxWidth: 400,
    lineHeight: 1.5,
  },
};

