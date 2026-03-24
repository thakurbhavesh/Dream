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
