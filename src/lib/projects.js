import { supabase, getCurrentUser } from './supabase.js';

// ── Projects CRUD ────────────────────────────────────────────────────────────
//
// Same pattern as tasks: id, user_id, workspace_id, data (jsonb), updated_at.
// A project's `data` jsonb holds: name, number, status, nextSteps, blockers,
// startDate, deliverables (array), stations (array), congresses (array of ids).

export async function loadProjects(workspaceId) {
  const user = await getCurrentUser();
  if (!user) return [];

  let query = supabase.from('projects').select('*');
  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  } else {
    query = query.is('workspace_id', null).eq('user_id', user.id);
  }

  const { data, error } = await query;
  if (error) {
    console.error('loadProjects:', error);
    return [];
  }

  return (data || []).map((row) => ({
    ...row.data,
    id: row.id,
    // Defensive defaults so older saved projects still render
    deliverables: row.data?.deliverables || [],
    stations: row.data?.stations || [],
    congresses: row.data?.congresses || [],
  }));
}

export async function saveProject(project, workspaceId) {
  const user = await getCurrentUser();
  if (!user) return;

  const { id, ...data } = project;
  const row = {
    id,
    workspace_id: workspaceId || null,
    user_id: user.id,
    data: { ...data, updatedAt: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('projects')
    .upsert(row, { onConflict: 'id' });
  if (error) console.error('saveProject:', error);
}

export async function deleteProject(projectId) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);
  if (error) console.error('deleteProject:', error);
}
