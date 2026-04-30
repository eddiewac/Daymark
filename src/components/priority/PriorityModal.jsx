import { useMemo, useState } from 'react';
import { todayStr } from '../../lib/utils.js';
import { projectColor } from '../../lib/constants.js';

export default function PriorityModal({
  tasks,
  projects,
  current,
  onSave,
  onClose,
}) {
  const [primaryId, setPrimaryId] = useState(current?.primary || '');
  const [stretchIds, setStretchIds] = useState(current?.stretch || []);
  const [search, setSearch] = useState('');

  // Candidates: open tasks that are due today, overdue, or have no due date
  const candidates = useMemo(() => {
    const today = todayStr();
    const list = (tasks || []).filter((t) => {
      if (t.done) return false;
      // Either no due date, or due today/overdue. Future-dated tasks excluded
      // (they don't belong to today's priorities by definition)
      if (!t.dueDate) return true;
      return t.dueDate <= today;
    });

    // Filter by search
    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (t) =>
            (t.title || '').toLowerCase().includes(q) ||
            (t.project || '').toLowerCase().includes(q)
        )
      : list;

    // Sort: overdue first, then today, then no-date; recently created at top of each
    return filtered.sort((a, b) => {
      const aOverdue = a.dueDate && a.dueDate < today ? 0 : a.dueDate === today ? 1 : 2;
      const bOverdue = b.dueDate && b.dueDate < today ? 0 : b.dueDate === today ? 1 : 2;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [tasks, search]);

  const togglePrimary = (id) => {
    if (primaryId === id) {
      setPrimaryId('');
    } else {
      setPrimaryId(id);
      // If it was a stretch, remove it from stretch
      setStretchIds((prev) => prev.filter((x) => x !== id));
    }
  };

  const toggleStretch = (id) => {
    if (id === primaryId) return; // already primary, can't also be stretch
    setStretchIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev; // cap at 2
      return [...prev, id];
    });
  };

  const canSave = !!primaryId;

  const handleSave = () => {
    if (!canSave) return;
    onSave({ primary: primaryId, stretch: stretchIds });
    onClose();
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Today's priority</div>
            <div style={styles.subtitle}>
              Pick one task that must get done today.{' '}
              <span style={styles.subtitleDim}>
                You can also pick up to 2 stretch goals.
              </span>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
          style={styles.search}
          autoFocus
        />

        <div style={styles.legend}>
          <span style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: '#534AB7' }} />
            Primary
          </span>
          <span style={styles.legendItem}>
            <span
              style={{
                ...styles.legendDot,
                background: 'transparent',
                border: '1.5px solid #534AB7',
              }}
            />
            Stretch ({stretchIds.length}/2)
          </span>
        </div>

        <div style={styles.list}>
          {candidates.length === 0 ? (
            <div style={styles.empty}>
              {search.trim()
                ? 'No tasks match your search.'
                : 'No open tasks for today. Add one in the Tasks tab first.'}
            </div>
          ) : (
            candidates.map((t) => {
              const isPrimary = primaryId === t.id;
              const isStretch = stretchIds.includes(t.id);
              const projColor = projectColor(t.project, projects);
              const overdue = t.dueDate && t.dueDate < todayStr();

              return (
                <div
                  key={t.id}
                  style={{
                    ...styles.row,
                    borderLeft: `3px solid ${projColor}`,
                    background: isPrimary
                      ? '#534AB711'
                      : isStretch
                      ? '#534AB708'
                      : '#fff',
                    borderColor: isPrimary
                      ? '#534AB7'
                      : 'var(--color-border-tertiary)',
                  }}
                >
                  <div style={styles.rowMain}>
                    <div
                      style={{
                        ...styles.rowTitle,
                        color: isPrimary
                          ? '#534AB7'
                          : 'var(--color-text-primary)',
                        fontWeight: isPrimary ? 600 : 400,
                      }}
                    >
                      {t.title || '(untitled)'}
                    </div>
                    <div style={styles.rowMeta}>
                      {t.project && (
                        <span style={{ color: projColor, fontWeight: 500 }}>
                          {t.project}
                        </span>
                      )}
                      {overdue && (
                        <span style={styles.overdueBadge}>overdue</span>
                      )}
                      {t.dueDate === todayStr() && (
                        <span style={styles.todayBadge}>due today</span>
                      )}
                    </div>
                  </div>
                  <div style={styles.rowActions}>
                    <button
                      onClick={() => togglePrimary(t.id)}
                      style={{
                        ...styles.actionBtn,
                        background: isPrimary ? '#534AB7' : 'transparent',
                        color: isPrimary ? '#fff' : '#534AB7',
                        borderColor: '#534AB7',
                      }}
                    >
                      {isPrimary ? '✓ Primary' : 'Primary'}
                    </button>
                    <button
                      onClick={() => toggleStretch(t.id)}
                      disabled={
                        isPrimary ||
                        (!isStretch && stretchIds.length >= 2)
                      }
                      style={{
                        ...styles.actionBtn,
                        background: isStretch ? '#534AB7' : 'transparent',
                        color: isStretch ? '#fff' : '#534AB7',
                        borderColor: '#534AB7',
                        opacity:
                          isPrimary ||
                          (!isStretch && stretchIds.length >= 2)
                            ? 0.3
                            : 1,
                        cursor:
                          isPrimary ||
                          (!isStretch && stretchIds.length >= 2)
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                    >
                      {isStretch ? '✓ Stretch' : 'Stretch'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              ...styles.saveBtn,
              opacity: canSave ? 1 : 0.4,
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
          >
            Set priority
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    overflow: 'auto',
    padding: '40px 20px 80px',
  },
  dialog: {
    background: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 580,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
    maxHeight: 'calc(100vh - 100px)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: { fontSize: 14, fontWeight: 600 },
  subtitle: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginTop: 4,
    lineHeight: 1.5,
  },
  subtitleDim: { color: 'var(--color-text-tertiary)' },
  closeBtn: {
    width: 28,
    height: 28,
    background: 'transparent',
    border: 'none',
    fontSize: 22,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  search: {
    padding: '6px 10px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 8,
    fontSize: 12,
    background: '#fff',
    outline: 'none',
  },
  legend: {
    display: 'flex',
    gap: 14,
    fontSize: 10,
    color: 'var(--color-text-secondary)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minHeight: 100,
    maxHeight: 400,
  },
  empty: {
    padding: 24,
    textAlign: 'center',
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    fontStyle: 'italic',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 10px',
    border: '0.5px solid',
    borderRadius: 8,
    gap: 10,
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 12 },
  rowMeta: {
    fontSize: 10,
    color: 'var(--color-text-secondary)',
    marginTop: 3,
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  overdueBadge: {
    background: '#e24b4a22',
    color: '#e24b4a',
    padding: '0 6px',
    borderRadius: 8,
    fontSize: 9,
    fontWeight: 600,
  },
  todayBadge: {
    background: '#534AB722',
    color: '#534AB7',
    padding: '0 6px',
    borderRadius: 8,
    fontSize: 9,
    fontWeight: 600,
  },
  rowActions: { display: 'flex', gap: 4, flexShrink: 0 },
  actionBtn: {
    padding: '4px 10px',
    border: '0.5px solid',
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 500,
    cursor: 'pointer',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 8,
    borderTop: '0.5px solid var(--color-border-tertiary)',
  },
  cancelBtn: {
    padding: '6px 14px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '6px 18px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
  },
};
