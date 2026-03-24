const crypto = require('crypto');

const ENCRYPTED_PREFIX = 'enc:v1:';
const SENSITIVE_KEY_REGEX = /(secret|token|private|password|api[_-]?key|access[_-]?key|client_secret|webhook)/i;

const toPlainObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

const getMasterKey = () => {
  const raw = String(
    process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY ||
      process.env.BILLING_GATEWAY_ENCRYPTION_KEY ||
      ''
  ).trim();
  if (!raw) return null; // encryption disabled — credentials stored as plain text

  const maybeHex = raw.match(/^[0-9a-fA-F]{64}$/);
  if (maybeHex) {
    return Buffer.from(raw, 'hex');
  }

  const maybeBase64 = /^[A-Za-z0-9+/=]+$/.test(raw);
  if (maybeBase64) {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === 32) return decoded;
  }

  return crypto.createHash('sha256').update(raw).digest();
};

const isEncryptedValue = (value) =>
  typeof value === 'string' && String(value).startsWith(ENCRYPTED_PREFIX);

const encryptSecretValue = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (isEncryptedValue(text)) return text;

  const key = getMasterKey();
  if (!key) return text; // no encryption key set — store as plain text
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

const decryptSecretValue = (value, { allowPlain = true } = {}) => {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (!text) return '';
  if (!isEncryptedValue(text)) {
    if (allowPlain) return text;
    const err = new Error('Expected encrypted secret value');
    err.status = 400;
    throw err;
  }

  const key = getMasterKey();
  if (!key) {
    const err = new Error(
      'Encrypted credentials found in DB but PAYMENT_GATEWAY_ENCRYPTION_KEY is not set. ' +
      'Re-save credentials via Owner Dashboard to store them as plain text.'
    );
    err.status = 500;
    throw err;
  }

  // format: enc:v1:<iv_b64>:<tag_b64>:<enc_b64>  → 5 parts
  const parts = text.split(':');
  if (parts.length !== 5) {
    const err = new Error('Invalid encrypted secret format');
    err.status = 400;
    throw err;
  }

  const iv = Buffer.from(parts[2], 'base64');
  const tag = Buffer.from(parts[3], 'base64');
  const encrypted = Buffer.from(parts[4], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
};

const maskSecretValue = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const last4 = text.slice(-4);
  return `********${last4}`;
};

const mapDeep = (value, mapper, keyPath = []) => {
  if (Array.isArray(value)) {
    return value.map((item, index) => mapDeep(item, mapper, [...keyPath, String(index)]));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, mapDeep(child, mapper, [...keyPath, key])])
    );
  }
  return mapper(value, keyPath);
};

const isSensitiveKeyPath = (keyPath = []) => {
  const leaf = String(keyPath[keyPath.length - 1] || '');
  return SENSITIVE_KEY_REGEX.test(leaf) || leaf.endsWith('_enc');
};

const encryptSensitiveConfig = (configJson = {}) =>
  mapDeep(toPlainObject(configJson), (val, keyPath) => {
    if (!isSensitiveKeyPath(keyPath)) return val;
    if (val === null || val === undefined) return val;
    const text = String(val).trim();
    if (!text) return text;
    return encryptSecretValue(text);
  });

const sanitizeSensitiveConfig = (configJson = {}) =>
  mapDeep(toPlainObject(configJson), (val, keyPath) => {
    if (!isSensitiveKeyPath(keyPath)) return val;
    if (val === null || val === undefined) return val;
    const text = String(val).trim();
    if (!text) return text;
    if (isEncryptedValue(text)) return '********(encrypted)';
    return maskSecretValue(text);
  });

module.exports = {
  isEncryptedValue,
  encryptSecretValue,
  decryptSecretValue,
  encryptSensitiveConfig,
  sanitizeSensitiveConfig,
};

