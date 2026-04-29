import { useEffect, useRef, useState } from 'react';
import { loadNotepad, saveNotepad } from '../../lib/notepad.js';

export default function Notepad({
  projects,
  workspaceId,
  onAddTask,
  onAddProject,
}) {
  const [body, setBody] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  // Selection / conversion state
  const [selection, setSelection] = useState('');
  const [converting, setConverting] = useState(null); // 'task' | 'project' | null
  const [taskForm, setTaskForm] = useState({
    title: '',
    project: '',
    priority: 'Medium',
    dueDate: '',
  });
  const [projectForm, setProjectForm] = useState({
    name: '',
    nextSteps: '',
  });
  const [feedback, setFeedback] = useState(null);

  const textareaRef = useRef(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    loadNotepad()
      .then((b) => {
        setBody(b);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveNotepad(body);
      setSavedAt(Date.now());
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [body, loaded]);

  const handleSelect = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim();
    setSelection(sel);
    if (!sel) setConverting(null);
  };

  const startConvert = (type) => {
    if (!selection) return;
    if (type === 'task') {
      setTaskForm({
        title: selection,
        project: '',
        priority: 'Medium',
        dueDate: '',
      });
    } else {
      setProjectForm({
        name: selection.length <= 60 ? selection : selection.slice(0, 60),
        nextSteps: selection.length > 60 ? selection : '',
      });
    }
    setConverting(type);
  };

  const submitConvert = async () => {
    if (converting === 'task') {
      if (!taskForm.title.trim()) return;
      await onAddTask({
        title: taskForm.title.trim(),
        project: taskForm.project || '',
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || '',
        sourceNote: 'notepad',
      });
      setFeedback({ type: 'task', text: taskForm.title.trim() });
    } else if (converting === 'project') {
      if (!projectForm.name.trim()) return;
      await onAddProject({
        name: projectForm.name.trim(),
        nextSteps: projectForm.nextSteps.trim(),
      });
      setFeedback({ type: 'project', text: projectForm.name.trim() });
    }
    setConverting(null);
    setSelection('');
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>📒 Notepad</div>
          <div style={styles.sub}>
            Quick personal scratchpad. Select text and convert to a task or
            project.
          </div>
        </div>
        <div style={styles.savedNote}>
          {savedAt ? `Saved ${fmtTime(savedAt)}` : loaded ? 'Loaded' : ''}
        </div>
      </div>

      {selection && !converting && (
        <div style={styles.selectionBar}>
          <span style={styles.selectionLabel}>
            Selection: "{selection.length > 50 ? selection.slice(0, 50) + '…' : selection}"
          </span>
          <button onClick={() => startConvert('task')} style={styles.convertBtn}>
            → Convert to task
          </button>
          <button
            onClick={() => startConvert('project')}
            style={{
              ...styles.convertBtn,
              background: '#0F6E5611',
              color: '#0F6E56',
              borderColor: '#0F6E56',
            }}
          >
            → Convert to project
          </button>
        </div>
      )}

      {converting === 'task' && (
        <div style={styles.convertForm}>
          <div style={styles.convertHeader}>Create task from selection</div>
          <input
            value={taskForm.title}
            onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Task title"
            style={styles.input}
            autoFocus
          />
          <div style={styles.formRow}>
            <select
              value={taskForm.project}
              onChange={(e) => setTaskForm((f) => ({ ...f, project: e.target.value }))}
              style={styles.select}
            >
              <option value="">No project</option>
              {(projects || []).map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={taskForm.priority}
              onChange={(e) => setTaskForm((f) => ({ ...f, priority: e.target.value }))}
              style={styles.select}
            >
              {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <input
              type="date"
              value={taskForm.dueDate}
              onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))}
              style={styles.select}
              title="Due date"
            />
          </div>
          <div style={styles.btnRow}>
            <button onClick={submitConvert} style={styles.primaryBtn}>
              Create task
            </button>
            <button onClick={() => setConverting(null)} style={styles.cancelBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {converting === 'project' && (
        <div style={{ ...styles.convertForm, borderColor: '#0F6E5644' }}>
          <div style={{ ...styles.convertHeader, color: '#0F6E56' }}>
            Create project from selection
          </div>
          <input
            value={projectForm.name}
            onChange={(e) => setProjectForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Project name"
            style={styles.input}
            autoFocus
          />
          <textarea
            value={projectForm.nextSteps}
            onChange={(e) => setProjectForm((f) => ({ ...f, nextSteps: e.target.value }))}
            placeholder="Next steps (optional)"
            rows={2}
            style={styles.textarea}
          />
          <div style={styles.btnRow}>
            <button
              onClick={submitConvert}
              style={{ ...styles.primaryBtn, background: '#0F6E56' }}
            >
              Create project
            </button>
            <button onClick={() => setConverting(null)} style={styles.cancelBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div
          style={{
            ...styles.feedback,
            background: feedback.type === 'task' ? '#534AB711' : '#0F6E5611',
            color: feedback.type === 'task' ? '#534AB7' : '#0F6E56',
            borderColor: feedback.type === 'task' ? '#534AB744' : '#0F6E5644',
          }}
        >
          ✓ Created {feedback.type}: <strong>{feedback.text}</strong>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onSelect={handleSelect}
        onMouseUp={handleSelect}
        onKeyUp={handleSelect}
        placeholder={loaded ? 'Start jotting…\n\nTip: select any text and click "Convert to task" or "Convert to project".' : 'Loading…'}
        disabled={!loaded}
        style={styles.area}
      />
    </div>
  );
}

function fmtTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 5000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return new Date(ts).toLocaleTimeString();
}

const styles = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '14px 18px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  title: { fontSize: 16, fontWeight: 600 },
  sub: { fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 },
  savedNote: { fontSize: 11, color: 'var(--color-text-tertiary)' },
  selectionBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 18px',
    background: '#534AB708',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  selectionLabel: {
    flex: 1,
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    fontStyle: 'italic',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  convertBtn: {
    padding: '4px 10px',
    background: '#534AB711',
    color: '#534AB7',
    border: '0.5px solid #534AB744',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  convertForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 14,
    margin: '12px 18px',
    background: 'var(--color-background-secondary)',
    border: '0.5px solid #534AB744',
    borderRadius: 10,
  },
  convertHeader: {
    fontSize: 11,
    fontWeight: 600,
    color: '#534AB7',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    padding: '6px 10px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 13,
    background: '#fff',
    outline: 'none',
  },
  textarea: {
    padding: '6px 10px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 12,
    background: '#fff',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  formRow: { display: 'flex', gap: 6 },
  select: {
    flex: 1,
    padding: '5px 8px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 12,
    background: '#fff',
    outline: 'none',
  },
  btnRow: { display: 'flex', gap: 6, marginTop: 4 },
  primaryBtn: {
    padding: '6px 14px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
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
  feedback: {
    margin: '0 18px 8px 18px',
    padding: '6px 12px',
    fontSize: 11,
    border: '0.5px solid',
    borderRadius: 6,
  },
  area: {
    flex: 1,
    border: 'none',
    outline: 'none',
    padding: '14px 18px',
    fontSize: 13,
    lineHeight: 1.6,
    fontFamily: 'inherit',
    resize: 'none',
    color: 'var(--color-text-primary)',
  },
};
