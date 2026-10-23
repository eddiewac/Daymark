import { useEffect, useState, useRef } from 'react';
import { supabase, getCurrentUser } from './lib/supabase.js';
import {
  loadWorkspaces,
  getStoredActiveWorkspaceId,
  setStoredActiveWorkspaceId,
} from './lib/workspaces.js';
import { loadAssignedTasks } from './lib/tasks.js';
import { useTime, fmtElapsed } from './hooks/useTime.js';
import { useSaveStatus } from './components/save/SaveStatus.jsx';
import TimerFlowDialog from './components/time/TimerFlowDialog.jsx';
import { useGoals } from './hooks/useGoals.js';
import Auth from './components/Auth.jsx';
import MfaChallenge from './components/MfaChallenge.jsx';
import TopBar from './components/TopBar.jsx';
import WorkspaceView from './components/WorkspaceView.jsx';
import RunningTimerIndicator from './components/RunningTimerIndicator.jsx';
import StopTimerDialog from './components/StopTimerDialog.jsx';
import WorkspaceManagePopover from './components/WorkspaceManagePopover.jsx';
import PendingInvitesBanner from './components/PendingInvitesBanner.jsx';
import GoalsModal from './components/goals/GoalsModal.jsx';
import GoalsFloatingButton from './components/goals/GoalsFloatingButton.jsx';
import AccountDeletionModal from './components/AccountDeletionModal.jsx';
import LandingPage from './components/LandingPage.jsx';
import PrivacyPage from './components/legal/PrivacyPage.jsx';
import TermsPage from './components/legal/TermsPage.jsx';
import SecurityPage from './components/legal/SecurityPage.jsx';

const LEGAL_ROUTES = {
  '/privacy': PrivacyPage,
  '/terms': TermsPage,
  '/security': SecurityPage,
};

