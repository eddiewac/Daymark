import { useState, useEffect, useCallback } from 'react';
import {
  inviteToShare,
  loadMyShares,
  acceptShare,
  declineShare,
  revokeShare,
  updateShareVisibility,
} from '../../lib/loadShares.js';
import { loadWorkspaces } from '../../lib/workspaces.js';
import { displayName } from '../../lib/userPrefs.js';

// ── SharingPanel ────────────────────────────────────────────────────────────
// The whole consent-based sharing flow in one place:
//   • invite someone (by email) to share their workload with me
//   • see & act on invites addressed to me (accept with a visibility choice)
//   • see who's sharing with me, and invites I've sent (with revoke)
//
// Props:
//   myName    – the current user's display name (for the accept snapshot)
//   onChanged – called after any change, so the parent can refresh the grid

export default function SharingPanel({ myName, onChanged }) {
  const [shares, setShares] = useState({
    sharingWithMe: [],
    pendingSent: [],
    pendingReceived: [],
    myActiveShares: [],
  });
  const [workspaces, setWorkspaces] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  // Which received-invite is mid-accept (showing the workspace choice), if any
  const [acceptingId, setAcceptingId] = useState(null);
  // Which of my active shares is being edited (showing the workspace choice)
  const [editingShareId, setEditingShareId] = useState(null);

  const refresh = useCallback(async () => {
    const [s, ws] = await Promise.all([loadMyShares(), loadWorkspaces()]);
    setShares(s);
    setWorkspaces(ws);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const notify = (text) => {
    setMsg(text);
    setTimeout(() => setMsg(null), 3000);
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setBusy(true);
    const res = await inviteToShare(email);
    setBusy(false);
    if (res.error) {
      notify(`Couldn't invite: ${res.error}`);
    } else {
      notify(`Invitation sent to ${email}.`);
      setInviteEmail('');
      refresh();
    }
  };

  const handleDecline = async (id) => {
    await declineShare(id);
    refresh();
    onChanged && onChanged();
  };

  const handleRevoke = async (id) => {
    await revokeShare(id);
    refresh();
    onChanged && onChanged();
  };

  return (
    <div style={styles.wrap}>
      {msg && <div style={styles.toast}>{msg}</div>}

      {/* ── Invites addressed to me ── */}
      {shares.pendingReceived.length > 0 && (
        <section style={styles.section}>
          <div style={styles.sectionTitle}>Invitations to share your workload</div>
          {shares.pendingReceived.map((inv) => (
            <div key={inv.id} style={styles.inviteCard}>
              <div style={styles.inviteText}>
                <strong>{displayName({ email: inv.viewer_email })}</strong> would
                like to see your workload.
              </div>
              {acceptingId === inv.id ? (
                <AcceptChoice
                  workspaces={workspaces}
                  myName={myName}
                  onCancel={() => setAcceptingId(null)}
                  onConfirm={async ({ shareAll, visibility }) => {
                    await acceptShare(inv.id, { myDisplayName: myName, shareAll, visibility });
                    setAcceptingId(null);
                    notify('Now sharing your workload.');
                    refresh();
                    onChanged && onChanged();
                  }}
                />
              ) : (
                <div style={styles.btnRow}>
                  <button
                    style={styles.primaryBtn}
                    onClick={() => setAcceptingId(inv.id)}
                  >
                    Accept
                  </button>
                  <button style={styles.ghostBtn} onClick={() => handleDecline(inv.id)}>
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ── Invite someone ── */}
      <section style={styles.section}>
        <div style={styles.sectionTitle}>See someone's workload</div>
        <div style={styles.sectionHint}>
          Invite a colleague by email. They choose what to share with you, and
          can stop sharing at any time.
        </div>
        <div style={styles.inviteRow}>
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            placeholder="colleague@company.com"
            style={styles.input}
          />
          <button
            style={{ ...styles.primaryBtn, opacity: busy ? 0.5 : 1 }}
            onClick={handleInvite}
            disabled={busy}
          >
            Invite
          </button>
        </div>
      </section>

      {/* ── People sharing with me ── */}
      {shares.sharingWithMe.length > 0 && (
        <section style={styles.section}>
          <div style={styles.sectionTitle}>Sharing with you</div>
          {shares.sharingWithMe.map((s) => (
            <div key={s.id} style={styles.row}>
              <span style={styles.rowName}>
                {displayName({ name: s.sharer_name, email: s.sharer_email })}
              </span>
              <button style={styles.ghostBtn} onClick={() => handleRevoke(s.id)}>
                Remove
              </button>
            </div>
          ))}
        </section>
      )}

      {/* ── People I'm sharing my load with (I control these) ── */}
      {shares.myActiveShares.length > 0 && (
        <section style={styles.section}>
          <div style={styles.sectionTitle}>You're sharing with</div>
          {shares.myActiveShares.map((s) => (
            <div key={s.id} style={styles.shareItem}>
              <div style={styles.row}>
                <span style={styles.rowName}>
                  {displayName({ email: s.viewer_email })}
                  <span style={styles.scopeTag}>
                    {s.share_all
                      ? 'all workspaces'
                      : `${Object.values(s.visibility || {}).filter(Boolean).length} workspace(s)`}
                  </span>
                </span>
                <div style={styles.btnRow}>
                  <button
                    style={styles.ghostBtn}
                    onClick={() =>
                      setEditingShareId(editingShareId === s.id ? null : s.id)
                    }
                  >
                    {editingShareId === s.id ? 'Close' : 'Edit'}
                  </button>
                  <button style={styles.ghostBtn} onClick={() => handleRevoke(s.id)}>
                    Stop
                  </button>
                </div>
              </div>
              {editingShareId === s.id && (
                <AcceptChoice
                  workspaces={workspaces}
                  initialShareAll={s.share_all}
                  initialVisibility={s.visibility || {}}
                  confirmLabel="Save"
                  onCancel={() => setEditingShareId(null)}
                  onConfirm={async ({ shareAll, visibility }) => {
                    await updateShareVisibility(s.id, { shareAll, visibility });
                    setEditingShareId(null);
                    notify('Updated what you share.');
                    refresh();
                    onChanged && onChanged();
                  }}
                />
              )}
            </div>
          ))}
        </section>
      )}

      {/* ── Invites I've sent, not yet accepted ── */}
      {shares.pendingSent.length > 0 && (
        <section style={styles.section}>
          <div style={styles.sectionTitle}>Invitations sent</div>
          {shares.pendingSent.map((s) => (
            <div key={s.id} style={styles.row}>
              <span style={styles.rowName}>
                {s.sharer_email}{' '}
                <span style={styles.pendingTag}>pending</span>
              </span>
              <button style={styles.ghostBtn} onClick={() => handleRevoke(s.id)}>
                Cancel
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

// The per-workspace choice shown when accepting an invite or editing a share.
function AcceptChoice({
  workspaces,
  onConfirm,
  onCancel,
  initialShareAll = true,
  initialVisibility = {},
  confirmLabel = 'Confirm',
}) {
  const [mode, setMode] = useState(initialShareAll ? 'all' : 'choose'); // 'all' | 'choose'
  const [selected, setSelected] = useState(initialVisibility); // { wsId: true }

  const toggle = (id) =>
    setSelected((s) => ({ ...s, [id]: !s[id] }));

  const confirm = () => {
    if (mode === 'all') {
      onConfirm({ shareAll: true, visibility: {} });
    } else {
      onConfirm({ shareAll: false, visibility: selected });
    }
  };

  const anyChosen =
    mode === 'all' || Object.values(selected).some(Boolean);

  return (
    <div style={styles.acceptBox}>
      <div style={styles.acceptTitle}>What would you like to share?</div>
      <label style={styles.choiceRow}>
        <input
          type="radio"
          checked={mode === 'all'}
          onChange={() => setMode('all')}
        />
        <span>
          <strong>All my workspaces</strong>
          <span style={styles.choiceHint}> — including any I join later</span>
        </span>
      </label>
      <label style={styles.choiceRow}>
        <input
          type="radio"
          checked={mode === 'choose'}
          onChange={() => setMode('choose')}
        />
        <span>
          <strong>Choose workspaces</strong>
          <span style={styles.choiceHint}> — only the ones you pick</span>
        </span>
      </label>

      {mode === 'choose' && (
        <div style={styles.wsList}>
          {workspaces.length === 0 && (
            <div style={styles.choiceHint}>No workspaces found.</div>
          )}
          {workspaces.map((ws) => (
            <label key={ws.id} style={styles.wsRow}>
              <input
                type="checkbox"
                checked={!!selected[ws.id]}
                onChange={() => toggle(ws.id)}
              />
              <span>{ws.name}</span>
            </label>
          ))}
        </div>
      )}

      <div style={styles.btnRow}>
        <button
          style={{ ...styles.primaryBtn, opacity: anyChosen ? 1 : 0.5 }}
          onClick={confirm}
          disabled={!anyChosen}
        >
          {confirmLabel}
        </button>
        <button style={styles.ghostBtn} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 16 },
  toast: {
    padding: '8px 12px',
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 14,
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 10,
    background: 'var(--bg-surface)',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  sectionHint: { fontSize: 12, color: 'var(--color-text-secondary)' },
  inviteRow: { display: 'flex', gap: 8 },
  input: {
    flex: 1,
    padding: '7px 10px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 8,
    fontSize: 13,
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  inviteCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 12,
    background: 'var(--color-background-secondary)',
    borderRadius: 8,
  },
  inviteText: { fontSize: 13, color: 'var(--color-text-primary)' },
  btnRow: { display: 'flex', gap: 8 },
  primaryBtn: {
    padding: '6px 14px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  ghostBtn: {
    padding: '6px 14px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
  },
  rowName: { fontSize: 13, color: 'var(--color-text-primary)' },
  shareItem: { display: 'flex', flexDirection: 'column', gap: 8 },
  scopeTag: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    marginLeft: 8,
    padding: '1px 6px',
    background: 'var(--color-background-secondary)',
    borderRadius: 4,
  },
  pendingTag: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
  },
  acceptBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 12,
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 8,
  },
  acceptTitle: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' },
  choiceRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    fontSize: 13,
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
  },
  choiceHint: { color: 'var(--color-text-secondary)', fontWeight: 400 },
  wsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    paddingLeft: 24,
    borderLeft: '2px solid var(--color-border-tertiary)',
    marginLeft: 6,
  },
  wsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
  },
};

