/**
 * chatApi.js
 * All /chat backend calls. Returns normalized data ready for threadService.
 */
import { API_BASE_URL } from "../config/apiBaseUrl";
import { fetchWithAuth, getAccessToken } from "../utils/authApi";

const BASE = `${API_BASE_URL}/chat`;

// ─── Organizations ────────────────────────────────────────────────────────────

/**
 * Fetch all organizations the authenticated user is an active member of.
 */
export const fetchUserOrganizations = async () => {
  const { response, payload } = await fetchWithAuth(`${BASE}/organizations`);
  if (!response.ok) throw new Error(payload?.message ?? "Failed to fetch organizations");
  return payload?.data?.organizations ?? [];
};

// ─── Threads ──────────────────────────────────────────────────────────────────

/**
 * Fetch all threads (DMs + groups) for the authenticated user in a specific org.
 * Returns { threads, orgId } where threads are already normalized.
 * @param {number|string} orgId  Optional — defaults to the token org on the backend
 */
export const fetchThreads = async (orgId) => {
  const url = orgId ? `${BASE}/threads?org_id=${orgId}` : `${BASE}/threads`;
  const { response, payload } = await fetchWithAuth(url);
  if (!response.ok) throw new Error(payload?.message ?? "Failed to fetch threads");
  return payload?.data ?? { threads: [], orgId: null };
};

/**
 * Fetch contacts (org members) to start new DMs.
 */
export const fetchContacts = async () => {
  const { response, payload } = await fetchWithAuth(`${BASE}/contacts`);
  if (!response.ok) throw new Error(payload?.message ?? "Failed to fetch contacts");
  return payload?.data?.contacts ?? [];
};

// ─── Messages ─────────────────────────────────────────────────────────────────

/**
 * Fetch messages for a thread.
 * @param {string} threadId  e.g. "dm-42" or "group-7"
 * @param {{ limit?: number, before?: string }} opts
 */
export const fetchMessages = async (threadId, { limit = 50, before, fullResponse = false } = {}) => {
  const params = new URLSearchParams({ limit });
  if (before) params.set("before", before);

  const { response, payload } = await fetchWithAuth(
    `${BASE}/threads/${encodeURIComponent(threadId)}/messages?${params}`
  );
  if (!response.ok) throw new Error(payload?.message ?? "Failed to fetch messages");
  if (fullResponse) {
    const messages = payload?.data?.messages ?? [];
    const hasMore = payload?.data?.hasMore ?? (messages.length >= limit);
    return { messages, hasMore };
  }
  return payload?.data?.messages ?? [];
};

/**
 * Leave a group.
 */
export const leaveGroup = async (groupId) => {
  const { response, payload } = await fetchWithAuth(
    `${BASE}/groups/${groupId}/leave`,
    { method: "POST" }
  );
  if (!response.ok) throw new Error(payload?.message ?? "Failed to leave group");
  return payload?.data ?? {};
};

/**
 * Soft-hide a group from the caller's chat list (local-to-user action).
 * Does NOT leave or delete the group; only sets the user-scoped flag so the
 * thread stops appearing in their list across sessions and devices.
 */
export const hideGroupThread = async (groupId) => {
  const { response, payload } = await fetchWithAuth(
    `${BASE}/groups/${groupId}/hide`,
    { method: "POST" }
  );
  if (!response.ok) throw new Error(payload?.message ?? "Failed to hide chat");
  return payload?.data ?? {};
};

export const unhideGroupThread = async (groupId) => {
  const { response, payload } = await fetchWithAuth(
    `${BASE}/groups/${groupId}/unhide`,
    { method: "POST" }
  );
  if (!response.ok) throw new Error(payload?.message ?? "Failed to restore chat");
  return payload?.data ?? {};
};

/**
 * Get group timeline.
 */
export const fetchGroupTimeline = async (groupId, { limit = 50, offset = 0 } = {}) => {
  const params = new URLSearchParams({ limit, offset });
  const { response, payload } = await fetchWithAuth(
    `${BASE}/groups/${groupId}/timeline?${params}`
  );
  if (!response.ok) throw new Error(payload?.message ?? "Failed to fetch timeline");
  return payload?.data?.timeline ?? [];
};

/**
 * Get group info including membership status.
 */
export const fetchGroupInfo = async (groupId) => {
  const { response, payload } = await fetchWithAuth(
    `${BASE}/groups/${groupId}/info`
  );
  if (!response.ok) throw new Error(payload?.message ?? "Failed to fetch group info");
  return payload?.data ?? {};
};

/**
 * Create a group with members in one API call.
 * @returns {{ group, groupId, threadId, memberCount }}
 */
export const createGroup = async ({ name, description, members }) => {
  const { response, payload } = await fetchWithAuth(
    `${BASE}/groups/create`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, members }),
    }
  );
  if (!response.ok) throw new Error(payload?.message ?? "Failed to create group");
  return payload?.data ?? {};
};

