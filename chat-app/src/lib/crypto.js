/**
 * Samlap E2EE Crypto Utility
 * -----------------------------------------------------------
 * Uses Web Crypto API:
 *   - ECDH P-256 for key agreement (both sides derive the identical shared secret)
 *   - AES-GCM-256 for authenticated symmetric encryption
 *
 * Private keys are stored in IndexedDB as NON-EXTRACTABLE CryptoKey objects.
 * They can never be serialised or exfiltrated, even with full JS access.
 *
 * Key-derivation symmetry:
 *   Alice's private key  + Bob's public key  → shared AES key
 *   Bob's private key    + Alice's public key → same shared AES key
 * ⟹ Both participants can encrypt/decrypt with the same derived key.
 * ⟹ No third party can derive this key without one of the private keys.
 */

// ── IndexedDB helpers ──────────────────────────────────────────────────────

const IDB_NAME    = 'samlap-e2ee';
const IDB_STORE   = 'keys';
const IDB_VERSION = 1;

/** Opens (or creates) the E2EE IndexedDB. Returns a Promise<IDBDatabase>. */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function idbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── Key pair management ────────────────────────────────────────────────────

/**
 * Returns this user's ECDH public key as a JWK JSON string.
 * If no key pair exists in IndexedDB for `uid`, one is generated and stored.
 * The private key is stored as a NON-EXTRACTABLE CryptoKey.
 *
 * @param {string} uid   Firebase UID of the current user
 * @returns {Promise<string>}  JSON-stringified JWK of the public key
 */
export async function getOrCreateKeyPair(uid) {
  const db     = await openDB();
  const stored = await idbGet(db, uid);

  if (stored?.privateKey && stored?.publicKeyJwk) {
    return JSON.stringify(stored.publicKeyJwk);
  }

  // Generate a new ECDH P-256 key pair
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,           // ← private key is NON-EXTRACTABLE
    ['deriveKey'],
  );

  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

  await idbPut(db, uid, {
    privateKey:   keyPair.privateKey,  // CryptoKey — never leaves IDB
    publicKeyJwk,                      // JWK object — safe to share
  });

  return JSON.stringify(publicKeyJwk);
}

async function getPrivateKey(uid) {
  const db     = await openDB();
  const stored = await idbGet(db, uid);
  return stored?.privateKey ?? null;
}

// ── AES key derivation ─────────────────────────────────────────────────────

async function deriveAESKey(myPrivateKey, otherPublicKeyJwk) {
  const jwk = typeof otherPublicKeyJwk === 'string'
    ? JSON.parse(otherPublicKeyJwk)
    : otherPublicKeyJwk;

  const otherPublicKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: otherPublicKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ── Encryption / Decryption ────────────────────────────────────────────────

/**
 * Encrypts a plaintext message. Only the two conversation participants
 * (the sender and the recipient) can decrypt it via their ECDH private keys.
 *
 * @param {string} plaintext          The message text
 * @param {string} otherPublicKeyJwk  Recipient's public key (JWK JSON string)
 * @param {string} myUid              Sender's Firebase UID
 * @returns {Promise<{ciphertext: string, iv: string}>}  Base-64 encoded fields
 */
export async function encryptMessage(plaintext, otherPublicKeyJwk, myUid) {
  const myPrivateKey = await getPrivateKey(myUid);
  if (!myPrivateKey) throw new Error('E2EE: private key not found in IndexedDB');

  const aesKey  = await deriveAESKey(myPrivateKey, otherPublicKeyJwk);
  const iv      = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoded,
  );

  const toBase64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

  return {
    ciphertext: toBase64(ciphertextBuffer),
    iv:         toBase64(iv),
  };
}

/**
 * Decrypts a message. Because ECDH is symmetric:
 *   my private key + sender's public key → same AES key used to encrypt.
 *
 * Works for both own sent messages and received messages in the same conversation.
 *
 * @param {string} ciphertext         Base-64 encoded ciphertext
 * @param {string} iv                 Base-64 encoded IV
 * @param {string} otherPublicKeyJwk  The OTHER party's public key (JWK JSON string)
 * @param {string} myUid              Current user's Firebase UID
 * @returns {Promise<string>}  Decrypted plaintext
 */
export async function decryptMessage(ciphertext, iv, otherPublicKeyJwk, myUid) {
  const myPrivateKey = await getPrivateKey(myUid);
  if (!myPrivateKey) throw new Error('E2EE: private key not found in IndexedDB');

  const aesKey    = await deriveAESKey(myPrivateKey, otherPublicKeyJwk);
  const fromBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    aesKey,
    fromBase64(ciphertext),
  );

  return new TextDecoder().decode(plaintextBuffer);
}

/**
 * Tries to parse a message's `text` field as an E2EE payload.
 * @param {string} text
 * @returns {{ ciphertext: string, iv: string } | null}
 */
export function parseEncryptedPayload(text) {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.ciphertext === 'string' && typeof parsed.iv === 'string') {
      return parsed;
    }
  } catch { /* plain text */ }
  return null;
}
