import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  threads: 'cache:threads',
  messages: (threadId) => `cache:msg:${threadId}`,
  profile: (userId) => `cache:profile:${userId}`,
};

const MAX_MESSAGES = 50;
const MAX_THREADS = 50;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// TTL wrapper — save with timestamp
const setWithTTL = async (key, data) => {
  await AsyncStorage.setItem(key, JSON.stringify({ _ts: Date.now(), data }));
};
const getWithTTL = async (key) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Check TTL — if has _ts field
    if (parsed._ts && Date.now() - parsed._ts > CACHE_TTL_MS) {
      await AsyncStorage.removeItem(key); // expired
      return null;
    }
    return parsed.data || parsed; // backward compat (old cache without _ts)
  } catch { return null; }
};

// ─── Threads ────────────────────────────────────────────────────────────────

export const getCachedThreads = async () => {
  return getWithTTL(KEYS.threads);
};

export const cacheThreads = async (threads) => {
  try {
    const trimmed = (threads || []).slice(0, MAX_THREADS);
    await setWithTTL(KEYS.threads, trimmed);
  } catch {}
};

export const updateCachedThread = async (threadId, updates) => {
  try {
    const threads = await getCachedThreads();
    if (!threads) return;
    const idx = threads.findIndex(t => t.id === threadId);
    if (idx === -1) return;
    threads[idx] = { ...threads[idx], ...updates };
    // Re-write through the TTL wrapper so the cache keeps its 24h expiry;
    // a raw setItem here would strip the _ts envelope and turn the cache
    // into immortal storage.
    await setWithTTL(KEYS.threads, threads);
  } catch {}
};

// ─── Messages ───────────────────────────────────────────────────────────────

export const getCachedMessages = async (threadId) => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.messages(threadId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const cacheMessages = async (threadId, messages) => {
  try {
    // Keep last MAX_MESSAGES only
    const trimmed = (messages || []).slice(-MAX_MESSAGES);
    await AsyncStorage.setItem(KEYS.messages(threadId), JSON.stringify(trimmed));
  } catch {}
};

export const appendCachedMessage = async (threadId, message) => {
  try {
    const existing = await getCachedMessages(threadId) || [];
    // Deduplicate by id
    if (message.id && existing.some(m => m.id === message.id)) return;
    const updated = [...existing, message].slice(-MAX_MESSAGES);
    await AsyncStorage.setItem(KEYS.messages(threadId), JSON.stringify(updated));
  } catch {}
};

export const updateCachedMessage = async (threadId, messageId, updates) => {
  try {
    const messages = await getCachedMessages(threadId);
    if (!messages) return;
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx === -1) return;
    messages[idx] = { ...messages[idx], ...updates };
    await AsyncStorage.setItem(KEYS.messages(threadId), JSON.stringify(messages));
  } catch {}
};

// ─── Profile ────────────────────────────────────────────────────────────────

export const getCachedProfile = async (userId) => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.profile(userId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const cacheProfile = async (userId, profile) => {
  try {
    await AsyncStorage.setItem(KEYS.profile(userId), JSON.stringify(profile));
  } catch {}
};

// ─── Clear ──────────────────────────────────────────────────────────────────

export const clearAllCache = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith('cache:'));
    if (cacheKeys.length) await AsyncStorage.multiRemove(cacheKeys);
  } catch {}
};
