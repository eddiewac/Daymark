import { useEffect, useState } from 'react';

// ── QuickCommPrompt ─────────────────────────────────────────────────────────
// A small, transient prompt shown after a station-linked task is completed.
// It offers the station's comm pills so a communication can be logged without
// navigating to the station's Comms tab. Non-blocking: it sits at the bottom
// of the screen and auto-dismisses after a few seconds if ignored.
//
// Props:
//   taskTitle   – title of the completed task (for context)
//   pills       – the comm pills to offer (station.commPills or defaults)
//   onPick      – (pill) => void, called when a pill is chosen
//   onDismiss   – () => void, called on close / auto-dismiss

const AUTO_DISMISS_MS = 9000;

export default function QuickCommPrompt({ taskTitle, pills, onPick, onDismiss }) {
  const [leaving, setLeaving] = useState(false);

  // Auto-dismiss after a few seconds if the user does nothing.
  useEffect(() => {
    const t = setTimeout(() => {
      setLeaving(true);
      setTimeout(onDismiss, 180);
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const dismiss = () => {
    setLeaving(true);
    setTimeout(onDismiss, 180);
  };

  return (
    <div
      style={{
        ...styles.wrap,
        opacity: leaving ? 0 : 1,
        transform: leaving ? 'translateY(8px)' : 'translateY(0)',
      }}
    >
      <div style={styles.textCol}>
        <div style={styles.title}>Task done ✓</div>
        <div style={styles.sub}>
          Log a comm for this station?
        </div>
      </div>
      <div style={styles.pillRow}>
        {(pills || []).map((pill) => (
          <button
            key={pill.label}
            onClick={() => onPick(pill)}
            style={{
              ...styles.pill,
              border: `0.5px solid ${pill.color}`,
              background: pill.color + '18',
              color: pill.color,
            }}
            title={`Log "${pill.label}" on this station`}
          >
            + {pill.label}
            {pill.needsReply ? ' ↩' : ''}
          </button>
        ))}
      </div>
      <button onClick={dismiss} style={styles.close} title="Dismiss">
        ×
      </button>
    </div>
  );
}

const styles = {
  wrap: {
    position: 'fixed',
    left: '50%',
    bottom: 20,
    transform: 'translateX(-50%)',
    zIndex: 1400,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    maxWidth: 'min(680px, calc(100vw - 32px))',
    padding: '10px 12px',
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 12,
    boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
    transition: 'opacity 0.18s ease, transform 0.18s ease',
  },
  textCol: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  sub: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
  },
  pillRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 5,
    flex: 1,
    minWidth: 0,
  },
  pill: {
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  close: {
    width: 24,
    height: 24,
    flexShrink: 0,
    background: 'transparent',
    border: 'none',
    fontSize: 18,
    color: 'var(--color-text-tertiary)',
    cursor: 'pointer',
  },
};
