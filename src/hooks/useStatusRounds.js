import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, getCurrentUser } from '../lib/supabase.js';
import {
  loadStatusRounds,
  createStatusRound,
  updateStatusRound,
  deleteStatusRound,
} from '../lib/statusRounds.js';

export function useStatusRounds(workspaceId) {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const lastLocalSaveAt = useRef(0);

  // Load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadStatusRounds(workspaceId)
      .then((rows) => {
        if (!cancelled) setRounds(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Realtime
  useEffect(() => {
    let mounted = true;
    let channel;

    (async () => {
      const user = await getCurrentUser();
      if (!user || !mounted) return;

      const filter = workspaceId
        ? `workspace_id=eq.${workspaceId}`
        : `user_id=eq.${user.id}`;

      channel = supabase
        .channel(`status-rounds-${workspaceId || user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'status_rounds',
            filter,
          },
          () => {
            if (!mounted) return;
            if (Date.now() - lastLocalSaveAt.current < 1500) return;
            loadStatusRounds(workspaceId).then((rows) => {
              if (mounted) setRounds(rows);
            });
          }
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  const addRound = useCallback(
    async (round) => {
      lastLocalSaveAt.current = Date.now();
      const created = await createStatusRound(workspaceId, round);
      if (created) {
        setRounds((prev) => [created, ...prev]);
      }
      return created;
    },
    [workspaceId]
  );

  const editRound = useCallback(async (id, patch) => {
    lastLocalSaveAt.current = Date.now();
    setRounds((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
    const updated = await updateStatusRound(id, patch);
    if (updated) {
      setRounds((prev) =>
        prev.map((r) => (r.id === id ? updated : r))
      );
    }
  }, []);

  const removeRound = useCallback(async (id) => {
    lastLocalSaveAt.current = Date.now();
    setRounds((prev) => prev.filter((r) => r.id !== id));
    await deleteStatusRound(id);
  }, []);

  return {
    rounds,
    loading,
    addRound,
    editRound,
    removeRound,
  };
}
