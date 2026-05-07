/**
 * Bot token encryption (AES-256-GCM)
 *
 * Bot tokens give full control over a customer's Telegram bot, so they're
 * encrypted at rest using authenticated encryption (GCM). Any tampering
 * with ciphertext or auth-tag is detected at decrypt time.
 *
 * Setup:
 *   - TELEGRAM_TOKEN_ENCRYPTION_KEY env var (32 bytes / 64 hex chars)
 *   - Already configured in Vercel for production + preview
 *   - For local dev, add to .env.local. Generate one with:
 *       node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * IMPORTANT: never rotate this key without re-encrypting all stored tokens
 * first — losing the key makes all encrypted tokens unrecoverable.
 */

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard

function getKey(): Buffer {
  const hex = process.env.TELEGRAM_TOKEN_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      'Missing TELEGRAM_TOKEN_ENCRYPTION_KEY env var. ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error(
      'TELEGRAM_TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes / 256 bits)'
    );
  }
  return key;
}

export interface EncryptedToken {
  encrypted: string; // base64
  iv: string; // base64
  authTag: string; // base64
}

export function encryptToken(plaintext: string): EncryptedToken {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decryptToken(encrypted: EncryptedToken): string {
  const key = getKey();

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(encrypted.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted.encrypted, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
