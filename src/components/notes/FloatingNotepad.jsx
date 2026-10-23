import { useEffect, useRef, useState } from 'react';
import Notepad from './Notepad.jsx';
import { addBusinessDays } from '../../lib/utils.js';
import { pulseSave } from '../../lib/savePulse.js';
import {
  parseDumpLines,
  projectMatch,
  removeDumpLines,
} from '../../lib/captureTriage.js';

const HEIGHT_KEY = 'daymark-notepad-h';
const MIN_NOTEPAD_H = 160;
// The float used to be content-sized: header, notepad chrome, a 2-row
// textarea, and the footer — about 190px. The default is ~1.5× that.
const LEGACY_NOTEPAD_H = 190;
const DEFAULT_NOTEPAD_H = Math.round(LEGACY_NOTEPAD_H * 1.5);

function notepadMaxHeight() {
  if (typeof window === 'undefined') return 480;
  return Math.round(window.innerHeight * 0.5);
}

function clampNotepadHeight(n) {
  const max = Math.max(1, notepadMaxHeight());
  const min = Math.min(MIN_NOTEPAD_H, max);
  const value = Number.isFinite(n) ? n : DEFAULT_NOTEPAD_H;
  return Math.round(Math.min(max, Math.max(min, value)));
}

function readNotepadHeight() {
  try {
    const raw = localStorage.getItem(HEIGHT_KEY);
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return clampNotepadHeight(n);
  } catch {
    /* private mode */
  }
  return clampNotepadHeight(DEFAULT_NOTEPAD_H);
}

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
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const gestureInsideRef = useRef(false);
  const [panelHeight, setPanelHeight] = useState(readNotepadHeight);
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
    pulseSave();
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
      const bits = [];
      if (nTask) bits.push(`${nTask} task${nTask === 1 ? '' : 's'}`);
      if (nWait) bits.push(`${nWait} waiting · expect-back set`);
      if (nProj) bits.push(`${nProj} → Projects`);
      showToast(
        `Converted all · ${consumed.length} item${consumed.length === 1 ? '' : 's'}`,
        bits.join(' · ')
      );
    } finally {
      setBusy(false);
    }
  };

  const openCount = rows.filter((r) => !r.done).length;

  // Esc and click-outside close the float. The draft stays in notepad storage;
  // this only hides the panel. Overlays stacked above the float keep Esc.
  // A gesture that starts inside (resize drag, text selection) does not close
  // when the pointer is released outside.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (fullscreenOverlayAbove(panelRef.current)) return;
      e.preventDefault();
      onCloseRef.current?.();
    };
    const onPointerDown = (e) => {
      const panel = panelRef.current;
      gestureInsideRef.current = !!(panel && panel.contains(e.target));
    };
    const onClick = (e) => {
      if (gestureInsideRef.current) return;
      const panel = panelRef.current;
      if (!panel || panel.contains(e.target)) return;
      if (eventHitsOverlayAbove(e.target, panel)) return;
      onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown, true);
    const timer = window.setTimeout(() => document.addEventListener('click', onClick), 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('click', onClick);
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const onResize = () => setPanelHeight(readNotepadHeight());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onResizePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    gestureInsideRef.current = true;
    const startY = e.clientY;
    const startH = panelHeight;
    const move = (ev) => {
      // Pinned to the bottom-right corner, so the only room to grow is up.
      const next = clampNotepadHeight(startH + (startY - ev.clientY));
      setPanelHeight(next);
      try {
        localStorage.setItem(HEIGHT_KEY, String(next));
      } catch {
        /* private mode */
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return (
    <aside
      ref={panelRef}
      style={{
        ...styles.panel,
        height: panelHeight,
        minHeight: `min(${MIN_NOTEPAD_H}px, 50vh)`,
        maxHeight: '50vh',
      }}
      aria-label="Floating notepad with Capture Triage toggle"
    >
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
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Drag to resize notepad"
        title="Drag to resize"
        style={styles.resize}
        onPointerDown={onResizePointerDown}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3 9h8M5 11h6M7 7h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
    </aside>
  );
}

const FLOAT_Z = 860;

// Full-screen layers above the float (focus, capture dialog, help) own Esc
// and outside clicks. The float itself is not full-screen.
function isFullscreenAbove(el, panel) {
  if (!el || (panel && panel.contains(el))) return false;
  const cs = window.getComputedStyle(el);
  if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return false;
  const z = parseInt(cs.zIndex, 10);
  if (!Number.isFinite(z) || z <= FLOAT_Z) return false;
  const r = el.getBoundingClientRect();
  return r.width >= window.innerWidth * 0.85 && r.height >= window.innerHeight * 0.85;
}

function fullscreenOverlayAbove(panel) {
  const nodes = document.body.querySelectorAll('*');
  for (const el of nodes) {
    if (isFullscreenAbove(el, panel)) return true;
  }
  return false;
}

function eventHitsOverlayAbove(target, panel) {
  let el = target;
  while (el && el !== document.documentElement) {
    if (isFullscreenAbove(el, panel)) return true;
    el = el.parentElement;
  }
  return false;
}

const styles = {
  panel: {
    position: 'fixed',
    right: 20,
    bottom: 20,
    width: 420,
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: '50vh',
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
    padding: '10px 48px 16px 12px',
    borderTop: '0.5px solid var(--color-border-tertiary)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  resize: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 32,
    height: 32,
    cursor: 'ns-resize',
    touchAction: 'none',
    zIndex: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent)',
    background: 'var(--accent-soft)',
    border: '0.5px solid var(--accent)',
    borderRadius: 8,
    boxShadow: '0 1px 4px rgba(17,24,39,0.12)',
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
