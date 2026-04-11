// AES-GCM helpers for secure message encryption.
// encodeURIComponent/decodeURIComponent are intentionally not used - URL encoding alone
// offers no secrecy compared with the authenticated encryption implemented here.
const TEXT_ENCODER = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
const TEXT_DECODER = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;

const SALT_STORAGE_KEY = "chatx.secure.salt";
const MASTER_SECRET =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SECURE_STORAGE_SECRET) ||
  "teamchatx-dev-secret";

const PBKDF2_ITERATIONS = 120000;
const IV_LENGTH = 12; // AES-GCM recommended length in bytes

let cachedKey = null;
let cachedSecret = null;

const bufferToBase64 = (buffer) => {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // Prevent call stack overflow on large payloads
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const base64ToBuffer = (base64) => {
  if (!base64) return new ArrayBuffer(0);
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const ensureSalt = () => {
  if (typeof window === "undefined") return bufferToBase64(new Uint8Array(16).buffer);
  const existing = window.localStorage.getItem(SALT_STORAGE_KEY);
  if (existing) return existing;
  const saltBytes = new Uint8Array(16);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(saltBytes);
  } else {
    for (let i = 0; i < saltBytes.length; i += 1) {
      saltBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const payload = bufferToBase64(saltBytes.buffer);
  window.localStorage.setItem(SALT_STORAGE_KEY, payload);
  return payload;
};

const getKeyMaterial = async (secret) => {
  if (!TEXT_ENCODER || typeof window === "undefined" || !window.crypto?.subtle) {
    return null;
  }
  const encoded = TEXT_ENCODER.encode(secret);
  return window.crypto.subtle.importKey("raw", encoded, "PBKDF2", false, ["deriveKey"]);
};

const deriveCryptoKey = async () => {
  if (cachedKey && cachedSecret === MASTER_SECRET) return cachedKey;
  if (typeof window === "undefined" || !window.crypto?.subtle || !TEXT_ENCODER) {
    cachedSecret = MASTER_SECRET;
    cachedKey = null;
    return null;
  }

  const saltBase64 = ensureSalt();
  const keyMaterial = await getKeyMaterial(MASTER_SECRET);
  const saltBuffer = base64ToBuffer(saltBase64);

  const cryptoKey = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  cachedKey = cryptoKey;
  cachedSecret = MASTER_SECRET;
  return cryptoKey;
};

export const encryptString = async (plainText = "") => {
  if (!plainText) return "";
  if (typeof window === "undefined" || !window.crypto?.subtle || !TEXT_ENCODER) {
    return btoa(plainText);
  }

  const key = await deriveCryptoKey();
  if (!key) {
    return btoa(plainText);
  }

  const iv = new Uint8Array(IV_LENGTH);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(iv);
  } else {
    for (let i = 0; i < iv.length; i += 1) {
      iv[i] = Math.floor(Math.random() * 256);
    }
  }

  const encoded = TEXT_ENCODER.encode(plainText);
  const cipherBuffer = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  const payload = {
    v: 1,
    iv: bufferToBase64(iv.buffer),
    data: bufferToBase64(cipherBuffer),
  };

  return JSON.stringify(payload);
};

export const decryptString = async (payload = "") => {
  if (!payload) return "";
  if (typeof window === "undefined" || !window.crypto?.subtle || !TEXT_DECODER) {
    try {
      return atob(payload);
    } catch {
      return "";
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch {
    try {
      return atob(payload);
    } catch {
      return "";
    }
  }

  if (!parsed?.iv || !parsed?.data) return "";

  try {
    const key = await deriveCryptoKey();
    if (!key) return "";

    const ivBuffer = base64ToBuffer(parsed.iv);
    const dataBuffer = base64ToBuffer(parsed.data);

    const plainBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: new Uint8Array(ivBuffer),
      },
      key,
      dataBuffer
    );

    return TEXT_DECODER.decode(plainBuffer);
  } catch {
    return "";
  }
};

export const __testables__ = {
  bufferToBase64,
  base64ToBuffer,
  ensureSalt,
  deriveCryptoKey,
};

export default {
  encryptString,
  decryptString,
};
