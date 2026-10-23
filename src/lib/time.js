import { supabase, getCurrentUser } from './supabase.js';

// ── Block-based time entries ────────────────────────────────────────────────
//
// Schema:
//   id (uuid), user_id, workspace_id (nullable), task_id (text),
//   date (YYYY-MM-DD), started_at (timestamptz?), ended_at (timestamptz?),
//   hours (numeric), data (jsonb), created_at, updated_at
//
// Each row is one "block" of work. A task on a given day can have multiple
// blocks. Hours can either be derived from started_at/ended_at OR set manually
// (when blocks have no times — eg quick total entry).

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

  return (data || []).map(rowToBlock).filter((b) => !b.voided);
}

// Sum the CURRENT USER's logged hours per task, across ALL workspaces.
// Needed for budget-vs-actual: time logged on a team task from the personal
// workspace is tagged workspace_id=null, so the team workspace's normal query
// never sees it. This queries by task_id instead of workspace, so a team task's
// actual hours include time logged anywhere. Still owner-scoped (user_id),
// so it works within the owner-only RLS policy — it only ever sums YOUR time.
// Returns a map { [taskId]: totalHours }.
export async function loadTimeForTasks(taskIds) {
  const user = await getCurrentUser();
  if (!user || !taskIds || taskIds.length === 0) return {};

  const chunks = [];
  for (let i = 0; i < taskIds.length; i += 200) {
    chunks.push(taskIds.slice(i, i + 200));
  }

  const totals = {};
  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from('time_entries')
      .select('task_id, hours, data')
      .eq('user_id', user.id)
      .in('task_id', chunk);
    if (error) {
      console.error('loadTimeForTasks:', error);
      continue;
    }
    for (const row of data || []) {
      // Budget actuals are this user's hours only (query is user-scoped).
      // Voided rows stay in the table — undo never deletes time_entries —
      // but they must not count.
      if (row.data?.voided) continue;
      const h = parseFloat(row.hours) || 0;
      totals[row.task_id] = (totals[row.task_id] || 0) + h;
    }
  }
  return totals;
}

function rowToBlock(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    workspaceId: row.workspace_id,
    date: row.date,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    hours: parseFloat(row.hours) || 0,
    notes: row.data?.notes || '',
    outOfScope: !!row.data?.outOfScope,
    voided: !!row.data?.voided,
    createdAt: row.created_at,
  };
}

// Insert a new block.
//   block: { taskId, date, startedAt?, endedAt?, hours?, notes? }
// If startedAt + endedAt are both set, hours is computed from them.
export async function createTimeBlock(workspaceId, block) {
  const user = await getCurrentUser();
  if (!user) return null;

  const computedHours =
    block.startedAt && block.endedAt
      ? Math.max(
          0,
          (new Date(block.endedAt) - new Date(block.startedAt)) / 3600000
        )
      : block.hours || 0;

  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      user_id: user.id,
      workspace_id: workspaceId || null,
      task_id: block.taskId,
      date: block.date,
      started_at: block.startedAt || null,
      ended_at: block.endedAt || null,
      hours: computedHours,
      data: { notes: block.notes || '', outOfScope: !!block.outOfScope },
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('createTimeBlock:', error);
    return null;
  }
  return rowToBlock(data);
}

// Update an existing block. Pass through the patch — recomputes hours if needed.
export async function updateTimeBlock(blockId, patch) {
  const updateRow = { updated_at: new Date().toISOString() };
  if (patch.startedAt !== undefined) updateRow.started_at = patch.startedAt;
  if (patch.endedAt !== undefined) updateRow.ended_at = patch.endedAt;
  if (patch.date !== undefined) updateRow.date = patch.date;

  // The `data` jsonb blob holds notes + outOfScope. When either changes we must
  // MERGE into the existing blob, not replace it — otherwise editing notes would
  // wipe the OOS flag (and vice versa). Fetch current data first, then merge.
  const touchesData =
    patch.notes !== undefined || patch.outOfScope !== undefined || patch.voided !== undefined;
  let currentData = null;
  if (touchesData) {
    const { data: cur } = await supabase
      .from('time_entries')
      .select('data')
      .eq('id', blockId)
      .maybeSingle();
    currentData = cur?.data || {};
    const merged = { ...currentData };
    if (patch.notes !== undefined) merged.notes = patch.notes;
    if (patch.outOfScope !== undefined) merged.outOfScope = !!patch.outOfScope;
    if (patch.voided !== undefined) merged.voided = !!patch.voided;
    updateRow.data = merged;
  }

  if (patch.hours !== undefined) {
    updateRow.hours = patch.hours;
  } else if (patch.startedAt !== undefined || patch.endedAt !== undefined) {
    const { data: cur } = await supabase
      .from('time_entries')
      .select('started_at, ended_at')
      .eq('id', blockId)
      .maybeSingle();
    const s = patch.startedAt !== undefined ? patch.startedAt : cur?.started_at;
    const e = patch.endedAt !== undefined ? patch.endedAt : cur?.ended_at;
    if (s && e) {
      updateRow.hours = Math.max(0, (new Date(e) - new Date(s)) / 3600000);
    }
  }

  const { data, error } = await supabase
    .from('time_entries')
    .update(updateRow)
    .eq('id', blockId)
    .select()
    .single();

  if (error) {
    console.error('updateTimeBlock:', error);
    return null;
  }
  return rowToBlock(data);
}

export async function deleteTimeBlock(blockId) {
  const { error } = await supabase
    .from('time_entries')
    .delete()
    .eq('id', blockId);
  if (error) console.error('deleteTimeBlock:', error);
}

// ── Running timer ────────────────────────────────────────────────────────────
const TIMER_KEY_SUFFIX = 'active-timer-v1';

export async function loadRunningTimer() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await supabase
    .from('app_storage')
    .select('value')
    .eq('key', user.id + ':' + TIMER_KEY_SUFFIX)
    .maybeSingle();
  if (!data?.value) return null;
  try {
    const parsed = JSON.parse(data.value);
    if (!parsed.taskId || !parsed.startedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function startRunningTimer(taskId, workspaceId, meta = {}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const state = {
    taskId,
    workspaceId: workspaceId || null,
    startedAt: Date.now(),
    taskTitle: meta.taskTitle || '',
    projectName: meta.projectName || '',
  };
  const { error } = await supabase.from('app_storage').upsert(
    {
      key: user.id + ':' + TIMER_KEY_SUFFIX,
      value: JSON.stringify(state),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
  if (error) {
    console.error('startRunningTimer:', error);
    return null;
  }
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
