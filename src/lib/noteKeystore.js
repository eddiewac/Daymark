// ── noteKeystore.js ──────────────────────────────────────────────────────────
// Loads/saves the confidential-notes keystore (the wrapped master key + salts)
// for the current user. Personal-scoped, stored in app_storage as ciphertext
// only — it never contains plaintext keys, passphrases or note content.
//
// Same app_storage pattern as userPrefs.js: key = `${user.id}:suffix`,
// value = JSON string.

import { supabase, getCurrentUser } from './supabase.js';

const KEY_SUFFIX = 'note-keystore-v1';
const ksKey = (user) => `${user.id}:${KEY_SUFFIX}`;

// Returns the stored keystore object, or null if the user hasn't enrolled.
export async function loadKeystore() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('app_storage')
    .select('value')
    .eq('key', ksKey(user))
    .maybeSingle();
  if (error) {
    console.error('loadKeystore:', error);
    return null;
  }
  if (!data?.value) return null;
  try {
    return JSON.parse(data.value);
  } catch {
    return null;
  }
}

// Persists the keystore object. Returns { ok, error } so the caller can surface
// a failure instead of silently believing enrolment succeeded.
export async function saveKeystore(keystore) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in' };
  const { error } = await supabase.from('app_storage').upsert(
    {
      key: ksKey(user),
      value: JSON.stringify(keystore),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
  if (error) {
    console.error('saveKeystore:', error);
    return { ok: false, error: error.message || 'Could not save keystore' };
  }
  return { ok: true };
}
