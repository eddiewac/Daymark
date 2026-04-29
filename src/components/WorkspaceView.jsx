import { useState, useEffect } from 'react';
import { useTasks } from '../hooks/useTasks.js';
import { useProjects } from '../hooks/useProjects.js';
import { loadWorkspaceMembers } from '../lib/workspaces.js';
import { DEFAULT_CATEGORIES } from '../lib/constants.js';
import TaskList from './tasks/TaskList.jsx';
import ProjectsPanel from './projects/ProjectsPanel.jsx';

const TABS = [
  { key: 'tasks', label: 'Tasks' },
  { key: 'projects', label: 'Projects' },
  { key: 'notes', label: 'Notes', disabled: true },
  { key: 'time', label: 'Timesheet', disabled: true },
  { key: 'congresses', label: 'Congresses', disabled: true },
  { key: 'settings', label: 'Settings', disabled: true },
];

export default function WorkspaceView({ activeWorkspace }) {
  const [tab, setTab] = useState('tasks');
  const [members, setMembers] = useState([]);

  const workspaceId = activeWorkspace?.id || null;
  const workspaceName = activeWorkspace?.name || 'Personal';

  const {
    allTasks,
    loading: tasksLoading,
    addTask,
    updateTask,
    deleteTask,
    toggleDone,
    assignToMember,
    unassignFromMember,
  } = useTasks(workspaceId, workspaceName);

  const {
    projects,
    loading: projectsLoading,
    addProject,
    updateProject,
    deleteProject,
  } = useProjects(workspaceId);

  // Load workspace members for the assignment dropdowns
  useEffect(() => {
    if (workspaceId) {
      loadWorkspaceMembers(workspaceId).then(setMembers);
    } else {
      setMembers([]);
    }
  }, [workspaceId]);

  const categories = DEFAULT_CATEGORIES;

  return (
    <div style={styles.wrap}>
      <div style={styles.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.key}
            disabled={t.disabled}
            onClick={() => !t.disabled && setTab(t.key)}
            style={{
              ...styles.tab,
              ...(tab === t.key ? styles.tabActive : {}),
              ...(t.disabled ? styles.tabDisabled : {}),
            }}
            title={t.disabled ? 'Coming in next migration session' : ''}
          >
            {t.label}
            {t.disabled && <span style={styles.soonBadge}>soon</span>}
          </button>
        ))}
      </div>

      <div style={styles.body}>
        {tab === 'tasks' && (
          <TaskList
            tasks={allTasks}
            loading={tasksLoading}
            projects={projects}
            categories={categories}
            members={members}
            workspaceId={workspaceId}
            onAdd={addTask}
            onUpdate={updateTask}
            onDelete={deleteTask}
            onToggleDone={toggleDone}
            onAssign={assignToMember}
            onUnassign={unassignFromMember}
          />
        )}
        {tab === 'projects' && (
          <ProjectsPanel
            projects={projects}
            loading={projectsLoading}
            tasks={allTasks}
            congresses={[]}
            members={members}
            workspaceId={workspaceId}
            onAdd={addProject}
            onUpdate={updateProject}
            onDelete={deleteProject}
            onAddTask={addTask}
            onUpdateTask={updateTask}
            onToggleTask={toggleDone}
            onDeleteTask={deleteTask}
            onAssignTask={assignToMember}
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
  },
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 14px',
    background: '#fff',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    overflowX: 'auto',
  },
  tab: {
    padding: '5px 12px',
    fontSize: 12,
    background: 'transparent',
    border: '0.5px solid transparent',
    borderRadius: 8,
    color: 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  tabActive: {
    background: '#534AB711',
    color: '#534AB7',
    fontWeight: 500,
  },
  tabDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  soonBadge: {
    fontSize: 9,
    padding: '1px 5px',
    background: 'var(--color-background-secondary)',
    color: 'var(--color-text-tertiary)',
    borderRadius: 8,
  },
  body: { flex: 1, display: 'flex', minHeight: 0 },
};
