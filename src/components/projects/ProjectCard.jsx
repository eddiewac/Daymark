import { projectColorWithGroups, findGroup } from '../../lib/projectGroups.js';
import { projectHealth } from '../../lib/stations.js';

const HEALTH_COLOR = {
  green: '#1d9e75',
  amber: '#ef9f27',
  red: '#e24b4a',
};

export default function ProjectCard({
  project,
  allProjects,
  projectGroups,
  taskCount,
  projectTasks,
  onClick,
}) {
  const color = projectColorWithGroups(project, allProjects, projectGroups);
  const group = findGroup(projectGroups, project.group);
  const delivCount = (project.deliverables || []).length;
  const congressCount = (project.congresses || []).length;
  const health = projectHealth(project, projectTasks || []);

  return (
    <button onClick={onClick} style={{ ...styles.card, borderTop: `3px solid ${color}` }}>
      <div style={styles.titleRow}>
        <div style={styles.title}>{project.name || '(untitled)'}</div>
        <span
          style={{
            ...styles.healthDot,
            background: HEALTH_COLOR[health.status] || HEALTH_COLOR.green,
          }}
          title={
            health.reasons.length
              ? health.reasons.join(' · ')
              : 'No issues detected'
          }
        />
      </div>
      {project.number && <div style={styles.number}>#{project.number}</div>}
      {group && (
        <div style={styles.groupRow}>
          <span style={{ ...styles.groupDot, background: group.color }} />
          <span style={styles.groupName}>{group.name}</span>
        </div>
      )}
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
    background: 'var(--bg-surface)',
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
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', flex: 1, minWidth: 0 },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  number: { fontSize: 11, color: 'var(--color-text-tertiary)' },
  groupRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  groupDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  },
  groupName: {
    fontSize: 10,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
  },
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

