import { useEffect, useState, useCallback } from 'react';
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
      setProjects((prev) => [newProject, ...prev]);
      await saveProject(newProject, workspaceId);
      return newProject;
    },
    [workspaceId]
  );

  const updateProject = useCallback(
    async (projectId, patch) => {
      let updated;
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          updated = { ...p, ...patch };
          return updated;
        })
      );
      if (updated) await saveProject(updated, workspaceId);
    },
    [workspaceId]
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
    deleteProject,
    updateDeliverables,
    updateStations,
  };
}
