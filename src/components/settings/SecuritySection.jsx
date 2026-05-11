import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';

// ── SecuritySection ─────────────────────────────────────────────────────────
// Lives inside Settings. Lets the user enable or disable TOTP-based MFA on
// their account.
//
// Flows:
//   - Not enrolled: shows "Enable two-factor authentication" → enroll flow
//     with QR code + secret + 6-digit confirmation → factor verified
//   - Enrolled: shows the active factor with a "Disable" action that
//     requires a 6-digit code to confirm
//   - Signed in via Google: shows a note that MFA is managed by Google

export default function SecuritySection() {
  const [user, setUser] = useState(null);
  const [factors, setFactors] = useState(null); // null = loading
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [enrolling, setEnrolling] = useState(null);
  // { factorId, secret, qrCode, code } during the enroll flow

  const [disablingFactorId, setDisablingFactorId] = useState(null);
  const [disableCode, setDisableCode] = useState('');
  const [disableBusy, setDisableBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      setUser(u?.user || null);
      const { data, error: lfErr } = await supabase.auth.mfa.listFactors();
      if (lfErr) throw lfErr;
      const verified = (data?.totp || []).filter((f) => f.status === 'verified');
      const unverified = (data?.totp || []).filter((f) => f.status !== 'verified');
      // Clean up stranded unverified factors (abandoned enroll flows)
      for (const f of unverified) {
        try {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        } catch {
          // Silent
        }
      }
      setFactors(verified);
    } catch (err) {
      setError(err.message || 'Could not load security settings.');
      setFactors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const isOAuthUser =
    user?.app_metadata?.provider && user.app_metadata.provider !== 'email';

  const startEnroll = async () => {
    setError(null);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Daymark (${new Date().toLocaleDateString()})`,
      });
      if (error) throw error;
      setEnrolling({
        factorId: data.id,
        secret: data.totp?.secret,
        qrCode: data.totp?.qr_code,
        code: '',
      });
    } catch (err) {
      setError(err.message || 'Could not start enrollment.');
    }
  };

  const confirmEnroll = async () => {
    if (!enrolling || enrolling.code.length < 6) return;
    setError(null);
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
        factorId: enrolling.factorId,
      });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enrolling.factorId,
        challengeId: challenge.id,
        code: enrolling.code.trim(),
      });
      if (vErr) throw vErr;
      setEnrolling(null);
      await refresh();
    } catch (err) {
      setError(err.message || 'Code did not verify. Try again.');
    }
  };

  const cancelEnroll = async () => {
    if (enrolling?.factorId) {
      try {
        await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
      } catch {
        // Silent
      }
    }
    setEnrolling(null);
    refresh();
  };

  const confirmDisable = async () => {
    if (!disablingFactorId || disableCode.length < 6) return;
    setDisableBusy(true);
    setError(null);
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
        factorId: disablingFactorId,
      });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: disablingFactorId,
        challengeId: challenge.id,
        code: disableCode.trim(),
      });
      if (vErr) throw vErr;
      const { error: uErr } = await supabase.auth.mfa.unenroll({
        factorId: disablingFactorId,
      });
      if (uErr) throw uErr;
      setDisablingFactorId(null);
      setDisableCode('');
      await refresh();
    } catch (err) {
      setError(err.message || 'Could not disable two-factor.');
    } finally {
      setDisableBusy(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <section style={styles.section}>
        <div style={styles.sectionTitle}>Security</div>
        <div style={styles.muted}>Loading…</div>
      </section>
    );
  }

  if (isOAuthUser) {
    return (
      <section style={styles.section}>
        <div style={styles.sectionTitle}>Security</div>
        <div style={styles.sectionHint}>
          You signed in with Google. Two-factor authentication for your Daymark
          account is managed in your Google Account security settings.
        </div>
        <a
          href="https://myaccount.google.com/security"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.linkBtn}
        >
          Open Google account security →
        </a>
      </section>
    );
  }

  const hasFactor = factors && factors.length > 0;

  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>Security</div>
      <div style={styles.sectionHint}>
        Two-factor authentication adds an extra step when you sign in. After
        entering your password, you'll be asked for a 6-digit code from an
        authenticator app like Google Authenticator, 1Password, or Authy.
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {/* ── Enroll flow ────────────────────────────────────────────────── */}
      {enrolling ? (
        <div style={styles.enrollBox}>
          <div style={styles.enrollTitle}>Set up two-factor authentication</div>
          <ol style={styles.enrollSteps}>
            <li>
              Open your authenticator app and scan this QR code, or enter the
              secret manually.
            </li>
            <li>Enter the 6-digit code your app shows below.</li>
          </ol>

          <div style={styles.qrWrap}>
            {enrolling.qrCode ? (
              <img
                src={enrolling.qrCode}
                alt="Two-factor QR code"
                style={styles.qrImage}
              />
            ) : (
              <div style={styles.muted}>QR code not available.</div>
            )}
          </div>

          {enrolling.secret && (
            <div style={styles.secretBox}>
              <div style={styles.secretLabel}>Manual entry secret:</div>
              <code style={styles.secretValue}>{enrolling.secret}</code>
            </div>
          )}

          <label style={styles.label}>6-digit code from your app</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={enrolling.code}
            onChange={(e) =>
              setEnrolling({
                ...enrolling,
                code: e.target.value.replace(/[^0-9]/g, '').slice(0, 6),
              })
            }
            maxLength={6}
            placeholder="••••••"
            style={styles.codeInput}
          />

          <div style={styles.btnRow}>
            <button
              onClick={confirmEnroll}
              disabled={enrolling.code.length < 6}
              style={{
                ...styles.btnPrimary,
                opacity: enrolling.code.length < 6 ? 0.5 : 1,
                cursor: enrolling.code.length < 6 ? 'not-allowed' : 'pointer',
              }}
            >
              Verify & enable
            </button>
            <button onClick={cancelEnroll} style={styles.btnGhost}>
              Cancel
            </button>
          </div>
        </div>
      ) : hasFactor ? (
        // ── Already enrolled ────────────────────────────────────────────
        <div style={styles.factorBox}>
          <div style={styles.factorRow}>
            <div>
              <div style={styles.factorTitle}>
                <span style={styles.factorDot}>●</span> Two-factor authentication is on
              </div>
              <div style={styles.factorMeta}>
                {factors[0].friendly_name || 'TOTP authenticator'}
              </div>
            </div>
            {disablingFactorId !== factors[0].id && (
              <button
                onClick={() => setDisablingFactorId(factors[0].id)}
                style={styles.btnGhost}
              >
                Disable
              </button>
            )}
          </div>

          {disablingFactorId === factors[0].id && (
            <div style={styles.disableBox}>
              <div style={styles.disableTitle}>
                Enter a current 6-digit code to disable.
              </div>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={disableCode}
                onChange={(e) =>
                  setDisableCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                }
                maxLength={6}
                placeholder="••••••"
                style={styles.codeInput}
              />
              <div style={styles.btnRow}>
                <button
                  onClick={confirmDisable}
                  disabled={disableBusy || disableCode.length < 6}
                  style={{
                    ...styles.btnDanger,
                    opacity: disableBusy || disableCode.length < 6 ? 0.5 : 1,
                    cursor:
                      disableBusy || disableCode.length < 6 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {disableBusy ? 'Disabling…' : 'Disable two-factor'}
                </button>
                <button
                  onClick={() => {
                    setDisablingFactorId(null);
                    setDisableCode('');
                    setError(null);
                  }}
                  style={styles.btnGhost}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // ── Not enrolled ────────────────────────────────────────────────
        <button onClick={startEnroll} style={styles.btnPrimary}>
          Enable two-factor authentication
        </button>
      )}

      <div style={styles.recoveryNote}>
        <strong>If you lose access to your authenticator app:</strong> email
        support@getdaymark.com from the address on your account. We'll verify
        your identity and help you regain access. (Recovery codes are not yet
        supported — coming in a future update.)
      </div>
    </section>
  );
}

const styles = {
  section: {
    padding: '16px 0',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginBottom: 12,
    lineHeight: 1.5,
  },
  muted: { fontSize: 12, color: 'var(--color-text-tertiary)' },
  error: {
    background: '#fdecec',
    color: '#a02a2a',
    border: '0.5px solid #f1b6b6',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 12,
    marginBottom: 10,
  },
  enrollBox: {
    background: 'var(--bg-surface-muted)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 10,
    padding: 14,
  },
  enrollTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    marginBottom: 8,
  },
  enrollSteps: {
    margin: '0 0 12px 0',
    paddingLeft: 20,
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.6,
  },
  qrWrap: {
    display: 'flex',
    justifyContent: 'center',
    padding: 12,
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 8,
    marginBottom: 10,
  },
  qrImage: { width: 180, height: 180, display: 'block' },
  secretBox: {
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 6,
    padding: '8px 10px',
    marginBottom: 12,
  },
  secretLabel: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secretValue: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: 'var(--color-text-primary)',
    wordBreak: 'break-all',
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    marginBottom: 4,
  },
  codeInput: {
    width: '100%',
    padding: '8px 10px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    background: 'var(--bg-input, var(--bg-surface))',
    outline: 'none',
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 4,
    fontFamily: 'monospace',
    marginBottom: 10,
  },
  btnRow: { display: 'flex', gap: 8 },
  btnPrimary: {
    padding: '8px 14px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  btnGhost: {
    padding: '8px 14px',
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    fontSize: 12,
    cursor: 'pointer',
  },
  btnDanger: {
    padding: '8px 14px',
    background: '#e24b4a',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
  },
  linkBtn: {
    display: 'inline-block',
    padding: '8px 14px',
    background: 'transparent',
    color: 'var(--accent)',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    textDecoration: 'none',
  },
  factorBox: {
    background: 'var(--bg-surface-muted)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 10,
    padding: 12,
  },
  factorRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  factorTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    marginBottom: 2,
  },
  factorDot: { color: '#1d9e75', marginRight: 4 },
  factorMeta: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
  },
  disableBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: '0.5px solid var(--color-border-tertiary)',
  },
  disableTitle: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginBottom: 8,
  },
  recoveryNote: {
    marginTop: 14,
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.5,
    padding: '10px 12px',
    background: 'var(--bg-surface-muted)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 8,
  },
};
