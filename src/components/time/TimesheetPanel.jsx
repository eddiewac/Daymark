import { useMemo, useState, useCallback } from 'react';
import { canTrackTime, fmtHours } from '../../hooks/useTime.js';
import { localDateStr, todayStr } from '../../lib/utils.js';
import { projectColor } from '../../lib/constants.js';

// ── Week helpers ─────────────────────────────────────────────────────────────
function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
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
  entries,
  loadingEntries,
  runningTimer,
  currentUserId,
  workspaceId,
  onSetEntry,
  onStartTimer,
  onStopTimer,
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const dayKeys = useMemo(() => days.map((d) => localDateStr(d)), [days]);

  // Tasks shown in the timesheet:
  // - Tasks with hours logged this week, plus
  // - Tasks the user can track (so they can start adding hours).
  // Done tasks with no hours this week are filtered out by default.
  const [showDone, setShowDone] = useState(false);

  const visibleTasks = useMemo(() => {
    const dayKeySet = new Set(dayKeys);
    const taskHasHoursThisWeek = (taskId) =>
      entries.some((e) => e.taskId === taskId && dayKeySet.has(e.date));

    return (tasks || [])
      .filter((t) => {
        if (taskHasHoursThisWeek(t.id)) return true;
        if (!canTrackTime(t, currentUserId, workspaceId)) return false;
        if (t.done && !showDone) return false;
        return true;
      })
      .sort((a, b) => {
        // Active first, then alpha
        if (!!a.done !== !!b.done) return a.done ? 1 : -1;
        if (a.project && !b.project) return -1;
        if (!a.project && b.project) return 1;
        if (a.project !== b.project) return (a.project || '').localeCompare(b.project || '');
        return (a.title || '').localeCompare(b.title || '');
      });
  }, [tasks, entries, dayKeys, currentUserId, workspaceId, showDone]);

  // Lookup map for fast cell rendering
  const entryMap = useMemo(() => {
    const m = {};
    for (const e of entries) {
      m[`${e.taskId}|${e.date}`] = e.hours;
    }
    return m;
  }, [entries]);

  const dayTotals = useMemo(() => {
    return dayKeys.map((dk) =>
      visibleTasks.reduce((sum, t) => sum + (entryMap[`${t.id}|${dk}`] || 0), 0)
    );
  }, [visibleTasks, dayKeys, entryMap]);

  const weekTotal = dayTotals.reduce((a, b) => a + b, 0);

  const goPrev = () => setWeekStart(addDays(weekStart, -7));
  const goNext = () => setWeekStart(addDays(weekStart, 7));
  const goToday = () => setWeekStart(startOfWeek(new Date()));

  return (
    <div style={styles.wrap}>
      {/* Toolbar */}
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
        <label style={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
          />
          Show completed
        </label>
        <div style={styles.weekTotal}>
          Total: <strong>{weekTotal.toFixed(2)}h</strong>
        </div>
      </div>

      {/* Grid */}
      <div style={styles.scroll}>
        {loadingEntries ? (
          <div style={styles.empty}>Loading…</div>
        ) : visibleTasks.length === 0 ? (
          <div style={styles.empty}>
            No tasks to track this week. Add or assign yourself tasks first.
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
                const taskTotal = dayKeys.reduce(
                  (sum, dk) => sum + (entryMap[`${t.id}|${dk}`] || 0),
                  0
                );
                const canTrack = canTrackTime(t, currentUserId, workspaceId);
                const isRunning = runningTimer?.taskId === t.id;
                const projColor = projectColor(t.project, projects);
                return (
                  <tr key={t.id} style={styles.row}>
                    <td style={{ ...styles.td, ...styles.taskCol, ...styles.taskCell }}>
                      {canTrack && (
                        <button
                          onClick={() =>
                            isRunning ? onStopTimer() : onStartTimer(t)
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
                    {dayKeys.map((dk, i) => {
                      const isToday = dk === todayStr();
                      const v = entryMap[`${t.id}|${dk}`] || 0;
                      return (
                        <td
                          key={dk}
                          style={{
                            ...styles.td,
                            ...styles.dayCol,
                            ...(isToday ? styles.tdToday : {}),
                          }}
                        >
                          <HourCell
                            value={v}
                            disabled={!canTrack}
                            onCommit={(newVal) => onSetEntry(t.id, dk, newVal)}
                          />
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
                    background: '#534AB708',
                  }}
                >
                  {weekTotal > 0 ? weekTotal.toFixed(2) : ''}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── HourCell — editable hours input ─────────────────────────────────────────
function HourCell({ value, disabled, onCommit }) {
  const [draft, setDraft] = useState(fmtHours(value));
  const [editing, setEditing] = useState(false);

  // Reset draft when external value changes (eg timer added time)
  useMemo(() => {
    if (!editing) setDraft(fmtHours(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const num = parseFloat(draft);
    const safe = isNaN(num) || num < 0 ? 0 : num;
    if (safe.toFixed(2) === (value || 0).toFixed(2)) {
      setDraft(fmtHours(safe));
      return;
    }
    onCommit(safe);
    setDraft(fmtHours(safe));
  };

  if (disabled) {
    return (
      <div style={cellStyles.readonly}>
        {value > 0 ? value.toFixed(2) : ''}
      </div>
    );
  }

  return (
    <input
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        setEditing(true);
      }}
      onFocus={() => setEditing(true)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.target.blur();
        }
      }}
      placeholder=""
      style={{
        ...cellStyles.input,
        ...(value > 0 ? cellStyles.inputFilled : {}),
      }}
    />
  );
}

const cellStyles = {
  input: {
    width: '100%',
    padding: '4px 6px',
    border: 'none',
    background: 'transparent',
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'center',
    outline: 'none',
    borderRadius: 4,
  },
  inputFilled: {
    background: '#534AB708',
    color: '#534AB7',
    fontWeight: 500,
  },
  readonly: {
    padding: '4px 6px',
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'center',
    color: 'var(--color-text-tertiary)',
  },
};

const styles = {
  wrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
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
    background: '#fff',
    borderRadius: 6,
    fontSize: 14,
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
  },
  todayBtn: {
    padding: '4px 12px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  weekLabel: { fontSize: 13, fontWeight: 500, marginLeft: 6 },
  spacer: { flex: 1 },
  toggleLabel: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
  },
  weekTotal: { fontSize: 12, color: 'var(--color-text-secondary)' },
  scroll: { flex: 1, overflow: 'auto' },
  empty: {
    padding: 32,
    textAlign: 'center',
    fontSize: 13,
    color: 'var(--color-text-secondary)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '8px 6px',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    background: '#fff',
    position: 'sticky',
    top: 0,
    zIndex: 5,
  },
  thToday: { background: '#534AB711', color: '#534AB7' },
  thDate: { fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 },
  td: {
    padding: '0 4px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    verticalAlign: 'middle',
  },
  tdToday: { background: '#534AB704' },
  taskCol: { width: '38%', textAlign: 'left', paddingLeft: 14, paddingRight: 8 },
  dayCol: { width: '7%', minWidth: 70 },
  totalCol: { width: '8%', minWidth: 70, textAlign: 'center', fontFamily: 'monospace' },
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
  totalCell: {
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
  },
  row: {},
  totalRow: { background: '#534AB704' },
};