/**
 * Send a message to a thread.
 */
export const sendMessage = async (threadId, { message, message_type = "text", metadata = null }) => {
  const { response, payload } = await fetchWithAuth(
    `${BASE}/threads/${encodeURIComponent(threadId)}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, message_type, metadata }),
    }
  );
  if (!response.ok) throw new Error(payload?.message ?? "Failed to send message");
  return payload?.data ?? null;
};

/**
 * Mark all messages in a thread as read.
 */
export const markThreadRead = async (threadId) => {
  const { response } = await fetchWithAuth(
    `${BASE}/threads/${encodeURIComponent(threadId)}/read`,
    { method: "POST" }
  );
  return response.ok;
};

/**
 * Edit a DM message.
 */
export const editMessage = async (messageId, newText) => {
  const { response, payload } = await fetchWithAuth(
    `${BASE}/messages/${messageId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: newText }),
    }
  );
  if (!response.ok) throw new Error(payload?.message ?? "Failed to edit message");
  return payload?.data ?? null;
};

/**
 * Delete a DM message.
 */
export const deleteMessage = async (messageId) => {
  const { response, payload } = await fetchWithAuth(
    `${BASE}/messages/${messageId}`,
    { method: "DELETE" }
  );
  if (!response.ok) throw new Error(payload?.message ?? "Failed to delete message");
  return true;
};

// ─── Thread Media (Images, Links, Docs, Pinned) ─────────────────────────────

/**
 * Fetch media/links/docs/pinned messages for a thread from full DB.
 * @param {string} threadId - e.g. "dm-42" or "group-7"
 * @param {string} type - "images" | "media" | "links" | "docs" | "pinned" | "all"
 */
export const fetchThreadMedia = async (threadId, type = "all") => {
  const params = new URLSearchParams({ type });
  const { response, payload } = await fetchWithAuth(
    `${BASE}/threads/${encodeURIComponent(threadId)}/media?${params}`
  );
  if (!response.ok) throw new Error(payload?.message ?? "Failed to fetch media");
  return payload?.data ?? { messages: [], counts: {} };
};

// ─── Search ──────────────────────────────────────────────────────────────────

/**
 * Search messages across all threads or within a specific thread.
 * @param {string} query - Search text (min 2 chars, or empty if types provided)
 * @param {{ threadId?: string, limit?: number, types?: string[] }} opts
 */
export const searchMessages = async (query, { threadId, limit = 50, types } = {}) => {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("limit", limit);
  if (threadId) params.set("threadId", threadId);
  if (types?.length) params.set("types", types.join(","));

  const { response, payload } = await fetchWithAuth(
    `${BASE}/search?${params}`
  );
  if (!response.ok) throw new Error(payload?.message ?? "Search failed");
  return payload?.data ?? { results: [], query, total: 0 };
};

// ─── AI Smart Search ─────────────────────────────────────────────────────────

/**
 * AI-powered natural language search.
 * @param {string} query - Natural language query like "files shared by Bhavesh last week"
 * @param {{ threadId?: string, limit?: number }} opts
 */
export const smartSearchMessages = async (query, { threadId, limit = 50 } = {}) => {
  const { response, payload } = await fetchWithAuth(
    `${BASE}/smart-search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, threadId, limit }),
    }
  );
  if (!response.ok) throw new Error(payload?.message ?? "Smart search failed");
  return payload?.data ?? { results: [], filters: {}, total: 0 };
};

// ─── AI Smart Reply ──────────────────────────────────────────────────────────

/**
 * Get AI-powered smart reply suggestions for an incoming message.
 * @param {string} message - The incoming message text
 * @param {{ context?: Array, senderName?: string }} opts
 * @returns {Promise<string[]>} Array of 3 reply suggestions
 */
export const fetchSmartReplies = async (message, { context = [], senderName = "" } = {}) => {
  const { response, payload } = await fetchWithAuth(
    `${API_BASE_URL}/translate/smart-reply`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, context, senderName }),
    }
  );
  if (!response.ok) throw new Error(payload?.message ?? "Smart reply failed");
  return payload?.data?.suggestions ?? [];
};

// ─── Translate ───────────────────────────────────────────────────────────────

/**
 * Translate text via backend (Gemini or OpenAI).
 * @param {string} text
 * @param {string} targetLanguage  e.g. "Hindi", "English", "Spanish"
 */
export const translateText = async (text, targetLanguage = "English") => {
  const { response, payload } = await fetchWithAuth(
    `${API_BASE_URL}/translate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, targetLanguage }),
    }
  );
  if (!response.ok) throw new Error(payload?.message ?? "Translation failed");
  return payload?.data?.translated ?? text;
};

// ─── AI Tone Adjuster ────────────────────────────────────────────────────────

