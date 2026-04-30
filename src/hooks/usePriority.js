import { useEffect, useState, useCallback } from 'react';
import { loadPriorityHistory, savePriorityHistory } from '../lib/priority.js';
import { todayStr } from '../lib/utils.js';

export function usePriority(workspaceId) {
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadPriorityHistory(workspaceId)
      .then((h) => {
        if (!cancelled) setHistory(h);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const persist = useCallback(
    async (next) => {
      setHistory(next);
      await savePriorityHistory(workspaceId, next);
    },
    [workspaceId]
  );

  // Set today's priority (primary task + optional stretch goals)
  const setTodayPriority = useCallback(
    async ({ primary, stretch }) => {
      const today = todayStr();
      const next = {
        ...history,
        [today]: {
          primary,
          stretch: stretch || [],
          dismissed: false,
        },
      };
      await persist(next);
    },
    [history, persist]
  );

  // Dismiss today's banner without setting a priority
  const dismissToday = useCallback(async () => {
    const today = todayStr();
    const existing = history[today] || {};
    const next = {
      ...history,
      [today]: { ...existing, dismissed: true },
    };
    await persist(next);
  }, [history, persist]);

  // Clear today's priority entirely (lets user start over)
  const clearToday = useCallback(async () => {
    const today = todayStr();
    const next = { ...history };
    delete next[today];
    await persist(next);
  }, [history, persist]);

  const today = history[todayStr()] || null;

  return {
    history,
    loading,
    today,
    setTodayPriority,
    dismissToday,
    clearToday,
  };
}
