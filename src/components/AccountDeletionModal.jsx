import { useEffect, useState } from 'react';
import { previewAccountDeletion, deleteMyAccount } from '../lib/account.js';
import { supabase } from '../lib/supabase.js';

// Account deletion modal — three states:
//   1. Loading: fetching preview
//   2. Preview: show what will happen, ask for email confirmation
//   3. Done: post-deletion confirmation, sign out

export default function AccountDeletionModal({ user, onClose }) {
  const [phase, setPhase] = useState('loading'); // loading | preview | deleting | done | error
  const [preview, setPreview] = useState(null);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [error, setError] = useState('');

  // Fetch the preview on open
  useEffect(() => {
    let cancelled = false;
    previewAccountDeletion()
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        setPhase('preview');
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || 'Could not load account preview');
        setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const userEmail = (user?.email || '').toLowerCase();
  const typedEmail = confirmEmail.trim().toLowerCase();
  const canConfirm = !!userEmail && typedEmail === userEmail;

  const handleDelete = async () => {
    if (!canConfirm) return;
    setPhase('deleting');
    setError('');
    try {
      await deleteMyAccount();
      // Sign out cleans up the local session. The user record is already gone.
      try {
        await supabase.auth.signOut();
      } catch {
        // If signOut fails because the session is already invalid, that's fine.
      }
      setPhase('done');
    } catch (e) {
      setError(e.message || 'Could not delete account');
      setPhase('error');
    }
  };

  return (
    <div style={styles.backdrop} onClick={phase !== 'deleting' ? onClose : undefined}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Delete your account</div>
            <div style={styles.subtitle}>
              This is permanent and cannot be undone.
            </div>
          </div>
          {phase !== 'deleting' && phase !== 'done' && (
            <button onClick={onClose} style={styles.closeBtn}>×</button>
          )}
        </div>

        {phase === 'loading' && (
          <div style={styles.loading}>Loading account details…</div>
        )}

        {phase === 'preview' && preview && (
          <PreviewContent preview={preview} userEmail={userEmail} />
        )}

        {phase === 'preview' && (
          <div style={styles.confirmSection}>
            <div style={styles.confirmLabel}>
              To confirm, type your email below:{' '}
              <strong style={{ color: '#e24b4a' }}>{userEmail}</strong>
            </div>
            <input
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="Your email"
              autoFocus
              autoComplete="off"
              style={styles.input}
            />
            <div style={styles.btnRow}>
              <button onClick={onClose} style={styles.cancelBtn}>
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!canConfirm}
                style={{
                  ...styles.deleteBtn,
                  opacity: canConfirm ? 1 : 0.4,
                  cursor: canConfirm ? 'pointer' : 'not-allowed',
                }}
              >
                Delete my account
              </button>
            </div>
          </div>
        )}

        {phase === 'deleting' && (
          <div style={styles.loading}>Deleting your account…</div>
        )}

        {phase === 'done' && (
          <div style={styles.done}>
            <div style={styles.doneTitle}>✓ Account deleted</div>
            <div style={styles.doneText}>
              Your account and personal data have been removed. You're now
              signed out.
            </div>
            <button
              onClick={() => {
                window.location.reload();
              }}
              style={styles.doneBtn}
            >
              Return to sign-in
            </button>
          </div>
        )}

        {phase === 'error' && (
          <div style={styles.errorBlock}>
            <div style={styles.errorTitle}>Something went wrong</div>
            <div style={styles.errorText}>{error}</div>
            <div style={styles.btnRow}>
              <button onClick={onClose} style={styles.cancelBtn}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Preview content: shows owned/member workspaces + what happens to them ──
function PreviewContent({ preview, userEmail }) {
  const owned = preview.owned_workspaces || [];
  const member = preview.member_workspaces || [];

  const willTransfer = owned.filter((w) => w.action === 'transfer');
  const willDelete = owned.filter((w) => w.action === 'delete');

  return (
    <div style={styles.previewBox}>
      <div style={styles.previewIntro}>
        Here's exactly what will happen when you delete your account:
      </div>

      <div style={styles.bullet}>
        <strong>Your personal data is permanently deleted.</strong> Your tasks,
        notes, projects, time entries, congresses, status rounds, goals, and
        settings outside of team workspaces are removed.
      </div>

      {willDelete.length > 0 && (
        <div style={styles.warningBlock}>
          <div style={styles.warningTitle}>
            ⚠ {willDelete.length} workspace{willDelete.length > 1 ? 's' : ''} will be permanently deleted
          </div>
          <div style={styles.warningSub}>
            You're the only member, so deleting your account also deletes:
          </div>
          <ul style={styles.list}>
            {willDelete.map((w) => (
              <li key={w.id}>
                <strong>{w.name}</strong> — and all its tasks, projects, notes, etc.
              </li>
            ))}
          </ul>
        </div>
      )}

      {willTransfer.length > 0 && (
        <div style={styles.transferBlock}>
          <div style={styles.transferTitle}>
            ↳ {willTransfer.length} workspace{willTransfer.length > 1 ? 's' : ''} will be transferred to other members
          </div>
          <div style={styles.transferSub}>
            These workspaces stay alive under their new owner:
          </div>
          <ul style={styles.list}>
            {willTransfer.map((w) => (
              <li key={w.id}>
                <strong>{w.name}</strong> → new owner:{' '}
                <span style={{ color: '#534AB7' }}>
                  {w.new_owner_email || '(another member)'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {member.length > 0 && (
        <div style={styles.bullet}>
          You'll be removed as a member from{' '}
          <strong>{member.length}</strong> other workspace{member.length > 1 ? 's' : ''} you don't own. Their data is unaffected.
        </div>
      )}

      {owned.length === 0 && member.length === 0 && (
        <div style={styles.bullet}>
          You're not a member of any team workspaces, so only your personal data is affected.
        </div>
      )}
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 1400,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    overflow: 'auto',
    padding: '40px 20px 80px',
  },
  dialog: {
    background: 'var(--bg-surface)',
    borderRadius: 12,
    width: '100%',
    maxWidth: 540,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: '#e24b4a',
  },
  subtitle: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginTop: 3,
  },
  closeBtn: {
    width: 28,
    height: 28,
    background: 'transparent',
    border: 'none',
    fontSize: 22,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  loading: {
    padding: 30,
    textAlign: 'center',
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
  previewBox: {
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 10,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  previewIntro: {
    fontSize: 12,
    color: 'var(--color-text-primary)',
    fontWeight: 500,
  },
  bullet: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.5,
  },
  warningBlock: {
    background: '#e24b4a11',
    border: '0.5px solid #e24b4a44',
    borderRadius: 8,
    padding: 10,
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#e24b4a',
  },
  warningSub: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginTop: 3,
    marginBottom: 4,
  },
  transferBlock: {
    background: '#534AB711',
    border: '0.5px solid #534AB744',
    borderRadius: 8,
    padding: 10,
  },
  transferTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#534AB7',
  },
  transferSub: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginTop: 3,
    marginBottom: 4,
  },
  list: {
    margin: 0,
    paddingLeft: 18,
    fontSize: 11,
    color: 'var(--color-text-primary)',
    lineHeight: 1.7,
  },
  confirmSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  confirmLabel: {
    fontSize: 12,
    color: 'var(--color-text-primary)',
  },
  input: {
    padding: '8px 12px',
    border: '0.5px solid #e24b4a55',
    borderRadius: 8,
    fontSize: 13,
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  btnRow: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  cancelBtn: {
    padding: '7px 14px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
  },
  deleteBtn: {
    padding: '7px 16px',
    background: '#e24b4a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
  },
  done: {
    padding: 20,
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  doneTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1d9e75',
  },
  doneText: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.5,
  },
  doneBtn: {
    padding: '8px 18px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    margin: '0 auto',
  },
  errorBlock: {
    padding: 12,
    background: '#e24b4a11',
    border: '0.5px solid #e24b4a44',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#e24b4a',
  },
  errorText: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.5,
  },
};