export default function App() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';

  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [managingWorkspace, setManagingWorkspace] = useState(null);
  const [runningTaskTitle, setRunningTaskTitle] = useState('');
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

  const [mfaStatus, setMfaStatus] = useState('unknown');
  const lastCheckedSessionRef = useRef(null);

  // Notification bell: assignments are user-level (across all workspaces), so
  // they're loaded here at App level — independent of the active workspace —
  // and passed to TopBar's bell.
  const [notifAssignments, setNotifAssignments] = useState([]);
  const [notifUserId, setNotifUserId] = useState(null);

  const time = useTime(activeWorkspace?.id || null);
  const goalsApi = useGoals();
  const { runSave, showToast } = useSaveStatus();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession((prev) => {
        if (prev?.access_token === newSession?.access_token) return prev;
        lastCheckedSessionRef.current = null;
        return newSession;
      });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setMfaStatus('ok');
      lastCheckedSessionRef.current = null;
      return;
    }
    if (lastCheckedSessionRef.current === session.access_token) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (cancelled) return;
        if (error) {
          console.error('Could not check MFA level:', error);
          setMfaStatus('ok');
          lastCheckedSessionRef.current = session.access_token;
          return;
        }
        if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
          setMfaStatus('needs');
        } else {
          setMfaStatus('ok');
        }
        lastCheckedSessionRef.current = session.access_token;
      } catch (err) {
        console.error('MFA check threw:', err);
        if (!cancelled) {
          setMfaStatus('ok');
          lastCheckedSessionRef.current = session.access_token;
        }
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [session]);

  useEffect(() => {
    if (!session || mfaStatus !== 'ok') {
      setWorkspaces([]);
      setActiveWorkspace(null);
      return;
    }
    let cancelled = false;
    loadWorkspaces().then((list) => {
      if (cancelled) return;
      setWorkspaces(list);
      const savedId = getStoredActiveWorkspaceId();
      const matched = savedId ? list.find((w) => w.id === savedId) : null;
      setActiveWorkspace(matched || null);
    }).catch((err) => {
      console.error('Failed to load workspaces:', err);
    });
    return () => {
      cancelled = true;
    };
  }, [session, mfaStatus]);

  // Load assignments for the notification bell + subscribe for live updates.
  // User-level (not tied to active workspace), so it lives here, not in
  // WorkspaceView. Mirrors the assignment realtime the task hook uses.
  useEffect(() => {
    if (!session || mfaStatus !== 'ok') {
      setNotifAssignments([]);
      setNotifUserId(null);
      return;
    }
    let mounted = true;
    let channel;
    (async () => {
      const user = await getCurrentUser();
      if (!user || !mounted) return;
      setNotifUserId(user.id);
      const asgn = await loadAssignedTasks();
      if (mounted) setNotifAssignments(asgn);

      channel = supabase
        .channel(`notif-assignments-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'assignments',
            filter: `assigned_to=eq.${user.id}`,
          },
          async () => {
            // On any change, reload the list — simple and always correct.
            const fresh = await loadAssignedTasks();
            if (mounted) setNotifAssignments(fresh);
          }
        )
        .subscribe();
    })();
    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [session, mfaStatus]);

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

  // Legal pages — accessible regardless of auth state
  const LegalComponent = LEGAL_ROUTES[pathname];
  if (LegalComponent) return <LegalComponent />;

  // Routing rules:
  //   /         → Landing page (signed out) or app (signed in)
  //   /login    → Auth screen (signed out) or app (signed in)
  //   /privacy, /terms, /security → handled above
  //   anything else (signed out) → Landing page
  //   anything else (signed in) → app

  if (!session) {
    if (pathname === '/login') return <Auth />;
    return <LandingPage />;
  }

  if (mfaStatus === 'needs') {
    return (
      <MfaChallenge
        onVerified={() => setMfaStatus('ok')}
        onCancel={async () => {
          await supabase.auth.signOut();
        }}
      />
    );
  }

  if (mfaStatus === 'unknown') return <div style={loadingStyle}>…</div>;

  const indicator = time.runningTimer ? (
    <RunningTimerIndicator
      runningTimer={time.runningTimer}
      elapsedMs={time.elapsedMsForRunning}
      taskTitle={time.runningTimer?.taskTitle || runningTaskTitle}
      onStop={time.requestStop}
      onCancel={() => time.requestDiscard()}
    />
  ) : null;

  return (
    <div style={appStyle}>
      <PendingInvitesBanner
        session={session}
        onAccepted={async (newWsId) => {
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
        assignedTasks={notifAssignments}
        currentUserId={notifUserId}
      />
      <WorkspaceView
        key={activeWorkspace?.id || 'personal'}
        activeWorkspace={activeWorkspace}
        time={time}
        onTimerStartedForTask={(task) => setRunningTaskTitle(task?.title || '')}
      />
      {time.pendingPrompt?.type === 'discard' && (
        <TimerFlowDialog
          title="Discard time?"
          body={`Discard ${fmtElapsed(time.elapsedMsForRunning)} without logging?`}
          onClose={time.cancelPrompt}
          actions={[
            { label: 'Keep running', onClick: time.cancelPrompt },
            {
              label: 'Confirm discard',
              danger: true,
              onClick: async () => {
                const label = fmtElapsed(time.elapsedMsForRunning);
                await time.discardTimer();
                setRunningTaskTitle('');
                showToast(`Discarded ${label} — not logged`);
              },
            },
          ]}
        />
      )}
      {time.pendingPrompt?.type === 'short' && (
        <TimerFlowDialog
          title="Under 1 minute"
          body={`You timed less than a minute on “${time.runningTimer?.taskTitle || runningTaskTitle || 'this task'}”. Round up to save, or discard.`}
          onClose={time.cancelPrompt}
          actions={[
            {
              label: 'Discard',
              onClick: async () => {
                await time.discardTimer();
                setRunningTaskTitle('');
                showToast('Discarded sub-1-min — not logged');
              },
            },
            {
              label: 'Round to 1 min & save',
              primary: true,
              onClick: async () => {
                const title = time.runningTimer?.taskTitle || runningTaskTitle || 'task';
                const result = await runSave(() => time.confirmRoundMinute());
                if (result?.ok === false) return;
                setRunningTaskTitle('');
                const mins = result.minutes || 1;
                showToast(`Logged ${mins} min · ${title}${mins === 1 ? ' (rounded)' : ''}`, {
                  onUndo: result.blockId
                    ? () => runSave(() => time.voidBlock(result.blockId))
                    : undefined,
                });
              },
            },
          ]}
        />
      )}
      {time.pendingStop && (
        <StopTimerDialog
          pendingStop={time.pendingStop}
          taskTitle={time.runningTimer?.taskTitle || runningTaskTitle}
          onConfirm={async (start, end) => {
            const title = time.runningTimer?.taskTitle || runningTaskTitle || 'task';
            const result = await runSave(() => time.confirmStop(start, end));
            if (result?.ok === false) return;
            setRunningTaskTitle('');
            showToast(`Logged ${result.minutes || 1} min · ${title}`, {
              onUndo: result.blockId
                ? () => runSave(() => time.voidBlock(result.blockId))
                : undefined,
            });
          }}
          onCancel={time.cancelStop}
          onDiscard={() => {
            const label = fmtElapsed(time.elapsedMsForRunning);
            time.discardTimer();
            setRunningTaskTitle('');
            showToast(`Discarded ${label} — not logged`);
          }}
        />
      )}
      {managingWorkspace && (
        <WorkspaceManagePopover
          workspace={managingWorkspace}
          onClose={() => setManagingWorkspace(null)}
          onDeleted={async (deletedId) => {
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
