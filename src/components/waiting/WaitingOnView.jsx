import { useMemo } from 'react';
import { todayStr } from '../../lib/utils.js';
import { projectColor } from '../../lib/constants.js';

// A single unified view of everything you're waiting on or need to chase,
// across three sources:
//   1. Deliverables out with someone (waitingOnName + waitingOnDate)
//   2. Station comms awaiting a reply (needsReply, !replyReceived, expectReplyBy)
//   3. Follow-up reminders (tasks flagged isFollowUp, with a dueDate)
// Everything is merged and sorted by the date it's expected back / due.

function fmtDate(iso) {
  if (!iso) return 'no date';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

// Relative label: Overdue / Today / Tomorrow / This week / Later
function relativeBucket(iso, today) {
  if (!iso) return { key: 'nodate', label: 'No date' };
  if (iso < today) return { key: 'overdue', label: 'Overdue' };
  if (iso === today) return { key: 'today', label: 'Today' };
  const t = new Date(today + 'T00:00:00');
  const d = new Date(iso + 'T00:00:00');
  const days = Math.round((d - t) / 86400000);
  if (days === 1) return { key: 'tomorrow', label: 'Tomorrow' };
  if (days <= 7) return { key: 'week', label: 'This week' };
  return { key: 'later', label: 'Later' };
}

const BUCKET_ORDER = ['overdue', 'today', 'tomorrow', 'week', 'later', 'nodate'];

const BUCKET_COLOR = {
  overdue: '#e24b4a',
  today: '#ef9f27',
  tomorrow: '#ef9f27',
  week: '#534AB7',
  later: 'var(--color-text-secondary)',
  nodate: 'var(--color-text-tertiary)',
};

const KIND_META = {
  deliverable: { icon: '⏳', label: 'With' },
  comm: { icon: '↩', label: 'Awaiting reply' },
  followup: { icon: '🔔', label: 'Follow-up' },
};

export default function WaitingOnView({ projects, tasks, onOpenProject }) {
  const today = todayStr();

  const items = useMemo(() => {
    const out = [];

    // 1 + 2: walk projects for deliverable waits and comms awaiting reply
    for (const p of projects || []) {
      for (const d of p.deliverables || []) {
        // Deliverable-level "with [name], back [date]"
        const woName = (d.waitingOnName || '').trim();
        if (woName) {
          out.push({
            id: `deliv-${d.id}`,
            kind: 'deliverable',
            title: d.name || '(deliverable)',
            project: p,
            deliverableId: d.id,
            stationId: null,
            with: woName,
            date: d.waitingOnDate || '',
          });
        }
        // Station comms awaiting a reply
        for (const st of d.stations || []) {
          for (const c of st.comms || []) {
            if (c.needsReply && !c.replyReceived) {
              out.push({
                id: `comm-${c.id || Math.random().toString(36).slice(2)}`,
                kind: 'comm',
                title: `${d.name || '(deliverable)'} · ${st.name || 'station'}`,
                project: p,
                deliverableId: d.id,
                stationId: st.id,
                with: c.label || c.channel || '',
                date: c.expectReplyBy || '',
              });
            }
          }
        }
      }
    }

    // 3: follow-up reminders (tasks flagged isFollowUp, not done)
    for (const t of tasks || []) {
      if (t.isFollowUp && !t.done) {
        out.push({
          id: `followup-${t.id}`,
          kind: 'followup',
          title: t.title || '(follow-up)',
          project: (projects || []).find((p) => p.name === t.project) || null,
          with: '',
          date: t.dueDate || '',
        });
      }
    }

    // Sort: by date ascending; undated last.
    out.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });
    return out;
  }, [projects, tasks]);

  // Group into buckets by urgency, preserving date sort within each.
  const buckets = useMemo(() => {
    const map = {};
    for (const it of items) {
      const b = relativeBucket(it.date, today);
      (map[b.key] = map[b.key] || { label: b.label, items: [] }).items.push(it);
    }
    return BUCKET_ORDER.filter((k) => map[k]).map((k) => ({ key: k, ...map[k] }));
  }, [items, today]);

  const overdueCount = items.filter((it) => it.date && it.date < today).length;

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={styles.title}>Waiting on</span>
        <span style={styles.summary}>
          {items.length} item{items.length === 1 ? '' : 's'} in flight
          {overdueCount > 0 && (
            <span style={styles.overdueSummary}> · {overdueCount} overdue</span>
          )}
        </span>
      </div>

      <div style={styles.scroll}>
        {items.length === 0 ? (
          <div style={styles.empty}>
            Nothing out at the moment. Deliverables you mark as “with” someone,
            comms awaiting a reply, and follow-up reminders will appear here.
          </div>
        ) : (
          buckets.map((bucket) => (
            <div key={bucket.key} style={styles.bucket}>
              <div style={styles.bucketHeader}>
                <span
                  style={{ ...styles.bucketDot, background: BUCKET_COLOR[bucket.key] }}
                />
                <span style={styles.bucketLabel}>{bucket.label}</span>
                <span style={styles.bucketCount}>{bucket.items.length}</span>
              </div>
              <div style={styles.list}>
                {bucket.items.map((it) => {
                  const meta = KIND_META[it.kind];
                  const pColor = it.project ? projectColor(it.project.name, projects) : 'transparent';
                  return (
                    <button
                      key={it.id}
                      onClick={() =>
                        it.project &&
                        onOpenProject({
                          projectId: it.project.id,
                          deliverableId: it.deliverableId,
                          stationId: it.stationId,
                        })
                      }
                      style={{
                        ...styles.row,
                        borderLeft: `3px solid ${pColor}`,
                        cursor: it.project ? 'pointer' : 'default',
                      }}
                      title={it.project ? (it.stationId ? 'Open station' : 'Open project') : undefined}
                    >
                      <span style={styles.rowIcon} title={meta.label}>{meta.icon}</span>
                      <span style={styles.rowMain}>
                        <span style={styles.rowTitle}>{it.title}</span>
                        <span style={styles.rowSub}>
                          {it.project && <span style={{ color: pColor }}>{it.project.name}</span>}
                          {it.with && (
                            <>
                              {it.project ? ' · ' : ''}
                              {it.kind === 'deliverable' ? `with ${it.with}` : it.with}
                            </>
                          )}
                        </span>
                      </span>
                      <span
                        style={{
                          ...styles.rowDate,
                          color:
                            it.date && it.date < today
                              ? '#e24b4a'
                              : 'var(--color-text-secondary)',
                        }}
                      >
                        {fmtDate(it.date)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-surface)' },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
    padding: '12px 16px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  title: { fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' },
  summary: { fontSize: 12, color: 'var(--color-text-secondary)' },
  overdueSummary: { color: '#e24b4a', fontWeight: 500 },
  scroll: { flex: 1, overflowY: 'auto', padding: '12px 16px' },
  empty: {
    padding: 40,
    textAlign: 'center',
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.5,
    maxWidth: 420,
    margin: '0 auto',
  },
  bucket: { marginBottom: 18 },
  bucketHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  bucketDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  bucketLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  bucketCount: {
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
    background: 'var(--color-background-secondary)',
    borderRadius: 10,
    padding: '1px 8px',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 4 },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '8px 12px',
    background: 'var(--color-background-tertiary)',
    border: 'none',
    borderRadius: 8,
    textAlign: 'left',
  },
  rowIcon: { fontSize: 14, flexShrink: 0, width: 18, textAlign: 'center' },
  rowMain: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 },
  rowTitle: {
    fontSize: 13,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowSub: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowDate: {
    fontSize: 12,
    fontWeight: 500,
    flexShrink: 0,
    fontFamily: 'monospace',
  },
};
