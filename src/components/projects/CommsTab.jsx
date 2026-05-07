import { useState } from 'react';
import { uid } from '../../lib/utils.js';

const PILL_COLOR_CYCLE = [
  'var(--accent)', '#D85A30', '#0F6E56', '#185FA5',
  '#BA7517', '#D4537E', '#378ADD', '#639922', '#888780',
];

export const DEFAULT_COMM_PILLS = [
  { label: 'Adjudication / handoff', color: 'var(--accent)', needsReply: true },
  { label: 'Chaser', color: '#ef9f27', needsReply: true },
  { label: 'Client review request', color: '#D85A30', needsReply: true },
  { label: 'Approval sent', color: '#1d9e75', needsReply: false },
  { label: 'Feedback received', color: '#0F6E56', needsReply: false },
  { label: 'Internal review', color: '#185FA5', needsReply: true },
  { label: 'Sign-off', color: '#639922', needsReply: false },
];

function daysSince(ts) {
  return Math.floor((Date.now() - ts) / 86400000);
}

export default function CommsTab({ station, onUpdateStation }) {
  const comms = station.comms || [];
  const pills = station.commPills || DEFAULT_COMM_PILLS;

  const [newLabel, setNewLabel] = useState('');
  const [addingPill, setAddingPill] = useState(false);
  const [needsReplyNew, setNeedsReplyNew] = useState(true);
  const [editingPills, setEditingPills] = useState(false);

  const updatePills = (newPills) =>
    onUpdateStation({ ...station, commPills: newPills });

  const logComm = (label, needsReply) => {
    const pill = pills.find((p) => p.label === label);
    const col =
      pill?.color || PILL_COLOR_CYCLE[pills.length % PILL_COLOR_CYCLE.length];
    onUpdateStation({
      ...station,
      comms: [
        ...comms,
        {
          id: uid(),
          type: label,
          color: col,
          needsReply: needsReply ?? pill?.needsReply ?? true,
          sentAt: Date.now(),
          replyReceived: false,
          replyAt: null,
        },
      ],
    });
  };

  const addPill = () => {
    if (!newLabel.trim()) return;
    const col = PILL_COLOR_CYCLE[pills.length % PILL_COLOR_CYCLE.length];
    updatePills([
      ...pills,
      { label: newLabel.trim(), color: col, needsReply: needsReplyNew },
    ]);
    setNewLabel('');
    setAddingPill(false);
    setNeedsReplyNew(true);
  };

  const deletePill = (label) =>
    updatePills(pills.filter((p) => p.label !== label));

  const markReply = (id) =>
    onUpdateStation({
      ...station,
      comms: comms.map((c) =>
        c.id === id ? { ...c, replyReceived: true, replyAt: Date.now() } : c
      ),
    });

  const deleteComm = (id) =>
    onUpdateStation({
      ...station,
      comms: comms.filter((c) => c.id !== id),
    });

  const awaitingReply = comms.filter((c) => c.needsReply && !c.replyReceived);
  const longest = awaitingReply.length
    ? Math.max(...awaitingReply.map((c) => daysSince(c.sentAt)))
    : null;

  return (
    <div style={styles.wrap}>
      {/* Awaiting reply banner */}
      {awaitingReply.length > 0 && (
        <div style={styles.awaitingBox}>
          <span style={{ fontSize: 16 }}>⏳</span>
          <div style={{ flex: 1 }}>
            <div style={styles.awaitingTitle}>
              {awaitingReply.length} awaiting reply
            </div>
            {longest > 0 && (
              <div style={styles.awaitingSub}>
                Longest wait: {longest} day{longest !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pills bar */}
      <div style={styles.pillsBlock}>
        <div style={styles.pillsHeader}>
          <span style={styles.pillsHeaderText}>Log communication</span>
          <button
            onClick={() => setEditingPills((v) => !v)}
            style={styles.editPillsBtn}
          >
            {editingPills ? 'Done editing' : 'Edit pills'}
          </button>
        </div>
        <div style={styles.pillsRow}>
          {pills.map((pill) => (
            <div key={pill.label} style={{ display: 'flex' }}>
              <button
                onClick={() =>
                  !editingPills && logComm(pill.label, pill.needsReply)
                }
                style={{
                  padding: '4px 10px',
                  borderRadius: editingPills ? '20px 0 0 20px' : 20,
                  border: `0.5px solid ${pill.color}`,
                  background: pill.color + '18',
                  color: pill.color,
                  cursor: editingPills ? 'default' : 'pointer',
                  fontSize: 11,
                  fontWeight: 500,
                  borderRight: editingPills ? 'none' : `0.5px solid ${pill.color}`,
                }}
              >
                {!editingPills && '+ '}
                {pill.label}
                {pill.needsReply ? ' ↩' : ''}
              </button>
              {editingPills && (
                <button
                  onClick={() => deletePill(pill.label)}
                  style={{
                    padding: '4px 7px',
                    borderRadius: '0 20px 20px 0',
                    border: `0.5px solid ${pill.color}`,
                    background: pill.color + '18',
                    color: pill.color,
                    cursor: 'pointer',
                    fontSize: 12,
                    lineHeight: 1,
                    borderLeft: 'none',
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {addingPill ? (
            <div style={styles.addPillRow}>
              <input
                autoFocus
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addPill();
                  if (e.key === 'Escape') setAddingPill(false);
                }}
                placeholder="Label…"
                style={styles.pillInput}
              />
              <label style={styles.pillCheckLabel}>
                <input
                  type="checkbox"
                  checked={needsReplyNew}
                  onChange={(e) => setNeedsReplyNew(e.target.checked)}
                />
                needs reply
              </label>
              <button onClick={addPill} style={styles.addPillSave}>
                Add
              </button>
              <button
                onClick={() => setAddingPill(false)}
                style={styles.addPillCancel}
              >
                ×
              </button>
            </div>
          ) : (
            <button onClick={() => setAddingPill(true)} style={styles.newPillBtn}>
              + New pill
            </button>
          )}
        </div>
        {editingPills && (
          <div style={styles.editHint}>
            ↩ = reply expected · Click × to remove a pill
          </div>
        )}
      </div>

      {/* Log */}
      {!comms.length ? (
        <div style={styles.emptyLog}>No communications logged yet</div>
      ) : (
        <div style={styles.logList}>
          {[...comms]
            .sort((a, b) => b.sentAt - a.sentAt)
            .map((comm) => {
              const col = comm.color || PILL_COLOR_CYCLE[0];
              const days = daysSince(comm.sentAt);
              const today = new Date().toISOString().slice(0, 10);
              const expectOverdue =
                comm.expectReplyBy &&
                !comm.replyReceived &&
                comm.expectReplyBy < today;
              // Without expectReplyBy: fall back to >2 day rule
              const overdue =
                comm.needsReply &&
                !comm.replyReceived &&
                (expectOverdue || (!comm.expectReplyBy && days > 2));
              return (
                <div key={comm.id} style={styles.logRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.logTopRow}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 9px',
                          borderRadius: 20,
                          background: col + '22',
                          color: col,
                          fontWeight: 500,
                        }}
                      >
                        {comm.type}
                      </span>
                      <span style={styles.logDate}>
                        {days === 0
                          ? 'today'
                          : days === 1
                          ? 'yesterday'
                          : `${days}d ago`}
                      </span>
                      {comm.needsReply && !comm.replyReceived && (
                        <span
                          style={{
                            ...styles.waitingBadge,
                            color: overdue ? '#e24b4a' : '#ef9f27',
                            background:
                              (overdue ? '#e24b4a' : '#ef9f27') + '22',
                          }}
                        >
                          {overdue ? '⚠' : '⏳'}{' '}
                          {expectOverdue
                            ? 'reply overdue'
                            : 'awaiting reply'}
                        </span>
                      )}
                      {comm.replyReceived && (
                        <span style={styles.repliedBadge}>
                          ✓ replied {daysSince(comm.replyAt)}d ago
                        </span>
                      )}
                    </div>
                    {/* Expect-reply control (only for needs-reply, not yet received) */}
                    {comm.needsReply && !comm.replyReceived && (
                      <div style={styles.expectRow}>
                        <span style={styles.expectLabel}>Expect reply by:</span>
                        <input
                          type="date"
                          value={comm.expectReplyBy || ''}
                          onChange={(e) =>
                            onUpdateStation({
                              ...station,
                              comms: comms.map((c) =>
                                c.id === comm.id
                                  ? { ...c, expectReplyBy: e.target.value || null }
                                  : c
                              ),
                            })
                          }
                          style={{
                            ...styles.expectInput,
                            color: expectOverdue ? '#e24b4a' : 'var(--color-text-primary)',
                            borderColor: expectOverdue ? '#e24b4a44' : 'var(--color-border-tertiary)',
                          }}
                        />
                        {comm.expectReplyBy && (
                          <button
                            onClick={() =>
                              onUpdateStation({
                                ...station,
                                comms: comms.map((c) =>
                                  c.id === comm.id
                                    ? { ...c, expectReplyBy: null }
                                    : c
                                ),
                              })
                            }
                            style={styles.expectClear}
                            title="Clear"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {comm.needsReply && !comm.replyReceived && (
                    <button
                      onClick={() => markReply(comm.id)}
                      style={styles.replyBtn}
                      title="Mark reply received"
                    >
                      Got reply
                    </button>
                  )}
                  <button
                    onClick={() => deleteComm(comm.id)}
                    style={styles.deleteBtn}
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
  );
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 10 },
  awaitingBox: {
    padding: '8px 12px',
    borderRadius: 10,
    background: '#ef9f2722',
    border: '0.5px solid #ef9f2744',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  awaitingTitle: { fontSize: 12, fontWeight: 600, color: '#ef9f27' },
  awaitingSub: { fontSize: 10, color: 'var(--color-text-secondary)' },
  pillsBlock: { display: 'flex', flexDirection: 'column', gap: 6 },
  pillsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pillsHeaderText: {
    fontSize: 10,
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  editPillsBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 10,
    color: 'var(--accent)',
    fontWeight: 500,
  },
  pillsRow: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  newPillBtn: {
    padding: '4px 12px',
    borderRadius: 20,
    border: '1px dashed var(--color-border-primary)',
    background: 'transparent',
    color: 'var(--color-text-tertiary)',
    fontSize: 11,
    cursor: 'pointer',
  },
  addPillRow: {
    display: 'flex',
    gap: 4,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  pillInput: {
    width: 120,
    fontSize: 11,
    padding: '3px 8px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    outline: 'none',
  },
  pillCheckLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  addPillSave: {
    fontSize: 11,
    padding: '3px 10px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  addPillCancel: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--color-text-tertiary)',
    fontSize: 14,
  },
  editHint: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
  },
  emptyLog: {
    textAlign: 'center',
    color: 'var(--color-text-tertiary)',
    fontSize: 12,
    padding: '1.25rem 0',
  },
  logList: { display: 'flex', flexDirection: 'column' },
  logRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 0',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  logTopRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  logDate: { fontSize: 11, color: 'var(--color-text-secondary)' },
  waitingBadge: {
    fontSize: 10,
    padding: '1px 7px',
    borderRadius: 10,
    fontWeight: 500,
  },
  repliedBadge: {
    fontSize: 10,
    padding: '1px 7px',
    borderRadius: 10,
    background: '#1d9e7522',
    color: '#1d9e75',
    fontWeight: 500,
  },
  replyBtn: {
    padding: '3px 10px',
    background: '#1d9e7522',
    color: '#1d9e75',
    border: '0.5px solid #1d9e7544',
    borderRadius: 16,
    fontSize: 11,
    cursor: 'pointer',
    fontWeight: 500,
  },
  deleteBtn: {
    width: 22,
    height: 22,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-tertiary)',
    fontSize: 14,
    cursor: 'pointer',
  },
  expectRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  expectLabel: {
    fontSize: 10,
    color: 'var(--color-text-secondary)',
  },
  expectInput: {
    padding: '2px 6px',
    fontSize: 10,
    border: '0.5px solid',
    borderRadius: 4,
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  expectClear: {
    width: 18,
    height: 18,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-tertiary)',
    fontSize: 13,
    cursor: 'pointer',
    borderRadius: 4,
  },
};
