# TeamChatX AI Assistant — Enhancement Tasks

Status: ✅ = Done | 🔲 = Pending

---

## Current State (Already Implemented)

| # | Feature | Status |
|---|---|---|
| 1 | Basic AI Chat (text Q&A) | ✅ |
| 2 | Role-Aware Responses (User/Admin/Owner) | ✅ |
| 3 | Workspace Context (live users, groups, plan data) | ✅ |
| 4 | Multi-Provider Support (Gemini/OpenAI/Claude from DB) | ✅ |
| 5 | Language Match (English/Hindi/Hinglish) | ✅ |
| 6 | Sidebar Toggle (robot icon in left sidebar) | ✅ |
| 7 | Chat Feature Knowledge (messaging, search, AI, files) | ✅ |
| 8 | New Chat / Reset Button | ✅ |
| 9 | Markdown Rendering (bold, italic, code blocks) | ✅ |
| 10 | Loading Animation (typing dots) | ✅ |
| 11 | Suggested Questions (clickable follow-up chips) | ✅ |
| 12 | Feedback Buttons (👍👎 stored in DB) | ✅ |
| 13 | Code Snippets Highlight (language label + copy) | ✅ |
| 14 | Dark/Light Theme Sync | ✅ |
| 15 | Multi-language Welcome (Hindi/English auto-detect) | ✅ |
| 16 | Resize Panel (Small/Medium/Large) | ✅ |
| 17 | Close Button (X with sidebar sync) | ✅ |
| 18 | Conversation History DB (auto-save JSONB) | ✅ |
| 19 | History Panel (load/delete past conversations) | ✅ |
| 20 | Usage Tracking (response time + question count) | ✅ |
| 21 | Feedback Analytics (assistant_feedback table) | ✅ |

---

## Enhancement Tasks (Serial Order)

### Phase 1 — Core UX Improvements

| #  | Feature                           | Description                                                                                                                                              | Priority |
| -- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 11 | **Suggested Questions**     | After every AI response, show 2-3 clickable follow-up question chips below the message. AI generates relevant next questions. User clicks → auto-sends. | High     |
| 12 | **Feedback Buttons**        | Every AI response gets 👍👎 buttons. Click stores rating in DB (`assistant_feedback` table). Helps track quality.                                      | High     |
| 13 | **Code Snippets Highlight** | Detect code blocks in AI responses (``...``) and render with syntax highlighting, copy button, and language label.                                       | High     |
| 14 | **Dark/Light Theme Sync**   | Assistant panel auto-matches app's current theme. Already partially done (uses `useTheme`), needs polish for all elements.                             | Medium   |
| 15 | **Multi-language Welcome**  | On first open, detect user's browser/profile language. Show welcome message in that language (English/Hindi/Hinglish).                                   | Medium   |

### Phase 2 — Smart Features

| #  | Feature                         | Description                                                                                                                                      | Priority |
| -- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 16 | **Quick Action Buttons**  | AI response includes clickable action buttons like "Open Chat", "Go to Settings", "Open Admin Panel". Clicking navigates to that page/feature.   | High     |
| 17 | **Shortcuts Cheat Sheet** | User says "show shortcuts" or "keyboard shortcuts" → AI returns formatted table of all TeamChatX keyboard shortcuts (Ctrl+F, Ctrl+B/I/U, etc.). | High     |
| 18 | **Typing Animation**      | Word-by-word streaming effect like ChatGPT. Response appears progressively instead of all at once. Makes long responses feel faster.             | Medium   |
| 19 | **Chat History Persist**  | Save assistant conversation in localStorage/secureStorage. On reload, conversation persists. Clear on "Reset" only.                              | Medium   |
| 20 | **Export Chat**           | Button in assistant header to download entire conversation as `.txt` or `.pdf` file. Useful for saving troubleshooting steps.                | Low      |

### Phase 3 — Advanced Features

