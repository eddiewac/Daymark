import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { uid } from '../../lib/utils.js';

// Shared Saving… / Saved / Couldn’t save state, plus Undo toasts.
// The pill itself renders in the top bar (TopBar reads `status`). Toasts stay
// centered so they don't sit under the floating notepad.
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

  const showToast = useCallback((message, { onUndo, duration } = {}) => {
    const id = uid();
    // Undo after void/log needs time to reach. Plain notices stay short.
    const ms = duration ?? (onUndo ? 12000 : 5000);
    setToasts((prev) => [...prev, { id, message, onUndo }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, ms);
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

const styles = {
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
