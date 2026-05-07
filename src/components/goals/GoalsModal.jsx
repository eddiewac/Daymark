import { useState } from 'react';

export default function GoalsModal({
  goals,
  loading,
  onAddGoal,
  onUpdateGoal,
  onRemoveGoal,
  onAddEvidence,
  onUpdateEvidence,
  onRemoveEvidence,
  onClose,
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', description: '' });
  const [editingId, setEditingId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const visibleGoals = goals.filter((g) => (showArchived ? true : !g.archived));
  const archivedCount = goals.filter((g) => g.archived).length;

  const startAdd = () => {
    setDraft({ title: '', description: '' });
    setAdding(true);
    setEditingId(null);
  };

  const startEdit = (goal) => {
    setDraft({ title: goal.title, description: goal.description || '' });
    setEditingId(goal.id);
    setAdding(false);
  };

  const cancelEdit = () => {
    setAdding(false);
    setEditingId(null);
    setDraft({ title: '', description: '' });
  };

  const save = async () => {
    if (!draft.title.trim()) return;
    if (editingId) {
      await onUpdateGoal(editingId, {
        title: draft.title.trim(),
        description: draft.description.trim(),
      });
    } else {
      await onAddGoal(draft);
    }
    cancelEdit();
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>🎯 Personal goals</div>
            <div style={styles.subtitle}>
              Capture evidence as it happens. By year-end you'll have a real record
              instead of trying to remember.
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <div style={styles.toolbar}>
          {!adding && !editingId && (
            <button onClick={startAdd} style={styles.primaryBtn}>
              + New goal
            </button>
          )}
          {archivedCount > 0 && (
            <label style={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show archived ({archivedCount})
            </label>
          )}
        </div>

        {/* Editor (for new or existing) */}
        {(adding || editingId) && (
          <div style={styles.editor}>
            <div style={styles.editorTitle}>
              {editingId ? 'Edit goal' : 'New goal'}
            </div>
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Goal title (e.g. Improve client retention)"
              autoFocus
              style={styles.input}
            />
            <textarea
              value={draft.description}
              onChange={(e) =>
                setDraft((d) => ({ ...d, description: e.target.value }))
              }
              placeholder="Description (optional) — what does success look like?"
              rows={2}
              style={styles.textarea}
            />
            <div style={styles.editorBtns}>
              <button onClick={cancelEdit} style={styles.cancelBtn}>
                Cancel
              </button>
              <button
                onClick={save}
                disabled={!draft.title.trim()}
                style={{
                  ...styles.primaryBtn,
                  opacity: draft.title.trim() ? 1 : 0.4,
                  cursor: draft.title.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                {editingId ? 'Save' : 'Add goal'}
              </button>
            </div>
          </div>
        )}

        {/* Goals list */}
        <div style={styles.list}>
          {loading ? (
            <div style={styles.loading}>Loading…</div>
          ) : visibleGoals.length === 0 ? (
            <div style={styles.empty}>
              {goals.length === 0
                ? 'No goals yet. Click "+ New goal" to add your first one.'
                : 'No active goals. Toggle "Show archived" to see archived ones.'}
            </div>
          ) : (
            visibleGoals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                onEdit={() => startEdit(g)}
                onArchive={() => onUpdateGoal(g.id, { archived: !g.archived })}
                onDelete={() => onRemoveGoal(g.id)}
                onAddEvidence={(text) => onAddEvidence(g.id, text)}
                onUpdateEvidence={(eid, text) => onUpdateEvidence(g.id, eid, text)}
                onRemoveEvidence={(eid) => onRemoveEvidence(g.id, eid)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── GoalCard ─────────────────────────────────────────────────────────────────
function GoalCard({
  goal,
  onEdit,
  onArchive,
  onDelete,
  onAddEvidence,
  onUpdateEvidence,
  onRemoveEvidence,
}) {
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submitEvidence = async () => {
    if (!draft.trim()) return;
    await onAddEvidence(draft);
    setDraft('');
  };

  const entries = goal.entries || [];

  return (
    <div
      style={{
        ...goalStyles.card,
        opacity: goal.archived ? 0.55 : 1,
      }}
    >
      <div style={goalStyles.header}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={goalStyles.title}>{goal.title}</div>
          {goal.description && (
            <div style={goalStyles.desc}>{goal.description}</div>
          )}
        </div>
        <div style={goalStyles.actions}>
          <button onClick={onEdit} style={goalStyles.iconBtn} title="Edit">
            ✎
          </button>
          <button
            onClick={onArchive}
            style={goalStyles.iconBtn}
            title={goal.archived ? 'Unarchive' : 'Archive'}
          >
            {goal.archived ? '↻' : '📦'}
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              style={goalStyles.iconBtn}
              title="Delete"
            >
              🗑
            </button>
          ) : (
            <>
              <button onClick={onDelete} style={goalStyles.confirmDelete}>
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={goalStyles.iconBtn}
              >
                ×
              </button>
            </>
          )}
        </div>
      </div>

      {/* Evidence quick-add */}
      <div style={goalStyles.evidenceAdd}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitEvidence()}
          placeholder="Log evidence — what did you do that supports this goal?"
          style={goalStyles.evidenceInput}
        />
        <button
          onClick={submitEvidence}
          disabled={!draft.trim()}
          style={{
            ...goalStyles.evidenceBtn,
            opacity: draft.trim() ? 1 : 0.4,
            cursor: draft.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Add
        </button>
      </div>

      {/* Evidence summary / list */}
      {entries.length > 0 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={goalStyles.expandBtn}
        >
          {expanded ? '▾' : '▸'} {entries.length} evidence{' '}
          entr{entries.length === 1 ? 'y' : 'ies'}
        </button>
      )}
      {expanded && (
        <div style={goalStyles.evidenceList}>
          {entries.map((e) => (
            <EvidenceRow
              key={e.id}
              entry={e}
              onUpdate={(text) => onUpdateEvidence(e.id, text)}
              onRemove={() => onRemoveEvidence(e.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceRow({ entry, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(entry.text);

  const save = () => {
    if (text.trim() && text.trim() !== entry.text) onUpdate(text.trim());
    setEditing(false);
  };

  return (
    <div style={evidenceStyles.row}>
      <div style={evidenceStyles.date}>{fmtDate(entry.ts)}</div>
      {editing ? (
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          autoFocus
          style={evidenceStyles.editInput}
        />
      ) : (
        <div style={evidenceStyles.text} onClick={() => setEditing(true)}>
          {entry.text}
        </div>
      )}
      <button onClick={onRemove} style={evidenceStyles.removeBtn} title="Delete">
        ×
      </button>
    </div>
  );
}

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 1300,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    overflow: 'auto',
    padding: '40px 20px 80px',
  },
  dialog: {
    background: 'var(--bg-surface)',
    borderRadius: 12,
    width: '100%',
    maxWidth: 640,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: { fontSize: 14, fontWeight: 600 },
  subtitle: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginTop: 4,
    lineHeight: 1.5,
  },
  closeBtn: {
    width: 28,
    height: 28,
    background: 'transparent',
    border: 'none',
    fontSize: 22,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
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
    padding: '6px 12px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
  },
  toggleLabel: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
  },
  editor: {
    background: 'var(--color-background-secondary)',
    borderRadius: 10,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  editorTitle: { fontSize: 12, fontWeight: 600, color: '#534AB7' },
  input: {
    padding: '6px 10px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 13,
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  textarea: {
    padding: '6px 10px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 12,
    background: 'var(--bg-surface)',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.5,
  },
  editorBtns: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  loading: { padding: 16, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 12 },
  empty: {
    padding: 24,
    textAlign: 'center',
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    background: 'var(--color-background-secondary)',
    borderRadius: 8,
  },
};

const goalStyles = {
  card: {
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 10,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  desc: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginTop: 3,
    lineHeight: 1.5,
  },
  actions: { display: 'flex', gap: 4, alignItems: 'center' },
  iconBtn: {
    width: 26,
    height: 26,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-secondary)',
    fontSize: 12,
    cursor: 'pointer',
    borderRadius: 4,
  },
  confirmDelete: {
    padding: '3px 8px',
    background: '#e24b4a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 500,
    cursor: 'pointer',
  },
  evidenceAdd: {
    display: 'flex',
    gap: 6,
  },
  evidenceInput: {
    flex: 1,
    padding: '5px 10px',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 6,
    fontSize: 12,
    background: 'var(--color-background-secondary)',
    outline: 'none',
  },
  evidenceBtn: {
    padding: '5px 12px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
  },
  expandBtn: {
    background: 'transparent',
    border: 'none',
    color: '#534AB7',
    fontSize: 11,
    cursor: 'pointer',
    padding: 0,
    textAlign: 'left',
  },
  evidenceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginTop: 4,
  },
};

const evidenceStyles = {
  row: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
    padding: '4px 8px',
    background: 'var(--color-background-secondary)',
    borderRadius: 6,
  },
  date: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    minWidth: 80,
    paddingTop: 2,
  },
  text: {
    flex: 1,
    fontSize: 12,
    color: 'var(--color-text-primary)',
    cursor: 'text',
    lineHeight: 1.5,
  },
  editInput: {
    flex: 1,
    padding: '2px 6px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 4,
    fontSize: 12,
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  removeBtn: {
    width: 20,
    height: 20,
    background: 'transparent',
    border: 'none',
    fontSize: 12,
    color: 'var(--color-text-tertiary)',
    cursor: 'pointer',
  },
};
