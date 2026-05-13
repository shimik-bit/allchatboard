// Token encryption — AES-256-GCM via the Node `crypto` module.
//
// OAuth refresh tokens are extremely sensitive: a leaked refresh token gives
// permanent read/write access to the user's Google Drive until they revoke
// it manually in their Google account. We never store them in plaintext.
//
// Format:   <base64(iv)>:<base64(ciphertext + 16-byte auth tag)>
// Algorithm: aes-256-gcm
// Key:      TOKEN_ENCRYPTION_KEY env var, must be 32 raw bytes hex-encoded
//           (i.e. a 64-char hex string). Generate with `openssl rand -hex 32`.
//
// Rotation strategy (future): if we ever need to rotate the key, prefix the
// ciphertext with a key version byte. For v1 we only support a single key.

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;        // GCM standard
const AUTH_TAG_LENGTH = 16;  // GCM standard

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY env var is missing. Generate with `openssl rand -hex 32`.',
    );
  }
  if (hex.length !== 64) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes), got ${hex.length}.`,
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a string and return a storable format.
 * Output: `<base64(iv)>:<base64(ciphertext+tag)>`
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Concat ciphertext + tag, then return iv:body
  const body = Buffer.concat([ciphertext, tag]);
  return `${iv.toString('base64')}:${body.toString('base64')}`;
}

/**
 * Decrypt a value produced by `encryptToken`. Throws if the value is
 * malformed, the key is wrong, or the auth tag check fails.
 */
export function decryptToken(encrypted: string): string {
  const key = getKey();

  const parts = encrypted.split(':');
  if (parts.length !== 2) {
    throw new Error('Malformed encrypted token (expected `iv:body`).');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const body = Buffer.from(parts[1], 'base64');

  if (iv.length !== IV_LENGTH) {
    throw new Error(`IV length mismatch: expected ${IV_LENGTH}, got ${iv.length}.`);
  }
  if (body.length < AUTH_TAG_LENGTH) {
    throw new Error('Encrypted body too short to contain auth tag.');
  }

  const ciphertext = body.subarray(0, body.length - AUTH_TAG_LENGTH);
  const tag = body.subarray(body.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
