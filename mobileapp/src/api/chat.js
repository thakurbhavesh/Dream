import api from './config';

export const getThreads = async () => {
  const { data } = await api.get('/chat/threads');
  return data?.data || data;
};

export const getContacts = async () => {
  const { data } = await api.get('/chat/contacts');
  return data?.data || data;
};

export const getMessages = async (threadId, { limit = 50, before } = {}) => {
  const params = { limit };
  if (before) params.before = before;
  const { data } = await api.get(`/chat/threads/${threadId}/messages`, { params });
  return data?.data || data;
};

export const sendMessageRest = async (threadId, message, messageType = 'text', metadata = null) => {
  const { data } = await api.post(`/chat/threads/${threadId}/messages`, {
    message,
    message_type: messageType,
    metadata,
  });
  return data?.data || data;
};

export const markRead = async (threadId) => {
  const { data } = await api.post(`/chat/threads/${threadId}/read`);
  return data?.data || data;
};

export const uploadFile = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    type: file.mimeType || file.type || 'application/octet-stream',
    name: file.name || file.fileName || 'file',
  });
  const { data } = await api.post('/upload/chat-file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return data?.data || data;
};

export const searchMessages = async (query, threadId) => {
  const params = { q: query };
  if (threadId) params.threadId = threadId;
  const { data } = await api.get('/chat/search', { params });
  return data?.data || data;
};

// ─── Organizations ──────────────────────────────────────────────────────
export const getOrganizations = async () => {
  const { data } = await api.get('/chat/organizations');
  return data?.data?.organizations || data?.organizations || [];
};

// ─── Hidden group threads ───────────────────────────────────────────────
export const hideGroupThread = async (groupId) => {
  const { data } = await api.post(`/chat/groups/${groupId}/hide`);
  return data?.data || data;
};

export const unhideGroupThread = async (groupId) => {
  const { data } = await api.post(`/chat/groups/${groupId}/unhide`);
  return data?.data || data;
};

// ─── AI per-message tools (mirror /translate endpoints) ─────────────────
export const aiTranslate = async (text, targetLanguage) => {
  const { data } = await api.post('/translate', { text, targetLanguage });
  return data?.data || data;
};

export const aiSummarize = async ({ text, fileUrl, fileName, fileType, fileKey, previousSummary } = {}) => {
  const { data } = await api.post('/translate/summarize', {
    text, fileUrl, fileName, fileType, fileKey, previousSummary,
  });
  return data?.data || data;
};

export const aiToneAdjust = async (text, tone = 'professional') => {
  const { data } = await api.post('/translate/tone-adjust', { text, tone });
  return data?.data || data;
};

export const aiSmartReplies = async (message, { context, senderName } = {}) => {
  const { data } = await api.post('/translate/smart-reply', { message, context, senderName });
  return data?.data || data;
};

export const aiSmartCompose = async (partialText, { context, threadType } = {}) => {
  const { data } = await api.post('/translate/smart-compose', { partialText, context, threadType });
  return data?.data || data;
};

// ─── Semantic / Smart search ────────────────────────────────────────────
export const semanticSearchMessages = async (query, { threadId, limit = 50 } = {}) => {
  const { data } = await api.post('/translate/semantic-search', { query, threadId, limit });
  return data?.data || data;
};

export const smartSearchMessages = async (query, { threadId, limit = 50 } = {}) => {
  const { data } = await api.post('/chat/smart-search', { query, threadId, limit });
  return data?.data || data;
};

// ─── Push subscription (Expo token) ─────────────────────────────────────
// Reuses the same /push/subscribe endpoint as web; we encode the Expo
// token inside the subscription.endpoint with an "expo:" prefix so the
// backend dispatcher can route correctly.
export const registerExpoPushSubscription = async (expoToken) => {
  if (!expoToken) return null;
  const subscription = {
    endpoint: `expo:${expoToken}`,
    keys: { p256dh: '', auth: '' },
  };
  const { data } = await api.post('/push/subscribe', { subscription });
  return data?.data || data;
};

export const unregisterExpoPushSubscription = async (expoToken) => {
  if (!expoToken) return null;
  const { data } = await api.post('/push/unsubscribe', { endpoint: `expo:${expoToken}` });
  return data?.data || data;
};
