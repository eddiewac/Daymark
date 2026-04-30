import { useEffect, useState } from 'react';
import {
  inviteToWorkspace,
  loadInvitesForWorkspace,
  revokeInvite,
} from '../lib/invites.js';
import { loadWorkspaceMembers } from '../lib/workspaces.js';

export default function WorkspaceManagePopover({ workspace, onClose }) {
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const flash = (text, kind = 'msg') => {
    if (kind === 'err') {
      setErr(text);
      setMsg('');
    } else {
      setMsg(text);
      setErr('');
    }
    setTimeout(() => {
      setErr('');
      setMsg('');
    }, 4000);
  };

  const refresh = async () => {
    setLoading(true);
    const [m, i] = await Promise.all([
      loadWorkspaceMembers(workspace.id),
      loadInvitesForWorkspace(workspace.id),
    ]);
    setMembers(m);
    setInvites(i);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [workspace.id]);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await inviteToWorkspace(workspace.id, email);
      flash(`Invite sent to ${email.trim()}.`);
      setEmail('');
      refresh();
    } catch (e) {
      flash(e.message || 'Could not send invite.', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (inviteId) => {
    await revokeInvite(inviteId);
    refresh();
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Manage workspace</div>
            <div style={styles.subtitle}>{workspace.name}</div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <section style={styles.section}>
          <div style={styles.sectionTitle}>Invite a teammate</div>
          <div style={styles.sectionHint}>
            They'll see a pending invite when they sign in to Daymark with this
            email. They don't need to have an account yet.
          </div>
          <div style={styles.inviteRow}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !busy && handleInvite()}
              placeholder="teammate@company.com"
              style={styles.input}
              disabled={busy}
            />
            <button
              onClick={handleInvite}
              disabled={busy || !email.trim()}
              style={{
                ...styles.primaryBtn,
                opacity: busy || !email.trim() ? 0.5 : 1,
                cursor: busy || !email.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {busy ? 'Sending…' : 'Send invite'}
            </button>
          </div>
          {msg && <div style={styles.flashOk}>{msg}</div>}
          {err && <div style={styles.flashErr}>{err}</div>}
        </section>

        {invites.length > 0 && (
          <section style={styles.section}>
            <div style={styles.sectionTitle}>
              Pending invites ({invites.length})
            </div>
            <div style={styles.list}>
              {invites.map((i) => (
                <div key={i.id} style={styles.listRow}>
                  <div style={styles.listEmail}>{i.invited_email}</div>
                  <div style={styles.listMeta}>
                    sent {fmtRel(i.created_at)}
                  </div>
                  <button
                    onClick={() => handleRevoke(i.id)}
                    style={styles.revokeBtn}
                    title="Revoke invite"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section style={styles.section}>
          <div style={styles.sectionTitle}>
            Members ({members.length})
          </div>
          {loading ? (
            <div style={styles.loading}>Loading…</div>
          ) : (
            <div style={styles.list}>
              {members.map((m) => (
                <div key={m.id} style={styles.listRow}>
                  <div style={styles.listEmail}>
                    {m.email || `User ${m.id.slice(0, 8)}…`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function fmtRel(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: {
    background: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 480,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: { fontSize: 14, fontWeight: 600 },
  subtitle: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    marginTop: 2,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 22,
    color: 'var(--color-text-secondary)',
    width: 28,
    height: 28,
    cursor: 'pointer',
  },
  section: {
    background: 'var(--color-background-secondary)',
    borderRadius: 8,
    padding: 12,
  },
  sectionTitle: { fontSize: 12, fontWeight: 600, marginBottom: 4 },
  sectionHint: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginBottom: 10,
    lineHeight: 1.5,
  },
  inviteRow: { display: 'flex', gap: 6 },
  input: {
    flex: 1,
    padding: '6px 10px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 12,
    background: '#fff',
    outline: 'none',
  },
  primaryBtn: {
    padding: '6px 14px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
  },
  flashOk: {
    fontSize: 11,
    color: '#1d9e75',
    marginTop: 8,
    fontWeight: 500,
  },
  flashErr: {
    fontSize: 11,
    color: '#e24b4a',
    marginTop: 8,
    fontWeight: 500,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 4 },
  listRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    background: '#fff',
    borderRadius: 6,
  },
  listEmail: {
    flex: 1,
    fontSize: 12,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  listMeta: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
  },
  revokeBtn: {
    padding: '3px 8px',
    background: 'transparent',
    border: '0.5px solid #e24b4a',
    color: '#e24b4a',
    borderRadius: 6,
    fontSize: 10,
    cursor: 'pointer',
  },
  loading: {
    padding: 8,
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
  },
};
