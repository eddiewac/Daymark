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
import PrivacyPage from './components/legal/PrivacyPage.jsx';
import TermsPage from './components/legal/TermsPage.jsx';
import SecurityPage from './components/legal/SecurityPage.jsx';

// Public-facing legal pages — rendered before the auth check so anyone can read them.
const LEGAL_ROUTES = {
  '/privacy': PrivacyPage,
  '/terms': TermsPage,
  '/security': SecurityPage,
};

export default function App() {
  // Read pathname once at mount. We don't need reactive routing since the legal
  // pages link to /, which causes a full reload back to the app.
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';

  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [managingWorkspace, setManagingWorkspace] = useState(null);
  const [runningTaskTitle, setRunningTaskTitle] = useState('');
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

  // ── MFA gate state ─────────────────────────────────────────────────────
  // 'unknown' = haven't checked yet (loading); 'needs' = challenge required;
  // 'ok' = no challenge needed or already passed.
  const [mfaStatus, setMfaStatus] = useState('unknown');

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
      // Whenever the session changes (sign-in, sign-out, MFA verify, refresh),
      // re-check whether MFA is needed. Reset to 'unknown' to trigger the
      // gate effect below.
      setMfaStatus('unknown');
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Re-check MFA whenever the session changes (and on initial load if signed in).
  // We do this in its own effect so it can run async without blocking render.
  useEffect(() => {
    if (!session) {
      setMfaStatus('ok'); // no session = no MFA needed (Auth view handles login)
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (cancelled) return;
        if (error) {
          // Can't check — fail open. Better UX than locking users out.
          console.error('Could not check MFA level:', error);
          setMfaStatus('ok');
          return;
        }
        if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
          setMfaStatus('needs');
        } else {
          setMfaStatus('ok');
        }
      } catch (err) {
        console.error('MFA check threw:', err);
        if (!cancelled) setMfaStatus('ok');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!session || mfaStatus !== 'ok') {
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

  // Public legal pages — accessible regardless of auth state
  const LegalComponent = LEGAL_ROUTES[pathname];
  if (LegalComponent) return <LegalComponent />;

  if (!session) return <Auth />;

  // MFA gate — session exists but second factor needed
  if (mfaStatus === 'needs') {
    return (
      <MfaChallenge
        onVerified={() => setMfaStatus('ok')}
        onCancel={async () => {
          await supabase.auth.signOut();
          // signOut triggers onAuthStateChange which resets state
        }}
      />
    );
  }

  // While we're still checking AAL on first load with a session, show a
  // brief loading indicator. Usually invisible.
  if (mfaStatus === 'unknown') return <div style={loadingStyle}>…</div>;

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
