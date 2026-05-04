import {
  stationLastActivityAt,
  relativeTime,
  overdueComms,
  projectHealth,
} from './stations.js';

// Build a markdown handoff document for a project. Comprehensive enough that
// another PM could pick up the project without further context.
//
// Sections:
//   - Header (name, number, status, health)
//   - Snapshot (next steps, blockers)
//   - Deliverables → stations → recent comms
//   - Open tasks
//   - Done tasks (recent)
//   - Linked congresses
export function generateProjectHandoff(project, tasksAll) {
  const tasks = (tasksAll || []).filter((t) => t.project === project.name);
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done).sort((a, b) =>
    (b.doneAt || '').localeCompare(a.doneAt || '')
  );
  const health = projectHealth(project, tasks);

  const lines = [];
  const SEP = '\n---\n';

  lines.push(`# ${project.name || '(untitled project)'}`);
  if (project.number) lines.push(`Project number: ${project.number}`);
  if (project.status) lines.push(`Status: ${project.status}`);

  const healthEmoji =
    health.status === 'red' ? '🔴' : health.status === 'amber' ? '🟡' : '🟢';
  lines.push(`Health: ${healthEmoji} ${health.status.toUpperCase()}`);
  if (health.reasons.length > 0) {
    for (const r of health.reasons) lines.push(`  - ${r}`);
  }
  lines.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);

  if (project.nextSteps) {
    lines.push(SEP);
    lines.push('## Next steps');
    lines.push(project.nextSteps.trim());
  }

  if (project.blockers) {
    lines.push(SEP);
    lines.push('## Blockers');
    lines.push(project.blockers.trim());
  }

  // ── Deliverables and stations ────────────────────────────────────────────
  const delivs = project.deliverables || [];
  if (delivs.length > 0) {
    lines.push(SEP);
    lines.push('## Deliverables and stations');
    for (const d of delivs) {
      lines.push('');
      lines.push(`### ${d.name || '(unnamed deliverable)'}`);
      const stations = d.stations || [];
      if (stations.length === 0) {
        lines.push('_No stations defined_');
        continue;
      }
      for (const s of stations) {
        const status = s.done ? '✓ Done' : '· In progress';
        lines.push(`- **${s.name}** — ${status}`);
        if (s.targetDate) lines.push(`  - Target: ${s.targetDate}`);
        if (s.owner) lines.push(`  - Owner: ${s.owner}`);
        if (s.completedAt) {
          lines.push(`  - Completed ${new Date(s.completedAt).toISOString().slice(0, 10)}`);
        }
        const lastAct = stationLastActivityAt(s);
        if (lastAct && !s.done) {
          lines.push(`  - Last activity: ${relativeTime(lastAct)}`);
        }
        // Recent comms (most recent 3 per station)
        const comms = (s.comms || [])
          .slice()
          .sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0))
          .slice(0, 3);
        if (comms.length > 0) {
          lines.push(`  - Recent comms:`);
          for (const c of comms) {
            const sent = c.sentAt
              ? new Date(c.sentAt).toISOString().slice(0, 10)
              : '?';
            const replyState = c.replyReceived
              ? '✓ replied'
              : c.expectReplyBy
              ? `awaiting reply (expected ${c.expectReplyBy})`
              : 'awaiting reply';
            lines.push(`    - ${sent} — ${c.type} — ${replyState}`);
          }
        }
        // Overdue comms call-out
        const overdue = overdueComms(s);
        if (overdue.length > 0) {
          lines.push(`  - ⚠ ${overdue.length} reply${overdue.length === 1 ? '' : 'ies'} overdue`);
        }
        // Notes
        if (s.notes) {
          const trimmed = s.notes.trim();
          if (trimmed) {
            lines.push(`  - Notes: ${trimmed.split('\n').join(' / ')}`);
          }
        }
      }
    }
  }

  // ── Open tasks ───────────────────────────────────────────────────────────
  if (open.length > 0) {
    lines.push(SEP);
    lines.push(`## Open tasks (${open.length})`);
    // Group by station / no station
    const byStation = new Map();
    for (const t of open) {
      const key = t.stationId || '__none__';
      if (!byStation.has(key)) byStation.set(key, []);
      byStation.get(key).push(t);
    }
    // Resolve station names
    const stationNames = new Map();
    for (const d of delivs) {
      for (const s of d.stations || []) {
        stationNames.set(s.id, `${d.name} → ${s.name}`);
      }
    }
    for (const [stationId, sts] of byStation.entries()) {
      const groupName =
        stationId === '__none__'
          ? 'Unassigned to station'
          : stationNames.get(stationId) || '(unknown station)';
      lines.push('');
      lines.push(`### ${groupName}`);
      for (const t of sts) {
        const due = t.dueDate ? ` — due ${t.dueDate}` : '';
        const assignee = t.assignedToEmail ? ` — assigned to ${t.assignedToEmail}` : '';
        const oos = t.outOfScope ? ' — ⚠ OOS' : '';
        lines.push(`- ${t.title}${due}${assignee}${oos}`);
        if (t.outOfScope && t.outOfScopeNotes) {
          lines.push(`  - OOS notes: ${t.outOfScopeNotes}`);
        }
      }
    }
  }

  // ── Recent done tasks ────────────────────────────────────────────────────
  if (done.length > 0) {
    lines.push(SEP);
    lines.push(`## Recently completed (${Math.min(done.length, 10)} of ${done.length})`);
    for (const t of done.slice(0, 10)) {
      const completed = t.doneAt
        ? new Date(t.doneAt).toISOString().slice(0, 10)
        : '?';
      lines.push(`- ${t.title} — ${completed}`);
    }
  }

  // ── Congresses ───────────────────────────────────────────────────────────
  const congresses = project.congresses || [];
  if (congresses.length > 0) {
    lines.push(SEP);
    lines.push(`## Linked congresses (${congresses.length})`);
    for (const c of congresses) {
      const date = c.startDate || c.date || '?';
      lines.push(`- ${c.name || c.title || '(unnamed)'} — ${date}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}
