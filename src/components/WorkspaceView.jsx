import { useState, useEffect } from 'react';
import { useTasks } from '../hooks/useTasks.js';
import { useProjects } from '../hooks/useProjects.js';
import { useNotes } from '../hooks/useNotes.js';
import { useSettings } from '../hooks/useSettings.js';
import { useCongresses } from '../hooks/useCongresses.js';
import { useStatusRounds } from '../hooks/useStatusRounds.js';
import { usePriority } from '../hooks/usePriority.js';
import { useUserPrefs } from '../hooks/useUserPrefs.js';
import { loadWorkspaceMembers } from '../lib/workspaces.js';
import TaskList from './tasks/TaskList.jsx';
import ProjectsPanel from './projects/ProjectsPanel.jsx';
import NotesPanel from './notes/NotesPanel.jsx';
import Notepad from './notes/Notepad.jsx';
import TimesheetPanel from './time/TimesheetPanel.jsx';
import PlanPanel from './plan/PlanPanel.jsx';
import ExportPanel from './export/ExportPanel.jsx';
import SettingsPanel from './settings/SettingsPanel.jsx';
import CongressesPanel from './congresses/CongressesPanel.jsx';
import StatusRoundsPanel from './status/StatusRoundsPanel.jsx';
import PriorityBanner from './priority/PriorityBanner.jsx';
import PriorityModal from './priority/PriorityModal.jsx';
import FocusBox from './FocusBox.jsx';

