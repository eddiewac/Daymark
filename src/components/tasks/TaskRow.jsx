import { useState } from 'react';
import { PRIORITY_COLORS, projectColor } from '../../lib/constants.js';
import { formatDue, daysUntil } from '../../lib/utils.js';
import { canTrackTime } from '../../hooks/useTime.js';

export default function TaskRow({
  task,
  projects,
  members,
  workspaceId,
  currentUserId,
  runningTimer,
  onToggleDone,
  onEdit,
  onDelete,
  onAssign,
  onUnassign,
  onStartTimer,
  onStopTimer,
}) {
  const [showAssign, setShowAssign] = useState(false);
  const priColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium;
  const projColor = projectColor(task.project, projects);
  const due = formatDue(task.dueDate);
  const dueDays = daysUntil(task.dueDate);
  const dueColor =
    dueDays == null
      ? 'var(--color-text-secondary)'
      : dueDays < 0
      ? '#e24b4a'
      : dueDays === 0
      ? '#D85A30'
      : dueDays <= 2
      ? '#BA7517'
      : 'var(--color-text-secondary)';

  const isAssigned = !!task.isAssigned;
  const assignedMember = members?.find((m) => m.id === task.assignedToId);

  return (
    <div
      style={{
        ...styles.row,
        background: isAssigned ? '#534AB708' : 'transparent',
        borderLeft: isAssigned ? '3px solid #534AB7' : '3px solid transparent',
      }}
    >
      <button
        onClick={() => onToggleDone(task.id)}
        style={{
          ...styles.check,
          border: `1.5px solid ${task.done ? '#534AB7' : priColor}`,
          background: task.done ? '#534AB7' : 'transparent',
        }}
        title="Toggle done"
      >
        {task.done && (
          <svg width={9} height={9} viewBox="0 0 9 9">
            <polyline
              points="1.5,5 4,7.5 8.5,2"
              fill="none"
              stroke="#fff"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <div style={styles.body}>
        <div
          style={{
            ...styles.title,
            textDecoration: task.done ? 'line-through' : 'none',
            opacity: task.done ? 0.6 : 1,
          }}
          onClick={() => onEdit?.(task)}
        >
          {task.title || <span style={{ color: 'var(--color-text-tertiary)' }}>(no title)</span>}
        </div>

        <div style={styles.meta}>
          {task.project && (
            <span style={{ ...styles.pill, background: projColor + '22', color: projColor }}>
              {task.project}
            </span>
          )}
          {task.category && (
            <span style={styles.pillNeutral}>{task.category}</span>
          )}
          {task.priority && task.priority !== 'Medium' && (
            <span style={{ ...styles.pill, background: priColor + '22', color: priColor }}>
              {task.priority}
            </span>
          )}
          {due && (
            <span style={{ ...styles.pill, color: dueColor, background: dueColor + '15' }}>
              {due}
            </span>
          )}
          {isAssigned && task.assignedFrom && (
            <span style={styles.wsBadge}>🏢 {task.assignedFrom}</span>
          )}
          {!isAssigned && assignedMember && workspaceId && (
            <span style={styles.assignedBadge}>
              👤 {assignedMember.email?.split('@')[0] || 'assigned'}
            </span>
          )}
          {(task.tags || []).map((t) => (
            <span key={t} style={styles.tag}>
              #{t}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        {onStartTimer && canTrackTime(task, currentUserId, workspaceId) && (
          (() => {
            const isRunning = runningTimer?.taskId === task.id;
            return (
              <button
                onClick={() =>
                  isRunning ? onStopTimer() : onStartTimer(task)
                }
                style={{
                  ...styles.actionBtn,
                  color: isRunning ? '#FF6B35' : 'var(--color-text-secondary)',
                  fontSize: 11,
                }}
                title={isRunning ? 'Stop timer' : 'Start timer'}
              >
                {isRunning ? '■' : '▶'}
              </button>
            );
          })()
        )}
        {workspaceId && members && members.length > 0 && !isAssigned && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowAssign((v) => !v)}
              style={styles.actionBtn}
              title="Assign"
            >
              👤
            </button>
            {showAssign && (
              <div style={styles.assignMenu}>
                <div style={styles.assignHdr}>Assign to</div>
                <button
                  style={styles.assignItem}
                  onClick={() => {
                    onUnassign(task.id);
                    setShowAssign(false);
                  }}
                >
                  Unassigned
                </button>
                {members.map((m) => (
                  <button
                    key={m.id}
                    style={styles.assignItem}
                    onClick={() => {
                      onAssign(task.id, m.id, m.email);
                      setShowAssign(false);
                    }}
                  >
                    {m.email || m.id.slice(0, 8)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button onClick={() => onEdit?.(task)} style={styles.actionBtn} title="Edit">
          ✎
        </button>
        <button onClick={() => onDelete(task.id)} style={styles.actionBtnDanger} title={isAssigned ? 'Dismiss' : 'Delete'}>
          {isAssigned ? '✕' : '🗑'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '8px 10px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  check: {
    flexShrink: 0,
    width: 16,
    height: 16,
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  body: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 13,
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    lineHeight: 1.4,
  },
  meta: {
    marginTop: 4,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
  },
  pill: {
    fontSize: 10,
    padding: '1px 7px',
    borderRadius: 10,
    fontWeight: 500,
  },
  pillNeutral: {
    fontSize: 10,
    padding: '1px 7px',
    borderRadius: 10,
    background: 'var(--color-background-secondary)',
    color: 'var(--color-text-secondary)',
  },
  tag: {
    fontSize: 10,
    color: 'var(--color-text-secondary)',
  },
  wsBadge: {
    fontSize: 10,
    padding: '1px 7px',
    borderRadius: 10,
    background: '#534AB722',
    color: '#534AB7',
    fontWeight: 500,
  },
  assignedBadge: {
    fontSize: 10,
    padding: '1px 7px',
    borderRadius: 10,
    background: '#1d9e7522',
    color: '#1d9e75',
    fontWeight: 500,
  },
  actions: { display: 'flex', gap: 2, flexShrink: 0 },
  actionBtn: {
    width: 24,
    height: 24,
    border: 'none',
    background: 'transparent',
    borderRadius: 6,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
  actionBtnDanger: {
    width: 24,
    height: 24,
    border: 'none',
    background: 'transparent',
    borderRadius: 6,
    fontSize: 12,
    color: '#e24b4a',
  },
  assignMenu: {
    position: 'absolute',
    right: 0,
    top: 28,
    background: '#fff',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    minWidth: 180,
    padding: 4,
    zIndex: 50,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
  assignHdr: {
    fontSize: 10,
    color: 'var(--color-text-secondary)',
    padding: '4px 8px',
    fontWeight: 500,
    textTransform: 'uppercase',
  },
  assignItem: {
    display: 'block',
    width: '100%',
    padding: '6px 8px',
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    textAlign: 'left',
    fontSize: 12,
  },
};
