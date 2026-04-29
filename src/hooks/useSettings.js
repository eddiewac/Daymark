import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, getCurrentUser } from '../lib/supabase.js';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../lib/settings.js';

export function useSettings(workspaceId) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState(null);

  // Track our own writes so we can ignore the realtime echo we'd otherwise apply
  // on top of state we just set locally. Without this we get an unnecessary
  // re-render and a brief moment where the user sees the write bounce.
  const lastLocalSaveAt = useRef(0);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadSettings(workspaceId)
      .then((s) => {
        if (!cancelled) setSettings(s);
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
            // Ignore our own write echoes
            if (Date.now() - lastLocalSaveAt.current < 1500) return;

            if (payload.eventType === 'DELETE') {
              setSettings(DEFAULT_SETTINGS);
              return;
            }

            const value = payload.new?.value;
            if (!value) return;
            try {
              const parsed = JSON.parse(value);
              setSettings({ ...DEFAULT_SETTINGS, ...parsed });
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
      const next = { ...settings, ...patch };
      setSettings(next);
      lastLocalSaveAt.current = Date.now();
      await saveSettings(workspaceId, next);
      setSavedAt(Date.now());
    },
    [settings, workspaceId]
  );

  return { settings, loading, updateSettings, savedAt };
}
