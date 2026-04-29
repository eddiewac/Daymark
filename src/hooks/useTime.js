import { useEffect, useState, useCallback } from 'react';
import { getCurrentUser } from '../lib/supabase.js';
import {
  loadTimeEntries,
  createTimeBlock as createBlockDb,
  updateTimeBlock as updateBlockDb,
  deleteTimeBlock as deleteBlockDb,
  loadRunningTimer,
  startRunningTimer,
  clearRunningTimer,
} from '../lib/time.js';
import { localDateStr } from '../lib/utils.js';

// Permission check: can the current user log time on this task?
export function canTrackTime(task, currentUserId, workspaceId) {
  if (!task) return false;
  if (!workspaceId) return true; // personal workspace
  if (!task.assignedToId) return true; // unassigned in team
  return task.assignedToId === currentUserId;
}

export function useTime(workspaceId) {
  const [blocks, setBlocks] = useState([]); // all loaded blocks
  const [loadingEntries, setLoadingEntries] = useState(true);

  const [runningTimer, setRunningTimer] = useState(null);
  const [tickNow, setTickNow] = useState(Date.now());
  const [currentUserId, setCurrentUserId] = useState(null);

  // Pending stop dialog state — when set, the indicator/UI shows the popup
  const [pendingStop, setPendingStop] = useState(null);

  useEffect(() => {
    getCurrentUser().then((u) => setCurrentUserId(u?.id || null));
  }, []);

  // Load blocks (5 weeks back, 1 week forward) when workspace changes
  useEffect(() => {
    let cancelled = false;
    setLoadingEntries(true);
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 35);
    const to = new Date(today);
    to.setDate(today.getDate() + 7);

    loadTimeEntries(workspaceId, localDateStr(from), localDateStr(to))
      .then((rows) => {
        if (!cancelled) setBlocks(rows);
      })
      .finally(() => {
        if (!cancelled) setLoadingEntries(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Load any running timer
  useEffect(() => {
    loadRunningTimer().then((r) => setRunningTimer(r));
  }, []);

  // Tick once per second
  useEffect(() => {
    if (!runningTimer) return;
    const id = setInterval(() => setTickNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [runningTimer]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const startTimer = useCallback(
    async (task) => {
      if (!task) return;
      // If something else is running, drop it silently (no time logged)
      if (runningTimer) {
        await clearRunningTimer();
      }
      const state = await startRunningTimer(task.id, workspaceId);
      setRunningTimer(state);
    },
    [runningTimer, workspaceId]
  );

  // Open the stop dialog with prefilled times
  const requestStop = useCallback(() => {
    if (!runningTimer) return;
    setPendingStop({
      taskId: runningTimer.taskId,
      workspaceId: runningTimer.workspaceId,
      startedAt: new Date(runningTimer.startedAt).toISOString(),
      endedAt: new Date().toISOString(),
    });
  }, [runningTimer]);

  // Confirm the stop, save the block, clear the timer
  const confirmStop = useCallback(
    async (finalStart, finalEnd) => {
      if (!pendingStop) return;
      const startMs = new Date(finalStart).getTime();
      const endMs = new Date(finalEnd).getTime();
      const ms = endMs - startMs;
      if (ms >= 30000) {
        // Don't bother for blocks under 30 seconds
        const date = localDateStr(new Date(finalStart));
        const created = await createBlockDb(pendingStop.workspaceId, {
          taskId: pendingStop.taskId,
          date,
          startedAt: finalStart,
          endedAt: finalEnd,
        });
        // Only add to local state if the block belongs to the currently-loaded workspace
        if (created && pendingStop.workspaceId == (workspaceId || null)) {
          setBlocks((prev) => [...prev, created]);
        }
      }
      await clearRunningTimer();
      setRunningTimer(null);
      setPendingStop(null);
    },
    [pendingStop, workspaceId]
  );

  const cancelStop = useCallback(() => {
    setPendingStop(null);
  }, []);

  // Cancel the running timer entirely (no logging, no popup)
  const discardTimer = useCallback(async () => {
    await clearRunningTimer();
    setRunningTimer(null);
    setPendingStop(null);
  }, []);

  // ── Block CRUD (used from the timesheet) ─────────────────────────────────

  const addBlock = useCallback(
    async (block) => {
      const created = await createBlockDb(workspaceId, block);
      if (created) {
        setBlocks((prev) => [...prev, created]);
      }
      return created;
    },
    [workspaceId]
  );

  const updateBlock = useCallback(async (blockId, patch) => {
    // Optimistic local update
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, ...patch } : b))
    );
    const updated = await updateBlockDb(blockId, patch);
    if (updated) {
      // Replace with server canonical (esp. recomputed hours)
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? updated : b))
      );
    }
  }, []);

  const removeBlock = useCallback(async (blockId) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    await deleteBlockDb(blockId);
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const elapsedMsForRunning = runningTimer ? tickNow - runningTimer.startedAt : 0;

  return {
    blocks,
    loadingEntries,
    runningTimer,
    elapsedMsForRunning,
    currentUserId,
    pendingStop,
    startTimer,
    requestStop,
    confirmStop,
    cancelStop,
    discardTimer,
    addBlock,
    updateBlock,
    removeBlock,
  };
}

export function fmtElapsed(ms) {
  if (!ms || ms < 0) return '0:00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function fmtHours(h) {
  if (!h || h < 0.01) return '';
  return h.toFixed(2);
}

// "HH:MM" from a timestamp
export function fmtTimeOfDay(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Convert "HH:MM" + a date into a full ISO timestamp
export function combineDateAndTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10));
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(h || 0);
  d.setMinutes(m || 0);
  d.setSeconds(0);
  d.setMilliseconds(0);
  return d.toISOString();
}
