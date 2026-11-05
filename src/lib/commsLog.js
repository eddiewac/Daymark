import { supabase, getCurrentUser } from './supabase.js';
import { isCommsType, sanitizeLabel, sanitizeUrl } from './commsLogModel.js';

// Own table, same membership idea as tasks. The project JSON is not the store.

function mapRow(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id || null,
    projectId: row.project_id || '',
    deliverableId: row.deliverable_id || '',
    stationId: row.station_id || '',
    type: row.type,
    authorId: row.author_id || '',
    at: row.at,
    url: row.url || '',
    label: row.label || '',
  };
}

const COLUMNS = 'id, workspace_id, project_id, deliverable_id, station_id, type, author_id, at, url, label';

export async function loadCommsLog(workspaceId) {
  const user = await getCurrentUser();
  if (!user) return [];

  let query = supabase.from('comms_log').select(COLUMNS).order('at', { ascending: false });
  if (workspaceId) query = query.eq('workspace_id', workspaceId);
  else query = query.is('workspace_id', null).eq('author_id', user.id);

  const { data, error } = await query;
  if (error) {
    console.error('loadCommsLog:', error);
    return [];
  }
  return (data || []).map(mapRow);
}

export async function insertCommsLog(entry, workspaceId) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in' };
  if (!entry?.id) return { ok: false, error: 'Comms Log entry is missing an id' };
  if (!isCommsType(entry.type)) return { ok: false, error: 'Pick chase, call, or decision' };

  const urlResult = sanitizeUrl(entry.url || '');
  if (!urlResult.ok) return { ok: false, error: urlResult.error };

  const row = {
    id: entry.id,
    workspace_id: workspaceId || null,
    project_id: entry.projectId || null,
    deliverable_id: entry.deliverableId || null,
    station_id: entry.stationId || null,
    type: entry.type,
    author_id: user.id,
    at: entry.at || new Date().toISOString(),
    url: urlResult.url || null,
    label: sanitizeLabel(entry.label) || null,
  };

  const { error } = await supabase.from('comms_log').insert(row);
  if (error) {
    console.error('insertCommsLog:', error);
    return { ok: false, error: error.message || 'Could not save to the Comms Log' };
  }
  return { ok: true, entry: mapRow(row) };
}

export async function deleteCommsForProject(projectId) {
  if (!projectId) return { ok: false, error: 'Missing project' };
  const { error } = await supabase.from('comms_log').delete().eq('project_id', projectId);
  if (error) {
    console.error('deleteCommsForProject:', error);
    return { ok: false, error: error.message || 'Could not remove Comms Log entries' };
  }
  return { ok: true };
}
