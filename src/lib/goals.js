import { supabase, getCurrentUser } from './supabase.js';

// ── Personal goals (legacy "objectives") ────────────────────────────────────
//
// Goals are strictly personal. They follow the user across all workspaces.
// Stored as a single JSON blob in app_storage keyed `${user.id}:goals-v1`.
//
// Shape:
//   {
//     goals: [
//       {
//         id, title, description, archived (bool),
//         createdAt (number, ms),
//         entries: [{ id, ts (number), text }]
//       }
//     ]
//   }

const GOALS_KEY_SUFFIX = 'goals-v1';

function goalsKey(user) {
  return `${user.id}:${GOALS_KEY_SUFFIX}`;
}

export async function loadGoals() {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('app_storage')
    .select('value')
    .eq('key', goalsKey(user))
    .maybeSingle();

  if (error || !data?.value) return [];

  try {
    const parsed = JSON.parse(data.value);
    return parsed.goals || [];
  } catch {
    return [];
  }
}

export async function saveGoals(goals) {
  const user = await getCurrentUser();
  if (!user) return;

  await supabase.from('app_storage').upsert(
    {
      key: goalsKey(user),
      value: JSON.stringify({ goals }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
}
