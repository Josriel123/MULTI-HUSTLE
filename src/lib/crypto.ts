import crypto from 'crypto';

/**
 * AES-256-GCM encryption for secrets at rest (currently Plaid access tokens).
 *
 * Envelope format: `v1:<base64(iv | authTag | ciphertext)>`
 *
 * The `v1:` prefix lets us distinguish encrypted values from tokens written
 * before encryption existed. Legacy plaintext rows are returned as-is by
 * `decryptSecret` so an existing connection keeps working; they get upgraded
 * the next time they're written. See PLAN.md.
 */

const PREFIX = 'v1:';
const IV_BYTES = 12; // GCM standard
const TAG_BYTES = 16;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY is not set. Generate one with:\n' +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to 32 bytes, got ${key.length}. Regenerate it as base64.`
    );
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decryptSecret(value: string): string {
  // Written before encryption was introduced — return unchanged.
  if (!value.startsWith(PREFIX)) return value;

  const buf = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = buf.subarray(0, IV_BYTES);
  const authTag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);

  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** True if the value is already encrypted (used to decide on lazy re-encryption). */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}
