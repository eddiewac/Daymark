import { projectColor } from '../../lib/constants.js';

function fmtRelative(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function NoteCard({ note, projects, isActive, onClick }) {
  const proj = note.projectName
    ? projects?.find((p) => p.name === note.projectName)
    : null;
  const color = proj ? projectColor(proj.name, projects) : null;

  return (
    <button
      onClick={onClick}
      style={{
        ...styles.card,
        ...(isActive ? styles.cardActive : {}),
        borderLeft: color ? `3px solid ${color}` : '3px solid transparent',
      }}
    >
      <div style={styles.titleRow}>
        <div style={styles.title}>
          {note.title || <span style={styles.untitled}>(untitled)</span>}
        </div>
        <div style={styles.date}>{fmtRelative(note.updatedAt)}</div>
      </div>
      {note.body && (
        <div style={styles.preview}>{note.body.slice(0, 140)}</div>
      )}
      <div style={styles.tagRow}>
        {note.projectName && (
          <span
            style={{
              ...styles.projectPill,
              color: color || '#888',
              borderColor: color || '#ddd',
            }}
          >
            {note.projectName}
          </span>
        )}
        {note.taskIds?.length > 0 && (
          <span style={styles.taskPill}>
            ↪ {note.taskIds.length} task{note.taskIds.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </button>
  );
}

const styles = {
  card: {
    width: '100%',
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 8,
    padding: '10px 12px',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    transition: 'background 0.1s',
  },
  cardActive: {
    background: 'var(--accent-soft)',
    borderColor: 'var(--accent)',
  },
  titleRow: { display: 'flex', justifyContent: 'space-between', gap: 6 },
  title: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  untitled: { color: 'var(--color-text-tertiary)', fontWeight: 400 },
  date: { fontSize: 10, color: 'var(--color-text-tertiary)', flexShrink: 0 },
  preview: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  projectPill: {
    alignSelf: 'flex-start',
    fontSize: 10,
    padding: '1px 7px',
    borderRadius: 10,
    border: '0.5px solid',
    background: 'transparent',
    fontWeight: 500,
    marginTop: 2,
  },
  tagRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  taskPill: {
    alignSelf: 'flex-start',
    fontSize: 10,
    padding: '1px 7px',
    borderRadius: 10,
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    fontWeight: 500,
  },
};
