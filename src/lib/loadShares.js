import { supabase, getCurrentUser } from './supabase.js';

// ── Workload sharing (consent-based) ────────────────────────────────────────
//
// A viewer (e.g. a manager) invites someone by email to share their workload.
// The invitee accepts before anything is visible. Invites are stored by email
// because we can't safely look up an arbitrary user's id — the invitee
// resolves the invite to their own id when they accept (matching on their own
// login email, enforced by RLS via auth.email()).
//
// Row lifecycle:
//   invite  → { viewer_id: me, viewer_email: my email, sharer_email: their
//               email, sharer_id: null, status: 'pending' }
//   accept  → invitee stamps sharer_id = their id, sharer_name snapshot,
//             status = 'accepted', accepted_at = now
//   revoke/decline → status = 'revoked' (or row deleted)

// Invite someone (by email) to share their workload with me (the viewer).
export async function inviteToShare(sharerEmail) {
  const user = await getCurrentUser();
  if (!user) return { error: 'not signed in' };
  const email = (sharerEmail || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return { error: 'invalid email' };
  if (email === (user.email || '').toLowerCase()) {
    return { error: "that's your own email" };
  }

  const { error } = await supabase.from('load_shares').insert({
    viewer_id: user.id,
    viewer_email: user.email,
    sharer_email: email,
    status: 'pending',
  });

  if (error) {
    // Unique constraint (sharer_id, viewer_id) won't catch pending rows
    // (sharer_id is null), so guard duplicate pending invites in app logic.
    console.error('inviteToShare:', error);
    return { error: error.message };
  }
  return { ok: true };
}

// Everything relevant to the current user, in one call:
//   sharingWithMe   — accepted shares where I'm the viewer (rows for my grid)
//   pendingSent     — invites I've sent that aren't accepted yet
//   pendingReceived — invites addressed to my email that I haven't accepted
export async function loadMyShares() {
  const user = await getCurrentUser();
  if (!user) return { sharingWithMe: [], pendingSent: [], pendingReceived: [] };

  const myEmail = (user.email || '').toLowerCase();

  // RLS lets us see rows where we're viewer, accepted sharer, or the invite
  // is addressed to our email — so a single select returns all our rows.
  const { data, error } = await supabase.from('load_shares').select('*');
  if (error) {
    console.error('loadMyShares:', error);
    return { sharingWithMe: [], pendingSent: [], pendingReceived: [] };
  }

  const rows = data || [];
  const sharingWithMe = rows.filter(
    (r) => r.viewer_id === user.id && r.status === 'accepted'
  );
  const pendingSent = rows.filter(
    (r) => r.viewer_id === user.id && r.status === 'pending'
  );
  const pendingReceived = rows.filter(
    (r) =>
      r.status === 'pending' &&
      r.viewer_id !== user.id &&
      (r.sharer_email || '').toLowerCase() === myEmail
  );
  // Accepted shares where I'm the sharer — I control these, so I can edit
  // what they expose or stop sharing.
  const myActiveShares = rows.filter(
    (r) => r.sharer_id === user.id && r.status === 'accepted'
  );

  return { sharingWithMe, pendingSent, pendingReceived, myActiveShares };
}

// Accept an invite addressed to me: stamp my id + name, flip to accepted,
// and record what I chose to share.
//   shareAll = true  → all my workspaces (now and future)
//   shareAll = false → only workspaces marked true in `visibility`
export async function acceptShare(shareId, { myDisplayName, shareAll, visibility } = {}) {
  const user = await getCurrentUser();
  if (!user) return { error: 'not signed in' };

  const { error } = await supabase
    .from('load_shares')
    .update({
      sharer_id: user.id,
      sharer_name: (myDisplayName || '').trim() || null,
      sharer_email: user.email,
      status: 'accepted',
      share_all: !!shareAll,
      visibility: shareAll ? {} : (visibility || {}),
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', shareId);

  if (error) {
    console.error('acceptShare:', error);
    return { error: error.message };
  }
  return { ok: true };
}

// Update what an already-accepted share exposes (sharer changes their mind).
export async function updateShareVisibility(shareId, { shareAll, visibility } = {}) {
  const { error } = await supabase
    .from('load_shares')
    .update({
      share_all: !!shareAll,
      visibility: shareAll ? {} : (visibility || {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', shareId);

  if (error) {
    console.error('updateShareVisibility:', error);
    return { error: error.message };
  }
  return { ok: true };
}

// Decline an invite addressed to me (just remove the row).
export async function declineShare(shareId) {
  const { error } = await supabase.from('load_shares').delete().eq('id', shareId);
  if (error) {
    console.error('declineShare:', error);
    return { error: error.message };
  }
  return { ok: true };
}

// Revoke — either party removes an existing share / pending invite.
export async function revokeShare(shareId) {
  const { error } = await supabase.from('load_shares').delete().eq('id', shareId);
  if (error) {
    console.error('revokeShare:', error);
    return { error: error.message };
  }
  return { ok: true };
}
