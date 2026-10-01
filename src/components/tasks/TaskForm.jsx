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
  deliverableId: '',
  status: 'To do',
  dueDate: '',
  estimate: '',
  tags: [],
  recurring: 'none',
  taskNumber: '',
  assignedToId: '',
  assignedToEmail: '',
  outOfScope: false,
  outOfScopeHours: '',
  outOfScopeNotes: '',
};

export default function TaskForm({
  initialTask,
  projects,
  categories,
  priorities,
  statuses,
  members,
  workspaceId,
  onSave,
  onCancel,
}) {
  const effectivePriorities = priorities && priorities.length ? priorities : DEFAULT_PRIORITIES;
  const effectiveStatuses = statuses && statuses.length ? statuses : DEFAULT_STATUSES;
  const [form, setForm] = useState(blankForm);

  useEffect(() => {
    setForm({ ...blankForm, ...initialTask });
  }, [initialTask?.id]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = () => {
    if (!form.title.trim()) return;
    // Coerce hours field to a number (or null) for clean storage
    const hoursRaw = form.outOfScopeHours;
    const hoursNum =
      hoursRaw === '' || hoursRaw == null
        ? null
        : Number(hoursRaw);
    // Same coercion for estimate
    const estRaw = form.estimate;
    const estNum =
      estRaw === '' || estRaw == null
        ? null
        : Number(estRaw);
    onSave({
      ...form,
      title: form.title.trim(),
      estimate: Number.isFinite(estNum) ? estNum : null,
      outOfScopeHours: Number.isFinite(hoursNum) ? hoursNum : null,
      outOfScopeNotes: (form.outOfScopeNotes || '').trim(),
    });
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
          onChange={(e) => set({ project: e.target.value, deliverableId: '' })}
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
          {effectivePriorities.map((p) => (
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
          {effectiveStatuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Deliverable picker — appears when the selected project has
          deliverables. Optional: lets you tag which deliverable the task is
          for, so two same-named tasks (e.g. "SR") on one project are
          distinguishable on Today and in task lists. */}
      {(() => {
        const proj = (projects || []).find((p) => p.name === form.project);
        const delivs = proj?.deliverables || [];
        if (delivs.length === 0) return null;
        return (
          <select
            value={form.deliverableId || ''}
            onChange={(e) => set({ deliverableId: e.target.value })}
            style={{ ...styles.select, width: '100%' }}
            title="Which deliverable is this task for? (optional)"
          >
            <option value="">No specific deliverable</option>
            {delivs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name || '(deliverable)'}
              </option>
            ))}
          </select>
        );
      })()}

      <div style={styles.fieldRow}>
        <input
          type="date"
          value={form.dueDate || ''}
          onChange={(e) => set({ dueDate: e.target.value })}
          style={styles.select}
          title="Due date"
        />

        <input
          type="number"
          step="0.25"
          min="0"
          value={form.estimate ?? ''}
          onChange={(e) => set({ estimate: e.target.value })}
          placeholder="Estimate (h)"
          style={styles.select}
          title="Estimated hours for this task"
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

      <div>
        <label style={styles.label}>Tags <span style={{ opacity: 0.6, fontWeight: 400 }}>(comma-separated)</span></label>
        <input
          value={(form.tags || []).join(', ')}
          onChange={(e) => {
            const raw = e.target.value;
            const parsed = raw
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean);
            set({ tags: parsed });
          }}
          placeholder="Review, Submit, …"
          style={{ ...styles.select, width: '100%' }}
        />
      </div>

      {/* Out-of-scope section */}
      <div style={oosStyles.wrap}>
        <label style={oosStyles.toggleLabel}>
          <input
            type="checkbox"
            checked={!!form.outOfScope}
            onChange={(e) => {
              const checked = e.target.checked;
              set({
                outOfScope: checked,
                // Clear sub-fields when un-toggling
                ...(checked ? {} : { outOfScopeHours: '', outOfScopeNotes: '' }),
              });
            }}
          />
          <span style={oosStyles.toggleText}>
            Mark as out of scope
            <span style={oosStyles.toggleHint}>
              {' '}— work beyond contracted scope. Useful for billing variations.
            </span>
          </span>
        </label>

        {form.outOfScope && (
          <div style={oosStyles.fields}>
            <div style={oosStyles.row}>
              <label style={oosStyles.subLabel}>Estimated extra hours</label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={form.outOfScopeHours ?? ''}
                onChange={(e) => set({ outOfScopeHours: e.target.value })}
                placeholder="e.g. 2.5"
                style={oosStyles.numberInput}
              />
            </div>
            <div>
              <label style={oosStyles.subLabel}>Scope notes</label>
              <input
                value={form.outOfScopeNotes || ''}
                onChange={(e) => set({ outOfScopeNotes: e.target.value })}
                placeholder='e.g. "Client emailed 14 Apr — approved as variation"'
                style={oosStyles.notesInput}
              />
            </div>
          </div>
        )}
      </div>

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
  editingHdr: { fontSize: 11, color: 'var(--accent)', fontWeight: 500 },
  titleInput: {
    padding: '8px 10px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    fontSize: 13,
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  fieldRow: { display: 'flex', gap: 6 },
  select: {
    flex: 1,
    padding: '5px 8px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    background: 'var(--bg-surface)',
    fontSize: 12,
    outline: 'none',
  },
  label: {
    display: 'block',
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginBottom: 4,
  },
btnRow: {
    display: 'flex',
    gap: 6,
    marginTop: 4,
    position: 'sticky',
    bottom: 0,
    background: 'var(--color-background-secondary)',
    paddingTop: 8,
    paddingBottom: 2,
  },
    primary: {
    flex: 1,
    padding: '7px 0',
    background: 'var(--accent)',
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

const oosStyles = {
  wrap: {
    background: 'var(--color-background-secondary)',
    borderRadius: 8,
    padding: 10,
    border: '0.5px solid var(--color-border-tertiary)',
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    cursor: 'pointer',
    fontSize: 12,
  },
  toggleText: {
    color: 'var(--color-text-primary)',
    fontWeight: 500,
  },
  toggleHint: {
    fontWeight: 400,
    color: 'var(--color-text-secondary)',
  },
  fields: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: '0.5px dashed var(--color-border-tertiary)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
  },
  subLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    marginBottom: 4,
  },
  numberInput: {
    width: 120,
    padding: '5px 10px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    fontSize: 12,
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  notesInput: {
    width: '100%',
    padding: '5px 10px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    fontSize: 12,
    background: 'var(--bg-surface)',
    outline: 'none',
  },
};


