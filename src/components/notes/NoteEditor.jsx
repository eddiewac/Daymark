import { useEffect, useRef, useState } from 'react';
import TaskMultiSelect from './TaskMultiSelect.jsx';
import { projectKeyId } from '../../lib/noteCrypto.js';

function sameIds(a, b) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

export default function NoteEditor({
  note,
  isTeam,
  projects,
  tasks,
  workspaceId,
  conf,                 // confidential-notes engine (useConfidential)
  onUpdate,
  onDelete,
  onMove,
  onClose,
}) {
  const [title, setTitle] = useState(note.title || '');
  const [editBody, setEditBody] = useState('');
  const [projectName, setProjectName] = useState(note.projectName || '');
  const [taskIds, setTaskIds] = useState(note.taskIds || []);
  const [confidential, setConfidential] = useState(!!note.confidential);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef(null);
  const baselineBody = useRef('');

  const unlocked = conf ? conf.isUnlocked(note) : true;
  const locked = confidential && !unlocked;

  // Load / re-sync when the note changes or its project is unlocked.
  useEffect(() => {
    setTitle(note.title || '');
    setProjectName(note.projectName || '');
    setTaskIds(note.taskIds || []);
    setConfidential(!!note.confidential);
    setConfirmDelete(false);

    if (note.confidential) {
      setEditBody('');
      baselineBody.current = '';
      if (conf && conf.isUnlocked(note) && note.enc) {
        conf.decryptBody(note)
          .then((txt) => { setEditBody(txt); baselineBody.current = txt; })
          .catch(() => {});
      }
    } else {
      setEditBody(note.body || '');
      baselineBody.current = note.body || '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id, unlocked]);

  // Debounced auto-save. Encrypts for confidential notes; plain for the rest.
  useEffect(() => {
    if (busy) return;
    const metaChanged =
      title !== (note.title || '') ||
      projectName !== (note.projectName || '') ||
      !sameIds(taskIds, note.taskIds || []);
    const bodyChanged = !locked && editBody !== baselineBody.current;
    const confChanged = confidential !== !!note.confidential;
    if (!metaChanged && !bodyChanged && !confChanged) return;

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const base = {
        title,
        projectName: projectName || null,
        projectId: projectName
          ? projects?.find((p) => p.name === projectName)?.id || null
          : null,
        taskIds,
      };
      try {
        let patch;
        if (confidential) {
          if (locked) {
            patch = { ...base, confidential: true }; // metadata only; enc preserved via merge
          } else {
            const enc = await conf.encryptBody(note, editBody);
            patch = { ...base, confidential: true, enc, body: '' };
            baselineBody.current = editBody;
          }
        } else {
          patch = { ...base, confidential: false, body: editBody, enc: null };
          baselineBody.current = editBody;
        }
        onUpdate(note.id, patch, isTeam);
      } catch (e) {
        // leave unsaved; a visible save-status indicator is a planned follow-up
        console.error('note save (confidential):', e);
      }
    }, 600);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, projectName, taskIds, editBody, confidential, locked, busy]);

  const onToggleConfidential = async () => {
    if (!conf) return;
    if (confidential) {
      // Turning OFF → need plaintext to write back, so ensure we can read it.
      if (locked) {
        const ok = await conf.ensureUnlocked(note);
        if (!ok) return;
        try {
          const txt = await conf.decryptBody(note);
          setEditBody(txt);
        } catch { /* ignore */ }
      }
      baselineBody.current = '\u0000'; // force bodyChanged so plaintext is written
      setConfidential(false);
    } else {
      // Turning ON → enrol if needed, then unlock this note's project.
      setBusy(true);
      const okEnrol = await conf.ensureEnrolled();
      if (!okEnrol) { setBusy(false); return; }
      const okUnlock = await conf.ensureUnlocked(note);
      setBusy(false);
      if (!okUnlock) return;
      baselineBody.current = '\u0000'; // force a save so the body gets encrypted
      setConfidential(true);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div style={styles.scopeBadge}>{isTeam ? '🏢 Team note' : '📝 My note'}</div>
        <div style={{ flex: 1 }} />
        {/* Confidential is personal-only in v1: a team note encrypted with your
            own key would be unreadable by teammates. */}
        {!isTeam && (
          <button
            onClick={onToggleConfidential}
            style={{ ...styles.confToggle, ...(confidential ? styles.confToggleOn : {}) }}
            title={confidential ? 'This note is encrypted. Click to make it a normal note.' : 'Encrypt this note so only you can read it'}
          >
            {confidential ? '🔒 Confidential' : '🔓 Make confidential'}
          </button>
        )}
        <button onClick={onClose} style={styles.closeBtn} title="Close">×</button>
      </div>

      {confidential && (
        <div style={styles.titleWarn}>
          ⚠&nbsp;
          <span><b>The title stays visible even when locked</b> — it isn’t encrypted, so keep client names or anything sensitive out of it.</span>
        </div>
      )}

      <div style={styles.toolRow}>
        <select value={projectName} onChange={(e) => setProjectName(e.target.value)} style={styles.projectSelect}>
          <option value="">No project</option>
          {(projects || []).map((p) => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>
        {workspaceId && (
          <button
            onClick={() => onMove(note.id, !isTeam)}
            style={styles.moveBtn}
            title={isTeam ? 'Move to your personal notes' : 'Share with the team'}
          >
            {isTeam ? '↩ Move to personal' : '↗ Move to team'}
          </button>
        )}
      </div>

      <div style={styles.taskRow}>
        <span style={styles.taskRowLabel}>Tasks</span>
        <div style={{ flex: 1 }}>
          <TaskMultiSelect tasks={tasks || []} taskIds={taskIds} preferredProject={projectName} onChange={setTaskIds} placeholder="+ Tag a task" />
        </div>
      </div>

      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title…" style={styles.titleInput} />

      {locked ? (
        <div style={styles.lockedBody}>
          <div style={styles.lockedIcon}>🔒</div>
          <div style={styles.lockedTitle}>This note is locked</div>
          <div style={styles.lockedSub}>
            {note.projectName ? <>Part of <b>{note.projectName}</b>. </> : ''}Unlock to read and edit it.
          </div>
          <button style={styles.unlockBtn} onClick={() => conf.ensureUnlocked(note)}>Unlock…</button>
        </div>
      ) : (
        <textarea
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          placeholder="Start writing…"
          style={styles.bodyArea}
        />
      )}

      <div style={styles.footer}>
        <span style={styles.footerNote}>
          {confidential ? '🔒 Encrypted · ' : ''}
          Saved {note.updatedAt ? new Date(note.updatedAt).toLocaleString() : 'just now'}
        </span>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} style={styles.deleteBtn}>Delete note</button>
        ) : (
          <div style={styles.confirmRow}>
            <button onClick={() => onDelete(note.id, isTeam)} style={styles.deleteConfirm}>Yes, delete</button>
            <button onClick={() => setConfirmDelete(false)} style={styles.cancelBtn}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '0.5px solid var(--color-border-tertiary)' },
  scopeBadge: { fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', padding: '3px 8px', background: 'var(--color-background-secondary)', borderRadius: 12 },
  confToggle: { fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 12, border: '0.5px solid var(--color-border-primary)', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' },
  confToggleOn: { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent)' },
  closeBtn: { background: 'transparent', border: 'none', fontSize: 22, color: 'var(--color-text-secondary)', width: 28, height: 28, cursor: 'pointer' },
  titleWarn: { display: 'flex', alignItems: 'flex-start', gap: 2, padding: '7px 14px', background: '#ef9f2718', borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: 11, color: '#8a5a00', lineHeight: 1.4 },
  toolRow: { display: 'flex', gap: 8, padding: '8px 14px', borderBottom: '0.5px solid var(--color-border-tertiary)', alignItems: 'center' },
  taskRow: { display: 'flex', gap: 8, padding: '8px 14px', borderBottom: '0.5px solid var(--color-border-tertiary)', alignItems: 'flex-start' },
  taskRowLabel: { fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500, paddingTop: 8, minWidth: 38 },
  projectSelect: { flex: 1, padding: '5px 10px', border: '0.5px solid var(--color-border-secondary)', borderRadius: 8, fontSize: 12, background: 'var(--bg-surface)', outline: 'none' },
  moveBtn: { padding: '5px 10px', background: 'var(--accent-soft)', color: 'var(--accent)', border: '0.5px solid var(--accent-soft-border)', borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' },
  titleInput: { fontSize: 18, fontWeight: 600, border: 'none', outline: 'none', padding: '14px 18px 6px 18px', color: 'var(--color-text-primary)' },
  bodyArea: { flex: 1, border: 'none', outline: 'none', padding: '6px 18px 12px 18px', fontSize: 13, lineHeight: 1.6, fontFamily: 'inherit', resize: 'none', color: 'var(--color-text-primary)' },
  lockedBody: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--color-text-secondary)', padding: 24, textAlign: 'center' },
  lockedIcon: { fontSize: 34 },
  lockedTitle: { fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' },
  lockedSub: { fontSize: 12, maxWidth: 280 },
  unlockBtn: { padding: '7px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderTop: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-tertiary)' },
  footerNote: { fontSize: 11, color: 'var(--color-text-tertiary)' },
  deleteBtn: { padding: '4px 10px', background: 'transparent', border: '0.5px solid #e24b4a', color: '#e24b4a', borderRadius: 6, fontSize: 11, cursor: 'pointer' },
  confirmRow: { display: 'flex', gap: 6 },
  deleteConfirm: { padding: '4px 10px', background: '#e24b4a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer' },
  cancelBtn: { padding: '4px 10px', background: 'transparent', border: '0.5px solid var(--color-border-primary)', color: 'var(--color-text-secondary)', borderRadius: 6, fontSize: 11, cursor: 'pointer' },
};
