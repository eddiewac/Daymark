import { useState, useEffect } from 'react';
import { combineDateAndTime } from '../hooks/useTime.js';
import { localDateStr, localTimeStr } from '../lib/utils.js';

export default function StopTimerDialog({
  pendingStop,
  taskTitle,
  onConfirm,
  onCancel,
  onDiscard,
}) {
  const [date, setDate] = useState(() => localDateStr(new Date(pendingStop.startedAt)));
  const [startTime, setStartTime] = useState(() => localTimeStr(pendingStop.startedAt));
  const [endTime, setEndTime] = useState(() => localTimeStr(pendingStop.endedAt));

  useEffect(() => {
    setDate(localDateStr(new Date(pendingStop.startedAt)));
    setStartTime(localTimeStr(pendingStop.startedAt));
    setEndTime(localTimeStr(pendingStop.endedAt));
  }, [pendingStop.startedAt, pendingStop.endedAt]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onCancel?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  const startISO = combineDateAndTime(date, startTime);
  const endISO = combineDateAndTime(date, endTime);
  const ms = startISO && endISO ? new Date(endISO) - new Date(startISO) : 0;
  const hoursDisplay = (ms / 3600000).toFixed(2);
  const invalidRange = !startISO || !endISO || ms <= 0;

  const handleSave = () => {
    if (invalidRange) return;
    onConfirm(startISO, endISO);
  };

  return (
    <div style={styles.backdrop} onClick={onCancel}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Log time</div>
            <div style={styles.subtitle} title={taskTitle}>
              {taskTitle || '(unknown task)'}
            </div>
          </div>
          <button onClick={onCancel} style={styles.closeBtn} title="Close">
            ×
          </button>
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Start</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.arrow}>→</div>
          <div style={styles.field}>
            <label style={styles.label}>End</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.totalRow}>
          {invalidRange ? (
            <span style={styles.invalid}>End must be after start</span>
          ) : (
            <span style={styles.total}>
              Total: <strong>{hoursDisplay}h</strong>
            </span>
          )}
        </div>

        <div style={styles.btnRow}>
          <button
            onClick={onDiscard}
            style={styles.discardBtn}
            title="Don't log this time"
          >
            Discard
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={onCancel} style={styles.cancelBtn}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={invalidRange}
            style={{
              ...styles.saveBtn,
              opacity: invalidRange ? 0.4 : 1,
              cursor: invalidRange ? 'not-allowed' : 'pointer',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    background: 'var(--bg-surface)',
    borderRadius: 12,
    padding: 18,
    minWidth: 360,
    maxWidth: 420,
    boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: { fontSize: 14, fontWeight: 600 },
  subtitle: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 320,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 22,
    color: 'var(--color-text-secondary)',
    width: 28,
    height: 28,
    cursor: 'pointer',
  },
  row: { display: 'flex', gap: 10, alignItems: 'flex-end' },
  field: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  label: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
  },
  input: {
    padding: '6px 10px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    fontSize: 13,
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  arrow: { fontSize: 16, color: 'var(--color-text-tertiary)', paddingBottom: 8 },
  totalRow: {
    padding: '8px 10px',
    background: 'var(--color-background-secondary)',
    borderRadius: 8,
    fontSize: 13,
  },
  total: { color: 'var(--color-text-primary)' },
  invalid: { color: '#e24b4a', fontSize: 12 },
  btnRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  discardBtn: {
    padding: '6px 12px',
    background: 'transparent',
    border: '0.5px solid #e24b4a',
    color: '#e24b4a',
    borderRadius: 8,
    fontSize: 12,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '6px 12px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 8,
    fontSize: 12,
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '6px 16px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
  },
};
