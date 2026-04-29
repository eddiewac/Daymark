import { supabase, getCurrentUser } from './supabase.js';

const KEY_SUFFIX = 'daymark-notepad-v1';

export async function loadNotepad() {
  const user = await getCurrentUser();
  if (!user) return '';
  const { data, error } = await supabase
    .from('app_storage')
    .select('value')
    .eq('key', user.id + ':' + KEY_SUFFIX)
    .maybeSingle();
  if (error || !data) return '';
  try {
    const parsed = JSON.parse(data.value);
    return parsed.body || '';
  } catch {
    return data.value || '';
  }
}

export async function saveNotepad(body) {
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.from('app_storage').upsert(
    {
      key: user.id + ':' + KEY_SUFFIX,
      value: JSON.stringify({ body, updatedAt: Date.now() }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
}
