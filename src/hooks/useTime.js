import { useEffect, useRef, useState, useCallback } from 'react';
import { getCurrentUser } from '../lib/supabase.js';
import {
  loadTimeEntries,
  setTimeEntry as setTimeEntryDb,
  addTimeEntry as addTimeEntryDb,
  loadRunningTimer,
  startRunningTimer,
  clearRunningTimer,
} from '../lib/time.js';
import { localDateStr } from '../lib/utils.js';

// "Can the current user log time on this task?"
// Personal workspace: yes (always your own task)
// Team workspace: yes if assigned to me, yes if unassigned, NO if assigned to someone else.
export function canTrackTime(task, currentUserId, workspaceId) {
  if (!task) return false;
  if (!workspaceId) return true; // personal workspace = always yes
  if (!task.assignedToId) return true; // unassigned in team
  return task.assignedToId === currentUserId;
}

export function useTime(workspaceId) {
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  const [runningTimer, setRunningTimer] = useState(null); // { taskId, workspaceId, startedAt }
  const [tickNow, setTickNow] = useState(Date.now());
  const [currentUserId, setCurrentUserId] = useState(null);

  // ── Identity ──────────────────────────────────────────────────────────────
  useEffect(() => {
    getCurrentUser().then((u) => setCurrentUserId(u?.id || null));
  }, []);

  // ── Load entries (default: this week + last 4 weeks for context) ─────────
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
        if (!cancelled) setEntries(rows);
      })
      .finally(() => {
        if (!cancelled) setLoadingEntries(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // ── Load any running timer (might be in another workspace) ─────────────
  useEffect(() => {
    loadRunningTimer().then((r) => setRunningTimer(r));
  }, []);

  // ── Tick once per second to update displayed elapsed time ─────────────
  useEffect(() => {
    if (!runningTimer) return;
    const id = setInterval(() => setTickNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [runningTimer]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const startTimer = useCallback(
    async (task) => {
      if (!task) return;
      // If something else is running, stop it first, banking the time.
      if (runningTimer) {
        await stopTimerInternal(runningTimer);
      }
      const state = await startRunningTimer(task.id, workspaceId);
      setRunningTimer(state);
    },
    [runningTimer, workspaceId]
  );

  const stopTimerInternal = async (timer) => {
    if (!timer) return;
    const elapsedMs = Date.now() - timer.startedAt;
    const hours = elapsedMs / 3600000;
    if (hours >= 0.005) {
      // Don't bother logging anything below 18 seconds
      const date = localDateStr(new Date(timer.startedAt));
      await addTimeEntryDb(timer.workspaceId, timer.taskId, date, hours);
      // Reflect in local entries
      const id = `${currentUserId}_${timer.workspaceId || 'p'}_${timer.taskId}_${date}`;
      setEntries((prev) => {
        const idx = prev.findIndex((e) => e.id === id);
        if (idx === -1) {
          return [
            ...prev,
            {
              id,
              taskId: timer.taskId,
              date,
              hours,
              notes: '',
            },
          ];
        }
        const next = [...prev];
        next[idx] = { ...next[idx], hours: next[idx].hours + hours };
        return next;
      });
    }
    await clearRunningTimer();
  };

  const stopTimer = useCallback(async () => {
    if (!runningTimer) return;
    await stopTimerInternal(runningTimer);
    setRunningTimer(null);
  }, [runningTimer, currentUserId]);

  // Cancel without logging time (just discard)
  const cancelTimer = useCallback(async () => {
    await clearRunningTimer();
    setRunningTimer(null);
  }, []);

  const setEntry = useCallback(
    async (taskId, date, hours) => {
      const id = `${currentUserId}_${workspaceId || 'p'}_${taskId}_${date}`;
      // Optimistic local update
      setEntries((prev) => {
        if (!hours || hours <= 0) {
          return prev.filter((e) => e.id !== id);
        }
        const idx = prev.findIndex((e) => e.id === id);
        if (idx === -1) {
          return [...prev, { id, taskId, date, hours, notes: '' }];
        }
        const next = [...prev];
        next[idx] = { ...next[idx], hours };
        return next;
      });
      await setTimeEntryDb(workspaceId, taskId, date, hours);
    },
    [workspaceId, currentUserId]
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  const elapsedMsForRunning = runningTimer ? tickNow - runningTimer.startedAt : 0;

  return {
    entries,
    loadingEntries,
    runningTimer,
    elapsedMsForRunning,
    currentUserId,
    startTimer,
    stopTimer,
    cancelTimer,
    setEntry,
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
