import { useState, useMemo } from 'react';
import ProjectCard from './ProjectCard.jsx';
import ProjectDetail from './ProjectDetail.jsx';
import GanttView from './GanttView.jsx';
import TrackView from './track/TrackView.jsx';
import ProjectTracker from './ProjectTracker.jsx';
import { groupProjects } from '../../lib/projectGroups.js';

export default function ProjectsPanel({
  projects,
  loading,
  tasks,
  congresses,
  members,
  workspaceId,
  stationTemplates,
  categories,
  priorities,
  statuses,
  projectGroups,
  onAdd,
  onUpdate,
  onDelete,
  onAddTask,
  onUpdateTask,
  onToggleTask,
  onDeleteTask,
  onAssignTask,
}) {
  const [activeId, setActiveId] = useState(null);
  const [trackingId, setTrackingId] = useState(null); // when set, full-screen track mode
  const [view, setView] = useState('grid'); // grid | gantt | track
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const COMPLETE_STATUS = '✅ Complete';

  // Count of archived (completed) projects, for the toggle label.
  const archivedCount = useMemo(
    () => projects.filter((p) => p.status === COMPLETE_STATUS).length,
    [projects]
  );

  const visible = useMemo(() => {
    // Active view hides completed projects; archived view shows only those.
    const scoped = projects.filter((p) =>
      showArchived
        ? p.status === COMPLETE_STATUS
        : p.status !== COMPLETE_STATUS
    );
    if (!search.trim()) return scoped;
    const q = search.toLowerCase();
    return scoped.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.number?.toLowerCase().includes(q) ||
        p.nextSteps?.toLowerCase().includes(q)
    );
  }, [projects, search, showArchived]);

  // Bucket the visible projects by their group, for the grouped grid display.
  // Ungrouped projects fall into a trailing "Ungrouped" bucket. When no groups
  // are defined, this yields a single bucket and the grid looks as before.
  const grouped = useMemo(
    () => groupProjects(visible, projectGroups || []),
    [visible, projectGroups]
  );

  const taskCountFor = (projectName) =>
    tasks.filter((t) => t.project === projectName && !t.done).length;

  const active = projects.find((p) => p.id === activeId);
  const tracking = projects.find((p) => p.id === trackingId);

  const handleAdd = async () => {
    const proj = await onAdd();
    setActiveId(proj.id);
  };

  // When a project is being tracked, show the full-screen TrackView
  if (tracking) {
    return (
      <TrackView
        project={tracking}
        allProjects={projects}
        tasks={tasks}
        members={members}
        workspaceId={workspaceId}
        stationTemplates={stationTemplates}
        categories={categories}
        priorities={priorities}
        statuses={statuses}
        onUpdateProject={onUpdate}
        onAddTask={onAddTask}
        onUpdateTask={onUpdateTask}
        onToggleTask={onToggleTask}
        onDeleteTask={onDeleteTask}
        onAssignTask={onAssignTask}
        onClose={() => setTrackingId(null)}
      />
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div style={styles.viewSwitch}>
          {[
            { key: 'grid', label: 'Grid' },
            { key: 'gantt', label: 'Gantt' },
            { key: 'track', label: '🚂 Track' },
            { key: 'tracker', label: '📋 Tracker' },
          ].map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              style={{
                ...styles.viewBtn,
                ...(view === v.key ? styles.viewBtnActive : {}),
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects…"
          style={styles.search}
        />
        <button
          onClick={() => setShowArchived((v) => !v)}
          style={{
            ...styles.viewBtn,
            ...(showArchived ? styles.viewBtnActive : {}),
          }}
          title={showArchived ? 'Show active projects' : 'Show archived (completed) projects'}
        >
          {showArchived ? '← Active' : `🗄 Archived${archivedCount ? ` (${archivedCount})` : ''}`}
        </button>
        <button onClick={handleAdd} style={styles.addBtn}>
          + New project
        </button>
      </div>

      <div style={styles.body}>
        {/* Main panel */}
        <div style={{ flex: active ? 1.2 : 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {view === 'grid' ? (
            <div style={styles.gridScroll}>
              {loading ? (
                <div style={styles.empty}>Loading…</div>
              ) : visible.length === 0 ? (
                <div style={styles.empty}>
                  {showArchived
                    ? 'No completed projects yet. Set a project’s status to “✅ Complete” to archive it here.'
                    : projects.length === 0
                    ? 'No projects yet. Click + New project to create one.'
                    : 'No projects match the search.'}
                </div>
              ) : (
                <div style={styles.groupedWrap}>
                  {grouped.map((bucket) => (
                    <div key={bucket.group.id} style={styles.groupBlock}>
                      {/* Only show a group header when there's more than one
                          bucket (i.e. groups are actually in use). With no
                          groups defined, this renders a single unlabelled grid
                          exactly as before. */}
                      {grouped.length > 1 && (
                        <div style={styles.groupHeader}>
                          <span
                            style={{
                              ...styles.groupDot,
                              background: bucket.group.color || '#888780',
                            }}
                          />
                          <span style={styles.groupName}>{bucket.group.name}</span>
                          <span style={styles.groupCount}>
                            {bucket.projects.length}
                          </span>
                        </div>
                      )}
                      <div style={styles.grid}>
                        {bucket.projects.map((p) => (
                          <ProjectCard
                            key={p.id}
                            project={p}
                            allProjects={projects}
                            projectGroups={projectGroups || []}
                            taskCount={taskCountFor(p.name)}
                            projectTasks={(tasks || []).filter((t) => t.project === p.name)}
                            onClick={() => setActiveId(p.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : view === 'gantt' ? (
            <GanttView projects={visible} congresses={congresses || []} />
          ) : view === 'tracker' ? (
            <ProjectTracker
              projects={visible}
              allProjects={projects}
              projectGroups={projectGroups || []}
              tasks={tasks}
              onUpdate={onUpdate}
              onOpenProject={(id) => setActiveId(id)}
            />
          ) : (
            // Track picker - choose a project to enter Track mode
            <div style={styles.gridScroll}>
              <div style={styles.trackHelp}>
                Select a project to open in Track mode — a full-screen
                view of all its deliverables and stations.
              </div>
              {visible.length === 0 ? (
                <div style={styles.empty}>
                  {projects.length === 0
                    ? 'No projects yet.'
                    : 'No projects match the search.'}
                </div>
              ) : (
                <div style={styles.grid}>
                  {visible.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      allProjects={projects}
                      projectGroups={projectGroups || []}
                      taskCount={taskCountFor(p.name)}
                      projectTasks={(tasks || []).filter((t) => t.project === p.name)}
                      onClick={() => setTrackingId(p.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Detail drawer */}
        {active && (
          <div style={styles.detail}>
            <ProjectDetail
              project={active}
              allProjects={projects}
              tasks={tasks}
              congresses={congresses}
              stationTemplates={stationTemplates}
              projectGroups={projectGroups || []}
              onUpdate={onUpdate}
              onAddTask={onAddTask}
              onDelete={onDelete}
              onDeleteTask={onDeleteTask}
              onTrack={() => {
                setTrackingId(active.id);
                setActiveId(null);
              }}
              onClose={() => setActiveId(null)}
            />
          </div>
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
    background: 'var(--bg-surface)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  viewSwitch: { display: 'flex', gap: 0, background: 'var(--color-background-secondary)', borderRadius: 8, padding: 2 },
  viewBtn: {
    padding: '4px 12px',
    fontSize: 12,
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    color: 'var(--color-text-secondary)',
  },
  viewBtnActive: { background: 'var(--bg-surface)', color: 'var(--color-text-primary)', fontWeight: 500 },
  search: {
    flex: 1,
    maxWidth: 280,
    padding: '5px 10px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 8,
    fontSize: 12,
    outline: 'none',
  },
  addBtn: {
    padding: '5px 14px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
  },
  body: { flex: 1, display: 'flex', overflow: 'hidden' },
  gridScroll: { flex: 1, overflowY: 'auto', padding: 16 },
  trackHelp: {
    padding: '10px 14px',
    background: 'var(--accent-soft)',
    border: '0.5px solid var(--accent-soft-border)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    marginBottom: 14,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 10,
  },
  groupedWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  groupBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  groupDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  groupName: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  groupCount: {
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
    background: 'var(--color-background-secondary)',
    borderRadius: 10,
    padding: '1px 8px',
  },
  empty: {
    padding: 32,
    textAlign: 'center',
    fontSize: 13,
    color: 'var(--color-text-secondary)',
  },
  detail: {
    width: 480,
    flexShrink: 0,
    borderLeft: '0.5px solid var(--color-border-tertiary)',
    display: 'flex',
    flexDirection: 'column',
  },
};


