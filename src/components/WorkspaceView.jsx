import { useState, useEffect } from 'react';
import { useTasks } from '../hooks/useTasks.js';
import { useProjects } from '../hooks/useProjects.js';
import { useNotes } from '../hooks/useNotes.js';
import { useSettings } from '../hooks/useSettings.js';
import { useCongresses } from '../hooks/useCongresses.js';
import { useStatusRounds } from '../hooks/useStatusRounds.js';
import { usePriority } from '../hooks/usePriority.js';
import { useUserPrefs } from '../hooks/useUserPrefs.js';
import { loadWorkspaceMembers, deleteWorkspace, setStoredActiveWorkspaceId } from '../lib/workspaces.js';
import { seedDemoWorkspace, isDemoWorkspace } from '../lib/demoSeed.js';
import DemoWorkspaceBanner from './DemoWorkspaceBanner.jsx';
import TaskList from './tasks/TaskList.jsx';
import ProjectsPanel from './projects/ProjectsPanel.jsx';
import TrackTab from './projects/track/TrackTab.jsx';
import ResourceView from './resource/ResourceView.jsx';
import NotesPanel from './notes/NotesPanel.jsx';
import Notepad from './notes/Notepad.jsx';
import FloatingNotepad from './notes/FloatingNotepad.jsx';
import TimesheetPanel from './time/TimesheetPanel.jsx';
import PlanPanel from './plan/PlanPanel.jsx';
import ExportPanel from './export/ExportPanel.jsx';
import SettingsPanel from './settings/SettingsPanel.jsx';
import CongressesPanel from './congresses/CongressesPanel.jsx';
import StatusRoundsPanel from './status/StatusRoundsPanel.jsx';
import WaitingOnView from './waiting/WaitingOnView.jsx';
import DeliverablesView from './deliverables/DeliverablesView.jsx';
import PriorityBanner from './priority/PriorityBanner.jsx';
import PriorityModal from './priority/PriorityModal.jsx';
import QuickCapture from './QuickCapture.jsx';
import HelpPanel from './HelpPanel.jsx';
import TodayView from './today/TodayView.jsx';
import FocusBox from './FocusBox.jsx';
import QuickCommPrompt from './QuickCommPrompt.jsx';
import { DEFAULT_COMM_PILLS } from './projects/CommsTab.jsx';

// Tab keys are unchanged — only their *presentation* is grouped. Each key still
// routes exactly as before via setTab(key). NAV defines the grouped structure:
// standalone tabs sit at the top level; groups reveal their tabs on hover (and
// land on their first/default tab when the group header itself is clicked).
const TAB_LABELS = {
  today: 'Today',
  tasks: 'Tasks',
  plan: 'Plan',
  projects: 'Projects',
  track: '🚂 Track',
  resource: '👥 Resource',
  status: 'Status',
  waiting: '⏳ Waiting on',
  deliverables: '📦 Deliverables',
  notes: 'Notes',
  notepad: 'Notepad',
  time: 'Timesheet',
  export: 'Export',
  congresses: 'Congresses',
  settings: 'Settings',
};

const NAV = [
  { type: 'tab', key: 'today' },
  {
    type: 'group',
    id: 'work',
    label: 'Work',
    color: '#185FA5',
    // First key is the default landing when the group header is clicked.
    keys: ['projects', 'tasks', 'plan', 'track', 'resource', 'status', 'waiting', 'deliverables'],
  },
  {
    type: 'group',
    id: 'record',
    label: 'Record',
    color: '#0F6E56',
    keys: ['time', 'notes', 'notepad', 'export'],
  },
  { type: 'tab', key: 'congresses' },
];

// Which group (if any) a tab key belongs to — used to highlight the active
// group header when one of its tabs is selected.
const KEY_TO_GROUP = {};
NAV.forEach((n) => {
  if (n.type === 'group') n.keys.forEach((k) => { KEY_TO_GROUP[k] = n.id; });
});

