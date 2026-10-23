import { useState, useRef, useEffect } from 'react';

export default function GoalsFloatingButton({
  goals,
  onAddEvidence,
  onOpenManager,
}) {
  const [open, setOpen] = useState(false);
  const [pickedGoalId, setPickedGoalId] = useState(null);
  const [draft, setDraft] = useState('');
  const [flash, setFlash] = useState('');
  const [padOpen, setPadOpen] = useState(
    () => typeof window !== 'undefined' && !!window.__daymarkNotepadOpen
  );
  const popoverRef = useRef(null);

  // The floating notepad occupies the bottom-right. Shift this button left
  // so it does not sit under the float.
  useEffect(() => {
    const onVis = (e) => setPadOpen(!!e.detail?.open);
    window.addEventListener('daymark-notepad-visibility', onVis);
    return () => window.removeEventListener('daymark-notepad-visibility', onVis);
  }, []);

  const activeGoals = (goals || []).filter((g) => !g.archived);

  // Default to first goal when popover opens.
  // Note: hooks must run unconditionally (before any early returns), so we
  // guard with the activeGoals check inside the effect body.
  useEffect(() => {
    if (open && !pickedGoalId && activeGoals.length > 0) {
      setPickedGoalId(activeGoals[0].id);
    }
  }, [open, pickedGoalId, activeGoals]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [open]);

  // Don't render anything if there are no active goals
  if (activeGoals.length === 0) return null;

  const submit = async () => {
    if (!draft.trim() || !pickedGoalId) return;
    await onAddEvidence(pickedGoalId, draft);
    setDraft('');
    setFlash('Logged ✓');
    setTimeout(() => setFlash(''), 1800);
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          ...styles.fab,
          ...(padOpen ? { left: 20, right: 'auto' } : {}),
        }}
        title="Log evidence against a goal"
      >
        🎯
      </button>

      {open && (
        <div
          ref={popoverRef}
          style={{
            ...styles.popover,
            ...(padOpen ? { left: 20, right: 'auto' } : {}),
          }}
        >
          <div style={styles.header}>
            <span style={styles.title}>Log evidence</span>
            <button
              onClick={() => {
                setOpen(false);
                onOpenManager();
              }}
              style={styles.manageBtn}
              title="Manage goals"
            >
              Manage
            </button>
          </div>

          <select
            value={pickedGoalId || ''}
            onChange={(e) => setPickedGoalId(e.target.value)}
            style={styles.select}
          >
            {activeGoals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                submit();
              }
            }}
            placeholder="What did you do that supports this goal?"
            rows={3}
            style={styles.textarea}
            autoFocus
          />

          <div style={styles.btnRow}>
            <span style={styles.flash}>{flash}</span>
            <button
              onClick={submit}
              disabled={!draft.trim()}
              style={{
                ...styles.submitBtn,
                opacity: draft.trim() ? 1 : 0.4,
                cursor: draft.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Log
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  fab: {
    position: 'fixed',
    bottom: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    fontSize: 20,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(83,74,183,0.35)',
    zIndex: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popover: {
    position: 'fixed',
    bottom: 80,
    right: 20,
    width: 320,
    background: 'var(--bg-surface)',
    borderRadius: 12,
    padding: 14,
    boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
    border: '0.5px solid var(--color-border-tertiary)',
    zIndex: 901,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--accent)',
  },
  manageBtn: {
    padding: '2px 8px',
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-secondary)',
    fontSize: 11,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  select: {
    padding: '5px 8px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 12,
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  textarea: {
    padding: '6px 10px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 12,
    background: 'var(--bg-surface)',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.5,
  },
  btnRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  flash: {
    fontSize: 11,
    color: '#1d9e75',
    fontWeight: 500,
  },
  submitBtn: {
    padding: '5px 14px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
  },
};
