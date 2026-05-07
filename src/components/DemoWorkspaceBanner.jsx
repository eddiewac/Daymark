import { useState } from 'react';

// ── DemoWorkspaceBanner ─────────────────────────────────────────────────────
// Persistent strip at the top of the demo workspace explaining what it is
// and giving a clear path to delete it.

export default function DemoWorkspaceBanner({ workspaceName, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <div style={styles.bar}>
      <span style={styles.icon}>📚</span>
      <div style={styles.text}>
        <strong>This is the demo workspace.</strong> Realistic example data
        for exploring Daymark — projects, tasks, comms, and more. Switch to
        your personal workspace any time via the workspace selector.
      </div>
      {!confirming ? (
        <button onClick={() => setConfirming(true)} style={styles.deleteBtn}>
          Delete demo
        </button>
      ) : (
        <div style={styles.confirm}>
          <span style={styles.confirmText}>Delete this workspace?</span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={styles.confirmBtn}
          >
            {deleting ? 'Deleting…' : 'Yes, delete'}
          </button>
          <button onClick={() => setConfirming(false)} style={styles.cancelBtn}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 16px',
    background: '#534AB708',
    borderBottom: '0.5px solid #534AB733',
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    flexShrink: 0,
  },
  icon: { fontSize: 14, flexShrink: 0 },
  text: { flex: 1, lineHeight: 1.4 },
  deleteBtn: {
    padding: '4px 12px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    fontSize: 11,
    cursor: 'pointer',
    flexShrink: 0,
  },
  confirm: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  confirmText: { fontSize: 11, color: 'var(--color-text-primary)' },
  confirmBtn: {
    padding: '4px 12px',
    background: '#e24b4a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '4px 12px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    fontSize: 11,
    cursor: 'pointer',
  },
};
