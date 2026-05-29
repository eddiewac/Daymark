import { loadWorkspaces } from './workspaces.js';
import { loadTasks, loadAssignedTasks } from './tasks.js';
import { getCurrentUser, supabase } from './supabase.js';

// ── Cross-workspace resource data ───────────────────────────────────────────
//
// Stage 1 surfaces only the current user's own load — every task assigned to
// them, across every workspace they participate in, grouped by day.
//
// Two sources combine to give a complete picture:
//   1. Workspaces the user is a MEMBER OF — load each workspace's tasks via
//      loadTasks(workspaceId) and keep the ones assignedToId === me.
//   2. Workspaces the user is NOT a member of but where tasks are assigned to
//      them — loadAssignedTasks() already returns these, cross-workspace.
//
// Results are deduplicated by task id (a task assigned to you in a workspace
// you also belong to would otherwise appear twice) and tagged with their
// originating workspace so the UI can group / filter.

// Returns: an array of "entry" objects:
//   { task, workspaceId, workspaceName, source: 'member' | 'assigned' }
export async function loadMyResourceData() {
  const user = await getCurrentUser();
  if (!user) return { entries: [], workspaces: [] };

  const workspaces = await loadWorkspaces();

  // 1) Member workspaces — load each workspace's tasks, keep my assigned ones
  const memberResults = await Promise.all(
    workspaces.map(async (ws) => {
      const tasks = await loadTasks(ws.id);
      return tasks
        .filter((t) => t.assignedToId === user.id)
        .map((t) => ({
          task: t,
          workspaceId: ws.id,
          workspaceName: ws.name,
          source: 'member',
        }));
    })
  );
  const memberEntries = memberResults.flat();

  // 2) Cross-workspace assignments (workspaces I'm NOT in)
  const assigned = await loadAssignedTasks();
  const memberWsIds = new Set(workspaces.map((w) => w.id));
  const assignedEntries = assigned
    .filter((t) => !t.dismissed)
    // Skip ones already covered by memberEntries (same task id) — dedupe
    .filter((t) => !memberEntries.some((e) => e.task.id === t.id))
    // Skip ones from workspaces we're already a member of — handled above
    .filter((t) => !memberWsIds.has(t.workspaceId))
    .map((t) => ({
      task: t,
      workspaceId: t.workspaceId,
      workspaceName: t.assignedFrom || 'Other workspace',
      source: 'assigned',
    }));

  // ALSO include personal-scope tasks assigned to the user (workspace_id null,
  // user_id is the user). loadTasks(null) returns these.
  const personal = await loadTasks(null);
  const personalEntries = personal
    .filter((t) => t.assignedToId === user.id || !t.assignedToId)
    // For personal, assigned-to-self OR self-owned both count as "my work"
    .map((t) => ({
      task: t,
      workspaceId: null,
      workspaceName: 'Personal',
      source: 'member',
    }));

  return {
    entries: [...memberEntries, ...assignedEntries, ...personalEntries],
    workspaces,
  };
}

// ── Shared load (other people who've shared their workload with me) ──────────
//
// Calls the security-definer function get_shared_load(), which returns tasks
// assigned to people who've accepted a share with the current user, scoped to
// the workspaces they chose to share. The function enforces all the gating;
// here we just shape the rows for the grid.
//
// Returns an array of:
//   { sharerId, taskId, workspaceId, title, project, dueDate, estimate, done }
export async function loadSharedResourceData() {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc('get_shared_load');
  if (error) {
    console.error('loadSharedResourceData:', error);
    return [];
  }

  return (data || []).map((r) => ({
    sharerId: r.sharer_id,
    taskId: r.task_id,
    workspaceId: r.workspace_id,
    title: r.title,
    project: r.project,
    dueDate: r.due_date,
    estimate: r.estimate == null ? null : Number(r.estimate),
    done: r.done,
  }));
}
