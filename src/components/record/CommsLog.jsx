// Station comms across the workspace, opened from Record. A row opens the
// station workbench — Waiting itself stays on Today only.

function when(ts) {
  if (!ts) return '';
  const d = new Date(typeof ts === 'number' ? ts : ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function CommsLog({ projects, onOpenStation }) {
  const rows = [];
  for (const project of projects || []) {
    for (const deliverable of project.deliverables || []) {
      for (const station of deliverable.stations || []) {
        for (const comm of station.comms || []) {
          rows.push({ project, deliverable, station, comm });
        }
      }
    }
  }
  rows.sort((a, b) => (b.comm.sentAt || b.comm.at || 0) - (a.comm.sentAt || a.comm.at || 0));

  if (rows.length === 0) {
    return (
      <div style={styles.empty}>
        No comms logged yet. Log one from a station workbench and it lands here and on Today · Waiting.
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.head}>
        <h2 style={styles.title}>Comms log</h2>
        <span style={styles.meta}>{rows.length} across stations</span>
      </div>
      {rows.map(({ project, deliverable, station, comm }) => {
        const note = (comm.note || '').trim();
        const title = note ? note.split('\n')[0] : comm.type || 'Comm';
        const who = (comm.who || '').trim();
        return (
          <button
            key={comm.id}
            type="button"
            style={styles.row}
            onClick={() =>
              onOpenStation &&
              onOpenStation({
                projectId: project.id,
                deliverableId: deliverable.id,
                stationId: station.id,
              })
            }
          >
            <div style={styles.rowTitle}>{title}</div>
            <div style={styles.rowMeta}>
              {who ? `${who} · ` : ''}
              {comm.type || 'Note'}
              {' · '}
              {project.name}
              {station.name ? ` · ${station.name}` : ''}
              {comm.expectReplyBy ? ` · expect ${comm.expectReplyBy}` : ''}
              {comm.replyReceived ? ' · replied' : comm.needsReply ? ' · waiting' : ''}
              {comm.sentAt ? ` · ${when(comm.sentAt)}` : ''}
            </div>
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  wrap: { flex: 1, overflowY: 'auto', padding: '16px 20px 48px' },
  head: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 },
  title: { margin: 0, fontSize: 18, fontWeight: 650 },
  meta: { fontSize: 12, color: 'var(--color-text-secondary)' },
  row: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 10,
    padding: '10px 12px',
    marginBottom: 8,
    cursor: 'pointer',
  },
  rowTitle: { fontSize: 13.5, fontWeight: 550, color: 'var(--color-text-primary)' },
  rowMeta: { fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 3 },
  empty: { padding: 32, color: 'var(--color-text-secondary)', fontSize: 13.5 },
};
