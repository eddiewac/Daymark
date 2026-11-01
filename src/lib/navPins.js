// Tab defaults (Settings → which view a door opens to). One pin per door,
// stored per workspace. Read at click time so a pin set in this session is
// what the door opens, not the copy captured when the desk mounted.

export function groupPinStorageKey(workspaceId) {
  return `daymark-group-pin:${workspaceId || 'personal'}`;
}

export function readGroupPins(workspaceId) {
  const key = groupPinStorageKey(workspaceId);
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
    // Legacy pin pointed at the removed top-level track. Time opens Timesheet.
    if (stored.track === 'track') {
      stored.track = 'time';
      try {
        localStorage.setItem(key, JSON.stringify(stored));
      } catch {
        /* private mode */
      }
    }
    return stored;
  } catch {
    return {};
  }
}

export function writeGroupPins(workspaceId, pins) {
  try {
    localStorage.setItem(groupPinStorageKey(workspaceId), JSON.stringify(pins || {}));
  } catch {
    /* private mode */
  }
}
