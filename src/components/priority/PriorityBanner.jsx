import { useMemo } from 'react';
import { projectColor } from '../../lib/constants.js';

// Renders one of three things:
//   1. Nothing (banner suppressed by user setting, and no priority set today)
//   2. The "set today's priority" banner (banner enabled, no priority set yet)
//   3. The pinned priority section (priority IS set, regardless of banner setting)

export default function PriorityBanner({
  todayPriority, // { primary, stretch, dismissed } or null
  bannerEnabled, // user setting
  tasks,
  projects,
  onOpenModal,
  onDismiss,
  onClear,
  onToggleDone,
}) {
  const primaryTask = useMemo(
    () =>
      todayPriority?.primary
        ? (tasks || []).find((t) => t.id === todayPriority.primary)
        : null,
    [todayPriority?.primary, tasks]
  );

  const stretchTasks = useMemo(
    () =>
      (todayPriority?.stretch || [])
        .map((id) => (tasks || []).find((t) => t.id === id))
        .filter(Boolean),
    [todayPriority?.stretch, tasks]
  );

  // Priority is "set" if there's a primary task picked
  const isSet = !!todayPriority?.primary;

  // Banner shown if: priority not set, banner enabled, AND not dismissed for today
  const showBanner = !isSet && bannerEnabled && !todayPriority?.dismissed;

  if (!isSet && !showBanner) return null;

  // ── Pinned priority section ───────────────────────────────────────────────
  if (isSet) {
    return (
      <div style={styles.pinned}>
        <div style={styles.pinnedHeader}>
          <span style={styles.pinnedLabel}>🎯 Today's priority</span>
          <button onClick={onOpenModal} style={styles.changeBtn} title="Change">
            Change
          </button>
          <button onClick={onClear} style={styles.clearBtn} title="Clear">
            ×
          </button>
        </div>

        {primaryTask ? (
          <PriorityTaskRow
            task={primaryTask}
            projects={projects}
            isPrimary
            onToggleDone={onToggleDone}
          />
        ) : (
          <div style={styles.missingTask}>
            (Primary task not found — it may have been deleted.)
          </div>
        )}

        {stretchTasks.length > 0 && (
          <div style={styles.stretchSection}>
            <div style={styles.stretchLabel}>Stretch goals</div>
            {stretchTasks.map((t) => (
              <PriorityTaskRow
                key={t.id}
                task={t}
                projects={projects}
                onToggleDone={onToggleDone}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Banner ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.banner}>
      <div style={styles.bannerText}>
        <span style={styles.bannerIcon}>🎯</span>
        <span>
          <strong>What's today's priority?</strong>{' '}
          <span style={styles.bannerDim}>
            One task you want to make sure gets done.
          </span>
        </span>
      </div>
      <div style={styles.bannerActions}>
        <button onClick={onOpenModal} style={styles.bannerSetBtn}>
          Set priority
        </button>
        <button onClick={onDismiss} style={styles.bannerDismissBtn} title="Skip for today">
          ×
        </button>
      </div>
    </div>
  );
}

// ── Single priority task row ─────────────────────────────────────────────────
function PriorityTaskRow({ task, projects, isPrimary, onToggleDone }) {
  const projColor = projectColor(task.project, projects);

  return (
    <div
      style={{
        ...rowStyles.row,
        borderLeft: `3px solid ${projColor}`,
        opacity: task.done ? 0.55 : 1,
      }}
    >
      <button
        onClick={() => onToggleDone(task.id)}
        style={{
          ...rowStyles.checkbox,
          background: task.done ? 'var(--accent)' : 'transparent',
          borderColor: task.done ? 'var(--accent)' : 'var(--color-border-primary)',
        }}
      >
        {task.done && (
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
      <div style={rowStyles.body}>
        <div
          style={{
            ...rowStyles.title,
            fontWeight: isPrimary ? 600 : 500,
            textDecoration: task.done ? 'line-through' : 'none',
          }}
        >
          {task.title || '(untitled)'}
        </div>
        {task.project && (
          <div style={{ ...rowStyles.project, color: projColor }}>
            {task.project}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '10px 14px',
    background: 'var(--accent-soft)',
    border: '0.5px solid var(--accent-soft-border)',
    borderRadius: 10,
    margin: '10px 14px 0',
    flexWrap: 'wrap',
  },
  bannerText: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: 'var(--color-text-primary)',
    flex: 1,
    minWidth: 240,
  },
  bannerIcon: { fontSize: 14 },
  bannerDim: { color: 'var(--color-text-secondary)' },
  bannerActions: { display: 'flex', gap: 6, alignItems: 'center' },
  bannerSetBtn: {
    padding: '5px 14px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
  },
  bannerDismissBtn: {
    width: 24,
    height: 24,
    background: 'transparent',
    border: 'none',
    fontSize: 16,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    borderRadius: 4,
  },
  pinned: {
    margin: '10px 14px 0',
    padding: 12,
    background: 'linear-gradient(180deg, var(--accent-soft), var(--accent-soft))',
    border: '0.5px solid var(--accent-soft-border)',
    borderRadius: 10,
  },
  pinnedHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pinnedLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--accent)',
    letterSpacing: 0.3,
  },
  changeBtn: {
    padding: '3px 10px',
    background: 'transparent',
    border: '0.5px solid #534AB7',
    color: 'var(--accent)',
    borderRadius: 6,
    fontSize: 10,
    cursor: 'pointer',
  },
  clearBtn: {
    width: 22,
    height: 22,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-tertiary)',
    fontSize: 14,
    cursor: 'pointer',
    borderRadius: 4,
  },
  missingTask: {
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
    padding: 8,
  },
  stretchSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTop: '0.5px dashed var(--accent-soft-border)',
  },
  stretchLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
};

const rowStyles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    background: 'var(--bg-surface)',
    borderRadius: 6,
    marginBottom: 4,
  },
  checkbox: {
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
  body: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 12,
    color: 'var(--color-text-primary)',
  },
  project: {
    fontSize: 10,
    fontWeight: 500,
    marginTop: 2,
  },
};
