import { useEffect, useState, useCallback } from 'react';
import { loadMyResourceData } from '../lib/resource.js';

// ── useResourceData ─────────────────────────────────────────────────────────
//
// Loads cross-workspace task data for the Resource view. No realtime
// subscription in Stage 1 — opening the tab fetches fresh; a refresh action
// re-pulls on demand. We can add realtime later if it's worth it.

export function useResourceData() {
  const [entries, setEntries] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadMyResourceData();
      setEntries(result.entries);
      setWorkspaces(result.workspaces);
    } catch (e) {
      console.error('useResourceData:', e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await loadMyResourceData();
        if (cancelled) return;
        setEntries(result.entries);
        setWorkspaces(result.workspaces);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { entries, workspaces, loading, error, refresh: fetchAll };
}
