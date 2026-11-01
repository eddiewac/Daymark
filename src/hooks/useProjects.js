import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, getCurrentUser } from '../lib/supabase.js';
import {
  loadProjects,
  saveProject,
  deleteProject as deleteProjectDb,
} from '../lib/projects.js';
import { uid } from '../lib/utils.js';

function timestampMs(value) {
  const n = Date.parse(value || '');
  return Number.isNaN(n) ? null : n;
}

// True when `incoming` is a real timestamp at or before `previous`.
// Unparseable values are not treated as older — string order is not time order
// (`+00:00` sorts before `Z`).
function isAtOrBefore(incoming, previous) {
  const a = timestampMs(incoming);
  const b = timestampMs(previous);
  if (a == null || b == null) return false;
  return a <= b;
}

function cloneProject(project) {
  return JSON.parse(JSON.stringify(project));
}

export function useProjects(workspaceId) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  // Mirror of projects that is safe to read inside event handlers. Writing the
  // next snapshot here (not inside a setState updater) is what makes the save
  // actually run — React does not always invoke updaters before the next line.
  // Not assigned from `projects` on every render: that would put a stale list
  // back over a resolve that had already been applied.
  const projectsRef = useRef(projects);
  // Last snapshot the server accepted, per project. A rejected write rolls back
  // to this instead of leaving the cleared row on screen.
  const persistedRef = useRef(new Map());
  // One write at a time per project. Overlapping full-row saves used to finish
  // out of order, so an older snapshot (the waiting item still on it) could be
  // the last thing stored. Refresh then brought the item back.
  const chainsRef = useRef({});
  // Failure of the write that is still on screen. A follow-up flush that only
  // sees the restored row must report that failure, not a fake success.
  const lastFailRef = useRef({});
  // Project ids with a save in flight. Realtime echoes during that window are
  // ignored so a stale payload can't restore a row we just resolved.
  const inflightRef = useRef(new Set());
  const lastWriteAtRef = useRef({});

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadProjects(workspaceId)
      .then((list) => {
        if (cancelled) return;
        const kept = new Map();
        for (const project of list) kept.set(project.id, cloneProject(project));
        persistedRef.current = kept;
        chainsRef.current = {};
        lastFailRef.current = {};
        lastWriteAtRef.current = {};
        inflightRef.current = new Set();
        projectsRef.current = list;
        setProjects(list);
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
        .channel(`projects-${workspaceId || 'personal'}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'projects', filter },
          (payload) => {
            if (!workspaceId && payload.new?.workspace_id) return;

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              if (inflightRef.current.has(payload.new?.id)) return;
              const incomingAt = payload.new?.updated_at || '';
              const known = lastWriteAtRef.current[payload.new?.id] || '';
              if (isAtOrBefore(incomingAt, known)) return;
              const incoming = {
                ...payload.new.data,
                id: payload.new.id,
                deliverables: payload.new.data?.deliverables || [],
                stations: payload.new.data?.stations || [],
                congresses: payload.new.data?.congresses || [],
              };
              persistedRef.current.set(incoming.id, cloneProject(incoming));
              if (incomingAt) lastWriteAtRef.current[incoming.id] = incomingAt;
              setProjects((prev) => {
                const idx = prev.findIndex((p) => p.id === incoming.id);
                const next = idx === -1 ? [incoming, ...prev] : prev.map((p, i) => (i === idx ? incoming : p));
                projectsRef.current = next;
                return next;
              });
            } else if (payload.eventType === 'DELETE') {
              persistedRef.current.delete(payload.old.id);
              setProjects((prev) => {
                const next = prev.filter((p) => p.id !== payload.old.id);
                projectsRef.current = next;
                return next;
              });
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

  // ── Actions ───────────────────────────────────────────────────────────────

  const addProject = useCallback(
    async (partial = {}) => {
      const newProject = {
        id: uid(),
        name: partial.name || 'New project',
        number: '',
        status: '',
        nextSteps: '',
        blockers: '',
        startDate: '',
        deliverables: [],
        stations: [],
        congresses: [],
        ...partial,
      };
      const next = [newProject, ...projectsRef.current];
      projectsRef.current = next;
      setProjects(next);
      const saved = await saveProject(newProject, workspaceId);
      if (saved?.ok) persistedRef.current.set(newProject.id, cloneProject(newProject));
      return saved?.ok === false ? { ...newProject, _saveError: saved.error } : newProject;
    },
    [workspaceId]
  );

  // Local-only merge. Used to roll back a failed optimistic write without
  // firing another request (the server still has the previous row).
  const patchProject = useCallback((projectId, patch) => {
    const prev = projectsRef.current;
    const current = prev.find((p) => p.id === projectId);
    if (!current) return null;
    const updated = { ...current, ...patch };
    const next = prev.map((p) => (p.id === projectId ? updated : p));
    projectsRef.current = next;
    setProjects(next);
    return updated;
  }, []);

  // Write whatever the ref holds now, not the snapshot from when the click
  // started. A newer edit queued behind this one runs only after this request
  // finishes, so an older row cannot land last.
  const flushProject = useCallback(
    async (projectId) => {
      const snapshot = projectsRef.current.find((p) => p.id === projectId);
      if (!snapshot) return { ok: false, error: 'Project not found' };
      const persisted = persistedRef.current.get(projectId);
      if (persisted && JSON.stringify(persisted) === JSON.stringify(snapshot)) {
        return lastFailRef.current[projectId] || { ok: true };
      }
      inflightRef.current.add(projectId);
      let result;
      try {
        result = await saveProject(snapshot, workspaceId);
      } catch (err) {
        result = { ok: false, error: err?.message || 'Could not save project' };
      }
      const stillCurrent = projectsRef.current.find((p) => p.id === projectId) === snapshot;
      if (result?.ok) {
        if (stillCurrent) {
          persistedRef.current.set(projectId, cloneProject(snapshot));
          delete lastFailRef.current[projectId];
          if (result.updatedAt) lastWriteAtRef.current[projectId] = result.updatedAt;
        }
        return result;
      }
      lastFailRef.current[projectId] = result || { ok: false, error: 'Could not save project' };
      // Nothing newer replaced this snapshot. Put the server copy back so the
      // row does not stay cleared until a refresh.
      if (stillCurrent && persisted) {
        const restored = cloneProject(persisted);
        const next = projectsRef.current.map((p) => (p.id === projectId ? restored : p));
        projectsRef.current = next;
        setProjects(next);
      }
      return result || { ok: false, error: 'Could not save project' };
    },
    [workspaceId]
  );

  const updateProject = useCallback(
    (projectId, patchOrFn) => {
      const current = projectsRef.current.find((p) => p.id === projectId);
      if (!current) return Promise.resolve({ ok: false, error: 'Project not found' });
      // A function reads the latest ref, so a second resolve in the same turn
      // composes onto the first instead of replacing it with a stale list.
      const patch = typeof patchOrFn === 'function' ? patchOrFn(current) : patchOrFn;
      if (!patch) return Promise.resolve({ ok: false, error: 'Nothing to save' });
      const updated = patchProject(projectId, patch);
      if (!updated) return Promise.resolve({ ok: false, error: 'Project not found' });

      // Hold the realtime gate across the whole chain. Clearing it between two
      // queued writes lets the older echo paint the waiting item back, and the
      // next flush then stores that echo.
      inflightRef.current.add(projectId);
      const prev = chainsRef.current[projectId] || Promise.resolve();
      const run = prev.catch(() => {}).then(() => flushProject(projectId));
      chainsRef.current[projectId] = run;
      run.finally(() => {
        if (chainsRef.current[projectId] === run) inflightRef.current.delete(projectId);
      });
      return run;
    },
    [flushProject, patchProject]
  );

  const deleteProject = useCallback(
    async (projectId) => {
      const next = projectsRef.current.filter((p) => p.id !== projectId);
      projectsRef.current = next;
      persistedRef.current.delete(projectId);
      setProjects(next);
      await deleteProjectDb(projectId);
    },
    []
  );

  // Helpers for nested entities (deliverables and stations live inside projects)
  const updateDeliverables = useCallback(
    async (projectId, newDeliverables) => {
      await updateProject(projectId, { deliverables: newDeliverables });
    },
    [updateProject]
  );

  const updateStations = useCallback(
    async (projectId, newStations) => {
      await updateProject(projectId, { stations: newStations });
    },
    [updateProject]
  );

  return {
    projects,
    loading,
    addProject,
    updateProject,
    patchProject,
    deleteProject,
    updateDeliverables,
    updateStations,
  };
}
