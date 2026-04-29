import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import {
  loadWorkspaces,
  getStoredActiveWorkspaceId,
  setStoredActiveWorkspaceId,
} from './lib/workspaces.js';
import { useTime } from './hooks/useTime.js';
import Auth from './components/Auth.jsx';
import TopBar from './components/TopBar.jsx';
import WorkspaceView from './components/WorkspaceView.jsx';
import RunningTimerIndicator from './components/RunningTimerIndicator.jsx';

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  // Cached so the indicator can show a name when the timer task isn't in the
  // currently-loaded tasks list (eg you switched workspaces).
  const [runningTaskTitle, setRunningTaskTitle] = useState('');

  // Time tracking lives at the app level so the timer survives workspace switches.
  const time = useTime(activeWorkspace?.id || null);

  // Auth subscription
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

  // Workspace loading
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

  if (checking) {
    return <div style={loadingStyle}>…</div>;
  }

  if (!session) {
    return <Auth />;
  }

  const indicator = time.runningTimer ? (
    <RunningTimerIndicator
      runningTimer={time.runningTimer}
      elapsedMs={time.elapsedMsForRunning}
      taskTitle={runningTaskTitle}
      onStop={() => {
        time.stopTimer();
        setRunningTaskTitle('');
      }}
      onCancel={() => {
        time.cancelTimer();
        setRunningTaskTitle('');
      }}
    />
  ) : null;

  return (
    <div style={appStyle}>
      <TopBar
        user={session.user}
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        onSwitchWorkspace={handleSwitch}
        onWorkspacesChanged={handleWorkspacesChanged}
        timerIndicator={indicator}
      />
      <WorkspaceView
        key={activeWorkspace?.id || 'personal'}
        activeWorkspace={activeWorkspace}
        time={time}
        onTimerStartedForTask={(task) => setRunningTaskTitle(task?.title || '')}
      />
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
