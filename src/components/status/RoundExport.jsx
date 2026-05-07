import { useMemo, useRef, useState } from 'react';

const RAG_LABELS = {
  green: '🟢 GREEN',
  amber: '🟡 AMBER',
  red: '🔴 RED',
  not_discussed: '⚪ Not discussed',
};

export default function RoundExport({ round, projects, workspaceName, onClose }) {
  const [msg, setMsg] = useState('');
  const textareaRef = useRef(null);

  // Build the plain text export
  const exportText = useMemo(() => {
    const lines = [];
    const dateStr = formatLongDate(round.date);
    lines.push(`Status update — ${workspaceName || 'Personal'}`);
    lines.push(dateStr);
    if (round.title) lines.push(round.title);
    lines.push('');

    if (round.notes && round.notes.trim()) {
      lines.push('Meeting notes');
      lines.push('—'.repeat(40));
      lines.push(round.notes.trim());
      lines.push('');
    }

    // Projects, ordered by RAG severity (red first, then amber, green, not discussed)
    const ragOrder = { red: 0, amber: 1, green: 2, not_discussed: 3 };
    const sorted = [...(round.projects || [])].sort(
      (a, b) => (ragOrder[a.rag] ?? 4) - (ragOrder[b.rag] ?? 4)
    );

    for (const entry of sorted) {
      const proj = projects.find((p) => p.id === entry.project_id);
      const projName = proj?.name || '(deleted project)';
      lines.push(`${RAG_LABELS[entry.rag] || ''}  ${projName}`);
      lines.push('—'.repeat(40));

      if (entry.update && entry.update.trim()) {
        lines.push(entry.update.trim());
      }

      const openActions = (entry.actions || []).filter((a) => !a.done);
      const doneActions = (entry.actions || []).filter((a) => a.done);

      if (openActions.length > 0) {
        lines.push('');
        lines.push('Actions:');
        for (const a of openActions) {
          if (a.text.trim()) lines.push(`  • ${a.text.trim()}`);
        }
      }

      if (doneActions.length > 0) {
        lines.push('');
        lines.push('Completed:');
        for (const a of doneActions) {
          if (a.text.trim()) lines.push(`  ✓ ${a.text.trim()}`);
        }
      }

      lines.push('');
      lines.push('');
    }

    return lines.join('\n');
  }, [round, projects, workspaceName]);

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setMsg('Copied! Paste into your email or document.');
      setTimeout(() => setMsg(''), 4000);
    } catch {
      textareaRef.current?.select();
      setMsg('Auto-copy failed. Click the box, Ctrl+A then Ctrl+C.');
      setTimeout(() => setMsg(''), 7000);
    }
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Export status round</div>
            <div style={styles.subtitle}>
              Plain text format. Copy and paste into email, Word, or anywhere else.
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <div style={styles.toolbar}>
          <button onClick={doCopy} style={styles.primaryBtn}>
            📋 Copy to clipboard
          </button>
          {msg && <span style={styles.msg}>{msg}</span>}
        </div>

        <textarea
          ref={textareaRef}
          value={exportText}
          readOnly
          onClick={(e) => e.target.select()}
          style={styles.textArea}
        />
      </div>
    </div>
  );
}

function formatLongDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: {
    background: 'var(--bg-surface)',
    borderRadius: 12,
    width: '100%',
    maxWidth: 720,
    maxHeight: '88vh',
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
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
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    background: 'transparent',
    border: 'none',
    fontSize: 22,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  primaryBtn: {
    padding: '7px 14px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  msg: {
    fontSize: 11,
    color: '#1d9e75',
    fontWeight: 500,
  },
  textArea: {
    flex: 1,
    minHeight: 360,
    padding: 12,
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 8,
    fontSize: 12,
    fontFamily: 'monospace',
    background: 'var(--color-background-secondary)',
    outline: 'none',
    resize: 'vertical',
    lineHeight: 1.5,
  },
};
