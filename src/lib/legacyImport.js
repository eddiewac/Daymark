import { supabase, getCurrentUser } from './supabase.js';
import { saveTask } from './tasks.js';
import { saveProject } from './projects.js';
import { saveNote } from './notes.js';
import { saveSettings, loadSettings } from './settings.js';
import { saveGoals } from './goals.js';
import { uid } from './utils.js';

// ── Legacy JSON import ──────────────────────────────────────────────────────
//
// Takes a parsed legacy-shape JSON object and imports it into the current
// workspace (and personal data for goals). Replace semantics: existing data
// of the imported types in the current workspace is wiped first.
//
// Returns a summary { imported: { tasks, projects, notes, ... }, skipped: [...] }

// Inspect the JSON and return what we'd import
export function describeImport(data) {
  const counts = {
    tasks: Array.isArray(data?.tasks) ? data.tasks.length : 0,
    projects: Array.isArray(data?.projects) ? data.projects.length : 0,
    notes: Array.isArray(data?.notes) ? data.notes.length : 0,
    categories: Array.isArray(data?.categories) ? data.categories.length : 0,
    priorities: Array.isArray(data?.priorities) ? data.priorities.length : 0,
    tagChecklists: data?.tagChecklists
      ? Object.keys(data.tagChecklists).length
      : 0,
    objectives: Array.isArray(data?.objectives) ? data.objectives.length : 0,
  };
  const skipped = [];
  if (data?.timesheetEntries || data?.dailyHours) {
    skipped.push('Time entries (legacy used hours-per-day; new system uses time blocks).');
  }
  if (data?.tags) {
    skipped.push('Tag list (tags now live on individual tasks; checklists imported separately).');
  }
  return { counts, skipped };
}

export async function importLegacyJson(data, workspaceId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not signed in');

  const result = {
    imported: {
      tasks: 0,
      projects: 0,
      notes: 0,
      categories: 0,
      priorities: 0,
      tagChecklists: 0,
      objectives: 0,
    },
    errors: [],
  };

  // ── Replace existing data of the imported types in this workspace ─────────
  // We do these as targeted deletes so we don't wipe other users' team data.

  if (Array.isArray(data?.tasks)) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', user.id)
      .or(
        workspaceId
          ? `workspace_id.eq.${workspaceId}`
          : `workspace_id.is.null`
      );
    if (error) result.errors.push(`Wipe tasks: ${error.message}`);
  }

  if (Array.isArray(data?.projects)) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('user_id', user.id)
      .or(
        workspaceId
          ? `workspace_id.eq.${workspaceId}`
          : `workspace_id.is.null`
      );
    if (error) result.errors.push(`Wipe projects: ${error.message}`);
  }

  if (Array.isArray(data?.notes)) {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('user_id', user.id)
      .or(
        workspaceId
          ? `workspace_id.eq.${workspaceId}`
          : `workspace_id.is.null`
      );
    if (error) result.errors.push(`Wipe notes: ${error.message}`);
  }

  // ── Insert projects first so tasks can reference them by name ───────────
  if (Array.isArray(data?.projects)) {
    for (const p of data.projects) {
      try {
        const project = mapProject(p);
        await saveProject(project, workspaceId);
        result.imported.projects++;
      } catch (e) {
        result.errors.push(`Project "${p.name}": ${e.message}`);
      }
    }
  }

  // ── Tasks ───────────────────────────────────────────────────────────────
  if (Array.isArray(data?.tasks)) {
    for (const t of data.tasks) {
      try {
        const task = mapTask(t);
        await saveTask(task, workspaceId);
        result.imported.tasks++;
      } catch (e) {
        result.errors.push(`Task "${t.title}": ${e.message}`);
      }
    }
  }

  // ── Notes ───────────────────────────────────────────────────────────────
  if (Array.isArray(data?.notes)) {
    for (const n of data.notes) {
      try {
        const note = mapNote(n);
        // Legacy notes are personal-scope; new system has personal vs team.
        // We import all as personal scope (isTeam=false).
        await saveNote(note, false, workspaceId);
        result.imported.notes++;
      } catch (e) {
        result.errors.push(`Note: ${e.message}`);
      }
    }
  }

  // ── Settings (categories, priorities, tagChecklists) ────────────────────
  const hasSettingsData =
    Array.isArray(data?.categories) ||
    Array.isArray(data?.priorities) ||
    data?.tagChecklists;
  if (hasSettingsData) {
    const current = await loadSettings(workspaceId);
    const next = { ...current };
    if (Array.isArray(data.categories) && data.categories.length > 0) {
      next.categories = data.categories;
      result.imported.categories = data.categories.length;
    }
    if (Array.isArray(data.priorities) && data.priorities.length > 0) {
      next.priorities = data.priorities;
      result.imported.priorities = data.priorities.length;
    }
    if (data.tagChecklists && typeof data.tagChecklists === 'object') {
      next.tagChecklists = data.tagChecklists;
      result.imported.tagChecklists = Object.keys(data.tagChecklists).length;
    }
    await saveSettings(workspaceId, next);
  }

  // ── Goals (legacy "objectives") — personal, not workspace ──────────────
  if (Array.isArray(data?.objectives)) {
    const goals = data.objectives.map((o) => ({
      id: o.id || uid(),
      title: o.title || '',
      description: o.description || '',
      archived: !!o.archived,
      createdAt: o.createdAt || Date.now(),
      entries: Array.isArray(o.entries)
        ? o.entries.map((e) => ({
            id: e.id || uid(),
            ts: e.ts || Date.now(),
            text: e.text || '',
          }))
        : [],
    }));
    await saveGoals(goals);
    result.imported.objectives = goals.length;
  }

  return result;
}

