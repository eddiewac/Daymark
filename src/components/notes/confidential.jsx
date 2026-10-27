// ── confidential.jsx ─────────────────────────────────────────────────────────
// The engine for confidential notes: an in-memory key holder + the enrol /
// unlock / recovery modal flows. Kept in one module so the edits to NoteEditor,
// NotesPanel and NoteCard stay tiny.
//
// Usage (in NotesPanel):
//   const conf = useConfidential();
//   ...
//   <ConfidentialModals conf={conf} />
//   and pass `conf` down to NoteEditor.
//
// Security model (see noteCrypto.js): one Master Key (MK) wrapped under a
// passkey (or passphrase) + recovery code. Per-project key = HKDF(MK, projectId).
// "Unlock all" keeps MK in memory; "unlock this project" derives that project's
// key then discards MK, so other projects stay locked (HKDF is one-way).

import { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentUser } from '../../lib/supabase.js';
import { loadKeystore, saveKeystore } from '../../lib/noteKeystore.js';
import {
  createKeystore,
  deriveProjectKey,
  encryptNoteBody,
  decryptNoteBody,
  projectKeyId,
  unlockWithPassphrase,
  unlockWithPrf,
  unlockWithRecovery,
  hasWebAuthn,
  enrolPasskey,
  getPrfSecret,
} from '../../lib/noteCrypto.js';

