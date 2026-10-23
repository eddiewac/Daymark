import { useState, useEffect, useRef } from 'react';
import { useSaveStatus } from './save/SaveStatus.jsx';
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
import StationWorkbench from './projects/track/StationWorkbench.jsx';
import CommsLog from './record/CommsLog.jsx';
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

// Five doors. Menus open on click (Escape closes). Waiting-on and Notepad are
// not doors — Waiting lives on Today, the notepad stays a float.
const DOORS = [
  { id: 'today', label: 'Today' },
  { id: 'projects', label: 'Projects' },
  { id: 'plan', label: 'Plan' },
  { id: 'track', label: 'Track' },
  { id: 'record', label: 'Record' },
];

// All valid tab keys, for persistence validation.
function placeLabelForTask(task, projects) {
  if (!task) return '';
  if (task.stationId) {
    for (const p of projects || []) {
      for (const d of p.deliverables || []) {
        const s = (d.stations || []).find((x) => x.id === task.stationId);
        if (s) return s.name || d.name || p.name || task.project || task.title || '';
      }
    }
  }
  return task.project || task.title || '';
}

function normalizeOpenTarget(target) {
  if (!target) return null;
  if (typeof target === 'string') return { projectId: target };
  return target;
}

const ALL_TAB_KEYS = [
  'today', 'tasks', 'plan', 'projects', 'track', 'resource', 'status', 'waiting', 'deliverables',
  'notes', 'notepad', 'time', 'export', 'congresses', 'settings', 'record', 'comms', 'forecast',
];