| #  | Feature                             | Description                                                                                                                                                   | Priority |
| -- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 21 | **Voice Input**               | Mic button next to send. Uses Web Speech API (browser native) for speech-to-text. User speaks → text appears in input → send. Works in English/Hindi.       | High     |
| 22 | **Image/Screenshot Analysis** | Paste/upload screenshot in assistant chat. AI analyzes the image and explains what it shows, identifies errors, suggests fixes. Uses Gemini Vision.           | High     |
| 23 | **Search Inside Assistant**   | Search bar in assistant header. Filter previous messages by keyword. Useful for long conversations.                                                           | Medium   |
| 24 | **Onboarding Tour**           | New user asks "how to get started?" → AI triggers interactive step-by-step tour highlighting UI elements (chat list, composer, search, settings).            | Medium   |
| 25 | **Context-Aware Help**        | Assistant knows which chat/thread user is currently viewing. Can answer: "is this user online?", "show me files in this chat", "summarize this conversation". | Low      |

### Phase 4 — Analytics & Storage

| #  | Feature                           | Description                                                                                                                                   | Priority |
| -- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 26 | **Conversation History DB** | Store all assistant conversations in DB (`assistant_conversations` table). User can see past conversations. Admin can view usage analytics. | Medium   |
| 27 | **Usage Analytics**         | Track: total questions asked, avg response time, most common topics, feedback scores. Show in Owner Dashboard.                                | Low      |
| 28 | **Rate Limiting**           | 50 requests/hour per user. `assistant_rate_limits` table. 429 response when exceeded. Headers: `x-ratelimit-remaining/limit`. | ✅ Done  |
| 29 | **Admin Broadcast**         | Full CRUD APIs. Owner sets system messages → auto-injected into AI context for all org users. Priority: normal/high/urgent. Expiry support. | ✅ Done  |
| 30 | **Custom Knowledge Base**   | Full CRUD APIs. Owner creates knowledge entries (title/content/category) → auto-injected into AI context. Organization-specific Q&A. | ✅ Done  |
| 31 | **Conversation Search**     | `GET /conversations/search?q=keyword` — search past conversations by title and message content. | ✅ Done  |
| 32 | **Export Conversation**     | `GET /conversations/:id/export` — download conversation as .txt file with formatted messages. | ✅ Done  |

---

## ak baat aur same user same puch rha to vo db se do result samjhe API cost reduce krne ke liye

## Implementation Order (Recommended)

```
Phase 1 (Core UX):
  11 → Suggested Questions
  12 → Feedback Buttons
  13 → Code Snippets Highlight
  14 → Dark/Light Theme Sync
  15 → Multi-language Welcome

Phase 2 (Smart Features):
  16 → Quick Action Buttons
  17 → Shortcuts Cheat Sheet
  18 → Typing Animation
  19 → Chat History Persist
  20 → Export Chat

Phase 3 (Advanced):
  21 → Voice Input
  22 → Image/Screenshot Analysis
  23 → Search Inside Assistant
  24 → Onboarding Tour
  25 → Context-Aware Help

Phase 4 (Analytics):
  26 → Conversation History DB
  27 → Usage Analytics
  28 → Rate Limiting
  29 → Admin Broadcast
  30 → Custom Knowledge Base
```

---

## Database Tables Needed

| Table                       | For Feature        | Columns                                                                         |
| --------------------------- | ------------------ | ------------------------------------------------------------------------------- |
| `assistant_feedback`      | #12 Feedback       | feedback_id, user_id, message_text, response_text, rating (up/down), created_at |
| `assistant_conversations` | #26 History        | conversation_id, user_id, org_id, messages (JSONB), created_at, updated_at      |
| `assistant_usage`         | #27 Analytics      | usage_id, user_id, org_id, question_count, avg_response_ms, date, created_at    |
| `assistant_broadcasts`    | #29 Broadcast      | broadcast_id, org_id, message, is_active, created_by, created_at, expires_at    |
| `assistant_knowledge`     | #30 Knowledge Base | knowledge_id, org_id, title, content, file_url, created_by, created_at          |
