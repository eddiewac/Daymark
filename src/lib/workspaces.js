import { supabase, getCurrentUser } from './supabase.js';

export async function loadWorkspaces() {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('workspace_members')
    .select(
      'workspace_id, workspaces(id, name, paid, owner_id, trial_started_at, trial_ends_at, subscription_status, stripe_customer_id, stripe_subscription_id)'
    )
    .eq('user_id', user.id);

  if (error || !data) return [];

  return data
    .filter((d) => d.workspaces)
    .map((d) => ({
      id: d.workspaces.id,
      name: d.workspaces.name,
      paid: d.workspaces.paid,
      ownerId: d.workspaces.owner_id,
      trialStartedAt: d.workspaces.trial_started_at,
      trialEndsAt: d.workspaces.trial_ends_at,
      subscriptionStatus: d.workspaces.subscription_status,
      stripeCustomerId: d.workspaces.stripe_customer_id,
      stripeSubscriptionId: d.workspaces.stripe_subscription_id,
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

// Delete a workspace and ALL its data.
// Most tables cascade automatically via foreign keys (tasks, projects, notes,
// time_entries, congresses, status_rounds, workspace_members, workspace_invites).
// However, app_storage rows aren't linked by foreign key — they're keyed by
// string like `ws:{id}:settings-v1`, so we clean those up manually first.
export async function deleteWorkspace(workspaceId) {
  if (!workspaceId) throw new Error('Missing workspace id');

  // Clean up app_storage rows whose key starts with `ws:{workspaceId}:`
  // (covers settings, notepad blobs, anything else keyed this way)
  const prefix = `ws:${workspaceId}:`;
  const { error: storageError } = await supabase
    .from('app_storage')
    .delete()
    .like('key', `${prefix}%`);
  if (storageError) {
    console.error('deleteWorkspace app_storage cleanup:', storageError);
    // Don't abort — the workspace delete is the more important step.
  }

  // Now delete the workspace itself. Cascade handles the rest.
  const { error } = await supabase
    .from('workspaces')
    .delete()
    .eq('id', workspaceId);

  if (error) throw error;
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
