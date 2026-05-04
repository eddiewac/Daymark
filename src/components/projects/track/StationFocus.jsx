import { useState } from 'react';
import { projectColor } from '../../../lib/constants.js';
import CommsTab from '../CommsTab.jsx';
import TaskForm from '../../tasks/TaskForm.jsx';

export default function StationFocus({
  project,
  deliverable,
  station,
  allProjects,
  tasks,
  members,
  workspaceId,
  categories,
  priorities,
  statuses,
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
  const [editingTask, setEditingTask] = useState(null); // task object being edited in modal
  const [datePickerId, setDatePickerId] = useState(null); // task id whose date picker is open
  const color = projectColor(project.name, allProjects);

  // Tasks linked to this station via stationId
  const stationTasks = (tasks || []).filter((t) => t.stationId === station.id);
  const doneCount = stationTasks.filter((t) => t.done).length;

  // ── Next-station suggestion ─────────────────────────────────────────────
  // When this station is marked done, surface a small prompt for the next
  // station if it has no tasks yet.
  const allStations = deliverable?.stations || [];
  const stationIdx = allStations.findIndex((s) => s.id === station.id);
  const nextStation =
    stationIdx >= 0 && stationIdx + 1 < allStations.length
      ? allStations[stationIdx + 1]
      : null;
  const nextHasTasks =
    nextStation &&
    (tasks || []).some((t) => t.stationId === nextStation.id);
  const showNextPrompt = station.done && nextStation && !nextHasTasks;
  const [nextTaskDraft, setNextTaskDraft] = useState('');
  const [nextDismissed, setNextDismissed] = useState(false);

  const addTaskToNext = async () => {
    if (!nextTaskDraft.trim() || !nextStation) return;
    await onAddTask({
      title: nextTaskDraft.trim(),
      project: project?.name || '',
      stationId: nextStation.id,
    });
    setNextTaskDraft('');
  };

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

            {/* Next-station suggestion */}
            {showNextPrompt && !nextDismissed && (
              <div style={nextPromptStyles.box}>
                <div style={nextPromptStyles.header}>
                  <span style={nextPromptStyles.headerLabel}>
                    Next: <strong>{nextStation.name}</strong>
                  </span>
                  <button
                    onClick={() => setNextDismissed(true)}
                    style={nextPromptStyles.dismiss}
                    title="Dismiss"
                  >
                    ×
                  </button>
                </div>
                <div style={nextPromptStyles.hint}>
                  Add the first task for this station — quickly captures momentum.
                </div>
                <div style={nextPromptStyles.row}>
                  <input
                    value={nextTaskDraft}
                    onChange={(e) => setNextTaskDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addTaskToNext();
                      if (e.key === 'Escape') setNextDismissed(true);
                    }}
                    placeholder={`Task for "${nextStation.name}"…`}
                    style={nextPromptStyles.input}
                    autoFocus
                  />
                  <button
                    onClick={addTaskToNext}
                    disabled={!nextTaskDraft.trim()}
                    style={{
                      ...nextPromptStyles.addBtn,
                      background: color,
                      opacity: nextTaskDraft.trim() ? 1 : 0.4,
                      cursor: nextTaskDraft.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
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
                  const today = new Date().toISOString().slice(0, 10);
                  const overdue = t.dueDate && !t.done && t.dueDate < today;
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

                      {/* OOS chip if set */}
                      {t.outOfScope && (
                        <span
                          title={
                            t.outOfScopeNotes
                              ? `Out of scope — ${t.outOfScopeNotes}${t.outOfScopeHours ? ` (${t.outOfScopeHours}h)` : ''}`
                              : 'Out of scope'
                          }
                          style={enrichedStyles.oosChip}
                        >
                          ⚠ OOS{t.outOfScopeHours ? ` · ${t.outOfScopeHours}h` : ''}
                        </span>
                      )}

                      {/* Due date chip if set */}
                      {t.dueDate && (
                        <span
                          title={overdue ? 'Overdue' : 'Due date'}
                          style={{
                            ...enrichedStyles.dueChip,
                            color: overdue ? '#e24b4a' : 'var(--color-text-secondary)',
                            background: overdue ? '#e24b4a15' : 'var(--color-background-tertiary)',
                            fontWeight: overdue ? 600 : 400,
                          }}
                        >
                          {t.dueDate}
                        </span>
                      )}

                      {/* Inline date picker (popover) */}
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={() =>
                            setDatePickerId(datePickerId === t.id ? null : t.id)
                          }
                          style={enrichedStyles.iconBtn}
                          title="Set due date"
                        >
                          📅
                        </button>
                        {datePickerId === t.id && (
                          <div style={enrichedStyles.datePopover}>
                            <input
                              type="date"
                              value={t.dueDate || ''}
                              onChange={(e) => {
                                onUpdateTask(t.id, { dueDate: e.target.value });
                              }}
                              style={enrichedStyles.dateInput}
                            />
                            <div style={enrichedStyles.dateBtnRow}>
                              {t.dueDate && (
                                <button
                                  onClick={() => {
                                    onUpdateTask(t.id, { dueDate: '' });
                                    setDatePickerId(null);
                                  }}
                                  style={enrichedStyles.dateClearBtn}
                                >
                                  Clear
                                </button>
                              )}
                              <button
                                onClick={() => setDatePickerId(null)}
                                style={enrichedStyles.dateDoneBtn}
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Assign button — always show if workspace + at least one member */}
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

                      {/* Edit pencil — opens full TaskForm modal */}
                      <button
                        onClick={() => setEditingTask(t)}
                        style={enrichedStyles.iconBtn}
                        title="Edit task (full editor)"
                      >
                        ✎
                      </button>

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

      {/* Edit task modal — uses the full TaskForm */}
      {editingTask && (
        <div
          style={enrichedStyles.modalBackdrop}
          onClick={() => setEditingTask(null)}
        >
          <div
            style={enrichedStyles.modalDialog}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={enrichedStyles.modalHeader}>
              <span style={enrichedStyles.modalTitle}>Edit task</span>
              <button
                onClick={() => setEditingTask(null)}
                style={enrichedStyles.modalClose}
              >
                ×
              </button>
            </div>
            <TaskForm
              initialTask={editingTask}
              projects={allProjects}
              categories={categories}
              priorities={priorities}
              statuses={statuses}
              members={members}
              workspaceId={workspaceId}
              onSave={(patch) => {
                onUpdateTask(editingTask.id, patch);
                setEditingTask(null);
              }}
              onCancel={() => setEditingTask(null)}
            />
          </div>
        </div>
      )}
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

const enrichedStyles = {
  oosChip: {
    fontSize: 9,
    padding: '1px 6px',
    borderRadius: 12,
    background: '#e24b4a22',
    color: '#e24b4a',
    fontWeight: 600,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  dueChip: {
    fontSize: 10,
    padding: '1px 7px',
    borderRadius: 12,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  iconBtn: {
    width: 24,
    height: 24,
    background: 'transparent',
    border: 'none',
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    borderRadius: 4,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePopover: {
    position: 'absolute',
    top: 28,
    right: 0,
    background: '#fff',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 8,
    padding: 8,
    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
    zIndex: 50,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  dateInput: {
    padding: '5px 8px',
    fontSize: 12,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    outline: 'none',
  },
  dateBtnRow: {
    display: 'flex',
    gap: 4,
    justifyContent: 'flex-end',
  },
  dateClearBtn: {
    padding: '3px 10px',
    fontSize: 10,
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    cursor: 'pointer',
  },
  dateDoneBtn: {
    padding: '3px 12px',
    fontSize: 10,
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    overflow: 'auto',
    padding: '40px 20px 80px',
  },
  modalDialog: {
    background: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 600,
    boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    background: 'var(--color-background-secondary)',
  },
  modalTitle: { fontSize: 13, fontWeight: 600 },
  modalClose: {
    width: 28,
    height: 28,
    background: 'transparent',
    border: 'none',
    fontSize: 22,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
};

const nextPromptStyles = {
  box: {
    marginTop: 12,
    padding: 12,
    background: '#534AB708',
    border: '0.5px dashed #534AB744',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  headerLabel: {
    fontSize: 11,
    color: '#534AB7',
    flex: 1,
  },
  dismiss: {
    width: 22,
    height: 22,
    background: 'transparent',
    border: 'none',
    fontSize: 14,
    color: 'var(--color-text-tertiary)',
    cursor: 'pointer',
    borderRadius: 4,
  },
  hint: {
    fontSize: 10,
    color: 'var(--color-text-secondary)',
    fontStyle: 'italic',
  },
  row: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: '5px 10px',
    fontSize: 12,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    outline: 'none',
  },
  addBtn: {
    padding: '5px 14px',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
  },
};
