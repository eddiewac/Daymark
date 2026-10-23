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
  if (!user) return { ok: false, error: 'Not signed in' };

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
  if (error) {
    console.error('saveTask:', error);
    return { ok: false, error: error.message || 'Could not save task' };
  }
  return { ok: true };
}

export async function deleteTask(taskId) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) console.error('deleteTask:', error);
}

export async function toggleTaskDone(taskId, done, doneAt) {
  const { data: existing, error: readError } = await supabase
    .from('tasks')
    .select('data')
    .eq('id', taskId)
    .maybeSingle();

  if (readError) {
    console.error('toggleTaskDone:', readError);
    return { ok: false, error: readError.message || 'Could not read task' };
  }
  if (!existing) return { ok: false, error: 'Task not found' };

  // Merge into the existing jsonb. Never write data: null — that wipes the task.
  const updatedData = { ...(existing.data || {}), done, doneAt };

  const { data, error } = await supabase
    .from('tasks')
    .update({
      done,
      done_at: doneAt,
      data: updatedData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select('id');

  if (error) {
    console.error('toggleTaskDone:', error);
    return { ok: false, error: error.message || 'Could not update task' };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Task update did not persist' };
  }
  return { ok: true };
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

  const drafts = data.map((a) => {
    let snapshot = {};
    let parsedOk = false;
    try {
      const parsed = JSON.parse(a.task_snapshot || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        snapshot = parsed;
        parsedOk = true;
      }
    } catch {
      snapshot = {};
    }
    // Prefer fresh task data, fall back to snapshot if the task was deleted
    // or RLS hides it (assignee is not a member of the team workspace).
    const fresh = freshById[a.task_id] || null;
    const base = fresh || snapshot;
    const projectId = cleanLabel(base.projectId) || cleanLabel(snapshot.projectId);
    return { a, snapshot, parsedOk, fresh, base, projectId };
  });

  const needsLookup = drafts
    .filter((d) => !explicitProjectName(d.fresh) && !explicitProjectName(d.snapshot) && d.projectId)
    .map((d) => d.projectId);
  const nameById = await projectNamesById(needsLookup);

  const stamps = [];
  const rows = drafts.map((d) => {
    // projectName, else id→name when that project is readable, else the
    // legacy name on `project`. Never a workspace name or a placeholder.
    let projectName = explicitProjectName(d.fresh) || explicitProjectName(d.snapshot);
    if (!projectName && d.projectId) projectName = nameById[d.projectId] || '';
    if (!projectName) projectName = legacyProjectName(d.fresh) || legacyProjectName(d.snapshot);
    if (projectName && d.parsedOk && explicitProjectName(d.snapshot) !== projectName) {
      stamps.push(
        supabase
          .from('assignments')
          .update({
            task_snapshot: JSON.stringify({ ...d.snapshot, projectName }),
            updated_at: new Date().toISOString(),
          })
          .eq('id', d.a.id)
          .then(({ error: stampError }) => {
            if (stampError) console.error('stamp projectName:', stampError);
          })
      );
    }
    return {
      ...d.base,
      ...(projectName ? { projectName } : {}),
      id: d.a.task_id,
      assignmentId: d.a.id,
      workspaceId: d.a.workspace_id,
      assignedFrom: d.a.workspace_name,
      assignedBy: d.a.assigned_by,
      assignedAt: d.a.created_at,
      isAssigned: true,
      dismissed: !!d.a.dismissed,
    };
  });

  if (stamps.length > 0) Promise.allSettled(stamps);

  return rows;
}

function cleanLabel(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function explicitProjectName(task) {
  return cleanLabel(task?.projectName);
}

function legacyProjectName(task) {
  return cleanLabel(task?.project);
}

// Names for project ids the current user can read. Missing rows stay absent
// so callers do not substitute a made-up label.
async function projectNamesById(ids) {
  const unique = [...new Set((ids || []).map((id) => cleanLabel(id)).filter(Boolean))];
  if (unique.length === 0) return {};
  const { data, error } = await supabase.from('projects').select('id, data').in('id', unique);
  if (error || !data) return {};
  const map = {};
  for (const row of data) {
    const name = cleanLabel(row.data?.name);
    if (name) map[row.id] = name;
  }
  return map;
}

async function resolveProjectName(task) {
  const explicit = explicitProjectName(task);
  if (explicit) return explicit;
  const id = cleanLabel(task?.projectId);
  if (id) {
    const map = await projectNamesById([id]);
    if (map[id]) return map[id];
  }
  return legacyProjectName(task);
}

async function stampTaskProjectName(taskId, projectName) {
  if (!taskId || !projectName) return;
  const { data: existing, error: readError } = await supabase
    .from('tasks')
    .select('data')
    .eq('id', taskId)
    .maybeSingle();
  if (readError || !existing) return;
  if (explicitProjectName(existing.data) === projectName) return;
  const { error } = await supabase
    .from('tasks')
    .update({
      data: { ...(existing.data || {}), projectName },
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);
  if (error) console.error('stampTaskProjectName:', error);
}

export async function assignTask(task, assigneeId, workspaceId, workspaceName) {
  const user = await getCurrentUser();
  if (!user) return;

  const projectName = await resolveProjectName(task);
  const snapshotTask = projectName ? { ...task, projectName } : { ...task };

  const { data: existing } = await supabase
    .from('assignments')
    .select('id, task_snapshot')
    .eq('task_id', task.id)
    .eq('assigned_to', assigneeId)
    .maybeSingle();

  if (existing) {
    if (projectName) {
      let prev = {};
      let parsedOk = false;
      try {
        const parsed = JSON.parse(existing.task_snapshot || '{}');
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          prev = parsed;
          parsedOk = true;
        }
      } catch {
        parsedOk = false;
      }
      if (parsedOk && explicitProjectName(prev) !== projectName) {
        const { error: healError } = await supabase
          .from('assignments')
          .update({
            task_snapshot: JSON.stringify({ ...prev, projectName }),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (healError) console.error('assignTask projectName:', healError);
      }
      await stampTaskProjectName(task.id, projectName);
    }
    return;
  }

  const { error } = await supabase.from('assignments').insert({
    task_id: task.id,
    workspace_id: workspaceId,
    workspace_name: workspaceName,
    assigned_to: assigneeId,
    assigned_by: user.id,
    task_snapshot: JSON.stringify(snapshotTask),
  });

  if (error) console.error('assignTask:', error);
  else if (projectName) await stampTaskProjectName(task.id, projectName);
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
