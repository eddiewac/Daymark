import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, getCurrentUser } from '../lib/supabase.js';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../lib/settings.js';

export function useSettings(workspaceId) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState(null);

  // Latest list the user is looking at. Reorder clicks must not save a copy
  // captured on an earlier render, or a slower write puts the old order back.
  const settingsRef = useRef(settings);
  const saveQueue = useRef(Promise.resolve());
  // updated_at of the newest settings row we wrote. Older realtime echoes
  // (a previous order) must not replace the list on screen.
  const lastWriteAt = useRef('');

  const applySettings = (next) => {
    settingsRef.current = next;
    setSettings(next);
  };

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    lastWriteAt.current = '';
    loadSettings(workspaceId)
      .then((s) => {
        if (!cancelled) applySettings(s);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Realtime: subscribe to the specific app_storage row for this workspace's
  // settings. We compute the key the same way as settings.js does.
  useEffect(() => {
    let mounted = true;
    let channel;

    (async () => {
      const user = await getCurrentUser();
      if (!user || !mounted) return;

      const key = workspaceId
        ? `ws:${workspaceId}:settings-v1`
        : `${user.id}:settings-v1`;

      // PostgREST filters use the same column name in the realtime API
      channel = supabase
        .channel(`settings-${key}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'app_storage',
            filter: `key=eq.${key}`,
          },
          (payload) => {
            if (!mounted) return;

            if (payload.eventType === 'DELETE') {
              lastWriteAt.current = '';
              applySettings(DEFAULT_SETTINGS);
              return;
            }

            const incomingAt = payload.new?.updated_at || '';
            if (incomingAt && lastWriteAt.current && incomingAt <= lastWriteAt.current) return;

            const value = payload.new?.value;
            if (!value) return;
            try {
              const parsed = JSON.parse(value);
              applySettings({ ...DEFAULT_SETTINGS, ...parsed });
              if (incomingAt) lastWriteAt.current = incomingAt;
              setSavedAt(Date.now());
            } catch {
              // ignore malformed
            }
          }
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  const updateSettings = useCallback(
    async (patch) => {
      const next = { ...settingsRef.current, ...patch };
      applySettings(next);
      const generation = next;
      const run = saveQueue.current.catch(() => {}).then(async () => {
        // A newer edit already replaced this snapshot. Writing it now would
        // put the previous order back.
        if (settingsRef.current !== generation) return;
        const writtenAt = await saveSettings(workspaceId, generation);
        if (!writtenAt || settingsRef.current !== generation) return;
        if (!lastWriteAt.current || writtenAt > lastWriteAt.current) {
          lastWriteAt.current = writtenAt;
        }
        setSavedAt(Date.now());
      });
      saveQueue.current = run;
      await run;
    },
    [workspaceId]
  );

  return { settings, loading, updateSettings, savedAt };
}
