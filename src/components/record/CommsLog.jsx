// Workspace Comms Log, opened from Record. A row opens the station workbench.
// Waiting itself stays on Today only. Entries are the same ones logged on a station.

import CommsLogList from '../comms/CommsLogList.jsx';

export default function CommsLog({ entries, members, currentUserId, onOpenStation }) {
  const rows = entries || [];
  return (
    <div style={styles.wrap}>
      <div style={styles.head}>
        <h2 style={styles.title}>Comms Log</h2>
        <span style={styles.meta}>
          {rows.length} across the workspace
        </span>
      </div>
      <CommsLogList
        entries={rows}
        place="workspace"
        members={members}
        currentUserId={currentUserId}
        onOpen={
          onOpenStation
            ? (entry) =>
                onOpenStation({
                  projectId: entry.projectId,
                  deliverableId: entry.deliverableId,
                  stationId: entry.stationId,
                })
            : null
        }
      />
    </div>
  );
}

const styles = {
  wrap: { flex: 1, overflowY: 'auto', padding: '16px 20px 48px' },
  head: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 },
  title: { margin: 0, fontSize: 18, fontWeight: 650 },
  meta: { fontSize: 12, color: 'var(--color-text-secondary)' },
};
