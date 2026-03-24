/**
 * messageCipher.js
 *
 * AES-256-GCM encryption / decryption for chat messages.
 * Messages are encrypted before INSERT and decrypted after SELECT so the
 * database never stores plain-text conversation content.
 *
 * Requires env: CHAT_ENCRYPTION_KEY  (64-char hex = 32 bytes)
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LEN = 12;          // GCM recommended
const AUTH_TAG_LEN = 16;    // 128-bit auth tag

let _key = null;

const getKey = () => {
  if (_key) return _key;
  const hex = process.env.CHAT_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'CHAT_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  _key = Buffer.from(hex, 'hex');
  return _key;
};

/**
 * Encrypt a plain-text string → base64 payload  (iv:ciphertext:tag)
 * Returns null for empty/null input.
 */
const encryptMessage = (plainText) => {
  if (!plainText && plainText !== '') return null;
  if (plainText === null || plainText === undefined) return null;
  const text = String(plainText);
  if (!text) return '';

  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LEN });
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Format: base64(iv) . base64(ciphertext) . base64(tag)
  return `${iv.toString('base64')}.${encrypted.toString('base64')}.${tag.toString('base64')}`;
};

/**
 * Decrypt an encrypted payload → plain-text string.
 * If the input is not in encrypted format, returns it as-is (backward compat).
 */
const decryptMessage = (payload) => {
  if (!payload) return payload;
  const text = String(payload);
  if (!text) return '';

  // Check if it looks like our encrypted format (3 base64 segments separated by dots)
  const parts = text.split('.');
  if (parts.length !== 3) {
    // Not encrypted — return as-is (plain-text from before encryption was enabled)
    return text;
  }

  try {
    const key = getKey();
    const iv = Buffer.from(parts[0], 'base64');
    const encrypted = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');

    if (iv.length !== IV_LEN) return text; // not our format

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LEN });
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    // Decryption failed — likely plain-text or corrupted, return as-is
    return text;
  }
};

/**
 * Encrypt a metadata object → encrypted JSON string for JSONB column.
 * Wraps the encrypted payload in a JSON object so PostgreSQL accepts it as JSONB.
 */
const encryptMetadata = (metadata) => {
  if (!metadata) return null;
  const json = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
  const encrypted = encryptMessage(json);
  // Store as JSONB: {"_enc": "iv.ciphertext.tag"}
  return JSON.stringify({ _enc: encrypted });
};

/**
 * Decrypt metadata from DB. Handles both encrypted and plain JSONB.
 */
const decryptMetadata = (metadata) => {
  if (!metadata) return metadata;
  // If it's a string, parse it first
  const obj = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
  if (obj && obj._enc) {
    // Encrypted metadata
    try {
      const decrypted = decryptMessage(obj._enc);
      return JSON.parse(decrypted);
    } catch {
      return obj;
    }
  }
  // Plain metadata (backward compat)
  return obj;
};

module.exports = { encryptMessage, decryptMessage, encryptMetadata, decryptMetadata };
