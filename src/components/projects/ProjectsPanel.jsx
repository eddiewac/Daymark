import { useState, useMemo } from 'react';
import ProjectCard from './ProjectCard.jsx';
import ProjectDetail from './ProjectDetail.jsx';
import GanttView from './GanttView.jsx';
import TrackView from './track/TrackView.jsx';

export default function ProjectsPanel({
  projects,
  loading,
  tasks,
  congresses,
  members,
  workspaceId,
  stationTemplates,
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

  const visible = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.number?.toLowerCase().includes(q) ||
        p.nextSteps?.toLowerCase().includes(q)
    );
  }, [projects, search]);

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
                  {projects.length === 0
                    ? 'No projects yet. Click + New project to create one.'
                    : 'No projects match the search.'}
                </div>
              ) : (
                <div style={styles.grid}>
                  {visible.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      allProjects={projects}
                      taskCount={taskCountFor(p.name)}
                      onClick={() => setActiveId(p.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : view === 'gantt' ? (
            <GanttView projects={visible} congresses={congresses || []} />
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
                      taskCount={taskCountFor(p.name)}
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
              onUpdate={onUpdate}
              onDelete={onDelete}
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
    background: '#fff',
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
  viewBtnActive: { background: '#fff', color: 'var(--color-text-primary)', fontWeight: 500 },
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
    background: '#534AB7',
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
    background: '#534AB708',
    border: '0.5px solid #534AB733',
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
