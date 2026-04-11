import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY = 'offline_message_queue';

// Get queued messages
export const getQueue = async () => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

// Add message to queue
export const enqueue = async (msg) => {
  const queue = await getQueue();
  queue.push({ ...msg, _queuedAt: Date.now(), _retries: 0 });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

// Remove message from queue
export const dequeue = async (tempId) => {
  const queue = await getQueue();
  const filtered = queue.filter(m => m.id !== tempId);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
};

// Clear entire queue
export const clearQueue = async () => {
  await AsyncStorage.removeItem(QUEUE_KEY);
};

// Check if online
export const isOnline = async () => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected && state.isInternetReachable !== false;
  } catch { return true; }
};

// Process queue — retry sending all queued messages
export const processQueue = async (sendFn) => {
  const online = await isOnline();
  if (!online) return { sent: 0, failed: 0 };

  const queue = await getQueue();
  if (!queue.length) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const remaining = [];

  for (const msg of queue) {
    try {
      await sendFn(msg);
      sent++;
    } catch {
      msg._retries = (msg._retries || 0) + 1;
      // Keep in queue if < 10 retries
      if (msg._retries < 10) remaining.push(msg);
      else failed++;
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return { sent, failed, remaining: remaining.length };
};
