// ── noteCrypto.js ────────────────────────────────────────────────────────────
// Client-side encryption for confidential notes. No data ever leaves the
// browser in plaintext; Supabase only ever stores ciphertext.
//
// SCHEME (v1)
//   • One random Master Key (MK), 32 bytes.
//   • Per-project Data Key:  DK = HKDF-SHA256(MK, info = projectKeyId)
//       - one-way, derived on demand, nothing extra stored per project.
//   • Note body encrypted with its project's DK (AES-256-GCM, random IV).
//   • MK is WRAPPED (AES-256-GCM) under one or more "unlockers":
//       - passkey:   wrapping key = HKDF(WebAuthn PRF secret)
//       - passphrase: wrapping key = PBKDF2(passphrase)         (fallback)
//       - recovery:   wrapping key = PBKDF2(recovery code)       (always)
//   • The wrapped MK copies + salts live in a "keystore" blob (ciphertext only).
//
// PER-PROJECT BOUNDARY
//   "Unlock this project" recovers MK transiently, derives that project's DK,
//   then zeroes MK — so the held DK cannot yield MK or any sibling project's DK
//   (HKDF is one-way). "Unlock all" keeps MK in memory for the session.
//
// Runs in the browser (SubtleCrypto). Passkey functions need `navigator`;
// the rest is pure Web Crypto and is unit-testable in Node 20+.

const subtle = globalThis.crypto.subtle;
const getRandom = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

const PBKDF2_ITERS = 310000;        // OWASP-ish floor for PBKDF2-SHA256
const PERSONAL_BUCKET = '__personal__';

// ── base64 helpers (url-safe not needed; standard b64) ───────────────────────
export function b64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}
export function unb64(str) {
  const s = atob(str);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}
const enc = new TextEncoder();
const dec = new TextDecoder();

// ── AES-GCM primitives ───────────────────────────────────────────────────────
async function importAesKey(rawBytes) {
  return subtle.importKey('raw', rawBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
async function aesEncrypt(key, plaintextBytes) {
  const iv = getRandom(12);
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintextBytes));
  return { iv: b64(iv), ct: b64(ct) };
}
async function aesDecrypt(key, ivB64, ctB64) {
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivB64) }, key, unb64(ctB64));
  return new Uint8Array(pt);
}

// ── Master key + per-project derivation ──────────────────────────────────────
export function generateMasterKey() {
  return getRandom(32);                       // raw MK bytes — keep in memory only
}

