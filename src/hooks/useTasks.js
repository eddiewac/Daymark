import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, getCurrentUser } from '../lib/supabase.js';
import {
  loadTasks,
  saveTask,
  deleteTask as deleteTaskDb,
  toggleTaskDone as toggleTaskDoneDb,
  loadAssignedTasks,
  assignTask as assignTaskDb,
  unassignTask as unassignTaskDb,
  dismissAssignment,
} from '../lib/tasks.js';
import { uid } from '../lib/utils.js';

export function useTasks(workspaceId, workspaceName) {
  const [tasks, setTasks] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([loadTasks(workspaceId), loadAssignedTasks()])
      .then(([ts, asgn]) => {
        if (cancelled) return;
        setTasks(ts);
        setAssignedTasks(asgn);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Realtime: tasks table for current scope
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
        .channel(`tasks-${workspaceId || 'personal'}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks', filter },
          (payload) => {
            // For personal scope, also filter out workspace tasks
            if (!workspaceId && payload.new?.workspace_id) return;

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const incoming = {
                ...payload.new.data,
                id: payload.new.id,
                done: payload.new.done,
                doneAt: payload.new.done_at,
              };
              setTasks((prev) => {
                const idx = prev.findIndex((t) => t.id === incoming.id);
                if (idx === -1) return [incoming, ...prev];
                const next = [...prev];
                next[idx] = { ...next[idx], ...incoming };
                return next;
              });
            } else if (payload.eventType === 'DELETE') {
              setTasks((prev) => prev.filter((t) => t.id !== payload.old.id));
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

  // Realtime: assignments table for current user
  useEffect(() => {
    let mounted = true;
    let channel;

    (async () => {
      const user = await getCurrentUser();
      if (!user || !mounted) return;

      channel = supabase
        .channel(`my-assignments-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'assignments',
            filter: `assigned_to=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              setAssignedTasks((prev) =>
                prev.filter(
                  (t) =>
                    t.assignmentId !== payload.old?.id &&
                    t.id !== payload.old?.task_id
                )
              );
            } else if (payload.eventType === 'INSERT') {
              try {
                const snap = JSON.parse(payload.new.task_snapshot || '{}');
                setAssignedTasks((prev) => {
                  if (prev.find((t) => t.assignmentId === payload.new.id)) return prev;
                  return [
                    ...prev,
                    {
                      ...snap,
                      id: payload.new.task_id,
                      assignmentId: payload.new.id,
                      workspaceId: payload.new.workspace_id,
                      assignedFrom: payload.new.workspace_name,
                      isAssigned: true,
                      dismissed: false,
                    },
                  ];
                });
              } catch {
                // ignore malformed snapshot
              }
            } else if (payload.eventType === 'UPDATE') {
              setAssignedTasks((prev) =>
                prev.map((t) =>
                  t.assignmentId === payload.new.id
                    ? { ...t, dismissed: !!payload.new.dismissed }
                    : t
                )
              );
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

  // Merged view: in personal scope, show tasks + assigned; in team scope, just tasks
  const allTasks = useMemo(() => {
    if (workspaceId) return tasks;
    const ids = new Set(tasks.map((t) => t.id));
    return [...tasks, ...assignedTasks.filter((t) => !ids.has(t.id) && !t.dismissed)];
  }, [tasks, assignedTasks, workspaceId]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const addTask = useCallback(
    async (partial) => {
      const newTask = {
        id: uid(),
        title: '',
        priority: 'Medium',
        category: '',
        project: '',
        status: 'To do',
        done: false,
        due: '',
        dueDate: '',
        reminder: '',
        tags: [],
        recurring: 'none',
        taskNumber: '',
        expenditureType: '',
        links: [],
        checklistProgress: {},
        createdAt: Date.now(),
        doneAt: null,
        ...partial,
      };
      setTasks((prev) => [newTask, ...prev]);
      await saveTask(newTask, workspaceId);

      // If created with assignee, write the assignment record
      if (newTask.assignedToId && workspaceId) {
        await assignTaskDb(newTask, newTask.assignedToId, workspaceId, workspaceName);
      }

      return newTask;
    },
    [workspaceId, workspaceName]
  );

  const updateTask = useCallback(
    async (taskId, patch) => {
      let updated;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          updated = { ...t, ...patch };
          return updated;
        })
      );
      if (updated) {
        await saveTask(updated, workspaceId);
      }
    },
    [workspaceId]
  );

  const deleteTask = useCallback(
    async (taskId) => {
      // If this is an assigned task, dismiss the assignment instead of deleting
      const assignedRow = assignedTasks.find((t) => t.id === taskId);
      if (assignedRow && !workspaceId) {
        setAssignedTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, dismissed: true } : t
          )
        );
        await dismissAssignment(assignedRow.assignmentId);
        return;
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      await deleteTaskDb(taskId);
    },
    [assignedTasks, workspaceId]
  );

  const toggleDone = useCallback(
    async (taskId) => {
      const task =
        tasks.find((t) => t.id === taskId) || assignedTasks.find((t) => t.id === taskId);
      if (!task) return;
      const nd = !task.done;
      const doneAt = nd ? new Date().toISOString() : null;

      // Optimistic local update
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, done: nd, doneAt } : t))
      );
      setAssignedTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, done: nd, doneAt } : t))
      );

      await toggleTaskDoneDb(taskId, nd, doneAt);
    },
    [tasks, assignedTasks]
  );

  const assignToMember = useCallback(
    async (taskOrId, memberId, memberEmail) => {
      // Accept either an object (right after creation) or just the id
      const task =
        typeof taskOrId === 'object' ? taskOrId : tasks.find((t) => t.id === taskOrId);
      if (!task) return;

      const updated = {
        ...task,
        assignedToId: memberId,
        assignedToEmail: memberEmail,
      };
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      await saveTask(updated, workspaceId);

      if (workspaceId) {
        await assignTaskDb(updated, memberId, workspaceId, workspaceName);
      }
    },
    [tasks, workspaceId, workspaceName]
  );

  const unassignFromMember = useCallback(
    async (taskId) => {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        const updated = { ...task, assignedToId: null, assignedToEmail: null };
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
        await saveTask(updated, workspaceId);
      }
      await unassignTaskDb(taskId);
    },
    [tasks, workspaceId]
  );

  return {
    tasks,
    assignedTasks,
    allTasks,
    loading,
    addTask,
    updateTask,
    deleteTask,
    toggleDone,
    assignToMember,
    unassignFromMember,
  };
}
