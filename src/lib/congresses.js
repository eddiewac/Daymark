import { supabase, getCurrentUser } from './supabase.js';

function rowToCongress(row) {
  const d = row.data || {};
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: d.name || '',
    abbr: d.abbr || '',
    ta: d.ta || '',
    color: d.color || '#534AB7',
    location: d.location || '',
    startDate: d.startDate || '',
    endDate: d.endDate || '',
    abstractDeadline: d.abstractDeadline || '',
    lateBreakingDeadline: d.lateBreakingDeadline || '',
    sourceVerified: d.sourceVerified || false,
    fromSuggestion: d.fromSuggestion || false,
    createdAt: row.created_at,
  };
}

export async function loadCongresses(workspaceId) {
  const user = await getCurrentUser();
  if (!user) return [];

  let query = supabase.from('congresses').select('*');
  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  } else {
    query = query.is('workspace_id', null).eq('user_id', user.id);
  }

  const { data, error } = await query;
  if (error) {
    console.error('loadCongresses:', error);
    return [];
  }
  return (data || []).map(rowToCongress);
}

export async function createCongress(workspaceId, congress) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('congresses')
    .insert({
      user_id: user.id,
      workspace_id: workspaceId || null,
      data: {
        name: congress.name || '',
        abbr: congress.abbr || '',
        ta: congress.ta || '',
        color: congress.color || '#534AB7',
        location: congress.location || '',
        startDate: congress.startDate || '',
        endDate: congress.endDate || '',
        abstractDeadline: congress.abstractDeadline || '',
        lateBreakingDeadline: congress.lateBreakingDeadline || '',
        sourceVerified: !!congress.sourceVerified,
        fromSuggestion: !!congress.fromSuggestion,
      },
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('createCongress:', error);
    return null;
  }
  return rowToCongress(data);
}

export async function updateCongress(id, patch) {
  const { data: existing } = await supabase
    .from('congresses')
    .select('data')
    .eq('id', id)
    .maybeSingle();

  const merged = { ...(existing?.data || {}), ...patch };

  const { data, error } = await supabase
    .from('congresses')
    .update({
      data: merged,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('updateCongress:', error);
    return null;
  }
  return rowToCongress(data);
}

export async function deleteCongress(id) {
  const { error } = await supabase.from('congresses').delete().eq('id', id);
  if (error) console.error('deleteCongress:', error);
}
