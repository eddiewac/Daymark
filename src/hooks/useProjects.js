import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, getCurrentUser } from '../lib/supabase.js';
import {
  loadProjects,
  saveProject,
  deleteProject as deleteProjectDb,
} from '../lib/projects.js';
import { uid } from '../lib/utils.js';

export function useProjects(workspaceId) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  // Mirror of projects that is safe to read inside event handlers. Writing the
  // next snapshot here (not inside a setState updater) is what makes the save
  // actually run — React does not always invoke updaters before the next line.
  const projectsRef = useRef(projects);
  projectsRef.current = projects;
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
        if (!cancelled) setProjects(list);
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
              if (known && incomingAt && incomingAt < known) return;
              const incoming = {
                ...payload.new.data,
                id: payload.new.id,
                deliverables: payload.new.data?.deliverables || [],
                stations: payload.new.data?.stations || [],
                congresses: payload.new.data?.congresses || [],
              };
              setProjects((prev) => {
                const idx = prev.findIndex((p) => p.id === incoming.id);
                if (idx === -1) return [incoming, ...prev];
                const next = [...prev];
                next[idx] = incoming;
                return next;
              });
            } else if (payload.eventType === 'DELETE') {
              setProjects((prev) => prev.filter((p) => p.id !== payload.old.id));
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

  const updateProject = useCallback(
    async (projectId, patch) => {
      const current = projectsRef.current.find((p) => p.id === projectId);
      if (!current) return { ok: false, error: 'Project not found' };
      const updated = patchProject(projectId, patch);
      if (!updated) return { ok: false, error: 'Project not found' };
      const stamp = new Date().toISOString();
      inflightRef.current.add(projectId);
      let result;
      try {
        result = await saveProject(updated, workspaceId);
      } catch (err) {
        result = { ok: false, error: err?.message || 'Could not save project' };
      } finally {
        inflightRef.current.delete(projectId);
      }
      if (result?.ok) lastWriteAtRef.current[projectId] = stamp;
      return result || { ok: false, error: 'Could not save project' };
    },
    [patchProject, workspaceId]
  );

  const deleteProject = useCallback(
    async (projectId) => {
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
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
