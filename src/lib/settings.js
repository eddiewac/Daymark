import { supabase, getCurrentUser } from './supabase.js';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_PRIORITIES,
  DEFAULT_STATUSES,
} from './constants.js';

const DEFAULT_REVIEW_STAGES = ['Draft 1', 'Internal review', 'Client review', 'Final'];

// Tag → checklist of items. Tags are case-insensitive on lookup.
const DEFAULT_TAG_CHECKLISTS = {};

export const DEFAULT_SETTINGS = {
  categories: DEFAULT_CATEGORIES,
  priorities: DEFAULT_PRIORITIES,
  statuses: DEFAULT_STATUSES,
  reviewStages: DEFAULT_REVIEW_STAGES,
  tagChecklists: DEFAULT_TAG_CHECKLISTS, // shape: { tag: [item1, item2, ...] }
};

// Build the storage key. Personal workspace gets one key per user; team
// workspaces get a key per workspace so all members share the settings.
function settingsKey(user, workspaceId) {
  if (workspaceId) return `ws:${workspaceId}:settings-v1`;
  return `${user.id}:settings-v1`;
}

export async function loadSettings(workspaceId) {
  const user = await getCurrentUser();
  if (!user) return DEFAULT_SETTINGS;

  const { data, error } = await supabase
    .from('app_storage')
    .select('value')
    .eq('key', settingsKey(user, workspaceId))
    .maybeSingle();

  if (error || !data?.value) return DEFAULT_SETTINGS;

  try {
    const parsed = JSON.parse(data.value);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(workspaceId, settings) {
  const user = await getCurrentUser();
  if (!user) return;

  await supabase.from('app_storage').upsert(
    {
      key: settingsKey(user, workspaceId),
      value: JSON.stringify(settings),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
}
