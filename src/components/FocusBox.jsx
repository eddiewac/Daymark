import { useEffect, useState } from 'react';
import { fmtElapsed } from '../hooks/useTime.js';
import { projectColor } from '../lib/constants.js';

export default function FocusBox({
  task,
  project,
  station,
  deliverable,
  elapsedMs,
  notes,
  tagChecklists, // { tag: [item1, item2, ...] }
  onStop,
  onCancel,
  onUpdateTask,
  onUpdateProject,
  onAddNote,
  onClose,
}) {
  if (!task) return null;

  const projColor = project ? projectColor(project.name, [project]) : '#534AB7';
  const taskTags = task.tags || [];

  // Build the list of checklists to show: only those whose tag matches a task tag
  const activeChecklists = (taskTags || [])
    .map((tag) => {
      // Case-insensitive lookup
      const match = Object.keys(tagChecklists || {}).find(
        (k) => k.toLowerCase() === tag.toLowerCase()
      );
      return match ? { tag: match, items: tagChecklists[match] } : null;
    })
    .filter(Boolean);

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        {/* Top bar */}
        <div style={styles.topBar}>
          <div style={styles.modeLabel}>FOCUS MODE</div>
          <button onClick={onClose} style={styles.closeBtn} title="Hide focus box (timer keeps running)">
            ×
          </button>
        </div>

        {/* Task header card */}
        <div style={styles.taskCard}>
          <div style={styles.nowTracking}>NOW TRACKING</div>
          {deliverable && station && (
            <div style={styles.locationBadge}>
              📍 {deliverable.name} → {station.name}
            </div>
          )}
          <div style={styles.taskTitle}>{task.title || 'Untitled task'}</div>

          {(task.taskNumber || task.expenditureType || task.project) && (
            <div style={styles.metaRow}>
              {task.project && (
                <span style={{ ...styles.metaPill, color: projColor, background: projColor + '15' }}>
                  {task.project}
                </span>
              )}
              {task.taskNumber && (
                <span style={styles.metaPill}>Task #{task.taskNumber}</span>
              )}
              {task.expenditureType && (
                <span style={{ ...styles.metaPill, background: '#BA751722', color: '#BA7517' }}>
                  {task.expenditureType}
                </span>
              )}
            </div>
          )}

          {taskTags.length > 0 && (
            <div style={styles.tagsRow}>
              {taskTags.map((t) => (
                <span key={t} style={styles.tagPill}>#{t}</span>
              ))}
            </div>
          )}

          <div style={styles.timerRow}>
            <div style={styles.elapsed}>{fmtElapsed(elapsedMs)}</div>
            <button onClick={onStop} style={styles.stopBtn} title="Stop & log time">
              ■ Stop
            </button>
          </div>
        </div>

        {/* Tag-driven checklists */}
        {activeChecklists.length > 0 && (
          <div style={styles.section}>
            {activeChecklists.map(({ tag, items }) => (
              <ChecklistBlock
                key={tag}
                tag={tag}
                items={items}
                progress={task.checklistProgress?.[tag] || {}}
                onToggle={(idx, checked) => {
                  const oldProgress = task.checklistProgress || {};
                  const oldTagProgress = oldProgress[tag] || {};
                  const item = items[idx];
                  const newTagProgress = { ...oldTagProgress, [item]: checked };
                  // Clean up false entries to keep storage tidy
                  if (!checked) delete newTagProgress[item];
                  const newProgress = { ...oldProgress, [tag]: newTagProgress };
                  if (Object.keys(newTagProgress).length === 0) {
                    delete newProgress[tag];
                  }
                  onUpdateTask(task.id, { checklistProgress: newProgress });
                }}
              />
            ))}
          </div>
        )}

        {/* Project brief */}
        {project && (
          <ProjectBrief project={project} onUpdate={onUpdateProject} />
        )}

        {/* Task notes */}
        <TaskNotesSection
          task={task}
          notes={notes}
          onAddNote={onAddNote}
        />
      </div>
    </div>
  );
}

