import { supabase, getCurrentUser } from './supabase.js';

// Notes use the same row pattern as tasks/projects:
//   id, user_id, workspace_id (null = personal), data (jsonb), updated_at
// data shape: {
//   title, body, projectId, projectName, taskIds[], createdAt, updatedAt
// }
// taskIds is an array of task ids this note is linked to (multi-tag).

// Loads BOTH personal and team notes when in a team workspace.
// In personal workspace, only personal notes.
export async function loadNotes(workspaceId) {
  const user = await getCurrentUser();
  if (!user) return { personal: [], team: [] };

  // Always load personal notes
  const { data: personalRows, error: personalErr } = await supabase
    .from('notes')
    .select('*')
    .is('workspace_id', null)
    .eq('user_id', user.id);

  if (personalErr) console.error('loadNotes personal:', personalErr);

  let teamRows = [];
  if (workspaceId) {
    const { data: tr, error: te } = await supabase
      .from('notes')
      .select('*')
      .eq('workspace_id', workspaceId);
    if (te) console.error('loadNotes team:', te);
    teamRows = tr || [];
  }

  const mapRow = (r) => ({
    ...r.data,
    id: r.id,
    workspaceId: r.workspace_id,
    userId: r.user_id,
  });

  return {
    personal: (personalRows || []).map(mapRow),
    team: teamRows.map(mapRow),
  };
}

export async function saveNote(note, isTeam, workspaceId) {
  const user = await getCurrentUser();
  if (!user) return;

  const { id, ...data } = note;
  const row = {
    id,
    user_id: user.id,
    workspace_id: isTeam ? workspaceId || null : null,
    data: { ...data, updatedAt: Date.now() },
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('notes')
    .upsert(row, { onConflict: 'id' });
  if (error) console.error('saveNote:', error);
}

export async function deleteNote(noteId) {
  const { error } = await supabase.from('notes').delete().eq('id', noteId);
  if (error) console.error('deleteNote:', error);
}

// Move a note between personal <-> team scopes.
// We keep the same id and just change workspace_id.
export async function moveNote(note, toTeam, workspaceId) {
  const { id, ...data } = note;
  const row = {
    id,
    workspace_id: toTeam ? workspaceId || null : null,
    data: { ...data, updatedAt: Date.now() },
    updated_at: new Date().toISOString(),
  };
  // We don't change user_id - the original creator stays the owner
  const { error } = await supabase
    .from('notes')
    .update({
      workspace_id: row.workspace_id,
      data: row.data,
      updated_at: row.updated_at,
    })
    .eq('id', id);
  if (error) console.error('moveNote:', error);
}
