import { useMemo, useState } from 'react';
import { projectColor } from '../../lib/constants.js';
import { todayStr } from '../../lib/utils.js';
import {
  stationLastActivityAt,
  relativeTime,
  overdueComms,
  projectHealth,
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
  runningTimer,
  onStartTimer,
  onStopTimer,
  onSeedDemo,
  seedingDemo,
}) {
  const today = todayStr();

  // Project status digest is collapsed by default so it never dominates the
  // Today tab — the header still shows the count, one click expands the list.
  const [projectStatusOpen, setProjectStatusOpen] = useState(false);

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
const { overdueCommsList, dueTodayCommsList, staleStationsList } = useMemo(() => {
    const overdue = [];
    const dueToday = [];
    const stale = [];
    for (const p of projects || []) {
      for (const d of p.deliverables || []) {
        for (const s of d.stations || []) {
          // Walk comms once to bucket them
          for (const c of s.comms || []) {
            if (c.replyReceived || !c.needsReply) continue;
            if (!c.expectReplyBy) continue;
            const entry = { project: p, deliverable: d, station: s, comm: c };
            if (c.expectReplyBy < today) {
              overdue.push(entry);
            } else if (c.expectReplyBy === today) {
              dueToday.push(entry);
            }
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
    return { overdueCommsList: overdue, dueTodayCommsList: dueToday, staleStationsList: stale };
  }, [projects, today]);

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

  // Project status digest — runs projectHealth() on every active project and
  // keeps only those needing attention (amber/red). Green/on-track projects
  // are deliberately omitted: like every other Today section, this only
  // surfaces what needs the user. Sorted red first, then amber.
  const attentionProjects = useMemo(() => {
    const out = [];
    for (const p of projects || []) {
      if (p.archived) continue;
      const tasksForProject = (tasks || []).filter(
        (t) => t.project === p.name
      );
      const { status, reasons } = projectHealth(p, tasksForProject);
      if (status === 'red' || status === 'amber') {
        out.push({ project: p, status, reasons });
      }
    }
    // Red before amber
    out.sort((a, b) => {
      if (a.status === b.status) return 0;
      return a.status === 'red' ? -1 : 1;
    });
    return out;
  }, [projects, tasks]);

  // Total count for the "all clear" check
const totalItems =
    overdueTasks.length +
    dueTodayTasks.length +
    overdueCommsList.length +
    dueTodayCommsList.length +
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
                  runningTimer={runningTimer}
                  onStartTimer={onStartTimer}
                  onStopTimer={onStopTimer}
                  isPrimary
                />
                {stretchTasks.map((t) => (
                  <PriorityRow
                    key={t.id}
                    task={t}
                    projects={projects}
                    onToggleDone={onToggleDone}
                    runningTimer={runningTimer}
                    onStartTimer={onStartTimer}
                    onStopTimer={onStopTimer}
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
                runningTimer={runningTimer}
                onStartTimer={onStartTimer}
                onStopTimer={onStopTimer}
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
                runningTimer={runningTimer}
                onStartTimer={onStartTimer}
                onStopTimer={onStopTimer}
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
        
{/* Replies expected today */}
{dueTodayCommsList.length > 0 && (
  <Section
    title={`✉ ${dueTodayCommsList.length} repl${dueTodayCommsList.length === 1 ? 'y' : 'ies'} expected today`}
    tone="purple"
  >
    {dueTodayCommsList.slice(0, 8).map((item, i) => (
      <CommRow
        key={`${item.station.id}-${item.comm.id}-${i}`}
        item={item}
        onJump={() => onJumpToProject(item.project.id)}
      />
    ))}
    {dueTodayCommsList.length > 8 && (
      <div style={styles.moreLine}>
        + {dueTodayCommsList.length - 8} more
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

        {/* Project status — collapsed digest of projects needing attention.
            Only amber/red projects appear; if everything is on track the
            whole section is omitted, consistent with the other sections. */}
        {attentionProjects.length > 0 && (
          <ProjectStatusSection
            items={attentionProjects}
            open={projectStatusOpen}
            onToggle={() => setProjectStatusOpen((v) => !v)}
            onJumpToProject={onJumpToProject}
          />
        )}

        {/* First-time welcome — appears when the user hasn't created any
            projects yet. We deliberately don't check tasks because, for the
            personal workspace, allTasks includes tasks assigned to the user
            from team workspaces, which would falsely make a fresh user look
            "established". Projects don't have that cross-workspace bleed. */}
        {(projects || []).length === 0 && (
          <div style={styles.welcome}>
            <div style={styles.welcomeTitle}>👋 Welcome to Daymark</div>
            <div style={styles.welcomeText}>
              Let's get you set up. Three things to try, in order:
            </div>
            <div style={styles.welcomeSteps}>
              <button
                onClick={() => onJumpToTab('projects')}
                style={styles.welcomeStep}
              >
                <div style={styles.welcomeStepNum}>1</div>
                <div style={styles.welcomeStepBody}>
                  <div style={styles.welcomeStepTitle}>Create your first project</div>
                  <div style={styles.welcomeStepDesc}>
                    Projects hold deliverables, stations, comms, and tasks. The core unit of work.
                  </div>
                </div>
                <div style={styles.welcomeStepArrow}>→</div>
              </button>

              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent('daymark-quick-capture'))
                }
                style={styles.welcomeStep}
              >
                <div style={styles.welcomeStepNum}>2</div>
                <div style={styles.welcomeStepBody}>
                  <div style={styles.welcomeStepTitle}>Add a task</div>
                  <div style={styles.welcomeStepDesc}>
                    Press <kbd style={styles.kbd}>Cmd</kbd>+<kbd style={styles.kbd}>K</kbd> from anywhere to add tasks fast.
                  </div>
                </div>
                <div style={styles.welcomeStepArrow}>→</div>
              </button>

              <button onClick={onOpenPriorityModal} style={styles.welcomeStep}>
                <div style={styles.welcomeStepNum}>3</div>
                <div style={styles.welcomeStepBody}>
                  <div style={styles.welcomeStepTitle}>Set today's priority</div>
                  <div style={styles.welcomeStepDesc}>
                    Pick the one thing that most matters today. Pinned to the top of your day.
                  </div>
                </div>
                <div style={styles.welcomeStepArrow}>→</div>
              </button>
            </div>

            {/* Demo workspace callout — separated visually from the three numbered steps */}
            {onSeedDemo && (
              <button
                onClick={onSeedDemo}
                disabled={seedingDemo}
                style={{
                  ...styles.demoCallout,
                  opacity: seedingDemo ? 0.6 : 1,
                  cursor: seedingDemo ? 'wait' : 'pointer',
                }}
              >
                <div style={styles.demoIcon}>📚</div>
                <div style={styles.demoBody}>
                  <div style={styles.demoTitle}>
                    {seedingDemo ? 'Setting up demo workspace…' : 'Or — see Daymark with realistic example data'}
                  </div>
                  <div style={styles.demoDesc}>
                    Creates a separate "Daymark demo" workspace with three example medcomms projects, comms logs, and tasks at different stages. Switch to it any time. Delete when you're done.
                  </div>
                </div>
                <div style={styles.welcomeStepArrow}>→</div>
              </button>
            )}

            <div style={styles.welcomeFooter}>
              Need a deeper tour? Click the <strong>?</strong> in the top bar any time.
            </div>
          </div>
        )}

        {/* All clear — for users who have started building (have at least one project)
            but nothing pressing right now */}
        {totalItems === 0 &&
          !todayPriority?.primary &&
          (projects || []).length > 0 && (
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
      ? 'var(--accent)'
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

// ── ProjectStatusSection ────────────────────────────────────────────────────
// Collapsible digest of projects that need attention. Collapsed by default:
// the header carries the summary (how many red / amber) so the signal is
// visible without expanding. Click the header to reveal the per-project list.
function ProjectStatusSection({ items, open, onToggle, onJumpToProject }) {
  const redCount = items.filter((it) => it.status === 'red').length;
  const amberCount = items.length - redCount;

  // Header summary: lead with the more urgent count.
  const parts = [];
  if (redCount > 0) parts.push(`${redCount} at risk`);
  if (amberCount > 0) parts.push(`${amberCount} need${amberCount === 1 ? 's' : ''} a look`);
  const summary = parts.join(' · ');

  return (
    <div style={sectionStyles.wrap}>
      <button
        onClick={onToggle}
        style={projectStatusStyles.headerBtn}
        title={open ? 'Collapse' : 'Expand'}
      >
        <span style={projectStatusStyles.caret}>{open ? '▾' : '▸'}</span>
        <span style={{ ...sectionStyles.title, color: redCount > 0 ? '#e24b4a' : '#ef9f27' }}>
          Project status
        </span>
        <span style={projectStatusStyles.summary}>{summary}</span>
      </button>

      {open && (
        <div style={projectStatusStyles.list}>
          {items.map(({ project, status, reasons }) => (
            <div key={project.id} style={styles.miniRow}>
              <span
                style={{
                  ...projectStatusStyles.dot,
                  background: status === 'red' ? '#e24b4a' : '#ef9f27',
                }}
              />
              <span style={styles.miniTitle}>
                <strong>{project.name}</strong>
              </span>
              <span
                style={{
                  ...styles.miniMeta,
                  color: status === 'red' ? '#e24b4a' : '#ef9f27',
                }}
              >
                {reasons && reasons.length > 0
                  ? reasons.join(' · ')
                  : status === 'red'
                  ? 'Needs attention'
                  : 'Worth a look'}
              </span>
              <button
                onClick={() => onJumpToProject(project.id)}
                style={styles.jumpInline}
              >
                Open →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mini row components ─────────────────────────────────────────────────────
function PriorityRow({ task, projects, onToggleDone, isPrimary, runningTimer, onStartTimer, onStopTimer }) {
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
      <TimerButton
        task={task}
        runningTimer={runningTimer}
        onStartTimer={onStartTimer}
        onStopTimer={onStopTimer}
      />
    </div>
  );
}

function TaskRowMini({ task, projects, onToggleDone, showDate, runningTimer, onStartTimer, onStopTimer }) {
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
      <TimerButton
        task={task}
        runningTimer={runningTimer}
        onStartTimer={onStartTimer}
        onStopTimer={onStopTimer}
      />
    </div>
  );
}

// ── TimerButton ─────────────────────────────────────────────────────────────
// Small Track / Stop button used in the Today rows. Mirrors the behaviour from
// the Plan list view: only one timer can run; if a different task is running,
// this button is disabled with a tooltip; if the task is done, no button.
function TimerButton({ task, runningTimer, onStartTimer, onStopTimer }) {
  if (task.done || !onStartTimer) return null;
  const isTracking = runningTimer?.taskId === task.id;
  if (isTracking) {
    return (
      <button onClick={onStopTimer} style={timerStyles.stop}>
        ■ Stop
      </button>
    );
  }
  const blocked = !!runningTimer;
  return (
    <button
      onClick={() => onStartTimer(task)}
      disabled={blocked}
      style={{
        ...timerStyles.track,
        opacity: blocked ? 0.4 : 1,
        cursor: blocked ? 'not-allowed' : 'pointer',
      }}
      title={blocked ? 'Stop the running timer first' : 'Start tracking'}
    >
      ▶ Track
    </button>
  );
}

const timerStyles = {
  track: {
    padding: '2px 8px',
    fontSize: 10,
    background: 'transparent',
    border: '0.5px solid #534AB7',
    color: 'var(--accent)',
    borderRadius: 4,
    flexShrink: 0,
    fontWeight: 500,
  },
  stop: {
    padding: '2px 8px',
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
    background: 'var(--bg-surface)',
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
    background: 'var(--accent)',
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
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  welcome: {
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 12,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  welcomeText: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
  welcomeSteps: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 4,
  },
  welcomeStep: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 10,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s',
  },
  welcomeStepNum: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  welcomeStepBody: { flex: 1, minWidth: 0 },
  welcomeStepTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  welcomeStepDesc: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginTop: 2,
  },
  welcomeStepArrow: {
    fontSize: 16,
    color: 'var(--accent)',
    flexShrink: 0,
  },
  welcomeFooter: {
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
    paddingTop: 4,
  },
  demoCallout: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    background: 'var(--accent-soft)',
    border: '0.5px dashed var(--accent-soft-border)',
    borderRadius: 10,
    textAlign: 'left',
    transition: 'all 0.15s',
    marginTop: 8,
  },
  demoIcon: {
    fontSize: 20,
    flexShrink: 0,
  },
  demoBody: { flex: 1, minWidth: 0 },
  demoTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--accent)',
  },
  demoDesc: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginTop: 2,
    lineHeight: 1.4,
  },
  kbd: {
    fontFamily: 'monospace',
    fontSize: 10,
    padding: '1px 5px',
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 3,
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

const projectStatusStyles = {
  headerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left',
  },
  caret: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    width: 12,
    flexShrink: 0,
  },
  summary: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginLeft: 'auto',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
};
