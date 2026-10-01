import { useState } from 'react';
import { PRIORITY_COLORS, projectColor } from '../../lib/constants.js';
import { taskDeliverable } from '../../lib/deliverableStatus.js';
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
  onUpdate,
  onDelete,
  onAssign,
  onUnassign,
  onStartTimer,
  onStopTimer,
  onJumpToTrack,
}) {
  const [showAssign, setShowAssign] = useState(false);
  const [confirmDone, setConfirmDone] = useState(null); // null | { assigneeLabel }
  // Local draft of the inline estimate input — saved on blur via onUpdate.
  const [estDraft, setEstDraft] = useState(
    task.estimate != null ? String(task.estimate) : ''
  );
  const commitEstimate = () => {
    if (!onUpdate) return;
    const raw = estDraft;
    const next =
      raw === '' || raw == null ? null : Number(raw);
    const cleaned = Number.isFinite(next) && next >= 0 ? next : null;
    const current = task.estimate ?? null;
    if (cleaned === current) return; // nothing changed
    onUpdate(task.id, { estimate: cleaned });
  };

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

  // ── Confirmation logic for ticking off someone else's task ──────────────
  // Rules:
  //   - Personal workspace (no workspaceId) → no confirmation needed
  //   - Task has no assignees → no confirmation needed
  //   - Current user is one of the assignees → no confirmation needed
  //   - Already done (unticking) → no confirmation needed
  //   - Otherwise → show confirmation
  //
  // Supports both the new array model (task.assignees: [uid, ...]) and the
  // older singular model (task.assignedToId: uid), so legacy tasks aren't
  // broken by this change.
  function handleToggleClick() {
    // Unticking a done task is always allowed — less risky than ticking
    if (task.done) {
      onToggleDone(task.id);
      return;
    }

    // Personal workspace? Just toggle.
    if (!workspaceId) {
      onToggleDone(task.id);
      return;
    }

    // Build the list of assignee IDs, handling both data models.
    const assigneeIds = [];
    if (Array.isArray(task.assignees)) {
      assigneeIds.push(...task.assignees);
    }
    if (task.assignedToId && !assigneeIds.includes(task.assignedToId)) {
      assigneeIds.push(task.assignedToId);
    }

    // No assignees → no one to step on → toggle directly
    if (assigneeIds.length === 0) {
      onToggleDone(task.id);
      return;
    }

    // You're one of the assignees → it's your task → toggle directly
    if (currentUserId && assigneeIds.includes(currentUserId)) {
      onToggleDone(task.id);
      return;
    }

    // You're not an assignee, but someone else is. Confirm.
    const assigneeLabels = assigneeIds
      .map((uid) => {
        const m = members?.find((mm) => mm.id === uid);
        if (!m?.email) return null;
        return m.email.split('@')[0]; // local part of email, e.g. "eddiewac"
      })
      .filter(Boolean);

    const label =
      assigneeLabels.length === 0
        ? 'someone else'
        : assigneeLabels.length === 1
        ? assigneeLabels[0]
        : assigneeLabels.length === 2
        ? `${assigneeLabels[0]} and ${assigneeLabels[1]}`
        : `${assigneeLabels[0]} and ${assigneeLabels.length - 1} others`;

    setConfirmDone({ assigneeLabel: label });
  }

  function confirmAndToggle() {
    setConfirmDone(null);
    onToggleDone(task.id);
  }

  return (
    <div
      style={{
        ...styles.row,
        background: isAssigned ? 'var(--accent-soft)' : 'transparent',
        borderLeft: isAssigned ? '3px solid #534AB7' : '3px solid transparent',
      }}
    >
      <button
        onClick={handleToggleClick}
        style={{
          ...styles.check,
          border: `1.5px solid ${task.done ? 'var(--accent)' : priColor}`,
          background: task.done ? 'var(--accent)' : 'transparent',
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
          {task.outOfScope && (
            <span
              style={{ ...styles.pill, background: '#e24b4a22', color: '#e24b4a', fontWeight: 600 }}
              title={
                task.outOfScopeNotes
                  ? `Out of scope — ${task.outOfScopeNotes}${task.outOfScopeHours ? ` (${task.outOfScopeHours}h)` : ''}`
                  : task.outOfScopeHours
                  ? `Out of scope — ${task.outOfScopeHours}h`
                  : 'Out of scope'
              }
            >
              ⚠ OOS{task.outOfScopeHours ? ` · ${task.outOfScopeHours}h` : ''}
            </span>
          )}
          {task.project && (
            <span style={{ ...styles.pill, background: projColor + '22', color: projColor }}>
              {task.project}
            </span>
          )}
          {(() => {
            const deliv = taskDeliverable(task, projects);
            return deliv ? (
              <span style={{ ...styles.pill, background: projColor + '14', color: projColor }} title={`Deliverable: ${deliv.name}`}>
                ▸ {deliv.name}
              </span>
            ) : null;
          })()}
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
        {/* Inline estimate input — quick hours entry without opening the
            full task form. Saves on blur. Hidden if there's no onUpdate
            (e.g. an assigned task in a workspace we can't write to). */}
        {onUpdate && !isAssigned && (
          <input
            type="number"
            step="0.25"
            min="0"
            value={estDraft}
            onChange={(e) => setEstDraft(e.target.value)}
            onBlur={commitEstimate}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setEstDraft(task.estimate != null ? String(task.estimate) : '');
                e.currentTarget.blur();
              }
            }}
            placeholder="h"
            title="Estimated hours"
            style={styles.estInput}
          />
        )}
        {/* Jump to this task's station in Track — only for station-linked
            tasks, since a standalone task has nowhere to jump to. */}
        {task.stationId && onJumpToTrack && (
          <button
            onClick={() => onJumpToTrack(task)}
            style={styles.actionBtn}
            title="Open in Track"
          >
            🚂
          </button>
        )}
        <button onClick={() => onEdit?.(task)} style={styles.actionBtn} title="Edit">
          ✎
        </button>
        <button onClick={() => onDelete(task.id)} style={styles.actionBtnDanger} title={isAssigned ? 'Dismiss' : 'Delete'}>
          {isAssigned ? '✕' : '🗑'}
        </button>
      </div>

      {/* Confirmation modal */}
      {confirmDone && (
        <div style={styles.modalBackdrop} onClick={() => setConfirmDone(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Mark this task done?</div>
            <div style={styles.modalBody}>
              This task is assigned to <strong>{confirmDone.assigneeLabel}</strong>, not you.
              Mark it done anyway?
            </div>
            <div style={styles.modalActions}>
              <button style={styles.modalCancel} onClick={() => setConfirmDone(null)}>
                Cancel
              </button>
              <button style={styles.modalConfirm} onClick={confirmAndToggle}>
                Yes, mark done
              </button>
            </div>
          </div>
        </div>
      )}
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
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
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
  estInput: {
    width: 44,
    height: 22,
    padding: '0 6px',
    fontSize: 11,
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 6,
    background: 'var(--bg-surface)',
    color: 'var(--color-text-primary)',
    textAlign: 'right',
    outline: 'none',
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
    background: 'var(--bg-surface)',
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

  // Confirmation modal
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalCard: {
    background: 'var(--bg-surface)',
    borderRadius: 12,
    padding: 24,
    maxWidth: 380,
    width: 'calc(100% - 32px)',
    boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
    border: '0.5px solid var(--color-border-primary)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.5,
    marginBottom: 20,
  },
  modalActions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
  },
  modalCancel: {
    padding: '8px 16px',
    border: '0.5px solid var(--color-border-primary)',
    background: 'transparent',
    color: 'var(--color-text-primary)',
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer',
  },
  modalConfirm: {
    padding: '8px 16px',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
};
