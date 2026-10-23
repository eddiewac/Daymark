import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  const tasksRef = useRef(tasks);
  const assignedRef = useRef(assignedTasks);
  tasksRef.current = tasks;
  assignedRef.current = assignedTasks;

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
                      assignedBy: payload.new.assigned_by,
                      assignedAt: payload.new.created_at,
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

  // Helper: compute the next due date for a recurring task
  // Returns "" if the task can't recur or there's no anchor date.
  const nextRecurringDue = (task) => {
    const r = task.recurring;
    if (!r || r === 'none') return '';
    // Anchor on the existing dueDate, or fall back to today
    const anchorStr = task.dueDate || new Date().toISOString().slice(0, 10);
    const d = new Date(anchorStr + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return '';
    if (r === 'daily') d.setDate(d.getDate() + 1);
    else if (r === 'weekly') d.setDate(d.getDate() + 7);
    else if (r === 'monthly') d.setMonth(d.getMonth() + 1);
    else return '';
    return d.toISOString().slice(0, 10);
  };

  const toggleDone = useCallback(
    async (taskId) => {
      const task =
        tasksRef.current.find((t) => t.id === taskId) ||
        assignedRef.current.find((t) => t.id === taskId);
      if (!task) return { ok: false, error: 'Task not found' };
      const prevDone = !!task.done;
      const prevDoneAt = task.doneAt || null;
      const nd = !prevDone;
      const doneAt = nd ? new Date().toISOString() : null;

      const apply = (done, at) => {
        const nextTasks = tasksRef.current.map((t) =>
          t.id === taskId ? { ...t, done, doneAt: at } : t
        );
        const nextAssigned = assignedRef.current.map((t) =>
          t.id === taskId ? { ...t, done, doneAt: at } : t
        );
        tasksRef.current = nextTasks;
        assignedRef.current = nextAssigned;
        setTasks(nextTasks);
        setAssignedTasks(nextAssigned);
      };

      // Optimistic local update — rolled back if the write does not persist.
      apply(nd, doneAt);

      const result = await toggleTaskDoneDb(taskId, nd, doneAt);
      if (!result?.ok) {
        apply(prevDone, prevDoneAt);
        return result || { ok: false, error: 'Could not update task' };
      }

      // If we just COMPLETED a recurring task, spawn the next instance.
      // We don't spawn on un-complete (toggling back to open shouldn't duplicate).
      if (nd && task.recurring && task.recurring !== 'none') {
        const nextDue = nextRecurringDue(task);
        if (nextDue) {
          const next = {
            id: uid(),
            title: task.title,
            priority: task.priority,
            category: task.category,
            project: task.project,
            status: 'To do',
            done: false,
            due: '',
            dueDate: nextDue,
            reminder: '',
            tags: [...(task.tags || [])],
            recurring: task.recurring,
            taskNumber: '',
            expenditureType: task.expenditureType || '',
            links: [...(task.links || [])],
            stationId: task.stationId || null,
            checklistProgress: {},
            createdAt: Date.now(),
            doneAt: null,
            // Inherit assignee
            assignedToId: task.assignedToId || null,
            assignedToEmail: task.assignedToEmail || null,
            // Inherit estimate so weekly recurring tasks keep their planning hours
            estimate: task.estimate || null,
            // Don't carry OOS — by default new instance starts clean
            outOfScope: false,
            outOfScopeHours: null,
            outOfScopeNotes: '',
          };
          const withNext = [next, ...tasksRef.current];
          tasksRef.current = withNext;
          setTasks(withNext);
          const spawned = await saveTask(next, workspaceId);
          if (!spawned?.ok) {
            const without = tasksRef.current.filter((t) => t.id !== next.id);
            tasksRef.current = without;
            setTasks(without);
          }
          if (next.assignedToId && workspaceId) {
            await assignTaskDb(next, next.assignedToId, workspaceId, workspaceName);
          }
        }
      }
      return { ok: true };
    },
    [workspaceId, workspaceName]
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
