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

// Project groups: user-defined, named, coloured buckets for organising
// projects (e.g. all the work for one client) without the label having to
// reveal anything confidential. Each is { id, name, color }. Empty by
// default — the user creates their own in Settings.
const DEFAULT_PROJECT_GROUPS = [];

export const DEFAULT_SETTINGS = {
  categories: DEFAULT_CATEGORIES,
  priorities: DEFAULT_PRIORITIES,
  statuses: DEFAULT_STATUSES,
  reviewStages: DEFAULT_REVIEW_STAGES, // legacy field, kept for backward compat
  stationTemplates: DEFAULT_STATION_TEMPLATES,
  tagChecklists: DEFAULT_TAG_CHECKLISTS,
  projectGroups: DEFAULT_PROJECT_GROUPS,
  // Default working hours per day, used by the capacity email and the
  // Resource view's over-capacity flag. Each user/workspace can change it.
  dailyHours: 7.5,
};

// Personal rows must start with `{userId}:` (personal_storage).
// Team rows must start with `{workspaceId}:` (workspace_storage).
// The old team key `ws:{workspaceId}:settings-v1` matches neither policy, so
// PostgREST upsert returns 403 for every member. New writes use the key the
// existing policy already allows.
export function settingsStorageKey(user, workspaceId) {
  if (workspaceId) return `${String(workspaceId).toLowerCase()}:settings-v1`;
  return `${user.id}:settings-v1`;
}

function legacyWorkspaceSettingsKey(workspaceId) {
  return `ws:${workspaceId}:settings-v1`;
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

function parseSettings(value) {
  try {
    const parsed = JSON.parse(value);
    return migrate({ ...DEFAULT_SETTINGS, ...parsed });
  } catch {
    return null;
  }
}

async function readSettingsRow(key) {
  const { data, error } = await supabase
    .from('app_storage')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error || !data?.value) return null;
  return parseSettings(data.value);
}

export async function loadSettings(workspaceId) {
  const user = await getCurrentUser();
  if (!user) return DEFAULT_SETTINGS;

  const current = await readSettingsRow(settingsStorageKey(user, workspaceId));
  if (current) return current;

  // Rows saved before the key matched workspace_storage. Readable only if a
  // policy actually lets this member see them; otherwise we start from defaults.
  if (workspaceId) {
    const legacy = await readSettingsRow(legacyWorkspaceSettingsKey(workspaceId));
    if (legacy) return legacy;
  }

  return DEFAULT_SETTINGS;
}

export async function saveSettings(workspaceId, settings) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in' };

  const updatedAt = new Date().toISOString();
  const { error } = await supabase.from('app_storage').upsert(
    {
      key: settingsStorageKey(user, workspaceId),
      value: JSON.stringify(settings),
      updated_at: updatedAt,
    },
    { onConflict: 'key' }
  );
  if (error) {
    console.error('saveSettings:', error);
    return { ok: false, error };
  }
  return { ok: true, updatedAt };
}
