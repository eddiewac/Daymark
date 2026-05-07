import { useMemo, useState, useRef } from 'react';
import { localDateStr, todayStr } from '../../lib/utils.js';
import { projectColor } from '../../lib/constants.js';
import {
  historicalAverageWeeklyHours,
  sumEstimateHours,
  generateCapacityEmail,
} from '../../lib/capacity.js';

// ── Week helpers ─────────────────────────────────────────────────────────────
function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday-based
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_COLORS = ['var(--accent)', '#0F6E56', '#BA7517', '#185FA5', '#D4537E'];

export default function PlanPanel({
  tasks,
  projects,
  loading,
  onUpdateTask,
  onToggleDone,
  blocks,
  currentUserId,
  runningTimer,
  onStartTimer,
  onStopTimer,
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [showDone, setShowDone] = useState(false);
  const [dragOverDay, setDragOverDay] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('daymark-plan-view') || 'calendar';
    } catch {
      return 'calendar';
    }
  });
  const setView = (v) => {
    setViewMode(v);
    try { localStorage.setItem('daymark-plan-view', v); } catch {}
  };

  // 5 weekdays Mon-Fri
  const days = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const dayKeys = useMemo(() => days.map((d) => localDateStr(d)), [days]);
  const dayKeySet = useMemo(() => new Set(dayKeys), [dayKeys]);

  // Categorise tasks:
  //   - overdue: open tasks with due date before this Monday
  //   - byDay: open tasks with due date in Mon-Fri of visible week
  //   - backlog: open tasks with no due date
  //   - (done filter): if showDone, include done tasks in their day column
  const { overdue, byDay, backlog } = useMemo(() => {
    const buckets = { overdue: [], byDay: {}, backlog: [] };
    for (const k of dayKeys) buckets.byDay[k] = [];
    const todayKey = todayStr();

    for (const t of tasks || []) {
      if (t.done && !showDone) continue;
      const due = t.dueDate || '';

      if (!due) {
        if (!t.done) buckets.backlog.push(t);
        continue;
      }

      if (dayKeySet.has(due)) {
        buckets.byDay[due].push(t);
      } else if (!t.done && due < todayKey) {
        buckets.overdue.push(t);
      }
      // Future dates not in this week → not shown (drag from a future view)
    }

    // Sort each bucket
    const sortFn = (a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (a.title || '').localeCompare(b.title || '');
    };
    buckets.overdue.sort(sortFn);
    buckets.backlog.sort(sortFn);
    for (const k of dayKeys) buckets.byDay[k].sort(sortFn);

    return buckets;
  }, [tasks, dayKeys, dayKeySet, showDone]);

  // Counts for header
  const totalThisWeek = dayKeys.reduce(
    (sum, k) => sum + byDay[k].length,
    0
  );

  // Drag handlers
  const handleDrop = (taskId, targetDate) => {
    const task = (tasks || []).find((t) => t.id === taskId);
    if (!task) return;
    if (task.dueDate === targetDate) return;
    onUpdateTask(taskId, { dueDate: targetDate || null });
    setDragOverDay(null);
  };

  return (
    <div style={styles.wrap}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <button
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          style={styles.navBtn}
        >
          ‹
        </button>
        <button
          onClick={() => setWeekStart(startOfWeek(new Date()))}
          style={styles.todayBtn}
        >
          This week
        </button>
        <button
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          style={styles.navBtn}
        >
          ›
        </button>
        <div style={styles.weekLabel}>
          {weekStart.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
          })}
          {' – '}
          {addDays(weekStart, 4).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </div>
        <div style={{ flex: 1 }} />
        <span style={styles.totalLabel}>
          {totalThisWeek} task{totalThisWeek === 1 ? '' : 's'} planned
        </span>
        <label style={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
          />
          Show done
        </label>
        <div style={planStyles.viewSwitch}>
          {[
            { key: 'calendar', label: '⌗ Calendar' },
            { key: 'list', label: '☰ List' },
          ].map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              style={{
                ...planStyles.viewBtn,
                ...(viewMode === v.key ? planStyles.viewBtnActive : {}),
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={styles.empty}>Loading…</div>
      ) : viewMode === 'list' ? (
        <PlanListView
          weekStart={weekStart}
          dayKeys={dayKeys}
          byDay={byDay}
          overdue={overdue}
          projects={projects}
          blocks={blocks}
          currentUserId={currentUserId}
          runningTimer={runningTimer}
          onUpdateTask={onUpdateTask}
          onToggleDone={onToggleDone}
          onStartTimer={onStartTimer}
          onStopTimer={onStopTimer}
        />
      ) : (
        <div style={styles.boardWrap}>
          {/* Overdue banner */}
          {overdue.length > 0 && (
            <div style={styles.overdueBanner}>
              <div style={styles.overdueTitle}>
                ⚠ {overdue.length} overdue task{overdue.length === 1 ? '' : 's'}
              </div>
              <div style={styles.overdueList}>
                {overdue.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    projects={projects}
                    onToggleDone={onToggleDone}
                    overdue
                  />
                ))}
              </div>
              <div style={styles.overdueHint}>
                Drag onto a day to reschedule.
              </div>
            </div>
          )}

          {/* Main board: backlog + 5 days */}
          <div style={styles.board}>
            <DayColumn
              title="Backlog"
              subtitle="No due date"
              count={backlog.length}
              tasks={backlog}
              projects={projects}
              isToday={false}
              isDropTarget={dragOverDay === 'backlog'}
              onDragOver={() => setDragOverDay('backlog')}
              onDragLeave={() => setDragOverDay(null)}
              onDrop={(taskId) => handleDrop(taskId, '')}
              onToggleDone={onToggleDone}
              backlog
            />

            {days.map((d, i) => {
              const dk = dayKeys[i];
              return (
                <DayColumn
                  key={dk}
                  title={DAY_NAMES[i]}
                  subtitle={d.toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                  })}
                  count={byDay[dk].length}
                  tasks={byDay[dk]}
                  projects={projects}
                  isToday={dk === todayStr()}
                  isDropTarget={dragOverDay === dk}
                  onDragOver={() => setDragOverDay(dk)}
                  onDragLeave={() => setDragOverDay(null)}
                  onDrop={(taskId) => handleDrop(taskId, dk)}
                  onToggleDone={onToggleDone}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PlanListView ─────────────────────────────────────────────────────────────
// Day-by-day list of the selected week. Each task has:
//   - checkbox
//   - title
//   - estimate quick-pick (0.5/1/2/4)
//   - Track / Stop timer button
// Above the days: a capacity stats bar + Generate-email button.
function PlanListView({
  weekStart,
  dayKeys,
  byDay,
  overdue,
  projects,
  blocks,
  currentUserId,
  runningTimer,
  onUpdateTask,
  onToggleDone,
  onStartTimer,
  onStopTimer,
}) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [copyMsg, setCopyMsg] = useState('');
  const fallbackRef = useRef(null);

  // All tasks in the visible week (open only — done filtered out at the parent)
  const weekTasks = useMemo(
    () => dayKeys.flatMap((k) => byDay[k] || []),
    [dayKeys, byDay]
  );

  const histAvg = useMemo(
    () => historicalAverageWeeklyHours(blocks, currentUserId),
    [blocks, currentUserId]
  );
  const committedHrs = useMemo(
    () => Math.round(sumEstimateHours(weekTasks) * 10) / 10,
    [weekTasks]
  );
  const availableHrs = Math.max(0, Math.round((histAvg - committedHrs) * 10) / 10);

  const overCapacity = committedHrs > histAvg;
  const utilisationPct = histAvg > 0 ? Math.min(100, Math.round((committedHrs / histAvg) * 100)) : 0;

  const weekLabel = `${weekStart.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })} – ${addDays(weekStart, 4).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })}`;

  const handleGenerateEmail = () => {
    const { body, subject } = generateCapacityEmail({
      weekTasks,
      dayLabels: DAY_NAMES_FULL,
      dayKeys,
      weekLabel,
      histAvg,
    });
    setEmailDraft(body);
    setEmailSubject(subject);
    setEmailOpen(true);
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(emailDraft);
      setCopyMsg('Copied!');
      setTimeout(() => setCopyMsg(''), 3000);
    } catch {
      fallbackRef.current?.select();
      setCopyMsg('Auto-copy failed — select the text above and copy manually.');
      setTimeout(() => setCopyMsg(''), 5000);
    }
  };

  const openMailto = () => {
    const sub = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(emailDraft);
    window.open(`mailto:?subject=${sub}&body=${body}`);
  };

  return (
    <div style={listStyles.wrap}>
      {/* Capacity strip */}
      <div style={listStyles.capacityCard}>
        <div style={listStyles.capacityRow}>
          <Stat label="Avg capacity" value={`${histAvg}h`} color="#534AB7" hint="From last 4 weeks of time tracking" />
          <Stat label="Scheduled" value={`${committedHrs}h`} color="#BA7517" hint="Sum of estimates for this week" />
          <Stat
            label="Headroom"
            value={overCapacity ? '0h' : `${availableHrs}h`}
            color={overCapacity ? '#e24b4a' : '#1d9e75'}
            hint={overCapacity ? 'Already over capacity' : 'Available for ad-hoc work'}
          />
          <div style={{ flex: 1 }} />
          <button onClick={handleGenerateEmail} style={listStyles.emailBtn}>
            ✉️ Generate capacity email
          </button>
        </div>
        {/* Utilisation bar */}
        <div style={listStyles.barWrap}>
          <div
            style={{
              ...listStyles.barFill,
              width: `${utilisationPct}%`,
              background: overCapacity ? '#e24b4a' : utilisationPct > 80 ? '#BA7517' : '#1d9e75',
            }}
          />
        </div>
        <div style={listStyles.barLabel}>
          {overCapacity
            ? `Over capacity by ${Math.round((committedHrs - histAvg) * 10) / 10}h`
            : `${utilisationPct}% utilised`}
        </div>
      </div>

      {/* Email draft panel */}
      {emailOpen && (
        <div style={listStyles.emailCard}>
          <div style={listStyles.emailHeader}>
            <span style={listStyles.emailHeaderTitle}>Capacity email — week of {weekLabel}</span>
            <button onClick={() => setEmailOpen(false)} style={listStyles.emailClose}>×</button>
          </div>
          <textarea
            ref={fallbackRef}
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            rows={14}
            style={listStyles.emailTextarea}
          />
          <div style={listStyles.emailBtnRow}>
            <button onClick={copyEmail} style={listStyles.emailPrimaryBtn}>
              📋 Copy to clipboard
            </button>
            <button onClick={openMailto} style={listStyles.emailSecondaryBtn}>
              ✉️ Open in mail
            </button>
            {copyMsg && <span style={listStyles.copyMsg}>{copyMsg}</span>}
          </div>
        </div>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <div style={listStyles.overdueWrap}>
          <div style={listStyles.overdueTitle}>
            ⚠ {overdue.length} overdue task{overdue.length === 1 ? '' : 's'}
          </div>
          {overdue.map((t) => (
            <PlanListRow
              key={t.id}
              task={t}
              projects={projects}
              currentUserId={currentUserId}
              runningTimer={runningTimer}
              onUpdateTask={onUpdateTask}
              onToggleDone={onToggleDone}
              onStartTimer={onStartTimer}
              onStopTimer={onStopTimer}
              overdue
            />
          ))}
        </div>
      )}

      {/* Day-by-day */}
      {dayKeys.map((dk, i) => {
        const dayTasks = byDay[dk] || [];
        const dayHrs = Math.round(sumEstimateHours(dayTasks) * 10) / 10;
        return (
          <div key={dk} style={listStyles.dayBlock}>
            <div style={{ ...listStyles.dayHeader, borderLeft: `3px solid ${DAY_COLORS[i]}` }}>
              <span style={listStyles.dayName}>{DAY_NAMES_FULL[i]}</span>
              <span style={listStyles.dayDate}>
                {new Date(dk + 'T12:00:00').toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
              <div style={{ flex: 1 }} />
              <span style={listStyles.dayHours}>
                {dayTasks.length} task{dayTasks.length === 1 ? '' : 's'}
                {dayHrs > 0 ? ` · ${dayHrs}h` : ''}
              </span>
            </div>
            {dayTasks.length === 0 ? (
              <div style={listStyles.emptyDay}>No tasks scheduled</div>
            ) : (
              dayTasks.map((t) => (
                <PlanListRow
                  key={t.id}
                  task={t}
                  projects={projects}
                  currentUserId={currentUserId}
                  runningTimer={runningTimer}
                  onUpdateTask={onUpdateTask}
                  onToggleDone={onToggleDone}
                  onStartTimer={onStartTimer}
                  onStopTimer={onStopTimer}
                />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, color, hint }) {
  return (
    <div style={listStyles.stat} title={hint}>
      <div style={{ ...listStyles.statValue, color }}>{value}</div>
      <div style={listStyles.statLabel}>{label}</div>
    </div>
  );
}

// ── PlanListRow ──────────────────────────────────────────────────────────────
// Single task row with checkbox, title, project chip, estimate quick-pick,
// timer button.
function PlanListRow({
  task,
  projects,
  currentUserId,
  runningTimer,
  onUpdateTask,
  onToggleDone,
  onStartTimer,
  onStopTimer,
  overdue,
}) {
  const projColor = projectColor(task.project, projects);
  const isTracking = runningTimer?.taskId === task.id;
  const ESTIMATES = [0.5, 1, 2, 4];

  return (
    <div
      style={{
        ...listStyles.row,
        opacity: task.done ? 0.55 : 1,
        background: overdue ? '#e24b4a08' : '#fff',
        borderLeft: `3px solid ${projColor}`,
      }}
    >
      <input
        type="checkbox"
        checked={!!task.done}
        onChange={() => onToggleDone(task.id)}
        style={listStyles.check}
      />
      <div style={listStyles.rowMain}>
        <div
          style={{
            ...listStyles.title,
            textDecoration: task.done ? 'line-through' : 'none',
          }}
        >
          {task.title}
        </div>
        {task.project && (
          <span style={{ ...listStyles.projChip, background: projColor + '22', color: projColor }}>
            {task.project}
          </span>
        )}
      </div>

      {/* Estimate quick-pick */}
      <div style={listStyles.estPick}>
        {ESTIMATES.map((h) => (
          <button
            key={h}
            onClick={() =>
              onUpdateTask(task.id, {
                estimate: task.estimate === h ? null : h,
              })
            }
            style={{
              ...listStyles.estBtn,
              ...(task.estimate === h ? listStyles.estBtnActive : {}),
            }}
            title={`Set estimate to ${h}h`}
          >
            {h}h
          </button>
        ))}
      </div>

      {/* Timer */}
      {!task.done && (
        isTracking ? (
          <button onClick={onStopTimer} style={listStyles.stopBtn}>
            ■ Stop
          </button>
        ) : (
          <button
            onClick={() => onStartTimer(task)}
            style={listStyles.trackBtn}
            disabled={!!runningTimer}
            title={runningTimer ? 'Stop the running timer first' : 'Start tracking'}
          >
            ▶ Track
          </button>
        )
      )}
    </div>
  );
}

const planStyles = {
  viewSwitch: {
    display: 'flex',
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 8,
    padding: 2,
    gap: 1,
    marginLeft: 6,
  },
  viewBtn: {
    padding: '4px 10px',
    fontSize: 11,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 400,
  },
  viewBtnActive: {
    background: 'var(--bg-surface)',
    color: 'var(--color-text-primary)',
    fontWeight: 500,
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  },
};

const listStyles = {
  wrap: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 14px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  capacityCard: {
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 10,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  capacityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  stat: {
    textAlign: 'center',
    cursor: 'help',
  },
  statValue: { fontSize: 18, fontWeight: 600 },
  statLabel: { fontSize: 10, color: 'var(--color-text-secondary)' },
  emailBtn: {
    padding: '6px 14px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    flexShrink: 0,
  },
  barWrap: {
    height: 6,
    background: 'var(--color-background-tertiary)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    transition: 'width 0.2s, background 0.2s',
  },
  barLabel: {
    fontSize: 10,
    color: 'var(--color-text-secondary)',
    textAlign: 'right',
  },
  emailCard: {
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 10,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  emailHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emailHeaderTitle: { fontSize: 12, fontWeight: 600 },
  emailClose: {
    width: 24,
    height: 24,
    background: 'transparent',
    border: 'none',
    fontSize: 18,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  emailTextarea: {
    width: '100%',
    padding: 10,
    fontSize: 12,
    fontFamily: 'monospace',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 6,
    resize: 'vertical',
    background: 'var(--color-background-secondary)',
    outline: 'none',
    lineHeight: 1.5,
  },
  emailBtnRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  emailPrimaryBtn: {
    padding: '6px 14px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
  },
  emailSecondaryBtn: {
    padding: '6px 14px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-primary)',
    borderRadius: 6,
    fontSize: 11,
    cursor: 'pointer',
  },
  copyMsg: { fontSize: 11, color: '#1d9e75', fontWeight: 500 },
  overdueWrap: {
    background: '#e24b4a11',
    border: '0.5px solid #e24b4a44',
    borderRadius: 10,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  overdueTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#e24b4a',
    marginBottom: 4,
  },
  dayBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  dayHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    background: 'var(--color-background-secondary)',
    borderRadius: 6,
    marginBottom: 2,
  },
  dayName: { fontSize: 12, fontWeight: 600 },
  dayDate: { fontSize: 11, color: 'var(--color-text-secondary)' },
  dayHours: {
    fontSize: 10,
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
  },
  emptyDay: {
    padding: '6px 14px',
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 6,
  },
  check: { cursor: 'pointer', flexShrink: 0 },
  rowMain: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 12,
    color: 'var(--color-text-primary)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  projChip: {
    fontSize: 10,
    padding: '1px 7px',
    borderRadius: 12,
    fontWeight: 500,
    flexShrink: 0,
  },
  estPick: {
    display: 'flex',
    gap: 2,
    flexShrink: 0,
  },
  estBtn: {
    padding: '2px 6px',
    fontSize: 10,
    background: 'transparent',
    border: '0.5px solid var(--color-border-tertiary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 4,
    cursor: 'pointer',
    minWidth: 28,
  },
  estBtnActive: {
    background: 'var(--accent)',
    color: '#fff',
    borderColor: 'var(--accent)',
    fontWeight: 500,
  },
  trackBtn: {
    padding: '3px 10px',
    fontSize: 10,
    background: 'transparent',
    border: '0.5px solid #534AB7',
    color: 'var(--accent)',
    borderRadius: 4,
    cursor: 'pointer',
    flexShrink: 0,
    fontWeight: 500,
  },
  stopBtn: {
    padding: '3px 10px',
    fontSize: 10,
    background: '#e24b4a',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    flexShrink: 0,
    fontWeight: 500,
  },
};

// ── DayColumn ────────────────────────────────────────────────────────────────
function DayColumn({
  title,
  subtitle,
  count,
  tasks,
  projects,
  isToday,
  isDropTarget,
  onDragOver,
  onDragLeave,
  onDrop,
  onToggleDone,
  backlog,
}) {
  return (
    <div
      style={{
        ...colStyles.col,
        ...(isToday ? colStyles.colToday : {}),
        ...(isDropTarget ? colStyles.colDropping : {}),
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/plain');
        if (taskId) onDrop(taskId);
      }}
    >
      <div style={colStyles.header}>
        <div
          style={{
            ...colStyles.title,
            color: isToday ? 'var(--accent)' : 'var(--color-text-primary)',
          }}
        >
          {title}
        </div>
        <div style={colStyles.subtitle}>{subtitle}</div>
        {count > 0 && (
          <div style={colStyles.count}>{count}</div>
        )}
      </div>

      <div style={colStyles.list}>
        {tasks.length === 0 ? (
          <div style={colStyles.emptyDrop}>
            {backlog ? 'Drop here to clear due date' : 'Drop a task here'}
          </div>
        ) : (
          tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              projects={projects}
              onToggleDone={onToggleDone}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── TaskCard ─────────────────────────────────────────────────────────────────
function TaskCard({ task, projects, onToggleDone, overdue }) {
  const projColor = projectColor(task.project, projects);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      style={{
        ...cardStyles.card,
        borderLeft: `3px solid ${projColor}`,
        opacity: task.done ? 0.55 : 1,
        background: overdue ? '#e24b4a08' : '#fff',
        borderColor: overdue ? '#e24b4a44' : 'var(--color-border-tertiary)',
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleDone(task.id);
        }}
        style={{
          ...cardStyles.checkbox,
          background: task.done ? 'var(--accent)' : 'transparent',
          borderColor: task.done ? 'var(--accent)' : 'var(--color-border-primary)',
        }}
      >
        {task.done && (
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
      <div style={cardStyles.body}>
        <div
          style={{
            ...cardStyles.title,
            textDecoration: task.done ? 'line-through' : 'none',
          }}
        >
          {task.title || '(untitled)'}
        </div>
        {task.project && (
          <div
            style={{
              ...cardStyles.project,
              color: projColor,
            }}
          >
            {task.project}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    flex: 1,
    background: 'var(--bg-surface)',
    display: 'flex',
    flexDirection: 'column',
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
  totalLabel: { fontSize: 11, color: 'var(--color-text-secondary)' },
  toggleLabel: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
  },
  empty: {
    padding: 32,
    textAlign: 'center',
    fontSize: 13,
    color: 'var(--color-text-secondary)',
  },
  boardWrap: {
    flex: 1,
    overflow: 'auto',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  overdueBanner: {
    background: '#e24b4a11',
    border: '0.5px solid #e24b4a44',
    borderRadius: 10,
    padding: 10,
  },
  overdueTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#e24b4a',
    marginBottom: 8,
  },
  overdueList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  overdueHint: {
    fontSize: 10,
    color: 'var(--color-text-secondary)',
    marginTop: 6,
    fontStyle: 'italic',
  },
  board: {
    display: 'grid',
    gridTemplateColumns: '220px repeat(5, minmax(180px, 1fr))',
    gap: 8,
    flex: 1,
    minHeight: 400,
  },
};

const colStyles = {
  col: {
    background: 'var(--color-background-secondary)',
    borderRadius: 10,
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    border: '0.5px solid transparent',
    transition: 'border-color 80ms ease',
  },
  colToday: {
    background: 'var(--accent-soft)',
  },
  colDropping: {
    border: '0.5px dashed #534AB7',
    background: 'var(--accent-soft)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 6px',
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
  },
  subtitle: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    flex: 1,
  },
  count: {
    fontSize: 10,
    fontWeight: 600,
    padding: '0 6px',
    background: 'var(--color-background-tertiary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 8,
    minWidth: 16,
    textAlign: 'center',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minHeight: 60,
  },
  emptyDrop: {
    padding: '12px 6px',
    textAlign: 'center',
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
  },
};

const cardStyles = {
  card: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    padding: '6px 8px',
    border: '0.5px solid',
    borderRadius: 6,
    cursor: 'grab',
  },
  checkbox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    border: '1.5px solid',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  body: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 11,
    color: 'var(--color-text-primary)',
    lineHeight: 1.4,
  },
  project: {
    fontSize: 9,
    fontWeight: 500,
    marginTop: 2,
  },
};
