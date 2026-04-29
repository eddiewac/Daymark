import { supabase, getCurrentUser } from './supabase.js';

// ── Time entries ─────────────────────────────────────────────────────────────
//
// We use a `time_entries` table with one row per (user, task, date).
// Columns: id, user_id, workspace_id (nullable), task_id, date (YYYY-MM-DD),
//          hours (numeric), data (jsonb), updated_at.
//
// The `data` jsonb is a free-form bucket for future fields without schema migrations.

export async function loadTimeEntries(workspaceId, fromDate, toDate) {
  const user = await getCurrentUser();
  if (!user) return [];

  let query = supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', user.id);

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  } else {
    query = query.is('workspace_id', null);
  }

  if (fromDate) query = query.gte('date', fromDate);
  if (toDate) query = query.lte('date', toDate);

  const { data, error } = await query;
  if (error) {
    console.error('loadTimeEntries:', error);
    return [];
  }
  return (data || []).map((row) => ({
    id: row.id,
    taskId: row.task_id,
    date: row.date,
    hours: parseFloat(row.hours) || 0,
    notes: row.data?.notes || '',
  }));
}

export async function setTimeEntry(workspaceId, taskId, date, hours, notes = '') {
  const user = await getCurrentUser();
  if (!user) return;

  // Use a deterministic id so upsert "merges" into the same row for that day/task.
  // This avoids having to query first to see if a row exists.
  const id = `${user.id}_${workspaceId || 'p'}_${taskId}_${date}`;

  if (!hours || hours <= 0) {
    // Clear out the row entirely
    const { error } = await supabase.from('time_entries').delete().eq('id', id);
    if (error) console.error('setTimeEntry delete:', error);
    return null;
  }

  const row = {
    id,
    user_id: user.id,
    workspace_id: workspaceId || null,
    task_id: taskId,
    date,
    hours,
    data: { notes },
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('time_entries')
    .upsert(row, { onConflict: 'id' });
  if (error) console.error('setTimeEntry upsert:', error);
  return id;
}

// Add hours to whatever is already on a given (task, date). Used by the timer
// when it stops — we just bump the existing total instead of overwriting.
export async function addTimeEntry(workspaceId, taskId, date, addHours) {
  const user = await getCurrentUser();
  if (!user) return;

  const id = `${user.id}_${workspaceId || 'p'}_${taskId}_${date}`;

  // Read existing
  const { data: existing } = await supabase
    .from('time_entries')
    .select('hours')
    .eq('id', id)
    .maybeSingle();

  const total = (parseFloat(existing?.hours) || 0) + addHours;

  return setTimeEntry(workspaceId, taskId, date, total);
}

// ── Running timer (single-row state) ────────────────────────────────────────
//
// A single row in `app_storage` keyed by `<user_id>:active-timer-v1` holds the
// currently-running timer. value is JSON: { taskId, workspaceId, startedAt }.

const TIMER_KEY_SUFFIX = 'active-timer-v1';

export async function loadRunningTimer() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('app_storage')
    .select('value')
    .eq('key', user.id + ':' + TIMER_KEY_SUFFIX)
    .maybeSingle();

  if (error || !data?.value) return null;
  try {
    const parsed = JSON.parse(data.value);
    if (!parsed.taskId || !parsed.startedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function startRunningTimer(taskId, workspaceId) {
  const user = await getCurrentUser();
  if (!user) return null;

  const state = {
    taskId,
    workspaceId: workspaceId || null,
    startedAt: Date.now(),
  };

  await supabase.from('app_storage').upsert(
    {
      key: user.id + ':' + TIMER_KEY_SUFFIX,
      value: JSON.stringify(state),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
  return state;
}

export async function clearRunningTimer() {
  const user = await getCurrentUser();
  if (!user) return;

  await supabase
    .from('app_storage')
    .delete()
    .eq('key', user.id + ':' + TIMER_KEY_SUFFIX);
}
