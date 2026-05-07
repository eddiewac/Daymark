import { useEffect, useState, useRef } from 'react';

// ── QuickCapture ────────────────────────────────────────────────────────────
// Global Cmd+K / Ctrl+K modal for creating a task or project from anywhere.
//
// Two modes (toggled by a tab at the top):
//   - Task mode: title + optional project + due date + priority quick-pick
//   - Project mode: name + optional next-steps
//
// Submits to onAddTask or onAddProject. Closes on Esc or after submit.

export default function QuickCapture({
  open,
  onClose,
  onAddTask,
  onAddProject,
  projects,
  priorities,
}) {
  const [mode, setMode] = useState('task'); // task | project
  const [title, setTitle] = useState('');
  const [project, setProject] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [nextSteps, setNextSteps] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  // Reset when opened/closed
  useEffect(() => {
    if (open) {
      setTitle('');
      setProject('');
      setDueDate('');
      setPriority('Medium');
      setNextSteps('');
      setBusy(false);
      // Auto-focus the input
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open, mode]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      if (mode === 'task') {
        await onAddTask({
          title: title.trim(),
          project: project || '',
          dueDate: dueDate || '',
          priority: priority || 'Medium',
        });
      } else {
        await onAddProject({
          name: title.trim(),
          nextSteps: nextSteps.trim() || '',
        });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const PRI_OPTIONS = priorities && priorities.length > 0 ? priorities : ['Low', 'Medium', 'High'];

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={styles.tabs}>
          {[
            { key: 'task', label: '✓ Task' },
            { key: 'project', label: '📁 Project' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setMode(t.key)}
              style={{
                ...styles.tab,
                ...(mode === t.key ? styles.tabActive : {}),
              }}
            >
              {t.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <span style={styles.shortcut}>Esc to close · Enter to save</span>
        </div>

        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={mode === 'task' ? 'What needs doing?' : 'New project name…'}
          style={styles.titleInput}
        />

        {mode === 'task' && (
          <div style={styles.fieldsRow}>
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
              style={styles.select}
            >
              <option value="">No project</option>
              {(projects || []).map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={styles.dateInput}
              title="Due date"
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={styles.select}
            >
              {PRI_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === 'project' && (
          <textarea
            value={nextSteps}
            onChange={(e) => setNextSteps(e.target.value)}
            placeholder="Next steps (optional)"
            rows={3}
            style={styles.textarea}
          />
        )}

        <div style={styles.btnRow}>
          <button onClick={onClose} style={styles.cancelBtn}>
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!title.trim() || busy}
            style={{
              ...styles.saveBtn,
              opacity: title.trim() && !busy ? 1 : 0.4,
              cursor: title.trim() && !busy ? 'pointer' : 'not-allowed',
            }}
          >
            {busy ? 'Saving…' : mode === 'task' ? 'Add task' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 1500,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    overflow: 'auto',
    padding: '14vh 20px 80px',
  },
  dialog: {
    background: 'var(--bg-surface)',
    borderRadius: 12,
    width: '100%',
    maxWidth: 520,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
  },
  tabs: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    paddingBottom: 6,
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  tab: {
    padding: '4px 10px',
    background: 'transparent',
    border: 'none',
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    cursor: 'pointer',
  },
  tabActive: {
    background: 'var(--color-background-secondary)',
    color: 'var(--color-text-primary)',
    fontWeight: 500,
  },
  shortcut: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
  },
  titleInput: {
    padding: '10px 12px',
    fontSize: 14,
    border: 'none',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    outline: 'none',
    background: 'transparent',
  },
  fieldsRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  select: {
    padding: '5px 8px',
    fontSize: 11,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  dateInput: {
    padding: '5px 8px',
    fontSize: 11,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  textarea: {
    padding: '8px 10px',
    fontSize: 12,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    background: 'var(--bg-surface)',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  btnRow: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  cancelBtn: {
    padding: '6px 14px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '6px 16px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
  },
};
