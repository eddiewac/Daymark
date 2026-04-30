import { useEffect, useMemo, useState } from 'react';
import { uid, todayStr } from '../../lib/utils.js';
import RoundEditor from './RoundEditor.jsx';
import RoundExport from './RoundExport.jsx';

export default function StatusRoundsPanel({
  rounds,
  loading,
  workspaceId,
  workspaceName,
  projects,
  tasks,
  currentUserId,
  onAdd,
  onEdit,
  onRemove,
  onAddTask,
}) {
  const [activeId, setActiveId] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Auto-select most recent round on load
  useEffect(() => {
    if (!activeId && rounds.length > 0) {
      setActiveId(rounds[0].id);
    }
  }, [rounds, activeId]);

  const active = rounds.find((r) => r.id === activeId);

  // Build a default project list for new rounds: every active project
  const buildDefaultProjects = () =>
    (projects || [])
      .filter((p) => !p.archived)
      .map((p) => ({
        project_id: p.id,
        rag: 'not_discussed',
        update: '',
        actions: [],
      }));

  const handleNewRound = async () => {
    const created = await onAdd({
      date: todayStr(),
      title: '',
      notes: '',
      projects: buildDefaultProjects(),
    });
    if (created) setActiveId(created.id);
  };

  const handleUpdateActive = (patch) => {
    if (!active) return;
    onEdit(active.id, patch);
  };

  const handleRemoveActive = () => {
    if (!active) return;
    onRemove(active.id);
    setActiveId(null);
  };

  if (loading) {
    return (
      <div style={styles.wrap}>
        <div style={styles.empty}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      {/* Left pane: round list */}
      <div style={styles.list}>
        <div style={styles.listHeader}>
          <div style={styles.listTitle}>Status rounds</div>
          <button onClick={handleNewRound} style={styles.newBtn}>
            + New round
          </button>
        </div>

        <div style={styles.listScroll}>
          {rounds.length === 0 ? (
            <div style={styles.emptyList}>
              No rounds yet. Click "+ New round" to start your first weekly check-in.
            </div>
          ) : (
            rounds.map((r) => (
              <RoundListItem
                key={r.id}
                round={r}
                active={r.id === activeId}
                onClick={() => setActiveId(r.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right pane: editor */}
      <div style={styles.editor}>
        {!active ? (
          <div style={styles.empty}>
            {rounds.length === 0
              ? 'Create your first round to begin.'
              : 'Select a round to view it.'}
          </div>
        ) : (
          <RoundEditor
            round={active}
            projects={projects}
            tasks={tasks}
            currentUserId={currentUserId}
            workspaceName={workspaceName}
            onUpdate={handleUpdateActive}
            onRemove={handleRemoveActive}
            onExport={() => setExporting(true)}
            onAddTask={onAddTask}
          />
        )}
      </div>

      {exporting && active && (
        <RoundExport
          round={active}
          projects={projects}
          workspaceName={workspaceName}
          onClose={() => setExporting(false)}
        />
      )}
    </div>
  );
}

// ── RoundListItem ───────────────────────────────────────────────────────────
function RoundListItem({ round, active, onClick }) {
  const counts = useMemo(() => {
    let r = 0, a = 0, g = 0, n = 0;
    for (const p of round.projects || []) {
      if (p.rag === 'red') r++;
      else if (p.rag === 'amber') a++;
      else if (p.rag === 'green') g++;
      else n++;
    }
    return { r, a, g, n, total: (round.projects || []).length };
  }, [round.projects]);

  const dateLabel = useMemo(() => {
    const d = new Date(round.date + 'T12:00:00');
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [round.date]);

  return (
    <button
      onClick={onClick}
      style={{
        ...listItemStyles.wrap,
        background: active ? '#534AB711' : '#fff',
        borderColor: active ? '#534AB7' : 'var(--color-border-tertiary)',
      }}
    >
      <div style={listItemStyles.dateRow}>
        <span
          style={{
            ...listItemStyles.dateLabel,
            color: active ? '#534AB7' : 'var(--color-text-primary)',
            fontWeight: active ? 600 : 500,
          }}
        >
          {dateLabel}
        </span>
        {round.title && (
          <span style={listItemStyles.titleLabel}>{round.title}</span>
        )}
      </div>
      <div style={listItemStyles.counts}>
        {counts.total === 0 ? (
          <span style={listItemStyles.countDim}>No projects</span>
        ) : (
          <>
            <span style={listItemStyles.countDim}>
              {counts.total} project{counts.total === 1 ? '' : 's'}
            </span>
            {counts.r > 0 && (
              <span style={{ ...listItemStyles.dot, background: '#e24b4a' }}>{counts.r}</span>
            )}
            {counts.a > 0 && (
              <span style={{ ...listItemStyles.dot, background: '#ef9f27' }}>{counts.a}</span>
            )}
            {counts.g > 0 && (
              <span style={{ ...listItemStyles.dot, background: '#1d9e75' }}>{counts.g}</span>
            )}
          </>
        )}
      </div>
    </button>
  );
}

const styles = {
  wrap: {
    flex: 1,
    display: 'flex',
    minHeight: 0,
    background: '#fff',
  },
  list: {
    width: 280,
    minWidth: 280,
    borderRight: '0.5px solid var(--color-border-tertiary)',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--color-background-secondary)',
  },
  listHeader: {
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  listTitle: { fontSize: 13, fontWeight: 600 },
  newBtn: {
    padding: '4px 10px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
  },
  listScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  emptyList: {
    padding: 14,
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  editor: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    color: 'var(--color-text-secondary)',
  },
};

const listItemStyles = {
  wrap: {
    width: '100%',
    padding: '8px 10px',
    border: '0.5px solid',
    borderRadius: 8,
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  dateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  dateLabel: { fontSize: 12 },
  titleLabel: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
  },
  counts: {
    display: 'flex',
    gap: 4,
    alignItems: 'center',
  },
  countDim: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
  },
  dot: {
    fontSize: 9,
    color: '#fff',
    fontWeight: 600,
    padding: '0 5px',
    minWidth: 16,
    height: 14,
    lineHeight: '14px',
    borderRadius: 8,
    textAlign: 'center',
  },
};
