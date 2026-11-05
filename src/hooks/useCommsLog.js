import { useCallback, useEffect, useState } from 'react';
import { getCurrentUser } from '../lib/supabase.js';
import { deleteCommsForProject, insertCommsLog, loadCommsLog } from '../lib/commsLog.js';

export function useCommsLog(workspaceId) {
  const [rows, setRows] = useState([]);
  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    let cancelled = false;
    setRows([]);
    setCurrentUserId('');
    Promise.all([loadCommsLog(workspaceId), getCurrentUser()]).then(([list, user]) => {
      if (cancelled) return;
      setRows(list);
      setCurrentUserId(user?.id || '');
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const addEntry = useCallback(async (entry) => {
    const result = await insertCommsLog(entry, workspaceId);
    if (result.ok && result.entry) {
      setRows((prev) => [result.entry, ...prev.filter((row) => row.id !== result.entry.id)]);
    }
    return result;
  }, [workspaceId]);

  const removeForProject = useCallback(async (projectId) => {
    setRows((prev) => prev.filter((row) => row.projectId !== projectId));
    return deleteCommsForProject(projectId);
  }, []);

  return { rows, currentUserId, addEntry, removeForProject };
}
