import { useEffect, useState, useCallback } from 'react';
import { loadUserPrefs, saveUserPrefs, DEFAULT_USER_PREFS } from '../lib/userPrefs.js';

export function useUserPrefs() {
  const [prefs, setPrefs] = useState(DEFAULT_USER_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadUserPrefs()
      .then((p) => {
        if (!cancelled) setPrefs(p);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updatePrefs = useCallback(
    async (patch) => {
      const next = { ...prefs, ...patch };
      setPrefs(next);
      await saveUserPrefs(next);
    },
    [prefs]
  );

  return { prefs, loading, updatePrefs };
}
