/**
 * PBKDF2-based PIN hashing via Web Crypto API.
 * Format stored: "b64salt:b64hash"
 * Migration path: if stored value has no ":", it's legacy btoa → treat as unverified.
 */

const ITERATIONS = 100_000;
const KEY_LEN = 32; // 256 bits
const HASH = 'SHA-256';

function bufToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64ToBuf(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Hash a PIN with a fresh random salt. Returns "salt:hash" in base64. */
export async function hashPin(pin: string): Promise<string> {
  const saltArr = crypto.getRandomValues(new Uint8Array(16));
  const saltBuf = saltArr.buffer as ArrayBuffer;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuf, iterations: ITERATIONS, hash: HASH },
    keyMaterial,
    KEY_LEN * 8
  );
  return `${bufToB64(saltBuf)}:${bufToB64(bits)}`;
}

/**
 * Verify a PIN against a stored hash.
 * Returns 'match' | 'no-match' | 'legacy' (stored value is old btoa format).
 */
export async function verifyPin(
  storedHash: string,
  pin: string
): Promise<'match' | 'no-match' | 'legacy'> {
  if (!storedHash || !storedHash.includes(':')) {
    // Legacy btoa hash — signal caller to re-hash
    return 'legacy';
  }
  const [saltB64, hashB64] = storedHash.split(':');
  const saltArr2 = b64ToBuf(saltB64);
  const saltBuf2 = saltArr2.buffer as ArrayBuffer;
  const expectedHash = b64ToBuf(hashB64);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuf2, iterations: ITERATIONS, hash: HASH },
    keyMaterial,
    KEY_LEN * 8
  );
  const derived = new Uint8Array(bits);

  // Timing-safe comparison
  if (derived.length !== expectedHash.length) return 'no-match';
  let diff = 0;
  for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ expectedHash[i];
  return diff === 0 ? 'match' : 'no-match';
}

/** Check if a stored hash is legacy (btoa) format */
export function isLegacyHash(storedHash: string): boolean {
  return Boolean(storedHash) && !storedHash.includes(':');
}
