import { useState, useEffect } from 'react';
import { projectColor } from '../../../lib/constants.js';
import { uid } from '../../../lib/utils.js';
import StationFocus from './StationFocus.jsx';
import { stationLastActivityAt, relativeTime } from '../../../lib/stations.js';
import { deadlineColor, fmtDeadline } from '../../../lib/deadline.js';
import { useCurrentTheme } from '../../../hooks/useCurrentTheme.js';
import BlockDagView from './BlockDagView.jsx';

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
    comms: [],
  };
}

// ── Duplicate helpers ───────────────────────────────────────────────────────
// Build a fresh copy of a station: same name & order, no dates/done/comms/notes.
function duplicateStation(station) {
  return {
    id: uid(),
    name: station.name,
    startDate: '',
    targetDate: '',
    owner: station.owner || '',
    estHours: station.estHours || 0,
    actualHours: null,
    done: false,
    completedAt: null,
    notes: '',
    comms: [],
  };
}

// Build a fresh copy of a task tied to a new station.
// Keeps: title, priority, category, project, assignees, tags, links.
// Clears: dueDate, done, doneAt, time entries, out-of-scope flags, recurring.
function duplicateTask(task, newStationId) {
  return {
    ...task,
    id: uid(),
    stationId: newStationId,
    dueDate: '',
    reminder: '',
    done: false,
    doneAt: null,
    checklistProgress: {},
    createdAt: Date.now(),
    outOfScope: false,
    outOfScopeHours: null,
    outOfScopeNotes: '',
    // Keep these from the original:
    // title, priority, category, project, assignees, tags, links, estimate
  };
}

