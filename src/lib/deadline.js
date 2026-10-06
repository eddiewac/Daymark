// ── Deadline urgency ─────────────────────────────────────────────────────────
// A single, shared notion of deadline urgency so tasks and stations colour the
// same way. Three states:
//   'overdue'  — the deadline has passed            → red
//   'soon'     — due within the next 7 days         → amber
//   'later'    — further out                        → neutral
//   null       — no deadline set
//
// `iso` is a yyyy-mm-dd date string. Comparison is date-only (ignores time).

export const DEADLINE_COLORS = {
  overdue: '#e24b4a',
  soon: '#ef9f27',
  later: 'var(--color-text-tertiary)',
};

export function deadlineUrgency(iso, withinDays = 7) {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return null;
  const diffDays = Math.round((d - today) / 86400000);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= withinDays) return 'soon';
  return 'later';
}

// The colour for a deadline, or null if none. Convenience over urgency+map.
export function deadlineColor(iso, withinDays = 7) {
  const u = deadlineUrgency(iso, withinDays);
  return u ? DEADLINE_COLORS[u] : null;
}

// Short label like "12 Jun" for a yyyy-mm-dd string.
export function fmtDeadline(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
