import { authorLabel, EMPTY_COMMS_LOG, sanitizeUrl, typeLabel } from '../../lib/commsLogModel.js';

function whenMs(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function whenDay(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function placeLine(entry, place) {
  if (!entry || place === 'station') return '';
  const bits = [];
  if (place !== 'project' && entry.projectName) bits.push(entry.projectName);
  if (entry.deliverableName) bits.push(entry.deliverableName);
  if (entry.stationName) bits.push(entry.stationName);
  return bits.join(' · ');
}

function hrefFor(url) {
  const clean = sanitizeUrl(url || '');
  return clean.ok ? clean.url : '';
}

export default function CommsLogList({
  entries,
  place = 'workspace',
  onOpen,
  members,
  currentUserId,
  compact = false,
}) {
  if (!entries || entries.length === 0) {
    return <div style={{ ...styles.empty, ...(compact ? styles.emptyCompact : {}) }}>{EMPTY_COMMS_LOG}</div>;
  }

  return (
    <div style={styles.list}>
      {entries.map((entry) => {
        const waiting = entry.needsReply && !entry.replyReceived;
        const href = hrefFor(entry.url);
        const where = placeLine(entry, place);
        const who = authorLabel(entry.authorId, { currentUserId, members });
        const meta = [
          who,
          whenMs(entry.atMs),
          where,
          waiting && entry.expectReplyBy ? `expect ${whenDay(entry.expectReplyBy)}` : '',
        ].filter(Boolean).join(' · ');
        const open = () => {
          if (!onOpen || !entry.stationId) return;
          onOpen(entry);
        };
        const canOpen = !!(onOpen && entry.stationId);
        return (
          <div key={entry.id} style={{ ...styles.row, ...(compact ? styles.rowCompact : {}) }}>
            <button
              type="button"
              onClick={open}
              disabled={!canOpen}
              style={{ ...styles.main, ...(canOpen ? styles.mainOpen : styles.mainStatic) }}
            >
              <span style={styles.top}>
                <span style={styles.type}>{typeLabel(entry.type)}</span>
                {entry.label ? <span style={styles.label}>{entry.label}</span> : null}
                {waiting ? <span style={styles.waiting}>Waiting</span> : null}
                {entry.replyReceived ? <span style={styles.replied}>Replied</span> : null}
              </span>
              {meta ? <span style={styles.meta}>{meta}</span> : null}
            </button>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.chip}
              >
                Opens in Teams/Slack
              </a>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  empty: {
    padding: '8px 0 4px',
    color: 'var(--color-text-secondary)',
    fontSize: 13.5,
    lineHeight: 1.45,
  },
  emptyCompact: { fontSize: 13 },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 10,
    padding: '8px 10px',
  },
  rowCompact: { padding: '8px 8px' },
  main: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 3,
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    padding: 0,
    font: 'inherit',
  },
  mainOpen: { cursor: 'pointer' },
  mainStatic: { cursor: 'default' },
  top: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  type: {
    fontSize: 11,
    fontWeight: 650,
    padding: '2px 8px',
    borderRadius: 999,
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
  },
  label: { fontSize: 13.5, fontWeight: 550, color: 'var(--color-text-primary)' },
  waiting: {
    fontSize: 10,
    fontWeight: 650,
    padding: '1px 7px',
    borderRadius: 999,
    background: '#ef9f2722',
    color: '#b45309',
  },
  replied: {
    fontSize: 10,
    fontWeight: 650,
    padding: '1px 7px',
    borderRadius: 999,
    background: '#1d9e7522',
    color: '#0f766e',
  },
  meta: { fontSize: 12, color: 'var(--color-text-secondary)' },
  chip: {
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 650,
    color: 'var(--accent)',
    textDecoration: 'none',
    border: '0.5px solid var(--accent)',
    borderRadius: 999,
    padding: '3px 8px',
    background: 'var(--accent-soft)',
  },
};
