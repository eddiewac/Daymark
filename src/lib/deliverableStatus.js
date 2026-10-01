// ── Deliverable status ──────────────────────────────────────────────────────
//
// Derives a single, compact status for a deliverable, combining a manual
// "waiting on" marker (set by the user) with status derived from the
// deliverable's stations. One status line, with a clear precedence so the
// signals never contradict:
//
// 1. Manual "with [person], back [date]" → explicit, most current. Wins.
// 2. An open station comm awaiting reply → derived "awaiting reply".
// 3. Station progress (done / total) → derived "N/M stations".
// 4. Nothing → null (caller shows a faint dash).
//
// A deliverable shape: { id, name, stations: [], waitingOnName?, waitingOnDate? }
// A station may carry comms: { comms: [{ needsReply, replyReceived, expectReplyBy }] }

// kind: 'waiting' | 'awaiting' | 'progress' | null
export function deliverableStatus(deliverable) {
  if (!deliverable) return null;

  // 1. Manual waiting-on marker takes precedence.
  const woName = (deliverable.waitingOnName || '').trim();
  if (woName) {
    return {
      kind: 'waiting',
      label: `with ${woName}`,
      date: deliverable.waitingOnDate || null,
      icon: '⏳',
    };
  }

  const stations = deliverable.stations || [];

  // 2. Any open station comm awaiting a reply? Surface the soonest expected-back.
  let soonest = null;
  for (const st of stations) {
    for (const c of st.comms || []) {
      if (c.needsReply && !c.replyReceived) {
        if (c.expectReplyBy && (!soonest || c.expectReplyBy < soonest)) {
          soonest = c.expectReplyBy;
        } else if (!c.expectReplyBy && !soonest) {
          soonest = '';
        }
      }
    }
  }
  if (soonest !== null) {
    return {
      kind: 'awaiting',
      label: 'awaiting reply',
      date: soonest || null,
      icon: '↩',
    };
  }

  // 3. Station progress.
  const total = stations.length;
  if (total > 0) {
    const done = stations.filter((s) => s.done).length;
    return {
      kind: 'progress',
      label: `${done}/${total} stations`,
      date: null,
      icon: null,
      complete: done === total,
    };
  }

  // 4. Nothing to show.
  return null;
}

// Collect deliverable-level "waiting on" markers across all projects that are
// due on or before `today` (ISO yyyy-mm-dd). Used by the Today view to surface
// them like station comms. Returns { overdue: [], dueToday: [] } where each
// item is { project, deliverable, name, date }.
export function collectDeliverableWaiting(projects, today) {
  const overdue = [];
  const dueToday = [];
  for (const p of projects || []) {
    for (const d of p.deliverables || []) {
      const name = (d.waitingOnName || '').trim();
      const date = d.waitingOnDate || '';
      if (!name || !date) continue;
      const item = { project: p, deliverable: d, name, date };
      if (date < today) overdue.push(item);
      else if (date === today) dueToday.push(item);
    }
  }
  return { overdue, dueToday };
}
// Resolve the deliverable a task belongs to, for display on task cards/lists.
// A task can be linked two ways:
//   1. task.deliverableId — set when tagged to a deliverable (manual or via a
//      station-created task). Preferred.
//   2. task.stationId — if the task was made from a station, find the
//      deliverable whose stations include that station.
// Returns the deliverable object, or null if the task isn't deliverable-linked.
// `project` is the project the task belongs to (match by task.project name).
export function taskDeliverable(task, projects) {
  if (!task) return null;
  const proj = (projects || []).find((p) => p.name === task.project);
  if (!proj) return null;
  const delivs = proj.deliverables || [];
  // 1. Direct deliverableId link
  if (task.deliverableId) {
    const d = delivs.find((x) => x.id === task.deliverableId);
    if (d) return d;
  }
  // 2. Derive from stationId
  if (task.stationId) {
    const d = delivs.find((x) =>
      (x.stations || []).some((s) => s.id === task.stationId)
    );
    if (d) return d;
  }
  return null;
}

// Resolve just the deliverable NAME for display on a task, working in ANY
// workspace. Prefers a stored task.deliverableName (set at tag time, so it
// travels with the task even when the task's project isn't loaded — e.g. a
// team task shown in a personal workspace). Falls back to deriving from the
// loaded projects (via deliverableId or stationId) when no name is stored.
// Returns a string, or '' if the task has no deliverable.
export function taskDeliverableName(task, projects) {
  if (!task) return '';
  if (task.deliverableName) return task.deliverableName;
  const d = taskDeliverable(task, projects);
  return d ? d.name || '' : '';
}
