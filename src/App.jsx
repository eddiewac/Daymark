import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import {
  loadWorkspaces,
  getStoredActiveWorkspaceId,
  setStoredActiveWorkspaceId,
} from './lib/workspaces.js';
import Auth from './components/Auth.jsx';
import TopBar from './components/TopBar.jsx';
import WorkspaceView from './components/WorkspaceView.jsx';

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);

  // Subscribe to auth state
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

  // When signed in, load workspaces and pick the saved active one
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

  return (
    <div style={appStyle}>
      <TopBar
        user={session.user}
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        onSwitchWorkspace={handleSwitch}
        onWorkspacesChanged={handleWorkspacesChanged}
      />
      <WorkspaceView
        key={activeWorkspace?.id || 'personal'}
        activeWorkspace={activeWorkspace}
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
