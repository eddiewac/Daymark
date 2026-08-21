import { useMemo, useState } from 'react';
import { canTrackTime } from '../../hooks/useTime.js';
import { localDateStr, todayStr } from '../../lib/utils.js';
import { projectColor } from '../../lib/constants.js';
import BlocksEditor from './BlocksEditor.jsx';

// ── Week helpers ─────────────────────────────────────────────────────────────
function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtDayHeader(d) {
  return d.toLocaleString(undefined, { weekday: 'short' }).slice(0, 3);
}

function fmtDayDate(d) {
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short' });
}

export default function TimesheetPanel({
  tasks,
  projects,
  blocks,
  loadingEntries,
  runningTimer,
  currentUserId,
  workspaceId,
  onAddBlock,
  onUpdateBlock,
  onRemoveBlock,
  onStartTimer,
  onRequestStop,
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [editingCell, setEditingCell] = useState(null); // { taskId, date }

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const dayKeys = useMemo(() => days.map((d) => localDateStr(d)), [days]);

  // Build a map from "taskId|date" -> array of blocks
  const blocksByCell = useMemo(() => {
    const m = {};
    for (const b of blocks) {
      const key = `${b.taskId}|${b.date}`;
      (m[key] = m[key] || []).push(b);
    }
    return m;
  }, [blocks]);

  // Visible tasks: only tasks with time logged this week.
  // The timesheet is a record of logged time — to track a new task, start
  // its timer from the Tasks or Projects view; once it has time, it appears
  // here automatically.
  const visibleTasks = useMemo(() => {
    const dayKeySet = new Set(dayKeys);
    const taskHasHoursThisWeek = (taskId) =>
      blocks.some((b) => b.taskId === taskId && dayKeySet.has(b.date));

    return (tasks || [])
      .filter((t) => taskHasHoursThisWeek(t.id))
      .sort((a, b) => {
        if (!!a.done !== !!b.done) return a.done ? 1 : -1;
        if (a.project && !b.project) return -1;
        if (!a.project && b.project) return 1;
        if (a.project !== b.project) return (a.project || '').localeCompare(b.project || '');
        return (a.title || '').localeCompare(b.title || '');
      });
  }, [tasks, blocks, dayKeys]);

  const dayTotals = useMemo(() => {
    return dayKeys.map((dk) =>
      visibleTasks.reduce((sum, t) => {
        const cellBlocks = blocksByCell[`${t.id}|${dk}`] || [];
        return sum + cellBlocks.reduce((s, b) => s + (b.hours || 0), 0);
      }, 0)
    );
  }, [visibleTasks, dayKeys, blocksByCell]);

  const weekTotal = dayTotals.reduce((a, b) => a + b, 0);

  const goPrev = () => setWeekStart(addDays(weekStart, -7));
  const goNext = () => setWeekStart(addDays(weekStart, 7));
  const goToday = () => setWeekStart(startOfWeek(new Date()));

  // Editing cell context
  const editingTask = editingCell
    ? visibleTasks.find((t) => t.id === editingCell.taskId)
    : null;
  const editingBlocks = editingCell
    ? blocksByCell[`${editingCell.taskId}|${editingCell.date}`] || []
    : [];

  return (
    <div style={styles.wrap}>
      <div style={styles.toolbar}>
        <button onClick={goPrev} style={styles.navBtn}>‹</button>
        <button onClick={goToday} style={styles.todayBtn}>Today</button>
        <button onClick={goNext} style={styles.navBtn}>›</button>
        <div style={styles.weekLabel}>
          {weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          {' – '}
          {addDays(weekStart, 6).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
        <div style={styles.spacer} />
        <div style={styles.weekTotal}>
          Total: <strong>{weekTotal.toFixed(2)}h</strong>
        </div>
      </div>

      <div style={styles.scroll}>
        {loadingEntries ? (
          <div style={styles.empty}>Loading…</div>
        ) : visibleTasks.length === 0 ? (
          <div style={styles.empty}>
            No time logged this week. Start a timer from the Tasks or Projects view, and tracked tasks will appear here.
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.taskCol }}>Task</th>
                {days.map((d, i) => {
                  const isToday = localDateStr(d) === todayStr();
                  return (
                    <th
                      key={i}
                      style={{
                        ...styles.th,
                        ...styles.dayCol,
                        ...(isToday ? styles.thToday : {}),
                      }}
                    >
                      <div>{fmtDayHeader(d)}</div>
                      <div style={styles.thDate}>{fmtDayDate(d)}</div>
                    </th>
                  );
                })}
                <th style={{ ...styles.th, ...styles.totalCol }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {visibleTasks.map((t) => {
                const taskTotal = dayKeys.reduce((sum, dk) => {
                  const bks = blocksByCell[`${t.id}|${dk}`] || [];
                  return sum + bks.reduce((s, b) => s + (b.hours || 0), 0);
                }, 0);
                const canTrack = canTrackTime(t, currentUserId, workspaceId);
                const isRunning = runningTimer?.taskId === t.id;
                const projColor = projectColor(t.project, projects);
                return (
                  <tr key={t.id} style={t.outOfScope ? styles.oosRowTint : undefined}>
                    <td style={{ ...styles.td, ...styles.taskCol, ...styles.taskCell }}>
                      {canTrack && (
                        <button
                          onClick={() =>
                            isRunning ? onRequestStop() : onStartTimer(t)
                          }
                          style={{
                            ...styles.timerBtn,
                            background: isRunning ? '#FF6B35' : 'transparent',
                            color: isRunning ? '#fff' : projColor,
                            borderColor: isRunning ? '#FF6B35' : projColor,
                          }}
                          title={isRunning ? 'Stop timer' : 'Start timer'}
                        >
                          {isRunning ? '■' : '▶'}
                        </button>
                      )}
                      <div style={styles.taskInfo}>
                        <div
                          style={{
                            ...styles.taskTitle,
                            textDecoration: t.done ? 'line-through' : 'none',
                            opacity: t.done ? 0.6 : 1,
                          }}
                        >
                          {t.title || '(untitled)'}
                          {t.outOfScope && (
                            <span
                              style={styles.oosBadgeWhole}
                              title={
                                t.outOfScopeNotes
                                  ? `Out of scope — ${t.outOfScopeNotes}`
                                  : 'This whole task is out of scope'
                              }
                            >
                              OOS
                            </span>
                          )}
                        </div>
                        {t.project && (
                          <div
                            style={{
                              ...styles.taskProject,
                              color: projColor,
                            }}
                          >
                            {t.project}
                          </div>
                        )}
                      </div>
                    </td>
                    {dayKeys.map((dk) => {
                      const cellBlocks = blocksByCell[`${t.id}|${dk}`] || [];
                      const cellHours = cellBlocks.reduce(
                        (s, b) => s + (b.hours || 0),
                        0
                      );
                      const isToday = dk === todayStr();
                      return (
                        <td
                          key={dk}
                          style={{
                            ...styles.td,
                            ...styles.dayCol,
                            ...(isToday ? styles.tdToday : {}),
                          }}
                        >
                          <button
                            onClick={() => {
                              if (!canTrack) return;
                              setEditingCell({ taskId: t.id, date: dk });
                            }}
                            disabled={!canTrack}
                            style={{
                              ...styles.cellBtn,
                              ...(cellHours > 0 ? styles.cellBtnFilled : {}),
                              cursor: canTrack ? 'pointer' : 'not-allowed',
                              color: canTrack
                                ? cellHours > 0
                                  ? 'var(--accent)'
                                  : 'var(--color-text-tertiary)'
                                : 'var(--color-text-tertiary)',
                            }}
                            title={
                              canTrack
                                ? cellBlocks.length > 0
                                  ? `${cellBlocks.length} block${cellBlocks.length === 1 ? '' : 's'} — click to edit`
                                  : 'Click to add a block'
                                : 'Not assigned to you'
                            }
                          >
                            {cellHours > 0 ? cellHours.toFixed(2) : canTrack ? '+' : ''}
                            {cellBlocks.length > 1 && (
                              <span style={styles.blockCount}>
                                {cellBlocks.length}
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td
                      style={{
                        ...styles.td,
                        ...styles.totalCol,
                        ...styles.totalCell,
                      }}
                    >
                      {taskTotal > 0 ? taskTotal.toFixed(2) : ''}
                    </td>
                  </tr>
                );
              })}
              <tr style={styles.totalRow}>
                <td style={{ ...styles.td, ...styles.taskCol, fontWeight: 600 }}>
                  Daily totals
                </td>
                {dayTotals.map((dt, i) => (
                  <td
                    key={i}
                    style={{
                      ...styles.td,
                      ...styles.dayCol,
                      fontWeight: 600,
                      color: dt > 0 ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      padding: '8px 4px',
                    }}
                  >
                    {dt > 0 ? dt.toFixed(2) : '—'}
                  </td>
                ))}
                <td
                  style={{
                    ...styles.td,
                    ...styles.totalCol,
                    fontWeight: 700,
                    background: 'var(--accent-soft)',
                  }}
                >
                  {weekTotal > 0 ? weekTotal.toFixed(2) : ''}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {editingCell && editingTask && (
        <BlocksEditor
          taskTitle={editingTask.title || '(untitled)'}
          date={editingCell.date}
          blocks={editingBlocks}
          taskId={editingCell.taskId}
          onAddBlock={onAddBlock}
          onUpdateBlock={onUpdateBlock}
          onRemoveBlock={onRemoveBlock}
          onClose={() => setEditingCell(null)}
        />
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
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  navBtn: {
    width: 28,
    height: 28,
    border: '0.5px solid var(--color-border-secondary)',
    background: 'var(--bg-surface)',
    borderRadius: 6,
    fontSize: 14,
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
  },
  todayBtn: {
    padding: '4px 12px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  weekLabel: { fontSize: 13, fontWeight: 500, marginLeft: 6 },
  spacer: { flex: 1 },
  weekTotal: { fontSize: 12, color: 'var(--color-text-secondary)' },
  scroll: { flex: 1, overflow: 'auto' },
  empty: {
    padding: 32,
    textAlign: 'center',
    fontSize: 13,
    color: 'var(--color-text-secondary)',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '8px 6px',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    background: 'var(--bg-surface)',
    position: 'sticky',
    top: 0,
    zIndex: 5,
  },
  thToday: { background: 'var(--accent-soft)', color: 'var(--accent)' },
  thDate: { fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 },
  td: {
    padding: '0 4px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    verticalAlign: 'middle',
  },
  tdToday: { background: 'var(--accent-soft)' },
  taskCol: { width: '38%', textAlign: 'left', paddingLeft: 14, paddingRight: 8 },
  dayCol: { width: '7%', minWidth: 78 },
  totalCol: { width: '8%', minWidth: 70, textAlign: 'center', fontFamily: 'monospace' },
  oosBadgeWhole: {
    display: 'inline-block',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: '#BA7517',
    background: '#BA751722',
    borderRadius: 5,
    padding: '1px 6px',
    marginLeft: 6,
    verticalAlign: 'middle',
  },
  oosRowTint: {
    background: '#BA75170A',
  },
  taskCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 8px 8px 14px',
  },
  timerBtn: {
    width: 26,
    height: 26,
    border: '1px solid',
    borderRadius: '50%',
    fontSize: 10,
    cursor: 'pointer',
    flexShrink: 0,
  },
  taskInfo: { flex: 1, minWidth: 0 },
  taskTitle: { fontSize: 12, color: 'var(--color-text-primary)' },
  taskProject: { fontSize: 10, marginTop: 1, fontWeight: 500 },
  cellBtn: {
    position: 'relative',
    width: '100%',
    minHeight: 32,
    padding: '4px 6px',
    border: 'none',
    background: 'transparent',
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'center',
    borderRadius: 4,
  },
  cellBtnFilled: {
    background: 'var(--accent-soft)',
    fontWeight: 500,
  },
  blockCount: {
    position: 'absolute',
    top: 2,
    right: 4,
    fontSize: 9,
    padding: '0 4px',
    borderRadius: 6,
    background: 'var(--accent)',
    color: '#fff',
    fontFamily: 'inherit',
  },
  totalCell: {
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
    textAlign: 'center',
    padding: '8px 4px',
  },
  totalRow: { background: 'var(--accent-soft)' },
};
