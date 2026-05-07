import { useEffect, useRef, useState } from 'react';
import {
  toDatetimeLocalString,
  fromDatetimeLocalString,
  hoursBetween,
  fmtTimeOfDay,
} from '../../hooks/useTime.js';

// One row inside the expanded cell — represents a single time block
function BlockRow({ entry, onUpdate, onDelete }) {
  const [start, setStart] = useState(toDatetimeLocalString(entry.startedAt));
  const [end, setEnd] = useState(toDatetimeLocalString(entry.endedAt));

  // Reset locals when the entry from props changes (eg from realtime)
  useEffect(() => {
    setStart(toDatetimeLocalString(entry.startedAt));
    setEnd(toDatetimeLocalString(entry.endedAt));
  }, [entry.startedAt, entry.endedAt]);

  const commitStart = () => {
    const d = fromDatetimeLocalString(start);
    if (!d) return;
    if (toDatetimeLocalString(d.getTime()) === toDatetimeLocalString(entry.startedAt)) return;
    onUpdate(entry.id, { startedAt: d.toISOString() });
  };

  const commitEnd = () => {
    const d = fromDatetimeLocalString(end);
    if (!d) return;
    if (toDatetimeLocalString(d.getTime()) === toDatetimeLocalString(entry.endedAt)) return;
    onUpdate(entry.id, { endedAt: d.toISOString() });
  };

  const startD = fromDatetimeLocalString(start);
  const endD = fromDatetimeLocalString(end);
  const liveHours = hoursBetween(startD, endD);
  const valid = startD && endD && liveHours > 0;

  return (
    <div style={blockStyles.row}>
      <input
        type="datetime-local"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        onBlur={commitStart}
        style={blockStyles.timeInput}
      />
      <span style={blockStyles.dash}>→</span>
      <input
        type="datetime-local"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        onBlur={commitEnd}
        style={blockStyles.timeInput}
      />
      <span
        style={{
          ...blockStyles.hours,
          color: valid ? 'var(--accent)' : '#e24b4a',
        }}
      >
        {valid ? `${liveHours.toFixed(2)}h` : 'invalid'}
      </span>
      <button
        onClick={() => onDelete(entry.id)}
        style={blockStyles.delBtn}
        title="Remove this block"
      >
        ×
      </button>
    </div>
  );
}

const blockStyles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 6px',
  },
  timeInput: {
    padding: '3px 6px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 4,
    fontSize: 11,
    fontFamily: 'monospace',
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  dash: { fontSize: 11, color: 'var(--color-text-tertiary)' },
  hours: {
    minWidth: 50,
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 500,
    textAlign: 'right',
  },
  delBtn: {
    width: 20,
    height: 20,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-tertiary)',
    fontSize: 14,
    cursor: 'pointer',
  },
};

// Main cell - shows total when collapsed, expands to per-block edit
export default function TimesheetCell({
  entries, // entries for this (task, date)
  taskId,
  date, // YYYY-MM-DD
  disabled,
  onAdd,
  onUpdate,
  onDelete,
  isToday,
}) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);

  const total = entries.reduce((s, e) => s + (e.hours || 0), 0);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!popoverRef.current?.contains(e.target)) setOpen(false);
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const addBlock = () => {
    // Default: a 1h block at "now" if today, otherwise 9–10am of that date
    const now = new Date();
    let start, end;
    if (date === now.toISOString().slice(0, 10)) {
      end = new Date(now);
      start = new Date(now.getTime() - 60 * 60 * 1000);
    } else {
      start = new Date(date + 'T09:00:00');
      end = new Date(date + 'T10:00:00');
    }
    onAdd({
      taskId,
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
    });
  };

  if (disabled) {
    return (
      <div style={cellStyles.readonly}>
        {total > 0 ? total.toFixed(2) : ''}
      </div>
    );
  }

  return (
    <div style={cellStyles.wrap}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          ...cellStyles.cellBtn,
          ...(total > 0 ? cellStyles.filled : {}),
          ...(open ? cellStyles.openBtn : {}),
        }}
        title={
          total > 0
            ? `${entries.length} block${entries.length === 1 ? '' : 's'} totalling ${total.toFixed(
                2
              )}h`
            : 'Click to add a time block'
        }
      >
        {total > 0 ? total.toFixed(2) : '＋'}
      </button>

      {open && (
        <div ref={popoverRef} style={cellStyles.popover}>
          <div style={cellStyles.popHeader}>
            <span style={cellStyles.popTitle}>
              {new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <span style={cellStyles.popTotal}>
              {total > 0 ? `${total.toFixed(2)}h total` : 'No time logged'}
            </span>
          </div>

          {entries.length === 0 ? (
            <div style={cellStyles.popEmpty}>
              Click + Add block to log time for this day.
            </div>
          ) : (
            <div style={cellStyles.blockList}>
              {entries
                .slice()
                .sort((a, b) => (a.startedAt || '').localeCompare(b.startedAt || ''))
                .map((e) => (
                  <BlockRow
                    key={e.id}
                    entry={e}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                  />
                ))}
            </div>
          )}

          <div style={cellStyles.popFooter}>
            <button onClick={addBlock} style={cellStyles.addBtn}>
              + Add block
            </button>
            <button onClick={() => setOpen(false)} style={cellStyles.doneBtn}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const cellStyles = {
  wrap: { position: 'relative', width: '100%' },
  cellBtn: {
    width: '100%',
    padding: '5px 6px',
    background: 'transparent',
    border: 'none',
    fontSize: 12,
    fontFamily: 'monospace',
    color: 'var(--color-text-tertiary)',
    cursor: 'pointer',
    borderRadius: 4,
    textAlign: 'center',
  },
  filled: {
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    fontWeight: 500,
  },
  openBtn: {
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    boxShadow: '0 0 0 1px #534AB7',
  },
  readonly: {
    padding: '5px 6px',
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'center',
    color: 'var(--color-text-tertiary)',
  },
  popover: {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: 4,
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 10,
    padding: 8,
    minWidth: 360,
    zIndex: 100,
    boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
  },
  popHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 6px 8px 6px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  popTitle: { fontSize: 12, fontWeight: 600 },
  popTotal: { fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500 },
  popEmpty: {
    padding: 14,
    textAlign: 'center',
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
  },
  blockList: { display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 0' },
  popFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTop: '0.5px solid var(--color-border-tertiary)',
  },
  addBtn: {
    padding: '4px 10px',
    background: 'transparent',
    border: '0.5px dashed var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  doneBtn: {
    padding: '4px 12px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
  },
};
