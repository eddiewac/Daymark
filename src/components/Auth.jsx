import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

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

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.logo}>
          Day<span style={{ color: '#534AB7' }}>mark</span>
        </div>
        <div style={styles.sub}>
          {mode === 'login' ? 'Sign in to your account' : 'Create your Daymark account'}
        </div>

        {error && <div style={styles.err}>{error}</div>}
        {info && <div style={styles.info}>{info}</div>}

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
    fontSize: 24,
    fontWeight: 600,
    marginBottom: 4,
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
};
