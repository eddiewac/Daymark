import { useEffect } from 'react';

// Confirm discard, or the sub-1-minute round-or-discard choice.
// Esc and the scrim keep the timer running (they do not discard).
export default function TimerFlowDialog({ title, body, actions, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div style={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>{title}</h2>
        <p style={styles.body}>{body}</p>
        <div style={styles.actions}>
          {(actions || []).map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              style={{
                ...styles.btn,
                ...(a.primary ? styles.primary : {}),
                ...(a.danger ? styles.danger : {}),
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17,24,39,0.4)',
    zIndex: 1300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  dialog: {
    background: 'var(--bg-surface)',
    borderRadius: 12,
    maxWidth: 400,
    width: '100%',
    padding: 20,
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
  },
  title: { margin: '0 0 8px', fontSize: 16, fontWeight: 600 },
  body: { margin: '0 0 16px', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.45 },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' },
  btn: {
    fontSize: 13,
    fontWeight: 500,
    padding: '6px 12px',
    borderRadius: 8,
    border: '0.5px solid var(--color-border-primary)',
    background: 'var(--bg-surface)',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
  },
  primary: {
    background: 'var(--accent)',
    color: '#fff',
    borderColor: 'var(--accent)',
  },
  danger: {
    background: 'var(--danger)',
    color: '#fff',
    borderColor: 'var(--danger)',
  },
};
