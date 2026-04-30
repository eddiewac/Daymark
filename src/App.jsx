import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import {
  loadWorkspaces,
  getStoredActiveWorkspaceId,
  setStoredActiveWorkspaceId,
} from './lib/workspaces.js';
import { useTime } from './hooks/useTime.js';
import { useGoals } from './hooks/useGoals.js';
import Auth from './components/Auth.jsx';
import TopBar from './components/TopBar.jsx';
import WorkspaceView from './components/WorkspaceView.jsx';
import RunningTimerIndicator from './components/RunningTimerIndicator.jsx';
import StopTimerDialog from './components/StopTimerDialog.jsx';
import WorkspaceManagePopover from './components/WorkspaceManagePopover.jsx';
import PendingInvitesBanner from './components/PendingInvitesBanner.jsx';
import GoalsModal from './components/goals/GoalsModal.jsx';
import GoalsFloatingButton from './components/goals/GoalsFloatingButton.jsx';
import AccountDeletionModal from './components/AccountDeletionModal.jsx';

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [managingWorkspace, setManagingWorkspace] = useState(null);
  const [runningTaskTitle, setRunningTaskTitle] = useState('');
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

  const time = useTime(activeWorkspace?.id || null);
  const goalsApi = useGoals();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      return;
    }
    loadWorkspaces().then((list) => {
      setWorkspaces(list);
      const savedId = getStoredActiveWorkspaceId();
      const matched = savedId ? list.find((w) => w.id === savedId) : null;
      setActiveWorkspace(matched || null);
    });
  }, [session]);

  const handleSwitch = (ws) => {
    setActiveWorkspace(ws);
    setStoredActiveWorkspaceId(ws ? ws.id : null);
  };

  const handleWorkspacesChanged = async (newActiveId) => {
    const list = await loadWorkspaces();
    setWorkspaces(list);
    if (newActiveId) {
      const ws = list.find((w) => w.id === newActiveId);
      if (ws) setActiveWorkspace(ws);
    }
  };

  if (checking) return <div style={loadingStyle}>…</div>;
  if (!session) return <Auth />;

  const indicator = time.runningTimer ? (
    <RunningTimerIndicator
      runningTimer={time.runningTimer}
      elapsedMs={time.elapsedMsForRunning}
      taskTitle={runningTaskTitle}
      onStop={time.requestStop}
      onCancel={() => {
        time.discardTimer();
        setRunningTaskTitle('');
      }}
    />
  ) : null;

  return (
    <div style={appStyle}>
      <PendingInvitesBanner
        session={session}
        onAccepted={async (newWsId) => {
          // Reload workspaces and switch to the newly-accepted one
          const list = await loadWorkspaces();
          setWorkspaces(list);
          const ws = list.find((w) => w.id === newWsId);
          if (ws) {
            setActiveWorkspace(ws);
            setStoredActiveWorkspaceId(ws.id);
          }
        }}
      />
      <TopBar
        user={session.user}
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        onSwitchWorkspace={handleSwitch}
        onWorkspacesChanged={handleWorkspacesChanged}
        onManageWorkspace={(ws) => setManagingWorkspace(ws)}
        onOpenGoals={() => setGoalsOpen(true)}
        onOpenDeleteAccount={() => setDeleteAccountOpen(true)}
        timerIndicator={indicator}
      />
      <WorkspaceView
        key={activeWorkspace?.id || 'personal'}
        activeWorkspace={activeWorkspace}
        time={time}
        onTimerStartedForTask={(task) => setRunningTaskTitle(task?.title || '')}
      />
      {time.pendingStop && (
        <StopTimerDialog
          pendingStop={time.pendingStop}
          taskTitle={runningTaskTitle}
          onConfirm={(start, end) => {
            time.confirmStop(start, end);
            setRunningTaskTitle('');
          }}
          onCancel={time.cancelStop}
          onDiscard={() => {
            time.discardTimer();
            setRunningTaskTitle('');
          }}
        />
      )}
      {managingWorkspace && (
        <WorkspaceManagePopover
          workspace={managingWorkspace}
          onClose={() => setManagingWorkspace(null)}
          onDeleted={async (deletedId) => {
            // Reload the workspace list and switch to Personal
            const list = await loadWorkspaces();
            setWorkspaces(list);
            if (activeWorkspace?.id === deletedId) {
              setActiveWorkspace(null);
              setStoredActiveWorkspaceId(null);
            }
            setManagingWorkspace(null);
          }}
        />
      )}

      {/* Goals: floating quick-evidence button + management modal */}
      <GoalsFloatingButton
        goals={goalsApi.goals}
        onAddEvidence={goalsApi.addEvidence}
        onOpenManager={() => setGoalsOpen(true)}
      />
      {goalsOpen && (
        <GoalsModal
          goals={goalsApi.goals}
          loading={goalsApi.loading}
          onAddGoal={goalsApi.addGoal}
          onUpdateGoal={goalsApi.updateGoal}
          onRemoveGoal={goalsApi.removeGoal}
          onAddEvidence={goalsApi.addEvidence}
          onUpdateEvidence={goalsApi.updateEvidence}
          onRemoveEvidence={goalsApi.removeEvidence}
          onClose={() => setGoalsOpen(false)}
        />
      )}
      {deleteAccountOpen && (
        <AccountDeletionModal
          user={session.user}
          onClose={() => setDeleteAccountOpen(false)}
        />
      )}
    </div>
  );
}

const appStyle = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
};

const loadingStyle = {
  height: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  color: 'var(--color-text-secondary)',
};
