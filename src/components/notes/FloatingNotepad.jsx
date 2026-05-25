import Notepad from './Notepad.jsx';

// ── FloatingNotepad ─────────────────────────────────────────────────────────
// A right-side docked panel that hosts the Notepad so it can stay open while
// the user navigates the rest of the app. It renders the same <Notepad>
// component used by the Notepad tab — notepad content is global (persisted
// server-side), so the floating panel and the tab always show the same text.
//
// Layout: the parent (WorkspaceView) places this beside the main content in a
// flex row, so opening it pushes the content rather than covering it.

export default function FloatingNotepad({
  projects,
  tasks,
  workspaceId,
  onAddTask,
  onAddProject,
  onAddNote,
  onClose,
}) {
  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.title}>📝 Notepad</span>
        <button onClick={onClose} style={styles.close} title="Close notepad">
          ×
        </button>
      </div>
      <div style={styles.body}>
        <Notepad
          projects={projects}
          tasks={tasks}
          workspaceId={workspaceId}
          onAddTask={onAddTask}
          onAddProject={onAddProject}
          onAddNote={onAddNote}
        />
      </div>
    </div>
  );
}

const styles = {
  panel: {
    width: 420,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    borderLeft: '0.5px solid var(--color-border-tertiary)',
    background: 'var(--bg-surface)',
    minHeight: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    flexShrink: 0,
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  close: {
    width: 24,
    height: 24,
    background: 'transparent',
    border: 'none',
    fontSize: 18,
    color: 'var(--color-text-tertiary)',
    cursor: 'pointer',
  },
  body: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
};
