import { useState, useEffect, useRef, useMemo } from 'react';

// Notification bell for task assignments. Reuses the assignedTasks data the app
// already tracks (and keeps live via the assignments realtime subscription).
// "New" = assignments created since the user last opened the bell, tracked in
// localStorage (no DB change). Opening the dropdown marks everything seen.

const SEEN_KEY = 'daymark-notifications-seen';

function fmtWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function NotificationBell({ assignedTasks, currentUserId }) {
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(() => {
    try {
      return Number(localStorage.getItem(SEEN_KEY)) || 0;
    } catch {
      return 0;
    }
  });
  const ref = useRef(null);

  // Active assignment notifications: not dismissed, not assigned by yourself,
  // newest first.
  const notifications = useMemo(() => {
    return (assignedTasks || [])
      .filter((a) => !a.dismissed && a.assignedBy !== currentUserId)
      .slice()
      .sort((a, b) => {
        const ta = a.assignedAt ? new Date(a.assignedAt).getTime() : 0;
        const tb = b.assignedAt ? new Date(b.assignedAt).getTime() : 0;
        return tb - ta;
      });
  }, [assignedTasks, currentUserId]);

  // Unread = those created after lastSeen.
  const unreadCount = useMemo(
    () =>
      notifications.filter((a) => {
        const t = a.assignedAt ? new Date(a.assignedAt).getTime() : 0;
        return t > lastSeen;
      }).length,
    [notifications, lastSeen]
  );

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // Opening marks everything seen (clears the badge).
      const now = Date.now();
      setLastSeen(now);
      try {
        localStorage.setItem(SEEN_KEY, String(now));
      } catch {}
    }
  };

  return (
    <div style={styles.wrap} ref={ref}>
      <button onClick={toggleOpen} style={styles.bellBtn} title="Notifications">
        🔔
        {unreadCount > 0 && (
          <span style={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={styles.dropdown}>
          <div style={styles.header}>Notifications</div>
          {notifications.length === 0 ? (
            <div style={styles.empty}>
              Nothing new. When someone assigns you a task, it'll show here.
            </div>
          ) : (
            <div style={styles.list}>
              {notifications.slice(0, 20).map((a) => {
                const isNew =
                  (a.assignedAt ? new Date(a.assignedAt).getTime() : 0) > lastSeen;
                return (
                  <div
                    key={a.assignmentId}
                    style={{ ...styles.item, ...(isNew ? styles.itemNew : {}) }}
                  >
                    <span style={styles.itemIcon}>📋</span>
                    <div style={styles.itemBody}>
                      <div style={styles.itemTitle}>
                        You were assigned <strong>{a.title || '(untitled task)'}</strong>
                      </div>
                      <div style={styles.itemMeta}>
                        {a.assignedFrom ? `${a.assignedFrom} · ` : ''}
                        {fmtWhen(a.assignedAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  bellBtn: {
    position: 'relative',
    width: 30,
    height: 30,
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    fontSize: 14,
    cursor: 'pointer',
    marginRight: 8,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 16,
    height: 16,
    padding: '0 4px',
    borderRadius: 8,
    background: '#e24b4a',
    color: '#fff',
    fontSize: 9,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  dropdown: {
    position: 'absolute',
    top: 36,
    right: 0,
    width: 320,
    maxHeight: 420,
    overflowY: 'auto',
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
    zIndex: 200,
  },
  header: {
    padding: '10px 14px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  empty: {
    padding: 20,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
    lineHeight: 1.5,
  },
  list: { display: 'flex', flexDirection: 'column' },
  item: {
    display: 'flex',
    gap: 10,
    padding: '10px 14px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  itemNew: { background: 'var(--accent-soft)' },
  itemIcon: { fontSize: 14, flexShrink: 0 },
  itemBody: { minWidth: 0 },
  itemTitle: { fontSize: 12, color: 'var(--color-text-primary)', lineHeight: 1.4 },
  itemMeta: { fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 },
};
