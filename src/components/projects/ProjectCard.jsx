import { projectColorWithGroups, findGroup } from '../../lib/projectGroups.js';
import { projectHealth } from '../../lib/stations.js';
import { deliverableStatus } from '../../lib/deliverableStatus.js';

const HEALTH_COLOR = {
  green: '#1d9e75',
  amber: '#ef9f27',
  red: '#e24b4a',
};

// Short date like "12 Jun" from an ISO yyyy-mm-dd string.
function fmtShort(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

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

  // Per-deliverable status lines (only those with something to show).
  const delivStatuses = (project.deliverables || [])
    .map((d) => ({ name: d.name, status: deliverableStatus(d) }))
    .filter((x) => x.status);

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
      {delivStatuses.length > 0 && (
        <div style={styles.delivStatusList}>
          {delivStatuses.slice(0, 4).map((x, i) => (
            <div key={i} style={styles.delivStatusRow}>
              <span style={styles.delivStatusName}>{x.name}</span>
              <span
                style={{
                  ...styles.delivStatusBadge,
                  ...(x.status.kind === 'waiting' ? styles.badgeWaiting : {}),
                  ...(x.status.kind === 'awaiting' ? styles.badgeAwaiting : {}),
                  ...(x.status.complete ? styles.badgeComplete : {}),
                }}
              >
                {x.status.icon ? `${x.status.icon} ` : ''}
                {x.status.label}
                {x.status.date ? ` · ${fmtShort(x.status.date)}` : ''}
              </span>
            </div>
          ))}
          {delivStatuses.length > 4 && (
            <div style={styles.delivMore}>+ {delivStatuses.length - 4} more</div>
          )}
        </div>
      )}
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
  delivStatusList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    marginTop: 6,
  },
  delivStatusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'space-between',
  },
  delivStatusName: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
  },
  delivStatusBadge: {
    fontSize: 10,
    fontWeight: 500,
    color: 'var(--color-text-tertiary)',
    background: 'var(--color-background-secondary)',
    borderRadius: 4,
    padding: '1px 6px',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  badgeWaiting: {
    color: '#b06a00',
    background: '#ef9f2722',
  },
  badgeAwaiting: {
    color: '#185FA5',
    background: '#185FA522',
  },
  badgeComplete: {
    color: '#1d9e75',
    background: '#1d9e7522',
  },
  delivMore: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
  },
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