export function useConfidential() {
  const [keystore, setKeystore] = useState(null);
  const [ready, setReady] = useState(false);

  // In-memory secrets (never persisted). mk = unlock-all; projKeys = per-project.
  const mkRef = useRef(null);                 // Uint8Array | null
  const projKeys = useRef(new Map());         // pid -> CryptoKey
  const [unlockVersion, setUnlockVersion] = useState(0); // bump to re-render gates
  const bump = () => setUnlockVersion((v) => v + 1);

  // Modal state. `resolver` resolves the promise the caller is awaiting.
  const [modal, setModal] = useState(null);
  const resolver = useRef(null);
  const finish = (ok) => {
    const r = resolver.current;
    resolver.current = null;
    setModal(null);
    if (r) r(ok);
  };

  // Load the keystore once.
  useEffect(() => {
    let cancelled = false;
    loadKeystore()
      .then((ks) => { if (!cancelled) setKeystore(ks); })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  const enrolled = !!keystore;

  const isUnlocked = useCallback(
    (note) => !!mkRef.current || projKeys.current.has(projectKeyId(note)),
    [unlockVersion]
  );

  const getKey = useCallback(async (note) => {
    const pid = projectKeyId(note);
    if (projKeys.current.has(pid)) return projKeys.current.get(pid);
    if (mkRef.current) return deriveProjectKey(mkRef.current, pid);
    return null;
  }, []);

  const lockAll = useCallback(() => {
    mkRef.current = null;
    projKeys.current.clear();
    bump();
  }, []);

  // Apply a recovered MK according to the chosen scope.
  const applyScope = async (mk, scope, note) => {
    if (scope === 'all') {
      mkRef.current = mk;
    } else {
      const pid = projectKeyId(note);
      const dk = await deriveProjectKey(mk, pid);
      projKeys.current.set(pid, dk);
      mkRef.current = null;           // discard MK → other projects stay locked
    }
    bump();
  };

  // ── Enrolment ───────────────────────────────────────────────────────────────
  // Resolves true once a keystore exists (creating one via passkey/passphrase).
  const ensureEnrolled = useCallback(() => {
    if (keystore) return Promise.resolve(true);
    return new Promise((resolve) => {
      resolver.current = resolve;
      setModal({ type: hasWebAuthn() ? 'enrolChoice' : 'enrolPassphrase' });
    });
  }, [keystore]);

  const doEnrolPasskey = async () => {
    try {
      const user = await getCurrentUser();
      const name = user?.email || 'Daymark user';
      const { credentialId, prfSalt } = await enrolPasskey({ userId: user?.id || 'user', userName: name });
      const prfSecret = await getPrfSecret({ credentialId, prfSalt });
      const { keystore: ks, masterKey, recoveryCode } =
        await createKeystore({ kind: 'passkey', prfSecret, credentialId, prfSalt });
      const res = await saveKeystore(ks);
      if (!res.ok) { setModal({ type: 'error', message: res.error }); return; }
      setKeystore(ks);
      mkRef.current = masterKey;          // just enrolled → unlocked for session
      bump();
      setModal({ type: 'recovery', code: recoveryCode });  // resolver fires on ack
    } catch (e) {
      // PRF unsupported / user cancelled → offer passphrase fallback
      setModal({ type: 'enrolPassphrase', note: 'Your device didn’t provide a passkey secret, so use a passphrase instead.' });
    }
  };

  const doEnrolPassphrase = async (passphrase) => {
    try {
      const { keystore: ks, masterKey, recoveryCode } =
        await createKeystore({ kind: 'passphrase', passphrase });
      const res = await saveKeystore(ks);
      if (!res.ok) { setModal({ type: 'error', message: res.error }); return; }
      setKeystore(ks);
      mkRef.current = masterKey;
      bump();
      setModal({ type: 'recovery', code: recoveryCode });
    } catch (e) {
      setModal({ type: 'error', message: String(e?.message || e) });
    }
  };

  // ── Unlock ───────────────────────────────────────────────────────────────────
  // Resolves true once `note`'s project is readable.
  const ensureUnlocked = useCallback(
    async (note) => {
      if (isUnlocked(note)) return true;
      if (!keystore) { const ok = await ensureEnrolled(); return ok; }
      return new Promise((resolve) => {
        resolver.current = resolve;
        setModal({ type: 'unlockScope', note });
      });
    },
    [keystore, isUnlocked, ensureEnrolled]
  );

  // Recover MK with whatever unlocker the keystore has, then apply scope.
  const runUnlock = async (scope, note, { passphrase, recovery } = {}) => {
    try {
      let mk;
      if (recovery != null) {
        mk = await unlockWithRecovery(keystore, recovery);
      } else if (keystore.wrap?.passkey) {
        const prfSecret = await getPrfSecret({ credentialId: keystore.cred, prfSalt: keystore.prfSalt });
        mk = await unlockWithPrf(keystore, prfSecret);
      } else {
        mk = await unlockWithPassphrase(keystore, passphrase);
      }
      await applyScope(mk, scope, note);
      finish(true);
    } catch (e) {
      setModal((m) => ({ ...m, type: m.type === 'recovery' ? 'recovery' : (m.needPass ? 'unlockPass' : 'unlockError'), error: 'That didn’t work — try again.', _scope: scope, _note: note }));
    }
  };

  // ── Encrypt / decrypt a note body ─────────────────────────────────────────────
  const encryptBody = useCallback(async (note, text) => {
    const key = await getKey(note);
    if (!key) throw new Error('Note is locked');
    return encryptNoteBody(key, text);
  }, [getKey]);

  const decryptBody = useCallback(async (note) => {
    if (!note?.enc) return '';
    const key = await getKey(note);
    if (!key) throw new Error('Note is locked');
    return decryptNoteBody(key, note.enc);
  }, [getKey]);

  return {
    ready, enrolled, isUnlocked, getKey, encryptBody, decryptBody,
    ensureEnrolled, ensureUnlocked, lockAll,
    // internals the modal component needs:
    _modal: modal, _setModal: setModal, _finish: finish,
    _doEnrolPasskey: doEnrolPasskey, _doEnrolPassphrase: doEnrolPassphrase,
    _runUnlock: runUnlock, _hasPasskey: !!keystore?.wrap?.passkey, _hasWebAuthn: hasWebAuthn(),
  };
}

// ── Modals ─────────────────────────────────────────────────────────────────────
export function ConfidentialModals({ conf }) {
  const m = conf._modal;
  const [pass, setPass] = useState('');
  const [rec, setRec] = useState('');
  useEffect(() => { setPass(''); setRec(''); }, [m?.type]);
  if (!m) return null;

  const close = () => conf._finish(false);

  let body = null;
  if (m.type === 'enrolChoice') {
    body = (
      <>
        <div style={s.icon}>🔒</div>
        <h3 style={s.h3}>Turn on confidential notes</h3>
        <p style={s.p}>Confidential notes are encrypted on this device so even Daymark's servers can't read them. Unlock with Face ID, your fingerprint or a security key.</p>
        <div style={s.acts}>
          <button style={s.btn} onClick={conf._doEnrolPasskey}>Set up with passkey</button>
          <button style={s.ghost} onClick={() => conf._setModal({ type: 'enrolPassphrase' })}>Use a passphrase instead</button>
          <button style={s.plain} onClick={close}>Cancel</button>
        </div>
      </>
    );
  } else if (m.type === 'enrolPassphrase') {
    body = (
      <>
        <div style={s.icon}>🔑</div>
        <h3 style={s.h3}>Set a passphrase</h3>
        <p style={s.p}>{m.note || 'Your notes will be encrypted with a passphrase you choose. It can’t be reset — keep it safe.'}</p>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Choose a passphrase" style={s.input} />
        <div style={s.acts}>
          <button style={s.btn} disabled={pass.length < 6} onClick={() => conf._doEnrolPassphrase(pass)}>Turn on confidential notes</button>
          <button style={s.plain} onClick={close}>Cancel</button>
        </div>
      </>
    );
  } else if (m.type === 'recovery') {
    body = (
      <>
        <div style={s.icon}>🗝️</div>
        <h3 style={s.h3}>Save your recovery code</h3>
        <p style={s.p}>If you lose every device with your passkey, this is the <b>only</b> way back into your confidential notes.</p>
        <div style={s.recovery}>{m.code}</div>
        <div style={s.warn}>We can't show this again and can't reset it.</div>
        <div style={s.acts}><button style={s.btn} onClick={() => conf._finish(true)}>I've saved it — finish</button></div>
      </>
    );
  } else if (m.type === 'unlockScope') {
    const note = m.note;
    const proj = note?.projectName ? `just “${note.projectName}”` : 'just personal';
    body = (
      <>
        <div style={s.icon}>🔓</div>
        <h3 style={s.h3}>Unlock confidential notes</h3>
        <p style={s.p}>How much do you want to unlock for this session?</p>
        <div style={s.acts}>
          <button style={s.btn} onClick={() => startUnlock(conf, 'project', note, setPass, setRec)}>Unlock {proj} notes</button>
          <button style={s.ghost} onClick={() => startUnlock(conf, 'all', note, setPass, setRec)}>Unlock all confidential notes</button>
          <button style={s.linkBtn} onClick={() => conf._setModal({ type: 'recovery_enter', note, _scope: 'all' })}>Use a recovery code</button>
          <button style={s.plain} onClick={close}>Cancel</button>
        </div>
      </>
    );
  } else if (m.type === 'unlockPass') {
    body = (
      <>
        <div style={s.icon}>🔑</div>
        <h3 style={s.h3}>Enter passphrase</h3>
        {m.error && <div style={s.warn}>{m.error}</div>}
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Passphrase" style={s.input} />
        <div style={s.acts}>
          <button style={s.btn} onClick={() => conf._runUnlock(m._scope || 'all', m._note, { passphrase: pass })}>Unlock</button>
          <button style={s.plain} onClick={close}>Cancel</button>
        </div>
      </>
    );
  } else if (m.type === 'recovery_enter') {
    body = (
      <>
        <div style={s.icon}>🗝️</div>
        <h3 style={s.h3}>Enter recovery code</h3>
        {m.error && <div style={s.warn}>{m.error}</div>}
        <input value={rec} onChange={(e) => setRec(e.target.value)} placeholder="DMK-XXXXX-XXXXX-XXXXX-XXXXX" style={s.input} />
        <div style={s.acts}>
          <button style={s.btn} onClick={() => conf._runUnlock(m._scope || 'all', m.note, { recovery: rec })}>Unlock</button>
          <button style={s.plain} onClick={close}>Cancel</button>
        </div>
      </>
    );
  } else if (m.type === 'unlockError') {
    body = (
      <>
        <div style={s.icon}>⚠️</div>
        <h3 style={s.h3}>Couldn't unlock</h3>
        <p style={s.p}>{m.error || 'Please try again.'}</p>
        <div style={s.acts}><button style={s.btn} onClick={close}>Close</button></div>
      </>
    );
  } else if (m.type === 'error') {
    body = (
      <>
        <div style={s.icon}>⚠️</div>
        <h3 style={s.h3}>Something went wrong</h3>
        <p style={s.p}>{m.message || 'Please try again.'}</p>
        <div style={s.acts}><button style={s.btn} onClick={close}>Close</button></div>
      </>
    );
  }

  return (
    <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div style={s.modal}>{body}</div>
    </div>
  );
}

// For passkey keystores, unlock needs no text input — fire the PRF get straight
// away. For passphrase keystores, show the passphrase prompt first.
function startUnlock(conf, scope, note) {
  if (conf._hasPasskey) {
    conf._runUnlock(scope, note, {});
  } else {
    conf._setModal({ type: 'unlockPass', _scope: scope, _note: note, needPass: true });
  }
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(20,20,35,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1600, padding: 20 },
  modal: { background: 'var(--bg-surface)', borderRadius: 16, maxWidth: 390, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.25)', textAlign: 'center' },
  icon: { fontSize: 36, marginBottom: 6 },
  h3: { fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-primary)' },
  p: { fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.55, marginBottom: 16 },
  input: { width: '100%', padding: 10, border: '0.5px solid var(--color-border-secondary)', borderRadius: 8, marginBottom: 14, fontSize: 13, background: 'var(--bg-surface)', color: 'var(--color-text-primary)', outline: 'none' },
  acts: { display: 'flex', flexDirection: 'column', gap: 8 },
  btn: { width: '100%', padding: 10, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  ghost: { width: '100%', padding: 10, background: 'transparent', border: '0.5px solid var(--color-border-primary)', color: 'var(--accent)', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  plain: { width: '100%', padding: 8, background: 'transparent', border: 'none', color: 'var(--color-text-tertiary)', fontSize: 12, cursor: 'pointer' },
  linkBtn: { width: '100%', padding: 6, background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' },
  recovery: { fontFamily: 'ui-monospace, monospace', fontSize: 14, letterSpacing: '.06em', background: 'var(--color-background-secondary)', border: '0.5px dashed var(--accent-soft-border)', borderRadius: 10, padding: 14, margin: '4px 0 12px', wordBreak: 'break-all', color: 'var(--color-text-primary)' },
  warn: { fontSize: 11, color: '#e24b4a', marginBottom: 12 },
};
