import { useState, useMemo } from 'react';
import ProjectCard from './ProjectCard.jsx';
import ProjectDetail from './ProjectDetail.jsx';
import GanttView from './GanttView.jsx';
import TrackView from './track/TrackView.jsx';
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
const [groupBy, setGroupByState] = useState(() => {
    try {
      return localStorage.getItem('daymark-projects-groupby') || 'none';
    } catch {
      return 'none';
    }
  }); // none | group
  const setGroupBy = (v) => {
    setGroupByState(v);
    try { localStorage.setItem('daymark-projects-groupby', v); } catch {}
  };
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const hasGroups = (projectGroups || []).length > 0;

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

  // Grouped buckets — only computed/used when grouping is on.
  const grouped = useMemo(
    () => groupProjects(visible, projectGroups),
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

  const toggleGroupCollapsed = (id) =>
    setCollapsedGroups((c) => ({ ...c, [id]: !c[id] }));

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

  // Renders a flat grid of project cards.
  const renderGrid = (list, onCardClick) => (
    <div style={styles.grid}>
      {list.map((p) => (
        <ProjectCard
          key={p.id}
          project={p}
          allProjects={projects}
          projectGroups={projectGroups}
          taskCount={taskCountFor(p.name)}
          projectTasks={(tasks || []).filter((t) => t.project === p.name)}
          onClick={() => onCardClick(p)}
        />
      ))}
    </div>
  );

  // Renders project cards bucketed under collapsible group headers.
  const renderGrouped = (onCardClick) => (
    <div style={styles.groupsWrap}>
      {grouped.map(({ group, projects: groupProjectsList }) => {
        const isCollapsed = !!collapsedGroups[group.id];
        return (
          <div key={group.id} style={styles.groupBlock}>
            <button
              onClick={() => toggleGroupCollapsed(group.id)}
              style={styles.groupHeader}
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              <span style={styles.groupCaret}>{isCollapsed ? '▸' : '▾'}</span>
              <span style={{ ...styles.groupHeaderDot, background: group.color }} />
              <span style={styles.groupHeaderName}>{group.name}</span>
              <span style={styles.groupHeaderCount}>
                {groupProjectsList.length}
              </span>
            </button>
            {!isCollapsed && renderGrid(groupProjectsList, onCardClick)}
          </div>
        );
      })}
    </div>
  );

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
        {/* Group-by control — only meaningful for the grid view, and only
            shown when at least one project group has been defined. */}
        {view === 'grid' && hasGroups && (
          <label style={styles.groupByLabel}>
            Group by
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              style={styles.groupBySelect}
            >
              <option value="none">None</option>
              <option value="group">Group</option>
            </select>
          </label>
        )}
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
              ) : groupBy === 'group' && hasGroups ? (
                renderGrouped((p) => setActiveId(p.id))
              ) : (
                renderGrid(visible, (p) => setActiveId(p.id))
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
                renderGrid(visible, (p) => setTrackingId(p.id))
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
              projectGroups={projectGroups}
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
  groupByLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    flexShrink: 0,
  },
  groupBySelect: {
    padding: '4px 6px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    fontSize: 11,
    background: 'var(--bg-surface)',
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
  groupsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  groupBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '6px 4px',
    background: 'transparent',
    border: 'none',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    cursor: 'pointer',
    textAlign: 'left',
  },
  groupCaret: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    width: 12,
    flexShrink: 0,
  },
  groupHeaderDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  groupHeaderName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    flex: 1,
  },
  groupHeaderCount: {
    fontSize: 11,
    fontWeight: 600,
    padding: '0 7px',
    background: 'var(--color-background-tertiary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 8,
    minWidth: 18,
    textAlign: 'center',
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