// DK = HKDF-SHA256(MK, info=projectKeyId). One-way: DK cannot yield MK.
export async function deriveProjectKey(mkBytes, projectKeyId) {
  const hkdfKey = await subtle.importKey('raw', mkBytes, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode(projectKeyId || PERSONAL_BUCKET) },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ── Note body encrypt/decrypt ────────────────────────────────────────────────
export async function encryptNoteBody(dk, text) {
  const { iv, ct } = await aesEncrypt(dk, enc.encode(text ?? ''));
  return { v: 1, iv, ct };
}
export async function decryptNoteBody(dk, blob) {
  if (!blob || blob.v !== 1) throw new Error('Unrecognised encrypted note');
  const pt = await aesDecrypt(dk, blob.iv, blob.ct);
  return dec.decode(pt);
}

// ── Wrapping keys from the three unlockers ───────────────────────────────────
async function wrappingKeyFromPassphrase(passphrase, saltBytes) {
  const base = await subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: PBKDF2_ITERS },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
async function wrappingKeyFromPrfSecret(prfSecretBytes) {
  const hkdfKey = await subtle.importKey('raw', prfSecretBytes, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode('daymark-note-wrap') },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Wrap / unwrap the raw MK bytes under a wrapping key.
async function wrapMK(wrappingKey, mkBytes) {
  return aesEncrypt(wrappingKey, mkBytes);          // { iv, ct }
}
async function unwrapMK(wrappingKey, wrapped) {
  return aesDecrypt(wrappingKey, wrapped.iv, wrapped.ct);  // → mk bytes
}

// ── Recovery code ────────────────────────────────────────────────────────────
// 20 chars of Crockford-ish base32, grouped. ~100 bits of entropy.
export function generateRecoveryCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'; // no I,L,O,0,1
  const bytes = getRandom(20);
  let out = '';
  for (let i = 0; i < 20; i++) out += alphabet[bytes[i] % alphabet.length];
  return `DMK-${out.slice(0, 5)}-${out.slice(5, 10)}-${out.slice(10, 15)}-${out.slice(15, 20)}`;
}

// ── Keystore assembly (what gets stored in Supabase; ciphertext only) ────────
// Returns the keystore object to persist + the recovery code to show ONCE.
// `primary` is { kind:'passkey', prfSecret } or { kind:'passphrase', passphrase }.
export async function createKeystore(primary) {
  const mk = generateMasterKey();
  const store = { v: 1, wrap: {} };

  if (primary.kind === 'passkey') {
    const wk = await wrappingKeyFromPrfSecret(primary.prfSecret);
    store.wrap.passkey = await wrapMK(wk, mk);
    store.cred = primary.credentialId || null;      // base64 credential id
    store.prfSalt = primary.prfSalt || null;        // base64 salt used for PRF eval
  } else if (primary.kind === 'passphrase') {
    const salt = getRandom(16);
    const wk = await wrappingKeyFromPassphrase(primary.passphrase, salt);
    store.wrap.passphrase = { salt: b64(salt), ...(await wrapMK(wk, mk)) };
  } else {
    throw new Error('Unknown primary unlocker');
  }

  // Recovery copy (always)
  const recoveryCode = generateRecoveryCode();
  const recSalt = getRandom(16);
  const recWk = await wrappingKeyFromPassphrase(recoveryCode, recSalt);
  store.wrap.recovery = { salt: b64(recSalt), ...(await wrapMK(recWk, mk)) };

  return { keystore: store, masterKey: mk, recoveryCode };
}

// ── Unlock: recover MK from the keystore using one unlocker ──────────────────
export async function unlockWithPassphrase(store, passphrase) {
  const w = store?.wrap?.passphrase;
  if (!w) throw new Error('No passphrase unlocker set');
  const wk = await wrappingKeyFromPassphrase(passphrase, unb64(w.salt));
  return unwrapMK(wk, w);                            // → MK bytes (throws if wrong)
}
export async function unlockWithPrf(store, prfSecret) {
  const w = store?.wrap?.passkey;
  if (!w) throw new Error('No passkey unlocker set');
  const wk = await wrappingKeyFromPrfSecret(prfSecret);
  return unwrapMK(wk, w);
}
export async function unlockWithRecovery(store, recoveryCode) {
  const w = store?.wrap?.recovery;
  if (!w) throw new Error('No recovery unlocker set');
  const wk = await wrappingKeyFromPassphrase(recoveryCode.trim().toUpperCase(), unb64(w.salt));
  return unwrapMK(wk, w);
}

// ── Project key id for a note ────────────────────────────────────────────────
export function projectKeyId(note) {
  return note?.projectId || PERSONAL_BUCKET;
}

// ── Passkey (WebAuthn PRF) — browser only ────────────────────────────────────
// Feature-detect, enrol, and evaluate PRF. These no-op outside a browser.
export function hasWebAuthn() {
  return typeof navigator !== 'undefined' && !!navigator.credentials && !!globalThis.PublicKeyCredential;
}

// Create a passkey with the PRF extension. Returns { credentialId(b64), prfSalt(b64) }.
// The caller then does an immediate get() to obtain the PRF secret for enrol
// (some authenticators only return PRF output on get, not create).
export async function enrolPasskey({ userId, userName, rpName = 'Daymark' }) {
  if (!hasWebAuthn()) throw new Error('WebAuthn unavailable');
  const prfSalt = getRandom(32);
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: getRandom(32),
      rp: { name: rpName },
      user: { id: enc.encode(userId), name: userName, displayName: userName },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      extensions: { prf: {} },
      timeout: 60000,
    },
  });
  return { credentialId: b64(new Uint8Array(cred.rawId)), prfSalt: b64(prfSalt) };
}

// Evaluate PRF for a stored credential + salt → secret bytes (Uint8Array).
export async function getPrfSecret({ credentialId, prfSalt }) {
  if (!hasWebAuthn()) throw new Error('WebAuthn unavailable');
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: getRandom(32),
      allowCredentials: credentialId ? [{ type: 'public-key', id: unb64(credentialId) }] : [],
      userVerification: 'required',
      extensions: { prf: { eval: { first: unb64(prfSalt) } } },
      timeout: 60000,
    },
  });
  const results = assertion.getClientExtensionResults?.();
  const first = results?.prf?.results?.first;
  if (!first) throw new Error('PRF not returned by this authenticator'); // → fall back to passphrase
  return new Uint8Array(first);
}

export const CONSTS = { PERSONAL_BUCKET, PBKDF2_ITERS };
