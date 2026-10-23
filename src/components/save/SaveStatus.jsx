import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { uid } from '../../lib/utils.js';

// Shared Saving… / Saved / Couldn’t save strip, plus Undo toasts.
// Optimistic callers update local state themselves, then run the write through
// runSave. On failure, runSave shows Retry and the caller rolls the row back.

const SaveStatusContext = createContext(null);

export function useSaveStatus() {
  const ctx = useContext(SaveStatusContext);
  if (!ctx) throw new Error('useSaveStatus must be used inside SaveStatusProvider');
  return ctx;
}

export function SaveStatusProvider({ children }) {
  const [status, setStatus] = useState({ kind: 'idle', label: 'Ready' });
  const [toasts, setToasts] = useState([]);
  const retryRef = useRef(null);
  const inflight = useRef(0);
  const savedTimer = useRef(null);

  const showToast = useCallback((message, { onUndo, duration = 5000 } = {}) => {
    const id = uid();
    setToasts((prev) => [...prev, { id, message, onUndo }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const runSave = useCallback(async (fn) => {
    inflight.current += 1;
    setStatus({ kind: 'saving', label: 'Saving…' });
    retryRef.current = null;
    try {
      const result = await fn();
      const failed = !result || result.ok === false;
      if (failed) {
        const error = result?.error || 'Save failed';
        retryRef.current = () => runSave(fn);
        setStatus({ kind: 'failed', label: 'Couldn’t save' });
        inflight.current = Math.max(0, inflight.current - 1);
        return { ...(result || {}), ok: false, error };
      }
      inflight.current = Math.max(0, inflight.current - 1);
      if (inflight.current === 0) {
        setStatus({ kind: 'saved', label: 'Saved' });
        clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => {
          setStatus((s) => (s.kind === 'saved' ? { kind: 'idle', label: 'Ready' } : s));
        }, 1800);
      }
      return result;
    } catch (err) {
      inflight.current = Math.max(0, inflight.current - 1);
      retryRef.current = () => runSave(fn);
      setStatus({ kind: 'failed', label: 'Couldn’t save' });
      return { ok: false, error: err?.message || 'Save failed' };
    }
  }, []);

  const retry = useCallback(() => {
    const fn = retryRef.current;
    if (fn) fn();
  }, []);

  return (
    <SaveStatusContext.Provider value={{ runSave, showToast, retry, status }}>
      {children}
      <SaveStatusStrip status={status} onRetry={retry} />
      <div style={styles.toastWrap} aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} style={styles.toast}>
            <span>{t.message}</span>
            {t.onUndo && (
              <button
                type="button"
                style={styles.undo}
                onClick={() => {
                  dismissToast(t.id);
                  t.onUndo();
                }}
              >
                Undo
              </button>
            )}
          </div>
        ))}
      </div>
    </SaveStatusContext.Provider>
  );
}

function SaveStatusStrip({ status, onRetry }) {
  if (!status || status.kind === 'idle') return null;
  return (
    <div
      style={{ ...styles.strip, ...styles[status.kind] }}
      role="status"
      aria-live="polite"
    >
      <span style={{ ...styles.dot, ...styles[`${status.kind}Dot`] }} aria-hidden="true" />
      <span style={styles.label}>{status.label}</span>
      {status.kind === 'failed' && (
        <button type="button" style={styles.retry} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

const styles = {
  strip: {
    position: 'fixed',
    left: 16,
    bottom: 16,
    zIndex: 1400,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
    padding: '6px 12px',
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 10,
    boxShadow: 'var(--shadow-md)',
  },
  saving: {},
  saved: {},
  failed: {},
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
    background: '#d1d5db',
  },
  savingDot: { background: 'var(--accent)', animation: 'pulse 1s ease-in-out infinite' },
  savedDot: { background: 'var(--success)' },
  failedDot: { background: 'var(--danger)' },
  label: { fontSize: 13, fontWeight: 500 },
  retry: {
    fontSize: 12,
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: 8,
    border: '0.5px solid var(--danger-soft-border)',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    cursor: 'pointer',
  },
  toastWrap: {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1450,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  toast: {
    pointerEvents: 'auto',
    background: '#111827',
    color: '#f9fafb',
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  },
  undo: {
    color: '#93c5fd',
    border: 'none',
    background: 'none',
    padding: 0,
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 13,
  },
};