export default function WorkspaceView({
  activeWorkspace,
  time,
  onTimerStartedForTask,
  workspaces,
  onSwitchWorkspace,
}) {
  // Derive workspaceId early — needed by the tab persistence key below.
  const workspaceId = activeWorkspace?.id || null;
  const workspaceName = activeWorkspace?.name || 'Personal';

  // Persist the active tab per workspace so refreshing doesn't bump you back.
  // Stored under a key that includes the workspace id so different workspaces
  // can remember different tabs (e.g. you might be on Tasks in one workspace
  // but Status in another).
  const tabStorageKey = `daymark-tab:${workspaceId || 'personal'}`;
  // First land after login is Today in the last workspace. Tab memory was
  // restoring Settings (and other tabs) and skipping the desk. The tab is
  // still remembered during the session for group menus, but a fresh mount
  // — login, refresh, or switching workspace — opens Today.
  const [tab, setTab] = useState('today');
  const [navDoor, setNavDoor] = useState('today');
  const [projectsView, setProjectsView] = useState('grid');
  const [projectsViewNonce, setProjectsViewNonce] = useState(0);
  const [focusNonce, setFocusNonce] = useState(0);
  const [prepSignal, setPrepSignal] = useState(0);
  const [recordPane, setRecordPane] = useState('time');

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
  // Whenever the active tab belongs to a door, record it as that door's last view.
  useEffect(() => {
    if (!navDoor || navDoor === 'today') return;
    setGroupLastView((prev) => {
      if (prev[navDoor] === tab) return prev;
      const next = { ...prev, [navDoor]: tab };
      try {
        localStorage.setItem(groupMemKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [tab, navDoor, groupMemKey]);
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
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
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
    patchProject,
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
  const { runSave, showToast } = useSaveStatus();

  // Modal state for setting today's priority
  const [priorityModalOpen, setPriorityModalOpen] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  // Floating notepad: a docked panel that stays open while navigating other
  // tabs. Its open-state is persisted so it survives reloads and tab changes.
  // v2 key: the old flag defaulted closed, so live only showed the nav
  // button. This ship restores the float for everyone; closing it sticks.
  const [notepadOpen, setNotepadOpenState] = useState(() => {
    try {
      return localStorage.getItem('daymark-notepad-floating-v2') !== '0';
    } catch {
      return true;
    }
  });
  const setNotepadOpen = (v) => {
    setNotepadOpenState(v);
    try {
      localStorage.setItem('daymark-notepad-floating-v2', v ? '1' : '0');
    } catch {}
  };
  const floatVisible = notepadOpen && tab !== 'notepad';
  if (typeof window !== 'undefined') window.__daymarkNotepadOpen = floatVisible;
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('daymark-notepad-visibility', { detail: { open: floatVisible } })
    );
  }, [floatVisible]);

  // ── Jump to Track ─────────────────────────────────────────────────────────
  // A task can link directly through to its project's Track view. When a task
  // row triggers this, we record the target project id and switch to the
  // Track tab; TrackTab picks the project up via its initialProjectId prop.
  const [trackTargetProjectId, setTrackTargetProjectId] = useState(null);
  const [trackFocusKey, setTrackFocusKey] = useState(null);
  const [trackFocusNonce, setTrackFocusNonce] = useState(0);
  const [projectOpenId, setProjectOpenId] = useState(null);
  const [projectOpenNonce, setProjectOpenNonce] = useState(0);
  const openNonce = useRef(0);
  const [focusProjectId, setFocusProjectId] = useState(null);
  const [stationOverlay, setStationOverlay] = useState(null);
  const [switchToast, setSwitchToast] = useState(null);

  const contextKey = `daymark-context-project:${workspaceId || 'personal'}`;
  const [contextProjectId, setContextProjectIdState] = useState(() => {
    try {
      return localStorage.getItem(contextKey) || '';
    } catch {
      return '';
    }
  });
  const setContextProjectId = (id) => {
    const next = id || '';
    setContextProjectIdState(next);
    try {
      localStorage.setItem(contextKey, next);
    } catch {}
  };

  // Open a project by id, or the station workbench when both ids are present.
  // Accepts a project id string or { projectId, deliverableId, stationId }.
  const openRecord = (target) => {
    const spec = normalizeOpenTarget(target);
    if (!spec?.projectId) {
      setTab('projects');
      return;
    }
    const nonce = ++openNonce.current;
    setFocusProjectId(spec.projectId);
    setContextProjectId(spec.projectId);
    if (spec.stationId && spec.deliverableId) {
      setStationOverlay({
        projectId: spec.projectId,
        deliverableId: spec.deliverableId,
        stationId: spec.stationId,
      });
      return;
    }
    setProjectOpenId(spec.projectId);
    setProjectOpenNonce(nonce);
    setTab('projects');
  };

  const openProjectById = (projectId) => openRecord(projectId);

  // Assigned tasks on Personal have no station in this workspace. Open switches
  // into the workspace that owns the task and opens that station once it loads.
  useEffect(() => {
    if (projectsLoading) return;
    let raw = null;
    try {
      raw = sessionStorage.getItem('daymark-open-assigned');
    } catch {
      return;
    }
    if (!raw) return;
    let intent = null;
    try {
      intent = JSON.parse(raw);
    } catch {
      try {
        sessionStorage.removeItem('daymark-open-assigned');
      } catch {}
      return;
    }
    if (!intent || intent.workspaceId !== workspaceId) return;
    try {
      sessionStorage.removeItem('daymark-open-assigned');
    } catch {}
    if (intent.stationId) {
      for (const p of projects || []) {
        for (const d of p.deliverables || []) {
          const s = (d.stations || []).find((x) => x.id === intent.stationId);
          if (!s) continue;
          setContextProjectId(p.id);
          setStationOverlay({
            projectId: p.id,
            deliverableId: d.id,
            stationId: s.id,
          });
          return;
        }
      }
    }
    if (intent.projectId && (projects || []).some((p) => p.id === intent.projectId)) {
      openProjectById(intent.projectId);
    }
  }, [projectsLoading, projects, workspaceId]);

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
    runSave(async () => {
      const result = await toggleDone(taskId);
      // Only prompt on a persisted completion, and only for station-linked tasks.
      if (result?.ok && task && !wasDone) {
        const ctx = resolveStationForTask(task);
        if (ctx) {
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
      return result || { ok: false, error: 'Could not update task' };
    });
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
    const previous = project.deliverables;
    const deliverables = (project.deliverables || []).map((d) => ({
      ...d,
      stations: (d.stations || []).map((s) =>
        s.id === commPrompt.stationId
          ? { ...s, done: true, completedAt: new Date().toISOString() }
          : s
      ),
    }));
    runSave(async () => {
      const result = await updateProject(project.id, { deliverables });
      if (!result?.ok) patchProject(project.id, { deliverables: previous });
      return result || { ok: false, error: 'Could not save' };
    }).then((result) => {
      if (result?.ok === false) return;
      // Update the prompt in place so it reflects the just-advanced state
      // (station now done) rather than closing — the user still sees the payoff.
      setCommPrompt((prev) =>
        prev
          ? { ...prev, stationDone: true, doneCount: prev.doneCount + (prev.stationDone ? 0 : 1) }
          : prev
      );
    });
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
    const previous = project.deliverables;
    const deliverables = (project.deliverables || []).map((d) => ({
      ...d,
      stations: (d.stations || []).map((s) =>
        s.id === commPrompt.stationId
          ? { ...s, comms: [...(s.comms || []), newComm] }
          : s
      ),
    }));
    runSave(async () => {
      const result = await updateProject(project.id, { deliverables });
      if (!result?.ok) patchProject(project.id, { deliverables: previous });
      return result || { ok: false, error: 'Could not save' };
    }).then((result) => {
      if (result?.ok === false) return;
      setCommPrompt(null);
    });
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

  // Esc leaves Focus Mode. It does not discard the timer.
  useEffect(() => {
    if (!focusOpen) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (e.defaultPrevented) return;
      e.preventDefault();
      setFocusOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusOpen]);

  // Start (or switch) a timer. Focus Mode opens only when the user opted in.
  // Switching auto-logs the running block inside useTime. The toast names that
  // logged task (and its station), never the task just started.
  const startTimer = async (task) => {
    if (!task) return;
    onTimerStartedForTask?.(task);
    const prev = time.runningTimer;
    const switching = prev && prev.taskId !== task.id;
    const result = switching ? await runSave(() => time.startTimer(task)) : await time.startTimer(task);
    if (result?.switched && result.blockId) {
      const prevTask = (allTasks || []).find((t) => t.id === (result.previousTaskId || prev?.taskId));
      const ctx = prevTask ? resolveStationForTask(prevTask) : null;
      const taskName = prevTask?.title || result.previousTitle || prev?.taskTitle || 'previous task';
      const stationName = ctx?.station?.name || '';
      const place =
        stationName && stationName !== taskName ? `${taskName} · ${stationName}` : taskName;
      showToast(`Logged ${result.minutes || 1} min to ${place}`, {
        onUndo: () => runSave(() => time.voidBlock(result.blockId)),
      });
    }
    if (result?.startFailed) {
      showToast(result.switched ? 'Couldn’t start the new timer' : 'Couldn’t start timer');
      return;
    }
    if (!result || result.ok === false) return;
    if (userPrefs.focusModeOnStart) setFocusOpen(true);
  };

  // Timesheet trash voids the row (hours 0, voided) and offers Undo.
  // It must not hard-delete the time_entries row.
  const voidTimesheetBlock = async (blockId) => {
    const result = await runSave(() => time.voidBlock(blockId));
    if (!result || result.ok === false) return;
    const snapshot = result.snapshot;
    showToast('Voided', {
      onUndo: () => runSave(() => time.restoreBlock(blockId, snapshot)),
    });
  };

  const undoSwitchLog = async () => {
    if (!switchToast?.blockId) return;
    const id = switchToast.blockId;
    setSwitchToast(null);
    await time.voidBlock(id);
  };

  const openDoItem = (item) => {
    if (!item) return;
    if (item.kind === 'station') {
      setContextProjectId(item.projectId);
      setStationOverlay({
        projectId: item.projectId,
        deliverableId: item.deliverableId,
        stationId: item.stationId,
      });
      return;
    }
    const task = item.task || item;
    const ctx = resolveStationForTask(task);
    if (ctx) {
      setContextProjectId(ctx.project.id);
      setStationOverlay({
        projectId: ctx.project.id,
        deliverableId: ctx.deliverable.id,
        stationId: ctx.station.id,
      });
      return;
    }
    const proj = (projects || []).find(
      (p) => p.id === task.projectId || (task.project && p.name === task.project)
    );
    if (proj) {
      openProjectById(proj.id);
      return;
    }
    if (task.workspaceId && task.workspaceId !== workspaceId && onSwitchWorkspace) {
      const ws = (workspaces || []).find((w) => w.id === task.workspaceId);
      if (!ws) return;
      try {
        sessionStorage.setItem(
          'daymark-open-assigned',
          JSON.stringify({
            workspaceId: ws.id,
            projectId: task.projectId || null,
            deliverableId: task.deliverableId || null,
            stationId: task.stationId || null,
          })
        );
      } catch {}
      onSwitchWorkspace(ws);
    }
  };

  const overlayProject = stationOverlay
    ? (projects || []).find((p) => p.id === stationOverlay.projectId)
    : null;
  let overlayDeliverable = null;
  let overlayStation = null;
  if (overlayProject && stationOverlay) {
    overlayDeliverable = (overlayProject.deliverables || []).find(
      (d) => d.id === stationOverlay.deliverableId
    );
    overlayStation = (overlayDeliverable?.stations || []).find(
      (s) => s.id === stationOverlay.stationId
    );
  }

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

  const lastOpenedKey = `daymark-projects-last-opened:${workspaceId || 'personal'}`;
  let lastOpenedProjectId = null;
  try {
    lastOpenedProjectId = localStorage.getItem(lastOpenedKey);
  } catch {}
  const lastOpenedProject = (projects || []).find((p) => p.id === lastOpenedProjectId) || null;

  const go = (nextTab, door) => {
    setTab(nextTab);
    if (door) setNavDoor(door);
    setOpenGroup(null);
  };

  const openProjects = (view, projectId) => {
    const nextView = view === 'forecast' ? 'forecast' : 'grid';
    setProjectsView(nextView);
    setProjectsViewNonce((n) => n + 1);
    const openId = projectId || (nextView === 'grid' ? lastOpenedProjectId : null);
    if (openId) {
      setFocusProjectId(openId);
      setFocusNonce((n) => n + 1);
    }
    setTab('projects');
    setNavDoor('projects');
    setOpenGroup(null);
  };

  const landDoor = (doorId, pref) => {
    if (doorId === 'projects') {
      if (pref === 'deliverables') {
        setTab('deliverables');
        return;
      }
      if (pref === 'forecast') {
        setProjectsView('forecast');
        setProjectsViewNonce((n) => n + 1);
        setTab('projects');
        return;
      }
      setProjectsView('grid');
      setProjectsViewNonce((n) => n + 1);
      if (lastOpenedProjectId) {
        setFocusProjectId(lastOpenedProjectId);
        setFocusNonce((n) => n + 1);
      }
      setTab('projects');
      return;
    }
    if (doorId === 'plan') {
      setTab(pref === 'congresses' ? 'congresses' : 'plan');
      return;
    }
    if (doorId === 'track') {
      if (pref === 'time') setTab('time');
      else if (pref === 'deliverables') setTab('deliverables');
      else setTab('track');
      return;
    }
    if (doorId === 'record') {
      if (pref === 'comms') setTab('comms');
      else if (pref === 'export') setTab('export');
      else {
        setRecordPane(pref === 'notes' ? 'notes' : 'time');
        setTab('record');
      }
    }
  };

  const onDoorClick = (door, el) => {
    setNavDoor(door.id);
    if (el) {
      const r = el.getBoundingClientRect();
      setFlyAnchor({ left: r.left, top: r.bottom + 4 });
    }
    if (door.id === 'today') {
      setTab('today');
      setOpenGroup(null);
      return;
    }
    const pinned = groupPins[door.id];
    const pref = pinned || groupLastView[door.id] || null;
    landDoor(door.id, pref);
    setOpenGroup((cur) => (cur === door.id ? null : door.id));
  };

  const doorMenu = (doorId) => {
    if (doorId === 'projects') {
      return [
        { label: 'All projects', run: () => openProjects('grid') },
        ...(lastOpenedProject
          ? [{ label: lastOpenedProject.name, run: () => openProjects('grid', lastOpenedProject.id) }]
          : []),
        { label: 'Deliverables', run: () => go('deliverables', 'projects') },
        { label: 'Forecast', run: () => openProjects('forecast') },
      ];
    }
    if (doorId === 'plan') {
      return [
        { label: 'This week', run: () => go('plan', 'plan') },
        {
          label: 'Prep tomorrow',
          run: () => {
            setPrepSignal((n) => n + 1);
            setTab('today');
            setNavDoor('plan');
            setOpenGroup(null);
          },
        },
        { label: 'Congresses', run: () => go('congresses', 'plan') },
      ];
    }
    if (doorId === 'track') {
      return [
        { label: 'Station track', run: () => go('track', 'track') },
        { label: 'Timesheet', run: () => go('time', 'track') },
        { label: 'Budget vs actual', run: () => go('deliverables', 'track') },
      ];
    }
    if (doorId === 'record') {
      return [
        {
          label: 'Timesheet + Notes',
          run: () => {
            setRecordPane('time');
            go('record', 'record');
          },
        },
        { label: 'Comms log', run: () => go('comms', 'record') },
        { label: 'Export / handoff', run: () => go('export', 'record') },
      ];
    }
    return [];
  };

  return (
    <div style={styles.wrap}>
      {isDemo && (
        <DemoWorkspaceBanner
          workspaceName={workspaceName}
          onDelete={handleDeleteDemo}
        />
      )}
      {openGroup && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpenGroup(null)}
          style={styles.menuScrim}
        />
      )}
      <div style={styles.tabBar}>
        {DOORS.map((door) => {
          const isOpen = openGroup === door.id;
          const active = navDoor === door.id;
          const items = doorMenu(door.id);
          return (
            <div key={door.id} style={styles.navGroup}>
              <button
                type="button"
                onClick={(e) => onDoorClick(door, e.currentTarget)}
                aria-current={active ? 'page' : undefined}
                aria-expanded={door.id === 'today' ? undefined : isOpen}
                aria-haspopup={door.id === 'today' ? undefined : 'menu'}
                style={{
                  ...styles.tab,
                  ...(active ? styles.tabActive : {}),
                  ...(isOpen ? styles.tabExpanded : {}),
                }}
              >
                {door.label}
                {door.id !== 'today' && <span style={styles.navCaret}>▾</span>}
              </button>
              {isOpen && items.length > 0 && (
                <div
                  role="menu"
                  style={{
                    ...styles.flyout,
                    left: flyAnchor.left,
                    top: flyAnchor.top,
                  }}
                >
                  {items.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      role="menuitem"
                      onClick={item.run}
                      style={styles.flyItem}
                    >
                      {item.label}
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
        <label style={styles.focusOpt} title="Opt in — Focus Mode is not opened on every timer start">
          <input
            type="checkbox"
            checked={!!userPrefs.focusModeOnStart}
            onChange={(e) => updateUserPrefs({ focusModeOnStart: e.target.checked })}
          />
          Focus on start
        </label>
        {/* Open focus button when timer is running but focus box is hidden */}
        {time.runningTimer && !focusOpen && (
          <button
            onClick={() => setFocusOpen(true)}
            style={{ ...styles.openFocusBtn, marginLeft: 0 }}
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
            marginLeft: 0,
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
            onJumpToTab={(t) => {
              setTab(t);
              if (t === 'today') setNavDoor('today');
              else if (t === 'projects' || t === 'deliverables') setNavDoor('projects');
              else if (t === 'plan' || t === 'congresses') setNavDoor('plan');
              else if (t === 'track' || t === 'time') setNavDoor('track');
              else if (t === 'record' || t === 'notes' || t === 'export' || t === 'comms') setNavDoor('record');
            }}
            onJumpToProject={openRecord}
            onPatchProject={patchProject}
            blocks={time.blocks}
            onOpenItem={openDoItem}
            onJumpToTrack={jumpToTrack}
            onToggleDone={handleToggleDone}
            onUpdateTask={updateTask}
            onUpdateProject={updateProject}
            runningTimer={time.runningTimer}
            onStartTimer={startTimer}
            onStopTimer={time.requestStop}
            onSeedDemo={handleSeedDemo}
            seedingDemo={seedingDemo}
            workspaceName={workspaceName}
            prepSignal={prepSignal}
            currentUserId={time.currentUserId}
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
            initialOpenId={projectOpenId}
            initialOpenNonce={projectOpenNonce}
            onAdd={addProject}
            onUpdate={updateProject}
            onDelete={deleteProject}
            focusProjectId={focusProjectId}
            focusNonce={focusNonce}
            requestedView={projectsView}
            requestedViewNonce={projectsViewNonce}
            runningTimer={time.runningTimer}
            onStartTimer={startTimer}
            onStopTimer={time.requestStop}
            onContextProject={setContextProjectId}
            onAddTask={addTask}
            onUpdateTask={updateTask}
            onToggleTask={handleToggleDone}
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
            initialFocusKey={trackFocusKey}
            initialFocusNonce={trackFocusNonce}
            onContextProject={setContextProjectId}
            blocks={time.blocks}
            runningTimer={time.runningTimer}
            onStartTimer={startTimer}
            onStopTimer={time.requestStop}
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
            onOpenProject={openRecord}
          />
        )}
        {tab === 'deliverables' && (
          <DeliverablesView
            projects={projects}
            tasks={allTasks}
            onUpdateProject={updateProject}
            onOpenProject={openRecord}
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
            onVoidBlock={voidTimesheetBlock}
            onStartTimer={startTimer}
            onRequestStop={time.requestStop}
          />
        )}
        {(tab === 'record' || tab === 'notes' || tab === 'time') && tab === 'record' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={styles.recordSeg} role="tablist" aria-label="Timesheet and notes">
              <button
                type="button"
                role="tab"
                aria-selected={recordPane === 'time'}
                onClick={() => setRecordPane('time')}
                style={{ ...styles.recordSegBtn, ...(recordPane === 'time' ? styles.recordSegOn : {}) }}
              >
                Timesheet
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={recordPane === 'notes'}
                onClick={() => setRecordPane('notes')}
                style={{ ...styles.recordSegBtn, ...(recordPane === 'notes' ? styles.recordSegOn : {}) }}
              >
                Notes
              </button>
            </div>
            {recordPane === 'notes' ? (
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
            ) : (
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
                onVoidBlock={voidTimesheetBlock}
                onStartTimer={startTimer}
                onRequestStop={time.requestStop}
              />
            )}
          </div>
        )}
        {tab === 'comms' && (
          <CommsLog
            projects={projects}
            onOpenStation={(item) => {
              setContextProjectId(item.projectId);
              setStationOverlay(item);
            }}
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
      {floatVisible && (
        <FloatingNotepad
          projects={projects}
          tasks={allTasks}
          workspaceId={workspaceId}
          contextProjectId={contextProjectId}
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
          placement={floatVisible ? 'top' : 'bottom'}
        />
      )}

      {switchToast && (
        <div style={styles.switchToast} role="status">
          <div>{switchToast.main}</div>
          <button type="button" onClick={undoSwitchLog} style={styles.switchUndo}>
            Undo
          </button>
        </div>
      )}

      {overlayProject && overlayDeliverable && overlayStation && (
        <StationWorkbench
          project={overlayProject}
          deliverable={overlayDeliverable}
          station={overlayStation}
          allProjects={projects}
          tasks={allTasks}
          members={members}
          workspaceId={workspaceId}
          categories={settings.categories}
          priorities={settings.priorities}
          statuses={settings.statuses}
          onUpdateStation={(updatedStation) => {
            const deliverables = (overlayProject.deliverables || []).map((d) => {
              if (d.id !== overlayDeliverable.id) return d;
              return {
                ...d,
                stations: (d.stations || []).map((s) =>
                  s.id === updatedStation.id ? updatedStation : s
                ),
              };
            });
            updateProject(overlayProject.id, { deliverables });
          }}
          onSelectStation={(stationId) =>
            setStationOverlay((cur) => (cur ? { ...cur, stationId } : cur))
          }
          blocks={time.blocks}
          runningTimer={time.runningTimer}
          onStartTimer={startTimer}
          onStopTimer={time.requestStop}
          onAddTask={addTask}
          onUpdateTask={updateTask}
          onToggleTask={handleToggleDone}
          onDeleteTask={deleteTask}
          onAssignTask={assignToMember}
          onClose={() => setStationOverlay(null)}
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
  menuScrim: {
    position: 'fixed',
    inset: 0,
    zIndex: 20,
    background: 'transparent',
    border: 'none',
    padding: 0,
  },
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 14px',
    background: 'var(--bg-surface)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    overflowX: 'auto',
    position: 'relative',
    zIndex: 40,
  },
  tabExpanded: {
    background: 'var(--color-background-secondary)',
    color: 'var(--color-text-primary)',
  },
  recordSeg: {
    display: 'flex',
    gap: 6,
    padding: '10px 16px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    background: 'var(--bg-surface)',
    flexShrink: 0,
  },
  recordSegBtn: {
    border: '0.5px solid var(--color-border-secondary)',
    background: 'transparent',
    borderRadius: 8,
    padding: '5px 12px',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
  },
  recordSegOn: {
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    borderColor: 'var(--accent)',
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
  focusOpt: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
    userSelect: 'none',
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
  switchToast: {
    position: 'fixed',
    top: 64,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 2000,
    background: '#111827',
    color: '#f9fafb',
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 13,
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    boxShadow: '0 8px 24px rgba(0,0,0,.18)',
    maxWidth: 460,
  },
  switchToastSub: {
    fontSize: 11.5,
    color: '#c4b5fd',
    marginTop: 2,
  },
  switchUndo: {
    padding: '4px 10px',
    background: 'transparent',
    color: '#fff',
    border: '0.5px solid rgba(255,255,255,.35)',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 650,
    cursor: 'pointer',
  },
  bodyRow: { flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' },
  body: { flex: 1, display: 'flex', minHeight: 0 },
};