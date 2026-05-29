import { useState, useMemo } from 'react';
import { useResourceData } from '../../hooks/useResourceData.js';
import { localDateStr } from '../../lib/utils.js';
import SharingPanel from './SharingPanel.jsx';

// ── ResourceView ────────────────────────────────────────────────────────────
//
// Stage 1: shows the current user's own load — task hours assigned to them,
// summed per day, across every workspace they participate in. Sharing,
// other people's rows, and per-person capacity arrive in later stages.

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Monday-of-week, normalised to midnight local
function mondayOf(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + offset);
  return x;
}

function weekDays(monday) {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    out.push(d);
  }
  return out;
}

function fmtRange(monday) {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts = { day: 'numeric', month: 'short' };
  return `${monday.toLocaleDateString(undefined, opts)} – ${sunday.toLocaleDateString(undefined, opts)}`;
}

export default function ResourceView({ dailyHours = 7.5, myName }) {
  const { entries, sharedTasks, sharers, loading, error, refresh } = useResourceData();
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [openDayKey, setOpenDayKey] = useState(null);
  const [showSharing, setShowSharing] = useState(false);
  // Which shared person's day is expanded: "sharerId|dayKey" or null
  const [openSharedCell, setOpenSharedCell] = useState(null);

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const dayKeys = useMemo(() => days.map((d) => localDateStr(d)), [days]);

  // For each day of the week, sum estimate hours and collect the tasks
  const dayData = useMemo(() => {
    return dayKeys.map((key) => {
      const dayEntries = entries.filter(
        (e) => !e.task.done && e.task.dueDate === key
      );
      const totalHours = dayEntries.reduce((sum, e) => {
        const h = Number(e.task.estimate);
        return sum + (Number.isFinite(h) ? h : 0);
      }, 0);
      const tasksWithoutEstimate = dayEntries.filter(
        (e) => !Number.isFinite(Number(e.task.estimate))
      ).length;
      return { key, entries: dayEntries, totalHours, tasksWithoutEstimate };
    });
  }, [entries, dayKeys]);

  const weekTotal = useMemo(
    () => dayData.reduce((sum, d) => sum + d.totalHours, 0),
    [dayData]
  );

  // One row per person sharing with me. Each row computes the same per-day
  // shape as my own row, but from that sharer's shared tasks.
  const sharedRows = useMemo(() => {
    return (sharers || []).map((share) => {
      const mine = (sharedTasks || []).filter(
        (t) => t.sharerId === share.sharer_id && !t.done
      );
      const perDay = dayKeys.map((key) => {
        const dayTasks = mine.filter((t) => t.dueDate === key);
        const totalHours = dayTasks.reduce((sum, t) => {
          const h = Number(t.estimate);
          return sum + (Number.isFinite(h) ? h : 0);
        }, 0);
        return { key, tasks: dayTasks, totalHours };
      });
      const weekTotal = perDay.reduce((s, d) => s + d.totalHours, 0);
      return {
        sharerId: share.sharer_id,
        name:
          (share.sharer_name && share.sharer_name.trim()) ||
          (share.sharer_email ? share.sharer_email.split('@')[0] : 'Shared'),
        perDay,
        weekTotal,
      };
    });
  }, [sharers, sharedTasks, dayKeys]);

  const goPrev = () => {
    const m = new Date(weekStart);
    m.setDate(m.getDate() - 7);
    setWeekStart(m);
    setOpenDayKey(null);
  };
  const goNext = () => {
    const m = new Date(weekStart);
    m.setDate(m.getDate() + 7);
    setWeekStart(m);
    setOpenDayKey(null);
  };
  const goThis = () => {
    setWeekStart(mondayOf(new Date()));
    setOpenDayKey(null);
  };

  const round1 = (n) => Math.round(n * 10) / 10;

  if (loading) {
    return (
      <div style={styles.wrap}>
        <div style={styles.empty}>
          Loading your load across all workspaces…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.wrap}>
        <div style={styles.empty}>
          Couldn't load resource data. <button onClick={refresh}>Try again</button>
        </div>
      </div>
    );
  }

  const openDay = openDayKey ? dayData.find((d) => d.key === openDayKey) : null;

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Resource</div>
          <div style={styles.subtitle}>
            Your assigned work, across every workspace.{' '}
            <span style={styles.dailyHint}>
              Capacity: {round1(dailyHours)}h/day · change in Settings
            </span>
          </div>
        </div>
        <div style={styles.weekNav}>
          <button onClick={goPrev} style={styles.navBtn}>‹</button>
          <button onClick={goThis} style={styles.navBtn}>This week</button>
          <button onClick={goNext} style={styles.navBtn}>›</button>
          <button onClick={refresh} style={styles.navBtn} title="Refresh">↻</button>
          <button
            onClick={() => setShowSharing((v) => !v)}
            style={{
              ...styles.navBtn,
              ...(showSharing
                ? { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent)' }
                : {}),
            }}
          >
            Sharing
          </button>
        </div>
      </div>

      {showSharing && (
        <SharingPanel myName={myName} onChanged={refresh} />
      )}

      <div style={styles.weekLabel}>{fmtRange(weekStart)}</div>

      {/* Grid: one header row of days, one body row of cells */}
      <div style={styles.grid}>
        <div style={styles.headRow}>
          <div style={styles.rowLabelCell}>My load</div>
          {days.map((d, i) => (
            <div key={dayKeys[i]} style={styles.dayHeadCell}>
              <div style={styles.dayHeadLabel}>{DAY_LABELS[i]}</div>
              <div style={styles.dayHeadDate}>{d.getDate()}</div>
            </div>
          ))}
          <div style={styles.totalHeadCell}>Total</div>
        </div>

        <div style={styles.bodyRow}>
          <div style={styles.rowLabelCell}>
            <span style={styles.rowName}>{myName || 'You'}</span>
            <span style={styles.rowMeta}>{round1(weekTotal)}h this week</span>
          </div>
          {dayData.map((d) => {
            const over = d.totalHours > dailyHours;
            const isOpen = d.key === openDayKey;
            const hasContent = d.entries.length > 0;
            return (
              <button
                key={d.key}
                onClick={() => setOpenDayKey(isOpen ? null : d.key)}
                style={{
                  ...styles.cell,
                  ...(over ? styles.cellOver : {}),
                  ...(isOpen ? styles.cellOpen : {}),
                  ...(hasContent ? {} : styles.cellEmpty),
                }}
                title={hasContent ? 'Click to see tasks' : 'No assigned tasks'}
              >
                <div style={styles.cellHours}>
                  {hasContent ? `${round1(d.totalHours)}h` : '—'}
                </div>
                {d.tasksWithoutEstimate > 0 && (
                  <div style={styles.cellTbc}>
                    +{d.tasksWithoutEstimate} TBC
                  </div>
                )}
                {over && <div style={styles.cellFlag}>⚠ over</div>}
              </button>
            );
          })}
          <div style={styles.totalCell}>{round1(weekTotal)}h</div>
        </div>

        {/* One row per person sharing with me */}
        {sharedRows.map((row) => (
          <div key={row.sharerId} style={styles.bodyRow}>
            <div style={styles.rowLabelCell}>
              <span style={styles.rowName}>{row.name}</span>
              <span style={styles.rowMeta}>{round1(row.weekTotal)}h this week</span>
            </div>
            {row.perDay.map((d) => {
              const over = d.totalHours > dailyHours;
              const cellKey = `${row.sharerId}|${d.key}`;
              const isOpen = openSharedCell === cellKey;
              const hasContent = d.tasks.length > 0;
              return (
                <button
                  key={d.key}
                  onClick={() => setOpenSharedCell(isOpen ? null : cellKey)}
                  style={{
                    ...styles.cell,
                    ...(over ? styles.cellOver : {}),
                    ...(isOpen ? styles.cellOpen : {}),
                    ...(hasContent ? {} : styles.cellEmpty),
                  }}
                  title={hasContent ? 'Click to see tasks' : 'No assigned tasks'}
                >
                  <div style={styles.cellHours}>
                    {hasContent ? `${round1(d.totalHours)}h` : '—'}
                  </div>
                  {over && <div style={styles.cellFlag}>⚠ over</div>}
                </button>
              );
            })}
            <div style={styles.totalCell}>{round1(row.weekTotal)}h</div>
          </div>
        ))}
      </div>

      {/* Detail drawer for a shared person's clicked day */}
      {openSharedCell && (() => {
        const [sid, dkey] = openSharedCell.split('|');
        const row = sharedRows.find((r) => r.sharerId === sid);
        const day = row?.perDay.find((d) => d.key === dkey);
        if (!row || !day) return null;
        return (
          <div style={styles.detail}>
            <div style={styles.detailHead}>
              <span style={styles.detailTitle}>
                {row.name} —{' '}
                {(() => {
                  const d = new Date(dkey + 'T12:00:00');
                  return d.toLocaleDateString(undefined, {
                    weekday: 'long', day: 'numeric', month: 'long',
                  });
                })()}
                {' — '}{round1(day.totalHours)}h
              </span>
              <button onClick={() => setOpenSharedCell(null)} style={styles.detailClose}>×</button>
            </div>
            {day.tasks.length === 0 ? (
              <div style={styles.detailEmpty}>No assigned tasks on this day.</div>
            ) : (
              <div style={styles.taskList}>
                {day.tasks.map((t) => (
                  <div key={t.taskId} style={styles.taskRow}>
                    <div style={styles.taskMain}>
                      <div style={styles.taskTitle}>{t.title || '(untitled)'}</div>
                      <div style={styles.taskMeta}>
                        {t.project && <span style={styles.taskProject}>{t.project}</span>}
                      </div>
                    </div>
                    <div style={styles.taskHours}>
                      {Number.isFinite(Number(t.estimate)) ? `${round1(Number(t.estimate))}h` : 'TBC'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Detail drawer for the clicked day */}
      {openDay && (
        <div style={styles.detail}>
          <div style={styles.detailHead}>
            <span style={styles.detailTitle}>
              {(() => {
                const d = new Date(openDay.key + 'T12:00:00');
                return d.toLocaleDateString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                });
              })()}
              {' — '}
              {round1(openDay.totalHours)}h
              {openDay.tasksWithoutEstimate > 0 &&
                ` (+ ${openDay.tasksWithoutEstimate} task${openDay.tasksWithoutEstimate === 1 ? '' : 's'} without estimate)`}
            </span>
            <button onClick={() => setOpenDayKey(null)} style={styles.detailClose}>
              ×
            </button>
          </div>
          {openDay.entries.length === 0 ? (
            <div style={styles.detailEmpty}>No assigned tasks on this day.</div>
          ) : (
            <div style={styles.taskList}>
              {openDay.entries.map((e) => {
                const est = Number(e.task.estimate);
                return (
                  <div key={e.task.id} style={styles.taskRow}>
                    <div style={styles.taskMain}>
                      <div style={styles.taskTitle}>
                        {e.task.title || '(untitled)'}
                      </div>
                      <div style={styles.taskMeta}>
                        {e.task.project && (
                          <span style={styles.taskProject}>
                            {e.task.project}
                          </span>
                        )}
                        <span style={styles.taskWs}>
                          {e.workspaceName}
                          {e.source === 'assigned' && ' · assigned'}
                        </span>
                      </div>
                    </div>
                    <div style={styles.taskHours}>
                      {Number.isFinite(est) ? `${round1(est)}h` : 'TBC'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty state when nothing is assigned for the week */}
      {weekTotal === 0 &&
        dayData.every((d) => d.entries.length === 0) && (
          <div style={styles.empty}>
            Nothing assigned to you for this week. Tasks appear here when
            they have a due date and you're the assignee.
          </div>
        )}
    </div>
  );
}

const styles = {
  wrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    padding: '20px 24px',
    overflowY: 'auto',
    gap: 16,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 20,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  subtitle: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    marginTop: 2,
  },
  dailyHint: { color: 'var(--color-text-tertiary)' },
  weekNav: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  navBtn: {
    padding: '5px 10px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  weekLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  headRow: {
    display: 'grid',
    gridTemplateColumns: '160px repeat(7, 1fr) 80px',
    background: 'var(--color-background-secondary)',
  },
  bodyRow: {
    display: 'grid',
    gridTemplateColumns: '160px repeat(7, 1fr) 80px',
    borderTop: '0.5px solid var(--color-border-tertiary)',
  },
  rowLabelCell: {
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    justifyContent: 'center',
    borderRight: '0.5px solid var(--color-border-tertiary)',
  },
  rowName: { fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' },
  rowMeta: { fontSize: 10, color: 'var(--color-text-secondary)' },
  dayHeadCell: {
    padding: '8px 4px',
    textAlign: 'center',
    borderRight: '0.5px solid var(--color-border-tertiary)',
  },
  dayHeadLabel: { fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' },
  dayHeadDate: { fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginTop: 2 },
  totalHeadCell: {
    padding: '8px 4px',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cell: {
    background: 'transparent',
    border: 'none',
    borderRight: '0.5px solid var(--color-border-tertiary)',
    padding: '12px 4px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    cursor: 'pointer',
    minHeight: 64,
    color: 'var(--color-text-primary)',
  },
  cellEmpty: { color: 'var(--color-text-tertiary)', cursor: 'default' },
  cellOver: {
    background: '#e24b4a18',
  },
  cellOpen: {
    background: 'var(--accent-soft)',
  },
  cellHours: { fontSize: 15, fontWeight: 600 },
  cellTbc: { fontSize: 9, color: 'var(--color-text-tertiary)' },
  cellFlag: { fontSize: 9, color: '#e24b4a', fontWeight: 600 },
  totalCell: {
    padding: '12px 4px',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detail: {
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 10,
    background: 'var(--bg-surface)',
    overflow: 'hidden',
  },
  detailHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    background: 'var(--color-background-secondary)',
  },
  detailTitle: { fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' },
  detailClose: {
    background: 'transparent',
    border: 'none',
    fontSize: 18,
    color: 'var(--color-text-tertiary)',
    cursor: 'pointer',
  },
  detailEmpty: { padding: 16, fontSize: 12, color: 'var(--color-text-secondary)' },
  taskList: { display: 'flex', flexDirection: 'column' },
  taskRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  taskMain: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  taskTitle: { fontSize: 13, color: 'var(--color-text-primary)' },
  taskMeta: { display: 'flex', gap: 8, fontSize: 11, color: 'var(--color-text-secondary)' },
  taskProject: { fontWeight: 500 },
  taskWs: { color: 'var(--color-text-tertiary)' },
  taskHours: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    flexShrink: 0,
    marginLeft: 12,
  },
  empty: {
    padding: 32,
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
    background: 'var(--color-background-secondary)',
    borderRadius: 10,
    border: '0.5px dashed var(--color-border-tertiary)',
  },
};

