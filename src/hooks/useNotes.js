import { useEffect, useState, useCallback } from 'react';
import { supabase, getCurrentUser } from '../lib/supabase.js';
import {
  loadNotes,
  saveNote,
  deleteNote as deleteNoteDb,
  moveNote as moveNoteDb,
} from '../lib/notes.js';
import { uid } from '../lib/utils.js';

export function useNotes(workspaceId) {
  const [personal, setPersonal] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadNotes(workspaceId)
      .then(({ personal, team }) => {
        if (cancelled) return;
        setPersonal(personal);
        setTeam(team);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Realtime: personal notes (always)
  useEffect(() => {
    let mounted = true;
    let channel;

    (async () => {
      const user = await getCurrentUser();
      if (!user || !mounted) return;

      channel = supabase
        .channel(`notes-personal-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notes',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            // Only personal-scope rows (workspace_id null)
            const wsNew = payload.new?.workspace_id;
            const wsOld = payload.old?.workspace_id;

            if (payload.eventType === 'DELETE') {
              setPersonal((prev) => prev.filter((n) => n.id !== payload.old.id));
              setTeam((prev) => prev.filter((n) => n.id !== payload.old.id));
              return;
            }

            const note = {
              ...payload.new.data,
              id: payload.new.id,
              workspaceId: wsNew,
              userId: payload.new.user_id,
            };

            if (wsNew === null) {
              // Now a personal note — add or update in personal, remove from team
              setPersonal((prev) => {
                const idx = prev.findIndex((n) => n.id === note.id);
                if (idx === -1) return [note, ...prev];
                const next = [...prev];
                next[idx] = note;
                return next;
              });
              setTeam((prev) => prev.filter((n) => n.id !== note.id));
            } else {
              // Moved out of personal scope - remove from personal list
              setPersonal((prev) => prev.filter((n) => n.id !== note.id));
            }
          }
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Realtime: team notes (only when in a workspace)
  useEffect(() => {
    if (!workspaceId) return;

    let mounted = true;
    let channel;

    channel = supabase
      .channel(`notes-team-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setTeam((prev) => prev.filter((n) => n.id !== payload.old.id));
            return;
          }
          const note = {
            ...payload.new.data,
            id: payload.new.id,
            workspaceId: payload.new.workspace_id,
            userId: payload.new.user_id,
          };
          setTeam((prev) => {
            const idx = prev.findIndex((n) => n.id === note.id);
            if (idx === -1) return [note, ...prev];
            const next = [...prev];
            next[idx] = note;
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const addNote = useCallback(
    async ({ title = '', body = '', projectId = null, projectName = null }, isTeam = false) => {
      const newNote = {
        id: uid(),
        title,
        body,
        projectId,
        projectName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      if (isTeam) {
        setTeam((prev) => [{ ...newNote, workspaceId }, ...prev]);
      } else {
        setPersonal((prev) => [{ ...newNote, workspaceId: null }, ...prev]);
      }
      await saveNote(newNote, isTeam, workspaceId);
      return newNote;
    },
    [workspaceId]
  );

  const updateNote = useCallback(
    async (noteId, patch, isTeam) => {
      const list = isTeam ? team : personal;
      const note = list.find((n) => n.id === noteId);
      if (!note) return;
      const updated = { ...note, ...patch, updatedAt: Date.now() };
      const setter = isTeam ? setTeam : setPersonal;
      setter((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
      await saveNote(updated, isTeam, workspaceId);
    },
    [personal, team, workspaceId]
  );

  const deleteNote = useCallback(async (noteId, isTeam) => {
    const setter = isTeam ? setTeam : setPersonal;
    setter((prev) => prev.filter((n) => n.id !== noteId));
    await deleteNoteDb(noteId);
  }, []);

  const moveNote = useCallback(
    async (noteId, toTeam) => {
      const fromList = toTeam ? personal : team;
      const note = fromList.find((n) => n.id === noteId);
      if (!note) return;

      // Optimistic: move locally
      if (toTeam) {
        setPersonal((prev) => prev.filter((n) => n.id !== noteId));
        setTeam((prev) => [{ ...note, workspaceId }, ...prev]);
      } else {
        setTeam((prev) => prev.filter((n) => n.id !== noteId));
        setPersonal((prev) => [{ ...note, workspaceId: null }, ...prev]);
      }

      await moveNoteDb(note, toTeam, workspaceId);
    },
    [personal, team, workspaceId]
  );

  return {
    personal,
    team,
    loading,
    addNote,
    updateNote,
    deleteNote,
    moveNote,
  };
}