// All valid tab keys, for persistence validation.
const ALL_TAB_KEYS = [
  'today', 'tasks', 'plan', 'projects', 'track', 'resource', 'status', 'waiting', 'deliverables',
  'notes', 'notepad', 'time', 'export', 'congresses', 'settings',
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
      if (stored && ALL_TAB_KEYS.includes(stored)) return stored;
    } catch {}
    return 'tasks';
  });

  // Save the tab whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(tabStorageKey, tab);
    } catch {}
  }, [tab, tabStorageKey]);

  // Remember the last tab visited within each group, so tapping a group header
  // returns you to where you last worked in it (e.g. Work → Tracker if that's
  // where you were), rather than always the group's first tab. Persisted per
  // workspace. Falls back to the group's first key if nothing remembered.
  const groupMemKey = `daymark-group-view:${workspaceId || 'personal'}`;
  const [groupLastView, setGroupLastView] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(groupMemKey) || '{}');
      return stored && typeof stored === 'object' ? stored : {};
    } catch {
      return {};
    }
  });
  // Whenever the active tab belongs to a group, record it as that group's last view.
  useEffect(() => {
    const gid = KEY_TO_GROUP[tab];
    if (!gid) return;
    setGroupLastView((prev) => {
      if (prev[gid] === tab) return prev;
      const next = { ...prev, [gid]: tab };
      try {
        localStorage.setItem(groupMemKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [tab, groupMemKey]);
  // A pinned default (set in Settings → Tab defaults) overrides remember-last:
  // if the user pinned a specific view for a group, tapping the header always
  // goes there. No pin → fall back to last-viewed → group's first tab.
  const groupPinKey = `daymark-group-pin:${workspaceId || 'personal'}`;
  const [groupPins, setGroupPins] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(groupPinKey) || '{}');
      return stored && typeof stored === 'object' ? stored : {};
    } catch {
      return {};
    }
  });
  // Re-read pins when returning to the window, so a change made in Settings
  // this session is picked up.
  useEffect(() => {
    const reread = () => {
      try {
        const stored = JSON.parse(localStorage.getItem(groupPinKey) || '{}');
        setGroupPins(stored && typeof stored === 'object' ? stored : {});
      } catch {}
    };
    window.addEventListener('focus', reread);
    return () => window.removeEventListener('focus', reread);
  }, [groupPinKey]);

  // Resolve which tab a group header should open: a pinned default (if valid)
  // wins; else the last-viewed tab in that group; else the group's first key.
  const groupLandingTab = (node) => {
    const pinned = groupPins[node.id];
    if (pinned && node.keys.includes(pinned)) return pinned;
    const remembered = groupLastView[node.id];
    if (remembered && node.keys.includes(remembered)) return remembered;
    return node.keys[0];
  };
  const [members, setMembers] = useState([]);

  // Focus box visibility — auto-opens when timer starts, closes on stop or manual close
  const [focusOpen, setFocusOpen] = useState(false);
  // Which nav group's flyout is currently revealed (hover on laptop, tap on
  // touch), plus the screen position to anchor its flyout. Null when none open.
  // The flyout is rendered position:fixed so it escapes the tab bar's
  // horizontal overflow clipping and floats above the page.
  const [openGroup, setOpenGroup] = useState(null);
  const [flyAnchor, setFlyAnchor] = useState({ left: 0, top: 0 });
  const openFlyout = (id, el) => {
    if (el) {
      const r = el.getBoundingClientRect();
      setFlyAnchor({ left: r.left, top: r.bottom + 1 });
    }
    setOpenGroup(id);
  };
  // A fixed-position flyout would drift if the page scrolls or resizes while
  // open, so close it on either.
  useEffect(() => {
    if (!openGroup) return;
    const close = () => setOpenGroup(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [openGroup]);

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
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  // Floating notepad: a docked panel that stays open while navigating other
  // tabs. Its open-state is persisted so it survives reloads and tab changes.
  const [notepadOpen, setNotepadOpenState] = useState(() => {
    try {
      return localStorage.getItem('daymark-notepad-floating') === '1';
    } catch {
      return false;
    }
  });
  const setNotepadOpen = (v) => {
    setNotepadOpenState(v);
    try {
      localStorage.setItem('daymark-notepad-floating', v ? '1' : '0');
    } catch {}
  };

  // ── Jump to Track ─────────────────────────────────────────────────────────
  // A task can link directly through to its project's Track view. When a task
  // row triggers this, we record the target project id and switch to the
  // Track tab; TrackTab picks the project up via its initialProjectId prop.
  const [trackTargetProjectId, setTrackTargetProjectId] = useState(null);

  const jumpToTrack = (task) => {
    if (!task) return;
    // Resolve the task's project by name (tasks store project as a name).
    const proj = (projects || []).find((p) => p.name === task.project);
    if (proj) {
      setTrackTargetProjectId(proj.id);
      setTab('track');
    }
  };

  // ── Quick comm prompt ─────────────────────────────────────────────────────
  // When a station-linked task is completed, we offer to log a comm against
  // that station without the user navigating to the Comms tab. `commPrompt`
  // holds the resolved context for the transient prompt, or null when hidden.
  const [commPrompt, setCommPrompt] = useState(null);

  // Resolve which project / deliverable / station a task belongs to, by its
  // stationId. Returns null if the task has no station or it can't be found.
  const resolveStationForTask = (task) => {
    if (!task?.stationId) return null;
    for (const p of projects || []) {
      for (const d of p.deliverables || []) {
        const s = (d.stations || []).find((x) => x.id === task.stationId);
        if (s) return { project: p, deliverable: d, station: s };
      }
    }
    return null;
  };

  // Wrapped toggle: runs the real toggleDone, then — if the task was just
  // COMPLETED (not un-completed) and is linked to a resolvable station —
  // surfaces the quick comm prompt. Every panel already calls onToggleDone,
  // so intercepting here covers Tasks, Today, Plan and the priority banner
  // without touching any of them.
  const handleToggleDone = (taskId) => {
    const task = (allTasks || []).find((t) => t.id === taskId);
    const wasDone = !!task?.done;
    toggleDone(taskId);
    // Only prompt on completion, and only for station-linked tasks.
    if (task && !wasDone) {
      const ctx = resolveStationForTask(task);
      if (ctx) {
        // Work out the station's position in its deliverable and what's next,
        // so the prompt can show track progress and offer to advance it.
        const stations = ctx.deliverable.stations || [];
        const idx = stations.findIndex((s) => s.id === ctx.station.id);
        const doneCount = stations.filter((s) => s.done).length;
        const nextStation = stations.slice(idx + 1).find((s) => !s.done) || null;
        setCommPrompt({
          taskId,
          taskTitle: task.title || '(untitled)',
          projectId: ctx.project.id,
          deliverableName: ctx.deliverable.name || '',
          stationId: ctx.station.id,
          stationName: ctx.station.name || '',
          stationDone: !!ctx.station.done,
          stationIndex: idx,
          stationCount: stations.length,
          doneCount,
          nextStationName: nextStation ? nextStation.name : null,
          pills: ctx.station.commPills || DEFAULT_COMM_PILLS,
        });
      }
    }
  };

  // Mark the prompt's station complete (mirrors StationsEditor.toggleDone).
  // Advances the track in place, without navigating to the project.
  const completeStationFromPrompt = () => {
    if (!commPrompt) return;
    const project = (projects || []).find((p) => p.id === commPrompt.projectId);
    if (!project) {
      setCommPrompt(null);
      return;
    }
    const deliverables = (project.deliverables || []).map((d) => ({
      ...d,
      stations: (d.stations || []).map((s) =>
        s.id === commPrompt.stationId
          ? { ...s, done: true, completedAt: new Date().toISOString() }
          : s
      ),
    }));
    updateProject(project.id, { deliverables });
    // Update the prompt in place so it reflects the just-advanced state
    // (station now done) rather than closing — the user still sees the payoff.
    setCommPrompt((prev) =>
      prev
        ? { ...prev, stationDone: true, doneCount: prev.doneCount + (prev.stationDone ? 0 : 1) }
        : prev
    );
  };

  // Append a comm to the prompt's station, then dismiss the prompt.
  // `expectBy` is the chosen expected-reply date (from QuickCommPrompt). If not
  // provided, falls back to null for non-reply comms.
  const logCommFromPrompt = (pill, expectBy) => {
    if (!commPrompt) return;
    const project = (projects || []).find((p) => p.id === commPrompt.projectId);
    if (!project) {
      setCommPrompt(null);
      return;
    }
    const needsReply = pill.needsReply ?? true;
    const newComm = {
      id: 'comm_' + Math.random().toString(36).slice(2, 9),
      type: pill.label,
      color: pill.color,
      needsReply,
      sentAt: Date.now(),
      replyReceived: false,
      replyAt: null,
      // Use the date chosen in the prompt (defaults to +3 business days there).
      // Only reply-needing comms carry an expected-back date.
      expectReplyBy: needsReply ? (expectBy || null) : null,
    };
    const deliverables = (project.deliverables || []).map((d) => ({
      ...d,
      stations: (d.stations || []).map((s) =>
        s.id === commPrompt.stationId
          ? { ...s, comms: [...(s.comms || []), newComm] }
          : s
      ),
    }));
    updateProject(project.id, { deliverables });
    setCommPrompt(null);
  };

  // Check whether the current workspace is the demo
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!workspaceId) {
        setIsDemo(false);
        return;
      }
      const flag = await isDemoWorkspace(workspaceId);
      if (!cancelled) setIsDemo(flag);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const handleSeedDemo = async () => {
    if (seedingDemo) return;
    setSeedingDemo(true);
    try {
      const ws = await seedDemoWorkspace();
      // Set the new demo workspace as active and reload to enter it cleanly
      setStoredActiveWorkspaceId(ws.id);
      window.location.reload();
    } catch (err) {
      console.error('Failed to seed demo workspace:', err);
      alert('Sorry — the demo workspace couldn\'t be created. Please try again or check your connection.');
      setSeedingDemo(false);
    }
  };

  const handleDeleteDemo = async () => {
    if (!workspaceId) return;
    try {
      await deleteWorkspace(workspaceId);
      // After deletion, drop back to personal workspace
      setStoredActiveWorkspaceId(null);
      window.location.reload();
    } catch (err) {
      console.error('Failed to delete demo workspace:', err);
      alert('Sorry — the demo workspace couldn\'t be deleted. Please try again.');
    }
  };

  // Listen for global quick-capture triggers (Cmd+K, "+ New" button in TopBar).
  // Both fire the 'daymark-quick-capture' event so we don't need prop drilling.
  useEffect(() => {
    const onTrigger = () => setQuickCaptureOpen((v) => !v);
    const onHelp = () => setHelpOpen(true);
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setQuickCaptureOpen((v) => !v);
      }
    };
    window.addEventListener('daymark-quick-capture', onTrigger);
    window.addEventListener('daymark-help', onHelp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('daymark-quick-capture', onTrigger);
      window.removeEventListener('daymark-help', onHelp);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

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
      {isDemo && (
        <DemoWorkspaceBanner
          workspaceName={workspaceName}
          onDelete={handleDeleteDemo}
        />
      )}
      <div style={styles.tabBar}>
        {NAV.map((node) => {
          if (node.type === 'tab') {
            const k = node.key;
            return (
              <button
                key={k}
                onClick={() => setTab(k)}
                style={{
                  ...styles.tab,
                  ...(tab === k ? styles.tabActive : {}),
                }}
              >
                {TAB_LABELS[k]}
              </button>
            );
          }
          // Group node — header that reveals a flyout of its tabs.
          const isOpen = openGroup === node.id;
          const groupActive = KEY_TO_GROUP[tab] === node.id;
          // When a tab inside this group is active, show it in the header so you
          // always know where you are (e.g. "Work · Status").
          const activeChildLabel = groupActive ? TAB_LABELS[tab] : null;
          return (
            <div
              key={node.id}
              style={styles.navGroup}
              onMouseEnter={(e) => openFlyout(node.id, e.currentTarget.firstChild)}
              onMouseLeave={() => setOpenGroup((g) => (g === node.id ? null : g))}
            >
              <button
                onClick={(e) => {
                  // Tap/click the header: on touch (no hover) first tap opens;
                  // otherwise it lands on the group's default (first) tab.
                  const noHover =
                    typeof window !== 'undefined' &&
                    window.matchMedia &&
                    window.matchMedia('(hover: none)').matches;
                  if (noHover && !isOpen) {
                    openFlyout(node.id, e.currentTarget);
                  } else {
                    setTab(groupLandingTab(node));
                    setOpenGroup(null);
                  }
                }}
                style={{
                  ...styles.tab,
                  ...(groupActive ? styles.tabActive : {}),
                }}
              >
                {node.label}
                {activeChildLabel && (
                  <span style={styles.activeChild}>· {activeChildLabel}</span>
                )}
                <span style={styles.navCaret}>▾</span>
              </button>
              {isOpen && (
                <div
                  style={{
                    ...styles.flyout,
                    left: flyAnchor.left,
                    top: flyAnchor.top,
                  }}
                  onMouseEnter={() => setOpenGroup(node.id)}
                  onMouseLeave={() => setOpenGroup(null)}
                >
                  {node.keys.map((k) => (
                    <button
                      key={k}
                      onClick={() => {
                        setTab(k);
                        setOpenGroup(null);
                      }}
                      style={{
                        ...styles.flyItem,
                        ...(tab === k ? styles.flyItemActive : {}),
                      }}
                    >
                      <span
                        style={{
                          ...styles.flyDot,
                          ...(tab === k ? { background: node.color } : {}),
                        }}
                      />
                      {TAB_LABELS[k]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {/* Settings — standalone gear, separate from the content groups. */}
        <button
          onClick={() => setTab('settings')}
          style={{
            ...styles.tab,
            ...styles.settingsTab,
            ...(tab === 'settings' ? styles.tabActive : {}),
          }}
          title="Settings"
        >
          ⚙
        </button>
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
        {/* Floating notepad toggle — keeps the notepad available on any tab */}
        <button
          onClick={() => setNotepadOpen(!notepadOpen)}
          style={{
            ...styles.notepadToggle,
            ...(notepadOpen ? styles.notepadToggleActive : {}),
          }}
          title={notepadOpen ? 'Close floating notepad' : 'Open floating notepad'}
        >
          📝 Notepad
        </button>
      </div>

      <div style={styles.bodyRow}>

      <div style={styles.body}>
        {tab === 'today' && (
          <TodayView
            tasks={allTasks}
            projects={projects}
            congresses={congresses}
            todayPriority={priorityApi.today}
            onOpenPriorityModal={() => setPriorityModalOpen(true)}
            onJumpToTab={(t) => setTab(t)}
            onJumpToProject={() => setTab('projects')}
            onJumpToTrack={jumpToTrack}
            onToggleDone={handleToggleDone}
            onUpdateTask={updateTask}
            runningTimer={time.runningTimer}
            onStartTimer={startTimer}
            onStopTimer={time.requestStop}
            onSeedDemo={handleSeedDemo}
            seedingDemo={seedingDemo}
          />
        )}
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
              onToggleDone={handleToggleDone}
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
              onToggleDone={handleToggleDone}
              onJumpToTrack={jumpToTrack}
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
            categories={settings.categories}
            priorities={settings.priorities}
            statuses={settings.statuses}
            members={members}
            workspaceId={workspaceId}
            onUpdateTask={updateTask}
            onToggleDone={handleToggleDone}
            onJumpToTrack={jumpToTrack}
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
            blocks={time.blocks}
            congresses={congresses}
            members={members}
            workspaceId={workspaceId}
            stationTemplates={settings.stationTemplates || []}
            categories={settings.categories}
            priorities={settings.priorities}
            statuses={settings.statuses}
            projectGroups={settings.projectGroups || []}
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
        {tab === 'track' && (
          <TrackTab
            projects={projects}
            allProjects={projects}
            tasks={allTasks}
            members={members}
            workspaceId={workspaceId}
            initialProjectId={trackTargetProjectId}
            stationTemplates={settings.stationTemplates || []}
            categories={settings.categories}
            priorities={settings.priorities}
            statuses={settings.statuses}
            onUpdateProject={updateProject}
            onAddTask={addTask}
            onUpdateTask={updateTask}
            onToggleTask={handleToggleDone}
            onDeleteTask={deleteTask}
            onAssignTask={assignToMember}
          />
        )}
        {tab === 'resource' && (
          <ResourceView
            dailyHours={settings.dailyHours ?? 7.5}
            myName={userPrefs.displayName || ''}
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
        {tab === 'waiting' && (
          <WaitingOnView
            projects={projects}
            tasks={allTasks}
            onOpenProject={() => setTab('projects')}
          />
        )}
        {tab === 'deliverables' && (
          <DeliverablesView
            projects={projects}
            tasks={allTasks}
            onUpdateProject={updateProject}
            onOpenProject={() => setTab('projects')}
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

      {/* Floating notepad — docked beside the main content, stays open
          across tab changes. Hidden on the Notepad tab itself, where the
          full-screen notepad is already shown. */}
      {notepadOpen && tab !== 'notepad' && (
        <FloatingNotepad
          projects={projects}
          tasks={allTasks}
          workspaceId={workspaceId}
          onAddTask={addTask}
          onAddProject={addProject}
          onAddNote={addNote}
          onClose={() => setNotepadOpen(false)}
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

      {/* Global quick capture (Cmd+K / Ctrl+K) */}
      <QuickCapture
        open={quickCaptureOpen}
        onClose={() => setQuickCaptureOpen(false)}
        onAddTask={addTask}
        onAddProject={addProject}
        projects={projects}
        priorities={settings.priorities}
      />

      {/* Help panel (? in top bar) */}
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Quick comm prompt — appears after completing a station-linked task */}
      {commPrompt && (
        <QuickCommPrompt
          taskTitle={commPrompt.taskTitle}
          pills={commPrompt.pills}
          stationName={commPrompt.stationName}
          deliverableName={commPrompt.deliverableName}
          stationDone={commPrompt.stationDone}
          doneCount={commPrompt.doneCount}
          stationCount={commPrompt.stationCount}
          nextStationName={commPrompt.nextStationName}
          onCompleteStation={completeStationFromPrompt}
          onPick={logCommFromPrompt}
          onDismiss={() => setCommPrompt(null)}
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
    background: 'var(--bg-surface)',
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
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    fontWeight: 500,
  },
  navGroup: {
    position: 'relative',
    display: 'flex',
  },
  navCaret: {
    fontSize: 8,
    opacity: 0.6,
    marginLeft: 1,
  },
  flyout: {
    position: 'fixed',
    minWidth: 184,
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 10,
    boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
    padding: 5,
    zIndex: 3000,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  activeChild: {
    fontWeight: 600,
    marginLeft: 2,
  },
  flyoutBridge: {
    display: 'none',
  },
  flyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 10px',
    fontSize: 12.5,
    background: 'transparent',
    border: 'none',
    borderRadius: 7,
    color: 'var(--color-text-primary)',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  flyItemActive: {
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    fontWeight: 500,
  },
  flyDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--color-text-tertiary)',
    flexShrink: 0,
  },
  settingsTab: {
    fontSize: 14,
    padding: '5px 10px',
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
  notepadToggle: {
    marginLeft: 'auto',
    padding: '5px 12px',
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  notepadToggleActive: {
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    border: '0.5px solid var(--accent)',
  },
  bodyRow: { flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' },
  body: { flex: 1, display: 'flex', minHeight: 0 },
};