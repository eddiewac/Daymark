import { useEffect, useRef, useState } from 'react';
import TaskMultiSelect from './TaskMultiSelect.jsx';

export default function NoteEditor({
  note,
  isTeam,
  projects,
  tasks,
  workspaceId,
  onUpdate,
  onDelete,
  onMove,
  onClose,
}) {
  const [title, setTitle] = useState(note.title || '');
  const [body, setBody] = useState(note.body || '');
  const [projectName, setProjectName] = useState(note.projectName || '');
  const [taskIds, setTaskIds] = useState(note.taskIds || []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saveTimer = useRef(null);

  // Reset local state when note id changes
  useEffect(() => {
    setTitle(note.title || '');
    setBody(note.body || '');
    setProjectName(note.projectName || '');
    setTaskIds(note.taskIds || []);
    setConfirmDelete(false);
  }, [note.id]);

  // Debounced auto-save
  useEffect(() => {
    const noteTaskIds = note.taskIds || [];
    const sameTaskIds =
      taskIds.length === noteTaskIds.length &&
      taskIds.every((id) => noteTaskIds.includes(id));
    if (
      title === (note.title || '') &&
      body === (note.body || '') &&
      projectName === (note.projectName || '') &&
      sameTaskIds
    ) {
      return;
    }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onUpdate(note.id, {
        title,
        body,
        projectName: projectName || null,
        projectId: projectName
          ? projects?.find((p) => p.name === projectName)?.id || null
          : null,
        taskIds,
      }, isTeam);
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [title, body, projectName, taskIds]);

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div style={styles.scopeBadge}>
          {isTeam ? '🏢 Team note' : '📝 My note'}
        </div>
        <button onClick={onClose} style={styles.closeBtn} title="Close">
          ×
        </button>
      </div>

      <div style={styles.toolRow}>
        <select
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          style={styles.projectSelect}
        >
          <option value="">No project</option>
          {(projects || []).map((p) => (
            <option key={p.id} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>

        {workspaceId && (
          <button
            onClick={() => onMove(note.id, !isTeam)}
            style={styles.moveBtn}
            title={
              isTeam
                ? 'Move this note to your personal notes'
                : 'Share this note with the team'
            }
          >
            {isTeam ? '↩ Move to personal' : '↗ Move to team'}
          </button>
        )}
      </div>

      <div style={styles.taskRow}>
        <span style={styles.taskRowLabel}>Tasks</span>
        <div style={{ flex: 1 }}>
          <TaskMultiSelect
            tasks={tasks || []}
            taskIds={taskIds}
            preferredProject={projectName}
            onChange={setTaskIds}
            placeholder="+ Tag a task"
          />
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title…"
        style={styles.titleInput}
      />

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Start writing…"
        style={styles.bodyArea}
      />

      <div style={styles.footer}>
        <span style={styles.footerNote}>
          Saved {note.updatedAt
            ? new Date(note.updatedAt).toLocaleString()
            : 'just now'}
        </span>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} style={styles.deleteBtn}>
            Delete note
          </button>
        ) : (
          <div style={styles.confirmRow}>
            <button
              onClick={() => onDelete(note.id, isTeam)}
              style={styles.deleteConfirm}
            >
              Yes, delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={styles.cancelBtn}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-surface)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  scopeBadge: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    padding: '3px 8px',
    background: 'var(--color-background-secondary)',
    borderRadius: 12,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 22,
    color: 'var(--color-text-secondary)',
    width: 28,
    height: 28,
    cursor: 'pointer',
  },
  toolRow: {
    display: 'flex',
    gap: 8,
    padding: '8px 14px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    alignItems: 'center',
  },
  taskRow: {
    display: 'flex',
    gap: 8,
    padding: '8px 14px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    alignItems: 'flex-start',
  },
  taskRowLabel: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
    paddingTop: 8,
    minWidth: 38,
  },
  projectSelect: {
    flex: 1,
    padding: '5px 10px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 8,
    fontSize: 12,
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  moveBtn: {
    padding: '5px 10px',
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    border: '0.5px solid var(--accent-soft-border)',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  titleInput: {
    fontSize: 18,
    fontWeight: 600,
    border: 'none',
    outline: 'none',
    padding: '14px 18px 6px 18px',
    color: 'var(--color-text-primary)',
  },
  bodyArea: {
    flex: 1,
    border: 'none',
    outline: 'none',
    padding: '6px 18px 12px 18px',
    fontSize: 13,
    lineHeight: 1.6,
    fontFamily: 'inherit',
    resize: 'none',
    color: 'var(--color-text-primary)',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 14px',
    borderTop: '0.5px solid var(--color-border-tertiary)',
    background: 'var(--color-background-tertiary)',
  },
  footerNote: { fontSize: 11, color: 'var(--color-text-tertiary)' },
  deleteBtn: {
    padding: '4px 10px',
    background: 'transparent',
    border: '0.5px solid #e24b4a',
    color: '#e24b4a',
    borderRadius: 6,
    fontSize: 11,
    cursor: 'pointer',
  },
  confirmRow: { display: 'flex', gap: 6 },
  deleteConfirm: {
    padding: '4px 10px',
    background: '#e24b4a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '4px 10px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    fontSize: 11,
    cursor: 'pointer',
  },
};
