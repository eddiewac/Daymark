import { useEffect, useState, useCallback } from 'react';
import { loadMyResourceData, loadSharedResourceData } from '../lib/resource.js';
import { loadMyShares } from '../lib/loadShares.js';

// ── useResourceData ─────────────────────────────────────────────────────────
//
// Loads cross-workspace task data for the Resource view:
//   • entries      — my own assigned work across my workspaces
//   • sharedTasks  — work belonging to people who've shared with me (via the
//                    get_shared_load() security-definer function)
//   • sharers      — the accepted shares (for display names / row labels)
//
// No realtime subscription yet — opening the tab fetches fresh; refresh re-pulls.

export function useResourceData() {
  const [entries, setEntries] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [sharedTasks, setSharedTasks] = useState([]);
  const [sharers, setSharers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mine, shared, shares] = await Promise.all([
        loadMyResourceData(),
        loadSharedResourceData(),
        loadMyShares(),
      ]);
      setEntries(mine.entries);
      setWorkspaces(mine.workspaces);
      setSharedTasks(shared);
      setSharers(shares.sharingWithMe || []);
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
        const [mine, shared, shares] = await Promise.all([
          loadMyResourceData(),
          loadSharedResourceData(),
          loadMyShares(),
        ]);
        if (cancelled) return;
        setEntries(mine.entries);
        setWorkspaces(mine.workspaces);
        setSharedTasks(shared);
        setSharers(shares.sharingWithMe || []);
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

  return {
    entries,
    workspaces,
    sharedTasks,
    sharers,
    loading,
    error,
    refresh: fetchAll,
  };
}
