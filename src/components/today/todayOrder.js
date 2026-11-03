import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, getCurrentUser } from '../../lib/supabase.js';
import { localDateStr } from '../../lib/utils.js';
import { useSaveStatus } from '../save/SaveStatus.jsx';

// Today's Do rank, one row per user per workspace.
// Key: `${userId}:today-order:${workspaceId || 'personal'}`
// Value: { date: 'YYYY-MM-DD', ids: [taskId, ...] }
// Task ids only — no titles, notes, or other client data. Colour is not stored.
// personal_storage already allows `{userId}:%`, so this needs no new policy.

export const ORDER_SAVE_DELAY_MS = 1000;

export function todayOrderStorageKey(userId, workspaceId) {
  return `${userId}:today-order:${workspaceId || 'personal'}`;
}

export function orderValue(date, ids) {
  return { date, ids: cleanIds(ids) };
}

function cleanIds(ids) {
  const out = [];
  const seen = new Set();
  for (const id of ids || []) {
    if (typeof id !== 'string' || !id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function parseStored(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const date = typeof parsed.date === 'string' ? parsed.date : '';
    return { date, ids: cleanIds(parsed.ids) };
  } catch {
    return null;
  }
}

function timestampMs(value) {
  const n = Date.parse(value || '');
  return Number.isNaN(n) ? null : n;
}

function isAtOrBefore(incoming, previous) {
  const a = timestampMs(incoming);
  const b = timestampMs(previous);
  if (a == null || b == null) return false;
  return a <= b;
}

function isNewer(incoming, previous) {
  const a = timestampMs(incoming);
  const b = timestampMs(previous);
  if (a == null) return false;
  if (b == null) return true;
  return a > b;
}

function addCalendarDays(iso, days) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

function dayOf(stamp) {
  if (stamp == null || stamp === '') return '';
  if (typeof stamp === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(stamp)) return stamp;
  return localDateStr(stamp) || '';
}

// A Do task whose deliverable/station came back from Waiting today or yesterday.
// Reads the markers Waiting already writes. Returns false when it can't tell.
export function isFreshWaitingReturn(ctx, today) {
  if (!ctx || !today) return false;
  const deliverable = ctx.deliverable || null;
  const yesterday = addCalendarDays(today, -1);
  const fresh = (stamp) => {
    const day = dayOf(stamp);
    return !!day && (day === today || day === yesterday);
  };
  const name = (deliverable?.waitingOnName || '').trim();
  const stillWaiting = !!(name && deliverable?.waitingOnDate);
  if (stillWaiting) return false;
  if (deliverable?.waitingResolvedAt && fresh(deliverable.waitingResolvedAt)) return true;
  const stations = deliverable?.stations?.length
    ? deliverable.stations
    : ctx.station
      ? [ctx.station]
      : [];
  for (const station of stations) {
    for (const comm of station?.comms || []) {
      if (comm?.replyReceived && fresh(comm.replyAt)) return true;
    }
  }
  return false;
}

// 0 deadline today/tomorrow, 1 overdue, 2 due today, 3 back from Waiting, 4 rest.
export function seedBucket(row, today) {
  const task = row?.task || row || {};
  const tomorrow = addCalendarDays(today, 1);
  const deadline = task.deadline || '';
  if (deadline && (deadline === today || deadline === tomorrow)) return 0;
  if (task.dueDate && task.dueDate < today) return 1;
  if (task.dueDate === today) return 2;
  if (row?.returned) return 3;
  return 4;
}

function sortBySeed(rows, today) {
  return rows
    .map((row, index) => ({ id: row.id, index, bucket: seedBucket(row, today) }))
    .sort((a, b) => a.bucket - b.bucket || a.index - b.index)
    .map((row) => row.id);
}

function keepKnown(ids, allowed) {
  return cleanIds(ids).filter((id) => allowed.has(id));
}

function withPins(ids, pinnedIds) {
  const allowed = new Set(ids);
  const pin = keepKnown(pinnedIds, allowed);
  if (pin.length === 0) return ids;
  const pinned = new Set(pin);
  return [...pin, ...ids.filter((id) => !pinned.has(id))];
}

// Order for one render. Saved ids stay in front; anything no longer in Do is
// dropped; rows that were not saved go to the bottom. A new day lifts the
// previous saved ids (still in Do) and seeds the rest. Pins are prepended
// only when nothing has been saved yet.
export function deriveTodayOrder({ rows, stored, today, pinnedIds }) {
  const list = (rows || []).filter((row) => row && typeof row.id === 'string' && row.id);
  const allowed = new Set(list.map((row) => row.id));
  const baseIds = list.map((row) => row.id);
  const emptyCarry = new Set();

  if (!stored) {
    return {
      ids: withPins(sortBySeed(list, today), pinnedIds),
      carried: emptyCarry,
      ranked: false,
    };
  }

  const saved = keepKnown(stored.ids, allowed);
  if (saved.length === 0) {
    return { ids: sortBySeed(list, today), carried: emptyCarry, ranked: false };
  }

  const savedSet = new Set(saved);
  if (stored.date === today) {
    const fresh = baseIds.filter((id) => !savedSet.has(id));
    return { ids: [...saved, ...fresh], carried: emptyCarry, ranked: true };
  }

  const rest = sortBySeed(
    list.filter((row) => !savedSet.has(row.id)),
    today
  );
  return { ids: [...saved, ...rest], carried: new Set(saved), ranked: true };
}

// Final index in the resulting list. Same array reference when nothing moves.
export function moveId(ids, id, toIndex) {
  const from = (ids || []).indexOf(id);
  if (from < 0 || toIndex < 0 || toIndex >= ids.length || from === toIndex) return ids;
  const next = ids.slice();
  next.splice(from, 1);
  next.splice(toIndex, 0, id);
  return next;
}

function sameList(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

function appendMissing(ids, rows) {
  const seen = new Set(ids);
  const out = ids.slice();
  for (const row of rows || []) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row.id);
  }
  return out;
}

export async function loadTodayOrder(userId, workspaceId) {
  const key = todayOrderStorageKey(userId, workspaceId);
  const { data, error } = await supabase
    .from('app_storage')
    .select('value, updated_at')
    .eq('key', key)
    .maybeSingle();
  if (error) {
    console.error('loadTodayOrder:', error);
    return { ok: false, error, stored: null, updatedAt: '' };
  }
  if (!data?.value) return { ok: true, stored: null, updatedAt: data?.updated_at || '' };
  return { ok: true, stored: parseStored(data.value), updatedAt: data.updated_at || '' };
}

export async function saveTodayOrder(userId, workspaceId, stored) {
  if (!userId) return { ok: false, error: 'Not signed in' };
  const updatedAt = new Date().toISOString();
  const value = orderValue(stored?.date, stored?.ids);
  const { error } = await supabase.from('app_storage').upsert(
    {
      key: todayOrderStorageKey(userId, workspaceId),
      value: JSON.stringify(value),
      updated_at: updatedAt,
    },
    { onConflict: 'key' }
  );
  if (error) {
    console.error('saveTodayOrder:', error);
    return { ok: false, error };
  }
  return { ok: true, updatedAt };
}

export function useTodayOrder({ workspaceId, today, rows, pinnedIds }) {
  const { runSave, showToast, retry } = useSaveStatus();
  const [record, setRecord] = useState(() => ({
    workspaceId,
    stored: null,
    ready: false,
  }));
  const [optimistic, setOptimistic] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [canMove, setCanMove] = useState(false);

  const rowsRef = useRef(rows);
  const userRef = useRef(null);
  const workspaceRef = useRef(workspaceId);
  const persistedRef = useRef(null);
  const lastWriteAt = useRef('');
  const pendingRef = useRef(null);
  const pendingGen = useRef(0);
  const saveTimer = useRef(null);
  const saveQueue = useRef(Promise.resolve());
  const displayIdsRef = useRef([]);
  const runSaveRef = useRef(runSave);
  const showToastRef = useRef(showToast);
  const retryRef = useRef(retry);
  const moveRowRef = useRef(() => {});

  rowsRef.current = rows || [];
  workspaceRef.current = workspaceId;
  runSaveRef.current = runSave;
  showToastRef.current = showToast;
  retryRef.current = retry;

  useEffect(() => {
    let cancelled = false;
    const channelRef = { current: null };
    setCanMove(false);
    setRecord({ workspaceId, stored: null, ready: false });
    setOptimistic(null);
    persistedRef.current = null;
    lastWriteAt.current = '';

    (async () => {
      const user = await getCurrentUser();
      if (cancelled) return;
      userRef.current = user;
      if (!user) {
        setCanMove(true);
        setRecord({ workspaceId, stored: null, ready: true });
        return;
      }

      const loaded = await loadTodayOrder(user.id, workspaceId);
      if (cancelled) return;
      if (!loaded.ok) {
        setCanMove(false);
        setRecord({ workspaceId, stored: null, ready: true });
        showToastRef.current('Couldn’t load today’s order', {
          onRetry: () => setReloadToken((n) => n + 1),
        });
        return;
      }

      persistedRef.current = loaded.stored;
      if (loaded.updatedAt) lastWriteAt.current = loaded.updatedAt;
      setCanMove(true);
      setRecord({ workspaceId, stored: loaded.stored, ready: true });

      const key = todayOrderStorageKey(user.id, workspaceId);
      const channel = supabase
        .channel(`today-order-${key}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'app_storage',
            filter: `key=eq.${key}`,
          },
          (payload) => {
            if (cancelled || workspaceRef.current !== workspaceId) return;
            if (payload.eventType === 'DELETE') {
              if (pendingRef.current) return;
              lastWriteAt.current = '';
              persistedRef.current = null;
              setRecord({ workspaceId, stored: null, ready: true });
              setOptimistic(null);
              return;
            }
            const incomingAt = payload.new?.updated_at || '';
            if (isAtOrBefore(incomingAt, lastWriteAt.current)) return;
            // A move still on screen wins until its write settles.
            if (pendingRef.current) return;
            const next = parseStored(payload.new?.value);
            persistedRef.current = next;
            if (incomingAt) lastWriteAt.current = incomingAt;
            setRecord({ workspaceId, stored: next, ready: true });
            setOptimistic(null);
          }
        )
        .subscribe();
      channelRef.current = channel;
      if (cancelled) supabase.removeChannel(channel);
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [workspaceId, reloadToken]);

  // Workspace changes and unmount flush a move that has not been written yet.
  useEffect(() => {
    const ws = workspaceId;
    return () => {
      const pending = pendingRef.current;
      if (!pending || pending.workspaceId !== ws || pending.started || !pending.userId) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      pending.started = true;
      pendingRef.current = null;
      saveTodayOrder(pending.userId, ws, orderValue(localDateStr(new Date()), pending.ids));
    };
  }, [workspaceId]);

  const ready = record.workspaceId === workspaceId && record.ready;
  const stored = ready ? record.stored : null;
  const pinKey = (pinnedIds || []).join('\0');

  const model = useMemo(() => {
    if (!ready) {
      return {
        ids: (rows || []).map((row) => row.id),
        carried: new Set(),
        ranked: true,
      };
    }
    return deriveTodayOrder({
      rows,
      stored,
      today,
      pinnedIds: pinKey ? pinKey.split('\0') : [],
    });
  }, [ready, rows, stored, today, pinKey]);

  const optimisticIds =
    optimistic && optimistic.workspaceId === workspaceId ? optimistic.ids : null;

  const ids = useMemo(() => {
    const allowed = new Set((rows || []).map((row) => row.id));
    const source = cleanIds(optimisticIds || model.ids).filter((id) => allowed.has(id));
    return appendMissing(source, rows);
  }, [rows, optimisticIds, model]);

  const baselineIds = useMemo(() => {
    const allowed = new Set((rows || []).map((row) => row.id));
    const source = cleanIds(model.ids).filter((id) => allowed.has(id));
    return appendMissing(source, rows);
  }, [rows, model]);

  const baselineRef = useRef(baselineIds);
  baselineRef.current = baselineIds;
  displayIdsRef.current = ids;

  const enqueue = useCallback((gen, nextIds, ws, userId) => {
    const run = saveQueue.current.catch(() => {}).then(async () => {
      if (pendingGen.current !== gen) return;
      const allowed = new Set(rowsRef.current.map((row) => row.id));
      const generationIds = cleanIds(nextIds).filter((id) => allowed.has(id));
      const pending = pendingRef.current;
      if (pending && pending.gen === gen) pending.started = true;

      const result = await runSaveRef.current(async () => {
        if (pendingGen.current !== gen) return { ok: true, skipped: true };
        if (!userId) return { ok: false, error: 'Not signed in' };
        // Held while the write (and a Retry of it) is in flight so a realtime
        // echo cannot replace the order the user just moved.
        pendingRef.current = {
          gen,
          userId,
          workspaceId: ws,
          ids: generationIds,
          started: true,
        };
        if (workspaceRef.current === ws) {
          displayIdsRef.current = generationIds;
          setOptimistic({ workspaceId: ws, ids: generationIds });
        }
        return saveTodayOrder(userId, ws, orderValue(localDateStr(new Date()), generationIds));
      });

      if (workspaceRef.current !== ws || pendingGen.current !== gen) {
        if (result?.ok && result.updatedAt && isNewer(result.updatedAt, lastWriteAt.current)) {
          lastWriteAt.current = result.updatedAt;
        }
        return;
      }
      if (result?.skipped) return;
      if (!result?.ok) {
        if (pendingRef.current?.gen === gen) pendingRef.current = null;
        setOptimistic(null);
        showToastRef.current('Couldn’t save today’s order', {
          onRetry: () => retryRef.current && retryRef.current(),
        });
        return;
      }

      const saved = orderValue(localDateStr(new Date()), generationIds);
      persistedRef.current = saved;
      if (result.updatedAt && isNewer(result.updatedAt, lastWriteAt.current)) {
        lastWriteAt.current = result.updatedAt;
      }
      if (pendingRef.current?.gen === gen) pendingRef.current = null;
      setRecord({ workspaceId: ws, stored: saved, ready: true });
      setOptimistic(null);
    });
    saveQueue.current = run;
  }, []);

  const commit = useCallback(
    (nextIds) => {
      const ws = workspaceRef.current;
      const userId = userRef.current?.id || null;
      const next = cleanIds(nextIds);
      // Undo back to the derived order before the write starts. Nothing was
      // saved, so yesterday's carry-over and the quiet hint stay as they were.
      if (sameList(next, baselineRef.current) && !pendingRef.current?.started) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        pendingGen.current += 1;
        pendingRef.current = null;
        displayIdsRef.current = baselineRef.current;
        setOptimistic(null);
        return;
      }
      const gen = ++pendingGen.current;
      displayIdsRef.current = next;
      setOptimistic({ workspaceId: ws, ids: next });
      pendingRef.current = { gen, userId, workspaceId: ws, ids: next, started: false };
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        if (pendingGen.current !== gen) return;
        enqueue(gen, next, ws, userId);
      }, ORDER_SAVE_DELAY_MS);
    },
    [enqueue]
  );

  const moveRow = useCallback(
    (taskId, toIndex, opts) => {
      if (!canMove) return;
      const current = displayIdsRef.current;
      const from = current.indexOf(taskId);
      const next = moveId(current, taskId, toIndex);
      if (next === current) return;
      commit(next);
      if (!opts?.quiet) {
        const place = toIndex + 1;
        showToastRef.current(`Moved to #${place}`, {
          duration: 12000,
          onUndo: () => moveRowRef.current(taskId, from, { quiet: true }),
        });
      }
    },
    [canMove, commit]
  );
  moveRowRef.current = moveRow;

  const showHint = ready && !optimisticIds && !model.ranked;

  return {
    ids,
    carried: model.carried,
    showHint,
    ready,
    canMove,
    moveRow,
  };
}
