import { useMemo, useState } from 'react';
import { localDateStr, todayStr } from '../../lib/utils.js';
import { projectColor } from '../../lib/constants.js';

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

export default function PlanPanel({
  tasks,
  projects,
  loading,
  onUpdateTask,
  onToggleDone,
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [showDone, setShowDone] = useState(false);
  const [dragOverDay, setDragOverDay] = useState(null);

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
      </div>

      {loading ? (
        <div style={styles.empty}>Loading…</div>
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
            color: isToday ? '#534AB7' : 'var(--color-text-primary)',
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
          background: task.done ? '#534AB7' : 'transparent',
          borderColor: task.done ? '#534AB7' : 'var(--color-border-primary)',
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
    background: '#fff',
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
    background: '#534AB708',
  },
  colDropping: {
    border: '0.5px dashed #534AB7',
    background: '#534AB711',
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
