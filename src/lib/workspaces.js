import { supabase, getCurrentUser } from './supabase.js';

export async function loadWorkspaces() {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(id, name, paid, trial_ends_at)')
    .eq('user_id', user.id);

  if (error || !data) return [];

  return data
    .filter((d) => d.workspaces)
    .map((d) => ({
      id: d.workspaces.id,
      name: d.workspaces.name,
      paid: d.workspaces.paid,
      trialEndsAt: d.workspaces.trial_ends_at,
    }));
}

export async function loadWorkspaceMembers(workspaceId) {
  if (!workspaceId) return [];
  const { data, error } = await supabase
    .from('workspace_members')
    .select('user_id, email')
    .eq('workspace_id', workspaceId);

  if (error || !data) return [];
  return data.map((d) => ({
    id: d.user_id,
    email: d.email || null,
  }));
}

export async function createWorkspace(name) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not signed in');

  const { data: ws, error: wsError } = await supabase
    .from('workspaces')
    .insert({ name, owner_id: user.id })
    .select()
    .single();

  if (wsError) throw wsError;

  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: ws.id,
      user_id: user.id,
      email: user.email,
    });

  if (memberError) throw memberError;

  return ws;
}

const ACTIVE_WS_KEY = 'daymark-active-workspace';

export function getStoredActiveWorkspaceId() {
  try {
    return localStorage.getItem(ACTIVE_WS_KEY);
  } catch {
    return null;
  }
}

export function setStoredActiveWorkspaceId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_WS_KEY, id);
    else localStorage.removeItem(ACTIVE_WS_KEY);
  } catch {
    // ignore
  }
}