// ── Checklist block ──────────────────────────────────────────────────────────
function ChecklistBlock({ tag, items, progress, onToggle }) {
  const doneCount = items.filter((i) => progress[i]).length;

  return (
    <div style={checklistStyles.wrap}>
      <div style={checklistStyles.header}>
        <span style={checklistStyles.tag}>#{tag}</span>
        <span style={checklistStyles.progress}>
          {doneCount}/{items.length}
        </span>
      </div>
      <div style={checklistStyles.list}>
        {items.map((item, i) => {
          const checked = !!progress[item];
          return (
            <label key={i} style={checklistStyles.item}>
              <button
                onClick={() => onToggle(i, !checked)}
                style={{
                  ...checklistStyles.check,
                  background: checked ? '#534AB7' : 'transparent',
                  borderColor: checked ? '#534AB7' : 'var(--color-border-primary)',
                }}
              >
                {checked && (
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
              <span
                style={{
                  ...checklistStyles.label,
                  textDecoration: checked ? 'line-through' : 'none',
                  opacity: checked ? 0.55 : 1,
                }}
              >
                {item}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── Project brief ────────────────────────────────────────────────────────────
function ProjectBrief({ project, onUpdate }) {
  const [nextSteps, setNextSteps] = useState(project.nextSteps || '');
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    setNextSteps(project.nextSteps || '');
  }, [project.id]);

  // Save on blur
  const flush = async () => {
    if (nextSteps === (project.nextSteps || '')) return;
    await onUpdate(project.id, { nextSteps });
    setSavedAt(Date.now());
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <span style={styles.sectionLabel}>PROJECT</span>
        <span style={styles.projectName}>{project.name}</span>
      </div>
      <textarea
        value={nextSteps}
        onChange={(e) => setNextSteps(e.target.value)}
        onBlur={flush}
        placeholder="Next steps for this project…"
        rows={3}
        style={styles.briefArea}
      />
      {savedAt && (
        <div style={styles.savedNote}>Saved · click outside to commit</div>
      )}
    </div>
  );
}

// ── Task notes section ───────────────────────────────────────────────────────
function TaskNotesSection({ task, notes, onAddNote }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', body: '' });

  const taskNotes = (notes || [])
    .filter((n) => n.taskIds?.includes(task.id))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const save = async () => {
    if (!draft.body.trim()) return;
    await onAddNote(
      {
        title: draft.title.trim(),
        body: draft.body.trim(),
        taskIds: [task.id],
        projectName: task.project || null,
      },
      false // personal notes
    );
    setDraft({ title: '', body: '' });
    setAdding(false);
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <span style={styles.sectionLabel}>TASK NOTES</span>
        <button
          onClick={() => setAdding((v) => !v)}
          style={styles.addNoteBtn}
        >
          {adding ? 'Cancel' : '+ Note'}
        </button>
      </div>

      {adding && (
        <div style={styles.addNoteForm}>
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Title (optional)"
            style={styles.noteInput}
          />
          <textarea
            value={draft.body}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            placeholder="Write your note…"
            rows={3}
            style={styles.noteTextarea}
          />
          <button onClick={save} style={styles.saveNoteBtn}>
            Save note
          </button>
        </div>
      )}

      {taskNotes.length === 0 && !adding && (
        <div style={styles.emptyNotes}>No notes for this task yet.</div>
      )}

      {taskNotes.map((n) => (
        <div key={n.id} style={styles.noteCard}>
          {n.title && <div style={styles.noteTitle}>{n.title}</div>}
          <div style={styles.noteBody}>{n.body}</div>
          <div style={styles.noteDate}>{fmtRelative(n.createdAt)}</div>
        </div>
      ))}
    </div>
  );
}

function fmtRelative(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(20,20,20,0.55)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    overflow: 'auto',
    padding: '40px 20px 80px 20px',
  },
  dialog: {
    background: '#fff',
    borderRadius: 14,
    width: '100%',
    maxWidth: 580,
    boxShadow: '0 18px 50px rgba(0,0,0,0.25)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 18,
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: '#FF6B35',
    letterSpacing: 0.6,
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
  taskCard: {
    background: '#534AB711',
    border: '0.5px solid #534AB733',
    borderRadius: 12,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  nowTracking: {
    fontSize: 10,
    fontWeight: 600,
    color: '#534AB7',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  locationBadge: {
    alignSelf: 'flex-start',
    fontSize: 10,
    padding: '2px 8px',
    borderRadius: 12,
    background: '#534AB711',
    color: '#534AB7',
  },
  taskTitle: {
    fontSize: 17,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  metaRow: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  metaPill: {
    fontSize: 10,
    padding: '1px 7px',
    borderRadius: 12,
    background: 'var(--color-background-secondary)',
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
  },
  tagsRow: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  tagPill: {
    fontSize: 10,
    color: 'var(--color-text-secondary)',
  },
  timerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  elapsed: {
    flex: 1,
    fontSize: 26,
    fontWeight: 500,
    color: '#534AB7',
    fontVariantNumeric: 'tabular-nums',
    fontFamily: 'monospace',
  },
  stopBtn: {
    padding: '8px 18px',
    border: 'none',
    background: '#FF6B35',
    color: '#fff',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  section: {
    background: 'var(--color-background-secondary)',
    borderRadius: 10,
    padding: 12,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  projectName: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  briefArea: {
    width: '100%',
    padding: '8px 10px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    background: '#fff',
    fontSize: 12,
    lineHeight: 1.5,
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
  },
  savedNote: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    marginTop: 4,
  },
  addNoteBtn: {
    padding: '3px 10px',
    background: '#fff',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    fontSize: 11,
    cursor: 'pointer',
  },
  addNoteForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 10,
    background: '#fff',
    borderRadius: 8,
    marginBottom: 8,
  },
  noteInput: {
    padding: '5px 8px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 12,
    outline: 'none',
  },
  noteTextarea: {
    padding: '5px 8px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 12,
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  saveNoteBtn: {
    padding: '6px 12px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  emptyNotes: {
    padding: 8,
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  noteCard: {
    background: '#fff',
    borderRadius: 8,
    padding: 10,
    borderLeft: '3px solid #534AB7',
    marginBottom: 6,
  },
  noteTitle: {
    fontSize: 12,
    fontWeight: 500,
    marginBottom: 3,
  },
  noteBody: {
    fontSize: 12,
    color: 'var(--color-text-primary)',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.5,
  },
  noteDate: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    marginTop: 6,
  },
};

const checklistStyles = {
  wrap: {
    background: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    border: '0.5px solid var(--color-border-tertiary)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tag: {
    fontSize: 11,
    fontWeight: 600,
    color: '#534AB7',
  },
  progress: {
    fontSize: 10,
    color: 'var(--color-text-secondary)',
    fontFamily: 'monospace',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    padding: '3px 0',
  },
  check: {
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
  label: {
    flex: 1,
    fontSize: 12,
    color: 'var(--color-text-primary)',
    lineHeight: 1.4,
  },
};
