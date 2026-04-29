// Default values used across the app

export const DEFAULT_CATEGORIES = ['Work', 'Personal', 'Admin', 'Learning'];
export const DEFAULT_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
export const DEFAULT_STATUSES = ['To do', 'In progress', 'Blocked', 'Done'];

export const PRIORITY_COLORS = {
  Low: '#888780',
  Medium: '#185FA5',
  High: '#D85A30',
  Urgent: '#e24b4a',
};

export const STATUS_COLORS = {
  'To do': '#888780',
  'In progress': '#185FA5',
  Blocked: '#e24b4a',
  Done: '#1d9e75',
};

// Project palette - 8 colours rotated by project index
export const PROJECT_COLORS = [
  '#534AB7',
  '#1d9e75',
  '#D85A30',
  '#185FA5',
  '#BA7517',
  '#D4537E',
  '#0F6E56',
  '#378ADD',
];

export function projectColor(projectName, projects) {
  if (!projectName || !projects) return PROJECT_COLORS[0];
  const i = projects.findIndex((p) => p.name === projectName);
  return PROJECT_COLORS[(i < 0 ? 0 : i) % PROJECT_COLORS.length];
}

export const RECURRING_OPTIONS = ['none', 'daily', 'weekly', 'monthly'];
