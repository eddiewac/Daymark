import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { createWorkspace, setStoredActiveWorkspaceId } from '../lib/workspaces.js';

export default function TopBar({
  user,
  workspaces,
  activeWorkspace,
  onSwitchWorkspace,
  onWorkspacesChanged,
  onManageWorkspace,
  onOpenGoals,
  onOpenDeleteAccount,
  timerIndicator,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const ws = await createWorkspace(newName.trim());
      setNewName('');
      setShowCreate(false);
      setStoredActiveWorkspaceId(ws.id);
      onWorkspacesChanged?.(ws.id);
    } catch (err) {
      alert('Could not create workspace: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const signOut = async () => {
    setStoredActiveWorkspaceId(null);
    await supabase.auth.signOut();
  };

  return (
    <header style={styles.bar}>
      <div style={styles.logo}>
        Day<span style={{ color: '#534AB7' }}>mark</span>
      </div>

      <div style={styles.divider} />

      <button
        style={{
          ...styles.tab,
          ...(activeWorkspace === null ? styles.tabActive : {}),
        }}
        onClick={() => onSwitchWorkspace(null)}
      >
        Personal
      </button>

      {workspaces.map((ws) => {
        const isActive = activeWorkspace?.id === ws.id;
        return (
          <div key={ws.id} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
              }}
              onClick={() => onSwitchWorkspace(ws)}
            >
              {ws.name}
            </button>
            {isActive && (
              <button
                style={styles.manageBtn}
                onClick={() => onManageWorkspace?.(ws)}
                title="Manage members & invites"
              >
                👥
              </button>
            )}
          </div>
        );
      })}

      <button style={styles.addWs} onClick={() => setShowCreate((v) => !v)}>
        + Team
      </button>

      {showCreate && (
        <div style={styles.createPopover}>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Workspace name"
            style={styles.popoverInput}
          />
          <button onClick={handleCreate} disabled={creating} style={styles.popoverBtn}>
            {creating ? '…' : 'Create'}
          </button>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {timerIndicator}

      <button
        onClick={() => window.dispatchEvent(new CustomEvent('daymark-quick-capture'))}
        style={styles.quickBtn}
        title="Quick capture (Cmd/Ctrl+K)"
      >
        + New
      </button>

      <button onClick={onOpenGoals} style={styles.goalsBtn} title="Personal goals">
        🎯 Goals
      </button>

      <div style={{ position: 'relative' }}>
        <button onClick={() => setShowMenu((v) => !v)} style={styles.userBtn}>
          {user?.email}
        </button>
        {showMenu && (
          <div style={styles.menu}>
            <button onClick={signOut} style={styles.menuItem}>
              Sign out
            </button>
            <div style={styles.menuDivider} />
            <button
              onClick={() => {
                setShowMenu(false);
                onOpenDeleteAccount?.();
              }}
              style={{ ...styles.menuItem, color: '#e24b4a' }}
            >
              Delete account…
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    background: '#fff',
    borderBottom: '0.5px solid var(--color-border-secondary)',
    position: 'relative',
  },
  logo: { fontSize: 16, fontWeight: 600 },
  divider: {
    width: 1,
    height: 16,
    background: 'var(--color-border-primary)',
    margin: '0 6px',
  },
  tab: {
    padding: '4px 12px',
    fontSize: 12,
    background: 'transparent',
    border: '0.5px solid transparent',
    borderRadius: 8,
    color: 'var(--color-text-secondary)',
  },
  tabActive: {
    background: '#534AB711',
    color: '#534AB7',
    fontWeight: 500,
  },
  manageBtn: {
    width: 28,
    height: 28,
    background: 'transparent',
    border: 'none',
    fontSize: 14,
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    marginLeft: 2,
  },
  addWs: {
    padding: '4px 10px',
    fontSize: 11,
    background: 'transparent',
    border: '0.5px dashed var(--color-border-primary)',
    borderRadius: 8,
    color: 'var(--color-text-secondary)',
  },
  quickBtn: {
    padding: '5px 12px',
    fontSize: 11,
    background: '#534AB7',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    marginRight: 8,
    fontWeight: 500,
  },
  goalsBtn: {
    padding: '5px 12px',
    fontSize: 11,
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    marginRight: 8,
  },
  createPopover: {
    position: 'absolute',
    top: 44,
    left: 240,
    background: '#fff',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    padding: 8,
    display: 'flex',
    gap: 4,
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
  popoverInput: {
    padding: '4px 8px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 12,
    width: 160,
  },
  popoverBtn: {
    padding: '4px 10px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
  },
  userBtn: {
    padding: '4px 10px',
    fontSize: 11,
    background: 'transparent',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 8,
    color: 'var(--color-text-secondary)',
  },
  menu: {
    position: 'absolute',
    top: 30,
    right: 0,
    background: '#fff',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    padding: 4,
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    minWidth: 120,
  },
  menuItem: {
    width: '100%',
    padding: '6px 10px',
    background: 'transparent',
    border: 'none',
    textAlign: 'left',
    fontSize: 12,
    borderRadius: 6,
    cursor: 'pointer',
  },
  menuDivider: {
    height: 0.5,
    background: 'var(--color-border-tertiary)',
    margin: '4px 0',
  },
};
