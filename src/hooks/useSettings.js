import { useEffect, useState, useCallback } from 'react';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../lib/settings.js';

export function useSettings(workspaceId) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

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

  // Update locally + persist
  const updateSettings = useCallback(
    async (patch) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      await saveSettings(workspaceId, next);
    },
    [settings, workspaceId]
  );

  return { settings, loading, updateSettings };
}
