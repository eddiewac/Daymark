import { useEffect, useState } from 'react';
import {
  loadMyPendingInvites,
  acceptInvite,
  declineInvite,
} from '../lib/invites.js';

export default function PendingInvitesBanner({ session, onAccepted }) {
  const [invites, setInvites] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState('');

  const refresh = async () => {
    const list = await loadMyPendingInvites();
    setInvites(list);
  };

  useEffect(() => {
    if (!session) return;
    refresh();
  }, [session?.user?.id]);

  if (invites.length === 0) return null;

  const handleAccept = async (invite) => {
    setBusyId(invite.id);
    setErr('');
    try {
      await acceptInvite(invite);
      onAccepted?.(invite.workspaceId);
      refresh();
    } catch (e) {
      setErr(e.message || 'Could not accept invite.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (invite) => {
    setBusyId(invite.id);
    try {
      await declineInvite(invite.id);
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={styles.bar}>
      <div style={styles.label}>
        {invites.length === 1 ? 'You have a workspace invite' : `You have ${invites.length} workspace invites`}
      </div>
      {invites.map((i) => (
        <div key={i.id} style={styles.row}>
          <div style={styles.who}>
            <strong>{i.workspaceName}</strong>
          </div>
          <button
            onClick={() => handleAccept(i)}
            disabled={busyId === i.id}
            style={styles.accept}
          >
            {busyId === i.id ? '…' : 'Accept'}
          </button>
          <button
            onClick={() => handleDecline(i)}
            disabled={busyId === i.id}
            style={styles.decline}
          >
            Decline
          </button>
        </div>
      ))}
      {err && <div style={styles.err}>{err}</div>}
    </div>
  );
}

const styles = {
  bar: {
    background: 'var(--accent-soft)',
    borderBottom: '0.5px solid var(--accent-soft-border)',
    padding: '8px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    fontSize: 12,
  },
  label: {
    fontWeight: 600,
    color: 'var(--accent)',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  who: {
    color: 'var(--color-text-primary)',
  },
  accept: {
    padding: '3px 12px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
  },
  decline: {
    padding: '3px 10px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    fontSize: 11,
    cursor: 'pointer',
  },
  err: {
    color: '#e24b4a',
    fontSize: 11,
    fontWeight: 500,
  },
};
