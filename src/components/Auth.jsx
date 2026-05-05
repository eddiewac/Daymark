import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { DaymarkWordmark } from './Logo.jsx';

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo('Check your email to confirm your account.');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // After Google completes, return to this exact app URL.
          // This works in dev (localhost) and production (getdaymark.com or
          // the Netlify URL) because we read window.location.origin at runtime.
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      // Don't reset loading — the page is about to redirect to Google.
    } catch (err) {
      setError(err.message || 'Could not start Google sign-in.');
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <DaymarkWordmark height={36} />
        </div>
        <div style={styles.sub}>
          {mode === 'login' ? 'Sign in to your account' : 'Create your Daymark account'}
        </div>

        {error && <div style={styles.err}>{error}</div>}
        {info && <div style={styles.info}>{info}</div>}

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading}
          style={styles.googleBtn}
        >
          <GoogleIcon />
          <span>Continue with Google</span>
        </button>

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>or</span>
          <span style={styles.dividerLine} />
        </div>

        <form onSubmit={submit}>
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />

          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? '…' : mode === 'login' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <div style={styles.switch}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <a
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
              setInfo(null);
            }}
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </a>
        </div>
      </div>
    </div>
  );
}

// Google brand "G" — official multi-color logo
function GoogleIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

const styles = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#faf9f7',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    background: '#fff',
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
  info: {
    background: '#ecf7f0',
    color: '#1d6e54',
    border: '0.5px solid #bce0cd',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 12,
    marginBottom: 12,
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    background: '#fff',
    outline: 'none',
    fontSize: 13,
  },
  btn: {
    width: '100%',
    marginTop: 16,
    padding: '10px 0',
    background: '#534AB7',
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
  googleBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '10px 14px',
    background: '#fff',
    color: '#3c4043',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginBottom: 14,
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: '6px 0 14px',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: 'var(--color-border-tertiary)',
  },
  dividerText: {
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
};
