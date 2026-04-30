import { supabase, getCurrentUser } from './supabase.js';
import { todayStr } from './utils.js';

// ── Today's priority ────────────────────────────────────────────────────────
//
// Per-user, per-workspace daily history. One blob in app_storage keyed
// `${user_id}:${workspaceKey}:priority-history-v1` where workspaceKey is
// the workspace UUID, or 'personal' for the personal workspace.
//
// Shape:
//   {
//     "2026-04-30": {
//       primary: "taskId-abc",          // required when set
//       stretch: ["taskId-def", ...],   // 0-2 optional stretch goals
//       dismissed: false                 // user clicked × on banner today
//     },
//     "2026-04-29": { ... }
//   }
//
// We keep up to 30 days of history. Older entries are trimmed on save.

const KEY_SUFFIX = 'priority-history-v1';
const HISTORY_DAYS = 30;

function priorityKey(user, workspaceId) {
  const wsKey = workspaceId || 'personal';
  return `${user.id}:${wsKey}:${KEY_SUFFIX}`;
}

function trimHistory(history) {
  // Keep only the most recent HISTORY_DAYS entries
  const dates = Object.keys(history || {}).sort().reverse();
  const keep = dates.slice(0, HISTORY_DAYS);
  const trimmed = {};
  for (const d of keep) trimmed[d] = history[d];
  return trimmed;
}

export async function loadPriorityHistory(workspaceId) {
  const user = await getCurrentUser();
  if (!user) return {};

  const { data } = await supabase
    .from('app_storage')
    .select('value')
    .eq('key', priorityKey(user, workspaceId))
    .maybeSingle();

  if (!data?.value) return {};

  try {
    return JSON.parse(data.value) || {};
  } catch {
    return {};
  }
}

export async function savePriorityHistory(workspaceId, history) {
  const user = await getCurrentUser();
  if (!user) return;

  const trimmed = trimHistory(history);

  await supabase.from('app_storage').upsert(
    {
      key: priorityKey(user, workspaceId),
      value: JSON.stringify(trimmed),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
}

// ── Convenience getters ────────────────────────────────────────────────────
export function getTodayPriority(history) {
  return history?.[todayStr()] || null;
}
