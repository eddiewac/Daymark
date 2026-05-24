// ── Project groups ──────────────────────────────────────────────────────────
//
// A "project group" is a user-defined, named, coloured bucket. It lets a user
// group related projects together (e.g. all the work for one client) without
// the group label having to reveal anything confidential — the user picks the
// name. Each group is { id, name, color }.
//
// A project belongs to at most one group via `project.group` holding the
// group id. Ungrouped projects keep the app's default index-based colour.
//
// Group definitions are workspace-level config, passed around as the
// `projectGroups` array, in the same way custom statuses/priorities are.

import { PROJECT_COLORS, projectColor as defaultProjectColor } from './constants.js';

// A small, sensible starter palette for groups — the same hues used elsewhere
// in the app so groups sit visually consistent with everything else.
export const GROUP_COLOR_CHOICES = [
  '#534AB7',
  '#1d9e75',
  '#D85A30',
  '#185FA5',
  '#BA7517',
  '#D4537E',
  '#0F6E56',
  '#378ADD',
  '#888780',
  '#e24b4a',
];

// Generate a short unique id for a new group.
export function newGroupId() {
  return 'grp_' + Math.random().toString(36).slice(2, 9);
}

// Look up a group definition by id. Returns null if not found (e.g. the group
// was deleted but a project still references it).
export function findGroup(projectGroups, groupId) {
  if (!groupId || !projectGroups) return null;
  return projectGroups.find((g) => g.id === groupId) || null;
}

// The colour to use for a project. If the project belongs to an existing
// group, the group's colour wins. Otherwise fall back to the app's default
// index-based colour so ungrouped projects look exactly as they did before.
export function projectColorWithGroups(project, allProjects, projectGroups) {
  if (project && project.group) {
    const g = findGroup(projectGroups, project.group);
    if (g && g.color) return g.color;
  }
  // Fall back to the default behaviour (keyed by project name + index).
  return defaultProjectColor(project?.name, allProjects);
}

// Bucket a list of projects by their group. Returns an ordered array of
// { group, projects } — defined groups first (in their configured order),
// then an "Ungrouped" bucket last if any projects have no/!valid group.
// Buckets with no projects are omitted.
export function groupProjects(projects, projectGroups) {
  const groups = projectGroups || [];
  const byId = {};
  for (const g of groups) byId[g.id] = [];
  const ungrouped = [];

  for (const p of projects || []) {
    if (p.group && byId[p.group]) {
      byId[p.group].push(p);
    } else {
      ungrouped.push(p);
    }
  }

  const out = [];
  for (const g of groups) {
    if (byId[g.id].length > 0) {
      out.push({ group: g, projects: byId[g.id] });
    }
  }
  if (ungrouped.length > 0) {
    out.push({
      group: { id: '__ungrouped__', name: 'Ungrouped', color: '#888780' },
      projects: ungrouped,
    });
  }
  return out;
}
