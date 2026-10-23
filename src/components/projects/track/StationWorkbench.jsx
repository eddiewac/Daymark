import StationFocus from './StationFocus.jsx';

// Station workbench v1 — the train stays put; this overlay opens one station
// on top of it (tasks, log a comm into Waiting, advance with a confirm when
// tasks are still open). Not a rewrite of Track.

export default function StationWorkbench({
  project,
  deliverable,
  station,
  onSelectStation,
  onClose,
  ...focusProps
}) {
  const stations = deliverable?.stations || [];
  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div
        style={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Station workbench · ${station?.name || 'station'}`}
      >
        <div style={styles.spine} aria-label="Station spine">
          {stations.map((s, i) => {
            const on = s.id === station.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectStation && onSelectStation(s.id)}
                style={{
                  ...styles.spineBtn,
                  ...(on ? styles.spineOn : {}),
                  ...(s.done ? styles.spineDone : {}),
                }}
                aria-current={on ? 'true' : undefined}
              >
                <span style={styles.spineIdx}>{s.done ? '✓' : i + 1}</span>
                {s.name || 'Station'}
              </button>
            );
          })}
        </div>
        <StationFocus
          key={station.id}
          project={project}
          deliverable={deliverable}
          station={station}
          onClose={onClose}
          initialTab="tasks"
          onAdvanced={onSelectStation}
          {...focusProps}
        />
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17,24,39,0.35)',
    zIndex: 980,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  panel: {
    width: 'min(640px, 100vw)',
    height: '100%',
    background: 'var(--bg-surface)',
    boxShadow: '-12px 0 40px rgba(17,24,39,.2)',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  spine: {
    display: 'flex',
    gap: 6,
    overflowX: 'auto',
    padding: '10px 12px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    background: 'var(--color-background-secondary)',
    flexShrink: 0,
  },
  spineBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    border: '0.5px solid var(--color-border-secondary)',
    background: 'var(--bg-surface)',
    color: 'var(--color-text-secondary)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  spineOn: {
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
    background: 'var(--accent-soft)',
  },
  spineDone: {
    opacity: 0.75,
  },
  spineIdx: {
    fontSize: 10,
    fontWeight: 700,
  },
};
