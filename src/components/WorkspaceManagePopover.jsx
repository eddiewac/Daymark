import { useEffect, useState } from 'react';
import {
  inviteToWorkspace,
  loadInvitesForWorkspace,
  revokeInvite,
} from '../lib/invites.js';
import { loadWorkspaceMembers, deleteWorkspace } from '../lib/workspaces.js';
import {
  workspaceState,
  daysLeftInTrial,
  isWorkspaceOwner,
  billingEnforced,
  WORKSPACE_PRICE_USD,
  TRIAL_DAYS,
} from '../lib/billing.js';
import { getCurrentUser } from '../lib/supabase.js';

export default function WorkspaceManagePopover({ workspace, onClose, onDeleted }) {
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [showDanger, setShowDanger] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    getCurrentUser().then((u) => setCurrentUserId(u?.id || null));
  }, []);

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

  const handleDelete = async () => {
    if (deleteConfirmName !== workspace.name) {
      setErr('Type the workspace name exactly to confirm.');
      return;
    }
    setDeleting(true);
    setErr('');
    try {
      await deleteWorkspace(workspace.id);
      onDeleted?.(workspace.id);
      onClose();
    } catch (e) {
      setErr(e.message || 'Could not delete workspace.');
      setDeleting(false);
    }
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

        <BillingSection
          workspace={workspace}
          isOwner={isWorkspaceOwner(workspace, currentUserId)}
        />

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

        {/* Danger zone */}
        <section style={dangerStyles.section}>
          {!showDanger ? (
            <button
              onClick={() => setShowDanger(true)}
              style={dangerStyles.toggleBtn}
            >
              Show danger zone
            </button>
          ) : (
            <div>
              <div style={dangerStyles.title}>Delete this workspace</div>
              <div style={dangerStyles.warning}>
                This permanently deletes the workspace and all its data:
                tasks, projects, notes, time entries, congresses, settings,
                status rounds, and all member access. This cannot be undone.
              </div>
              <div style={dangerStyles.confirmRow}>
                <input
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  placeholder={`Type "${workspace.name}" to confirm`}
                  style={dangerStyles.input}
                  disabled={deleting}
                />
                <button
                  onClick={handleDelete}
                  disabled={deleting || deleteConfirmName !== workspace.name}
                  style={{
                    ...dangerStyles.deleteBtn,
                    opacity:
                      deleting || deleteConfirmName !== workspace.name
                        ? 0.4
                        : 1,
                    cursor:
                      deleting || deleteConfirmName !== workspace.name
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  {deleting ? 'Deleting…' : 'Delete forever'}
                </button>
              </div>
              <button
                onClick={() => {
                  setShowDanger(false);
                  setDeleteConfirmName('');
                  setErr('');
                }}
                style={dangerStyles.cancelLink}
                disabled={deleting}
              >
                Hide
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ── BillingSection ──────────────────────────────────────────────────────────
function BillingSection({ workspace, isOwner }) {
  const state = workspaceState(workspace);
  const days = daysLeftInTrial(workspace);
  const enforced = billingEnforced();

  // Choose banner color/copy based on state
  let bannerStyle = billingStyles.bannerNeutral;
  let title = '';
  let body = '';

  if (state === 'active') {
    bannerStyle = billingStyles.bannerActive;
    title = '✓ Active subscription';
    body = `This workspace is on a paid plan ($${WORKSPACE_PRICE_USD}/month).`;
  } else if (state === 'trial') {
    bannerStyle = billingStyles.bannerTrial;
    title = `Free trial · ${days} day${days === 1 ? '' : 's'} left`;
    body = `Trial ends on ${fmtDate(workspace.trialEndsAt)}. After that, the workspace becomes read-only until you subscribe.`;
  } else if (state === 'expired') {
    bannerStyle = billingStyles.bannerExpired;
    title = 'Trial expired';
    body = enforced
      ? 'This workspace is read-only until you subscribe. Existing data is preserved.'
      : 'Your trial has expired. (Enforcement is currently off — workspace remains usable.)';
  } else if (state === 'past_due') {
    bannerStyle = billingStyles.bannerExpired;
    title = 'Payment past due';
    body = 'Your last payment failed. Update your payment method to restore full access.';
  } else if (state === 'canceled') {
    bannerStyle = billingStyles.bannerTrial;
    title = 'Subscription canceled';
    body = `Access continues until the end of the current billing period.`;
  }

  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>Billing</div>

      <div style={bannerStyle}>
        <div style={billingStyles.bannerTitle}>{title}</div>
        <div style={billingStyles.bannerBody}>{body}</div>
      </div>

      {/* Early-access notice when enforcement is off */}
      {!enforced && (
        <div style={billingStyles.earlyNote}>
          <strong>Early access:</strong> Billing is not yet active during the
          early-access period. All workspaces remain fully usable regardless of
          trial status. We'll give plenty of notice before turning on enforcement.
        </div>
      )}

      {/* Owner-only upgrade button (placeholder for now) */}
      {isOwner && state !== 'active' && (
        <div style={billingStyles.upgradeRow}>
          <button
            onClick={() => alert('Stripe integration not enabled yet. This will become a real checkout flow.')}
            style={billingStyles.upgradeBtn}
          >
            Upgrade — ${WORKSPACE_PRICE_USD}/month
          </button>
          <span style={billingStyles.upgradeHint}>
            Per workspace, unlimited members
          </span>
        </div>
      )}

      {!isOwner && (
        <div style={billingStyles.notOwnerNote}>
          Only the workspace owner can manage billing.
        </div>
      )}
    </section>
  );
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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
    background: 'var(--bg-surface)',
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
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  primaryBtn: {
    padding: '6px 14px',
    background: 'var(--accent)',
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
    background: 'var(--bg-surface)',
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

const dangerStyles = {
  section: {
    background: '#e24b4a08',
    borderRadius: 8,
    padding: 12,
    border: '0.5px solid #e24b4a44',
  },
  toggleBtn: {
    background: 'transparent',
    border: 'none',
    color: '#e24b4a',
    fontSize: 11,
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    color: '#e24b4a',
    marginBottom: 6,
  },
  warning: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.5,
    marginBottom: 10,
  },
  confirmRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 6,
  },
  input: {
    flex: 1,
    padding: '6px 10px',
    border: '0.5px solid #e24b4a55',
    borderRadius: 6,
    fontSize: 12,
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  deleteBtn: {
    padding: '6px 14px',
    background: '#e24b4a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
  },
  cancelLink: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-secondary)',
    fontSize: 10,
    cursor: 'pointer',
    padding: 0,
  },
};

const billingStyles = {
  bannerNeutral: {
    background: 'var(--color-background-tertiary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 8,
    padding: 10,
  },
  bannerActive: {
    background: '#1d9e7511',
    border: '0.5px solid #1d9e7544',
    borderRadius: 8,
    padding: 10,
  },
  bannerTrial: {
    background: 'var(--accent-soft)',
    border: '0.5px solid var(--accent-soft-border)',
    borderRadius: 8,
    padding: 10,
  },
  bannerExpired: {
    background: '#e24b4a11',
    border: '0.5px solid #e24b4a44',
    borderRadius: 8,
    padding: 10,
  },
  bannerTitle: {
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 3,
  },
  bannerBody: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.5,
  },
  earlyNote: {
    marginTop: 10,
    padding: 8,
    background: '#ef9f2722',
    border: '0.5px solid #ef9f2744',
    borderRadius: 6,
    fontSize: 11,
    color: '#BA7517',
    lineHeight: 1.5,
  },
  upgradeRow: {
    marginTop: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  upgradeBtn: {
    padding: '7px 16px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  upgradeHint: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
  },
  notOwnerNote: {
    marginTop: 10,
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
  },
};
