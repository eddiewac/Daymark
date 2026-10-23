// Generate a short unique ID. Same shape as the old app uses.
export function uid() {
  return (
    'm' +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4)
  );
}

// YYYY-MM-DD for today in local time
export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// YYYY-MM-DD for a given Date in local time (Brisbane-correct when the
// browser timezone is local — never slice a UTC ISO string for a calendar day).
export function localDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// HH:MM for a given Date in local time.
export function localTimeStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Days difference (today - dueDate). Negative = overdue.
export function daysUntil(dueDateStr) {
  if (!dueDateStr) return null;
  const d = new Date(dueDateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / (1000 * 60 * 60 * 24));
}

// Format due date as relative phrase
export function formatDue(dueDateStr) {
  if (!dueDateStr) return '';
  const days = daysUntil(dueDateStr);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days < 7) return `In ${days}d`;
  return dueDateStr;
}

// Debounce helper
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
