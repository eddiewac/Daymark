import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, getCurrentUser } from '../lib/supabase.js';
import {
  loadCongresses,
  createCongress,
  updateCongress,
  deleteCongress,
} from '../lib/congresses.js';

export function useCongresses(workspaceId) {
  const [congresses, setCongresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const lastLocalSaveAt = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadCongresses(workspaceId)
      .then((rows) => {
        if (!cancelled) setCongresses(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

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
        .channel(`congresses-${workspaceId || user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'congresses',
            filter,
          },
          () => {
            if (!mounted) return;
            if (Date.now() - lastLocalSaveAt.current < 1500) return;
            loadCongresses(workspaceId).then((rows) => {
              if (mounted) setCongresses(rows);
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

  const addCongress = useCallback(
    async (congress) => {
      lastLocalSaveAt.current = Date.now();
      const created = await createCongress(workspaceId, congress);
      if (created) {
        setCongresses((prev) => [...prev, created]);
      }
      return created;
    },
    [workspaceId]
  );

  const editCongress = useCallback(async (id, patch) => {
    lastLocalSaveAt.current = Date.now();
    setCongresses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
    const updated = await updateCongress(id, patch);
    if (updated) {
      setCongresses((prev) =>
        prev.map((c) => (c.id === id ? updated : c))
      );
    }
  }, []);

  const removeCongress = useCallback(async (id) => {
    lastLocalSaveAt.current = Date.now();
    setCongresses((prev) => prev.filter((c) => c.id !== id));
    await deleteCongress(id);
  }, []);

  return {
    congresses,
    loading,
    addCongress,
    editCongress,
    removeCongress,
  };
}
