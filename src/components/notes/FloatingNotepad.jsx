import { useRef, useState } from 'react';
import Notepad from './Notepad.jsx';
import { addBusinessDays } from '../../lib/utils.js';
import {
  parseDumpLines,
  projectMatch,
  removeDumpLines,
} from '../../lib/captureTriage.js';

// ── FloatingNotepad ─────────────────────────────────────────────────────────
// Fixed overlay (not a docked column). It used to default closed and live
// inside an overflow:hidden flex row, so on the live desk it collapsed to
// "just a nav button". Capture | Triage sits on this float.
//
// Capture is the same persisted notepad. Triage parses the dump into rows
// (kind + project tag + expect-back) and Convert all writes through the
// existing task / project APIs.

export default function FloatingNotepad({
  projects,
  tasks,
  workspaceId,
  contextProjectId,
  onAddTask,
  onAddProject,
  onAddNote,
  onClose,
}) {
  const notepadRef = useRef(null);
  const [mode, setMode] = useState('capture'); // capture | triage
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [converted, setConverted] = useState(false);
  const [toast, setToast] = useState(null);

  const contextProject = (projects || []).find((p) => p.id === contextProjectId) || null;

  const enterTriage = () => {
    const text = notepadRef.current?.getBody() || '';
    const parsed = parseDumpLines(text);
    setRows((prev) =>
      parsed.map((p) => {
        const old = prev.find((r) => r.title === p.title && !r.done);
        if (old) return { ...old };
        const matched = projectMatch(p.title, projects);
        const projectId = matched?.id || contextProjectId || '';
        return {
          title: p.title,
          kind: p.kind,
          projectId,
          date: p.kind === 'waiting' ? addBusinessDays(3) : '',
          done: false,
        };
      })
    );
    setConverted(false);
    setMode('triage');
  };

  const setKind = (index, kind) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const date = kind === 'waiting' && !r.date ? addBusinessDays(3) : r.date;
        return { ...r, kind, date };
      })
    );
    setConverted(false);
  };

  const patchRow = (index, patch) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    setConverted(false);
  };

  const showToast = (main, sub) => {
    setToast({ main, sub });
    setTimeout(() => setToast(null), 4200);
  };

  const convertAll = async () => {
    if (busy || converted || rows.length === 0) return;
    setBusy(true);
    let nTask = 0;
    let nWait = 0;
    let nProj = 0;
    const consumed = [];
    try {
      for (const row of rows) {
        const title = row.title.trim();
        if (!title) continue;
        const proj = (projects || []).find((p) => p.id === row.projectId) || null;
        if (row.kind === 'project') {
          await onAddProject({
            name: title.length <= 120 ? title : title.slice(0, 120),
            nextSteps: title.length > 120 ? title : '',
          });
          nProj++;
        } else if (row.kind === 'waiting') {
          const expectBack = row.date || addBusinessDays(3);
          await onAddTask({
            title,
            project: proj?.name || '',
            projectId: proj?.id || '',
            priority: 'Medium',
            dueDate: expectBack,
            isFollowUp: true,
            isWaiting: true,
            sourceNote: 'capture-triage',
          });
          nWait++;
        } else {
          await onAddTask({
            title,
            project: proj?.name || '',
            projectId: proj?.id || '',
            priority: 'Medium',
            dueDate: row.date || '',
            sourceNote: 'capture-triage',
          });
          nTask++;
        }
        consumed.push(title);
      }
      const body = notepadRef.current?.getBody() || '';
      notepadRef.current?.setBody(removeDumpLines(body, consumed));
      setRows((prev) => prev.map((r) => ({ ...r, done: true })));
      setConverted(true);
      const waitBit = nWait ? `${nWait} waiting · expect-back set` : '0 waiting';
      showToast(
        `Converted all · ${consumed.length} item${consumed.length === 1 ? '' : 's'}`,
        `${nTask} → Today · Do · ${waitBit} · ${nProj} → Projects`
      );
    } finally {
      setBusy(false);
    }
  };

  const openCount = rows.filter((r) => !r.done).length;

  return (
    <aside style={styles.panel} aria-label="Floating notepad with Capture Triage toggle">
      <div style={styles.header}>
        <span style={styles.dot} aria-hidden="true" />
        <span style={styles.title}>Floating notepad</span>
        <div style={styles.modeToggle} role="tablist" aria-label="Capture or Triage">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'capture'}
            onClick={() => setMode('capture')}
            style={{ ...styles.modeBtn, ...(mode === 'capture' ? styles.modeBtnOn : {}) }}
          >
            Capture
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'triage'}
            onClick={enterTriage}
            style={{ ...styles.modeBtn, ...(mode === 'triage' ? styles.modeBtnOn : {}) }}
          >
            Triage
          </button>
        </div>
        <button type="button" onClick={onClose} style={styles.close} title="Close notepad">
          ×
        </button>
      </div>

      <div style={styles.body}>
        <div style={{ ...styles.captureHold, display: mode === 'capture' ? 'flex' : 'none' }}>
          {contextProject && (
            <div style={styles.prefill}>
              In <strong>{contextProject.name}</strong> — triage tags new rows with this project unless a line names another.
            </div>
          )}
          <Notepad
            ref={notepadRef}
            embedded
            projects={projects}
            tasks={tasks}
            workspaceId={workspaceId}
            onAddTask={onAddTask}
            onAddProject={onAddProject}
            onAddNote={onAddNote}
          />
        </div>

        {mode === 'triage' && (
          <div style={styles.triage}>
            {rows.length === 0 ? (
              <div style={styles.empty}>
                Nothing to triage. Switch back to Capture and dump one line per item.
              </div>
            ) : (
              rows.map((row, index) => (
                <div
                  key={row.title}
                  style={{ ...styles.row, ...(row.done ? styles.rowDone : {}) }}
                >
                  <div style={styles.bullet}>• {row.title}</div>
                  <div style={styles.mini}>
                    <div style={styles.kindSeg} role="group" aria-label={`Kind for ${row.title}`}>
                      {[
                        ['task', 'Task'],
                        ['waiting', 'Waiting'],
                        ['project', 'Project'],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setKind(index, key)}
                          style={{
                            ...styles.kindBtn,
                            ...(row.kind === key ? styles.kindBtnOn : {}),
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <label style={styles.fieldLabel}>
                      Project
                      <select
                        aria-label={`Project for ${row.title}`}
                        value={row.projectId}
                        onChange={(e) => patchRow(index, { projectId: e.target.value })}
                        style={styles.select}
                      >
                        <option value="">— optional —</option>
                        {(projects || []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={styles.fieldLabel}>
                      <span style={row.kind === 'waiting' ? styles.expectLbl : undefined}>
                        {row.kind === 'waiting' ? 'expect-back' : 'Date'}
                      </span>
                      <input
                        type="date"
                        aria-label={row.kind === 'waiting' ? 'expect-back' : 'Date'}
                        value={row.date}
                        onChange={(e) => patchRow(index, { date: e.target.value })}
                        style={styles.date}
                      />
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div style={styles.footer}>
        <span style={styles.count}>
          {mode === 'capture'
            ? 'Capture mode · free dump'
            : converted
            ? 'Batch converted'
            : `Triage · ${openCount} line${openCount === 1 ? '' : 's'} · project / date · Waiting → expect-back`}
        </span>
        <button
          type="button"
          onClick={convertAll}
          disabled={mode !== 'triage' || converted || busy || openCount === 0}
          style={{
            ...styles.convert,
            opacity: mode === 'triage' && !converted && !busy && openCount > 0 ? 1 : 0.45,
          }}
        >
          {busy ? 'Converting…' : 'Convert all'}
        </button>
      </div>

      {toast && (
        <div style={styles.toast} role="status">
          <div>{toast.main}</div>
          {toast.sub && <div style={styles.toastSub}>{toast.sub}</div>}
        </div>
      )}
    </aside>
  );
}

const styles = {
  panel: {
    position: 'fixed',
    right: 20,
    bottom: 20,
    width: 420,
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: 'min(580px, calc(100vh - 72px))',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 12,
    boxShadow: '0 12px 40px rgba(17,24,39,.18), 0 2px 8px rgba(17,24,39,.06)',
    zIndex: 860,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    flexShrink: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--accent)',
    flexShrink: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: 650,
    flex: 1,
    color: 'var(--color-text-primary)',
  },
  modeToggle: {
    display: 'inline-flex',
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  modeBtn: {
    border: '0.5px solid transparent',
    background: 'transparent',
    padding: '4px 10px',
    borderRadius: 6,
    fontSize: 11.5,
    fontWeight: 650,
    color: 'var(--color-text-tertiary)',
    cursor: 'pointer',
  },
  modeBtnOn: {
    background: 'var(--bg-surface)',
    color: 'var(--accent)',
    border: '0.5px solid var(--accent-soft-border)',
  },
  close: {
    width: 24,
    height: 24,
    background: 'transparent',
    border: 'none',
    fontSize: 18,
    color: 'var(--color-text-tertiary)',
    cursor: 'pointer',
  },
  body: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  captureHold: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
  },
  prefill: {
    margin: '8px 12px 0',
    padding: '6px 10px',
    fontSize: 11.5,
    color: 'var(--accent)',
    background: 'var(--accent-soft)',
    border: '0.5px solid var(--accent-soft-border)',
    borderRadius: 6,
  },
  triage: {
    flex: 1,
    overflow: 'auto',
  },
  empty: {
    padding: 16,
    fontSize: 12.5,
    color: 'var(--color-text-secondary)',
  },
  row: {
    padding: '10px 12px',
    borderTop: '0.5px solid var(--color-border-tertiary)',
  },
  rowDone: { opacity: 0.45 },
  bullet: {
    fontSize: 13,
    fontWeight: 550,
    marginBottom: 6,
    color: 'var(--color-text-primary)',
  },
  mini: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  kindSeg: {
    display: 'inline-flex',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  kindBtn: {
    border: 'none',
    borderRight: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 0,
    padding: '4px 8px',
    fontSize: 11,
    fontWeight: 650,
    background: 'var(--bg-surface)',
    color: 'var(--color-text-tertiary)',
    cursor: 'pointer',
  },
  kindBtnOn: {
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
  },
  fieldLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: 'var(--color-text-tertiary)',
  },
  expectLbl: { color: '#d97706' },
  select: {
    font: 'inherit',
    fontSize: 12,
    fontWeight: 500,
    textTransform: 'none',
    letterSpacing: 0,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    padding: '4px 8px',
    background: 'var(--color-background-secondary)',
    color: 'var(--color-text-primary)',
  },
  date: {
    font: 'inherit',
    fontSize: 12,
    fontWeight: 500,
    textTransform: 'none',
    letterSpacing: 0,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    padding: '4px 8px',
    background: 'var(--color-background-secondary)',
    color: 'var(--color-text-primary)',
  },
  footer: {
    padding: '10px 12px',
    borderTop: '0.5px solid var(--color-border-tertiary)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  count: {
    fontSize: 11.5,
    color: 'var(--color-text-tertiary)',
    flex: 1,
  },
  convert: {
    padding: '6px 12px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 650,
    cursor: 'pointer',
  },
  toast: {
    position: 'fixed',
    top: 64,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 2000,
    background: '#111827',
    color: '#f9fafb',
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 13,
    boxShadow: '0 8px 24px rgba(0,0,0,.18)',
    maxWidth: 440,
  },
  toastSub: {
    display: 'block',
    fontSize: 11.5,
    color: '#c4b5fd',
    marginTop: 2,
    fontWeight: 500,
  },
};
