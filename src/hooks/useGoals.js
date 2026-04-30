import { useEffect, useState, useCallback } from 'react';
import { loadGoals, saveGoals } from '../lib/goals.js';
import { uid } from '../lib/utils.js';

export function useGoals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadGoals()
      .then((g) => {
        if (!cancelled) setGoals(g);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist + update local state in one go
  const persist = useCallback(async (next) => {
    setGoals(next);
    await saveGoals(next);
  }, []);

  const addGoal = useCallback(
    async ({ title, description }) => {
      const newGoal = {
        id: uid(),
        title: (title || '').trim(),
        description: (description || '').trim(),
        archived: false,
        entries: [],
        createdAt: Date.now(),
      };
      await persist([...goals, newGoal]);
      return newGoal;
    },
    [goals, persist]
  );

  const updateGoal = useCallback(
    async (id, patch) => {
      await persist(goals.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    },
    [goals, persist]
  );

  const removeGoal = useCallback(
    async (id) => {
      await persist(goals.filter((g) => g.id !== id));
    },
    [goals, persist]
  );

  // Add an evidence entry to a goal
  const addEvidence = useCallback(
    async (goalId, text) => {
      const trimmed = (text || '').trim();
      if (!trimmed) return;
      const entry = { id: uid(), ts: Date.now(), text: trimmed };
      await persist(
        goals.map((g) =>
          g.id === goalId
            ? { ...g, entries: [entry, ...(g.entries || [])] }
            : g
        )
      );
    },
    [goals, persist]
  );

  const updateEvidence = useCallback(
    async (goalId, entryId, text) => {
      await persist(
        goals.map((g) => {
          if (g.id !== goalId) return g;
          return {
            ...g,
            entries: (g.entries || []).map((e) =>
              e.id === entryId ? { ...e, text: (text || '').trim() } : e
            ),
          };
        })
      );
    },
    [goals, persist]
  );

  const removeEvidence = useCallback(
    async (goalId, entryId) => {
      await persist(
        goals.map((g) => {
          if (g.id !== goalId) return g;
          return {
            ...g,
            entries: (g.entries || []).filter((e) => e.id !== entryId),
          };
        })
      );
    },
    [goals, persist]
  );

  return {
    goals,
    loading,
    addGoal,
    updateGoal,
    removeGoal,
    addEvidence,
    updateEvidence,
    removeEvidence,
  };
}
