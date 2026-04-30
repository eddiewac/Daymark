import { supabase } from './supabase.js';

// ── Account deletion ────────────────────────────────────────────────────────
//
// Calls SECURITY DEFINER server functions that handle deletion atomically.
// Preview returns what would happen (dry-run); delete actually does it.

export async function previewAccountDeletion() {
  const { data, error } = await supabase.rpc('preview_delete_my_account');
  if (error) throw error;
  return data;
}

export async function deleteMyAccount() {
  const { data, error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  return data;
}
