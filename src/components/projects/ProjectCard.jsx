import { projectColor } from '../../lib/constants.js';

const STATUS_OPTIONS = ['', '🟢 On track', '🟡 At risk', '🔴 Off track'];

export default function ProjectCard({ project, allProjects, taskCount, onClick }) {
  const color = projectColor(project.name, allProjects);
  const delivCount = (project.deliverables || []).length;
  const congressCount = (project.congresses || []).length;

  return (
    <button onClick={onClick} style={{ ...styles.card, borderTop: `3px solid ${color}` }}>
      <div style={styles.title}>{project.name || '(untitled)'}</div>
      {project.number && <div style={styles.number}>#{project.number}</div>}
      {project.status && (
        <div style={{ ...styles.status, color }}>{project.status}</div>
      )}
      <div style={styles.meta}>
        {taskCount > 0 && <span>{taskCount} task{taskCount === 1 ? '' : 's'}</span>}
        {delivCount > 0 && <span>{delivCount} deliverable{delivCount === 1 ? '' : 's'}</span>}
        {congressCount > 0 && <span>🏛 {congressCount}</span>}
      </div>
      {project.nextSteps && (
        <div style={styles.nextSteps}>{project.nextSteps}</div>
      )}
    </button>
  );
}

const styles = {
  card: {
    background: '#fff',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 10,
    padding: '12px 14px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  title: { fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' },
  number: { fontSize: 11, color: 'var(--color-text-tertiary)' },
  status: { fontSize: 11, fontWeight: 500 },
  meta: {
    fontSize: 10,
    color: 'var(--color-text-secondary)',
    display: 'flex',
    gap: 10,
    marginTop: 4,
  },
  nextSteps: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginTop: 6,
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
};
