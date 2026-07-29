import { useMemo, useRef, useEffect, useState } from 'react';
import { projectColor } from '../../lib/constants.js';
import { todayStr } from '../../lib/utils.js';

const DAY_PX = 18;
const ROW_H = 36;
const HEADER_H = 44;
const LABEL_W = 180;

// Convert a YYYY-MM-DD string to a Date at midnight local time
function toDate(str) {
  if (!str) return null;
  return new Date(str + 'T00:00:00');
}

function diffDays(a, b) {
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

function daysToX(date, startDate) {
  return diffDays(date, startDate) * DAY_PX;
}

function isWeekend(d) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function fmtMonth(d) {
  return d.toLocaleString(undefined, { month: 'short', year: '2-digit' });
}

export default function GanttView({ projects, congresses }) {
  const [today] = useState(() => toDate(todayStr()));
  const scrollRef = useRef(null);
  const labelColRef = useRef(null);

  // Keep the label column's vertical scroll in sync with the timeline.
  // The timeline is the single source of truth; the label column has its
  // own scrollbar hidden (overflowY: 'hidden') but is still scrolled
  // programmatically here so project names stay aligned with their bars.
  const handleTimelineScroll = () => {
    if (labelColRef.current && scrollRef.current) {
      labelColRef.current.scrollTop = scrollRef.current.scrollTop;
    }
  };

  // Build the rows: project header, then deliverables, then stations under each deliverable
  const rows = useMemo(() => {
    const out = [];
    for (const p of projects) {
      const projDels = (p.deliverables || []).filter(
        (d) => d.startDate || d.dueDate || (d.stations || []).some((s) => s.startDate || s.targetDate)
      );
      if (projDels.length === 0) continue;
      out.push({ kind: 'project', project: p });
      for (const d of projDels) {
        out.push({ kind: 'deliverable', project: p, deliverable: d });
        const stations = (d.stations || []).filter((s) => s.startDate || s.targetDate);
        for (const s of stations) {
          out.push({ kind: 'station', project: p, deliverable: d, station: s });
        }
      }
    }
    return out;
  }, [projects]);

  // Determine timeline window
  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    let earliest = today;
    let latest = today;
    for (const r of rows) {
      let s = null, e = null;
      if (r.kind === 'deliverable') {
        s = toDate(r.deliverable.startDate);
        e = toDate(r.deliverable.dueDate);
      } else if (r.kind === 'station') {
        s = toDate(r.station.startDate);
        e = toDate(r.station.targetDate);
      }
      if (s && s < earliest) earliest = s;
      if (e && e > latest) latest = e;
    }
    for (const c of congresses || []) {
      ['abstractDeadline', 'lateBreakingDeadline', 'startDate', 'endDate'].forEach((k) => {
        const d = toDate(c[k]);
        if (d) {
          if (d < earliest) earliest = d;
          if (d > latest) latest = d;
        }
      });
    }
    const start = new Date(earliest);
    start.setDate(start.getDate() - 7);
    const end = new Date(latest);
    end.setDate(end.getDate() + 14);
    return {
      rangeStart: start,
      rangeEnd: end,
      totalDays: Math.max(30, diffDays(end, start)),
    };
  }, [rows, congresses, today]);

  const totalW = totalDays * DAY_PX;

  // Auto-scroll so today is visible
  useEffect(() => {
    if (!scrollRef.current) return;
    const todayX = daysToX(today, rangeStart);
    scrollRef.current.scrollLeft = Math.max(0, todayX - 200);
  }, [rangeStart, today]);

  if (rows.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyTitle}>No scheduled deliverables yet</div>
        <div style={styles.emptySub}>
          Open a project, add deliverables with start and due dates, and they'll appear here.
        </div>
      </div>
    );
  }

  // Build header date marks (every Monday)
  const headerMarks = [];
  let cur = new Date(rangeStart);
  while (cur <= rangeEnd) {
    if (cur.getDay() === 1) {
      headerMarks.push({
        x: daysToX(cur, rangeStart),
        date: new Date(cur),
      });
    }
    cur.setDate(cur.getDate() + 1);
  }

  // Build congress markers - looks at each project's `congresses` array of ids
  // and shows markers for any congress linked to a visible project.
  const visibleProjectIds = new Set(rows.map((r) => r.project.id));
  const linkedCongressIds = new Set();
  for (const r of rows) {
    for (const cid of r.project.congresses || []) {
      linkedCongressIds.add(cid);
    }
  }
  const congressMarkers = (congresses || [])
    .filter((c) => linkedCongressIds.has(c.id))
    .flatMap((c) => {
      const col = c.color || 'var(--accent)';
      const m = [];
      const add = (key, label, type) => {
        const d = toDate(c[key]);
        if (d) m.push({ x: daysToX(d, rangeStart), col, label: `${c.abbr || c.name} ${label}`, type });
      };
      add('abstractDeadline', 'abstract', 'abstract');
      add('lateBreakingDeadline', 'late-breaking', 'late');
      add('startDate', 'starts', 'start');
      return m;
    });

  return (
    <div style={styles.wrap}>
      <div style={styles.toolbar}>
        <div style={styles.toolTitle}>Timeline</div>
        <div style={styles.toolMeta}>
          {rangeStart.toLocaleDateString()} → {rangeEnd.toLocaleDateString()}
          {' · '}
          {projects.length} project{projects.length === 1 ? '' : 's'}
        </div>
      </div>

      <div style={styles.layout}>
        {/* Left label column. overflowY is 'hidden' — it has no scrollbar of
            its own; it is scrolled programmatically by handleTimelineScroll
            so the names stay aligned with the timeline bars. */}
        <div ref={labelColRef} style={styles.labelCol}>
          <div style={{ ...styles.labelHeader, height: HEADER_H }}>Project / Deliverable</div>
          {rows.map((r, i) => (
            <div
              key={i}
              style={{
                ...styles.labelRow,
                height: ROW_H,
                background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-surface-muted)',
                paddingLeft:
                  r.kind === 'project' ? 10 : r.kind === 'deliverable' ? 24 : 38,
                fontWeight: r.kind === 'project' ? 600 : 400,
                fontSize:
                  r.kind === 'project' ? 12 : r.kind === 'deliverable' ? 11 : 10,
                color:
                  r.kind === 'station'
                    ? 'var(--color-text-secondary)'
                    : 'var(--color-text-primary)',
              }}
              title={
                r.kind === 'project'
                  ? r.project.name
                  : r.kind === 'deliverable'
                  ? r.deliverable.name
                  : `${r.deliverable.name} → ${r.station.name}`
              }
            >
              {r.kind === 'project'
                ? r.project.name
                : r.kind === 'deliverable'
                ? r.deliverable.name
                : '↳ ' + r.station.name}
            </div>
          ))}
        </div>

        {/* Scrollable timeline — the single scroll surface. Its onScroll
            handler keeps the label column in vertical sync. */}
        <div ref={scrollRef} style={styles.scrollArea} onScroll={handleTimelineScroll}>
          <div style={{ width: totalW, position: 'relative' }}>
            {/* Header */}
            <div style={{ ...styles.header, height: HEADER_H, width: totalW }}>
              {headerMarks.map((m, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: m.x,
                    top: 0,
                    bottom: 0,
                    paddingLeft: 4,
                    fontSize: 10,
                    color: 'var(--color-text-secondary)',
                    borderLeft: '0.5px solid var(--color-border-tertiary)',
                  }}
                >
                  {fmtMonth(m.date)}
                  <br />
                  {m.date.getDate()}
                </div>
              ))}
            </div>

            {/* Body */}
            <div style={{ position: 'relative' }}>
              {/* Row backgrounds with weekend shading */}
              {rows.map((_, i) => (
                <div
                  key={`bg-${i}`}
                  style={{
                    position: 'absolute',
                    top: i * ROW_H,
                    left: 0,
                    width: totalW,
                    height: ROW_H,
                    background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-surface-muted)',
                  }}
                />
              ))}

              {/* Weekend shading overlay */}
              {Array.from({ length: totalDays }, (_, di) => {
                const d = new Date(rangeStart);
                d.setDate(d.getDate() + di);
                if (!isWeekend(d)) return null;
                return (
                  <div
                    key={`we-${di}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: di * DAY_PX,
                      width: DAY_PX,
                      height: rows.length * ROW_H,
                      background: 'rgba(0,0,0,0.025)',
                    }}
                  />
                );
              })}

              {/* Today line */}
              {today >= rangeStart && today <= rangeEnd && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: daysToX(today, rangeStart),
                    width: 2,
                    height: rows.length * ROW_H,
                    background: '#FF6B35',
                    opacity: 0.85,
                  }}
                  title="Today"
                />
              )}

              {/* Congress markers */}
              {congressMarkers.map((m, i) => (
                <div
                  key={`cm-${i}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: m.x,
                    height: rows.length * ROW_H,
                    width: 0,
                    borderLeft: `1.5px ${m.type === 'start' ? 'solid' : 'dashed'} ${m.col}`,
                    opacity: 0.7,
                  }}
                  title={m.label}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: -2,
                      left: -2,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: m.col,
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.type === 'abstract' ? '📝' : m.type === 'late' ? '⏰' : '🏛'} {m.label}
                  </div>
                </div>
              ))}

              {/* Bars */}
              {rows.map((r, i) => {
                let s = null, e = null, name = '', col = 'var(--accent)', isDone = false, isStation = false;

                if (r.kind === 'deliverable') {
                  s = toDate(r.deliverable.startDate);
                  e = toDate(r.deliverable.dueDate);
                  name = r.deliverable.name;
                  col = projectColor(r.project.name, projects);
                  isDone = !!r.deliverable.done;
                } else if (r.kind === 'station') {
                  s = toDate(r.station.startDate);
                  e = toDate(r.station.targetDate);
                  name = r.station.name;
                  col = projectColor(r.project.name, projects);
                  isDone = !!r.station.done;
                  isStation = true;
                } else {
                  return null;
                }

                if (!s && !e) return null;
                const start = s || e;
                const end = e || s;
                if (end < rangeStart || start > rangeEnd) return null;
                const x = daysToX(start, rangeStart);
                const w = Math.max(DAY_PX, daysToX(end, rangeStart) - x + DAY_PX);
                const barH = isStation ? 12 : 18;
                const y = i * ROW_H + (ROW_H - barH) / 2;
                return (
                  <div
                    key={`bar-${i}`}
                    style={{
                      position: 'absolute',
                      top: y,
                      left: x,
                      width: w,
                      height: barH,
                      background: isDone ? col + '55' : isStation ? col + 'cc' : col,
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 5,
                      fontSize: isStation ? 9 : 10,
                      color: '#fff',
                      fontWeight: 500,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                    title={`${name}: ${start.toLocaleDateString()} → ${end.toLocaleDateString()}`}
                  >
                    {name}
                  </div>
                );
              })}

              {/* Spacer to set height */}
              <div style={{ height: rows.length * ROW_H }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-surface)',
    overflow: 'hidden',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 14px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  toolTitle: { fontSize: 13, fontWeight: 600 },
  toolMeta: { fontSize: 11, color: 'var(--color-text-secondary)' },
  layout: { flex: 1, display: 'flex', overflow: 'hidden', minWidth: 0 },
  labelCol: {
    width: LABEL_W,
    flexShrink: 0,
    borderRight: '0.5px solid var(--color-border-tertiary)',
    overflowY: 'hidden',
  },
  labelHeader: {
    padding: '8px 10px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    background: 'var(--bg-surface)',
    position: 'sticky',
    top: 0,
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    display: 'flex',
    alignItems: 'flex-end',
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    paddingRight: 10,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  scrollArea: { flex: 1, overflow: 'auto', minWidth: 0 },
  header: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-surface)',
    zIndex: 10,
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  empty: {
    padding: 48,
    textAlign: 'center',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 14, fontWeight: 600 },
  emptySub: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    maxWidth: 360,
  },
};
