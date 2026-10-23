import { useEffect, useRef, useState, useCallback } from 'react';
import { getCurrentUser } from '../lib/supabase.js';
import {
  loadTimeEntries,
  createTimeBlock as createBlockDb,
  updateTimeBlock as updateBlockDb,
  loadRunningTimer,
  startRunningTimer,
  clearRunningTimer,
} from '../lib/time.js';
import { localDateStr, localTimeStr } from '../lib/utils.js';

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
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  // Pre-void copies so Undo can put hours back without a time_entries delete.
  const voidedSnapshots = useRef(new Map());

  // Pending stop dialog state — when set, the indicator/UI shows the popup.
  // Only used for stops of at least one minute (editable start/end).
  const [pendingStop, setPendingStop] = useState(null);
  // { type: 'discard' | 'short' } — confirm before dropping time, or the
  // sub-1-minute round/discard choice. Never the dead "End must be after start" dialog.
  const [pendingPrompt, setPendingPrompt] = useState(null);

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

  const rememberBlock = useCallback(
    (created, blockWorkspaceId) => {
      if (created && !created.voided && blockWorkspaceId == (workspaceId || null)) {
        setBlocks((prev) => [...prev, created]);
      }
    },
    [workspaceId]
  );

  // Write a time_entry for a running timer. minutes is at least 1 so a
  // sub-minute switch is logged, never dropped. Does not delete anything.
  const logTimerBlock = useCallback(
    async (timer, minutes) => {
      if (!timer) return { ok: false, error: 'No running timer' };
      const mins = Math.max(1, minutes || 1);
      const start = new Date(timer.startedAt);
      const end = new Date(start.getTime() + mins * 60000);
      const created = await createBlockDb(timer.workspaceId, {
        taskId: timer.taskId,
        date: localDateStr(start),
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
      });
      if (!created) return { ok: false, error: 'Could not log time' };
      rememberBlock(created, timer.workspaceId);
      return {
        ok: true,
        blockId: created.id,
        minutes: mins,
        previousTaskId: timer.taskId,
        previousTitle: timer.taskTitle || '',
        previousProject: timer.projectName || '',
      };
    },
    [rememberBlock]
  );

  const startTimer = useCallback(
    async (task) => {
      if (!task) return { ok: false, error: 'No task' };
      let switched = null;
      if (runningTimer && runningTimer.taskId !== task.id) {
        // Auto-log the running block, then switch. Never silent-drop.
        const elapsed = Date.now() - runningTimer.startedAt;
        const minutes = Math.max(1, Math.round(elapsed / 60000));
        switched = await logTimerBlock(runningTimer, minutes);
        if (!switched.ok) return switched;
        await clearRunningTimer();
        setRunningTimer(null);
      } else if (runningTimer && runningTimer.taskId === task.id) {
        return { ok: true, switched: false, already: true };
      }
      const state = await startRunningTimer(task.id, workspaceId, {
        taskTitle: task.title || '',
        projectName: task.project || '',
      });
      if (!state) {
        // The previous block is already logged. Don't report the whole switch
        // as a failed save — the caller surfaces the start failure separately.
        return {
          ok: !!switched,
          startFailed: true,
          error: 'Could not start timer',
          switched: !!switched,
          ...(switched || {}),
        };
      }
      setRunningTimer(state);
      setPendingStop(null);
      setPendingPrompt(null);
      return { ok: true, switched: !!switched, ...(switched || {}) };
    },
    [runningTimer, workspaceId, logTimerBlock]
  );

  // Open the stop dialog, or the sub-1-minute chooser when the block is too
  // short to survive minute-precision start/end fields.
  const requestStop = useCallback(() => {
    if (!runningTimer) return;
    const elapsed = Date.now() - runningTimer.startedAt;
    if (elapsed < 60000) {
      setPendingStop(null);
      setPendingPrompt({ type: 'short' });
      return;
    }
    setPendingPrompt(null);
    setPendingStop({
      taskId: runningTimer.taskId,
      workspaceId: runningTimer.workspaceId,
      startedAt: new Date(runningTimer.startedAt).toISOString(),
      endedAt: new Date().toISOString(),
    });
  }, [runningTimer]);

  // Confirm the stop, save the block, clear the timer. Fails closed: a write
  // error leaves the timer running so the time is not lost.
  const confirmStop = useCallback(
    async (finalStart, finalEnd) => {
      if (!pendingStop) return { ok: false, error: 'Nothing to save' };
      const startMs = new Date(finalStart).getTime();
      const endMs = new Date(finalEnd).getTime();
      const ms = endMs - startMs;
      if (!(ms > 0)) {
        return { ok: false, error: 'End must be after start' };
      }
      const date = localDateStr(new Date(finalStart));
      const created = await createBlockDb(pendingStop.workspaceId, {
        taskId: pendingStop.taskId,
        date,
        startedAt: finalStart,
        endedAt: finalEnd,
      });
      if (!created) return { ok: false, error: 'Could not log time' };
      rememberBlock(created, pendingStop.workspaceId);
      await clearRunningTimer();
      setRunningTimer(null);
      setPendingStop(null);
      setPendingPrompt(null);
      return {
        ok: true,
        blockId: created.id,
        minutes: Math.max(1, Math.round(ms / 60000)),
        previousTaskId: pendingStop.taskId,
      };
    },
    [pendingStop, rememberBlock]
  );

  // Sub-1-minute stop: round up to the minutes actually elapsed (at least 1)
  // instead of opening a save dialog whose minute clocks collapse to equal.
  const confirmRoundMinute = useCallback(async () => {
    if (!runningTimer) return { ok: false, error: 'No running timer' };
    const elapsed = Date.now() - runningTimer.startedAt;
    const minutes = Math.max(1, Math.round(elapsed / 60000));
    const logged = await logTimerBlock(runningTimer, minutes);
    if (!logged.ok) return logged;
    await clearRunningTimer();
    setRunningTimer(null);
    setPendingStop(null);
    setPendingPrompt(null);
    return { ...logged, switched: false };
  }, [runningTimer, logTimerBlock]);

  const cancelStop = useCallback(() => {
    setPendingStop(null);
  }, []);

  const requestDiscard = useCallback(() => {
    if (!runningTimer) return;
    setPendingPrompt({ type: 'discard' });
  }, [runningTimer]);

  const cancelPrompt = useCallback(() => {
    setPendingPrompt(null);
  }, []);

  // Drop the running timer with no time_entry. Callers confirm first.
  const discardTimer = useCallback(async () => {
    await clearRunningTimer();
    setRunningTimer(null);
    setPendingStop(null);
    setPendingPrompt(null);
    return { ok: true };
  }, []);

  // Undo a logged block without deleting the row: mark it voided and zero
  // the hours so budget and the timesheet stop counting it. The snapshot is
  // kept so a later Undo can restore the same row.
  const voidBlock = useCallback(async (blockId) => {
    if (!blockId) return { ok: false, error: 'Nothing to undo' };
    const snapshot = blocksRef.current.find((b) => b.id === blockId) || null;
    if (snapshot) voidedSnapshots.current.set(blockId, snapshot);
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    const updated = await updateBlockDb(blockId, { hours: 0, voided: true });
    if (!updated) {
      voidedSnapshots.current.delete(blockId);
      if (snapshot) {
        setBlocks((prev) => (prev.some((b) => b.id === blockId) ? prev : [...prev, snapshot]));
      }
      return { ok: false, error: 'Could not undo' };
    }
    return { ok: true, snapshot };
  }, []);

  // Put a voided block back on the timesheet. Update only — never insert a
  // second row and never delete the voided one.
  const restoreBlock = useCallback(
    async (blockId, snapshotArg) => {
      const snapshot = snapshotArg || voidedSnapshots.current.get(blockId) || null;
      if (!blockId || !snapshot) return { ok: false, error: 'Nothing to restore' };
      const updated = await updateBlockDb(blockId, {
        hours: snapshot.hours || 0,
        voided: false,
      });
      if (!updated || updated.voided) return { ok: false, error: 'Could not restore' };
      voidedSnapshots.current.delete(blockId);
      const restored = { ...updated, voided: false, hours: snapshot.hours || 0 };
      if ((restored.workspaceId || null) == (workspaceId || null)) {
        setBlocks((prev) => {
          if (prev.some((b) => b.id === blockId)) {
            return prev.map((b) => (b.id === blockId ? restored : b));
          }
          return [...prev, restored];
        });
      }
      return { ok: true };
    },
    [workspaceId]
  );

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

  // ── Derived ───────────────────────────────────────────────────────────────

  const elapsedMsForRunning = runningTimer ? tickNow - runningTimer.startedAt : 0;

  return {
    blocks,
    loadingEntries,
    runningTimer,
    elapsedMsForRunning,
    currentUserId,
    pendingStop,
    pendingPrompt,
    startTimer,
    requestStop,
    confirmStop,
    confirmRoundMinute,
    cancelStop,
    requestDiscard,
    cancelPrompt,
    discardTimer,
    voidBlock,
    restoreBlock,
    addBlock,
    updateBlock,
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

// "HH:MM" from a timestamp, in the browser's local timezone.
export function fmtTimeOfDay(ts) {
  if (!ts) return '';
  return localTimeStr(ts);
}

// Convert a local calendar day + "HH:MM" into a UTC ISO timestamp.
// Built with the local Date constructor so Brisbane mornings are not shifted
// onto the previous UTC date the way `toISOString().slice(0, 10)` would.
export function combineDateAndTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [y, mo, da] = dateStr.split('-').map((x) => parseInt(x, 10));
  const [h, m, s] = timeStr.split(':').map((x) => parseInt(x, 10));
  if (!y || !mo || !da) return null;
  const d = new Date(y, mo - 1, da, h || 0, m || 0, s || 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
