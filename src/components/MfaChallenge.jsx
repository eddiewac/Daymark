import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { DaymarkWordmark } from './Logo.jsx';

// ── MfaChallenge ────────────────────────────────────────────────────────────
// Shown when a user is signed in at AAL1 but has a verified TOTP factor.
// Renders a 6-digit code prompt. On successful verify, the Supabase session
// upgrades to AAL2 and App's auth-state-change listener fires, which re-runs
// the AAL check and proceeds into the app.

export default function MfaChallenge({ onVerified, onCancel }) {
  const [factorId, setFactorId] = useState(null);
  const [challengeId, setChallengeId] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  // On mount, find the verified TOTP factor and create a challenge
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
        if (cancelled) return;
        if (fErr) throw fErr;
        const verified = (factors?.totp || []).find((f) => f.status === 'verified');
        if (!verified) {
          setError('No verified authenticator factor found. Please sign out and try again.');
          setLoading(false);
          return;
        }
        const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({
          factorId: verified.id,
        });
        if (cancelled) return;
        if (cErr) throw cErr;
        setFactorId(verified.id);
        setChallengeId(challenge.id);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not start two-factor challenge.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const verify = async (e) => {
    e?.preventDefault();
    if (verifying || !factorId || !challengeId || code.length < 6) return;
    setVerifying(true);
    setError(null);
    try {
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: code.trim(),
      });
      if (vErr) {
        setError(vErr.message || 'Code did not verify. Please try again.');
        setCode('');
        setVerifying(false);
        return;
      }
      // Success — session now at AAL2. Tell parent to recheck and proceed.
      onVerified();
    } catch (err) {
      setError(err.message || 'Verification failed.');
      setVerifying(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <DaymarkWordmark height={36} />
        </div>
        <div style={styles.sub}>
          Enter the 6-digit code from your authenticator app.
        </div>

        {error && <div style={styles.err}>{error}</div>}

        {loading ? (
          <div style={styles.muted}>Preparing…</div>
        ) : (
          <form onSubmit={verify}>
            <input
              style={styles.codeInput}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              maxLength={6}
              placeholder="••••••"
              required
              autoFocus
            />

            <button
              type="submit"
              style={styles.btn}
              disabled={verifying || code.length < 6}
            >
              {verifying ? '…' : 'Verify'}
            </button>
          </form>
        )}

        <div style={styles.switch}>
          <a
            onClick={onCancel}
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
          >
            Cancel and sign out
          </a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-surface-muted)',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 14,
    padding: '32px 28px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
  },
  logo: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 14,
  },
  sub: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    marginBottom: 20,
    textAlign: 'center',
  },
  err: {
    background: '#fdecec',
    color: '#a02a2a',
    border: '0.5px solid #f1b6b6',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 12,
    marginBottom: 12,
  },
  muted: {
    fontSize: 12,
    color: 'var(--color-text-tertiary)',
    textAlign: 'center',
  },
  codeInput: {
    width: '100%',
    padding: '10px 12px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    background: 'var(--bg-surface)',
    outline: 'none',
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 4,
    fontFamily: 'monospace',
  },
  btn: {
    width: '100%',
    marginTop: 16,
    padding: '10px 0',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 500,
    fontSize: 13,
  },
  switch: {
    marginTop: 18,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
  },
};
