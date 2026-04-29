import { useState, useMemo } from 'react';
import NoteCard from './NoteCard.jsx';
import NoteEditor from './NoteEditor.jsx';

export default function NotesPanel({
  personal,
  team,
  loading,
  projects,
  tasks,
  workspaceId,
  onAdd,
  onUpdate,
  onDelete,
  onMove,
}) {
  const [activeKey, setActiveKey] = useState(null); // "personal:noteId" | "team:noteId"
  const [search, setSearch] = useState('');

  const filterFn = (n) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      n.title?.toLowerCase().includes(q) ||
      n.body?.toLowerCase().includes(q) ||
      n.projectName?.toLowerCase().includes(q)
    );
  };

  const sortFn = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0);

  const visiblePersonal = useMemo(
    () => personal.filter(filterFn).sort(sortFn),
    [personal, search]
  );
  const visibleTeam = useMemo(
    () => team.filter(filterFn).sort(sortFn),
    [team, search]
  );

  const active = useMemo(() => {
    if (!activeKey) return null;
    const [scope, id] = activeKey.split(':');
    const list = scope === 'team' ? team : personal;
    const note = list.find((n) => n.id === id);
    if (!note) return null;
    return { scope, note };
  }, [activeKey, personal, team]);

  const handleAdd = async (isTeam) => {
    const note = await onAdd({}, isTeam);
    setActiveKey(`${isTeam ? 'team' : 'personal'}:${note.id}`);
  };

  return (
    <div style={styles.wrap}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.searchBar}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
            style={styles.searchInput}
          />
        </div>

        <div style={styles.scrollList}>
          {loading ? (
            <div style={styles.empty}>Loading…</div>
          ) : (
            <>
              {/* My notes section */}
              <div style={styles.section}>
                <div style={styles.sectionHeader}>
                  <span style={styles.sectionTitle}>📝 My notes</span>
                  <button onClick={() => handleAdd(false)} style={styles.newBtn}>
                    +
                  </button>
                </div>
                {visiblePersonal.length === 0 ? (
                  <div style={styles.sectionEmpty}>
                    {personal.length === 0
                      ? 'No personal notes yet.'
                      : 'No matches in personal.'}
                  </div>
                ) : (
                  <div style={styles.cardList}>
                    {visiblePersonal.map((n) => (
                      <NoteCard
                        key={n.id}
                        note={n}
                        projects={projects}
                        isActive={activeKey === `personal:${n.id}`}
                        onClick={() => setActiveKey(`personal:${n.id}`)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Team notes section - only when in a team workspace */}
              {workspaceId && (
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.sectionTitle}>🏢 Team notes</span>
                    <button onClick={() => handleAdd(true)} style={styles.newBtn}>
                      +
                    </button>
                  </div>
                  {visibleTeam.length === 0 ? (
                    <div style={styles.sectionEmpty}>
                      {team.length === 0
                        ? 'No team notes yet.'
                        : 'No matches in team.'}
                    </div>
                  ) : (
                    <div style={styles.cardList}>
                      {visibleTeam.map((n) => (
                        <NoteCard
                          key={n.id}
                          note={n}
                          projects={projects}
                          isActive={activeKey === `team:${n.id}`}
                          onClick={() => setActiveKey(`team:${n.id}`)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Editor pane */}
      <div style={styles.editorPane}>
        {active ? (
          <NoteEditor
            note={active.note}
            isTeam={active.scope === 'team'}
            projects={projects}
            tasks={tasks}
            workspaceId={workspaceId}
            onUpdate={onUpdate}
            onDelete={(id, isTeam) => {
              onDelete(id, isTeam);
              setActiveKey(null);
            }}
            onMove={async (id, toTeam) => {
              await onMove(id, toTeam);
              setActiveKey(`${toTeam ? 'team' : 'personal'}:${id}`);
            }}
            onClose={() => setActiveKey(null)}
          />
        ) : (
          <div style={styles.placeholder}>
            <div style={styles.placeholderTitle}>No note selected</div>
            <div style={styles.placeholderSub}>
              Pick a note from the list or click + to create one.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    flex: 1,
    display: 'flex',
    background: '#fff',
    overflow: 'hidden',
  },
  sidebar: {
    width: 320,
    flexShrink: 0,
    borderRight: '0.5px solid var(--color-border-tertiary)',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--color-background-tertiary)',
  },
  searchBar: {
    padding: 10,
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  searchInput: {
    width: '100%',
    padding: '6px 10px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 8,
    fontSize: 12,
    outline: 'none',
    background: '#fff',
  },
  scrollList: { flex: 1, overflowY: 'auto', padding: 10 },
  section: { marginBottom: 14 },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 6px',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  newBtn: {
    width: 22,
    height: 22,
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  sectionEmpty: {
    padding: '8px 6px',
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
  },
  cardList: { display: 'flex', flexDirection: 'column', gap: 6 },
  empty: {
    padding: 24,
    textAlign: 'center',
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
  editorPane: { flex: 1, display: 'flex', minWidth: 0 },
  placeholder: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    color: 'var(--color-text-secondary)',
  },
  placeholderTitle: { fontSize: 14, fontWeight: 500 },
  placeholderSub: {
    fontSize: 12,
    color: 'var(--color-text-tertiary)',
    textAlign: 'center',
    maxWidth: 280,
  },
};
