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
  displayName: '', // how you appear to others (e.g. in the Resource view)
  focusModeOnStart: false, // open Focus Mode when a timer starts (opt-in)
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

// Resolve a display label for a person. Prefers an explicit display name,
// then the local-part of an email, then a short id, then a generic fallback.
// Used wherever a person is shown (Resource view, etc.).
export function displayName({ name, email, id } = {}) {
  if (name && name.trim()) return name.trim();
  if (email && email.includes('@')) return email.split('@')[0];
  if (email) return email;
  if (id) return id.slice(0, 8);
  return 'Unknown';
}
