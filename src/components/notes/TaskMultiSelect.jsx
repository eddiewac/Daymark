import { useState, useRef, useEffect } from 'react';

export default function TaskMultiSelect({
  tasks = [],
  taskIds = [],
  preferredProject = null,
  onChange,
  placeholder = '+ Tag a task',
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Sort + filter tasks
  // Priority: preferred-project tasks first, then active before done, then by title
  const sorted = [...tasks].sort((a, b) => {
    const aPref = preferredProject && a.project === preferredProject ? 1 : 0;
    const bPref = preferredProject && b.project === preferredProject ? 1 : 0;
    if (aPref !== bPref) return bPref - aPref;
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    return (a.title || '').localeCompare(b.title || '');
  });

  const filtered = search.trim()
    ? sorted.filter((t) =>
        (t.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.project || '').toLowerCase().includes(search.toLowerCase())
      )
    : sorted;

  const taggedTasks = tasks.filter((t) => taskIds.includes(t.id));

  const toggle = (id) => {
    const next = taskIds.includes(id)
      ? taskIds.filter((x) => x !== id)
      : [...taskIds, id];
    onChange(next);
  };

  const removeTag = (id) => {
    onChange(taskIds.filter((x) => x !== id));
  };

  return (
    <div ref={wrapRef} style={styles.wrap}>
      <div style={styles.tagRow}>
        {taggedTasks.map((t) => (
          <span key={t.id} style={styles.tag} title={t.title}>
            {t.done && '✓ '}
            {t.title.length > 30 ? t.title.slice(0, 30) + '…' : t.title}
            <button
              onClick={() => removeTag(t.id)}
              style={styles.tagRemove}
              type="button"
            >
              ×
            </button>
          </span>
        ))}
        <button
          onClick={() => setOpen((v) => !v)}
          style={styles.addBtn}
          type="button"
        >
          {placeholder}
        </button>
      </div>

      {open && (
        <div style={styles.dropdown}>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            style={styles.searchInput}
          />
          <div style={styles.list}>
            {filtered.length === 0 ? (
              <div style={styles.emptyHint}>
                {tasks.length === 0
                  ? 'No tasks available.'
                  : 'No tasks match.'}
              </div>
            ) : (
              filtered.slice(0, 50).map((t) => {
                const tagged = taskIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggle(t.id)}
                    style={{
                      ...styles.option,
                      ...(tagged ? styles.optionSelected : {}),
                    }}
                    type="button"
                  >
                    <span style={styles.checkBox}>{tagged ? '✓' : ''}</span>
                    <span style={styles.optTitle}>
                      {t.done && (
                        <span style={{ color: 'var(--color-text-tertiary)' }}>
                          ✓{' '}
                        </span>
                      )}
                      {t.title || '(untitled)'}
                    </span>
                    {t.project && (
                      <span style={styles.optProj}>{t.project}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { position: 'relative' },
  tagRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    padding: '2px 4px 2px 8px',
    background: '#1d9e7522',
    color: '#1d9e75',
    borderRadius: 12,
    fontWeight: 500,
  },
  tagRemove: {
    background: 'transparent',
    border: 'none',
    color: '#1d9e75',
    fontSize: 13,
    width: 16,
    height: 16,
    padding: 0,
    cursor: 'pointer',
    lineHeight: 1,
  },
  addBtn: {
    fontSize: 11,
    padding: '3px 8px',
    background: 'transparent',
    border: '0.5px dashed var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 12,
    cursor: 'pointer',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    background: '#fff',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    zIndex: 100,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 280,
  },
  searchInput: {
    padding: '6px 10px',
    border: 'none',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    fontSize: 12,
    outline: 'none',
  },
  list: { overflowY: 'auto', flex: 1 },
  emptyHint: {
    padding: 16,
    textAlign: 'center',
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
  },
  option: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: 12,
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  optionSelected: { background: '#534AB708' },
  checkBox: {
    width: 14,
    height: 14,
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 3,
    fontSize: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#534AB7',
    flexShrink: 0,
  },
  optTitle: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  optProj: {
    fontSize: 10,
    color: 'var(--color-text-secondary)',
    flexShrink: 0,
  },
};
