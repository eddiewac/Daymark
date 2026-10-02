import { supabase, getCurrentUser } from './supabase.js';

// ── Task CRUD ────────────────────────────────────────────────────────────────
//
// Tasks are stored in the `tasks` table with columns:
//   id (text, primary key), user_id (uuid), workspace_id (uuid nullable),
//   data (jsonb), done (boolean), done_at (timestamp), updated_at
//
// The `data` jsonb holds the entire task object. `done` is duplicated as a
// column so we can filter/index it. `workspace_id` is null for personal tasks.

export async function loadTasks(workspaceId) {
  const user = await getCurrentUser();
  if (!user) return [];

  let query = supabase.from('tasks').select('*');
  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  } else {
    // Personal tasks: workspace_id IS NULL and belong to me
    query = query.is('workspace_id', null).eq('user_id', user.id);
  }

  const { data, error } = await query;
  if (error) {
    console.error('loadTasks:', error);
    return [];
  }

  return (data || []).map((row) => ({
    ...row.data,
    id: row.id,
    done: row.done,
    doneAt: row.done_at,
  }));
}

export async function saveTask(task, workspaceId) {
  const user = await getCurrentUser();
  if (!user) return;

  const row = {
    id: task.id,
    user_id: user.id,
    workspace_id: workspaceId || null,
    data: task,
    done: !!task.done,
    done_at: task.doneAt || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('tasks').upsert(row, { onConflict: 'id' });
  if (error) console.error('saveTask:', error);
}

export async function deleteTask(taskId) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) console.error('deleteTask:', error);
}

export async function toggleTaskDone(taskId, done, doneAt) {
  const { data: existing } = await supabase
    .from('tasks')
    .select('data')
    .eq('id', taskId)
    .maybeSingle();

  const updatedData = existing?.data
    ? { ...existing.data, done, doneAt }
    : null;

  const { error } = await supabase
    .from('tasks')
    .update({
      done,
      done_at: doneAt,
      data: updatedData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) console.error('toggleTaskDone:', error);
}

// ── Assignments ──────────────────────────────────────────────────────────────
//
// Assignments are a separate table that lets a user see tasks assigned to them
// from team workspaces they aren't members of. Each row contains a JSON
// snapshot of the task at the time of assignment.

export async function loadAssignedTasks() {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('assigned_to', user.id);

  if (error || !data || data.length === 0) return [];

  // Fetch fresh task rows so done/title/etc are not stale snapshots
  const taskIds = data.map((a) => a.task_id);
  const { data: freshTasks } = await supabase
    .from('tasks')
    .select('*')
    .in('id', taskIds);

  const freshById = {};
  (freshTasks || []).forEach((row) => {
    freshById[row.id] = {
      ...row.data,
      id: row.id,
      done: row.done,
      doneAt: row.done_at,
    };
  });

  return data.map((a) => {
    let snapshot = {};
    try {
      snapshot = JSON.parse(a.task_snapshot || '{}');
    } catch {
      snapshot = {};
    }
    // Prefer fresh task data, fall back to snapshot if the task was deleted
    const fresh = freshById[a.task_id] || snapshot;
    return {
      ...fresh,
      id: a.task_id,
      assignmentId: a.id,
      workspaceId: a.workspace_id,
      assignedFrom: a.workspace_name,
      assignedBy: a.assigned_by,
      assignedAt: a.created_at,
      isAssigned: true,
      dismissed: !!a.dismissed,
    };
  });
}

export async function assignTask(task, assigneeId, workspaceId, workspaceName) {
  const user = await getCurrentUser();
  if (!user) return;

  // Avoid duplicate assignments
  const { data: existing } = await supabase
    .from('assignments')
    .select('id')
    .eq('task_id', task.id)
    .eq('assigned_to', assigneeId)
    .maybeSingle();
  if (existing) return;

  const { error } = await supabase.from('assignments').insert({
    task_id: task.id,
    workspace_id: workspaceId,
    workspace_name: workspaceName,
    assigned_to: assigneeId,
    assigned_by: user.id,
    task_snapshot: JSON.stringify(task),
  });

  if (error) console.error('assignTask:', error);
}

export async function unassignTask(taskId, assigneeId) {
  let q = supabase.from('assignments').delete().eq('task_id', taskId);
  if (assigneeId) q = q.eq('assigned_to', assigneeId);
  const { error } = await q;
  if (error) console.error('unassignTask:', error);
}

export async function dismissAssignment(assignmentId) {
  const { error } = await supabase
    .from('assignments')
    .update({ dismissed: true })
    .eq('id', assignmentId);
  if (error) console.error('dismissAssignment:', error);
}
