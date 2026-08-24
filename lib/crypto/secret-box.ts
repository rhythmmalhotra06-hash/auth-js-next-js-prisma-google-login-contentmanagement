// Symmetric encryption for third-party credentials held at rest (OAuth refresh tokens,
// client secrets). AES-256-GCM, so a tampered ciphertext fails to decrypt rather than
// yielding garbage.
//
// The key is DERIVED from AUTH_SECRET via HKDF rather than being its own env var. That is
// deliberate: adding a new secret to this project costs a `kessel env secret` plus a fresh
// commit to force a rebuild (env changes don't take effect on a same-SHA deploy), and every
// extra required secret is one more way for a deploy to come up half-configured. AUTH_SECRET
// is already present, already server-only, and already strong. The `info` label keeps this
// key domain-separated from anything else derived from the same root.
//
// Consequence worth knowing: rotating AUTH_SECRET makes stored credentials undecryptable.
// They are re-obtainable by reconnecting the integration, and decrypt failures surface as a
// clear "reconnect required" rather than a silent wrong value.

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

const INFO = 'content-portal:external-credential:v1';
const IV_BYTES = 12; // GCM standard
const VERSION = 'v1';

function key(): Buffer {
  const root = process.env.AUTH_SECRET;
  if (!root) throw new Error('AUTH_SECRET is not set — cannot encrypt or decrypt stored credentials.');
  // Empty salt is fine here: the root is high-entropy and INFO provides domain separation.
  return Buffer.from(hkdfSync('sha256', root, '', INFO, 32));
}

/** Encrypt a UTF-8 string. Output is self-describing: `v1.<iv>.<tag>.<ciphertext>`, base64url. */
export function seal(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), body.toString('base64url')].join('.');
}

/**
 * Decrypt a value produced by seal(). Throws on tampering, a wrong key (e.g. AUTH_SECRET
 * was rotated), or an unrecognized format — callers treat any throw as "reconnect needed".
 */
export function open(sealed: string): string {
  const parts = sealed.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error('Unrecognized sealed-value format.');
  const [, iv, tag, body] = parts;
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8');
}

/** True when a stored value can still be read with the current key. Never throws. */
export function canOpen(sealed: string | null | undefined): boolean {
  if (!sealed) return false;
  try {
    open(sealed);
    return true;
  } catch {
    return false;
  }
}
