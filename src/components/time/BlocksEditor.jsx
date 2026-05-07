import { useEffect, useState } from 'react';
import {
  fmtTimeOfDay,
  combineDateAndTime,
} from '../../hooks/useTime.js';

export default function BlocksEditor({
  taskTitle,
  date,
  blocks, // existing blocks for this (task, date)
  taskId,
  onAddBlock,
  onUpdateBlock,
  onRemoveBlock,
  onClose,
}) {
  // Detect overlapping blocks (within this cell)
  const overlaps = detectOverlaps(blocks);

  const handleAddEmpty = () => {
    // Default: 9-10 AM if no blocks; else end of last block + 1 hour
    let startISO, endISO;
    if (blocks.length === 0) {
      startISO = combineDateAndTime(date, '09:00');
      endISO = combineDateAndTime(date, '10:00');
    } else {
      const sorted = [...blocks].sort((a, b) =>
        (a.startedAt || '').localeCompare(b.startedAt || '')
      );
      const last = sorted[sorted.length - 1];
      if (last.endedAt) {
        const end = new Date(last.endedAt);
        startISO = end.toISOString();
        const endPlusHour = new Date(end.getTime() + 3600000);
        endISO = endPlusHour.toISOString();
      } else {
        startISO = combineDateAndTime(date, '09:00');
        endISO = combineDateAndTime(date, '10:00');
      }
    }
    onAddBlock({ taskId, date, startedAt: startISO, endedAt: endISO });
  };

  const handleAddManualHours = () => {
    onAddBlock({ taskId, date, hours: 1 });
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.title}>Time blocks</div>
            <div style={styles.subtitle} title={taskTitle}>
              {taskTitle} · {fmtDay(date)}
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} title="Close">
            ×
          </button>
        </div>

        {overlaps.length > 0 && (
          <div style={styles.warnBanner}>
            ⚠ {overlaps.length} block{overlaps.length === 1 ? '' : 's'} overlap with another in this cell.
          </div>
        )}

        {blocks.length === 0 ? (
          <div style={styles.empty}>
            No blocks yet. Add a timed block (with start/end) or just enter hours.
          </div>
        ) : (
          <div style={styles.list}>
            {[...blocks]
              .sort((a, b) => (a.startedAt || '').localeCompare(b.startedAt || ''))
              .map((b) => (
                <BlockRow
                  key={b.id}
                  block={b}
                  date={date}
                  isOverlap={overlaps.includes(b.id)}
                  onUpdate={(patch) => onUpdateBlock(b.id, patch)}
                  onRemove={() => onRemoveBlock(b.id)}
                />
              ))}
          </div>
        )}

        <div style={styles.footer}>
          <button onClick={handleAddEmpty} style={styles.addBtn}>
            + Add timed block
          </button>
          <button onClick={handleAddManualHours} style={styles.addBtnSecondary}>
            + Add hours only
          </button>
          <div style={{ flex: 1 }} />
          <span style={styles.totalLabel}>
            Total: <strong>{totalHours(blocks).toFixed(2)}h</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Single editable block row ────────────────────────────────────────────────
