import { useEffect, useState } from 'react';
import {
  DEFAULT_PRIORITIES,
  DEFAULT_STATUSES,
  RECURRING_OPTIONS,
} from '../../lib/constants.js';

const blankForm = {
  title: '',
  priority: 'Medium',
  category: '',
  project: '',
  status: 'To do',
  dueDate: '',
  tags: [],
  recurring: 'none',
  taskNumber: '',
  assignedToId: '',
  assignedToEmail: '',
};

export default function TaskForm({
  initialTask,
  projects,
  categories,
  members,
  workspaceId,
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState(blankForm);

  useEffect(() => {
    setForm({ ...blankForm, ...initialTask });
  }, [initialTask?.id]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = () => {
    if (!form.title.trim()) return;
    onSave({ ...form, title: form.title.trim() });
  };

  return (
    <div style={styles.wrap}>
      {initialTask?.id && (
        <div style={styles.editingHdr}>Editing task</div>
      )}

      <input
        autoFocus
        value={form.title}
        onChange={(e) => set({ title: e.target.value })}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        placeholder="Task title…"
        style={styles.titleInput}
      />

      <div style={styles.fieldRow}>
        <select
          value={form.project}
          onChange={(e) => set({ project: e.target.value })}
          style={styles.select}
        >
          <option value="">No project</option>
          {(projects || []).map((p) => (
            <option key={p.id || p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={form.priority}
          onChange={(e) => set({ priority: e.target.value })}
          style={styles.select}
        >
          {DEFAULT_PRIORITIES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>

        <select
          value={form.category}
          onChange={(e) => set({ category: e.target.value })}
          style={styles.select}
        >
          <option value="">Category</option>
          {(categories || []).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        <select
          value={form.status}
          onChange={(e) => set({ status: e.target.value })}
          style={styles.select}
        >
          {DEFAULT_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div style={styles.fieldRow}>
        <input
          type="date"
          value={form.dueDate || ''}
          onChange={(e) => set({ dueDate: e.target.value })}
          style={styles.select}
          title="Due date"
        />

        <select
          value={form.recurring}
          onChange={(e) => set({ recurring: e.target.value })}
          style={styles.select}
        >
          {RECURRING_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r === 'none' ? 'No recurrence' : `Repeats ${r}`}
            </option>
          ))}
        </select>
      </div>

      {workspaceId && members && members.length > 0 && (
        <div>
          <label style={styles.label}>Assign to</label>
          <select
            value={form.assignedToId || ''}
            onChange={(e) => {
              const m = members.find((x) => x.id === e.target.value);
              set({
                assignedToId: e.target.value,
                assignedToEmail: m?.email || '',
              });
            }}
            style={{ ...styles.select, width: '100%' }}
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.email || m.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={styles.btnRow}>
        <button style={styles.primary} onClick={handleSave}>
          {initialTask?.id ? 'Save changes' : 'Add task'}
        </button>
        {onCancel && (
          <button style={styles.cancel} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 14px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    background: 'var(--color-background-secondary)',
  },
  editingHdr: { fontSize: 11, color: '#534AB7', fontWeight: 500 },
  titleInput: {
    padding: '8px 10px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    fontSize: 13,
    background: '#fff',
    outline: 'none',
  },
  fieldRow: { display: 'flex', gap: 6 },
  select: {
    flex: 1,
    padding: '5px 8px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    background: '#fff',
    fontSize: 12,
    outline: 'none',
  },
  label: {
    display: 'block',
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginBottom: 4,
  },
  btnRow: { display: 'flex', gap: 6, marginTop: 4 },
  primary: {
    flex: 1,
    padding: '7px 0',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 500,
    fontSize: 13,
  },
  cancel: {
    padding: '7px 14px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    fontSize: 13,
    color: 'var(--color-text-secondary)',
  },
};
