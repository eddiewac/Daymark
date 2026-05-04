import { localDateStr } from './utils.js';

// ── Capacity helpers ────────────────────────────────────────────────────────
//
// `blocks` are time-tracking blocks from useTime: each has a `start` (ISO),
// `end` (ISO or null), `taskId`, `userId`, `workspaceId`.

const FALLBACK_DAILY_HOURS = 7.5;

function blockDurationHours(b) {
  if (!b.start || !b.end) return 0;
  const s = new Date(b.start).getTime();
  const e = new Date(b.end).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
  return (e - s) / 3600000;
}

function mondayOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  // Monday = 1, Sunday = 0; shift back to Monday
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return d;
}

// Average weekly hours from completed blocks over the last 4 calendar weeks.
// Falls back to dailyHours*5 if no recent history.
export function historicalAverageWeeklyHours(blocks, currentUserId, dailyHours = FALLBACK_DAILY_HOURS) {
  const now = Date.now();
  const fourWeeksAgo = now - 28 * 86400000;
  const recent = (blocks || []).filter((b) => {
    if (!b.start) return false;
    if (currentUserId && b.userId && b.userId !== currentUserId) return false;
    return new Date(b.start).getTime() >= fourWeeksAgo;
  });
  if (recent.length === 0) return Math.round(dailyHours * 5 * 10) / 10;

  // Group hours by Monday-week
  const byWeek = new Map();
  for (const b of recent) {
    const wkKey = localDateStr(mondayOf(b.start));
    byWeek.set(wkKey, (byWeek.get(wkKey) || 0) + blockDurationHours(b));
  }
  const totals = Array.from(byWeek.values());
  if (totals.length === 0) return Math.round(dailyHours * 5 * 10) / 10;
  const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
  return Math.round(avg * 10) / 10;
}

// Sum of estimates on tasks within a list (estimates may be missing/null)
export function sumEstimateHours(tasks) {
  return (tasks || []).reduce((sum, t) => {
    const h = Number(t.estimate);
    return sum + (Number.isFinite(h) ? h : 0);
  }, 0);
}

// ── Generate the capacity email body ────────────────────────────────────────
//
// Produces a plain-text email body summarising the chosen week's capacity.
// `weekTasks` = the open (not done) tasks scheduled for this week.
// `dayLabels` = ["Monday", "Tuesday", ...]
// `dayKeys`  = ["YYYY-MM-DD", ...] in same order
// `weekLabel` = e.g. "21 Apr – 25 Apr"
export function generateCapacityEmail({
  weekTasks,
  dayLabels,
  dayKeys,
  weekLabel,
  histAvg,
}) {
  const SEP = '\n─────────────────────────\n';
  const committedHrs = Math.round(sumEstimateHours(weekTasks) * 10) / 10;
  const availableHrs = Math.max(0, Math.round((histAvg - committedHrs) * 10) / 10);

  // Group by day (only days with tasks)
  const byDay = dayKeys
    .map((dk, i) => ({
      label: dayLabels[i],
      tasks: weekTasks.filter((t) => t.dueDate === dk),
    }))
    .filter((d) => d.tasks.length > 0);

  // Group by project
  const byProject = {};
  for (const t of weekTasks) {
    const p = t.project || 'General';
    if (!byProject[p]) byProject[p] = [];
    byProject[p].push(t);
  }

  const lines = [];
  lines.push('Hi team,');
  lines.push('');
  lines.push(`Here's my capacity summary for the week of ${weekLabel}.`);
  lines.push(SEP);
  lines.push('CAPACITY');
  lines.push(`Available: ~${histAvg}h (based on recent weeks)`);
  lines.push(`Scheduled: ~${committedHrs}h`);
  lines.push(`Headroom for ad hoc: ~${availableHrs}h`);

  if (Object.keys(byProject).length > 0) {
    lines.push(SEP);
    lines.push('PLANNED WORK');
    for (const [proj, ts] of Object.entries(byProject)) {
      lines.push('');
      lines.push(`${proj}:`);
      for (const t of ts) {
        const est = t.estimate ? ` (~${t.estimate}h)` : ' (TBC)';
        lines.push(`  • ${t.title}${est}`);
      }
    }
  }

  if (byDay.length > 0) {
    lines.push(SEP);
    lines.push('DAY BY DAY');
    for (const { label, tasks: dts } of byDay) {
      const dayHrs = Math.round(sumEstimateHours(dts) * 10) / 10;
      lines.push('');
      lines.push(label + (dayHrs ? ` (~${dayHrs}h)` : ''));
      for (const t of dts) {
        const est = t.estimate ? ` (${t.estimate}h)` : ' (TBC)';
        lines.push(`  • ${t.title}${est}`);
      }
    }
  }

  const withoutEst = weekTasks.filter((t) => !t.estimate);
  if (withoutEst.length > 0) {
    lines.push('');
    lines.push('TBC (no estimate yet):');
    for (const t of withoutEst) lines.push(`  • ${t.title}`);
  }

  lines.push('');
  lines.push('Let me know if anything needs reprioritising.');
  lines.push('');
  lines.push('Thanks');

  return {
    body: lines.join('\n'),
    subject: `Capacity summary — week of ${weekLabel}`,
    committedHrs,
    availableHrs,
  };
}
