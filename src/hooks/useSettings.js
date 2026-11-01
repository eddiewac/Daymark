import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, getCurrentUser } from '../lib/supabase.js';
import { loadSettings, saveSettings, DEFAULT_SETTINGS, settingsStorageKey } from '../lib/settings.js';
import { useSaveStatus } from '../components/save/SaveStatus.jsx';

function timestampMs(value) {
  const n = Date.parse(value || '');
  return Number.isNaN(n) ? null : n;
}

// True when `incoming` is a real timestamp at or before `previous`.
// Unparseable values are not treated as older — string order is not time order.
function isAtOrBefore(incoming, previous) {
  const a = timestampMs(incoming);
  const b = timestampMs(previous);
  if (a == null || b == null) return false;
  return a <= b;
}

export function useSettings(workspaceId) {
  const { showToast } = useSaveStatus();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState(null);

  // Latest list the user is looking at. Reorder clicks must not save a copy
  // captured on an earlier render, or a slower write puts the old order back.
  const settingsRef = useRef(settings);
  // Last snapshot the server accepted. A rejected write rolls back to this.
  const persistedRef = useRef(settings);
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
        if (!cancelled) {
          persistedRef.current = s;
          applySettings(s);
        }
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

      const key = settingsStorageKey(user, workspaceId);

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
              persistedRef.current = DEFAULT_SETTINGS;
              applySettings(DEFAULT_SETTINGS);
              return;
            }

            const incomingAt = payload.new?.updated_at || '';
            if (isAtOrBefore(incomingAt, lastWriteAt.current)) return;

            const value = payload.new?.value;
            if (!value) return;
            try {
              const parsed = JSON.parse(value);
              const next = { ...DEFAULT_SETTINGS, ...parsed };
              persistedRef.current = next;
              applySettings(next);
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
        const result = await saveSettings(workspaceId, generation);
        if (settingsRef.current !== generation) return;
        if (!result?.ok) {
          applySettings(persistedRef.current);
          showToast('Couldn’t save settings');
          return;
        }
        persistedRef.current = generation;
        const writtenAt = result.updatedAt;
        const writtenMs = timestampMs(writtenAt);
        const prevMs = timestampMs(lastWriteAt.current);
        if (writtenMs != null && (prevMs == null || writtenMs > prevMs)) {
          lastWriteAt.current = writtenAt;
        }
        setSavedAt(Date.now());
      });
      saveQueue.current = run;
      await run;
    },
    [workspaceId, showToast]
  );

  return { settings, loading, updateSettings, savedAt };
}
