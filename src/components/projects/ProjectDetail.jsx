import { useState, useEffect } from 'react';
import { projectColor } from '../../lib/constants.js';
import DeliverableEditor from './DeliverableEditor.jsx';

const STATUS_OPTIONS = ['', '🟢 On track', '🟡 At risk', '🔴 Off track'];

export default function ProjectDetail({
  project,
  allProjects,
  tasks,
  congresses,
  stationTemplates,
  onUpdate,
  onDelete,
  onTrack,
  onClose,
}) {
  const [draft, setDraft] = useState(project);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setDraft(project);
  }, [project.id]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  // Auto-save on field blur
  const flush = () => {
    if (JSON.stringify(draft) !== JSON.stringify(project)) {
      onUpdate(project.id, draft);
    }
  };

  const color = projectColor(project.name, allProjects);
  const projectTasks = (tasks || []).filter((t) => t.project === project.name);
  const doneCount = projectTasks.filter((t) => t.done).length;
  const totalCount = projectTasks.length;

  return (
    <div style={styles.wrap}>
      <div style={{ ...styles.header, borderTop: `3px solid ${color}` }}>
        <input
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          onBlur={flush}
          placeholder="Project name"
          style={styles.titleInput}
        />
        {onTrack && (
          <button onClick={onTrack} style={styles.trackBtn} title="Open in Track view">
            🚂 Track
          </button>
        )}
        <button onClick={onClose} style={styles.closeBtn}>
          ×
        </button>
      </div>

      <div style={styles.body}>
        {/* Top metadata grid */}
        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Project number</label>
            <input
              value={draft.number || ''}
              onChange={(e) => set({ number: e.target.value })}
              onBlur={flush}
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Status</label>
            <select
              value={draft.status || ''}
              onChange={(e) => {
                set({ status: e.target.value });
                setTimeout(flush, 0);
              }}
              style={styles.input}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s || '—'}
                </option>
              ))}
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Start date</label>
            <input
              type="date"
              value={draft.startDate || ''}
              onChange={(e) => set({ startDate: e.target.value })}
              onBlur={flush}
              style={styles.input}
            />
          </div>
        </div>

        {/* Task summary */}
        {totalCount > 0 && (
          <div style={styles.taskSummary}>
            <div style={styles.taskBar}>
              <div
                style={{
                  ...styles.taskBarFill,
                  width: `${(doneCount / totalCount) * 100}%`,
                  background: color,
                }}
              />
            </div>
            <div style={styles.taskMeta}>
              {doneCount} of {totalCount} tasks complete
            </div>
          </div>
        )}

        {/* Next steps + Blockers */}
        <div style={styles.field}>
          <label style={styles.label}>Next steps</label>
          <textarea
            value={draft.nextSteps || ''}
            onChange={(e) => set({ nextSteps: e.target.value })}
            onBlur={flush}
            placeholder="What's the immediate next thing?"
            rows={3}
            style={styles.textarea}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Blockers</label>
          <textarea
            value={draft.blockers || ''}
            onChange={(e) => set({ blockers: e.target.value })}
            onBlur={flush}
            placeholder="What's getting in the way?"
            rows={2}
            style={styles.textarea}
          />
        </div>

        {/* Linked congresses */}
        <div style={styles.field}>
          <label style={styles.label}>
            Linked congresses
            <span style={{ opacity: 0.6, fontWeight: 400, marginLeft: 6 }}>
              (markers appear on the Gantt for these)
            </span>
          </label>
          {(!congresses || congresses.length === 0) ? (
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontStyle: 'italic', padding: 6 }}>
              No congresses in this workspace yet. Add some in the Congresses tab.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {congresses.map((c) => {
                const linked = (draft.congresses || []).includes(c.id);
                const color = c.color || '#534AB7';
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      const current = draft.congresses || [];
                      const next = linked
                        ? current.filter((id) => id !== c.id)
                        : [...current, c.id];
                      const newDraft = { ...draft, congresses: next };
                      setDraft(newDraft);
                      onUpdate(project.id, newDraft);
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 16,
                      border: `0.5px solid ${linked ? color : 'var(--color-border-secondary)'}`,
                      background: linked ? color + '22' : 'transparent',
                      color: linked ? color : 'var(--color-text-secondary)',
                      fontSize: 11,
                      fontWeight: linked ? 500 : 400,
                      cursor: 'pointer',
                    }}
                    title={c.name + (c.startDate ? ` · starts ${c.startDate}` : '')}
                  >
                    {c.abbr || c.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Deliverables */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Deliverables</div>
          <DeliverableEditor
            deliverables={draft.deliverables || []}
            stationTemplates={stationTemplates}
            onChange={(deliverables) => {
              const updated = { ...draft, deliverables };
              setDraft(updated);
              onUpdate(project.id, { deliverables });
            }}
          />
        </div>

        {/* Delete */}
        <div style={styles.dangerZone}>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              style={styles.deleteBtn}
            >
              Delete project
            </button>
          ) : (
            <div style={styles.confirmRow}>
              <span style={{ fontSize: 12, color: '#e24b4a' }}>
                Delete this project? Tasks will not be deleted but will lose their project link.
              </span>
              <button
                onClick={() => {
                  onDelete(project.id);
                  onClose?.();
                }}
                style={styles.deleteConfirmBtn}
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
    </div>
  );
}

const styles = {
  wrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 16px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  titleInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: 600,
    border: 'none',
    background: 'transparent',
    outline: 'none',
    color: 'var(--color-text-primary)',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 22,
    color: 'var(--color-text-secondary)',
    width: 28,
    height: 28,
  },
  trackBtn: {
    padding: '5px 12px',
    background: '#534AB711',
    color: '#534AB7',
    border: '0.5px solid #534AB7',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    marginRight: 8,
    cursor: 'pointer',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  row: { display: 'flex', gap: 10 },
  field: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  label: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
  },
  input: {
    padding: '6px 10px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    background: '#fff',
    fontSize: 13,
    outline: 'none',
  },
  textarea: {
    padding: '8px 10px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    background: '#fff',
    fontSize: 13,
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.5,
  },
  taskSummary: {
    background: 'var(--color-background-secondary)',
    borderRadius: 8,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  taskBar: {
    height: 6,
    background: 'var(--color-border-tertiary)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  taskBarFill: { height: '100%', transition: 'width 0.2s' },
  taskMeta: { fontSize: 11, color: 'var(--color-text-secondary)' },
  section: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dangerZone: {
    marginTop: 24,
    paddingTop: 16,
    borderTop: '0.5px solid var(--color-border-tertiary)',
  },
  deleteBtn: {
    padding: '6px 14px',
    border: '0.5px solid #e24b4a',
    color: '#e24b4a',
    borderRadius: 8,
    background: 'transparent',
    fontSize: 12,
  },
  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  deleteConfirmBtn: {
    padding: '6px 14px',
    border: 'none',
    background: '#e24b4a',
    color: '#fff',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
  },
  cancelBtn: {
    padding: '6px 14px',
    border: '0.5px solid var(--color-border-primary)',
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    borderRadius: 8,
    fontSize: 12,
  },
};
