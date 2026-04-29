import { fmtElapsed } from '../hooks/useTime.js';

export default function RunningTimerIndicator({
  runningTimer,
  elapsedMs,
  taskTitle,
  onStop,
  onCancel,
}) {
  if (!runningTimer) return null;

  return (
    <div style={styles.wrap}>
      <span style={styles.dot} />
      <div style={styles.info}>
        <div style={styles.label}>Running</div>
        <div style={styles.task} title={taskTitle}>
          {taskTitle || '(unknown task)'}
        </div>
      </div>
      <div style={styles.time}>{fmtElapsed(elapsedMs)}</div>
      <button onClick={onStop} style={styles.stopBtn} title="Stop & log time">
        ■ Stop
      </button>
      <button
        onClick={onCancel}
        style={styles.cancelBtn}
        title="Cancel without logging"
      >
        ×
      </button>
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px 4px 10px',
    background: '#FF6B3511',
    border: '0.5px solid #FF6B3544',
    borderRadius: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#FF6B35',
    animation: 'pulse 1.4s ease-in-out infinite',
    boxShadow: '0 0 0 0 #FF6B3577',
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    maxWidth: 180,
  },
  label: {
    fontSize: 9,
    color: '#FF6B35',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  task: {
    fontSize: 11,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  time: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    minWidth: 64,
    textAlign: 'right',
  },
  stopBtn: {
    padding: '3px 10px',
    background: '#FF6B35',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
  },
  cancelBtn: {
    width: 22,
    height: 22,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-tertiary)',
    fontSize: 14,
    cursor: 'pointer',
  },
};