// ── Field mapping helpers ───────────────────────────────────────────────────
function mapTask(t) {
  return {
    id: t.id || uid(),
    title: t.title || '',
    done: !!t.done,
    doneAt: t.doneAt || null,
    createdAt: t.createdAt || Date.now(),
    priority: t.priority || '',
    category: t.category || '',
    project: t.project || '',
    status: t.status || (t.done ? 'Done' : 'To do'),
    due: t.due || t.dueDate || '',
    reminder: t.reminder || '',
    tags: Array.isArray(t.tags) ? t.tags : [],
    recurring: t.recurring || 'none',
    taskNumber: t.taskNumber || '',
    expenditureType: t.expenditureType || '',
    links: Array.isArray(t.links) ? t.links : [],
    stationId: t.stationId || null,
    checklistProgress: t.checklistProgress || {},
    outOfScope: !!t.outOfScope,
    outOfScopeHours: t.outOfScopeHours ?? null,
    outOfScopeNotes: t.outOfScopeNotes || '',
  };
}

function mapProject(p) {
  return {
    id: p.id || uid(),
    name: p.name || '(unnamed)',
    description: p.description || '',
    nextSteps: p.nextSteps || '',
    blockers: p.blockers || '',
    color: p.color || '',
    number: p.number || '',
    archived: !!p.archived,
    deliverables: Array.isArray(p.deliverables)
      ? p.deliverables.map((d) => ({
          id: d.id || uid(),
          name: d.name || '',
          startDate: d.startDate || '',
          dueDate: d.dueDate || '',
          stations: Array.isArray(d.stations)
            ? d.stations.map((s) => ({
                id: s.id || uid(),
                name: s.name || '',
                done: !!s.done,
                completedAt: s.completedAt || null,
                comms: Array.isArray(s.comms) ? s.comms : [],
                notes: s.notes || '',
                estHours: s.estHours || 0,
              }))
            : [],
        }))
      : [],
    congresses: Array.isArray(p.congresses) ? p.congresses : [],
  };
}

function mapNote(n) {
  return {
    id: n.id || uid(),
    title: n.title || '',
    body: n.body || '',
    createdAt: n.createdAt || Date.now(),
    updatedAt: n.updatedAt || Date.now(),
    projectName: n.projectName || n.project || '',
    taskIds: Array.isArray(n.taskIds) ? n.taskIds : [],
  };
}
