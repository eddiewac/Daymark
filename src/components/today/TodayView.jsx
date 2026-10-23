import { useMemo, useState } from 'react';
import { projectColor } from '../../lib/constants.js';
import { localDateStr, todayStr } from '../../lib/utils.js';
import { useSaveStatus } from '../save/SaveStatus.jsx';
import { taskDeliverableName } from '../../lib/deliverableStatus.js';
import { deadlineColor, fmtDeadline } from '../../lib/deadline.js';
import CloseDayPanel from './CloseDayPanel.jsx';

// ── TodayView ───────────────────────────────────────────────────────────────
// Action-first dashboard, restructured into two full-width columns:
//
//   LEFT  — "Do today"    : things you own and must act on
//              • Priority (primary + stretch), pinned
//              • Overdue tasks
//              • Tasks due today
//
//   RIGHT — "Waiting on"  : things out with other people, one list, sorted by
//            urgency (Overdue → Due back today → Expected later). Merges what
//            used to be two separate "overdue replies" and "expected today"
//            sections, and adds a per-item Chase action: log the chase + reset
//            the expected-back date (so overdue items stop nagging), with an
//            optional pre-filled email draft.
//
// Awareness items that aren't daily actions (upcoming congresses, project
// health) sit in a slim strip below the two columns. Stale stations were
// removed from Today — they didn't map to a clear action and belong on the
// Tracker, a review surface.

const DAY_MS = 86400000;

// Default new expected-back date for a chase: +3 business days from today.
function defaultChaseDate() {
  const d = new Date();
  let added = 0;
  while (added < 3) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return localDateStr(d);
}

