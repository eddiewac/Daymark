import { supabase, getCurrentUser } from './supabase.js';

// ── Workspace invites ───────────────────────────────────────────────────────
//
// Two viewpoints on this table:
//   1. As a workspace member, see who I've invited to MY workspaces (and
//      revoke invites that are still pending).
//   2. As any signed-in user, see invites where invited_email matches my
//      auth email so I can accept or ignore them.

// Send an invite for a given workspace + email
export async function inviteToWorkspace(workspaceId, email) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not signed in');

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid email address');
  }

  const { data, error } = await supabase
    .from('workspace_invites')
    .insert({
      workspace_id: workspaceId,
      invited_email: cleanEmail,
      invited_by: user.id,
    })
    .select()
    .single();

  if (error) {
    // Friendly message for the unique-constraint case
    if (error.code === '23505') {
      throw new Error('That email already has a pending invite.');
    }
    throw error;
  }

  return data;
}

// List all pending invites for the workspaces I'm a member of
export async function loadInvitesForWorkspace(workspaceId) {
  if (!workspaceId) return [];
  const { data, error } = await supabase
    .from('workspace_invites')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('loadInvitesForWorkspace:', error);
    return [];
  }
  return data || [];
}

// Revoke (delete) a pending invite
export async function revokeInvite(inviteId) {
  const { error } = await supabase
    .from('workspace_invites')
    .delete()
    .eq('id', inviteId);
  if (error) console.error('revokeInvite:', error);
}

// Load invites the current user has received (matched by their email).
// We can't JOIN workspaces directly because RLS blocks reading rows you're
// not a member of yet. Instead, we fetch the invites and resolve the name
// of each workspace via a SECURITY DEFINER RPC.
export async function loadMyPendingInvites() {
  const user = await getCurrentUser();
  if (!user?.email) return [];

  const { data, error } = await supabase
    .from('workspace_invites')
    .select('id, workspace_id, invited_email, created_at')
    .eq('invited_email', user.email.toLowerCase())
    .is('accepted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('loadMyPendingInvites:', error);
    return [];
  }

  // Resolve each workspace name through the RPC (parallel)
  const rows = data || [];
  const names = await Promise.all(
    rows.map((r) =>
      supabase
        .rpc('get_invited_workspace_name', { p_workspace_id: r.workspace_id })
        .then(({ data, error }) => (error ? null : data))
    )
  );

  return rows.map((r, i) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    workspaceName: names[i] || '(unknown workspace)',
    invitedEmail: r.invited_email,
    createdAt: r.created_at,
  }));
}

// Accept an invite. Calls a SECURITY DEFINER function that atomically:
//   1. Verifies the invite is for the current user's email
//   2. Adds them to workspace_members
//   3. Marks the invite accepted
// Doing this server-side avoids the issue where the workspace_members RLS
// requires you to already be a member before you can insert into it.
export async function acceptInvite(invite) {
  const { error } = await supabase.rpc('accept_workspace_invite', {
    invite_id: invite.id,
  });
  if (error) throw error;
  return true;
}

// Decline an invite (just delete it for now — no decline tracking)
export async function declineInvite(inviteId) {
  const { error } = await supabase
    .from('workspace_invites')
    .delete()
    .eq('id', inviteId);
  if (error) console.error('declineInvite:', error);
}
