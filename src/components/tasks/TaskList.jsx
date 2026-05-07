import { useMemo, useState } from 'react';
import TaskRow from './TaskRow.jsx';
import TaskForm from './TaskForm.jsx';
import { projectColor } from '../../lib/constants.js';

const STORAGE_KEY = 'daymark-tasks-view-prefs-v1';

// Persist view-mode + compact + group-by between sessions
function loadViewPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { viewMode: 'list', compact: false, groupBy: 'status' };
}

function saveViewPrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

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
  const [filter, setFilter] = useState('active'); // active | all | done | oos
  const [search, setSearch] = useState('');

  const initialPrefs = loadViewPrefs();
  const [viewMode, setViewMode] = useState(initialPrefs.viewMode); // list | kanban | table
  const [compact, setCompact] = useState(initialPrefs.compact);
  const [groupBy, setGroupBy] = useState(initialPrefs.groupBy); // status | priority | project | assignee

  // Persist view-mode prefs
  const updatePrefs = (patch) => {
    const next = { viewMode, compact, groupBy, ...patch };
    saveViewPrefs(next);
    if ('viewMode' in patch) setViewMode(patch.viewMode);
    if ('compact' in patch) setCompact(patch.compact);
    if ('groupBy' in patch) setGroupBy(patch.groupBy);
  };

  const visible = useMemo(() => {
    let list = tasks;
    if (filter === 'active') list = list.filter((t) => !t.done);
    else if (filter === 'done') list = list.filter((t) => t.done);
    else if (filter === 'oos') list = list.filter((t) => t.outOfScope);
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
          {['active', 'all', 'done', 'oos'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                ...styles.filterBtn,
                ...(filter === f ? styles.filterActive : {}),
                ...(f === 'oos' && filter === f ? { background: '#e24b4a22', color: '#e24b4a' } : {}),
              }}
            >
              {f === 'oos' ? 'Out of scope' : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            style={styles.search}
          />
        </div>

        <div style={styles.toolbarRight}>
          {/* View-mode switcher */}
          <div style={styles.viewSwitch}>
            {[
              { key: 'list', label: '☰ List' },
              { key: 'kanban', label: '⊞ Kanban' },
              { key: 'table', label: '▤ Table' },
            ].map((v) => (
              <button
                key={v.key}
                onClick={() => updatePrefs({ viewMode: v.key })}
                style={{
                  ...styles.viewBtn,
                  ...(viewMode === v.key ? styles.viewBtnActive : {}),
                }}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* View-specific options */}
          {viewMode === 'list' && (
            <label style={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={compact}
                onChange={(e) => updatePrefs({ compact: e.target.checked })}
              />
              Compact
            </label>
          )}
          {viewMode === 'kanban' && (
            <label style={styles.toggleLabel}>
              Group by
              <select
                value={groupBy}
                onChange={(e) => updatePrefs({ groupBy: e.target.value })}
                style={styles.groupSelect}
              >
                <option value="status">Status</option>
                <option value="priority">Priority</option>
                <option value="project">Project</option>
                <option value="assignee">Assignee</option>
              </select>
            </label>
          )}

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

      <div style={{
        ...styles.listScroll,
        overflowX: viewMode === 'kanban' ? 'auto' : 'hidden',
        padding: viewMode === 'table' ? 0 : viewMode === 'kanban' ? '12px' : '8px 14px',
      }}>
        {loading ? (
          <div style={styles.empty}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={styles.empty}>
            {tasks.length === 0
              ? 'No tasks yet. Press Cmd/Ctrl+K to add one fast, or click + Add task above.'
              : 'No tasks match the current filter.'}
          </div>
        ) : viewMode === 'list' ? (
          <ListView
            tasks={visible}
            compact={compact}
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
        ) : viewMode === 'kanban' ? (
          <KanbanView
            tasks={visible}
            groupBy={groupBy}
            statuses={statuses}
            priorities={priorities}
            projects={projects}
            members={members}
            onUpdate={onUpdate}
            onAssign={onAssign}
            onUnassign={onUnassign}
            onToggleDone={onToggleDone}
            onEdit={startEdit}
          />
        ) : (
          <TableView
            tasks={visible}
            projects={projects}
            members={members}
            onToggleDone={onToggleDone}
            onEdit={startEdit}
            onDelete={onDelete}
          />
        )}
      </div>
    </div>
  );
}

// ── ListView ─────────────────────────────────────────────────────────────────
function ListView({
  tasks, compact, projects, members, workspaceId, currentUserId,
  runningTimer, onToggleDone, onEdit, onDelete, onAssign, onUnassign,
  onStartTimer, onStopTimer,
}) {
  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {tasks.map((t) => (
          <CompactRow
            key={t.id}
            task={t}
            projects={projects}
            members={members}
            currentUserId={currentUserId}
            runningTimer={runningTimer}
            onToggleDone={onToggleDone}
            onEdit={onEdit}
            onStartTimer={onStartTimer}
            onStopTimer={onStopTimer}
          />
        ))}
      </div>
    );
  }
  return (
    <>
      {tasks.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          projects={projects}
          members={members}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          runningTimer={runningTimer}
          onToggleDone={onToggleDone}
          onEdit={onEdit}
          onDelete={onDelete}
          onAssign={onAssign}
          onUnassign={onUnassign}
          onStartTimer={onStartTimer}
          onStopTimer={onStopTimer}
        />
      ))}
    </>
  );
}