export const toneAdjustText = async (text, tone = "formal") => {
  const { response, payload } = await fetchWithAuth(
    `${API_BASE_URL}/translate/tone-adjust`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, tone }),
    }
  );
  if (!response.ok) throw new Error(payload?.message ?? "Tone adjustment failed");
  return payload?.data ?? {};
};

// ─── AI Semantic Search ──────────────────────────────────────────────────────

export const semanticSearchMessages = async (query, { threadId, limit = 50 } = {}) => {
  const { response, payload } = await fetchWithAuth(
    `${API_BASE_URL}/translate/semantic-search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, threadId, limit }),
    }
  );
  if (!response.ok) throw new Error(payload?.message ?? "Semantic search failed");
  return payload?.data ?? { results: [], interpretation: "", expandedTerms: [] };
};

// ─── AI Call Notes ───────────────────────────────────────────────────────────

export const generateCallNotes = async ({ callDuration, participants = [], chatContext = [] } = {}) => {
  const { response, payload } = await fetchWithAuth(
    `${API_BASE_URL}/translate/call-notes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callDuration, participants, chatContext }),
    }
  );
  if (!response.ok) throw new Error(payload?.message ?? "Call notes generation failed");
  return payload?.data ?? {};
};

// ─── AI Smart Composer ───────────────────────────────────────────────────────

export const fetchSmartCompose = async (partialText, { context = [], threadType = "dm" } = {}) => {
  const { response, payload } = await fetchWithAuth(
    `${API_BASE_URL}/translate/smart-compose`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partialText, context, threadType }),
    }
  );
  if (!response.ok) throw new Error(payload?.message ?? "Smart compose failed");
  return payload?.data?.completions ?? [];
};

// ─── AI Voice-to-Text (Audio Transcription) ─────────────────────────────────
export const transcribeAudio = async ({ fileUrl, fileKey, fileName } = {}) => {
  const { response, payload } = await fetchWithAuth(
    `${API_BASE_URL}/translate/transcribe-audio`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileUrl, fileKey, fileName }),
    }
  );
  if (!response.ok) throw new Error(payload?.message ?? "Audio transcription failed");
  return payload?.data ?? {};
};

// ─── GIF Search (Tenor) ──────────────────────────────────────────────────────

/**
 * Search GIFs via backend Tenor proxy.
 */
export const searchGifs = async (query, { limit = 20 } = {}) => {
  const params = new URLSearchParams({ q: query, limit });
  const { response, payload } = await fetchWithAuth(
    `${API_BASE_URL}/gifs/search?${params}`
  );
  if (!response.ok) throw new Error(payload?.message ?? "GIF search failed");
  return payload?.data ?? { gifs: [], next: "" };
};

/**
 * Fetch trending GIFs via backend Tenor proxy.
 */
export const fetchTrendingGifs = async ({ limit = 20 } = {}) => {
  const params = new URLSearchParams({ limit });
  const { response, payload } = await fetchWithAuth(
    `${API_BASE_URL}/gifs/trending?${params}`
  );
  if (!response.ok) throw new Error(payload?.message ?? "GIF fetch failed");
  return payload?.data ?? { gifs: [], next: "" };
};

// ─── File Upload ─────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB

/**
 * Upload a file to S3 via backend for chat (no progress).
 * @param {File} file
 * @returns {{ file_key, file_url, file_name, file_type, file_size }}
 */
export const uploadChatFile = async (file) => {
  if (file.size > MAX_FILE_SIZE) throw new Error("File exceeds 2 GB limit");
  const formData = new FormData();
  formData.append("file", file);
  const { response, payload } = await fetchWithAuth(
    `${API_BASE_URL}/upload/chat-file`,
    { method: "POST", body: formData }
  );
  if (!response.ok) throw new Error(payload?.message ?? "File upload failed");
  return payload?.data ?? null;
};

/**
 * Upload a file with progress tracking via XHR.
 * @param {File} file
 * @param {object} options
 * @param {(percent: number) => void} options.onProgress  - 0–100
 * @param {AbortSignal} [options.signal] - optional abort signal
 * @returns {Promise<{ file_key, file_url, file_name, file_type, file_size }>}
 */
export const uploadChatFileWithProgress = async (file, { onProgress, onS3Progress, signal, uploadId } = {}) => {
  if (file.size > MAX_FILE_SIZE) throw new Error("File exceeds 2 GB limit");

  const token = await getAccessToken();
  const formData = new FormData();
  formData.append("file", file);
  if (uploadId) formData.append("uploadId", uploadId);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/upload/chat-file`);
    xhr.withCredentials = true;
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(res?.data ?? null);
        } else {
          reject(new Error(res?.message ?? "File upload failed"));
        }
      } catch {
        reject(new Error("File upload failed"));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload network error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    if (signal) {
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(formData);
  });
};
