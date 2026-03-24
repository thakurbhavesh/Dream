import { API_BASE_URL } from "../../config/apiBaseUrl";
import { fetchWithAuth } from "../../utils/authApi";

// ─── helpers ────────────────────────────────────────────────────────────────

const buildQuery = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  });
  return q.toString();
};

const resolveOrganizationId = () => {
  if (typeof window === "undefined") return null;
  for (const key of ["organization", "organization_id", "organizationId"]) {
    const parsed = Number(window.localStorage.getItem(key));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const getEndpoint = async (path, query = {}) => {
  const qs = buildQuery(query);
  const url = qs ? `${API_BASE_URL}${path}?${qs}` : `${API_BASE_URL}${path}`;
  const { response, payload } = await fetchWithAuth(url, { method: "GET" });
  if (!response.ok) throw new Error(payload?.message || `Failed: ${path}`);
  return payload;
};

const toRows = (payload) => {
  const data = payload?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const toNum = (v, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const mbToGb = (mb) => (toNum(mb) / 1024).toFixed(2);

// ─── fetchWorkspaceState ────────────────────────────────────────────────────
/**
 * Fetches the current workspace state by calling existing admin endpoints.
 * Returns a plain object consumed by buildWorkspaceContext().
 */
export const fetchWorkspaceState = async () => {
  const orgId = resolveOrganizationId();
  const common = { organization_id: orgId || undefined, limit: 200, offset: 0 };

  const safeGet = (path, query) => getEndpoint(path, query).catch(() => null);
  const [orgRes, usersRes, groupsRes] = await Promise.allSettled([
    safeGet("/auth/organization-details", { organization_id: orgId || undefined }),
    safeGet("/users", { ...common, all: true }),
    safeGet("/groups", common),
  ]);

  const orgData = orgRes.status === "fulfilled" ? orgRes.value?.data || {} : {};
  const userRows = usersRes.status === "fulfilled" ? toRows(usersRes.value) : [];
  const groupRows = groupsRes.status === "fulfilled" ? toRows(groupsRes.value) : [];

  const org = orgData?.organization || {};
  const plan = orgData?.current_plan || {};
  const usage = orgData?.usage || {};
  const counts = orgData?.counts || {};

  const maxUsers = toNum(plan?.max_users);
  const activeMembers = toNum(counts?.active_members);

  return {
    organization: org?.name || "Your Organisation",
    plan: plan?.plan_name || plan?.name || "—",
    licenses: {
      total: maxUsers,
      used: activeMembers,
      available: maxUsers - activeMembers,
    },
    storage: {
      usedGb: mbToGb(usage?.storage_used_mb),
      totalGb: mbToGb(usage?.storage_limit_mb),
    },
    planExpiry: plan?.expires_at || plan?.end_date || "—",
    daysRemaining: plan?.days_remaining ?? "—",
    homeDomain: org?.home_domain || "—",
    globalDomain: org?.global_domain || "—",
    activeUsers: activeMembers,
    globalMembers: toNum(counts?.global_members),
    exMembers: toNum(counts?.left_members),
    currentStatus: plan?.status || "active",
    users: userRows.slice(0, 100).map((u) => ({
      email: u.email || "",
      name: u.name || "",
      designation: u.designation_name || u.designation || "",
      department: u.department_name || u.department || "",
      location: u.location_name || u.location || "",
      status: u.user_status || u.membership_status || u.status || "",
    })),
    groups: groupRows.map((g) => ({
      name: g.group_name || g.name || "",
      members: toNum(g.active_member_count || g.members),
      isAirtime: Boolean(g.is_airtime),
    })),
  };
};

// ─── buildWorkspaceContext ──────────────────────────────────────────────────
/**
 * Converts the workspace state object into a formatted string
 * that is injected into the Live Assistant system prompt.
 */
export const buildWorkspaceContext = (ws) => {
  if (!ws) return "";

  const userList = ws.users.length
    ? ws.users
        .map(
          (u) =>
            `  - ${u.email}${u.name ? ` (${u.name})` : ""}${u.designation ? `, ${u.designation}` : ""}${u.department ? `, ${u.department}` : ""}${u.location ? ` — ${u.location}` : ""}${u.status ? ` [${u.status}]` : ""}`,
        )
        .join("\n")
    : "  (no users listed)";

  const groupList = ws.groups.length
    ? ws.groups
        .map(
          (g) =>
            `  - ${g.name} (${g.members} members${g.isAirtime ? ", Airtime enabled" : ""})`,
        )
        .join("\n")
    : "  (no groups listed)";

  return `
Workspace State:
• Organization: ${ws.organization}
• Plan: ${ws.plan}
• Licenses: ${ws.licenses.total} total (${ws.licenses.used} used / ${ws.licenses.available} available)
• Storage: ${ws.storage.usedGb} GB used / ${ws.storage.totalGb} GB allocated
• Plan Expiry: ${ws.planExpiry}
• Days Remaining: ${ws.daysRemaining}
• Home Domain: ${ws.homeDomain}
• Global Domain: ${ws.globalDomain}
• Active Users: ${ws.activeUsers}
${userList}
• Active Groups: ${ws.groups.length}
${groupList}
• Global Members: ${ws.globalMembers}
• Ex-Members: ${ws.exMembers}
• Current Status: ${ws.currentStatus}
`.trim();
};

// ─── SYSTEM PROMPT ──────────────────────────────────────────────────────────
export const LIVE_ASSISTANT_SYSTEM_PROMPT = `
You are **TeamChatX AI Assistant** — an intelligent, professional support agent embedded inside the TeamChatX messaging platform.

LANGUAGE RULE: Always reply in the SAME language as the user's message. English→English, Hindi→Hindi, Hinglish→Hinglish. Never switch.

You help users with EVERYTHING about TeamChatX — chat features, admin tasks, and how-to guidance.

═══ CHAT FEATURES YOU KNOW ═══

**Messaging:**
- Send text, emoji, images, videos, audio, files (up to 2GB), code snippets, links
- Rich text formatting: Bold (Ctrl+B), Italic (Ctrl+I), Underline (Ctrl+U)
- Reply to messages: Click reply icon or swipe right on a message
- Forward messages: Right-click → Forward → Select thread
- Edit sent messages: Right-click → Edit (time limit may apply)
- Delete/Recall messages: Right-click → Delete (for you) or Unsend (for everyone)
- Pin messages: Right-click → Pin. Pinned messages visible in sidebar
- React with emoji: Hover → emoji icon → pick reaction
- Copy messages: Right-click → Copy

**Message Status (Ticks):**
- Single tick (✓) = Sent, receiver offline
- Double tick (✓✓) = Delivered, receiver came online
- Green double tick (✓✓) = Read, receiver opened chat

**Search:**
- Press Ctrl+F or click search icon in chat header
- Normal Search: keyword match across full database
- Smart Search: Toggle "Smart" switch → type natural language like "files shared by Bhavesh last week"
- Filter by: Text, Image, Video, File, Link, Audio, Code type buttons
- Filter by user, date range, exact match

**AI Features:**
- Smart Reply: Click Reply on any message → AI suggests 3 professional replies → Click to insert in input
- Summarize: Right-click message → Summarize → AI generates 3-5 bullet point summary (works on text, PDF, DOCX, images)
- Translate: Right-click message → Translate → Choose target language
- AI Grammar: Click magic wand (✨) icon in footer toolbar → Type → AI auto-corrects grammar after 1.5s pause → Accept/Dismiss
- Smart Search: Toggle in search bar for natural language queries

**File Sharing:**
- Drag & drop or click attachment icon (📎)
- Supported: All file types except dangerous ones (.exe, .bat, .dll, .msi, etc.)
- Max size: 2GB per file
- File preview: Click any file in Media panel → full preview (images, PDFs, Office docs, code files, video, audio)

**Profile & Settings:**
- Profile: Click profile icon (bottom-left sidebar) → Edit timezone, view details
- Timezone: Profile → Timezone dropdown → All chat times adjust to your timezone
- Wallpapers: Settings → Wallpapers → Choose chat background
- Notifications: Settings → Notifications & Privacy
- Devices: Settings → Devices & Sessions → See all logged-in devices

**Groups:**
- Create group: Click group icon in chat list header
- Group features: Add/remove members, change name/description, group image
- Leave/Exit group from group info sidebar

**Media, Links & Docs:**
- Click user name in chat header → Opens profile sidebar
- "Media, Links & Docs" section shows ALL shared files from complete database
- Tabs: Images, Media (video/audio), Links, Docs
- Click any file → Preview overlay with navigation arrows

**Pinned Messages:**
- Pin: Right-click → Pin
- View: Profile sidebar → Pinned Messages section
- Pinned messages persist across reload

═══ ADMIN FEATURES ═══

- User management: Add/edit/deactivate users
- Groups management: Create, configure, manage members
- Billing: Plans, payment gateways, invoices
- Organization controls: Message permissions, restrictions
- AI Providers: Owner Dashboard → System Monitoring → AI Providers (configure Gemini/OpenAI/Claude)
- SMTP Settings, Site Details, Roles, etc.

═══ HOW TO RESPOND ═══

- Give step-by-step instructions with clear numbered steps
- Use keyboard shortcuts where applicable
- Be concise but complete
- If workspace data is available, use it to give specific answers
RESPONSE FORMAT:
- At the very end of EVERY response, add a line with exactly this format:
  [SUGGESTIONS]: question1 | question2 | question3
- These should be 2-3 short, relevant follow-up questions the user might ask next
- Example: [SUGGESTIONS]: How to pin a message? | What are keyboard shortcuts? | How to search old messages?
- The suggestions line will be parsed and shown as clickable chips
`.trim();

// ─── buildRoleAwarePrompt ────────────────────────────────────────────────────
export const buildRoleAwarePrompt = (roleId) => {
  const role = Number(roleId) || 4;
  let scopeNote = '';
  if (role === 1) {
    scopeNote = `\n\nUSER ROLE: Owner (Super Admin). This user has access to EVERYTHING — chat, admin panel, owner dashboard, billing, AI providers, system monitoring. Give full guidance on all features.`;
  } else if (role === 2) {
    scopeNote = `\n\nUSER ROLE: Admin. This user has access to chat features + admin panel (user management, groups, controls). They CANNOT access: billing, plans, payment gateways, owner dashboard, AI providers. Do NOT guide them on owner-only features.`;
  } else {
    scopeNote = `\n\nUSER ROLE: Regular User. This user has access to CHAT FEATURES ONLY — messaging, search, AI features, files, profile settings, groups. They CANNOT access: admin panel, user management, billing, or any admin/owner features. Do NOT mention admin panel or owner dashboard. Only guide on chat-related features.`;
  }
  return LIVE_ASSISTANT_SYSTEM_PROMPT + scopeNote;
};

// ─── askAssistant ───────────────────────────────────────────────────────────
/**
 * Sends the conversation to the backend /live-assistant/chat endpoint.
 * The backend is responsible for calling the AI model (e.g., Claude).
 *
 * @param {Array<{role: "user"|"assistant", content: string}>} messages
 * @param {string} workspaceContext  - formatted workspace state string
 * @returns {Promise<string>}        - assistant reply text
 */
export const askAssistant = async (messages, workspaceContext, customPrompt) => {
  const { response, payload } = await fetchWithAuth(
    `${API_BASE_URL}/live-assistant/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        systemPrompt: customPrompt || LIVE_ASSISTANT_SYSTEM_PROMPT,
        workspaceContext,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(payload?.message || "Live Assistant is currently unavailable.");
  }

  return payload?.data?.reply || payload?.reply || "";
};

// ─── Feedback ────────────────────────────────────────────────────────────────
export const submitFeedback = async ({ messageText, responseText, rating }) => {
  await fetchWithAuth(`${API_BASE_URL}/live-assistant/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageText, responseText, rating }),
  });
};

// ─── Conversations ──────────────────────────────────────────────────────────
export const saveConversation = async ({ title, messages }) => {
  const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/live-assistant/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, messages }),
  });
  if (!response.ok) throw new Error(payload?.message || "Failed to save");
  return payload?.data?.conversation;
};

export const updateConversation = async (id, { title, messages }) => {
  const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/live-assistant/conversations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, messages }),
  });
  if (!response.ok) throw new Error(payload?.message || "Failed to update");
  return payload?.data?.conversation;
};

export const listConversations = async () => {
  const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/live-assistant/conversations`);
  if (!response.ok) throw new Error(payload?.message || "Failed to load");
  return payload?.data?.conversations || [];
};

export const getConversation = async (id) => {
  const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/live-assistant/conversations/${id}`);
  if (!response.ok) throw new Error(payload?.message || "Failed to load");
  return payload?.data?.conversation;
};

export const deleteConversation = async (id) => {
  await fetchWithAuth(`${API_BASE_URL}/live-assistant/conversations/${id}`, { method: "DELETE" });
};