// ── CompactRow: dense single-line task row ──────────────────────────────────
function CompactRow({
  task, projects, members, currentUserId, runningTimer,
  onToggleDone, onEdit, onStartTimer, onStopTimer,
}) {
  const projColor = projectColor(task.project, projects);
  const isTracking = runningTimer?.taskId === task.id;
  const overdue = task.dueDate && !task.done && task.dueDate < new Date().toISOString().slice(0, 10);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '5px 0',
      borderBottom: '0.5px solid var(--color-border-tertiary)',
      fontSize: 12,
      opacity: task.done ? 0.55 : 1,
    }}>
      <input
        type="checkbox"
        checked={!!task.done}
        onChange={() => onToggleDone(task.id)}
        style={{ flexShrink: 0, cursor: 'pointer' }}
      />
      <span
        onClick={() => onEdit(task)}
        style={{
          flex: 1,
          minWidth: 0,
          color: task.done ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
          textDecoration: task.done ? 'line-through' : 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
        }}
      >
        {task.title}
      </span>
      {task.project && (
        <span style={{
          fontSize: 10,
          padding: '1px 7px',
          borderRadius: 12,
          background: projColor + '22',
          color: projColor,
          flexShrink: 0,
        }}>
          {task.project}
        </span>
      )}
      {task.outOfScope && (
        <span
          title={task.outOfScopeNotes || (task.outOfScopeHours ? `${task.outOfScopeHours}h` : 'Out of scope')}
          style={{
            fontSize: 9,
            padding: '1px 6px',
            borderRadius: 12,
            background: '#e24b4a22',
            color: '#e24b4a',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          ⚠ OOS{task.outOfScopeHours ? ` · ${task.outOfScopeHours}h` : ''}
        </span>
      )}
      {task.priority && (
        <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
          {task.priority}
        </span>
      )}
      {task.dueDate && (
        <span style={{
          fontSize: 10,
          color: overdue ? '#e24b4a' : 'var(--color-text-tertiary)',
          flexShrink: 0,
        }}>
          {task.dueDate}
        </span>
      )}
      {!task.done && (
        isTracking ? (
          <button
            onClick={onStopTimer}
            style={{
              padding: '1px 8px', fontSize: 10, background: '#e24b4a',
              color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Stop
          </button>
        ) : (
          <button
            onClick={() => onStartTimer(task)}
            style={{
              padding: '1px 8px', fontSize: 10, background: 'transparent',
              border: '0.5px solid #534AB7', color: '#534AB7', borderRadius: 4,
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            Track
          </button>
        )
      )}
    </div>
  );
}

// ── KanbanView ──────────────────────────────────────────────────────────────
function KanbanView({
  tasks, groupBy, statuses, priorities, projects, members,
  onUpdate, onAssign, onUnassign, onToggleDone, onEdit,
}) {
  // Determine the columns for the chosen groupBy
  const columns = useMemo(() => {
    if (groupBy === 'status') {
      const list = (statuses && statuses.length > 0) ? statuses : ['To do', 'In progress', 'Done'];
      // Always include any status values found in tasks but not in settings, at the end
      const seen = new Set(list);
      for (const t of tasks) {
        const s = t.status || (t.done ? 'Done' : 'To do');
        if (!seen.has(s)) {
          list.push(s);
          seen.add(s);
        }
      }
      return list.map((s) => ({ key: s, label: s }));
    }
    if (groupBy === 'priority') {
      const list = (priorities && priorities.length > 0) ? [...priorities] : ['High', 'Medium', 'Low'];
      const seen = new Set(list);
      for (const t of tasks) {
        if (t.priority && !seen.has(t.priority)) {
          list.push(t.priority);
          seen.add(t.priority);
        }
      }
      return [
        ...list.map((p) => ({ key: p, label: p })),
        { key: '', label: 'No priority' },
      ];
    }
    if (groupBy === 'project') {
      const seen = new Set();
      const list = [];
      for (const p of projects || []) {
        if (!p.archived) {
          list.push({ key: p.name, label: p.name });
          seen.add(p.name);
        }
      }
      // Tasks with a project name not in the projects list (legacy) — append
      for (const t of tasks) {
        if (t.project && !seen.has(t.project)) {
          list.push({ key: t.project, label: t.project });
          seen.add(t.project);
        }
      }
      list.push({ key: '', label: 'No project' });
      return list;
    }
    if (groupBy === 'assignee') {
      const list = (members || []).map((m) => ({
        key: m.id,
        label: m.email || `User ${m.id.slice(0, 8)}…`,
      }));
      list.push({ key: '', label: 'Unassigned' });
      return list;
    }
    return [];
  }, [groupBy, statuses, priorities, projects, members, tasks]);

  // Map task → column key for the selected groupBy
  const keyForTask = (t) => {
    if (groupBy === 'status') return t.status || (t.done ? 'Done' : 'To do');
    if (groupBy === 'priority') return t.priority || '';
    if (groupBy === 'project') return t.project || '';
    if (groupBy === 'assignee') {
      // First assignee, or '' if none
      return (t.assignees && t.assignees[0]) || '';
    }
    return '';
  };

  // Group tasks
  const grouped = useMemo(() => {
    const m = {};
    for (const c of columns) m[c.key] = [];
    for (const t of tasks) {
      const k = keyForTask(t);
      if (!(k in m)) m[k] = []; // safety net
      m[k].push(t);
    }
    return m;
  }, [tasks, columns, groupBy]);

  // Drag and drop — when dropped, update the task's field accordingly
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);

  const handleDrop = async (columnKey, taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const currentKey = keyForTask(task);
    if (currentKey === columnKey) return;

    if (groupBy === 'status') {
      // Moving a task to "Done" should also flip done flag
      const isDoneCol = columnKey.toLowerCase() === 'done';
      await onUpdate(task.id, { status: columnKey, ...(isDoneCol ? { done: true } : {}) });
    } else if (groupBy === 'priority') {
      await onUpdate(task.id, { priority: columnKey });
    } else if (groupBy === 'project') {
      await onUpdate(task.id, { project: columnKey });
    } else if (groupBy === 'assignee') {
      // Replace the assignees array with a single value (or empty)
      if (columnKey) {
        await onAssign(task.id, columnKey);
      } else {
        // Drop into Unassigned: remove all assignees
        for (const uid of task.assignees || []) {
          await onUnassign(task.id, uid);
        }
      }
    }
  };

  return (
    <div style={{ display: 'flex', gap: 10, minWidth: 'fit-content', alignItems: 'flex-start' }}>
      {columns.map((col) => {
        const colTasks = grouped[col.key] || [];
        const isOver = dragOverKey === col.key;
        return (
          <div
            key={col.key || '__empty__'}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverKey(col.key);
            }}
            onDragLeave={() => setDragOverKey(null)}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              if (id) handleDrop(col.key, id);
              setDragOverKey(null);
              setDraggingId(null);
            }}
            style={{
              minWidth: 240,
              maxWidth: 280,
              flex: '0 0 auto',
              background: isOver ? '#534AB711' : 'var(--color-background-secondary)',
              border: `0.5px ${isOver ? 'dashed #534AB7' : 'solid var(--color-border-tertiary)'}`,
              borderRadius: 10,
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxHeight: '100%',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 6px 6px',
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {col.label || '(none)'}
              </span>
              <span style={{
                fontSize: 10,
                color: 'var(--color-text-secondary)',
                background: 'var(--color-background-tertiary)',
                padding: '0 7px',
                borderRadius: 8,
                minWidth: 16,
                textAlign: 'center',
              }}>
                {colTasks.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', minHeight: 40 }}>
              {colTasks.map((t) => (
                <KanbanCard
                  key={t.id}
                  task={t}
                  projects={projects}
                  isDragging={draggingId === t.id}
                  onDragStart={() => setDraggingId(t.id)}
                  onDragEnd={() => setDraggingId(null)}
                  onClick={() => onEdit(t)}
                  onToggleDone={onToggleDone}
                />
              ))}
              {colTasks.length === 0 && (
                <div style={{
                  fontSize: 10,
                  color: 'var(--color-text-tertiary)',
                  fontStyle: 'italic',
                  padding: 10,
                  textAlign: 'center',
                }}>
                  Drop here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({ task, projects, isDragging, onDragStart, onDragEnd, onClick, onToggleDone }) {
  const projColor = projectColor(task.project, projects);
  const overdue = task.dueDate && !task.done && task.dueDate < new Date().toISOString().slice(0, 10);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        background: 'var(--bg-surface)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderLeft: `3px solid ${projColor}`,
        borderRadius: 6,
        padding: 8,
        cursor: 'grab',
        opacity: isDragging ? 0.4 : task.done ? 0.55 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <input
          type="checkbox"
          checked={!!task.done}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggleDone(task.id)}
          style={{ marginTop: 2, flexShrink: 0, cursor: 'pointer' }}
        />
        <div style={{
          flex: 1,
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--color-text-primary)',
          textDecoration: task.done ? 'line-through' : 'none',
          lineHeight: 1.4,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        }}>
          {task.title}
        </div>
      </div>
      {(task.project || task.priority || task.dueDate || task.outOfScope) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', paddingLeft: 22 }}>
          {task.outOfScope && (
            <span
              title={task.outOfScopeNotes || (task.outOfScopeHours ? `${task.outOfScopeHours}h` : 'Out of scope')}
              style={{
                fontSize: 9,
                padding: '1px 6px',
                borderRadius: 12,
                background: '#e24b4a22',
                color: '#e24b4a',
                fontWeight: 600,
              }}
            >
              ⚠ OOS{task.outOfScopeHours ? ` · ${task.outOfScopeHours}h` : ''}
            </span>
          )}
          {task.project && (
            <span style={{
              fontSize: 9,
              padding: '1px 7px',
              borderRadius: 12,
              background: projColor + '22',
              color: projColor,
              fontWeight: 500,
            }}>
              {task.project}
            </span>
          )}
          {task.priority && (
            <span style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>
              {task.priority}
            </span>
          )}
          {task.dueDate && (
            <span style={{
              fontSize: 9,
              color: overdue ? '#e24b4a' : 'var(--color-text-tertiary)',
              fontWeight: overdue ? 600 : 400,
            }}>
              {task.dueDate}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── TableView ────────────────────────────────────────────────────────────────
function TableView({ tasks, projects, members, onToggleDone, onEdit, onDelete }) {
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc'); // asc | desc

  const sorted = useMemo(() => {
    const copy = [...tasks];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av == null) av = '';
      if (bv == null) bv = '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return copy;
  }, [tasks, sortKey, sortDir]);

  const setSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const arrow = (key) =>
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const headerStyle = {
    textAlign: 'left',
    padding: '8px 10px',
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    background: 'var(--color-background-secondary)',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };
  const cellStyle = {
    padding: '8px 10px',
    fontSize: 12,
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    color: 'var(--color-text-primary)',
    verticalAlign: 'middle',
  };

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ ...headerStyle, width: 30, cursor: 'default' }}></th>
          <th style={headerStyle} onClick={() => setSort('title')}>Title{arrow('title')}</th>
          <th style={headerStyle} onClick={() => setSort('project')}>Project{arrow('project')}</th>
          <th style={headerStyle} onClick={() => setSort('priority')}>Priority{arrow('priority')}</th>
          <th style={headerStyle} onClick={() => setSort('status')}>Status{arrow('status')}</th>
          <th style={headerStyle} onClick={() => setSort('dueDate')}>Due{arrow('dueDate')}</th>
          <th style={headerStyle} onClick={() => setSort('outOfScope')}>OOS{arrow('outOfScope')}</th>
          <th style={{ ...headerStyle, cursor: 'default' }}>Tags</th>
          <th style={{ ...headerStyle, width: 60, cursor: 'default' }}></th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((t) => {
          const projColor = projectColor(t.project, projects);
          const overdue = t.dueDate && !t.done && t.dueDate < new Date().toISOString().slice(0, 10);
          return (
            <tr
              key={t.id}
              style={{ opacity: t.done ? 0.55 : 1 }}
            >
              <td style={cellStyle}>
                <input
                  type="checkbox"
                  checked={!!t.done}
                  onChange={() => onToggleDone(t.id)}
                  style={{ cursor: 'pointer' }}
                />
              </td>
              <td
                style={{
                  ...cellStyle,
                  cursor: 'pointer',
                  textDecoration: t.done ? 'line-through' : 'none',
                  fontWeight: 500,
                }}
                onClick={() => onEdit(t)}
              >
                {t.title}
              </td>
              <td style={cellStyle}>
                {t.project && (
                  <span style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: projColor + '22',
                    color: projColor,
                    fontWeight: 500,
                  }}>
                    {t.project}
                  </span>
                )}
              </td>
              <td style={cellStyle}>{t.priority || ''}</td>
              <td style={cellStyle}>{t.status || (t.done ? 'Done' : '')}</td>
              <td style={{ ...cellStyle, color: overdue ? '#e24b4a' : 'var(--color-text-primary)', fontWeight: overdue ? 600 : 400 }}>
                {t.dueDate || ''}
              </td>
              <td style={cellStyle} title={t.outOfScopeNotes || ''}>
                {t.outOfScope ? (
                  <span style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: '#e24b4a22',
                    color: '#e24b4a',
                    fontWeight: 600,
                  }}>
                    ⚠{t.outOfScopeHours ? ` ${t.outOfScopeHours}h` : ''}
                  </span>
                ) : ''}
              </td>
              <td style={cellStyle}>
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  {(t.tags || []).join(', ')}
                </span>
              </td>
              <td style={cellStyle}>
                <button
                  onClick={() => onEdit(t)}
                  style={{
                    padding: '3px 8px',
                    fontSize: 10,
                    background: 'transparent',
                    border: '0.5px solid var(--color-border-primary)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Edit
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const styles = {
  wrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-surface)',
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
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  viewSwitch: {
    display: 'flex',
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 8,
    padding: 2,
    gap: 1,
  },
  viewBtn: {
    padding: '4px 10px',
    fontSize: 11,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 400,
  },
  viewBtnActive: {
    background: 'var(--bg-surface)',
    color: 'var(--color-text-primary)',
    fontWeight: 500,
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  groupSelect: {
    padding: '3px 6px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    fontSize: 11,
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  listScroll: { flex: 1, overflowY: 'auto' },
  empty: {
    padding: 32,
    textAlign: 'center',
    fontSize: 13,
    color: 'var(--color-text-secondary)',
  },
};
