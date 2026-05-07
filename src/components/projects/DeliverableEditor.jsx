import { useState } from 'react';
import { uid } from '../../lib/utils.js';
import StationsEditor from './StationsEditor.jsx';

export default function DeliverableEditor({ deliverables, onChange, stationTemplates }) {
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const add = () => {
    const newD = {
      id: uid(),
      name: 'New deliverable',
      startDate: '',
      dueDate: '',
      done: false,
      stations: [],
    };
    onChange([...deliverables, newD]);
    setEditingId(newD.id);
    setExpandedId(newD.id);
  };

  const update = (id, patch) => {
    onChange(deliverables.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const updateDeliverable = (newDeliv) => {
    onChange(deliverables.map((d) => (d.id === newDeliv.id ? newDeliv : d)));
  };

  const remove = (id) => {
    onChange(deliverables.filter((d) => d.id !== id));
  };

  if (deliverables.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyMsg}>No deliverables yet.</div>
        <button onClick={add} style={styles.addBtn}>
          + Add deliverable
        </button>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      {deliverables.map((d) => {
        const stationCount = (d.stations || []).length;
        const doneCount = (d.stations || []).filter((s) => s.done).length;
        const isExpanded = expandedId === d.id;

        return (
          <div key={d.id} style={styles.deliv}>
            <div style={styles.delivHeader}>
              <button
                onClick={() => update(d.id, { done: !d.done })}
                style={{
                  ...styles.check,
                  background: d.done ? 'var(--accent)' : 'transparent',
                  borderColor: d.done ? 'var(--accent)' : 'var(--color-border-primary)',
                }}
              >
                {d.done && (
                  <svg width={9} height={9} viewBox="0 0 9 9">
                    <polyline
                      points="1.5,5 4,7.5 8.5,2"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="1.6"
                    />
                  </svg>
                )}
              </button>

              {editingId === d.id ? (
                <input
                  autoFocus
                  value={d.name}
                  onChange={(e) => update(d.id, { name: e.target.value })}
                  onBlur={() => setEditingId(null)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                  style={styles.nameInput}
                />
              ) : (
                <div
                  onClick={() => setEditingId(d.id)}
                  style={{
                    ...styles.name,
                    textDecoration: d.done ? 'line-through' : 'none',
                    opacity: d.done ? 0.6 : 1,
                  }}
                >
                  {d.name}
                </div>
              )}

              {stationCount > 0 && (
                <span style={styles.stationBadge}>
                  {doneCount}/{stationCount} stations
                </span>
              )}

              <input
                type="date"
                value={d.startDate || ''}
                onChange={(e) => update(d.id, { startDate: e.target.value })}
                style={styles.dateInput}
                title="Start date"
              />
              <span style={styles.dash}>→</span>
              <input
                type="date"
                value={d.dueDate || ''}
                onChange={(e) => update(d.id, { dueDate: e.target.value })}
                style={styles.dateInput}
                title="Due date"
              />

              <button
                onClick={() => setExpandedId(isExpanded ? null : d.id)}
                style={styles.expandBtn}
                title={isExpanded ? 'Collapse stations' : 'Expand stations'}
              >
                {isExpanded ? '▾' : '▸'}
              </button>
              <button
                onClick={() => remove(d.id)}
                style={styles.removeBtn}
                title="Remove deliverable"
              >
                ×
              </button>
            </div>

            {isExpanded && (
              <div style={styles.delivBody}>
                <StationsEditor deliverable={d} onChange={updateDeliverable} stationTemplates={stationTemplates} />
              </div>
            )}
          </div>
        );
      })}

      <button onClick={add} style={styles.addBtn}>
        + Add deliverable
      </button>
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  empty: {
    padding: '12px',
    textAlign: 'center',
    background: 'var(--color-background-secondary)',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  emptyMsg: { fontSize: 12, color: 'var(--color-text-secondary)' },
  deliv: {
    background: 'var(--color-background-tertiary)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  delivHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
  },
  check: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    border: '1.5px solid',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  name: { flex: 1, fontSize: 13, cursor: 'text' },
  nameInput: {
    flex: 1,
    fontSize: 13,
    padding: '2px 6px',
    border: '0.5px solid var(--color-accent)',
    borderRadius: 6,
    outline: 'none',
  },
  stationBadge: {
    fontSize: 10,
    padding: '1px 7px',
    borderRadius: 10,
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    fontWeight: 500,
  },
  dateInput: {
    fontSize: 11,
    padding: '2px 4px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 4,
    background: 'var(--bg-surface)',
  },
  dash: { fontSize: 11, color: 'var(--color-text-tertiary)' },
  expandBtn: {
    width: 22,
    height: 22,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-secondary)',
    fontSize: 11,
    borderRadius: 4,
  },
  removeBtn: {
    width: 22,
    height: 22,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-tertiary)',
    fontSize: 14,
    borderRadius: 4,
  },
  delivBody: {
    padding: '4px 8px 12px 24px',
    borderTop: '0.5px solid var(--color-border-tertiary)',
  },
  addBtn: {
    padding: '6px 12px',
    background: 'transparent',
    border: '0.5px dashed var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
};