// Short relative label for a waiting item's date vs today.
function waitRelLabel(dateIso, today) {
  if (!dateIso) return '';
  if (dateIso === today) return 'today';
  const a = new Date(dateIso + 'T00:00:00');
  const b = new Date(today + 'T00:00:00');
  const diff = Math.round((a - b) / DAY_MS);
  if (diff < 0) {
    const n = Math.abs(diff);
    return n === 1 ? '1d late' : `${n}d late`;
  }
  // Future: show weekday + day number ("Tue 21")
  return a.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

export default function TodayView({
  tasks,
  projects,
  congresses,
  todayPriority,
  onOpenPriorityModal,
  onJumpToTab,
  onJumpToProject,
  onJumpToTrack,
  onToggleDone,
  onUpdateTask,
  onUpdateProject,
  onPatchProject,
  runningTimer,
  onStartTimer,
  onStopTimer,
  onSeedDemo,
  seedingDemo,
  blocks,
  onOpenItem,
}) {
  const today = todayStr();
  const { runSave, showToast } = useSaveStatus();

  const [closeDayOpen, setCloseDayOpen] = useState(false);
  // Which waiting item currently has its chase popover open (by key).
  const [chaseOpen, setChaseOpen] = useState(null);
  const [waitingOpen, setWaitingOpen] = useState(true);
  const [blockingOpen, setBlockingOpen] = useState(true);

  // ── Priority ids (pinned in the Do column; excluded from the lists below so
  //    they aren't shown twice) ───────────────────────────────────────────────
  const priorityIds = useMemo(() => {
    const s = new Set();
    if (todayPriority?.primary) s.add(todayPriority.primary);
    (todayPriority?.stretch || []).forEach((id) => s.add(id));
    return s;
  }, [todayPriority]);

  const primaryTask = useMemo(
    () => (todayPriority?.primary ? (tasks || []).find((t) => t.id === todayPriority.primary) : null),
    [tasks, todayPriority]
  );
  const stretchTasks = useMemo(
    () =>
      (todayPriority?.stretch || [])
        .map((id) => (tasks || []).find((t) => t.id === id))
        .filter(Boolean),
    [tasks, todayPriority]
  );

  // ── Do column: overdue + due-today tasks (priority pinned separately) ───────
  const overdueTasks = useMemo(
    () =>
      (tasks || [])
        .filter((t) => !t.done && !t.isFollowUp && t.dueDate && t.dueDate < today && !priorityIds.has(t.id))
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')),
    [tasks, today, priorityIds]
  );

  const dueTodayTasks = useMemo(
    () => (tasks || []).filter((t) => !t.done && !t.isFollowUp && t.dueDate === today && !priorityIds.has(t.id)),
    [tasks, today, priorityIds]
  );

  // ── Waiting column: one unified, dated list of things out with people ───────
  // Each item: { key, type:'deliverable'|'comm', project, deliverable, station?,
  //              comm?, who, date, label, sub }
  const waitingItems = useMemo(() => {
    const items = [];
    for (const p of projects || []) {
      for (const d of p.deliverables || []) {
        // Deliverable-level "with [person], back [date]" marker
        const wName = (d.waitingOnName || '').trim();
        const wDate = d.waitingOnDate || '';
        if (wName && wDate) {
          items.push({
            key: `dw-${d.id}`,
            type: 'deliverable',
            project: p,
            deliverable: d,
            who: wName,
            date: wDate,
            label: d.name || '(deliverable)',
            sub: `with ${wName}`,
          });
        }
        // Station comms awaiting a reply, with an expected-back date
        for (const s of d.stations || []) {
          for (const c of s.comms || []) {
            if (c.replyReceived || !c.needsReply || !c.expectReplyBy) continue;
            items.push({
              key: `cm-${s.id}-${c.id}`,
              type: 'comm',
              project: p,
              deliverable: d,
              station: s,
              comm: c,
              who: null,
              date: c.expectReplyBy,
              label: `${d.name || '(deliverable)'} — ${s.name || 'station'}`,
              sub: `awaiting ${c.type || 'reply'}`,
            });
          }
        }
      }
    }
    // Follow-ups created by Capture triage (expect-back lives on dueDate).
    for (const t of tasks || []) {
      if (!t.isFollowUp || t.done || !t.dueDate) continue;
      const project =
        (projects || []).find((p) => p.id === t.projectId || (t.project && p.name === t.project)) ||
        null;
      items.push({
        key: `fu-${t.id}`,
        type: 'followup',
        project: project || { id: t.projectId || '', name: t.project || '' },
        taskId: t.id,
        who: null,
        date: t.dueDate,
        label: t.title || '(follow-up)',
        sub: 'follow-up · expect-back',
      });
    }
    return items;
  }, [projects, tasks]);

  const byDate = (a, b) => (a.date || '').localeCompare(b.date || '');
  const wOverdue = useMemo(() => waitingItems.filter((i) => i.date < today).sort(byDate), [waitingItems, today]);
  const wDueToday = useMemo(() => waitingItems.filter((i) => i.date === today).sort(byDate), [waitingItems, today]);
  const wLater = useMemo(() => waitingItems.filter((i) => i.date > today).sort(byDate), [waitingItems, today]);

  // ── Awareness strip ─────────────────────────────────────────────────────────
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

  // ── Counts ──────────────────────────────────────────────────────────────────
  const doCount =
    (primaryTask ? 1 : 0) + stretchTasks.length + overdueTasks.length + dueTodayTasks.length;
  const waitCount = waitingItems.length;
  const hasNothing = doCount === 0 && waitCount === 0 && upcomingCongresses.length === 0;

  // Apply a deliverables patch. On failure, put the previous array back locally
  // (no second write — the server still has it) and let the strip offer Retry.
  const saveDeliverables = (projectId, previous, next) => {
    const attempt = async () => {
      const result = await onUpdateProject(projectId, { deliverables: next });
      if (!result?.ok && onPatchProject) onPatchProject(projectId, { deliverables: previous });
      return result || { ok: false, error: 'Could not save' };
    };
    return runSave(attempt);
  };

  const yourHoursToday = useMemo(() => {
    return (blocks || [])
      .filter((b) => b.date === today && !b.voided)
      .reduce((s, b) => s + (Number(b.hours) || 0), 0);
  }, [blocks, today]);

  const budgetHours = useMemo(() => {
    const ids = new Set();
    const list = [];
    const push = (t) => {
      if (t && !ids.has(t.id)) {
        ids.add(t.id);
        list.push(t);
      }
    };
    push(primaryTask);
    stretchTasks.forEach(push);
    overdueTasks.forEach(push);
    dueTodayTasks.forEach(push);
    return list.reduce((s, t) => s + (Number(t.estimate) || 0), 0);
  }, [primaryTask, stretchTasks, overdueTasks, dueTodayTasks]);

  // What's blocking = exceptions only (overdue work, overdue waits, late stations).
  const blockingTasks = useMemo(
    () =>
      (tasks || []).filter((t) => !t.done && !t.isFollowUp && t.dueDate && t.dueDate < today),
    [tasks, today]
  );
  const lateStations = useMemo(() => {
    const out = [];
    for (const p of projects || []) {
      for (const d of p.deliverables || []) {
        for (const s of d.stations || []) {
          if (s.done || !s.targetDate || s.targetDate >= today) continue;
          out.push({ project: p, deliverable: d, station: s });
        }
      }
    }
    return out;
  }, [projects, today]);
  const blockingCount = blockingTasks.length + wOverdue.length + lateStations.length;

  // ── Chase handler — writes the new expected-back date to the right place ────
  const handleChase = (item, newDate) => {
    if (!newDate) {
      setChaseOpen(null);
      return;
    }
    if (item.type === 'followup') {
      onUpdateTask && onUpdateTask(item.taskId, { dueDate: newDate });
      setChaseOpen(null);
      return;
    }
    if (!onUpdateProject) {
      setChaseOpen(null);
      return;
    }
    const proj = (projects || []).find((p) => p.id === item.project.id);
    if (!proj) {
      setChaseOpen(null);
      return;
    }
    const previous = proj.deliverables;
    const stamp = new Date().toISOString();
    let deliverables;
    if (item.type === 'deliverable') {
      deliverables = (proj.deliverables || []).map((d) =>
        d.id === item.deliverable.id ? { ...d, waitingOnDate: newDate, lastChasedAt: stamp } : d
      );
    } else {
      deliverables = (proj.deliverables || []).map((d) => ({
        ...d,
        stations: (d.stations || []).map((s) =>
          s.id === item.station.id
            ? {
                ...s,
                comms: (s.comms || []).map((c) =>
                  c.id === item.comm.id ? { ...c, expectReplyBy: newDate, lastChasedAt: stamp } : c
                ),
              }
            : s
        ),
      }));
    }
    setChaseOpen(null);
    saveDeliverables(proj.id, previous, deliverables).then((result) => {
      if (result?.ok) showToast('Chase logged — expect-back updated');
    });
  };

  // ── Resolve handler — clears the waiting state at its source so it stops
  //    showing here AND on the project card. The row leaves immediately; the
  //    write has to succeed or the row comes back with Retry. ────────────────
  const handleResolve = (item) => {
    if (item.type === 'followup') {
      onToggleDone && onToggleDone(item.taskId);
      setChaseOpen((k) => (k === item.key ? null : k));
      return;
    }
    if (!onUpdateProject) return;
    const proj = (projects || []).find((p) => p.id === item.project.id);
    if (!proj) return;
    const previous = proj.deliverables;
    const stamp = new Date().toISOString();
    let deliverables;
    if (item.type === 'deliverable') {
      // Clear the deliverable's "with [person], back [date]" marker. The project
      // card reads this via deliverableStatus(), so the status line reverts to
      // station progress (or awaiting reply) automatically.
      deliverables = (proj.deliverables || []).map((d) =>
        d.id === item.deliverable.id
          ? { ...d, waitingOnName: '', waitingOnDate: '', waitingResolvedAt: stamp }
          : d
      );
    } else {
      // Mark the comm's reply as received — it drops out of every "awaiting
      // reply" surface across the app.
      deliverables = (proj.deliverables || []).map((d) => ({
        ...d,
        stations: (d.stations || []).map((s) =>
          s.id === item.station.id
            ? {
                ...s,
                comms: (s.comms || []).map((c) =>
                  c.id === item.comm.id ? { ...c, replyReceived: true, replyAt: stamp } : c
                ),
              }
            : s
        ),
      }));
    }
    setChaseOpen((k) => (k === item.key ? null : k));

    // Undo restores the previous deliverables. If the save is still in flight,
    // flag it so a successful write is immediately reversed. If it already
    // landed, persist the previous array.
    let phase = 'pending';
    showToast('Resolved — Undo', {
      onUndo: () => {
        if (phase === 'saved') {
          runSave(() => onUpdateProject(proj.id, { deliverables: previous }));
        } else {
          phase = 'undone';
          if (onPatchProject) onPatchProject(proj.id, { deliverables: previous });
        }
      },
    });

    const attempt = async () => {
      phase = 'pending';
      const result = await onUpdateProject(proj.id, { deliverables });
      if (phase === 'undone') {
        if (result?.ok) await onUpdateProject(proj.id, { deliverables: previous });
        else if (onPatchProject) onPatchProject(proj.id, { deliverables: previous });
        return { ok: true, skipped: true };
      }
      if (!result?.ok && onPatchProject) onPatchProject(proj.id, { deliverables: previous });
      if (result?.ok) phase = 'saved';
      return result || { ok: false, error: 'Could not save' };
    };
    runSave(attempt);
  };

  const openWaiting = (item) => {
    if (item.type === 'comm' && item.station && onOpenItem) {
      onOpenItem({
        kind: 'station',
        projectId: item.project.id,
        deliverableId: item.deliverable.id,
        stationId: item.station.id,
      });
      return;
    }
    if (item.project?.id) onJumpToProject(item.project.id);
  };

  const draftChaseEmail = (item) => {
    const what = item.type === 'deliverable' ? item.deliverable.name : item.label;
    const who = item.who ? ` ${item.who}` : '';
    const subject = `Chasing: ${what}`;
    const body = `Hi${who},\n\nJust following up on ${what} — do you have an update for me?\n\nThanks`;
    try {
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } catch {}
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={styles.scroll}>
      <div style={styles.wrap}>
        {/* Header */}
        <div style={styles.greeting}>
          <div>
            <div style={styles.greetingTitle}>Today</div>
            <div style={styles.greetingDate}>
              {new Date().toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              {(doCount > 0 || waitCount > 0) && (
                <span style={styles.countLine}>
                  {' · '}
                  {doCount} to do · {waitCount} waiting
                </span>
              )}
              {(budgetHours > 0 || yourHoursToday > 0) && (
                <span style={styles.countLine} title="Budget is the estimate on today's tasks. Hours are yours only.">
                  {' · '}
                  Budget {budgetHours.toFixed(1)}h · your hours {yourHoursToday.toFixed(1)}h
                </span>
              )}
            </div>
          </div>
          <button
            style={styles.closeDayBtn}
            onClick={() => setCloseDayOpen(true)}
            title="Recap today and set up tomorrow"
          >
            🌙 Close out day
          </button>
        </div>

        {/* Welcome (no projects yet) */}
        {(projects || []).length === 0 ? (
          <WelcomeBlock
            onJumpToTab={onJumpToTab}
            onOpenPriorityModal={onOpenPriorityModal}
            onSeedDemo={onSeedDemo}
            seedingDemo={seedingDemo}
          />
        ) : hasNothing && blockingCount === 0 && !primaryTask ? (
          <div style={styles.allClear}>
            <div style={styles.allClearTitle}>👌 All clear</div>
            <div style={styles.allClearText}>
              Nothing to do, nothing outstanding, no priority set. A good moment to pick the one
              thing that matters most today.
            </div>
            <button onClick={onOpenPriorityModal} style={styles.allClearBtn}>
              Set today's priority
            </button>
          </div>
        ) : (
          <>
            {/* Two full-width columns */}
            <div style={styles.cols}>
              {/* ── DO ─────────────────────────────────────────────────── */}
              <section style={styles.bucket}>
                <div style={styles.bucketHead}>
                  <span style={styles.bucketIcon}>✅</span>
                  <h2 style={styles.bucketTitle}>Do today</h2>
                  <span style={styles.bucketCount}>{doCount}</span>
                </div>

                {/* Priority (pinned) */}
                {primaryTask ? (
                  <>
                    <SubHead tone="accent" label="🎯 Priority" action="Edit" onAction={onOpenPriorityModal} />
                    <PriorityRow
                      task={primaryTask}
                      projects={projects}
                      onToggleDone={onToggleDone}
                      runningTimer={runningTimer}
                      onStartTimer={onStartTimer}
                      onStopTimer={onStopTimer}
                      onJumpToTrack={onJumpToTrack}
                      onOpenItem={onOpenItem}
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
                        onJumpToTrack={onJumpToTrack}
                        onOpenItem={onOpenItem}
                      />
                    ))}
                  </>
                ) : (
                  <SubHead tone="muted" label="🎯 Priority" action="Set" onAction={onOpenPriorityModal} />
                )}

                {/* Overdue tasks */}
                {overdueTasks.length > 0 && (
                  <>
                    <SubHead tone="red" label="Overdue" />
                    {overdueTasks.slice(0, 12).map((t) => (
                      <TaskRowMini
                        key={t.id}
                        task={t}
                        projects={projects}
                        onToggleDone={onToggleDone}
                        runningTimer={runningTimer}
                        onStartTimer={onStartTimer}
                        onStopTimer={onStopTimer}
                        onJumpToTrack={onJumpToTrack}
                        onOpenItem={onOpenItem}
                        showDate
                      />
                    ))}
                    {overdueTasks.length > 12 && (
                      <div style={styles.moreLine}>+ {overdueTasks.length - 12} more</div>
                    )}
                  </>
                )}

                {/* Due today */}
                {dueTodayTasks.length > 0 && (
                  <>
                    <SubHead tone="amber" label="Today" />
                    {dueTodayTasks.map((t) => (
                      <TaskRowMini
                        key={t.id}
                        task={t}
                        projects={projects}
                        onToggleDone={onToggleDone}
                        runningTimer={runningTimer}
                        onStartTimer={onStartTimer}
                        onStopTimer={onStopTimer}
                        onJumpToTrack={onJumpToTrack}
                        onOpenItem={onOpenItem}
                      />
                    ))}
                  </>
                )}

                {!primaryTask && overdueTasks.length === 0 && dueTodayTasks.length === 0 && (
                  <div style={styles.colEmpty}>Nothing scheduled for today 🎉</div>
                )}
              </section>

              {/* ── WAITING ────────────────────────────────────────────── */}
              <section style={styles.bucket}>
                <button
                  type="button"
                  style={styles.bucketHeadBtn}
                  onClick={() => setWaitingOpen((v) => !v)}
                  aria-expanded={waitingOpen}
                >
                  <span style={styles.bucketIcon}>⏳</span>
                  <h2 style={styles.bucketTitle}>Waiting on</h2>
                  <span style={styles.bucketCount}>{waitCount}</span>
                  <span style={styles.foldMark}>{waitingOpen ? '▾' : '▸'}</span>
                </button>

                {waitingOpen && wOverdue.length > 0 && <SubHead tone="red" label="Overdue" />}
                {waitingOpen && wOverdue.map((item) => (
                  <WaitingRow
                    key={item.key}
                    item={item}
                    tone="over"
                    today={today}
                    open={chaseOpen === item.key}
                    onToggleChase={() => setChaseOpen((k) => (k === item.key ? null : item.key))}
                    onChase={handleChase}
                    onResolve={handleResolve}
                    onDraftEmail={draftChaseEmail}
                    onOpen={() => openWaiting(item)}
                  />
                ))}

                {waitingOpen && wDueToday.length > 0 && <SubHead tone="amber" label="Due back today" />}
                {waitingOpen && wDueToday.map((item) => (
                  <WaitingRow
                    key={item.key}
                    item={item}
                    tone="due"
                    today={today}
                    open={chaseOpen === item.key}
                    onToggleChase={() => setChaseOpen((k) => (k === item.key ? null : item.key))}
                    onChase={handleChase}
                    onResolve={handleResolve}
                    onDraftEmail={draftChaseEmail}
                    onOpen={() => openWaiting(item)}
                  />
                ))}

                {waitingOpen && wLater.length > 0 && <SubHead tone="muted" label="Expected later" />}
                {waitingOpen && wLater.map((item) => (
                  <WaitingRow
                    key={item.key}
                    item={item}
                    tone="later"
                    today={today}
                    open={chaseOpen === item.key}
                    onToggleChase={() => setChaseOpen((k) => (k === item.key ? null : item.key))}
                    onChase={handleChase}
                    onResolve={handleResolve}
                    onDraftEmail={draftChaseEmail}
                    onOpen={() => openWaiting(item)}
                  />
                ))}

                {waitingOpen && waitCount === 0 && (
                  <div style={styles.colEmpty}>Nothing out with anyone right now.</div>
                )}
              </section>
            </div>

            <section style={styles.blocking}>
              <button
                type="button"
                style={styles.bucketHeadBtn}
                onClick={() => setBlockingOpen((v) => !v)}
                aria-expanded={blockingOpen}
              >
                <span style={styles.bucketIcon}>⚑</span>
                <h2 style={styles.bucketTitle}>What’s blocking</h2>
                <span style={styles.bucketCount}>{blockingCount}</span>
                <span style={styles.foldHint}>exceptions only</span>
                <span style={styles.foldMark}>{blockingOpen ? '▾' : '▸'}</span>
              </button>
              {blockingOpen && blockingCount === 0 && (
                <div style={styles.colEmpty}>No exceptions. Overdue work, overdue waits, and late stations show up here.</div>
              )}
              {blockingOpen && blockingTasks.slice(0, 8).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  style={styles.blockRow}
                  onClick={() => onOpenItem && onOpenItem({ kind: 'task', task: t })}
                >
                  <span style={styles.blockKind}>Overdue</span>
                  <span style={styles.blockTitle}>{t.title || '(untitled)'}</span>
                  {t.project && <span style={styles.blockMeta}>{t.project}</span>}
                </button>
              ))}
              {blockingOpen && wOverdue.slice(0, 8).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  style={styles.blockRow}
                  onClick={() => openWaiting(item)}
                >
                  <span style={styles.blockKind}>Wait</span>
                  <span style={styles.blockTitle}>{item.label}</span>
                  <span style={styles.blockMeta}>{item.date}</span>
                </button>
              ))}
              {blockingOpen && lateStations.slice(0, 8).map((row) => (
                <button
                  key={row.station.id}
                  type="button"
                  style={styles.blockRow}
                  onClick={() =>
                    onOpenItem &&
                    onOpenItem({
                      kind: 'station',
                      projectId: row.project.id,
                      deliverableId: row.deliverable.id,
                      stationId: row.station.id,
                    })
                  }
                >
                  <span style={styles.blockKind}>Late</span>
                  <span style={styles.blockTitle}>{row.station.name || 'Station'}</span>
                  <span style={styles.blockMeta}>{row.project.name}</span>
                </button>
              ))}
            </section>

            {/* Awareness strip — upcoming congresses only. Below the fold
                deliberately: not a daily action, just a date not to forget. */}
            {upcomingCongresses.length > 0 && (
              <div style={styles.strip}>
                <div style={styles.stripBlock}>
                  <div style={styles.stripHead}>
                    <span>🏛 Congresses · next 14 days</span>
                    <button style={styles.stripJump} onClick={() => onJumpToTab('congresses')}>
                      Open →
                    </button>
                  </div>
                  {upcomingCongresses.map((c) => {
                    const days = Math.ceil((new Date(c.startDate) - Date.now()) / DAY_MS);
                    return (
                      <div key={c.id} style={styles.stripRow}>
                        <span style={styles.stripRowTitle}>{c.name}</span>
                        <span style={styles.stripRowMeta}>
                          {c.location ? `${c.location} · ` : ''}
                          {days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {closeDayOpen && (
        <CloseDayPanel
          tasks={tasks}
          projects={projects}
          todayPriority={todayPriority}
          onRollForward={(taskId) => {
            const t = new Date();
            t.setDate(t.getDate() + 1);
            onUpdateTask && onUpdateTask(taskId, { dueDate: t.toISOString().slice(0, 10) });
          }}
          onJumpToProject={onJumpToProject}
          onClose={() => setCloseDayOpen(false)}
        />
      )}
    </div>
  );
}

// ── SubHead — small urgency/section label inside a column ────────────────────
function SubHead({ label, tone, action, onAction }) {
  const color =
    tone === 'red'
      ? '#e24b4a'
      : tone === 'amber'
      ? '#ef9f27'
      : tone === 'accent'
      ? 'var(--accent)'
      : 'var(--color-text-tertiary)';
  return (
    <div style={subHeadStyles.wrap}>
      <span style={{ ...subHeadStyles.label, color }}>{label}</span>
      <div style={{ flex: 1 }} />
      {action && onAction && (
        <button style={subHeadStyles.action} onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

// ── WaitingRow — one item out with someone, with an inline Chase action ──────
function WaitingRow({ item, tone, today, open, onToggleChase, onChase, onResolve, onDraftEmail, onOpen }) {
  const projColor = projectColor(item.project.name, null);
  const whenColor = tone === 'over' ? '#e24b4a' : tone === 'due' ? '#ef9f27' : 'var(--color-text-secondary)';
  const rel = waitRelLabel(item.date, today);
  const resolveTitle = item.type === 'comm' ? 'Mark reply received — no longer waiting' : 'No longer waiting on this';
  return (
    <div style={waitStyles.outer}>
      <div style={waitStyles.row}>
        <button
          style={waitStyles.main}
          onClick={onOpen}
          title={item.station ? 'Open station' : 'Open project'}
        >
          <span style={waitStyles.title}>{item.label}</span>
          <span style={waitStyles.meta}>
            {item.who ? (
              <span>
                with <strong>{item.who}</strong>
              </span>
            ) : (
              <span>{item.sub}</span>
            )}
            <span style={{ ...waitStyles.chip, color: projColor }}>{item.project.name}</span>
          </span>
        </button>
        <span style={{ ...waitStyles.when, color: whenColor, fontWeight: tone === 'later' ? 400 : 600 }}>
          {rel}
        </span>
        <button style={waitStyles.resolveBtn} onClick={() => onResolve(item)} title={resolveTitle}>
          ✓
        </button>
        <button
          style={{ ...waitStyles.chaseBtn, ...(tone === 'over' ? {} : waitStyles.chaseGhost) }}
          onClick={onToggleChase}
        >
          Chase {open ? '▾' : '→'}
        </button>
      </div>
      {open && <ChasePopover item={item} onChase={onChase} onDraftEmail={onDraftEmail} />}
    </div>
  );
}

// ── ChasePopover — pick a new expected-back date, log the chase, draft email ─
function ChasePopover({ item, onChase, onDraftEmail }) {
  const [date, setDate] = useState(defaultChaseDate);
  return (
    <div style={chaseStyles.wrap}>
      <div style={chaseStyles.row}>
        <span style={chaseStyles.text}>
          Chased{item.who ? <strong> {item.who}</strong> : ''} — now expect back
        </span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={chaseStyles.date}
        />
        <button style={chaseStyles.go} onClick={() => onChase(item, date)}>
          Log chase
        </button>
        <button style={chaseStyles.email} onClick={() => onDraftEmail(item)}>
          ✉ Draft email
        </button>
      </div>
      <div style={chaseStyles.hint}>
        Logs the chase and resets the expected date, so it drops off “overdue”.
      </div>
    </div>
  );
}

// ── Priority / task mini rows ────────────────────────────────────────────────
function PriorityRow({ task, projects, onToggleDone, isPrimary, runningTimer, onStartTimer, onStopTimer, onJumpToTrack, onOpenItem }) {
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
        {task.isFollowUp && <span title="Follow-up reminder">🔔 </span>}
        {task.title || '(untitled)'}
      </span>
      {task.project && <span style={{ ...styles.miniChip, color: projColor }}>{task.project}</span>}
      {(() => {
        const delivName = taskDeliverableName(task, projects);
        return delivName ? (
          <span style={{ ...styles.miniChip, color: projColor, opacity: 0.8 }} title={`Deliverable: ${delivName}`}>
            ▸ {delivName}
          </span>
        ) : null;
      })()}
      {task.deadline && (() => {
        const dc = deadlineColor(task.deadline);
        return (
          <span style={{ ...styles.miniChip, color: dc, fontWeight: 600 }} title={`Deadline: ${task.deadline}`}>
            ⚑ {fmtDeadline(task.deadline)}
          </span>
        );
      })()}
      {onOpenItem && (
        <button
          type="button"
          onClick={() => onOpenItem({ kind: 'task', task })}
          style={styles.trackJumpBtn}
          title={task.stationId ? 'Open station' : 'Open'}
        >
          Open
        </button>
      )}
      <TimerButton task={task} runningTimer={runningTimer} onStartTimer={onStartTimer} onStopTimer={onStopTimer} />
    </div>
  );
}

function TaskRowMini({ task, projects, onToggleDone, showDate, runningTimer, onStartTimer, onStopTimer, onJumpToTrack, onOpenItem }) {
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
        {task.isFollowUp && <span title="Follow-up reminder">🔔 </span>}
        {task.title || '(untitled)'}
      </span>
      {showDate && task.dueDate && (
        <span style={{ ...styles.miniMeta, color: '#e24b4a', fontWeight: 600 }}>{task.dueDate}</span>
      )}
      {task.project && <span style={{ ...styles.miniChip, color: projColor }}>{task.project}</span>}
      {(() => {
        const delivName = taskDeliverableName(task, projects);
        return delivName ? (
          <span style={{ ...styles.miniChip, color: projColor, opacity: 0.8 }} title={`Deliverable: ${delivName}`}>
            ▸ {delivName}
          </span>
        ) : null;
      })()}
      {task.deadline && (() => {
        const dc = deadlineColor(task.deadline);
        return (
          <span style={{ ...styles.miniChip, color: dc, fontWeight: 600 }} title={`Deadline: ${task.deadline}`}>
            ⚑ {fmtDeadline(task.deadline)}
          </span>
        );
      })()}
      {onOpenItem && (
        <button
          type="button"
          onClick={() => onOpenItem({ kind: 'task', task })}
          style={styles.trackJumpBtn}
          title={task.stationId ? 'Open station' : 'Open'}
        >
          Open
        </button>
      )}
      <TimerButton task={task} runningTimer={runningTimer} onStartTimer={onStartTimer} onStopTimer={onStopTimer} />
    </div>
  );
}

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
  const switching = !!runningTimer && runningTimer.taskId !== task.id;
  return (
    <button
      onClick={() => onStartTimer(task)}
      style={timerStyles.track}
      title={switching ? 'Switch timer — logs the current block' : 'Start tracking'}
    >
      ▶ Track
    </button>
  );
}

// ── Welcome (no projects) ────────────────────────────────────────────────────
function WelcomeBlock({ onJumpToTab, onOpenPriorityModal, onSeedDemo, seedingDemo }) {
  return (
    <div style={styles.welcome}>
      <div style={styles.welcomeTitle}>👋 Welcome to Daymark</div>
      <div style={styles.welcomeText}>Let's get you set up. Three things to try, in order:</div>
      <div style={styles.welcomeSteps}>
        <button onClick={() => onJumpToTab('projects')} style={styles.welcomeStep}>
          <div style={styles.welcomeStepNum}>1</div>
          <div style={styles.welcomeStepBody}>
            <div style={styles.welcomeStepTitle}>Create your first project</div>
            <div style={styles.welcomeStepDesc}>
              Projects hold deliverables, stations, comms, and tasks. The core unit of work.
            </div>
          </div>
          <div style={styles.welcomeStepArrow}>→</div>
        </button>
        <button onClick={() => window.dispatchEvent(new CustomEvent('daymark-quick-capture'))} style={styles.welcomeStep}>
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
      {onSeedDemo && (
        <button
          onClick={onSeedDemo}
          disabled={seedingDemo}
          style={{ ...styles.demoCallout, opacity: seedingDemo ? 0.6 : 1, cursor: seedingDemo ? 'wait' : 'pointer' }}
        >
          <div style={styles.demoIcon}>📚</div>
          <div style={styles.demoBody}>
            <div style={styles.demoTitle}>
              {seedingDemo ? 'Setting up demo workspace…' : 'Or — see Daymark with realistic example data'}
            </div>
            <div style={styles.demoDesc}>
              Creates a separate "Daymark demo" workspace with three example medcomms projects, comms logs, and tasks
              at different stages. Switch to it any time. Delete when you're done.
            </div>
          </div>
          <div style={styles.welcomeStepArrow}>→</div>
        </button>
      )}
      <div style={styles.welcomeFooter}>
        Need a deeper tour? Click the <strong>?</strong> in the top bar any time.
      </div>
    </div>
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

const subHeadStyles = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 14px 3px',
  },
  label: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  action: {
    fontSize: 10,
    padding: '2px 8px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    cursor: 'pointer',
  },
};

const waitStyles = {
  outer: {
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
  },
  main: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    alignItems: 'flex-start',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
  },
  title: {
    fontSize: 12.5,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  },
  meta: {
    fontSize: 10.5,
    color: 'var(--color-text-secondary)',
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  chip: {
    fontSize: 10,
    fontWeight: 500,
  },
  when: {
    fontSize: 10.5,
    fontFamily: 'ui-monospace, monospace',
    flexShrink: 0,
  },
  chaseBtn: {
    fontSize: 11,
    fontWeight: 500,
    padding: '3px 10px',
    borderRadius: 12,
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  chaseGhost: {
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--accent)',
  },
  resolveBtn: {
    width: 24,
    height: 24,
    flexShrink: 0,
    padding: 0,
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: '#1d9e75',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1,
  },
};

const chaseStyles = {
  wrap: {
    margin: '0 14px 10px',
    background: 'var(--accent-soft)',
    border: '0.5px solid #534AB733',
    borderRadius: 10,
    padding: '9px 11px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  text: {
    fontSize: 11.5,
    color: 'var(--color-text-primary)',
  },
  date: {
    fontSize: 11.5,
    padding: '3px 6px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    background: 'var(--bg-surface)',
    color: 'var(--color-text-primary)',
  },
  go: {
    fontSize: 11.5,
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '4px 10px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  email: {
    fontSize: 11.5,
    background: 'transparent',
    border: '0.5px solid var(--accent)',
    color: 'var(--accent)',
    borderRadius: 6,
    padding: '4px 10px',
    cursor: 'pointer',
  },
  hint: {
    fontSize: 10.5,
    color: 'var(--color-text-tertiary)',
    marginTop: 6,
  },
};

const styles = {
  scroll: { flex: 1, overflowY: 'auto' },
  wrap: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '20px 24px 60px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  greeting: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  greetingTitle: { fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' },
  greetingDate: { fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 },
  countLine: { color: 'var(--color-text-tertiary)' },
  closeDayBtn: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: 500,
    padding: '7px 14px',
    borderRadius: 18,
    border: '0.5px solid var(--color-border-secondary)',
    background: 'var(--bg-surface)',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },

  // two columns, side by side on wide, stacked on narrow
  cols: {
    display: 'flex',
    gap: 18,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  bucket: {
    flex: '1 1 340px',
    minWidth: 300,
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  bucketHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 14px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  bucketIcon: { fontSize: 15 },
  bucketTitle: { fontSize: 14, fontWeight: 600, flex: 1, color: 'var(--color-text-primary)' },
  bucketCount: {
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
    background: 'var(--color-background-secondary)',
    borderRadius: 10,
    padding: '1px 8px',
  },
  bucketHeadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 14px',
    border: 'none',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    background: 'transparent',
    width: '100%',
    cursor: 'pointer',
    textAlign: 'left',
  },
  foldMark: { fontSize: 11, color: 'var(--color-text-tertiary)' },
  foldHint: { fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 500 },
  blocking: {
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  blockRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '8px 14px',
    border: 'none',
    borderTop: '0.5px solid var(--color-border-tertiary)',
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
  },
  blockKind: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: '#e24b4a',
    width: 58,
    flexShrink: 0,
  },
  blockTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  blockMeta: { fontSize: 11, color: 'var(--color-text-secondary)', flexShrink: 0 },
  colEmpty: {
    fontSize: 12,
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
    padding: '14px',
  },

  miniRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 14px',
    fontSize: 12,
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  miniTitle: {
    flex: 1,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  miniMeta: { fontSize: 10, color: 'var(--color-text-secondary)', flexShrink: 0 },
  miniChip: { fontSize: 10, fontWeight: 500, flexShrink: 0 },
  trackJumpBtn: {
    flexShrink: 0,
    width: 22,
    height: 22,
    padding: 0,
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
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
  moreLine: { fontSize: 10, color: 'var(--color-text-tertiary)', padding: '4px 14px' },

  // awareness strip
  strip: {
    display: 'flex',
    gap: 18,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  stripBlock: {
    flex: '1 1 340px',
    minWidth: 300,
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 10,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  stripHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    marginBottom: 2,
  },
  stripHeadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
    textAlign: 'left',
  },
  stripCaret: { fontSize: 10, color: 'var(--color-text-tertiary)', width: 10, flexShrink: 0 },
  stripSummary: { fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: 'auto' },
  stripJump: {
    marginLeft: 'auto',
    padding: '2px 8px',
    fontSize: 10,
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    cursor: 'pointer',
  },
  stripRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11.5,
    padding: '4px 0',
  },
  stripRowTitle: { flex: 1, color: 'var(--color-text-primary)', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  stripRowMeta: { fontSize: 10.5, color: 'var(--color-text-secondary)', flexShrink: 0 },
  statusDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },

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
  allClearText: { fontSize: 12, color: 'var(--color-text-secondary)', maxWidth: 420 },
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
  welcomeTitle: { fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' },
  welcomeText: { fontSize: 12, color: 'var(--color-text-secondary)' },
  welcomeSteps: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 },
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
  welcomeStepTitle: { fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' },
  welcomeStepDesc: { fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 },
  welcomeStepArrow: { fontSize: 16, color: 'var(--accent)', flexShrink: 0 },
  welcomeFooter: { fontSize: 11, color: 'var(--color-text-tertiary)', fontStyle: 'italic', paddingTop: 4 },
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
  demoIcon: { fontSize: 20, flexShrink: 0 },
  demoBody: { flex: 1, minWidth: 0 },
  demoTitle: { fontSize: 12, fontWeight: 600, color: 'var(--accent)' },
  demoDesc: { fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.4 },
  kbd: {
    fontFamily: 'monospace',
    fontSize: 10,
    padding: '1px 5px',
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 3,
  },
};