const TABS = [
  { key: 'tasks', label: 'Tasks' },
  { key: 'plan', label: 'Plan' },
  { key: 'projects', label: 'Projects' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Notes' },
  { key: 'notepad', label: 'Notepad' },
  { key: 'time', label: 'Timesheet' },
  { key: 'export', label: 'Export' },
  { key: 'congresses', label: 'Congresses' },
  { key: 'settings', label: 'Settings' },
];

export default function WorkspaceView({
  activeWorkspace,
  time,
  onTimerStartedForTask,
}) {
  // Derive workspaceId early — needed by the tab persistence key below.
  const workspaceId = activeWorkspace?.id || null;
  const workspaceName = activeWorkspace?.name || 'Personal';

  // Persist the active tab per workspace so refreshing doesn't bump you back.
  // Stored under a key that includes the workspace id so different workspaces
  // can remember different tabs (e.g. you might be on Tasks in one workspace
  // but Status in another).
  const tabStorageKey = `daymark-tab:${workspaceId || 'personal'}`;
  const [tab, setTab] = useState(() => {
    try {
      const stored = localStorage.getItem(tabStorageKey);
      // Validate that the stored value is one of the known tabs
      if (stored && TABS.some((t) => t.key === stored)) return stored;
    } catch {}
    return 'tasks';
  });

  // Save the tab whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(tabStorageKey, tab);
    } catch {}
  }, [tab, tabStorageKey]);
  const [members, setMembers] = useState([]);

  // Focus box visibility — auto-opens when timer starts, closes on stop or manual close
  const [focusOpen, setFocusOpen] = useState(false);

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

  const {
    personal: personalNotes,
    team: teamNotes,
    loading: notesLoading,
    addNote,
    updateNote,
    deleteNote,
    moveNote,
  } = useNotes(workspaceId);

  const {
    settings,
    loading: settingsLoading,
    updateSettings,
    savedAt: settingsSavedAt,
  } = useSettings(workspaceId);

  const {
    congresses,
    loading: congressesLoading,
    addCongress,
    editCongress,
    removeCongress,
  } = useCongresses(workspaceId);

  const {
    rounds: statusRounds,
    loading: statusLoading,
    addRound,
    editRound,
    removeRound,
  } = useStatusRounds(workspaceId);

  const priorityApi = usePriority(workspaceId);
  const { prefs: userPrefs, updatePrefs: updateUserPrefs } = useUserPrefs();

  // Modal state for setting today's priority
  const [priorityModalOpen, setPriorityModalOpen] = useState(false);

  // Load workspace members
  useEffect(() => {
    if (workspaceId) {
      loadWorkspaceMembers(workspaceId).then(setMembers);
    } else {
      setMembers([]);
    }
  }, [workspaceId]);

  // Auto-open the focus box when a timer starts (until user closes it or it stops)
  useEffect(() => {
    if (time.runningTimer && !focusOpen) {
      // Only auto-open the very first time we see this timer
      // (don't reopen if user closed it)
    }
  }, [time.runningTimer, focusOpen]);

  // Wrapper around startTimer that caches the title AND opens focus box
  const startTimer = async (task) => {
    onTimerStartedForTask?.(task);
    await time.startTimer(task);
    setFocusOpen(true);
  };

  // Find the running task across all loaded tasks
  const runningTask =
    time.runningTimer && allTasks.find((t) => t.id === time.runningTimer.taskId);
  const runningProject =
    runningTask && projects.find((p) => p.name === runningTask.project);
  // Find the deliverable + station the running task belongs to (if any)
  let runningDeliverable = null;
  let runningStation = null;
  if (runningTask?.stationId && runningProject) {
    for (const d of runningProject.deliverables || []) {
      const s = (d.stations || []).find((x) => x.id === runningTask.stationId);
      if (s) {
        runningDeliverable = d;
        runningStation = s;
        break;
      }
    }
  }

  // All notes the focus box might display
  const allNotes = [...personalNotes, ...teamNotes];

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
        {/* Open focus button when timer is running but focus box is hidden */}
        {time.runningTimer && !focusOpen && (
          <button
            onClick={() => setFocusOpen(true)}
            style={styles.openFocusBtn}
            title="Open focus mode"
          >
            🎯 Focus
          </button>
        )}
      </div>

      <div style={styles.body}>
        {tab === 'tasks' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <PriorityBanner
              todayPriority={priorityApi.today}
              bannerEnabled={userPrefs.showPriorityBanner}
              tasks={allTasks}
              projects={projects}
              onOpenModal={() => setPriorityModalOpen(true)}
              onDismiss={priorityApi.dismissToday}
              onClear={priorityApi.clearToday}
              onToggleDone={toggleDone}
            />
            <TaskList
              tasks={allTasks}
              loading={tasksLoading}
              projects={projects}
              categories={settings.categories}
              priorities={settings.priorities}
              statuses={settings.statuses}
              members={members}
              workspaceId={workspaceId}
              currentUserId={time.currentUserId}
              runningTimer={time.runningTimer}
              onAdd={addTask}
              onUpdate={updateTask}
              onDelete={deleteTask}
              onToggleDone={toggleDone}
              onAssign={assignToMember}
              onUnassign={unassignFromMember}
              onStartTimer={startTimer}
              onStopTimer={time.requestStop}
            />
          </div>
        )}
        {tab === 'plan' && (
          <PlanPanel
            tasks={allTasks}
            projects={projects}
            loading={tasksLoading}
            onUpdateTask={updateTask}
            onToggleDone={toggleDone}
            blocks={time.blocks}
            currentUserId={time.currentUserId}
            runningTimer={time.runningTimer}
            onStartTimer={startTimer}
            onStopTimer={time.requestStop}
          />
        )}
        {tab === 'projects' && (
          <ProjectsPanel
            projects={projects}
            loading={projectsLoading}
            tasks={allTasks}
            congresses={congresses}
            members={members}
            workspaceId={workspaceId}
            stationTemplates={settings.stationTemplates || []}
            categories={settings.categories}
            priorities={settings.priorities}
            statuses={settings.statuses}
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
        {tab === 'status' && (
          <StatusRoundsPanel
            rounds={statusRounds}
            loading={statusLoading}
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            projects={projects}
            tasks={allTasks}
            currentUserId={time.currentUserId}
            onAdd={addRound}
            onEdit={editRound}
            onRemove={removeRound}
            onAddTask={addTask}
          />
        )}
        {tab === 'notes' && (
          <NotesPanel
            personal={personalNotes}
            team={teamNotes}
            loading={notesLoading}
            projects={projects}
            tasks={allTasks}
            workspaceId={workspaceId}
            onAdd={addNote}
            onUpdate={updateNote}
            onDelete={deleteNote}
            onMove={moveNote}
          />
        )}
        {tab === 'notepad' && (
          <Notepad
            projects={projects}
            tasks={allTasks}
            workspaceId={workspaceId}
            onAddTask={addTask}
            onAddProject={addProject}
            onAddNote={addNote}
          />
        )}
        {tab === 'time' && (
          <TimesheetPanel
            tasks={allTasks}
            projects={projects}
            blocks={time.blocks}
            loadingEntries={time.loadingEntries}
            runningTimer={time.runningTimer}
            currentUserId={time.currentUserId}
            workspaceId={workspaceId}
            onAddBlock={time.addBlock}
            onUpdateBlock={time.updateBlock}
            onRemoveBlock={time.removeBlock}
            onStartTimer={startTimer}
            onRequestStop={time.requestStop}
          />
        )}
        {tab === 'export' && (
          <ExportPanel
            tasks={allTasks}
            projects={projects}
            blocks={time.blocks}
            workspaceId={workspaceId}
            workspaceName={workspaceName}
          />
        )}
        {tab === 'settings' && (
          <SettingsPanel
            settings={settings}
            loading={settingsLoading}
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            savedAt={settingsSavedAt}
            onUpdate={updateSettings}
            userPrefs={userPrefs}
            onUpdateUserPrefs={updateUserPrefs}
          />
        )}
        {tab === 'congresses' && (
          <CongressesPanel
            congresses={congresses}
            loading={congressesLoading}
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            onAdd={addCongress}
            onEdit={editCongress}
            onRemove={removeCongress}
          />
        )}
      </div>

      {/* Focus mode dialog */}
      {focusOpen && time.runningTimer && (
        <FocusBox
          task={runningTask}
          project={runningProject}
          station={runningStation}
          deliverable={runningDeliverable}
          elapsedMs={time.elapsedMsForRunning}
          notes={allNotes}
          tagChecklists={settings.tagChecklists}
          onStop={time.requestStop}
          onUpdateTask={updateTask}
          onUpdateProject={updateProject}
          onAddNote={addNote}
          onClose={() => setFocusOpen(false)}
        />
      )}

      {/* Today's priority modal */}
      {priorityModalOpen && (
        <PriorityModal
          tasks={allTasks}
          projects={projects}
          current={priorityApi.today}
          onSave={priorityApi.setTodayPriority}
          onClose={() => setPriorityModalOpen(false)}
        />
      )}
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
  openFocusBtn: {
    marginLeft: 'auto',
    padding: '5px 12px',
    background: '#FF6B3522',
    color: '#FF6B35',
    border: '0.5px solid #FF6B3544',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  body: { flex: 1, display: 'flex', minHeight: 0 },
};
