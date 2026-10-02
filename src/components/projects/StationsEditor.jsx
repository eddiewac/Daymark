import { useState } from 'react';
import { uid } from '../../lib/utils.js';
import CommsTab from './CommsTab.jsx';

// Default review stages - the user can override per project
const DEFAULT_STATIONS = [
  { name: 'Draft 1' },
  { name: 'Internal review' },
  { name: 'Client review' },
  { name: 'Final' },
];

function mkStation(name = 'New station') {
  return {
    id: uid(),
    name,
    startDate: '',
    targetDate: '',
    owner: '',
    estHours: 0,
    actualHours: null,
    done: false,
    completedAt: null,
    notes: '',
  };
}

export default function StationsEditor({ deliverable, onChange, stationTemplates, onAddTask, projectName }) {
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [subTab, setSubTab] = useState('details'); // details | comms
  // Station id whose "add task" date picker is open, and the chosen date.
  const [taskForStation, setTaskForStation] = useState(null);
  const [taskDate, setTaskDate] = useState('');
  const stations = deliverable.stations || [];

  // Find the first incomplete station - that's the "current" one
  const currentIdx = stations.findIndex((s) => !s.done);

  const updateStations = (newStations) => {
    onChange({ ...deliverable, stations: newStations });
  };

  const addStation = (name) => {
    const next = [...stations, mkStation(name)];
    updateStations(next);
  };

  const updateStation = (id, patch) => {
    updateStations(stations.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeStation = (id) => {
    updateStations(stations.filter((s) => s.id !== id));
  };

  const moveStation = (id, dir) => {
    const idx = stations.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= stations.length) return;
    const next = [...stations];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    updateStations(next);
  };

  const seedDefaults = (template) => {
    const stageNames = template?.stages?.length
      ? template.stages
      : DEFAULT_STATIONS.map((s) => s.name);
    updateStations(stageNames.map((name) => mkStation(name)));
  };
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const toggleDone = (id) => {
    updateStations(
      stations.map((s) =>
        s.id === id
          ? {
              ...s,
              done: !s.done,
              completedAt: !s.done ? new Date().toISOString() : null,
            }
          : s
      )
    );
  };

  // Create a task named after the station, linked via stationId, with the
  // chosen due date. The task behaves exactly like any other task — it appears
  // in the task list and, if dated today, in Today. Defaults the date to today.
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const openTaskPicker = (stationId) => {
    setTaskForStation(stationId);
    setTaskDate(todayISO());
  };
  const confirmCreateTask = async (station) => {
    if (!onAddTask) return;
    await onAddTask({
      title: station.name || 'Station task',
      project: projectName || '',
      stationId: station.id,
      deliverableId: deliverable?.id || '',
      deliverableName: deliverable?.name || '',
      dueDate: taskDate || todayISO(),
    });
    setTaskForStation(null);
    setTaskDate('');
  };

  if (stations.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyMsg}>No stations yet.</div>
        <div style={styles.emptyActions}>
          {showTemplatePicker && stationTemplates && stationTemplates.length > 1 ? (
            <>
              {stationTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => {
                    seedDefaults(tpl);
                    setShowTemplatePicker(false);
                  }}
                  style={styles.primaryBtn}
                  title={tpl.stages.join(' → ')}
                >
                  {tpl.name}
                </button>
              ))}
              <button
                onClick={() => setShowTemplatePicker(false)}
                style={styles.secondaryBtn}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  if (!stationTemplates || stationTemplates.length <= 1) {
                    seedDefaults(stationTemplates?.[0]);
                  } else {
                    setShowTemplatePicker(true);
                  }
                }}
                style={styles.primaryBtn}
              >
                Use template
                {stationTemplates && stationTemplates.length > 1 ? ' ▾' : ''}
              </button>
              <button onClick={() => addStation('Draft 1')} style={styles.secondaryBtn}>
                + Add empty station
              </button>
            </>
          )}
        </div>
        <div style={styles.emptyHint}>
          Stations are the sequential stages this deliverable goes through —
          e.g. Draft 1 → Internal Review → Client Review → Final.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      {/* Train visualisation - horizontal sequence of stations */}
      <div style={styles.train}>
        {stations.map((s, i) => {
          const isCurrent = i === currentIdx;
          const isPast = i < currentIdx || (currentIdx === -1 && i < stations.length);
          const isDone = s.done;
          return (
            <div key={s.id} style={styles.trainCol}>
              {i > 0 && (
                <div
                  style={{
                    ...styles.trainConnector,
                    background: isPast ? 'var(--accent)' : 'var(--color-border-tertiary)',
                  }}
                />
              )}
              <button
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                style={{
                  ...styles.trainNode,
                  background: isDone ? 'var(--accent)' : isCurrent ? '#fff' : '#fff',
                  borderColor: isDone || isCurrent ? 'var(--accent)' : 'var(--color-border-primary)',
                  color: isDone ? '#fff' : isCurrent ? 'var(--accent)' : 'var(--color-text-secondary)',
                  fontWeight: isCurrent || isDone ? 600 : 400,
                }}
                title={s.name}
              >
                {isDone ? '✓' : i + 1}
              </button>
              <div
                style={{
                  ...styles.trainLabel,
                  color: isCurrent ? 'var(--accent)' : 'var(--color-text-secondary)',
                  fontWeight: isCurrent ? 500 : 400,
                }}
              >
                {s.name}
              </div>
            </div>
          );
        })}
      </div>

      {/* List of stations with details */}
      <div style={styles.list}>
        {stations.map((s, i) => {
          const isExpanded = expandedId === s.id;
          const isCurrent = i === currentIdx;
          return (
            <div
              key={s.id}
              style={{
                ...styles.row,
                background: isCurrent ? 'var(--accent-soft)' : 'var(--color-background-tertiary)',
                borderLeft: isCurrent ? '3px solid #534AB7' : '3px solid transparent',
              }}
            >
              <div style={styles.rowMain}>
                <button
                  onClick={() => toggleDone(s.id)}
                  style={{
                    ...styles.check,
                    background: s.done ? 'var(--accent)' : 'transparent',
                    borderColor: s.done ? 'var(--accent)' : 'var(--color-border-primary)',
                  }}
                  title="Mark complete"
                >
                  {s.done && (
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

                {editingId === s.id ? (
                  <input
                    autoFocus
                    value={s.name}
                    onChange={(e) => updateStation(s.id, { name: e.target.value })}
                    onBlur={() => setEditingId(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                    style={styles.nameInput}
                  />
                ) : (
                  <div
                    onClick={() => setEditingId(s.id)}
                    style={{
                      ...styles.name,
                      textDecoration: s.done ? 'line-through' : 'none',
                      opacity: s.done ? 0.6 : 1,
                    }}
                  >
                    {s.name}
                  </div>
                )}

                {/* Compact dates */}
                {(s.startDate || s.targetDate) && !isExpanded && (
                  <span style={styles.compactDates}>
                    {s.startDate || '?'} → {s.targetDate || '?'}
                  </span>
                )}

                {/* Awaiting reply indicator */}
                {(() => {
                  const awaiting = (s.comms || []).filter(
                    (c) => c.needsReply && !c.replyReceived
                  );
                  if (awaiting.length === 0) return null;
                  const longest = Math.max(
                    ...awaiting.map((c) => Math.floor((Date.now() - c.sentAt) / 86400000))
                  );
                  const overdue = longest > 2;
                  return (
                    <span
                      style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 10,
                        background: (overdue ? '#e24b4a' : '#ef9f27') + '22',
                        color: overdue ? '#e24b4a' : '#ef9f27',
                        fontWeight: 500,
                      }}
                      title={`${awaiting.length} awaiting reply, longest ${longest}d`}
                    >
                      {overdue ? '⚠' : '⏳'} {awaiting.length}
                    </span>
                  );
                })()}

                <button
                  onClick={() =>
                    taskForStation === s.id
                      ? setTaskForStation(null)
                      : openTaskPicker(s.id)
                  }
                  style={styles.iconBtn}
                  title="Add a task for this station (named after it)"
                >
                  ＋☑
                </button>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  style={styles.iconBtn}
                  title={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? '−' : '+'}
                </button>
                <button
                  onClick={() => moveStation(s.id, 'up')}
                  disabled={i === 0}
                  style={{ ...styles.iconBtn, opacity: i === 0 ? 0.3 : 1 }}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveStation(s.id, 'down')}
                  disabled={i === stations.length - 1}
                  style={{
                    ...styles.iconBtn,
                    opacity: i === stations.length - 1 ? 0.3 : 1,
                  }}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeStation(s.id)}
                  style={styles.removeBtn}
                  title="Remove station"
                >
                  ×
                </button>
              </div>

              {/* Add-task strip — name comes from the station; pick the due
                  date (defaults today) and confirm. Creates an ordinary task
                  linked to this station. */}
              {taskForStation === s.id && (
                <div style={styles.addTaskStrip}>
                  <span style={styles.addTaskLabel}>
                    Add task “{s.name || 'station'}” — due
                  </span>
                  <input
                    type="date"
                    value={taskDate}
                    onChange={(e) => setTaskDate(e.target.value)}
                    style={styles.addTaskDate}
                  />
                  <button
                    onClick={() => confirmCreateTask(s)}
                    style={styles.addTaskConfirm}
                  >
                    Add to tasks
                  </button>
                  <button
                    onClick={() => setTaskForStation(null)}
                    style={styles.addTaskCancel}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {isExpanded && (
                <div style={styles.expanded}>
                  <div style={styles.subTabs}>
                    {[
                      { key: 'details', label: 'Details' },
                      {
                        key: 'comms',
                        label: `✉ Comms${
                          (s.comms || []).length
                            ? ` (${(s.comms || []).length})`
                            : ''
                        }`,
                      },
                    ].map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setSubTab(t.key)}
                        style={{
                          ...styles.subTab,
                          ...(subTab === t.key ? styles.subTabActive : {}),
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {subTab === 'details' && (
                    <>
                      <div style={styles.fieldRow}>
                        <div style={styles.field}>
                          <label style={styles.label}>Start date</label>
                          <input
                            type="date"
                            value={s.startDate || ''}
                            onChange={(e) =>
                              updateStation(s.id, { startDate: e.target.value })
                            }
                            style={styles.input}
                          />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Target date</label>
                          <input
                            type="date"
                            value={s.targetDate || ''}
                            onChange={(e) =>
                              updateStation(s.id, { targetDate: e.target.value })
                            }
                            style={styles.input}
                          />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Owner</label>
                          <input
                            type="text"
                            value={s.owner || ''}
                            onChange={(e) =>
                              updateStation(s.id, { owner: e.target.value })
                            }
                            placeholder="Initials or name"
                            style={styles.input}
                          />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Est hours</label>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={s.estHours || 0}
                            onChange={(e) =>
                              updateStation(s.id, {
                                estHours: parseFloat(e.target.value) || 0,
                              })
                            }
                            style={styles.input}
                          />
                        </div>
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Notes</label>
                        <textarea
                          value={s.notes || ''}
                          onChange={(e) =>
                            updateStation(s.id, { notes: e.target.value })
                          }
                          placeholder="Version history, comments, anything relevant…"
                          rows={2}
                          style={styles.textarea}
                        />
                      </div>
                    </>
                  )}

                  {subTab === 'comms' && (
                    <CommsTab
                      station={s}
                      onUpdateStation={(updated) =>
                        updateStation(s.id, updated)
                      }
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={styles.footer}>
        <button onClick={() => addStation('New station')} style={styles.addBtn}>
          + Add station
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 12 },
  empty: {
    padding: 20,
    textAlign: 'center',
    background: 'var(--color-background-secondary)',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  emptyMsg: { fontSize: 12, color: 'var(--color-text-secondary)' },
  emptyActions: { display: 'flex', gap: 8 },
  emptyHint: {
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
    maxWidth: 360,
    lineHeight: 1.4,
  },
  primaryBtn: {
    padding: '6px 14px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
  },
  secondaryBtn: {
    padding: '6px 14px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
  // Train visualisation
  train: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 0,
    padding: '12px 4px',
    background: 'var(--color-background-secondary)',
    borderRadius: 8,
    overflowX: 'auto',
  },
  trainCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: 70,
    position: 'relative',
  },
  trainConnector: {
    position: 'absolute',
    top: 14,
    left: '-50%',
    width: '100%',
    height: 2,
    zIndex: 0,
  },
  trainNode: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: '2px solid',
    fontSize: 12,
    cursor: 'pointer',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainLabel: {
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
    maxWidth: 80,
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  // List
  list: { display: 'flex', flexDirection: 'column', gap: 4 },
  row: {
    borderRadius: 6,
    padding: '6px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  rowMain: { display: 'flex', alignItems: 'center', gap: 8 },
  check: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    border: '1.5px solid',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { flex: 1, fontSize: 12, cursor: 'text' },
  nameInput: {
    flex: 1,
    fontSize: 12,
    padding: '2px 6px',
    border: '0.5px solid var(--color-accent)',
    borderRadius: 4,
    outline: 'none',
  },
  compactDates: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    fontFamily: 'monospace',
  },
  iconBtn: {
    width: 22,
    height: 22,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-secondary)',
    fontSize: 13,
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
  addTaskStrip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    padding: '8px 10px 8px 34px',
    background: 'var(--accent-soft)',
    borderRadius: 6,
    marginTop: 2,
  },
  addTaskLabel: {
    fontSize: 11.5,
    color: 'var(--color-text-secondary)',
  },
  addTaskDate: {
    fontSize: 11.5,
    padding: '3px 6px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 5,
    background: 'var(--bg-surface)',
    color: 'var(--color-text-primary)',
  },
  addTaskConfirm: {
    fontSize: 11.5,
    fontWeight: 500,
    padding: '4px 10px',
    border: 'none',
    borderRadius: 14,
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
  },
  addTaskCancel: {
    fontSize: 11.5,
    padding: '4px 8px',
    border: 'none',
    background: 'transparent',
    color: 'var(--color-text-tertiary)',
    cursor: 'pointer',
  },
  expanded: {
    paddingTop: 6,
    paddingLeft: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  subTabs: {
    display: 'flex',
    gap: 2,
    marginBottom: 4,
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  subTab: {
    padding: '4px 12px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  subTabActive: {
    color: 'var(--accent)',
    borderBottom: '2px solid #534AB7',
    fontWeight: 500,
  },
  fieldRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  field: { flex: 1, minWidth: 110, display: 'flex', flexDirection: 'column', gap: 3 },
  label: { fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 500 },
  input: {
    padding: '3px 6px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 4,
    fontSize: 11,
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  textarea: {
    padding: '4px 6px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 4,
    fontSize: 11,
    background: 'var(--bg-surface)',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  footer: { display: 'flex', justifyContent: 'flex-start', marginTop: 4 },
  addBtn: {
    padding: '4px 12px',
    background: 'transparent',
    border: '0.5px dashed var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 11,
    color: 'var(--color-text-secondary)',
  },
};

