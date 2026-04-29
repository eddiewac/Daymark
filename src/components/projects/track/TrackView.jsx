import { useState } from 'react';
import { projectColor } from '../../../lib/constants.js';
import { uid } from '../../../lib/utils.js';
import StationFocus from './StationFocus.jsx';

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

export default function TrackView({
  project,
  allProjects,
  tasks,
  members,
  workspaceId,
  onUpdateProject,
  onAddTask,
  onUpdateTask,
  onToggleTask,
  onDeleteTask,
  onAssignTask,
  onClose,
}) {
  const [focusKey, setFocusKey] = useState(null); // "delivId:stationId"
  const color = projectColor(project.name, allProjects);
  const deliverables = project.deliverables || [];

  // ── Helpers ────────────────────────────────────────────────────────────────
  const updateStation = (delivId, stationId, patch) => {
    const newDeliverables = deliverables.map((d) => {
      if (d.id !== delivId) return d;
      return {
        ...d,
        stations: (d.stations || []).map((s) =>
          s.id === stationId ? { ...s, ...patch } : s
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

  const seedStationsFor = (delivId) => {
    const newDeliverables = deliverables.map((d) => {
      if (d.id !== delivId) return d;
      return {
        ...d,
        stations: DEFAULT_STATIONS.map((s) => mkStation(s.name)),
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

  // Find currently focused station
  let focused = null;
  if (focusKey) {
    const [dId, sId] = focusKey.split(':');
    const d = deliverables.find((x) => x.id === dId);
    const s = d?.stations?.find((x) => x.id === sId);
    if (d && s) focused = { deliverable: d, station: s };
  }

  // If focused, show the focus view
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

  // ── Otherwise: project-level train overview ────────────────────────────────

  // Aggregated stats
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
      {/* Header */}
      <div style={{ ...styles.header, borderTop: `3px solid ${color}` }}>
        <div style={styles.headTop}>
          <div style={styles.headInfo}>
            <div style={styles.headTitle}>{project.name}</div>
            {project.number && (
              <div style={styles.headNumber}>#{project.number}</div>
            )}
          </div>
          <button onClick={onClose} style={styles.closeBtn} title="Close Track">
            ×
          </button>
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
              ⏳ {awaitingReply} awaiting reply
            </span>
          )}
        </div>
      </div>

      {/* Train body */}
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
                    {(d.startDate || d.dueDate) && (
                      <div style={styles.delivDates}>
                        {d.startDate || '?'} → {d.dueDate || '?'}
                      </div>
                    )}
                  </div>

                  {stations.length === 0 ? (
                    <div style={styles.noStations}>
                      <span style={{ flex: 1 }}>No stations yet on this deliverable.</span>
                      <button
                        onClick={() => seedStationsFor(d.id)}
                        style={{ ...styles.inlineAddBtn, background: color, color: '#fff', border: 'none' }}
                      >
                        Use default stages
                      </button>
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
                              style={{
                                ...styles.trainNode,
                                background: isDone
                                  ? color
                                  : isCurrent
                                  ? '#fff'
                                  : '#fff',
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
                            {s.targetDate && (
                              <div style={styles.trainDate}>{s.targetDate}</div>
                            )}
                            {awaiting > 0 && (
                              <div style={styles.trainAwaiting}>⏳ {awaiting}</div>
                            )}
                          </div>
                        );
                      })}
                      {/* Trailing add-station tile */}
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
    </div>
  );
}

const styles = {
  wrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
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
  trainScroll: { flex: 1, overflowY: 'auto', padding: 20 },
  deliverables: { display: 'flex', flexDirection: 'column', gap: 24 },
  deliv: {
    background: '#fff',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 10,
    padding: '14px 18px',
  },
  delivHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  delivName: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  delivDates: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    fontFamily: 'monospace',
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
    fontSize: 13,
    cursor: 'pointer',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.15s',
  },
  trainLabel: {
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 88,
    lineHeight: 1.25,
  },
  trainDate: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    marginTop: 3,
    fontFamily: 'monospace',
  },
  trainAwaiting: {
    marginTop: 4,
    fontSize: 9,
    padding: '1px 6px',
    borderRadius: 8,
    background: '#ef9f2722',
    color: '#ef9f27',
    fontWeight: 500,
  },
  empty: {
    padding: 40,
    textAlign: 'center',
    background: 'var(--color-background-secondary)',
    borderRadius: 10,
  },
  emptyTitle: { fontSize: 14, fontWeight: 600, marginBottom: 4 },
  emptySub: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    maxWidth: 380,
    margin: '0 auto',
  },
};
