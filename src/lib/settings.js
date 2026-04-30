import { supabase, getCurrentUser } from './supabase.js';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_PRIORITIES,
  DEFAULT_STATUSES,
} from './constants.js';

const DEFAULT_REVIEW_STAGES = ['Draft 1', 'Internal review', 'Client review', 'Final'];

// New: named station templates. Each has a `name` and a `stages` array.
// First template is always treated as the default if none picked.
const DEFAULT_STATION_TEMPLATES = [
  { id: 'standard', name: 'Standard', stages: DEFAULT_REVIEW_STAGES },
];

// Tag → checklist of items. Tags are case-insensitive on lookup.
const DEFAULT_TAG_CHECKLISTS = {};

export const DEFAULT_SETTINGS = {
  categories: DEFAULT_CATEGORIES,
  priorities: DEFAULT_PRIORITIES,
  statuses: DEFAULT_STATUSES,
  reviewStages: DEFAULT_REVIEW_STAGES, // legacy field, kept for backward compat
  stationTemplates: DEFAULT_STATION_TEMPLATES,
  tagChecklists: DEFAULT_TAG_CHECKLISTS,
};

// Build the storage key. Personal workspace gets one key per user; team
// workspaces get a key per workspace so all members share the settings.
function settingsKey(user, workspaceId) {
  if (workspaceId) return `ws:${workspaceId}:settings-v1`;
  return `${user.id}:settings-v1`;
}

// Migrate legacy reviewStages to a stationTemplates list.
// Runs every load — idempotent: if stationTemplates already exists and is
// non-empty, we leave it alone.
function migrate(parsed) {
  if (Array.isArray(parsed.stationTemplates) && parsed.stationTemplates.length > 0) {
    return parsed;
  }
  // Use existing reviewStages if present, otherwise fall back to defaults
  const stages =
    Array.isArray(parsed.reviewStages) && parsed.reviewStages.length > 0
      ? parsed.reviewStages
      : DEFAULT_REVIEW_STAGES;
  return {
    ...parsed,
    stationTemplates: [{ id: 'standard', name: 'Standard', stages }],
  };
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
    return migrate({ ...DEFAULT_SETTINGS, ...parsed });
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