export default function TrackView({
  project,
  allProjects,
  tasks,
  members,
  workspaceId,
  stationTemplates,
  categories,
  priorities,
  statuses,
  onUpdateProject,
  onAddTask,
  onUpdateTask,
  onToggleTask,
  onDeleteTask,
  onAssignTask,
  onClose,
  initialFocusKey = null,
  initialFocusNonce = 0,
}) {
  const [focusKey, setFocusKey] = useState(initialFocusKey);
  useEffect(() => {
    if (initialFocusKey) setFocusKey(initialFocusKey);
  }, [initialFocusKey, initialFocusNonce]);
  const [seedingForId, setSeedingForId] = useState(null);
  const [duplicating, setDuplicating] = useState(null); // null | { delivId, taskCount }
  // Quick "add a task named after this station" from the train. Holds the
  // station id whose date-picker is open, and the chosen date.
  const [taskForStation, setTaskForStation] = useState(null);
  const [taskDate, setTaskDate] = useState('');
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const openStationTask = (stationId) => {
    setTaskForStation((cur) => (cur === stationId ? null : stationId));
    setTaskDate(todayISO());
  };
  const confirmStationTask = async (projectName, station) => {
    if (!onAddTask) return;
    await onAddTask({
      title: station.name || 'Station task',
      project: projectName || '',
      stationId: station.id,
      dueDate: taskDate || todayISO(),
    });
    setTaskForStation(null);
    setTaskDate('');
  };
  const color = projectColor(project.name, allProjects);
  const deliverables = project.deliverables || [];

  const updateStation = (delivId, stationId, patch) => {
    const newDeliverables = deliverables.map((d) => {
      if (d.id !== delivId) return d;
      return {
        ...d,
        stations: (d.stations || []).map((s) =>
          s.id === stationId
            ? { ...s, ...patch, updatedAt: new Date().toISOString() }
            : s
        ),
      };
    });
    onUpdateProject(project.id, { deliverables: newDeliverables });
  };

  const addStationTo = (delivId, name = 'New station') => {
    const newDeliverables = deliverables.map((d) => {
      if (d.id !== delivId) return d;
      return {
        ...d,
        stations: [...(d.stations || []), mkStation(name)],
      };
    });
    onUpdateProject(project.id, { deliverables: newDeliverables });
  };

  const seedStationsFor = (delivId, template) => {
    const stageNames = template?.stages?.length
      ? template.stages
      : DEFAULT_STATIONS.map((s) => s.name);
    const newDeliverables = deliverables.map((d) => {
      if (d.id !== delivId) return d;
      return {
        ...d,
        stations: stageNames.map((name) => mkStation(name)),
      };
    });
    onUpdateProject(project.id, { deliverables: newDeliverables });
  };

  const addDeliverable = (name = 'New deliverable') => {
    const newDeliverables = [
      ...deliverables,
      {
        id: uid(),
        name,
        startDate: '',
        dueDate: '',
        done: false,
        stations: [],
      },
    ];
    onUpdateProject(project.id, { deliverables: newDeliverables });
  };

  // ── Duplicate deliverable ────────────────────────────────────────────────
  // Creates a new deliverable with copied stations (fresh IDs, blank state)
  // and copies all tasks that were linked to the original's stations,
  // remapping them to the new station IDs.
  const duplicateDeliverable = async (originalDeliv) => {
    // 1. Map old station IDs → new station IDs while creating new stations
    const stationIdMap = {};
    const newStations = (originalDeliv.stations || []).map((s) => {
      const newStation = duplicateStation(s);
      stationIdMap[s.id] = newStation.id;
      return newStation;
    });

    // 2. Build the new deliverable
    const newDeliv = {
      id: uid(),
      name: `Copy of ${originalDeliv.name}`,
      startDate: '',
      dueDate: '',
      done: false,
      stations: newStations,
    };

    // 3. Find tasks linked to the original stations
    const originalStationIds = new Set(Object.keys(stationIdMap));
    const tasksToCopy = (tasks || []).filter(
      (t) => t.stationId && originalStationIds.has(t.stationId)
    );

    // 4. Show "duplicating" feedback if there are tasks to copy
    if (tasksToCopy.length > 0) {
      setDuplicating({ delivId: originalDeliv.id, taskCount: tasksToCopy.length });
    }

    // 5. Append new deliverable to the project
    const newDeliverables = [...deliverables, newDeliv];
    onUpdateProject(project.id, { deliverables: newDeliverables });

    // 6. Copy tasks (sequentially, to keep things simple and predictable)
    for (const t of tasksToCopy) {
      const copy = duplicateTask(t, stationIdMap[t.stationId]);
      try {
        await onAddTask(copy);
      } catch (err) {
        console.error('Failed to duplicate task:', err);
      }
    }

    // 7. Clear feedback
    setDuplicating(null);
  };

  let focused = null;
  if (focusKey) {
    const [dId, sId] = focusKey.split(':');
    const d = deliverables.find((x) => x.id === dId);
    const s = d?.stations?.find((x) => x.id === sId);
    if (d && s) focused = { deliverable: d, station: s };
  }

  const currentTheme = useCurrentTheme();
  const isKaspa = currentTheme === 'kaspa';

  if (focused) {
    return (
      <StationFocus
        project={project}
        deliverable={focused.deliverable}
        station={focused.station}
        allProjects={allProjects}
        tasks={tasks}
        members={members}
        workspaceId={workspaceId}
        categories={categories}
        priorities={priorities}
        statuses={statuses}
        onUpdateStation={(updatedStation) => {
          updateStation(focused.deliverable.id, focused.station.id, updatedStation);
        }}
        onAddTask={onAddTask}
        onUpdateTask={onUpdateTask}
        onToggleTask={onToggleTask}
        onDeleteTask={onDeleteTask}
        onAssignTask={onAssignTask}
        onClose={() => setFocusKey(null)}
      />
    );
  }

  const allStations = deliverables.flatMap((d) => d.stations || []);
  const totalStations = allStations.length;
  const doneStations = allStations.filter((s) => s.done).length;
  const awaitingReply = allStations.reduce(
    (acc, s) =>
      acc +
      (s.comms || []).filter((c) => c.needsReply && !c.replyReceived).length,
    0
  );

  return (
    <div style={styles.wrap}>
      <div style={{ ...styles.header, borderTop: `3px solid ${color}` }}>
        <div style={styles.headTop}>
          <div style={styles.headInfo}>
            <div style={styles.headTitle}>{project.name}</div>
            {project.number && (
              <div style={styles.headNumber}>#{project.number}</div>
            )}
          </div>
          {onClose && (
            <button onClick={onClose} style={styles.closeBtn} title="Close Track">
              ×
            </button>
          )}
        </div>
        <div style={styles.headStats}>
          <span style={styles.stat}>
            <strong>{deliverables.length}</strong> deliverable{deliverables.length === 1 ? '' : 's'}
          </span>
          <span style={styles.stat}>
            <strong>{doneStations}/{totalStations}</strong> stations complete
          </span>
          {awaitingReply > 0 && (
            <span style={{ ...styles.stat, color: '#ef9f27', fontWeight: 500 }}>
              ⟳ {awaitingReply} awaiting reply
            </span>
          )}
        </div>
      </div>

      {/* Duplication toast */}
      {duplicating && (
        <div style={styles.toast}>
          Duplicating deliverable… copying {duplicating.taskCount} task{duplicating.taskCount === 1 ? '' : 's'}
        </div>
      )}

      {isKaspa && deliverables.length > 0 ? (
        <BlockDagView
          project={project}
          allProjects={allProjects}
          deliverables={deliverables}
          tasks={tasks}
          onOpenStation={(delivId, stationId) => setFocusKey(`${delivId}:${stationId}`)}
        />
      ) : (
        <div style={styles.trainScroll}>
          {deliverables.length === 0 ? (
            <div style={styles.empty}>
              <div style={styles.emptyTitle}>No deliverables yet</div>
              <div style={styles.emptySub}>
                Deliverables hold the work — slide decks, abstracts, manuscripts.
                Each one gets its own train of stations.
              </div>
              <button
                onClick={() => addDeliverable()}
                style={{ ...styles.bigAddBtn, background: color }}
              >
                + Add first deliverable
              </button>
            </div>
          ) : (
            <div style={styles.deliverables}>
              {deliverables.map((d) => {
                const stations = d.stations || [];
                const dDone = stations.length > 0 && stations.every((s) => s.done);
                const currentIdx = stations.findIndex((s) => !s.done);
                return (
                  <div key={d.id} style={styles.deliv}>
                    <div style={styles.delivHead}>
                      <div style={styles.delivName}>
                        {dDone && <span style={{ color: '#1d9e75' }}>✓</span>}
                        <span
                          style={{
                            textDecoration: d.done ? 'line-through' : 'none',
                            opacity: d.done ? 0.65 : 1,
                          }}
                        >
                          {d.name}
                        </span>
                      </div>
                      <div style={styles.delivHeadRight}>
                        {(d.startDate || d.dueDate) && (
                          <div style={styles.delivDates}>
                            {d.startDate || '?'} → {d.dueDate || '?'}
                          </div>
                        )}
                        <button
                          onClick={() => duplicateDeliverable(d)}
                          disabled={duplicating !== null}
                          style={styles.dupBtn}
                          title="Duplicate this deliverable (copies stations + tasks, fresh state)"
                        >
                          ⎘ Duplicate
                        </button>
                      </div>
                    </div>

                    {stations.length === 0 ? (
                      <div style={styles.noStations}>
                        <span style={{ flex: 1 }}>No stations yet on this deliverable.</span>
                        {seedingForId === d.id ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            {(stationTemplates && stationTemplates.length > 0) ? (
                              stationTemplates.map((tpl) => (
                                <button
                                  key={tpl.id}
                                  onClick={() => {
                                    seedStationsFor(d.id, tpl);
                                    setSeedingForId(null);
                                  }}
                                  style={{ ...styles.inlineAddBtn, background: color, color: '#fff', border: 'none' }}
                                  title={`Apply: ${tpl.stages.join(' → ')}`}
                                >
                                  {tpl.name}
                                </button>
                              ))
                            ) : (
                              <button
                                onClick={() => {
                                  seedStationsFor(d.id);
                                  setSeedingForId(null);
                                }}
                                style={{ ...styles.inlineAddBtn, background: color, color: '#fff', border: 'none' }}
                              >
                                Standard
                              </button>
                            )}
                            <button
                              onClick={() => setSeedingForId(null)}
                              style={styles.inlineAddBtn}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              if (!stationTemplates || stationTemplates.length <= 1) {
                                seedStationsFor(d.id, stationTemplates?.[0]);
                              } else {
                                setSeedingForId(d.id);
                              }
                            }}
                            style={{ ...styles.inlineAddBtn, background: color, color: '#fff', border: 'none' }}
                          >
                            Use template
                            {stationTemplates && stationTemplates.length > 1 ? ' ▾' : ''}
                          </button>
                        )}
                        <button
                          onClick={() => addStationTo(d.id)}
                          style={styles.inlineAddBtn}
                        >
                          + Add station
                        </button>
                      </div>
                    ) : (
                      <div style={styles.train}>
                        {stations.map((s, i) => {
                          const isCurrent = i === currentIdx;
                          const isPast =
                            i < currentIdx || (currentIdx === -1 && i < stations.length);
                          const isDone = s.done;
                          const awaiting = (s.comms || []).filter(
                            (c) => c.needsReply && !c.replyReceived
                          ).length;
                          return (
                            <div key={s.id} style={styles.trainCol}>
                              {i > 0 && (
                                <div
                                  style={{
                                    ...styles.trainConnector,
                                    background: isPast ? color : 'var(--color-border-tertiary)',
                                  }}
                                />
                              )}
                              <button
                                onClick={() => setFocusKey(`${d.id}:${s.id}`)}
                                data-kaspa-block
                                style={{
                                  ...styles.trainNode,
                                  background: isDone
                                    ? color
                                    : isCurrent
                                    ? 'var(--bg-surface)'
                                    : 'var(--bg-surface)',
                                  borderColor: isDone || isCurrent ? color : 'var(--color-border-primary)',
                                  color: isDone ? '#fff' : isCurrent ? color : 'var(--color-text-secondary)',
                                  fontWeight: isCurrent || isDone ? 600 : 400,
                                }}
                                title={`Open ${s.name}`}
                              >
                                {isDone ? '✓' : i + 1}
                              </button>
                              <div
                                style={{
                                  ...styles.trainLabel,
                                  color: isCurrent ? color : 'var(--color-text-secondary)',
                                  fontWeight: isCurrent ? 500 : 400,
                                }}
                              >
                                {s.name}
                              </div>
                              {s.targetDate && (() => {
                                // Colour by deadline urgency, but only while the
                                // station is still open — a done station's
                                // deadline no longer matters.
                                const dc = !isDone ? deadlineColor(s.targetDate) : null;
                                return (
                                  <div
                                    style={{
                                      ...styles.trainDate,
                                      ...(dc ? { color: dc, fontWeight: 600 } : {}),
                                    }}
                                    title={!isDone ? `Deadline: ${s.targetDate}` : s.targetDate}
                                  >
                                    ⚑ {fmtDeadline(s.targetDate)}
                                  </div>
                                );
                              })()}
                              {awaiting > 0 && (
                                <div style={styles.trainAwaiting}>⟳ {awaiting}</div>
                              )}
                              {/* Quick add-task: creates an ordinary task named
                                  after this station, dated (default today). */}
                              <button
                                onClick={() => openStationTask(s.id)}
                                style={styles.trainAddTask}
                                title={`Add a task named “${s.name}” to your task list`}
                              >
                                ＋ task
                              </button>
                              {taskForStation === s.id && (
                                <div style={styles.trainTaskPicker} data-kaspa-block>
                                  <input
                                    type="date"
                                    value={taskDate}
                                    onChange={(e) => setTaskDate(e.target.value)}
                                    style={styles.trainTaskDate}
                                  />
                                  <button
                                    onClick={() => confirmStationTask(project?.name, s)}
                                    style={styles.trainTaskGo}
                                  >
                                    Add
                                  </button>
                                </div>
                              )}
                              {!s.done && (() => {
                                const lastAct = stationLastActivityAt(s);
                                if (!lastAct) return null;
                                const daysSince = (Date.now() - lastAct) / 86400000;
                                const rel = relativeTime(lastAct);
                                if (!rel) return null;
                                const isStale = daysSince > 7;
                                return (
                                  <div
                                    style={{
                                      fontSize: 9,
                                      color: isStale ? '#e24b4a' : 'var(--color-text-tertiary)',
                                      fontWeight: isStale ? 600 : 400,
                                      marginTop: 2,
                                    }}
                                    title={
                                      isStale
                                        ? `No activity for ${Math.floor(daysSince)} days`
                                        : `Last activity ${rel}`
                                    }
                                  >
                                    {isStale ? `⚠ ${rel}` : rel}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                        <div style={styles.trainCol}>
                          <div
                            style={{
                              ...styles.trainConnector,
                              background: 'var(--color-border-tertiary)',
                            }}
                          />
                          <button
                            onClick={() => addStationTo(d.id)}
                            style={styles.addStationNode}
                            title="Add a station to this deliverable"
                          >
                            +
                          </button>
                          <div style={styles.addStationLabel}>Add station</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                onClick={() => addDeliverable()}
                style={styles.addDelivBtn}
              >
                + Add deliverable
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-surface)',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 20px 12px 20px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    background: 'var(--color-background-tertiary)',
  },
  headTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headInfo: { flex: 1 },
  headTitle: { fontSize: 20, fontWeight: 600, color: 'var(--color-text-primary)' },
  headNumber: { fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 24,
    color: 'var(--color-text-secondary)',
    width: 32,
    height: 32,
    cursor: 'pointer',
  },
  headStats: { display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-text-secondary)' },
  stat: { display: 'flex', alignItems: 'center', gap: 4 },

  // Duplication toast
  toast: {
    padding: '8px 16px',
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    fontSize: 12,
    fontWeight: 500,
    textAlign: 'center',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },

  trainScroll: { flex: 1, overflowY: 'auto', padding: 20 },
  deliverables: { display: 'flex', flexDirection: 'column', gap: 24 },
  deliv: {
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 10,
    padding: '14px 18px',
  },
  delivHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  delivName: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  delivHeadRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  delivDates: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    fontFamily: 'monospace',
  },

  // Duplicate button
  dupBtn: {
    padding: '4px 10px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  noStations: {
    padding: '10px 12px',
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    background: 'var(--color-background-secondary)',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  inlineAddBtn: {
    padding: '4px 10px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  addStationNode: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: '1.5px dashed var(--color-border-primary)',
    background: 'transparent',
    color: 'var(--color-text-tertiary)',
    fontSize: 18,
    cursor: 'pointer',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addStationLabel: {
    fontSize: 10,
    marginTop: 8,
    color: 'var(--color-text-tertiary)',
    textAlign: 'center',
  },
  addDelivBtn: {
    alignSelf: 'flex-start',
    padding: '8px 16px',
    background: 'transparent',
    border: '1px dashed var(--color-border-primary)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  bigAddBtn: {
    marginTop: 14,
    padding: '8px 18px',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  empty: {
    padding: 40,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    maxWidth: 400,
    margin: '0 auto',
    lineHeight: 1.5,
  },
  train: {
    display: 'flex',
    alignItems: 'flex-start',
    overflowX: 'auto',
    paddingTop: 8,
    paddingBottom: 8,
  },
  trainCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: 96,
    position: 'relative',
  },
  trainConnector: {
    position: 'absolute',
    top: 18,
    left: '-50%',
    width: '100%',
    height: 2,
    zIndex: 0,
  },
  trainNode: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: '2.5px solid',
    cursor: 'pointer',
    fontSize: 13,
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainLabel: {
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 100,
  },
  trainDate: {
    fontSize: 9,
    color: 'var(--color-text-tertiary)',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  trainAwaiting: {
    fontSize: 9,
    color: '#ef9f27',
    fontWeight: 600,
    marginTop: 4,
  },
  trainAddTask: {
    marginTop: 5,
    fontSize: 9,
    fontWeight: 500,
    padding: '2px 7px',
    borderRadius: 10,
    border: '0.5px solid var(--color-border-secondary)',
    background: 'transparent',
    color: 'var(--accent)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  trainTaskPicker: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  trainTaskDate: {
    fontSize: 9,
    padding: '1px 3px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 4,
    background: 'var(--bg-surface)',
    color: 'var(--color-text-primary)',
    width: 92,
  },
  trainTaskGo: {
    fontSize: 9,
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: 10,
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
  },
};


