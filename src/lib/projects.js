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

// Persist a project. Returns { ok, error } so callers can roll back instead of
// treating a swallowed PostgREST error as success.
//
// Existing rows are UPDATEd (not upserted). Upsert rewrites user_id to the
// current user and must also satisfy the INSERT policy, which fails silently
// for teammates editing a project they didn't create — the optimistic UI
// updates, reload shows the old row. Update keeps the owner's user_id.
// New projects (no row yet) fall through to insert.
export async function saveProject(project, workspaceId) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in' };
  if (!project?.id) return { ok: false, error: 'Project is missing an id' };

  const { id, ...data } = project;
  const updatedAt = new Date().toISOString();
  const payload = { ...data, updatedAt };
  const patch = {
    workspace_id: workspaceId || null,
    data: payload,
    updated_at: updatedAt,
  };

  const { data: updatedRows, error: updateError } = await supabase
    .from('projects')
    .update(patch)
    .eq('id', id)
    .select('id, data');

  if (updateError) {
    console.error('saveProject:', updateError);
    return { ok: false, error: updateError.message || 'Could not save project' };
  }
  if (updatedRows && updatedRows.length > 0) return { ok: true };

  const { error: insertError } = await supabase.from('projects').insert({
    id,
    user_id: user.id,
    ...patch,
  });
  if (!insertError) return { ok: true };

  // Update matched 0 rows (select hidden by RLS, or a race) and the row
  // already exists. If our payload landed, treat that as success.
  if (insertError.code === '23505') {
    const { data: row } = await supabase
      .from('projects')
      .select('data')
      .eq('id', id)
      .maybeSingle();
    if (row?.data?.updatedAt === updatedAt) return { ok: true };
  }

  console.error('saveProject:', insertError);
  return { ok: false, error: insertError.message || 'Project update did not persist' };
}

export async function deleteProject(projectId) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);
  if (error) console.error('deleteProject:', error);
}
