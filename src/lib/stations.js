// ── Station-derived helpers ─────────────────────────────────────────────────
//
// These helpers don't change the station data shape. They derive useful
// signals from existing fields (completedAt, comms timestamps, etc.) so we
// can show "last activity 3 days ago" without storing a redundant field.

const DAY_MS = 86400000;

// Pull the most recent activity timestamp from a station.
// Looks at: completedAt, latest comm sentAt/at/ts, and any explicit
// updatedAt the station might have.
export function stationLastActivityAt(station) {
  if (!station) return null;
  const candidates = [];
  if (station.updatedAt) candidates.push(station.updatedAt);
  if (station.completedAt) candidates.push(station.completedAt);
  for (const c of station.comms || []) {
    // Comms might use any of these field names depending on how they were saved
    if (c.at) candidates.push(c.at);
    if (c.sentAt) candidates.push(c.sentAt);
    if (c.ts) candidates.push(c.ts);
    if (c.replyAt) candidates.push(c.replyAt);
  }
  if (candidates.length === 0) return null;

  let max = 0;
  for (const t of candidates) {
    const ms = typeof t === 'number' ? t : new Date(t).getTime();
    if (Number.isFinite(ms) && ms > max) max = ms;
  }
  return max || null;
}

// Format an ISO timestamp / number as "3 days ago", "just now", "yesterday".
export function relativeTime(timestamp) {
  if (!timestamp) return null;
  const ms = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  if (!Number.isFinite(ms)) return null;
  const diff = Date.now() - ms;
  if (diff < 0) return 'just now';
  if (diff < 60000) return 'just now';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return '1 week ago';
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  return `${months} months ago`;
}

// Comms with `expectReplyBy` set, where reply hasn't been received and the
// expected reply date has passed.
export function overdueComms(station) {
  const today = new Date().toISOString().slice(0, 10);
  return (station?.comms || []).filter((c) => {
    if (!c.expectReplyBy) return false;
    if (c.replyReceived) return false;
    return c.expectReplyBy < today;
  });
}

// ── Project health indicator ────────────────────────────────────────────────
//
// Computes a simple traffic-light status for a project based on:
//   - tasks: passed in (already filtered by project name)
//   - station data: project.deliverables[].stations[]
//
// Returns { status: 'green' | 'amber' | 'red', reasons: [] }
export function projectHealth(project, tasksForProject) {
  const reasons = [];
  let status = 'green';

  const today = new Date().toISOString().slice(0, 10);

  // Red: any overdue open tasks
  const overdueTasks = (tasksForProject || []).filter(
    (t) => !t.done && t.dueDate && t.dueDate < today
  );
  if (overdueTasks.length > 0) {
    status = 'red';
    reasons.push(`${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'}`);
  }

  // Red: any comm where expected reply is overdue
  let overdueCommCount = 0;
  for (const d of project?.deliverables || []) {
    for (const s of d.stations || []) {
      overdueCommCount += overdueComms(s).length;
    }
  }
  if (overdueCommCount > 0) {
    status = 'red';
    reasons.push(`${overdueCommCount} comm${overdueCommCount === 1 ? '' : 's'} awaiting overdue reply`);
  }

  // Amber: stale stations (no activity > 7 days, only counted on incomplete stations)
  let staleStationCount = 0;
  for (const d of project?.deliverables || []) {
    for (const s of d.stations || []) {
      if (s.done) continue;
      const lastAct = stationLastActivityAt(s);
      if (!lastAct) continue; // no activity timestamp → no signal
      const daysSince = (Date.now() - lastAct) / DAY_MS;
      if (daysSince > 7) staleStationCount++;
    }
  }
  if (staleStationCount > 0 && status !== 'red') {
    status = 'amber';
    reasons.push(`${staleStationCount} station${staleStationCount === 1 ? '' : 's'} stale (>7 days)`);
  }

  return { status, reasons };
}
