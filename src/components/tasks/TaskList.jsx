import { useMemo, useState } from 'react';
import TaskRow from './TaskRow.jsx';
import TaskForm from './TaskForm.jsx';

export default function TaskList({
  tasks, // pre-merged list (allTasks from useTasks)
  loading,
  projects,
  categories,
  priorities,
  statuses,
  members,
  workspaceId,
  currentUserId,
  runningTimer,
  onAdd,
  onUpdate,
  onDelete,
  onToggleDone,
  onAssign,
  onUnassign,
  onStartTimer,
  onStopTimer,
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('active'); // active | all | done
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    let list = tasks;
    if (filter === 'active') list = list.filter((t) => !t.done);
    else if (filter === 'done') list = list.filter((t) => t.done);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          (t.title || '').toLowerCase().includes(q) ||
          (t.project || '').toLowerCase().includes(q) ||
          (t.tags || []).some((tag) => tag.toLowerCase().includes(q))
      );
    }
    // Most recent first
    return [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [tasks, filter, search]);

  const handleSave = async (formValues) => {
    if (editing) {
      await onUpdate(editing.id, formValues);
    } else {
      await onAdd(formValues);
    }
    setShowForm(false);
    setEditing(null);
  };

  const startEdit = (task) => {
    setEditing(task);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div style={styles.filters}>
          {['active', 'all', 'done'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                ...styles.filterBtn,
                ...(filter === f ? styles.filterActive : {}),
              }}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            style={styles.search}
          />
        </div>
        {!showForm && (
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            style={styles.addBtn}
          >
            + Add task
          </button>
        )}
      </div>

      {showForm && (
        <TaskForm
          initialTask={editing}
          projects={projects}
          categories={categories}
          priorities={priorities}
          statuses={statuses}
          members={members}
          workspaceId={workspaceId}
          onSave={handleSave}
          onCancel={cancelForm}
        />
      )}

      <div style={styles.listScroll}>
        {loading ? (
          <div style={styles.empty}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={styles.empty}>
            {tasks.length === 0
              ? 'No tasks yet. Click + Add task to create one.'
              : 'No tasks match the current filter.'}
          </div>
        ) : (
          visible.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              projects={projects}
              members={members}
              workspaceId={workspaceId}
              currentUserId={currentUserId}
              runningTimer={runningTimer}
              onToggleDone={onToggleDone}
              onEdit={startEdit}
              onDelete={onDelete}
              onAssign={onAssign}
              onUnassign={onUnassign}
              onStartTimer={onStartTimer}
              onStopTimer={onStopTimer}
            />
          ))
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    gap: 10,
  },
  filters: { display: 'flex', gap: 4, alignItems: 'center', flex: 1 },
  filterBtn: {
    padding: '4px 12px',
    fontSize: 12,
    background: 'transparent',
    border: '0.5px solid transparent',
    borderRadius: 16,
    color: 'var(--color-text-secondary)',
  },
  filterActive: {
    background: '#534AB711',
    color: '#534AB7',
    fontWeight: 500,
  },
  search: {
    flex: 1,
    maxWidth: 240,
    marginLeft: 6,
    padding: '5px 10px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 8,
    fontSize: 12,
    outline: 'none',
  },
  addBtn: {
    padding: '5px 14px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
  },
  listScroll: { flex: 1, overflowY: 'auto' },
  empty: {
    padding: 32,
    textAlign: 'center',
    fontSize: 13,
    color: 'var(--color-text-secondary)',
  },
};
