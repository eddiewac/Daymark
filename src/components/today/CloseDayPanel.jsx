import { useMemo } from 'react';
import { projectColor } from '../../lib/constants.js';
import { collectDeliverableWaiting } from '../../lib/deliverableStatus.js';
import { localDateStr, todayStr } from '../../lib/utils.js';

// ── Close-out-day panel ─────────────────────────────────────────────────────
//
// A click-to-open end-of-day moment. Prep-first: it leads with tomorrow's
// shape and what carries over (the actionable half), then shows a recap of
// today (the satisfying half). Assembles live from existing data — stores
// nothing new.
//
// Props:
//   tasks, projects        — current data
//   todayPriority          — today's focus (from usePriority); may be null
//   onRollForward(taskId)  — move a task's due date to tomorrow
//   onJumpToProject(id)    — navigate to a project
//   onClose()              — dismiss the panel

function fmtShort(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function CloseDayPanel({
  tasks,
  projects,
  todayPriority,
  onRollForward,
  onJumpToProject,
  onClose,
}) {
  const today = todayStr();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = localDateStr(tomorrowDate);

  // ── PREP (forward-looking) ──────────────────────────────────────────────
  // Unfinished tasks that were due today or earlier — the carry-over.
  const carryOver = useMemo(
    () =>
      (tasks || [])
        .filter((t) => !t.done && t.dueDate && t.dueDate <= today)
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')),
    [tasks, today]
  );

  // Already scheduled for tomorrow.
  const dueTomorrow = useMemo(
    () => (tasks || []).filter((t) => !t.done && t.dueDate === tomorrow),
    [tasks, tomorrow]
  );

  // Things expected back from people tomorrow (deliverable-level waiting).
  const delivBackTomorrow = useMemo(() => {
    const { dueToday } = collectDeliverableWaiting(projects, tomorrow);
    return dueToday; // items whose waiting date === tomorrow
  }, [projects, tomorrow]);

  // Comms awaiting reply expected back tomorrow (derived from stations).
  const commsBackTomorrow = useMemo(() => {
    const out = [];
    for (const p of projects || []) {
      for (const d of p.deliverables || []) {
        for (const st of d.stations || []) {
          for (const c of st.comms || []) {
            if (c.needsReply && !c.replyReceived && c.expectReplyBy === tomorrow) {
              out.push({ project: p, deliverable: d, station: st, comm: c });
            }
          }
        }
      }
    }
    return out;
  }, [projects, tomorrow]);

  // ── RECAP (backward-looking) ────────────────────────────────────────────
  // Tasks completed today (done with a doneAt timestamp dated today).
  const completedToday = useMemo(
    () =>
      (tasks || []).filter((t) => {
        if (!t.done || !t.doneAt) return false;
        return localDateStr(t.doneAt) === today;
      }),
    [tasks, today]
  );

  // Did today's focus get done? The priority's primary item references a task.
  const focusTask = useMemo(() => {
    const prim = todayPriority?.primary;
    if (!prim) return null;
    // primary may be a task id, or an object with a taskId/id, or free text.
    const id = typeof prim === 'string' ? prim : prim.taskId || prim.id;
    if (!id) return null;
    return (tasks || []).find((t) => t.id === id) || null;
  }, [todayPriority, tasks]);
  const focusDone = focusTask ? focusTask.done : null;

  // The focus may be free text (not a linked task) — capture its label too.
  const focusLabel = useMemo(() => {
    const prim = todayPriority?.primary;
    if (!prim) return null;
    if (typeof prim === 'string') return prim;
    return prim.title || prim.text || null;
  }, [todayPriority]);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Close out the day</div>
            <div style={styles.sub}>{fmtShort(today)} · here's tomorrow, then today</div>
          </div>
          <button onClick={onClose} style={styles.close} title="Close">
            ×
          </button>
        </div>

        <div style={styles.body}>
          {/* ── PREP FIRST ─────────────────────────────────────────────── */}
          <div style={styles.sectionLabel}>Set up tomorrow</div>

          {/* Carry-over: unfinished, due today or earlier */}
          {carryOver.length > 0 ? (
            <div style={styles.block}>
              <div style={styles.blockHead}>
                {carryOver.length} unfinished — roll to tomorrow?
              </div>
              {carryOver.map((t) => (
                <div key={t.id} style={styles.row}>
                  <span style={styles.rowTitle}>
                    {t.title || '(untitled)'}
                    {t.project && (
                      <span style={{ ...styles.proj, color: projectColor(t.project, projects) }}>
                        {' '}· {t.project}
                      </span>
                    )}
                  </span>
                  <button
                    style={styles.rollBtn}
                    onClick={() => onRollForward(t.id)}
                    title="Move to tomorrow"
                  >
                    → tomorrow
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.cleanLine}>Nothing left unfinished from today ✓</div>
          )}

          {/* Already on tomorrow */}
          {dueTomorrow.length > 0 && (
            <div style={styles.block}>
              <div style={styles.blockHead}>{dueTomorrow.length} already due tomorrow</div>
              {dueTomorrow.slice(0, 6).map((t) => (
                <div key={t.id} style={styles.rowQuiet}>
                  <span style={styles.rowTitle}>{t.title || '(untitled)'}</span>
                </div>
              ))}
              {dueTomorrow.length > 6 && (
                <div style={styles.more}>+ {dueTomorrow.length - 6} more</div>
              )}
            </div>
          )}

          {/* Expected back tomorrow (deliverables + comms) */}
          {(delivBackTomorrow.length > 0 || commsBackTomorrow.length > 0) && (
            <div style={styles.block}>
              <div style={styles.blockHead}>Expected back tomorrow</div>
              {delivBackTomorrow.map((item, i) => (
                <button
                  key={`d-${i}`}
                  style={styles.rowLink}
                  onClick={() => onJumpToProject(item.project.id)}
                >
                  <span style={styles.rowTitle}>
                    {item.deliverable.name}
                    <span style={styles.proj}> · {item.project.name}</span>
                  </span>
                  <span style={styles.meta}>with {item.name}</span>
                </button>
              ))}
              {commsBackTomorrow.map((item, i) => (
                <button
                  key={`c-${i}`}
                  style={styles.rowLink}
                  onClick={() => onJumpToProject(item.project.id)}
                >
                  <span style={styles.rowTitle}>
                    {item.deliverable.name}
                    <span style={styles.proj}> · {item.project.name}</span>
                  </span>
                  <span style={styles.meta}>{item.comm.type || 'awaiting reply'}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── THEN RECAP ─────────────────────────────────────────────── */}
          <div style={{ ...styles.sectionLabel, marginTop: 18 }}>How today went</div>

          <div style={styles.recapStat}>
            <span style={styles.recapNum}>{completedToday.length}</span>
            <span style={styles.recapLabel}>
              task{completedToday.length === 1 ? '' : 's'} completed today
            </span>
          </div>

          {(focusTask || focusLabel) && (
            <div
              style={{
                ...styles.focusLine,
                ...(focusTask
                  ? focusDone
                    ? styles.focusDone
                    : styles.focusUndone
                  : styles.focusNeutral),
              }}
            >
              {focusTask ? (focusDone ? '🎯 ✓ ' : '🎯 ') : '🎯 '}
              Focus: {focusTask ? focusTask.title || '(untitled)' : focusLabel}
              {focusTask ? (focusDone ? ' — done' : ' — not done today') : ''}
            </div>
          )}

          {completedToday.length > 0 && (
            <div style={styles.block}>
              {completedToday.slice(0, 8).map((t) => (
                <div key={t.id} style={styles.rowQuiet}>
                  <span style={styles.doneCheck}>✓</span>
                  <span style={styles.rowTitleDone}>{t.title || '(untitled)'}</span>
                </div>
              ))}
              {completedToday.length > 8 && (
                <div style={styles.more}>+ {completedToday.length - 8} more</div>
              )}
            </div>
          )}

          {completedToday.length === 0 && (
            <div style={styles.cleanLine}>
              No tasks ticked off in Daymark today — that's fine, not every day's work lives here.
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button style={styles.doneBtn} onClick={onClose}>
            Done for the day
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.32)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '6vh',
    zIndex: 1000,
  },
  panel: {
    width: 'min(540px, 92vw)',
    maxHeight: '84vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-surface, #fff)',
    borderRadius: 14,
    boxShadow: '0 12px 48px rgba(0,0,0,0.22)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '18px 20px 12px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  title: { fontSize: 17, fontWeight: 600, color: 'var(--color-text-primary)' },
  sub: { fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 },
  close: {
    fontSize: 22,
    lineHeight: 1,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-tertiary)',
    cursor: 'pointer',
    padding: 0,
  },
  body: { padding: '14px 20px', overflowY: 'auto', flex: 1 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--accent)',
    marginBottom: 8,
  },
  block: { marginBottom: 14 },
  blockHead: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    marginBottom: 6,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '5px 0',
  },
  rowQuiet: { display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' },
  rowLink: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 1,
    width: '100%',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    padding: '5px 0',
    cursor: 'pointer',
  },
  rowTitle: { fontSize: 13, color: 'var(--color-text-primary)', flex: 1, minWidth: 0 },
  rowTitleDone: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    textDecoration: 'line-through',
  },
  proj: { fontWeight: 400, color: 'var(--color-text-tertiary)' },
  meta: { fontSize: 11, color: 'var(--color-text-secondary)' },
  rollBtn: {
    fontSize: 11,
    fontWeight: 500,
    padding: '3px 10px',
    borderRadius: 14,
    border: '0.5px solid var(--accent)',
    background: 'transparent',
    color: 'var(--accent)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  cleanLine: {
    fontSize: 12,
    color: 'var(--color-text-tertiary)',
    padding: '4px 0 12px',
  },
  recapStat: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  recapNum: { fontSize: 28, fontWeight: 700, color: 'var(--color-text-primary)' },
  recapLabel: { fontSize: 13, color: 'var(--color-text-secondary)' },
  focusLine: {
    fontSize: 12,
    padding: '6px 10px',
    borderRadius: 8,
    marginBottom: 12,
  },
  focusDone: { background: '#1d9e7515', color: '#147a59' },
  focusUndone: { background: '#ef9f2715', color: '#9a6500' },
  focusNeutral: { background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' },
  doneCheck: { color: '#1d9e75', fontSize: 12, flexShrink: 0 },
  more: { fontSize: 10, color: 'var(--color-text-tertiary)', paddingTop: 3 },
  footer: {
    padding: '12px 20px',
    borderTop: '0.5px solid var(--color-border-tertiary)',
  },
  doneBtn: {
    width: '100%',
    padding: '10px',
    borderRadius: 10,
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