function BlockRow({ block, date, isOverlap, onUpdate, onRemove }) {
  const hasTimes = !!block.startedAt && !!block.endedAt;

  const [startTime, setStartTime] = useState(
    hasTimes ? fmtTimeOfDay(block.startedAt) : ''
  );
  const [endTime, setEndTime] = useState(
    hasTimes ? fmtTimeOfDay(block.endedAt) : ''
  );
  const [manualHours, setManualHours] = useState(
    !hasTimes ? (block.hours || 0).toFixed(2) : ''
  );
  const [notes, setNotes] = useState(block.notes || '');
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Reset draft state when block changes from outside
  useEffect(() => {
    setStartTime(hasTimes ? fmtTimeOfDay(block.startedAt) : '');
    setEndTime(hasTimes ? fmtTimeOfDay(block.endedAt) : '');
    setManualHours(!hasTimes ? (block.hours || 0).toFixed(2) : '');
    setNotes(block.notes || '');
  }, [block.id, block.startedAt, block.endedAt, block.hours, block.notes, hasTimes]);

  const commitTimes = () => {
    if (!startTime || !endTime) return;
    const startedAt = combineDateAndTime(date, startTime);
    const endedAt = combineDateAndTime(date, endTime);
    if (
      startedAt === block.startedAt &&
      endedAt === block.endedAt
    ) return;
    onUpdate({ startedAt, endedAt });
  };

  const commitManualHours = () => {
    const num = parseFloat(manualHours);
    if (isNaN(num) || num < 0) return;
    if (Math.abs(num - block.hours) < 0.005) return;
    onUpdate({ hours: num });
  };

  const commitNotes = () => {
    if (notes === (block.notes || '')) return;
    onUpdate({ notes });
  };

  const liveHours =
    startTime && endTime
      ? Math.max(
          0,
          (combineDateAndTime(date, endTime) &&
            combineDateAndTime(date, startTime) &&
            (new Date(combineDateAndTime(date, endTime)) -
              new Date(combineDateAndTime(date, startTime))) /
              3600000) || 0
        )
      : block.hours || 0;

  return (
    <div
      style={{
        ...styles.blockRow,
        borderColor: isOverlap ? '#ef9f27' : 'var(--color-border-tertiary)',
        background: isOverlap ? '#ef9f2708' : 'var(--color-background-tertiary)',
      }}
    >
      <div style={styles.blockTopRow}>
        {hasTimes ? (
          <>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              onBlur={commitTimes}
              style={styles.timeInput}
            />
            <span style={styles.timeSep}>→</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              onBlur={commitTimes}
              style={styles.timeInput}
            />
            <span style={styles.hoursDisplay}>
              {liveHours.toFixed(2)}h
            </span>
          </>
        ) : (
          <>
            <span style={styles.manualLabel}>Manual hours:</span>
            <input
              type="number"
              min="0"
              step="0.25"
              value={manualHours}
              onChange={(e) => setManualHours(e.target.value)}
              onBlur={commitManualHours}
              style={styles.hoursInput}
            />
          </>
        )}
        <div style={{ flex: 1 }} />
        {!confirmRemove ? (
          <button
            onClick={() => setConfirmRemove(true)}
            style={styles.removeBtn}
            title="Remove block"
          >
            🗑
          </button>
        ) : (
          <>
            <button
              onClick={onRemove}
              style={styles.confirmRemove}
              title="Confirm delete"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmRemove(false)}
              style={styles.cancelBtnSmall}
            >
              ×
            </button>
          </>
        )}
      </div>
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={commitNotes}
        placeholder="Notes (optional)"
        style={styles.notesInput}
      />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function detectOverlaps(blocks) {
  const overlaps = new Set();
  const sorted = blocks
    .filter((b) => b.startedAt && b.endedAt)
    .map((b) => ({
      id: b.id,
      s: new Date(b.startedAt).getTime(),
      e: new Date(b.endedAt).getTime(),
    }));
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      // Overlap if a.s < b.e && b.s < a.e
      if (a.s < b.e && b.s < a.e) {
        overlaps.add(a.id);
        overlaps.add(b.id);
      }
    }
  }
  return Array.from(overlaps);
}

function totalHours(blocks) {
  return blocks.reduce((sum, b) => sum + (b.hours || 0), 0);
}

function fmtDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    background: 'var(--bg-surface)',
    borderRadius: 12,
    padding: 18,
    minWidth: 460,
    maxWidth: 560,
    maxHeight: '85vh',
    boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { fontSize: 14, fontWeight: 600 },
  subtitle: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
  warnBanner: {
    padding: '6px 10px',
    background: '#ef9f2722',
    border: '0.5px solid #ef9f2744',
    borderRadius: 8,
    fontSize: 11,
    color: '#BA7517',
  },
  empty: {
    padding: 16,
    textAlign: 'center',
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    background: 'var(--color-background-secondary)',
    borderRadius: 8,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    overflowY: 'auto',
    maxHeight: 380,
  },
  blockRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '8px 10px',
    border: '0.5px solid',
    borderRadius: 8,
  },
  blockTopRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    padding: '4px 8px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 12,
    background: 'var(--bg-surface)',
    outline: 'none',
    width: 90,
  },
  timeSep: { fontSize: 12, color: 'var(--color-text-tertiary)' },
  hoursDisplay: {
    fontSize: 11,
    color: 'var(--accent)',
    fontWeight: 500,
    fontFamily: 'monospace',
    marginLeft: 6,
  },
  manualLabel: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
  },
  hoursInput: {
    padding: '4px 8px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 12,
    background: 'var(--bg-surface)',
    outline: 'none',
    width: 80,
    fontFamily: 'monospace',
    textAlign: 'right',
  },
  notesInput: {
    padding: '4px 8px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 11,
    background: 'var(--bg-surface)',
    outline: 'none',
    width: '100%',
  },
  removeBtn: {
    width: 26,
    height: 26,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-tertiary)',
    fontSize: 14,
    cursor: 'pointer',
    borderRadius: 4,
  },
  confirmRemove: {
    padding: '3px 10px',
    background: '#e24b4a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
  },
  cancelBtnSmall: {
    width: 22,
    height: 22,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-tertiary)',
    fontSize: 14,
    cursor: 'pointer',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTop: '0.5px solid var(--color-border-tertiary)',
  },
  addBtn: {
    padding: '5px 12px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
  },
  addBtnSecondary: {
    padding: '5px 12px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    fontSize: 11,
    cursor: 'pointer',
  },
  totalLabel: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
};
