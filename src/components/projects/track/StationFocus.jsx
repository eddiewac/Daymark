import { useState } from 'react';
import { projectColor } from '../../../lib/constants.js';
import CommsTab from '../CommsTab.jsx';

export default function StationFocus({
  project,
  deliverable,
  station,
  allProjects,
  tasks,
  members,
  workspaceId,
  onUpdateStation,
  onClose,
  onAddTask,
  onUpdateTask,
  onToggleTask,
  onDeleteTask,
  onAssignTask,
}) {
  const [tab, setTab] = useState('details');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [assigningId, setAssigningId] = useState(null);
  const color = projectColor(project.name, allProjects);

  // Tasks linked to this station via stationId
  const stationTasks = (tasks || []).filter((t) => t.stationId === station.id);
  const doneCount = stationTasks.filter((t) => t.done).length;

  const updateStation = (patch) => onUpdateStation({ ...station, ...patch });

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    const created = await onAddTask({
      title: newTaskTitle.trim(),
      project: project.name,
      stationId: station.id,
      assignedToId: newTaskAssignee || '',
      assignedToEmail: newTaskAssignee
        ? members?.find((m) => m.id === newTaskAssignee)?.email || ''
        : '',
    });
    setNewTaskTitle('');
    setNewTaskAssignee('');
  };

  return (
    <div style={styles.wrap}>
      {/* Header */}
      <div style={{ ...styles.header, borderTop: `3px solid ${color}` }}>
        <div style={styles.crumbs}>
          <span style={{ color }}>{project.name}</span>
          <span style={styles.crumbSep}>›</span>
          <span style={styles.crumbDeliv}>{deliverable.name}</span>
          <span style={styles.crumbSep}>›</span>
          <span style={styles.crumbStation}>{station.name}</span>
        </div>
        <button onClick={onClose} style={styles.closeBtn} title="Back to overview">
          ×
        </button>
      </div>

      {/* Sub-tabs */}
      <div style={styles.tabs}>
        {[
          { key: 'details', label: 'Details' },
          {
            key: 'tasks',
            label: `Tasks${stationTasks.length ? ` (${doneCount}/${stationTasks.length})` : ''}`,
          },
          {
            key: 'comms',
            label: `✉ Comms${(station.comms || []).length ? ` (${(station.comms || []).length})` : ''}`,
          },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              ...styles.tab,
              ...(tab === t.key ? { ...styles.tabActive, borderColor: color, color } : {}),
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={styles.body}>
        {tab === 'details' && (
          <div style={styles.detailGrid}>
            <div style={styles.fieldRow}>
              <div style={styles.field}>
                <label style={styles.label}>Station name</label>
                <input
                  value={station.name}
                  onChange={(e) => updateStation({ name: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Owner</label>
                <input
                  value={station.owner || ''}
                  onChange={(e) => updateStation({ owner: e.target.value })}
                  placeholder="Initials or name"
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.fieldRow}>
              <div style={styles.field}>
                <label style={styles.label}>Start date</label>
                <input
                  type="date"
                  value={station.startDate || ''}
                  onChange={(e) => updateStation({ startDate: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Target date</label>
                <input
                  type="date"
                  value={station.targetDate || ''}
                  onChange={(e) => updateStation({ targetDate: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Est hours</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={station.estHours || 0}
                  onChange={(e) =>
                    updateStation({ estHours: parseFloat(e.target.value) || 0 })
                  }
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Notes</label>
              <textarea
                value={station.notes || ''}
                onChange={(e) => updateStation({ notes: e.target.value })}
                placeholder="Version history, comments, anything relevant…"
                rows={6}
                style={styles.textarea}
              />
            </div>

            <div style={styles.completeRow}>
              <button
                onClick={() =>
                  updateStation({
                    done: !station.done,
                    completedAt: !station.done ? new Date().toISOString() : null,
                  })
                }
                style={{
                  ...styles.completeBtn,
                  background: station.done ? '#1d9e7522' : color,
                  color: station.done ? '#1d9e75' : '#fff',
                  border: station.done ? '0.5px solid #1d9e75' : 'none',
                }}
              >
                {station.done ? '✓ Completed — click to reopen' : 'Mark station complete →'}
              </button>
              {station.done && station.completedAt && (
                <div style={styles.completedAt}>
                  Completed {new Date(station.completedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'tasks' && (
          <div style={styles.tasksWrap}>
            <div style={styles.addTaskRow}>
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                placeholder="Add a task to this station…"
                style={styles.taskInput}
              />
              {workspaceId && members && members.length > 0 && (
                <select
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  style={styles.assignSelect}
                  title="Assign to"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.email?.split('@')[0] || m.id.slice(0, 6)}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={addTask}
                style={{ ...styles.addTaskBtn, background: color }}
              >
                Add
              </button>
            </div>

            {stationTasks.length === 0 ? (
              <div style={styles.empty}>
                No tasks attached to this station yet.
              </div>
            ) : (
              <div style={styles.taskList}>
                {stationTasks.map((t) => {
                  const assignee = members?.find((m) => m.id === t.assignedToId);
                  return (
                    <div key={t.id} style={styles.taskRow}>
                      <button
                        onClick={() => onToggleTask(t.id)}
                        style={{
                          ...styles.check,
                          background: t.done ? color : 'transparent',
                          borderColor: t.done ? color : 'var(--color-border-primary)',
                        }}
                      >
                        {t.done && (
                          <svg width={9} height={9} viewBox="0 0 9 9">
                            <polyline
                              points="1.5,5 4,7.5 8.5,2"
                              fill="none"
                              stroke="#fff"
                              strokeWidth="1.6"
                            />
                          </svg>
                        )}
                      </button>
                      <input
                        value={t.title}
                        onChange={(e) =>
                          onUpdateTask(t.id, { title: e.target.value })
                        }
                        style={{
                          ...styles.taskTitle,
                          textDecoration: t.done ? 'line-through' : 'none',
                          opacity: t.done ? 0.6 : 1,
                        }}
                      />
                      {workspaceId && members && members.length > 0 && (
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() =>
                              setAssigningId(assigningId === t.id ? null : t.id)
                            }
                            style={{
                              ...styles.assigneeBtn,
                              ...(assignee
                                ? { background: '#1d9e7522', color: '#1d9e75' }
                                : {}),
                            }}
                            title={
                              assignee
                                ? `Assigned to ${assignee.email}`
                                : 'Unassigned — click to assign'
                            }
                          >
                            👤 {assignee ? assignee.email?.split('@')[0] : ''}
                          </button>
                          {assigningId === t.id && (
                            <div style={styles.assignMenu}>
                              <button
                                style={styles.assignItem}
                                onClick={() => {
                                  onAssignTask(t.id, null, null);
                                  setAssigningId(null);
                                }}
                              >
                                Unassigned
                              </button>
                              {members.map((m) => (
                                <button
                                  key={m.id}
                                  style={styles.assignItem}
                                  onClick={() => {
                                    onAssignTask(t.id, m.id, m.email);
                                    setAssigningId(null);
                                  }}
                                >
                                  {m.email || m.id.slice(0, 8)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => onDeleteTask(t.id)}
                        style={styles.taskDelete}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'comms' && (
          <CommsTab station={station} onUpdateStation={onUpdateStation} />
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
    padding: '14px 18px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  crumbs: {
    flex: 1,
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 500,
  },
  crumbSep: { color: 'var(--color-text-tertiary)' },
  crumbDeliv: { color: 'var(--color-text-primary)' },
  crumbStation: { color: 'var(--color-text-primary)', fontWeight: 600 },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 24,
    color: 'var(--color-text-secondary)',
    width: 32,
    height: 32,
    cursor: 'pointer',
  },
  tabs: {
    display: 'flex',
    gap: 0,
    padding: '0 18px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    background: '#fff',
  },
  tab: {
    padding: '8px 14px',
    fontSize: 12,
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  tabActive: { fontWeight: 500 },
  body: { flex: 1, overflowY: 'auto', padding: 18 },
  detailGrid: { display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720 },
  fieldRow: { display: 'flex', gap: 10 },
  field: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  label: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
  },
  input: {
    padding: '6px 10px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    fontSize: 13,
    background: '#fff',
    outline: 'none',
  },
  textarea: {
    padding: '8px 10px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    fontSize: 13,
    background: '#fff',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.5,
  },
  completeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  completeBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    fontWeight: 500,
    fontSize: 13,
    cursor: 'pointer',
  },
  completedAt: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
  },
  tasksWrap: { display: 'flex', flexDirection: 'column', gap: 10 },
  addTaskRow: { display: 'flex', gap: 6 },
  taskInput: {
    flex: 1,
    padding: '6px 10px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    fontSize: 13,
    background: '#fff',
    outline: 'none',
  },
  addTaskBtn: {
    padding: '6px 14px',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  empty: {
    padding: 16,
    textAlign: 'center',
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    background: 'var(--color-background-secondary)',
    borderRadius: 8,
  },
  taskList: { display: 'flex', flexDirection: 'column', gap: 4 },
  taskRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 10px',
    background: 'var(--color-background-tertiary)',
    borderRadius: 6,
  },
  check: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    border: '1.5px solid',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  taskTitle: {
    flex: 1,
    fontSize: 13,
    border: 'none',
    background: 'transparent',
    outline: 'none',
    padding: '2px 4px',
  },
  taskDelete: {
    width: 22,
    height: 22,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-tertiary)',
    fontSize: 14,
    cursor: 'pointer',
  },
  assignSelect: {
    padding: '6px 8px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    background: '#fff',
    fontSize: 12,
    outline: 'none',
    minWidth: 110,
  },
  assigneeBtn: {
    padding: '3px 8px',
    border: '0.5px solid var(--color-border-secondary)',
    background: 'var(--color-background-secondary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 12,
    fontSize: 11,
    cursor: 'pointer',
  },
  assignMenu: {
    position: 'absolute',
    right: 0,
    top: 28,
    background: '#fff',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    minWidth: 200,
    padding: 4,
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
  assignItem: {
    display: 'block',
    width: '100%',
    padding: '6px 10px',
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    textAlign: 'left',
    fontSize: 12,
    cursor: 'pointer',
  },
};
