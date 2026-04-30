import { useEffect, useMemo, useState } from 'react';
import { uid } from '../../lib/utils.js';
import { projectColor } from '../../lib/constants.js';

const RAG_OPTIONS = [
  { key: 'green', label: 'Green', color: '#1d9e75', short: 'G' },
  { key: 'amber', label: 'Amber', color: '#ef9f27', short: 'A' },
  { key: 'red', label: 'Red', color: '#e24b4a', short: 'R' },
  { key: 'not_discussed', label: 'Not discussed', color: '#bbb', short: '—' },
];

const RAG_BY_KEY = Object.fromEntries(RAG_OPTIONS.map((o) => [o.key, o]));

export default function RoundEditor({
  round,
  projects,
  tasks,
  currentUserId,
  workspaceName,
  onUpdate,
  onRemove,
  onExport,
  onAddTask,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [filter, setFilter] = useState('all'); // all | red | amber | green | not_discussed

  // Local drafts so typing doesn't write to db on every keystroke
  const [titleDraft, setTitleDraft] = useState(round.title || '');
  const [dateDraft, setDateDraft] = useState(round.date || '');
  const [notesDraft, setNotesDraft] = useState(round.notes || '');

  useEffect(() => {
    setTitleDraft(round.title || '');
    setDateDraft(round.date || '');
    setNotesDraft(round.notes || '');
    setConfirmDelete(false);
  }, [round.id]);

  const flushTitle = () => {
    if (titleDraft !== round.title) onUpdate({ title: titleDraft });
  };
  const flushDate = () => {
    if (dateDraft !== round.date) onUpdate({ date: dateDraft });
  };
  const flushNotes = () => {
    if (notesDraft !== round.notes) onUpdate({ notes: notesDraft });
  };

  // Project entry helpers — these update the projects array in the round
  const updateProjectEntry = (projectId, patch) => {
    const next = (round.projects || []).map((p) =>
      p.project_id === projectId ? { ...p, ...patch } : p
    );
    onUpdate({ projects: next });
  };

  const removeProjectFromRound = (projectId) => {
    const next = (round.projects || []).filter((p) => p.project_id !== projectId);
    onUpdate({ projects: next });
  };

  const addProjectToRound = (projectId) => {
    const next = [
      ...(round.projects || []),
      {
        project_id: projectId,
        rag: 'not_discussed',
        update: '',
        actions: [],
      },
    ];
    onUpdate({ projects: next });
  };

  // Resolve project info for the entries
  const projectsById = useMemo(() => {
    const m = {};
    for (const p of projects || []) m[p.id] = p;
    return m;
  }, [projects]);

  // Filter visible entries
  const visibleEntries = useMemo(() => {
    const list = (round.projects || []).filter((entry) => {
      if (filter === 'all') return true;
      return entry.rag === filter;
    });
    return list;
  }, [round.projects, filter]);

  // Counts for filter chip badges
  const counts = useMemo(() => {
    const c = { all: (round.projects || []).length, red: 0, amber: 0, green: 0, not_discussed: 0 };
    for (const e of round.projects || []) c[e.rag] = (c[e.rag] || 0) + 1;
    return c;
  }, [round.projects]);

  // Active projects not yet in the round (for the "add project" picker)
  const availableToAdd = useMemo(() => {
    const inRound = new Set((round.projects || []).map((e) => e.project_id));
    return (projects || [])
      .filter((p) => !p.archived && !inRound.has(p.id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [projects, round.projects]);

  return (
    <div style={styles.wrap}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <input
            type="date"
            value={dateDraft}
            onChange={(e) => setDateDraft(e.target.value)}
            onBlur={flushDate}
            style={styles.dateInput}
          />
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={flushTitle}
            placeholder="Optional title (e.g. Weekly client review)"
            style={styles.titleInput}
          />
        </div>
        <div style={styles.headerActions}>
          <button onClick={onExport} style={styles.actionBtn}>
            Export
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              style={styles.deleteBtn}
              title="Delete this round"
            >
              🗑
            </button>
          ) : (
            <>
              <button onClick={onRemove} style={styles.confirmDeleteBtn}>
                Delete round
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={styles.actionBtn}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div style={styles.scroll}>
        {/* Meeting notes */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>Meeting notes / agenda</div>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={flushNotes}
            placeholder="Free-form notes for this meeting…"
            rows={3}
            style={styles.notesArea}
          />
        </div>

        {/* Projects section */}
        <div style={styles.section}>
          <div style={styles.projectsHeader}>
            <div style={styles.sectionLabel}>
              Projects ({(round.projects || []).length})
            </div>
            <div style={styles.filterRow}>
              <FilterChip
                active={filter === 'all'}
                onClick={() => setFilter('all')}
                label={`All (${counts.all})`}
              />
              <FilterChip
                active={filter === 'red'}
                onClick={() => setFilter('red')}
                color="#e24b4a"
                label={`R (${counts.red})`}
              />
              <FilterChip
                active={filter === 'amber'}
                onClick={() => setFilter('amber')}
                color="#ef9f27"
                label={`A (${counts.amber})`}
              />
              <FilterChip
                active={filter === 'green'}
                onClick={() => setFilter('green')}
                color="#1d9e75"
                label={`G (${counts.green})`}
              />
              <FilterChip
                active={filter === 'not_discussed'}
                onClick={() => setFilter('not_discussed')}
                color="#999"
                label={`— (${counts.not_discussed})`}
              />
            </div>
          </div>

          {(round.projects || []).length === 0 ? (
            <div style={styles.emptyProjects}>
              No projects in this round yet. Add some below.
            </div>
          ) : visibleEntries.length === 0 ? (
            <div style={styles.emptyProjects}>
              No projects matching this filter.
            </div>
          ) : (
            <div style={styles.entries}>
              {visibleEntries.map((entry) => (
                <ProjectEntry
                  key={entry.project_id}
                  entry={entry}
                  project={projectsById[entry.project_id]}
                  tasks={tasks}
                  projects={projects}
                  workspaceName={workspaceName}
                  onUpdate={(patch) => updateProjectEntry(entry.project_id, patch)}
                  onRemove={() => removeProjectFromRound(entry.project_id)}
                  onAddTask={onAddTask}
                />
              ))}
            </div>
          )}

          {availableToAdd.length > 0 && (
            <AddProjectPicker
              projects={availableToAdd}
              onAdd={addProjectToRound}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── ProjectEntry: single project block in a round ────────────────────────────
function ProjectEntry({
  entry,
  project,
  tasks,
  projects,
  workspaceName,
  onUpdate,
  onRemove,
  onAddTask,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [updateDraft, setUpdateDraft] = useState(entry.update || '');
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    setUpdateDraft(entry.update || '');
  }, [entry.project_id]);

  const flushUpdate = () => {
    if (updateDraft !== entry.update) onUpdate({ update: updateDraft });
  };

  // Pull live context from current data
  const projectTasks = useMemo(
    () => (tasks || []).filter((t) => t.project === project?.name && !t.done),
    [tasks, project?.name]
  );

  const nextDeliverable = useMemo(() => {
    if (!project?.deliverables) return null;
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = project.deliverables
      .filter((d) => d.dueDate && d.dueDate >= today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return upcoming[0] || null;
  }, [project?.deliverables]);

  const ragOpt = RAG_BY_KEY[entry.rag] || RAG_BY_KEY['not_discussed'];

  // Action handlers
  const addAction = () => {
    const next = [
      ...(entry.actions || []),
      { id: uid(), text: '', done: false, became_task_id: null },
    ];
    onUpdate({ actions: next });
  };

  const updateAction = (actionId, patch) => {
    const next = (entry.actions || []).map((a) =>
      a.id === actionId ? { ...a, ...patch } : a
    );
    onUpdate({ actions: next });
  };

  const removeAction = (actionId) => {
    const next = (entry.actions || []).filter((a) => a.id !== actionId);
    onUpdate({ actions: next });
  };

  const promoteActionToTask = async (action) => {
    if (!action.text.trim() || action.became_task_id || !project) return;
    const created = await onAddTask({
      title: action.text.trim(),
      project: project.name,
      tags: ['from-status-round'],
    });
    if (created) {
      updateAction(action.id, { became_task_id: created.id });
    }
  };

  if (!project) {
    return (
      <div style={entryStyles.wrap}>
        <div style={entryStyles.headerRow}>
          <div style={{ ...entryStyles.title, color: 'var(--color-text-tertiary)' }}>
            (Project deleted)
          </div>
          <button onClick={onRemove} style={entryStyles.iconBtn} title="Remove from round">
            ×
          </button>
        </div>
      </div>
    );
  }

  const projColor = projectColor(project.name, projects);

  return (
    <div style={{ ...entryStyles.wrap, borderLeft: `3px solid ${projColor}` }}>
      <div style={entryStyles.headerRow}>
        <button
          onClick={() => setCollapsed((v) => !v)}
          style={entryStyles.collapseBtn}
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <div style={entryStyles.titleArea}>
          <div style={entryStyles.title}>{project.name}</div>
          <div style={entryStyles.contextLine}>
            {projectTasks.length} open task{projectTasks.length === 1 ? '' : 's'}
            {nextDeliverable && (
              <>
                {' · '}
                Next: {nextDeliverable.name} due {fmtShortDate(nextDeliverable.dueDate)}
              </>
            )}
          </div>
        </div>
        <RagPicker
          value={entry.rag}
          onChange={(rag) => onUpdate({ rag })}
        />
        {!confirmRemove ? (
          <button
            onClick={() => setConfirmRemove(true)}
            style={entryStyles.iconBtn}
            title="Remove from round"
          >
            ×
          </button>
        ) : (
          <>
            <button onClick={onRemove} style={entryStyles.confirmRemove}>
              Remove
            </button>
            <button
              onClick={() => setConfirmRemove(false)}
              style={entryStyles.iconBtn}
            >
              ↶
            </button>
          </>
        )}
      </div>

      {!collapsed && (
        <>
          <textarea
            value={updateDraft}
            onChange={(e) => setUpdateDraft(e.target.value)}
            onBlur={flushUpdate}
            placeholder="This week / update…"
            rows={3}
            style={entryStyles.updateArea}
          />

          {/* Actions */}
          <div style={entryStyles.actionsBlock}>
            <div style={entryStyles.actionsHeader}>
              <span style={entryStyles.actionsLabel}>
                Actions ({(entry.actions || []).length})
              </span>
              <button onClick={addAction} style={entryStyles.smallAddBtn}>
                + Add action
              </button>
            </div>
            {(entry.actions || []).length === 0 ? (
              <div style={entryStyles.noActions}>No actions yet.</div>
            ) : (
              <div style={entryStyles.actionList}>
                {(entry.actions || []).map((a) => (
                  <ActionRow
                    key={a.id}
                    action={a}
                    onUpdate={(patch) => updateAction(a.id, patch)}
                    onRemove={() => removeAction(a.id)}
                    onPromote={() => promoteActionToTask(a)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── RagPicker ────────────────────────────────────────────────────────────────
function RagPicker({ value, onChange }) {
  const opt = RAG_BY_KEY[value] || RAG_BY_KEY['not_discussed'];
  return (
    <div style={ragStyles.wrap}>
      {RAG_OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          style={{
            ...ragStyles.dot,
            background: value === o.key ? o.color : 'transparent',
            border: `1.5px solid ${o.color}`,
            color: value === o.key ? '#fff' : o.color,
            opacity: value === o.key ? 1 : 0.55,
          }}
          title={o.label}
        >
          {o.short}
        </button>
      ))}
    </div>
  );
}

// ── ActionRow ────────────────────────────────────────────────────────────────
function ActionRow({ action, onUpdate, onRemove, onPromote }) {
  const [textDraft, setTextDraft] = useState(action.text || '');
  useEffect(() => setTextDraft(action.text || ''), [action.id]);

  const flushText = () => {
    if (textDraft !== action.text) onUpdate({ text: textDraft });
  };

  return (
    <div style={actionStyles.row}>
      <button
        onClick={() => onUpdate({ done: !action.done })}
        style={{
          ...actionStyles.checkbox,
          background: action.done ? '#534AB7' : 'transparent',
          borderColor: action.done ? '#534AB7' : 'var(--color-border-primary)',
        }}
      >
        {action.done && (
          <svg width={9} height={9} viewBox="0 0 9 9">
            <polyline
              points="1.5,5 4,7.5 8.5,2"
              fill="none"
              stroke="#fff"
              strokeWidth="1.6"
            />
          </svg>
        )}
      </button>
      <input
        value={textDraft}
        onChange={(e) => setTextDraft(e.target.value)}
        onBlur={flushText}
        placeholder="Action…"
        style={{
          ...actionStyles.input,
          textDecoration: action.done ? 'line-through' : 'none',
          opacity: action.done ? 0.55 : 1,
        }}
      />
      {action.became_task_id ? (
        <span style={actionStyles.taskBadge} title="Already a task">
          ✓ Task
        </span>
      ) : (
        <button
          onClick={onPromote}
          disabled={!textDraft.trim()}
          style={{
            ...actionStyles.promoteBtn,
            opacity: textDraft.trim() ? 1 : 0.4,
            cursor: textDraft.trim() ? 'pointer' : 'not-allowed',
          }}
          title="Create a task from this action"
        >
          → Task
        </button>
      )}
      <button onClick={onRemove} style={actionStyles.removeBtn} title="Remove">
        ×
      </button>
    </div>
  );
}

// ── AddProjectPicker ─────────────────────────────────────────────────────────
function AddProjectPicker({ projects, onAdd }) {
  const [open, setOpen] = useState(false);
  const [pickedId, setPickedId] = useState('');

  const handleAdd = () => {
    if (!pickedId) return;
    onAdd(pickedId);
    setPickedId('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={addPickerStyles.toggleBtn}>
        + Add project
      </button>
    );
  }

  return (
    <div style={addPickerStyles.row}>
      <select
        value={pickedId}
        onChange={(e) => setPickedId(e.target.value)}
        style={addPickerStyles.select}
      >
        <option value="">Pick a project…</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <button
        onClick={handleAdd}
        disabled={!pickedId}
        style={{
          ...addPickerStyles.addBtn,
          opacity: pickedId ? 1 : 0.4,
          cursor: pickedId ? 'pointer' : 'not-allowed',
        }}
      >
        Add
      </button>
      <button onClick={() => setOpen(false)} style={addPickerStyles.cancelBtn}>
        Cancel
      </button>
    </div>
  );
}

// ── FilterChip ───────────────────────────────────────────────────────────────
function FilterChip({ active, onClick, label, color }) {
  const baseColor = color || '#534AB7';
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 10px',
        background: active ? baseColor + '22' : 'transparent',
        border: `0.5px solid ${active ? baseColor + '66' : 'var(--color-border-secondary)'}`,
        color: active ? baseColor : 'var(--color-text-secondary)',
        borderRadius: 12,
        fontSize: 10,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const styles = {
  wrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    gap: 10,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  dateInput: {
    padding: '5px 10px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    fontSize: 12,
    background: '#fff',
    outline: 'none',
  },
  titleInput: {
    flex: 1,
    padding: '5px 10px',
    border: 'none',
    background: 'transparent',
    fontSize: 13,
    fontWeight: 500,
    outline: 'none',
  },
  headerActions: { display: 'flex', gap: 6, alignItems: 'center' },
  actionBtn: {
    padding: '5px 12px',
    background: '#fff',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    fontSize: 11,
    cursor: 'pointer',
  },
  deleteBtn: {
    width: 30,
    height: 28,
    background: 'transparent',
    border: 'none',
    fontSize: 13,
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
  },
  confirmDeleteBtn: {
    padding: '5px 12px',
    background: '#e24b4a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
  },
  scroll: { flex: 1, overflowY: 'auto', padding: 16 },
  section: {
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  notesArea: {
    width: '100%',
    padding: '8px 10px',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 8,
    fontSize: 12,
    fontFamily: 'inherit',
    background: 'var(--color-background-secondary)',
    outline: 'none',
    resize: 'vertical',
    lineHeight: 1.5,
  },
  projectsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  filterRow: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  emptyProjects: {
    padding: 16,
    textAlign: 'center',
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    fontStyle: 'italic',
    background: 'var(--color-background-secondary)',
    borderRadius: 8,
  },
  entries: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 10,
  },
};

const entryStyles = {
  wrap: {
    background: '#fff',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 8,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  collapseBtn: {
    width: 20,
    height: 20,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-secondary)',
    fontSize: 10,
    cursor: 'pointer',
  },
  titleArea: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  contextLine: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    marginTop: 2,
  },
  iconBtn: {
    width: 24,
    height: 24,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-tertiary)',
    fontSize: 13,
    cursor: 'pointer',
    borderRadius: 4,
  },
  confirmRemove: {
    padding: '3px 8px',
    background: '#e24b4a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 10,
    cursor: 'pointer',
  },
  updateArea: {
    width: '100%',
    padding: '6px 10px',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 6,
    fontSize: 12,
    fontFamily: 'inherit',
    background: 'var(--color-background-secondary)',
    outline: 'none',
    resize: 'vertical',
    lineHeight: 1.5,
  },
  actionsBlock: {
    background: 'var(--color-background-secondary)',
    borderRadius: 6,
    padding: 8,
  },
  actionsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  actionsLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  smallAddBtn: {
    padding: '2px 8px',
    background: 'transparent',
    border: '0.5px solid #534AB7',
    color: '#534AB7',
    borderRadius: 6,
    fontSize: 10,
    cursor: 'pointer',
  },
  noActions: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
    padding: 4,
  },
  actionList: { display: 'flex', flexDirection: 'column', gap: 4 },
};

const ragStyles = {
  wrap: { display: 'flex', gap: 3 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    fontSize: 10,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

const actionStyles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 6px',
    background: '#fff',
    borderRadius: 4,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    border: '1.5px solid',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: '3px 6px',
    border: 'none',
    background: 'transparent',
    fontSize: 11,
    outline: 'none',
  },
  promoteBtn: {
    padding: '2px 8px',
    background: 'transparent',
    border: '0.5px solid #534AB7',
    color: '#534AB7',
    borderRadius: 4,
    fontSize: 10,
  },
  taskBadge: {
    padding: '2px 8px',
    background: '#1d9e7522',
    color: '#1d9e75',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 500,
  },
  removeBtn: {
    width: 20,
    height: 20,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-tertiary)',
    fontSize: 12,
    cursor: 'pointer',
  },
};

const addPickerStyles = {
  toggleBtn: {
    padding: '6px 12px',
    background: 'transparent',
    border: '0.5px dashed var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    fontSize: 11,
    cursor: 'pointer',
    width: '100%',
  },
  row: { display: 'flex', gap: 6, alignItems: 'center' },
  select: {
    flex: 1,
    padding: '5px 10px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    fontSize: 12,
    background: '#fff',
    outline: 'none',
  },
  addBtn: {
    padding: '5px 14px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
  },
  cancelBtn: {
    padding: '5px 10px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    fontSize: 11,
    cursor: 'pointer',
  },
};
