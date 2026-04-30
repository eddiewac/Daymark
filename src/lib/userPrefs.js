import { supabase, getCurrentUser } from './supabase.js';

// ── User-level preferences ──────────────────────────────────────────────────
//
// These are PER USER, not per workspace — settings that describe your personal
// workflow that should follow you across workspaces. Stored as a single JSON
// blob keyed `${user_id}:user-prefs-v1`.
//
// Add new fields here as needed; defaults below act as the baseline.

const KEY_SUFFIX = 'user-prefs-v1';

export const DEFAULT_USER_PREFS = {
  showPriorityBanner: true, // show "What's today's priority?" banner each morning
};

function prefsKey(user) {
  return `${user.id}:${KEY_SUFFIX}`;
}

export async function loadUserPrefs() {
  const user = await getCurrentUser();
  if (!user) return DEFAULT_USER_PREFS;

  const { data } = await supabase
    .from('app_storage')
    .select('value')
    .eq('key', prefsKey(user))
    .maybeSingle();

  if (!data?.value) return DEFAULT_USER_PREFS;

  try {
    const parsed = JSON.parse(data.value);
    return { ...DEFAULT_USER_PREFS, ...parsed };
  } catch {
    return DEFAULT_USER_PREFS;
  }
}

export async function saveUserPrefs(prefs) {
  const user = await getCurrentUser();
  if (!user) return;

  await supabase.from('app_storage').upsert(
    {
      key: prefsKey(user),
      value: JSON.stringify(prefs),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
}
