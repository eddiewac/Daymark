import { useMemo } from 'react';
import { projectColor } from '../../lib/constants.js';
import { todayStr } from '../../lib/utils.js';
import {
  stationLastActivityAt,
  relativeTime,
  overdueComms,
} from '../../lib/stations.js';

// ── TodayView ───────────────────────────────────────────────────────────────
// A single dashboard surfacing everything that needs the user's attention.
//
// Sections (only shown if non-empty):
//   1. Today's priority (link to the modal in Tasks)
//   2. Overdue tasks
//   3. Tasks due today
//   4. Comms with overdue replies (across all projects)
//   5. Stale stations (>7 days no activity, incomplete)
//   6. Upcoming congresses (next 14 days)
//
// Each section has a "Jump to" link that navigates the user to where they
// can act on it.

const DAY_MS = 86400000;

export default function TodayView({
  tasks,
  projects,
  congresses,
  todayPriority,
  onOpenPriorityModal,
  onJumpToTab,
  onJumpToProject,
  onToggleDone,
}) {
  const today = todayStr();

  // ── Compute the data ────────────────────────────────────────────────────
  const overdueTasks = useMemo(
    () =>
      (tasks || [])
        .filter((t) => !t.done && t.dueDate && t.dueDate < today)
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')),
    [tasks, today]
  );

  const dueTodayTasks = useMemo(
    () => (tasks || []).filter((t) => !t.done && t.dueDate === today),
    [tasks, today]
  );

  // Walk all projects' deliverables → stations to find overdue comms + stale stations
  const { overdueCommsList, staleStationsList } = useMemo(() => {
    const overdue = [];
    const stale = [];
    for (const p of projects || []) {
      for (const d of p.deliverables || []) {
        for (const s of d.stations || []) {
          // Overdue comms
          for (const c of overdueComms(s)) {
            overdue.push({
              project: p,
              deliverable: d,
              station: s,
              comm: c,
            });
          }
          // Stale stations (incomplete + last activity > 7 days)
          if (!s.done) {
            const lastAct = stationLastActivityAt(s);
            if (lastAct) {
              const daysSince = (Date.now() - lastAct) / DAY_MS;
              if (daysSince > 7) {
                stale.push({
                  project: p,
                  deliverable: d,
                  station: s,
                  daysSince: Math.floor(daysSince),
                  rel: relativeTime(lastAct),
                });
              }
            }
          }
        }
      }
    }
    return { overdueCommsList: overdue, staleStationsList: stale };
  }, [projects]);

  const upcomingCongresses = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() + 14 * DAY_MS);
    return (congresses || [])
      .filter((c) => {
        if (!c.startDate) return false;
        const start = new Date(c.startDate);
        return start >= now && start <= cutoff;
      })
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  }, [congresses]);

  // Total count for the "all clear" check
  const totalItems =
    overdueTasks.length +
    dueTodayTasks.length +
    overdueCommsList.length +
    staleStationsList.length +
    upcomingCongresses.length;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={styles.scroll}>
      <div style={styles.wrap}>
        <div style={styles.greeting}>
          <div style={styles.greetingTitle}>Today</div>
          <div style={styles.greetingDate}>
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </div>
        </div>

        {/* Priority */}
        <Section
          title="🎯 Today's priority"
          empty={
            !todayPriority?.primary && (
              <div style={styles.emptyRow}>
                <span>No priority set for today.</span>
                <button onClick={onOpenPriorityModal} style={styles.smallAction}>
                  Set priority
                </button>
              </div>
            )
          }
        >
          {todayPriority?.primary && (() => {
            const primary = (tasks || []).find(
              (t) => t.id === todayPriority.primary
            );
            const stretchTasks = (todayPriority.stretch || [])
              .map((id) => (tasks || []).find((t) => t.id === id))
              .filter(Boolean);
            if (!primary) return null;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <PriorityRow
                  task={primary}
                  projects={projects}
                  onToggleDone={onToggleDone}
                  isPrimary
                />
                {stretchTasks.map((t) => (
                  <PriorityRow
                    key={t.id}
                    task={t}
                    projects={projects}
                    onToggleDone={onToggleDone}
                  />
                ))}
              </div>
            );
          })()}
        </Section>

        {/* Overdue tasks */}
        {overdueTasks.length > 0 && (
          <Section
            title={`⚠ ${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'}`}
            tone="red"
            jumpLabel="Open Tasks"
            onJump={() => onJumpToTab('tasks')}
          >
            {overdueTasks.slice(0, 8).map((t) => (
              <TaskRowMini
                key={t.id}
                task={t}
                projects={projects}
                onToggleDone={onToggleDone}
                showDate
              />
            ))}
            {overdueTasks.length > 8 && (
              <div style={styles.moreLine}>
                + {overdueTasks.length - 8} more
              </div>
            )}
          </Section>
        )}

        {/* Due today */}
        {dueTodayTasks.length > 0 && (
          <Section
            title={`📅 ${dueTodayTasks.length} task${dueTodayTasks.length === 1 ? '' : 's'} due today`}
            tone="purple"
            jumpLabel="Open Plan"
            onJump={() => onJumpToTab('plan')}
          >
            {dueTodayTasks.map((t) => (
              <TaskRowMini
                key={t.id}
                task={t}
                projects={projects}
                onToggleDone={onToggleDone}
              />
            ))}
          </Section>
        )}

        {/* Overdue comms */}
        {overdueCommsList.length > 0 && (
          <Section
            title={`✉ ${overdueCommsList.length} overdue repl${overdueCommsList.length === 1 ? 'y' : 'ies'}`}
            tone="red"
          >
            {overdueCommsList.slice(0, 8).map((item, i) => (
              <CommRow
                key={`${item.station.id}-${item.comm.id}-${i}`}
                item={item}
                onJump={() => onJumpToProject(item.project.id)}
              />
            ))}
            {overdueCommsList.length > 8 && (
              <div style={styles.moreLine}>
                + {overdueCommsList.length - 8} more
              </div>
            )}
          </Section>
        )}

        {/* Stale stations */}
        {staleStationsList.length > 0 && (
          <Section
            title={`🕸 ${staleStationsList.length} stale station${staleStationsList.length === 1 ? '' : 's'}`}
            tone="amber"
            hint="No activity in over a week"
          >
            {staleStationsList.slice(0, 8).map((item, i) => (
              <StationRow
                key={`${item.station.id}-${i}`}
                item={item}
                projects={projects}
                onJump={() => onJumpToProject(item.project.id)}
              />
            ))}
            {staleStationsList.length > 8 && (
              <div style={styles.moreLine}>
                + {staleStationsList.length - 8} more
              </div>
            )}
          </Section>
        )}

        {/* Upcoming congresses */}
        {upcomingCongresses.length > 0 && (
          <Section
            title={`🏛 ${upcomingCongresses.length} congress${upcomingCongresses.length === 1 ? '' : 'es'} in the next 14 days`}
            tone="purple"
            jumpLabel="Open Congresses"
            onJump={() => onJumpToTab('congresses')}
          >
            {upcomingCongresses.map((c) => {
              const days = Math.ceil(
                (new Date(c.startDate) - Date.now()) / DAY_MS
              );
              return (
                <div key={c.id} style={styles.miniRow}>
                  <span style={styles.miniTitle}>{c.name}</span>
                  <span style={styles.miniMeta}>
                    {c.location ? `${c.location} · ` : ''}
                    {days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}
                  </span>
                </div>
              );
            })}
          </Section>
        )}

        {/* All clear */}
        {totalItems === 0 && !todayPriority?.primary && (
          <div style={styles.allClear}>
            <div style={styles.allClearTitle}>👌 All clear</div>
            <div style={styles.allClearText}>
              Nothing overdue, nothing stale, no upcoming congresses, no priority set yet.
            </div>
            <button onClick={onOpenPriorityModal} style={styles.allClearBtn}>
              Set today's priority
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────
function Section({ title, children, empty, tone, hint, jumpLabel, onJump }) {
  // Hide the section if empty content provided AND children is null/empty
  const hasContent = Array.isArray(children) ? children.length > 0 : !!children;
  if (!hasContent && !empty) return null;

  const toneColor =
    tone === 'red'
      ? '#e24b4a'
      : tone === 'amber'
      ? '#ef9f27'
      : tone === 'purple'
      ? '#534AB7'
      : 'var(--color-text-primary)';

  return (
    <div style={sectionStyles.wrap}>
      <div style={sectionStyles.header}>
        <span style={{ ...sectionStyles.title, color: toneColor }}>{title}</span>
        {hint && <span style={sectionStyles.hint}>{hint}</span>}
        <div style={{ flex: 1 }} />
        {jumpLabel && onJump && (
          <button onClick={onJump} style={sectionStyles.jumpBtn}>
            {jumpLabel} →
          </button>
        )}
      </div>
      {hasContent ? children : empty}
    </div>
  );
}

// ── Mini row components ─────────────────────────────────────────────────────
function PriorityRow({ task, projects, onToggleDone, isPrimary }) {
  const projColor = projectColor(task.project, projects);
  return (
    <div style={{ ...styles.miniRow, borderLeft: `3px solid ${projColor}` }}>
      <input
        type="checkbox"
        checked={!!task.done}
        onChange={() => onToggleDone(task.id)}
        style={{ flexShrink: 0, cursor: 'pointer' }}
      />
      <span
        style={{
          ...styles.miniTitle,
          fontWeight: isPrimary ? 600 : 500,
          textDecoration: task.done ? 'line-through' : 'none',
          opacity: task.done ? 0.55 : 1,
        }}
      >
        {task.title || '(untitled)'}
      </span>
      {task.project && (
        <span style={{ ...styles.miniChip, color: projColor }}>
          {task.project}
        </span>
      )}
    </div>
  );
}

function TaskRowMini({ task, projects, onToggleDone, showDate }) {
  const projColor = projectColor(task.project, projects);
  return (
    <div style={{ ...styles.miniRow, borderLeft: `3px solid ${projColor}` }}>
      <input
        type="checkbox"
        checked={!!task.done}
        onChange={() => onToggleDone(task.id)}
        style={{ flexShrink: 0, cursor: 'pointer' }}
      />
      <span
        style={{
          ...styles.miniTitle,
          opacity: task.done ? 0.55 : 1,
          textDecoration: task.done ? 'line-through' : 'none',
        }}
      >
        {task.title || '(untitled)'}
      </span>
      {showDate && task.dueDate && (
        <span style={{ ...styles.miniMeta, color: '#e24b4a', fontWeight: 600 }}>
          {task.dueDate}
        </span>
      )}
      {task.project && (
        <span style={{ ...styles.miniChip, color: projColor }}>
          {task.project}
        </span>
      )}
    </div>
  );
}

function CommRow({ item, onJump }) {
  return (
    <div style={styles.miniRow}>
      <span style={styles.miniTitle}>
        <strong>{item.project.name}</strong>
        <span style={styles.miniSep}> · </span>
        {item.station.name}
      </span>
      <span style={{ ...styles.miniMeta, color: '#e24b4a' }}>
        {item.comm.type} (expected {item.comm.expectReplyBy})
      </span>
      <button onClick={onJump} style={styles.jumpInline}>
        Open →
      </button>
    </div>
  );
}

function StationRow({ item, onJump }) {
  return (
    <div style={styles.miniRow}>
      <span style={styles.miniTitle}>
        <strong>{item.project.name}</strong>
        <span style={styles.miniSep}> · </span>
        {item.station.name}
      </span>
      <span style={{ ...styles.miniMeta, color: '#ef9f27' }}>
        {item.rel}
      </span>
      <button onClick={onJump} style={styles.jumpInline}>
        Open →
      </button>
    </div>
  );
}

const styles = {
  scroll: {
    flex: 1,
    overflowY: 'auto',
  },
  wrap: {
    maxWidth: 760,
    margin: '0 auto',
    padding: '20px 18px 60px',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  greeting: {
    paddingBottom: 6,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
  },
  greetingDate: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    marginTop: 2,
  },
  miniRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    background: '#fff',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 6,
    fontSize: 12,
  },
  miniTitle: {
    flex: 1,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  miniSep: { color: 'var(--color-text-tertiary)' },
  miniMeta: {
    fontSize: 10,
    color: 'var(--color-text-secondary)',
    flexShrink: 0,
  },
  miniChip: {
    fontSize: 10,
    fontWeight: 500,
    flexShrink: 0,
  },
  jumpInline: {
    padding: '2px 8px',
    fontSize: 10,
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 4,
    cursor: 'pointer',
    flexShrink: 0,
  },
  emptyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    fontStyle: 'italic',
    padding: '8px 4px',
  },
  smallAction: {
    padding: '3px 10px',
    fontSize: 11,
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  moreLine: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    paddingLeft: 10,
    paddingTop: 3,
  },
  allClear: {
    background: '#1d9e7511',
    border: '0.5px solid #1d9e7544',
    borderRadius: 12,
    padding: 24,
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    alignItems: 'center',
  },
  allClearTitle: { fontSize: 16, fontWeight: 600, color: '#1d9e75' },
  allClearText: { fontSize: 12, color: 'var(--color-text-secondary)' },
  allClearBtn: {
    padding: '6px 16px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
};

const sectionStyles = {
  wrap: {
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 10,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
  },
  hint: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
  },
  jumpBtn: {
    padding: '3px 10px',
    fontSize: 10,
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    cursor: 'pointer',
  },
};
