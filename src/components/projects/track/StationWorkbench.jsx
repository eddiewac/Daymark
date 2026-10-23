import { useEffect, useState } from 'react';
import { uid, addBusinessDays } from '../../../lib/utils.js';
import { loadTimeForTasks } from '../../../lib/time.js';
import { pulseSave } from '../../../lib/savePulse.js';

// Station workbench — one beat on top of the track: tasks, timer, log a comm
// into Today · Waiting, and advance. The train stays underneath.

function fmtH(n) {
  const x = Math.round((Number(n) || 0) * 10) / 10;
  if (Number.isInteger(x)) return String(x);
  return x.toFixed(1);
}

function fmtDue(iso) {
  if (!iso) return '—';
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtShort(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function StationWorkbench({
  project,
  deliverable,
  station,
  tasks,
  blocks,
  runningTimer,
  onStartTimer,
  onStopTimer,
  onUpdateStation,
  onSelectStation,
  onClose,
  onAddTask,
  onToggleTask,
  onOpenProject,
  onAddStation,
}) {
  const stations = deliverable?.stations || [];
  const stationIdx = stations.findIndex((s) => s.id === station?.id);
  const nextStation = stationIdx >= 0 ? stations[stationIdx + 1] || null : null;
  const stationTasks = (tasks || []).filter((t) => t.stationId === station?.id);
  const deliverableTaskIds = (tasks || [])
    .filter((t) => {
      if (t.deliverableId && t.deliverableId === deliverable?.id) return true;
      return t.stationId && stations.some((s) => s.id === t.stationId);
    })
    .map((t) => t.id);

  const [hoursByTask, setHoursByTask] = useState({});
  const [commOpen, setCommOpen] = useState(false);
  const [advanceAsk, setAdvanceAsk] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [loop, setLoop] = useState('');
  const [who, setWho] = useState('');
  const [commType, setCommType] = useState('Email');
  const [note, setNote] = useState('');
  const [expectBy, setExpectBy] = useState(addBusinessDays(3));

  const idsKey = deliverableTaskIds.join(',');
  const blockStamp = (blocks || []).length;

  useEffect(() => {
    setAdvanceAsk(false);
    setCommOpen(false);
    setLoop('');
    setAdding(false);
  }, [station?.id]);

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : [];
    if (ids.length === 0) {
      setHoursByTask({});
      return;
    }
    let cancel = false;
    loadTimeForTasks(ids).then((map) => {
      if (!cancel) setHoursByTask(map || {});
    });
    return () => {
      cancel = true;
    };
  }, [idsKey, blockStamp]);

  const budget = (tasks || [])
    .filter((t) => deliverableTaskIds.includes(t.id))
    .reduce((s, t) => s + (Number(t.estimate) || 0), 0);
  const logged = deliverableTaskIds.reduce((s, id) => s + (Number(hoursByTask[id]) || 0), 0);
  const incomplete = stationTasks.filter((t) => !t.done);
  const owner = station?.owner || deliverable?.owner || '—';
  const due = deliverable?.dueDate || station?.targetDate || '';

  const updateStation = (patch) => {
    if (!onUpdateStation || !station) return;
    onUpdateStation({ ...station, ...patch });
  };

  const commitAdvance = () => {
    if (!station || station.done) {
      setAdvanceAsk(false);
      return;
    }
    updateStation({ done: true, completedAt: new Date().toISOString() });
    setAdvanceAsk(false);
    pulseSave();
    if (nextStation && onSelectStation) onSelectStation(nextStation.id);
  };

  const requestAdvance = () => {
    if (incomplete.length > 0) {
      setAdvanceAsk(true);
      return;
    }
    commitAdvance();
  };

  const saveComm = () => {
    const expectReplyBy = expectBy || addBusinessDays(3);
    const person = who.trim() || 'them';
    const newComm = {
      id: uid(),
      type: commType || 'Email',
      who: who.trim(),
      note: note.trim(),
      color: '#d97706',
      needsReply: true,
      sentAt: Date.now(),
      replyReceived: false,
      replyAt: null,
      expectReplyBy,
    };
    updateStation({ comms: [...(station.comms || []), newComm] });
    setCommOpen(false);
    setNote('');
    pulseSave();
    setLoop(`Saved · now on Today · Waiting (${person} · expect ${fmtShort(expectReplyBy)})`);
  };

  const addStationTask = async () => {
    const title = draft.trim();
    if (!title || !onAddTask) return;
    await onAddTask({
      title,
      project: project?.name || '',
      projectId: project?.id || '',
      projectName: (project?.name || '').trim(),
      stationId: station.id,
      deliverableId: deliverable?.id || '',
      deliverableName: deliverable?.name || '',
    });
    setDraft('');
    setAdding(false);
    pulseSave();
  };

  const addStation = () => {
    if (!onAddStation) return;
    onAddStation({
      id: uid(),
      name: 'New station',
      startDate: '',
      targetDate: '',
      owner: '',
      estHours: 0,
      actualHours: null,
      done: false,
      completedAt: null,
      notes: '',
      comms: [],
    });
    pulseSave();
  };

  if (!project || !deliverable || !station) return null;

  const pct = budget > 0 ? Math.min(100, Math.round((logged / budget) * 100)) : 0;

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div
        style={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Work this station"
      >
        <style>{'@media (max-width: 980px) { .dm-workbench { grid-template-columns: 1fr !important; } }'}</style>
        <div className="dm-workbench" style={styles.layout}>
          <main style={styles.card}>
            <div style={styles.cardHd}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {(project.name || '').trim() ? (
                  <div style={styles.projectTitle}>{project.name.trim()}</div>
                ) : (
                  <h1 style={styles.h1}>Work this station</h1>
                )}
                <div style={styles.titleLine}>
                  <h1 style={styles.h1}>{deliverable.name || 'Deliverable'}</h1>
                  {project.id && onOpenProject ? (
                    <button type="button" style={styles.linkBtn} onClick={() => onOpenProject(project.id)}>
                      Open project
                    </button>
                  ) : null}
                </div>
                <p style={styles.sub}>
                  Work this station · owner {owner} · due {fmtDue(due)}
                </p>
              </div>
              <div style={styles.badge}>
                {station.name || 'Station'}
                <small>
                  station {stationIdx + 1} of {stations.length || 1}
                </small>
              </div>
              <button type="button" onClick={onClose} style={styles.close} aria-label="Close workbench">
                ×
              </button>
            </div>
            <div style={styles.pipe} aria-label="Station spine">
              {stations.map((s, i) => {
                const on = s.id === station.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelectStation && onSelectStation(s.id)}
                    style={{
                      ...styles.pipeBtn,
                      ...(s.done ? styles.pipeDone : {}),
                      ...(on ? styles.pipeOn : {}),
                    }}
                    aria-current={on ? 'true' : undefined}
                  >
                    <span style={{ ...styles.n, ...(s.done ? styles.nDone : {}), ...(on ? styles.nOn : {}) }}>
                      {s.done ? '✓' : i + 1}
                    </span>
                    {s.name || 'Station'}
                  </button>
                );
              })}
            </div>
            {onAddStation && (
              <div style={styles.addStationRow}>
                <button type="button" style={styles.addQuiet} onClick={addStation}>
                  + Add station
                </button>
              </div>
            )}
            <div style={styles.bd}>
              <p style={styles.label}>Tasks for this station</p>
              {stationTasks.length === 0 && (
                <div style={styles.emptyTasks}>No tasks on this station yet.</div>
              )}
              {stationTasks.map((task) => {
                const est = Number(task.estimate) || 0;
                const got = Number(hoursByTask[task.id]) || 0;
                const running = runningTimer?.taskId === task.id;
                const meta = [
                  est ? `Est. ${fmtH(est)}h` : null,
                  got ? `logged ${fmtH(got)}h` : task.done ? 'logged 0h' : 'not started',
                  running ? 'in progress' : null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <div
                    key={task.id}
                    style={{
                      ...styles.task,
                      ...(task.done ? styles.taskDone : {}),
                      ...(running ? styles.taskActive : {}),
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        ...styles.check,
                        ...(task.done ? styles.checkOn : {}),
                      }}
                      aria-pressed={task.done ? 'true' : 'false'}
                      onClick={() => {
                        onToggleTask && onToggleTask(task.id);
                        pulseSave();
                      }}
                    >
                      {task.done ? '✓' : ''}
                    </button>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...styles.taskTitle, ...(task.done ? styles.struck : {}) }}>
                        {task.title || '(untitled)'}
                      </div>
                      <div style={styles.taskMeta}>{meta}</div>
                    </div>
                    {task.done ? (
                      <span style={styles.doneLbl}>Done</span>
                    ) : running ? (
                      <button type="button" style={styles.stopBtn} onClick={onStopTimer}>
                        ■ Stop
                      </button>
                    ) : (
                      <button
                        type="button"
                        style={styles.startBtn}
                        onClick={() => onStartTimer && onStartTimer(task)}
                        disabled={!onStartTimer}
                      >
                        ▶ Start timer
                      </button>
                    )}
                  </div>
                );
              })}

              <div style={styles.actions}>
                <button type="button" style={styles.btn} onClick={() => { setCommOpen(true); setLoop(''); }}>
                  ✉ Log comm
                </button>
                <button type="button" style={styles.okBtn} onClick={requestAdvance} disabled={station.done}>
                  {station.done
                    ? 'Station complete'
                    : nextStation
                    ? `→ Advance to ${nextStation.name || 'next'}`
                    : '→ Mark station done'}
                </button>
                <button type="button" style={styles.ghost} onClick={() => setAdding((v) => !v)}>
                  + Add station task
                </button>
                <span style={styles.hint}>One place: tasks · time · comm · advance</span>
              </div>

              {advanceAsk && (
                <div style={styles.confirm} role="dialog" aria-label="Confirm advance with incomplete tasks">
                  <div style={styles.confirmMsg}>
                    <strong>
                      {incomplete.length} station task{incomplete.length === 1 ? '' : 's'} still incomplete.
                    </strong>{' '}
                    Advance {station.name || 'this station'}
                    {nextStation ? ` → ${nextStation.name || 'next'}` : ''} anyway?
                  </div>
                  <button type="button" style={styles.okBtn} onClick={commitAdvance}>
                    Advance anyway
                  </button>
                  <button type="button" style={styles.ghost} onClick={() => setAdvanceAsk(false)}>
                    Keep working
                  </button>
                </div>
              )}

              {loop && <div style={styles.loop}>{loop}</div>}

              {adding && (
                <div style={styles.addRow}>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addStationTask()}
                    placeholder="New task for this station"
                    style={styles.input}
                  />
                  <button type="button" style={styles.primary} onClick={addStationTask}>
                    Add
                  </button>
                </div>
              )}

              {commOpen && (
                <div style={styles.comm}>
                  <label style={styles.fieldLbl}>To / channel</label>
                  <div style={styles.row2}>
                    <input
                      value={who}
                      onChange={(e) => setWho(e.target.value)}
                      placeholder="Who you’re waiting on"
                      style={styles.input}
                    />
                    <select
                      aria-label="Type"
                      value={commType}
                      onChange={(e) => setCommType(e.target.value)}
                      style={styles.input}
                    >
                      <option>Email</option>
                      <option>Slack / Teams</option>
                      <option>Call</option>
                    </select>
                  </div>
                  <label style={styles.fieldLbl}>What was said / asked</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    style={{ ...styles.input, resize: 'vertical' }}
                  />
                  <div style={styles.row2}>
                    <div>
                      <label style={styles.fieldLbl}>Expect reply by</label>
                      <input
                        type="date"
                        value={expectBy}
                        onChange={(e) => setExpectBy(e.target.value)}
                        style={styles.input}
                      />
                    </div>
                    <div style={styles.commBtns}>
                      <button type="button" style={styles.primary} onClick={saveComm}>
                        Save comm + wait
                      </button>
                      <button type="button" style={styles.ghost} onClick={() => setCommOpen(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
          <aside style={styles.side}>
            <div style={styles.sideCard}>
              <h3 style={styles.sideH}>Budget vs actual</h3>
              <div style={styles.budget}>
                <span>This deliverable</span>
                <span style={styles.budgetV}>
                  {fmtH(logged)}h / {fmtH(budget)}h
                </span>
              </div>
              <div style={styles.bar}>
                <i style={{ ...styles.barFill, width: `${pct}%` }} />
              </div>
              <p style={styles.sideNote}>Your logged hours / estimate. Also shown on Today · Do.</p>
            </div>
            <div style={styles.sideCard}>
              <h3 style={styles.sideH}>Station context</h3>
              <dl style={styles.kv}>
                <dt style={styles.dt}>Project</dt>
                <dd style={styles.ddProject}>{(project.name || '').trim() || '—'}</dd>
                <dt style={styles.dt}>Deliverable</dt>
                <dd style={styles.dd}>{deliverable.name || '—'}</dd>
                <dt style={styles.dt}>Owner</dt>
                <dd style={styles.dd}>{owner}</dd>
                <dt style={styles.dt}>Due</dt>
                <dd style={styles.dd}>{fmtDue(due)}</dd>
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17,24,39,0.45)',
    zIndex: 980,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '28px 16px',
    overflow: 'auto',
  },
  panel: { width: 'min(1180px, 100%)' },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 390px',
    gap: 14,
  },
  card: {
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 12,
    boxShadow: '0 12px 40px rgba(17,24,39,.18)',
    overflow: 'hidden',
  },
  cardHd: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    padding: '14px 16px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  projectTitle: {
    margin: '0 0 2px',
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: '-0.015em',
    color: 'var(--color-text-primary)',
  },
  titleLine: { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  h1: { margin: 0, fontSize: 16, fontWeight: 650 },
  linkBtn: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    color: 'var(--accent)',
    fontWeight: 650,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  sub: { margin: '3px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' },
  addStationRow: {
    padding: '4px 14px 8px',
    background: 'var(--color-background-secondary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  addQuiet: {
    border: 'none',
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '2px 0',
    fontFamily: 'inherit',
  },
  badge: {
    flexShrink: 0,
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    border: '0.5px solid var(--accent)',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
    textAlign: 'center',
    lineHeight: 1.25,
  },
  close: {
    border: 'none',
    background: 'transparent',
    fontSize: 20,
    lineHeight: 1,
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    padding: '0 2px',
  },
  pipe: {
    display: 'flex',
    gap: 4,
    padding: '10px 14px',
    overflowX: 'auto',
    background: 'var(--color-background-secondary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  pipeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    border: '0.5px solid transparent',
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    fontSize: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  pipeOn: {
    background: 'var(--accent-soft)',
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
    fontWeight: 650,
  },
  pipeDone: { color: '#059669' },
  n: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '1px solid var(--color-border-secondary)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 700,
  },
  nOn: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  nDone: { background: '#ecfdf5', color: '#059669', borderColor: '#a7f3d0' },
  bd: { padding: '14px 16px 16px' },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--color-text-secondary)',
    margin: '0 0 8px',
  },
  emptyTasks: { fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 },
  task: {
    display: 'grid',
    gridTemplateColumns: '20px minmax(0, 1fr) auto',
    gap: 10,
    alignItems: 'center',
    padding: '10px 12px',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 8,
    marginBottom: 6,
    background: 'var(--color-background-secondary)',
  },
  taskDone: { opacity: 0.7 },
  taskActive: { borderColor: 'var(--accent)', background: 'var(--accent-soft)' },
  check: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '1.5px solid var(--color-border-secondary)',
    background: 'var(--bg-surface)',
    padding: 0,
    color: 'transparent',
    fontSize: 11,
    cursor: 'pointer',
  },
  checkOn: { background: '#059669', borderColor: '#059669', color: '#fff' },
  taskTitle: { fontWeight: 550, fontSize: 13.5 },
  struck: { textDecoration: 'line-through', color: 'var(--color-text-secondary)' },
  taskMeta: { fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 },
  startBtn: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 650,
    cursor: 'pointer',
  },
  stopBtn: {
    background: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 650,
    cursor: 'pointer',
  },
  doneLbl: { fontSize: 12, color: 'var(--color-text-tertiary)' },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTop: '0.5px solid var(--color-border-tertiary)',
  },
  btn: {
    border: '0.5px solid var(--color-border-secondary)',
    background: 'var(--bg-surface)',
    borderRadius: 8,
    padding: '6px 11px',
    fontWeight: 650,
    fontSize: 12.5,
    cursor: 'pointer',
  },
  okBtn: {
    background: '#ecfdf5',
    color: '#059669',
    border: '0.5px solid #a7f3d0',
    borderRadius: 8,
    padding: '6px 11px',
    fontWeight: 650,
    fontSize: 12.5,
    cursor: 'pointer',
  },
  ghost: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-secondary)',
    fontWeight: 550,
    fontSize: 12.5,
    cursor: 'pointer',
    padding: '6px 8px',
  },
  primary: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '6px 11px',
    fontWeight: 650,
    fontSize: 12.5,
    cursor: 'pointer',
  },
  hint: { marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-tertiary)' },
  confirm: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    marginTop: 10,
    padding: '10px 12px',
    border: '0.5px solid #fde68a',
    background: '#fffbeb',
    borderRadius: 8,
    fontSize: 12.5,
    color: '#92400e',
  },
  confirmMsg: { flex: 1, minWidth: 180 },
  loop: {
    marginTop: 10,
    padding: '8px 12px',
    border: '0.5px solid #a7f3d0',
    background: '#ecfdf5',
    borderRadius: 8,
    fontSize: 12.5,
    color: '#059669',
    fontWeight: 550,
  },
  addRow: { display: 'flex', gap: 8, marginTop: 10 },
  comm: {
    marginTop: 12,
    border: '1px dashed var(--accent)',
    background: 'var(--accent-soft)',
    borderRadius: 8,
    padding: 12,
  },
  fieldLbl: {
    display: 'block',
    fontSize: 12,
    fontWeight: 650,
    color: 'var(--color-text-secondary)',
    marginBottom: 4,
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  input: {
    width: '100%',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 7,
    padding: '7px 9px',
    marginBottom: 8,
    background: 'var(--bg-surface)',
    color: 'var(--color-text-primary)',
    boxSizing: 'border-box',
  },
  commBtns: { display: 'flex', alignItems: 'flex-end', gap: 8, paddingBottom: 8 },
  side: { display: 'flex', flexDirection: 'column', gap: 12 },
  sideCard: {
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 12,
    padding: '16px 18px',
    boxShadow: '0 1px 2px rgba(0,0,0,.06)',
  },
  sideH: { margin: '0 0 10px', fontSize: 16, fontWeight: 650 },
  budget: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, fontSize: 16 },
  budgetV: { fontWeight: 700, fontSize: 20, color: '#d97706', fontVariantNumeric: 'tabular-nums' },
  bar: {
    height: 8,
    background: 'var(--color-background-secondary)',
    borderRadius: 999,
    border: '0.5px solid var(--color-border-tertiary)',
    overflow: 'hidden',
  },
  barFill: { display: 'block', height: '100%', background: '#d97706' },
  sideNote: { margin: '10px 0 0', fontSize: 14, lineHeight: 1.4, color: 'var(--color-text-secondary)' },
  kv: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '8px 14px',
    alignItems: 'baseline',
    fontSize: 15,
    margin: 0,
  },
  dt: { color: 'var(--color-text-secondary)', fontWeight: 600 },
  dd: { margin: 0 },
  ddProject: { margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.3 },
};
