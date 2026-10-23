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

// Default expected-reply date: +3 business days from today (matches the
// previous hardcoded behaviour, so the fast path is unchanged).
function defaultExpectBy() {
  const d = new Date();
  let added = 0;
  while (added < 3) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

export default function QuickCommPrompt({
  taskTitle,
  pills,
  stationName,
  deliverableName,
  stationDone,
  doneCount,
  stationCount,
  nextStationName,
  onCompleteStation,
  onPick,
  placement = 'bottom',
  onDismiss,
}) {
  const [leaving, setLeaving] = useState(false);
  const [expectBy, setExpectBy] = useState(defaultExpectBy);
  // Once the user touches the date, stop the auto-dismiss so the prompt doesn't
  // vanish mid-edit.
  const [touched, setTouched] = useState(false);

  // Auto-dismiss after a few seconds if the user does nothing.
  useEffect(() => {
    if (touched) return;
    const t = setTimeout(() => {
      setLeaving(true);
      setTimeout(onDismiss, 180);
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [onDismiss, touched]);

  const dismiss = () => {
    setLeaving(true);
    setTimeout(onDismiss, 180);
  };

  return (
    <div
      style={{
        ...styles.wrap,
        ...(placement === 'top' ? styles.wrapTop : {}),
        opacity: leaving ? 0 : 1,
        transform: leaving ? 'translateX(-50%) translateY(8px)' : 'translateX(-50%)',
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
            onClick={() => onPick(pill, pill.needsReply ?? true ? expectBy : null)}
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
      {/* Expected-back date — applies to comms that need a reply. Defaults to
          +3 business days; edit before tapping a pill to set a different day.
          Whatever's here is when the comm surfaces on Today. */}
      <div style={styles.dateCol}>
        <label style={styles.dateLabel}>back by</label>
        <input
          type="date"
          value={expectBy}
          onChange={(e) => {
            setExpectBy(e.target.value);
            setTouched(true);
          }}
          onFocus={() => setTouched(true)}
          style={styles.dateInput}
          title="Expected back date — when this surfaces on Today"
        />
      </div>

      {/* Track progress + advance — show where the deliverable stands and let
          the user mark this station complete in place, without navigating to
          the project. */}
      {stationName != null && stationCount > 0 && (
        <div style={styles.trackCol}>
          <div style={styles.trackProgress}>
            <span style={styles.trackStation}>{stationName}</span>
            <span style={styles.trackCount}>
              {doneCount}/{stationCount}
            </span>
          </div>
          {stationDone ? (
            <div style={styles.trackDone}>
              ✓ station complete
              {nextStationName ? ` · next: ${nextStationName}` : ''}
            </div>
          ) : (
            <button
              onClick={() => {
                setTouched(true);
                onCompleteStation && onCompleteStation();
              }}
              style={styles.trackBtn}
              title="Mark this station complete"
            >
              Mark station complete →
            </button>
          )}
        </div>
      )}
      <button onClick={dismiss} style={styles.close} title="Dismiss">
        ×
      </button>
    </div>
  );
}

const styles = {
  wrapTop: {
    top: 64,
    bottom: 'auto',
  },
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
  dateCol: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    gap: 1,
  },
  dateLabel: {
    fontSize: 9,
    color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  dateInput: {
    fontSize: 11,
    padding: '2px 4px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    background: 'var(--bg-surface)',
    color: 'var(--color-text-primary)',
    outline: 'none',
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
  trackCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    paddingLeft: 12,
    marginLeft: 4,
    borderLeft: '0.5px solid var(--color-border-secondary)',
    flexShrink: 0,
  },
  trackProgress: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  trackStation: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    maxWidth: 120,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  trackCount: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    background: 'var(--color-background-secondary)',
    borderRadius: 8,
    padding: '0 6px',
  },
  trackBtn: {
    fontSize: 11,
    fontWeight: 500,
    padding: '3px 9px',
    borderRadius: 12,
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  trackDone: {
    fontSize: 10.5,
    fontWeight: 500,
    color: '#1d9e75',
    whiteSpace: 'nowrap',
  },
};
