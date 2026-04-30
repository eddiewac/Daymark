import { supabase, getCurrentUser } from './supabase.js';

// ── Status rounds data layer ────────────────────────────────────────────────
//
// Schema: id, workspace_id (nullable), user_id, date, title, notes (freeform),
//         data jsonb { projects: [...] }, created_at, updated_at
//
// Each project entry in the data:
//   { project_id, rag, update, actions: [{ id, text, done, became_task_id }] }

function rowToRound(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    date: row.date,
    title: row.title || '',
    notes: row.notes || '',
    projects: row.data?.projects || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadStatusRounds(workspaceId) {
  const user = await getCurrentUser();
  if (!user) return [];

  let query = supabase
    .from('status_rounds')
    .select('*')
    .order('date', { ascending: false });

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  } else {
    query = query.is('workspace_id', null).eq('user_id', user.id);
  }

  const { data, error } = await query;
  if (error) {
    console.error('loadStatusRounds:', error);
    return [];
  }
  return (data || []).map(rowToRound);
}

export async function createStatusRound(workspaceId, round) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('status_rounds')
    .insert({
      workspace_id: workspaceId || null,
      user_id: user.id,
      date: round.date || new Date().toISOString().slice(0, 10),
      title: round.title || '',
      notes: round.notes || '',
      data: { projects: round.projects || [] },
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('createStatusRound:', error);
    return null;
  }
  return rowToRound(data);
}

export async function updateStatusRound(id, patch) {
  const updateRow = { updated_at: new Date().toISOString() };
  if (patch.date !== undefined) updateRow.date = patch.date;
  if (patch.title !== undefined) updateRow.title = patch.title;
  if (patch.notes !== undefined) updateRow.notes = patch.notes;

  // For projects updates, merge into data jsonb
  if (patch.projects !== undefined) {
    // Read existing data first to preserve any other keys we might add later
    const { data: existing } = await supabase
      .from('status_rounds')
      .select('data')
      .eq('id', id)
      .maybeSingle();
    updateRow.data = { ...(existing?.data || {}), projects: patch.projects };
  }

  const { data, error } = await supabase
    .from('status_rounds')
    .update(updateRow)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('updateStatusRound:', error);
    return null;
  }
  return rowToRound(data);
}

export async function deleteStatusRound(id) {
  const { error } = await supabase
    .from('status_rounds')
    .delete()
    .eq('id', id);
  if (error) console.error('deleteStatusRound:', error);
}
