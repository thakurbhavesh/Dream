# TeamChatX AI Assistant — Complete Specification

Last updated: 2026-03-19

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       FRONTEND                                │
│                                                               │
│  SideBar.jsx              LiveAssistant/index.jsx             │
│  🤖 Robot Icon ──────────► Assistant Panel                    │
│  (toggle event)           ├─ Header (resize/history/close)    │
│                           ├─ History Panel (past convos)      │
│                           ├─ Message Bubbles                  │
│                           │  ├─ Markdown + Code Highlight     │
│                           │  ├─ 👍👎 Feedback Buttons         │
│                           │  └─ Suggested Question Chips      │
│                           └─ Input + Send                     │
│                                                               │
│  liveAssistantApi.js                                          │
│  ├─ fetchWorkspaceState() → /auth/organization-details        │
│  ├─ buildWorkspaceContext() → formatted string                │
│  ├─ buildRoleAwarePrompt(roleId) → scoped system prompt       │
│  ├─ askAssistant() → POST /live-assistant/chat                │
│  ├─ submitFeedback() → POST /live-assistant/feedback          │
│  ├─ saveConversation() → POST /live-assistant/conversations   │
│  ├─ listConversations() → GET /live-assistant/conversations   │
│  ├─ searchConversations() → GET /conversations/search?q=      │
│  └─ deleteConversation() → DELETE /conversations/:id          │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                       BACKEND                                 │
│                                                               │
│  liveAssistantRoutes.js                                       │
│  ├─ POST   /chat               → AI chat (rate limited)      │
│  ├─ POST   /feedback           → submitFeedback               │
│  ├─ GET    /conversations      → listConversations            │
│  ├─ POST   /conversations      → saveConversation             │
│  ├─ GET    /conversations/search → searchConversations        │
│  ├─ GET    /conversations/:id  → getConversation              │
│  ├─ PATCH  /conversations/:id  → updateConversation           │
│  ├─ DELETE /conversations/:id  → deleteConversation           │
│  ├─ GET    /conversations/:id/export → exportConversation     │
│  ├─ GET    /broadcasts         → getBroadcasts (owner)        │
│  ├─ POST   /broadcasts         → createBroadcast (owner)      │
│  ├─ PATCH  /broadcasts/:id     → updateBroadcast (owner)      │
│  ├─ DELETE /broadcasts/:id     → deleteBroadcast (owner)      │
│  ├─ GET    /knowledge          → getKnowledge (owner)         │
│  ├─ POST   /knowledge          → createKnowledge (owner)      │
│  ├─ PATCH  /knowledge/:id      → updateKnowledge (owner)      │
│  ├─ DELETE /knowledge/:id      → deleteKnowledge (owner)      │
│  └─ GET    /usage              → getUsageStats (owner)        │
│                                                               │
│  liveAssistantController.js                                   │
│  ├─ Rate limit check (50/hour per user)                       │
│  ├─ Resolves active AI provider from ai_providers table       │
│  ├─ Injects knowledge base + broadcasts into AI context       │
│  ├─ Routes to: chatWithGemini / chatWithOpenAI / chatWithAnthropic │
│  ├─ Tracks usage in assistant_usage table                     │
│  └─ Returns reply + responseMs + rate limit headers           │
│                                                               │
│  assistantModel.js                                            │
│  ├─ saveFeedback() / trackUsage() / getUsageStats()           │
│  ├─ saveConversation() / updateConversation()                 │
│  ├─ getUserConversations() / getConversation()                │
│  ├─ searchConversations() / getConversationForExport()        │
│  ├─ deleteConversation()                                      │
│  ├─ checkRateLimit() — 50 req/hour sliding window             │
│  ├─ createBroadcast() / getActiveBroadcasts()                 │
│  ├─ updateBroadcast() / deleteBroadcast()                     │
│  ├─ createKnowledge() / getActiveKnowledge()                  │
│  └─ getAllKnowledge() / updateKnowledge() / deleteKnowledge() │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                       DATABASE                                │
│                                                               │
│  ai_providers             → Gemini/OpenAI/Claude config       │
│  assistant_feedback       → 👍👎 ratings per response         │
│  assistant_conversations  → Full chat history (JSONB)         │
│  assistant_usage          → Daily stats per user              │
│  assistant_broadcasts     → Organization announcements        │
│  assistant_knowledge      → Custom knowledge base per org     │
│  assistant_rate_limits    → Per-user request throttling       │
└──────────────────────────────────────────────────────────────┘
```

---

## Request Flow (Step by Step)

1. **User clicks 🤖** in left sidebar → `CustomEvent("teamchatx:assistant")` dispatched
2. **LiveAssistant opens** → fetches workspace state (org, users, groups) via existing APIs
3. **User types question** → e.g. "message kaise edit karte hain?"
4. **Frontend builds payload:**
   - `messages`: last 20 chat messages (history)
   - `systemPrompt`: role-aware prompt (User sees chat-only, Owner sees everything)
   - `workspaceContext`: formatted org/users/groups/plan data
5. **POST /live-assistant/chat** → backend receives request
6. **Rate limit check** → `assistant_rate_limits` table → 50/hour per user → 429 if exceeded
7. **Knowledge base injected** → `assistant_knowledge` (active entries) appended to system prompt
8. **Broadcasts injected** → `assistant_broadcasts` (active/non-expired) appended to system prompt
9. **Backend resolves AI provider:** `ai_providers` table → active provider (Gemini/OpenAI/Claude)
10. **API call** to AI provider with system prompt + workspace context + knowledge + broadcasts + messages
11. **Response parsed:** `[SUGGESTIONS]: q1 | q2 | q3` extracted as follow-up chips
12. **Response displayed:** Markdown rendered (bold, italic, code blocks with copy button)
13. **Auto-save:** conversation saved/updated in `assistant_conversations` table
14. **Usage tracked:** response time logged in `assistant_usage` table
15. **Rate limit headers:** `x-ratelimit-remaining` and `x-ratelimit-limit` sent in response
16. **Feedback:** 👍👎 clicks stored in `assistant_feedback` table

---

## Role-Based Behavior

| Role | role_id | Scope | What Assistant Knows | Access |
|---|---|---|---|---|
| **User** | 4 | Chat only | Messaging, search, AI features, files, profile settings | Chat features only |
| **Moderator** | 3 | Chat + Admin | Above + user management, group management, org controls | Admin panel access |
| **Admin** | 2 | Chat + Admin | Above + user management, group management, org controls | Admin panel access |
| **Owner** | 1 | Everything | Above + billing, plans, AI providers, monitoring, broadcasts, knowledge base | Owner Dashboard (all) |

### Access Control Details

| Feature Area | User (4) | Moderator (3) | Admin (2) | Owner (1) |
|---|---|---|---|---|
| **Chat** (messaging, search, AI, files) | ✅ | ✅ | ✅ | ✅ |
| **Profile & Settings** (timezone, wallpaper, notifications) | ✅ | ✅ | ✅ | ✅ |
| **Groups** (create, manage members) | ✅ | ✅ | ✅ | ✅ |
| **AI Assistant** (chat, history, feedback) | ✅ | ✅ | ✅ | ✅ |
| **Admin Panel** (user mgmt, group mgmt, controls) | ❌ | ✅ | ✅ | ✅ |
| **Organization Controls** (edit/delete time limits, typing indicators) | ❌ | ✅ | ✅ | ✅ |
| **Billing** (plans, checkout, payment history, invoices) | ❌ | ❌ | ❌ | ✅ |
| **Owner Dashboard** (system monitoring, socket stats, DB stats) | ❌ | ❌ | ❌ | ✅ |
| **AI Providers** (configure Gemini/OpenAI/Claude) | ❌ | ❌ | ❌ | ✅ |
| **Broadcasts** (create/manage system announcements) | ❌ | ❌ | ❌ | ✅ |
| **Knowledge Base** (create/manage org-specific Q&A) | ❌ | ❌ | ❌ | ✅ |
| **Usage Analytics** (AI assistant stats) | ❌ | ❌ | ❌ | ✅ |

---

## AI Provider Support

| Provider | Default Model | Other Models | Config |
|---|---|---|---|
| **Google Gemini** | gemini-2.0-flash | gemma-3-4b-it, gemini-1.5-pro | DB: `ai_providers` |
| **OpenAI** | gpt-4o-mini | gpt-4o, gpt-4-turbo | DB: `ai_providers` |
| **Anthropic Claude** | claude-sonnet-4-6 | claude-haiku-4-5-20251001, claude-opus-4-6 | DB: `ai_providers` |

- Provider managed via Owner Dashboard → System Monitoring → AI Providers
- Only one provider active at a time. Switch by clicking Activate
- API keys stored in DB (masked in GET responses)
- Provider cached for 60 seconds to reduce DB hits
- All providers use: `temperature: 0.7, maxOutputTokens: 2048`

---

## All Features

### Core Chat Features

| # | Feature | Description | How It Works |
|---|---------|-------------|-------------|
| 1 | **Multi-turn Chat** | Full conversation with memory | Last 20 message pairs sent as context to AI |
| 2 | **Role-Aware Responses** | Different knowledge per role | System prompt scoped: User=chat only, Admin=+admin, Owner=everything |
| 3 | **Workspace Context** | Live org data in responses | Fetches org name, plan, licenses, storage, users, groups on open |
| 4 | **Multi-Provider** | Switch between AI providers | Gemini/OpenAI/Claude from `ai_providers` table. Owner can switch anytime |
| 5 | **Language Match** | Responds in user's language | AI detects Hindi/English/Hinglish and replies in same language |
| 6 | **Knowledge Base Injection** | Org-specific Q&A | Owner's knowledge entries auto-appended to AI system prompt |
| 7 | **Broadcast Injection** | System announcements in AI | Active broadcasts injected into AI context, mentioned when relevant |

### UI Features

| # | Feature | Description | How It Works |
|---|---------|-------------|-------------|
| 8 | **Sidebar Toggle** | 🤖 robot icon in left sidebar | Click toggles panel open/close via CustomEvent |
| 9 | **Resize Panel** | 3 sizes | Small (320×420), Medium (380×540), Large (480×full-height) |
| 10 | **Close Button** | X in header | Closes panel, syncs sidebar icon state |
| 11 | **New Chat** | Reset conversation | Refresh icon clears messages, starts fresh |
| 12 | **Theme Sync** | Dark/light mode | Auto-matches app theme via `useTheme()` |
| 13 | **Multi-language Welcome** | Localized greeting | Detects `navigator.language` → Hindi/English welcome message |
| 14 | **Auto-scroll** | Stays at bottom | Scrolls to latest message on new response |

### Response Features

| # | Feature | Description | How It Works |
|---|---------|-------------|-------------|
| 15 | **Markdown Rendering** | Rich text responses | Bold `**text**`, italic `*text*`, inline code `` `code` `` |
| 16 | **Code Blocks** | Syntax highlighting | ` ```lang\ncode\n``` ` → language label + Copy button |
| 17 | **Suggested Questions** | Follow-up chips | AI appends `[SUGGESTIONS]: q1 \| q2 \| q3` → parsed into clickable chips |
| 18 | **Feedback Buttons** | Quality tracking | 👍👎 on every AI response → stored in `assistant_feedback` table |

### History & Persistence

| # | Feature | Description | How It Works |
|---|---------|-------------|-------------|
| 19 | **Auto-save** | Conversations saved to DB | Every exchange auto-saved to `assistant_conversations` (JSONB) |
| 20 | **History Panel** | Load past conversations | Clock icon → list with title, message count, date → click to load |
| 21 | **Delete History** | Remove conversations | Trash icon → deletes from DB (ownership verified) |
| 22 | **Search Conversations** | Find past chats | `GET /conversations/search?q=keyword` → searches title + message content |
| 23 | **Export Conversation** | Download as text file | `GET /conversations/:id/export` → formatted `.txt` file download |

### Admin/Owner Features

| # | Feature | Description | How It Works |
|---|---------|-------------|-------------|
| 24 | **Rate Limiting** | Prevent abuse | 50 requests/hour per user. Sliding window. 429 response when exceeded |
| 25 | **Admin Broadcasts** | System announcements | Owner creates messages → auto-injected into AI context for all org users |
| 26 | **Knowledge Base** | Custom training data | Owner creates entries (title/content/category) → AI uses for org-specific answers |
| 27 | **Usage Analytics** | Track AI usage | Daily stats: total questions, unique users, avg response time. Owner Dashboard |
| 28 | **Feedback Analytics** | Track AI quality | 👍👎 ratings stored per response for quality analysis |

---

## API Endpoints (Complete)

### Chat

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/live-assistant/chat` | JWT | Send message to AI. Rate limited (50/hr). Auto-injects knowledge + broadcasts |

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "How to edit a message?" },
    { "role": "assistant", "content": "To edit a message..." },
    { "role": "user", "content": "And how to delete?" }
  ],
  "systemPrompt": "optional custom system prompt",
  "workspaceContext": "Organization: TeamChatX\nPlan: Enterprise..."
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "reply": "To delete a message:\n1. Right-click on the message...\n\n[SUGGESTIONS]: How to recall? | Pin messages? | Message info?",
    "responseMs": 1234
  }
}
```

**Response Headers:** `x-ratelimit-remaining: 47`, `x-ratelimit-limit: 50`

**Rate Limited (429):**
```json
{
  "status": "error",
  "message": "Rate limit exceeded. Maximum 50 questions per hour.",
  "data": { "remaining": 0, "limit": 50 }
}
```

### Feedback

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/live-assistant/feedback` | JWT | Submit thumbs up/down feedback |

**Request:**
```json
{
  "messageText": "How to edit messages?",
  "responseText": "To edit a message, right-click...",
  "rating": "up"
}
```

### Conversations

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/live-assistant/conversations` | JWT | List user's past conversations |
| POST | `/live-assistant/conversations` | JWT | Save new conversation |
| GET | `/live-assistant/conversations/search?q=edit` | JWT | Search past conversations |
| GET | `/live-assistant/conversations/:id` | JWT | Load specific conversation |
| PATCH | `/live-assistant/conversations/:id` | JWT | Update conversation title/messages |
| DELETE | `/live-assistant/conversations/:id` | JWT | Delete conversation |
| GET | `/live-assistant/conversations/:id/export` | JWT | Download as .txt file |

**Save Request:**
```json
{
  "title": "Message editing help",
  "messages": [
    { "role": "user", "content": "How to edit?", "timestamp": "2026-03-19T10:00:00Z" },
    { "role": "assistant", "content": "Right-click the message..." }
  ]
}
```

**Search:** Returns conversations where title or message content matches the query (case-insensitive).

**Export:** Returns `Content-Type: text/plain` with formatted conversation:
```text
# Message editing help
User: Hardik Patel
Organization: TeamChatX
Date: 3/19/2026, 10:00:00 AM
Messages: 4

---

**You** (3/19/2026, 10:00:00 AM):
How to edit a message?

**AI Assistant** (3/19/2026, 10:00:01 AM):
To edit a message:
1. Right-click on the message
2. Select "Edit" from the menu
...
```

### Broadcasts (Owner Only)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/live-assistant/broadcasts` | JWT + Owner | List active broadcasts for org |
| POST | `/live-assistant/broadcasts` | JWT + Owner | Create new broadcast |
| PATCH | `/live-assistant/broadcasts/:id` | JWT + Owner | Update broadcast |
| DELETE | `/live-assistant/broadcasts/:id` | JWT + Owner | Delete broadcast |

**Create Request:**
```json
{
  "message": "System maintenance scheduled tonight at 10 PM IST. Chat will be unavailable for ~30 minutes.",
  "priority": "high",
  "expires_at": "2026-03-20T22:00:00Z"
}
```

Priority values: `normal`, `high`, `urgent`

**How broadcasts work:**
- Owner creates a broadcast via API
- When ANY user in the organization asks the AI assistant a question, the broadcast is automatically injected into the AI's system prompt
- AI mentions the broadcast when relevant (e.g., user asks "any updates?" → AI shares the maintenance notice)
- Expired broadcasts (past `expires_at`) are automatically excluded
- Owner can deactivate broadcasts by patching `is_active: false`

### Knowledge Base (Owner Only)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/live-assistant/knowledge` | JWT + Owner | List all knowledge entries |
| POST | `/live-assistant/knowledge` | JWT + Owner | Create knowledge entry |
| PATCH | `/live-assistant/knowledge/:id` | JWT + Owner | Update knowledge entry |
| DELETE | `/live-assistant/knowledge/:id` | JWT + Owner | Delete knowledge entry |

**Create Request:**
```json
{
  "title": "VPN Setup Instructions",
  "content": "1. Download FortiClient from https://vpn.company.com\n2. Enter server: vpn.company.com:443\n3. Use your AD credentials (same as email login)\n4. Contact IT at ext. 1234 if connection fails",
  "category": "IT"
}
```

**How knowledge base works:**
- Owner creates knowledge entries with title, content, and category
- When ANY user asks the AI assistant a question, ALL active knowledge entries for the organization are injected into the AI's system prompt under `--- ORGANIZATION KNOWLEDGE BASE ---`
- AI uses this information to answer organization-specific questions accurately
- Example: User asks "VPN kaise setup karun?" → AI uses the knowledge entry to give exact steps

**Use cases:**
- Company policies, HR info, IT setup guides
- Product-specific FAQs
- Onboarding instructions for new employees
- Custom workflows and processes

### Usage Analytics (Owner Only)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/live-assistant/usage?org_id=1&days=30` | JWT + Owner | Daily usage stats |

**Response:**
```json
{
  "data": {
    "stats": [
      {
        "date": "2026-03-19",
        "total_questions": 45,
        "unique_users": 8,
        "avg_response_ms": 1200
      },
      {
        "date": "2026-03-18",
        "total_questions": 38,
        "unique_users": 6,
        "avg_response_ms": 1450
      }
    ]
  }
}
```

---

## Database Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `ai_providers` | AI provider config (Gemini/OpenAI/Claude) | provider_key, api_key, model, is_active |
| `assistant_feedback` | Quality tracking (👍👎) | user_id, message_text, response_text, rating |
| `assistant_conversations` | Chat history persistence | user_id, org_id, title, messages (JSONB), message_count |
| `assistant_usage` | Daily analytics per user | user_id, org_id, question_count, avg_response_ms, date |
| `assistant_broadcasts` | Organization announcements | organization_id, message, priority, is_active, expires_at |
| `assistant_knowledge` | Custom knowledge base | organization_id, title, content, category, is_active |
| `assistant_rate_limits` | Per-user rate throttling | user_id, organization_id, window_start, request_count |

---

## Example Conversations

### 1. Basic Chat Feature Help (Hindi)

**User:** "message kaise edit karte hain?"

**AI Assistant:**
> Message edit karne ke liye:
> 1. Jo message edit karna hai, us pe **right-click** karo
> 2. Menu se **Edit** select karo
> 3. Message input mein text aa jaayega — edit karo
> 4. **Send** button dabao
>
> ⚠️ Note: Organization admin ne time limit set ki ho sakti hai (e.g., 5 min ke andar hi edit ho sakta hai).
>
> [SUGGESTIONS]: Pin kaise karein? | Keyboard shortcuts? | Message delete kaise karein?

---

### 2. Search Feature (English)

**User:** "How does Smart Search work?"

**AI Assistant:**
> Smart Search uses AI to understand natural language queries:
>
> 1. Click the **🔍 Search** icon in the chat header
> 2. Toggle the **Smart** switch (magic wand icon) to **ON**
> 3. Type a natural language query like:
>    - `"files shared by Bhavesh last week"`
>    - `"show me all images"`
>    - `"hosting access wala message"`
>
> The AI parses your query into structured filters:
> ```json
> {
>   "keywords": ["hosting", "access"],
>   "types": ["file", "image"],
>   "senderName": "Bhavesh",
>   "dateRange": "last7"
> }
> ```
>
> Results show messages matching ALL filters from the **complete database** (not just loaded chat).
>
> [SUGGESTIONS]: Normal search kaise kaam karta hai? | Type filter kaise lagayen? | Date filter?

---

### 3. AI Provider Config (Owner Only)

**User:** "AI provider kaise change karun?"

**AI Assistant:**
> AI Provider change karne ke liye:
> 1. **Owner Dashboard** kholo (left sidebar bottom icons)
> 2. **System Monitoring → AI Providers** pe jaao
> 3. Teen cards dikhenge: Gemini (green), OpenAI (blue), Claude (red)
> 4. Jo provider activate karna hai, uska **Configure** click karo
> 5. **API Key** enter karo aur **Model** select karo
> 6. **Save** karo, phir **Activate** button dabao
>
> Currently active: **Google Gemini** (gemini-2.0-flash)
>
> ⚠️ Ek time pe sirf ek provider active rehta hai. Activate karne pe baaki auto-deactivate ho jaate hain.
>
> [SUGGESTIONS]: Current usage stats dikhao | Model kaise change karein? | API key kahan se milegi?

---

### 4. File Sharing Help (Hinglish)

**User:** "file kaise share karte hain chat mein?"

**AI Assistant:**
> Chat mein file share karne ke 3 tarike hain:
>
> **1. Drag & Drop:**
> - File ko computer se uthao aur seedha chat window mein drop karo
>
> **2. Attachment Button:**
> - Input field ke left mein **📎 clip** icon pe click karo
> - File select karo → upload hogi → send karo
>
> **3. Paste:**
> - Screenshot ya image copy karo (Ctrl+C)
> - Chat input mein paste karo (Ctrl+V)
>
> **Supported files:** Images, Videos, Audio, PDF, DOCX, XLSX, ZIP, Code files — basically sab kuch!
> **Max size:** 2 GB per file
> **Blocked:** .exe, .bat, .dll, .js — security ke liye
>
> **Preview:** Bheje hue files pe click karke **full preview** dekh sakte ho (images zoom, videos play, PDFs viewer)
>
> [SUGGESTIONS]: File size limit kya hai? | Image preview kaise kare? | File search kaise kare?

---

### 5. Group Management (Admin)

**User:** "New group kaise create karun?"

**AI Assistant:**
> Group create karne ke liye:
> 1. Left sidebar mein **Groups** icon pe click karo
> 2. Top right mein **+ Create Group** button hoga
> 3. Group details fill karo:
>    - **Group Name** (required)
>    - **Description** (optional)
> 4. **Members** add karo — search by name/email
> 5. **Create** button dabao
>
> **After creation:**
> - Group chat mein messages, files, images sab share kar sakte ho
> - Group members manage kar sakte ho (add/remove)
> - Group timeline mein history dikhti hai (who joined, who left)
>
> [SUGGESTIONS]: Group mein member kaise add karein? | Group permissions? | Group delete kaise karein?

---

### 6. Knowledge Base Usage (Auto-injected)

**Owner added knowledge entry:**
- Title: "Office WiFi Setup"
- Content: "WiFi: TeamChat-Office, Password: TC@2026secure, IT Support: ext. 1234"

**User asks:** "Office ka WiFi password kya hai?"

**AI Assistant:**
> Office WiFi ki details:
> - **Network Name:** TeamChat-Office
> - **Password:** TC@2026secure
>
> Agar connect nahi ho raha toh IT Support ko call karo: **ext. 1234**
>
> [SUGGESTIONS]: VPN kaise setup karein? | Printer setup? | IT contact?

*Note: AI used the knowledge base entry to answer this org-specific question.*

---

### 7. Broadcast Mention (Auto-injected)

**Owner created broadcast:**
- Message: "System maintenance tonight at 10 PM IST. Chat unavailable for ~30 min."
- Priority: high

**User asks:** "Koi update hai aaj ke liye?"

**AI Assistant:**
> ⚠️ **Important Announcement:**
> System maintenance scheduled **tonight at 10 PM IST**. Chat will be unavailable for approximately 30 minutes.
>
> Please save any important work before 10 PM.
>
> [SUGGESTIONS]: Aur koi update? | Maintenance ke baad kya hoga? | Files safe rahenge?

---

### 8. Summarize Feature Help

**User:** "Message ka summary kaise nikalen?"

**AI Assistant:**
> Message ya file ka summary nikalne ke liye:
> 1. Message pe **right-click** karo
> 2. Menu se **Summarize** select karo
> 3. Summary dialog khulega with:
>    - **Original** message/file preview
>    - **AI Summary** (3-5 bullet points)
>    - **Regenerate** button (different summary)
>    - **Copy** button
>
> **Supported file types:**
> - 📄 PDF — text extracted via pdf-parse
> - 📝 DOCX — text extracted from XML
> - 🖼️ Images — Gemini Vision analyzes the image
> - 💻 Code files — direct text read
> - 📊 XLSX/CSV — tabular data extraction
>
> **Cache:** Same file ka summary cached hota hai — dobara click karne pe instant result, no AI cost!
>
> [SUGGESTIONS]: Translate kaise karein? | Smart Reply kya hai? | Grammar check?

---

### 9. Billing Help (Owner Only)

**User (Owner):** "Subscription kaise upgrade karun?"

**AI Assistant:**
> Subscription upgrade karne ke liye:
> 1. **Owner Dashboard** → **Billing** section kholo
> 2. Current plan details dikhenge (users, storage, features)
> 3. **Upgrade Plan** button click karo
> 4. New plan select karo + user count adjust karo
> 5. **Coupon code** hai toh enter karo (discount apply hoga)
> 6. **Billing address** select karo ya naya add karo
> 7. **Checkout** → Stripe payment page pe redirect hoga
> 8. Payment complete → subscription instantly active
>
> **Payment history:** Billing section mein saari past invoices dikhti hain. PDF download bhi kar sakte ho.
>
> [SUGGESTIONS]: Payment history kahan hai? | Invoice download? | Coupon code kaise lagayen?

---

### 10. Real-time Chat Features

**User:** "Message status ticks ka kya matlab hai?"

**AI Assistant:**
> Message status ticks:
>
> | Icon | Status | Meaning |
> |---|---|---|
> | ✓ (single grey) | **Sent** | Message server pe pahunch gaya, receiver offline hai |
> | ✓✓ (double grey) | **Delivered** | Receiver online aaya, message unki device pe pahuncha |
> | ✓✓ (double green) | **Read** | Receiver ne message padh liya (chat open ki) |
>
> **How it works:**
> - Jab aap message bhejte ho → single tick instantly
> - Receiver online aata hai → double tick (delivered_at set in DB)
> - Receiver aapki chat kholta hai → green tick (read_time set in DB)
>
> **Message Info:** Kisi bhi message pe right-click → **Info** → exact sent time, delivered time, read time, device info, location sab dikhega.
>
> [SUGGESTIONS]: Read receipts off kar sakte hain? | Message info kaise dekhein? | Online status?

---

## System Prompt Knowledge Areas

The AI assistant responds based on the user's role. Knowledge is scoped:

### All Users (role 1, 2, 3, 4)
1. **Messaging** — Send, reply, forward, edit, delete, recall/unsend, pin, emoji reactions, rich text formatting (bold/italic/underline), message status ticks (sent/delivered/read)
2. **Search** — Normal text search + AI Smart Search (natural language queries, type/date/user filters)
3. **AI Features** — Smart Reply (3 suggestions), Summarize (text + files), Translate (multi-language), Grammar Autocorrect, Smart Search
4. **File Sharing** — Drag & drop, attachment button, paste, 2GB max, dangerous file blocking, full preview (images/videos/PDFs/docs)
5. **Profile & Settings** — Timezone selection (335 timezones), wallpaper customization, notification sounds, device management, trusted devices
6. **Groups** — Create, add/remove members, group chat, group timeline, group permissions
7. **Media Panel** — Profile sidebar with all shared images, videos, links, docs, pinned messages from full database

### Moderator + Admin + Owner (role 1, 2, 3)
8. **Admin Panel** — User management (create/update/deactivate/bulk), group management, organization controls (typing indicators, edit/delete time limits), message menu permissions

### Owner Only (role 1) — Owner Dashboard
9. **Billing** — Plan management, coupon support, Stripe + PayPal checkout, payment history, invoice download
10. **Owner Dashboard** — System monitoring (socket stats, DB stats, memory, uptime), AI provider management, usage analytics
11. **AI Providers** — Configure Gemini/OpenAI/Claude, switch active provider, API key management
12. **Broadcasts** — Create/manage system announcements for all org users (auto-injected into AI context)
13. **Knowledge Base** — Create/manage org-specific Q&A entries (auto-injected into AI context)
14. **Usage Analytics** — Daily AI assistant stats: questions, unique users, response times

---

## Rate Limiting

| Setting | Value |
|---|---|
| Max requests per hour | 50 (per user per org) |
| Window type | Sliding (1-hour rolling) |
| Exceeded response | HTTP 429 |
| Response headers | `x-ratelimit-remaining`, `x-ratelimit-limit` |
| Storage | `assistant_rate_limits` table (upsert) |

---

## Files Reference

| File | Purpose |
|---|---|
| `backend/src/controllers/liveAssistantController.js` | Chat + feedback + conversations + broadcasts + knowledge + export |
| `backend/src/routes/liveAssistantRoutes.js` | All endpoint routing (19 routes) |
| `backend/src/models/assistantModel.js` | All DB operations (17 functions) |
| `backend/src/models/aiProviderModel.js` | Provider config + caching |
| `backend/docs/sql/047_ai_providers.sql` | Provider table + seeding |
| `backend/docs/sql/050_assistant_tables.sql` | Feedback, conversations, usage tables |
| `backend/docs/sql/055_assistant_enhancements.sql` | Broadcasts, knowledge, rate limits tables |
| `frontend/src/components/LiveAssistant/index.jsx` | Main UI component |
| `frontend/src/components/LiveAssistant/liveAssistantApi.js` | API calls + system prompt |

---

## Update Log (2026-03-19) — Full Session Changes

### Socket Reliability Fixes

| Fix | Problem | Solution |
|-----|---------|----------|
| **Auth token reconnection** | Socket reconnection failed with expired JWT (15 min). Stale `auth.token` took priority over fresh cookie | `authenticateSocket` now tries ALL token sources (auth.token, header, cookie) — first valid wins |
| **`auth:refresh_token` event** | No way to update token mid-session | New socket event — client pushes fresh token, server verifies + updates `socket.user` |
| **Online status cross-org leak** | `users:online_list` sent ALL online users across ALL orgs | Added `userOrgMap` + `orgOnlineUsers` — only same-org users sent |
| **Connect storm protection** | Server restart → 5 DB queries × every user simultaneously | Heavy queries (`wasAlreadyOnline` check) skip on multi-tab reconnect → 0 DB queries for 2nd+ tab |

### Message Delivery Fixes

| Fix | Problem | Solution |
|-----|---------|----------|
| **`normalizeDMMessage` status** | Undelivered messages showed as `delivered` (double tick) | Now checks `delivered_at`: `read` → `delivered` → `sent` |
| **`delivered_ack` missing** | Sender didn't get real-time double tick on DM send | Added `message:delivered_ack` emit in `delivered` branch |
| **Forward delivery status** | Forwarded DMs had no delivery logic (sent/delivered/read) | Full delivery status + `delivered_ack` + `read_ack` + unread count |
| **Forward badge missing** | Frontend sent `message:send` instead of `message:forward`, forwarded metadata lost in `socketMeta` | `sendViaSocket` now merges `metadata.forwarded/forwardedBy/forwardedFrom/forwardedAt` into socket payload |
| **Group `thread:update` missing** | Group messages didn't send unread count to members | Added batch unread query + `thread:update` per member |
| **Group `markThreadAsRead`** | Group threads ignored in `markThreadAsRead` — unread never reset via socket | Added group branch calling `markGroupMessagesRead` |
| **Group `message:delete`** | Delete handler only had DM branch, group delete silently ignored | Added `deleteGroupMessage` to chatModel + group branch in socket |

### Notification Overhaul

| Event | DM | Group |
|-------|-----|-------|
| `message:send` | ✅ `type: message` | ✅ `type: message` |
| `message:forward` | ✅ `type: message` | ✅ `type: message` |
| `message:edit` | ✅ `type: edit` | ✅ `type: edit` (NEW) |
| `message:react` | ✅ `type: reaction` | ✅ `type: reaction` |
| `message:pin` | No notification | No notification |
| `message:recall` | No notification | No notification |
| `message:delete` | No notification (self-only) | No notification (self-only) |

### Performance Optimizations

| Optimization | Before | After |
|-------------|--------|-------|
| **Group unread count** | N DB queries in loop (1 per member) | 1 batch query with `ANY()` + `GROUP BY` |
| **`getGroupMemberIds` cache** | DB hit every call (9 places) | 30s in-memory cache + invalidation on member change |
| **`users:online_list`** | O(N) full Map scan of all users | O(org_size) via `orgOnlineUsers` Set |
| **`logMessageAction`** | `await` blocked response | Fire-and-forget `.catch(() => {})` |
| **Per-socket rate limiting** | No protection | Sliding window per event (send: 30/10s, typing: 5/3s, etc.) |
| **`toggleReaction`** | SELECT → DELETE race condition | Atomic DELETE RETURNING → INSERT |

### Code Reuse (Helpers Extracted)

| Helper | Replaces | Used In |
|--------|----------|---------|
| `buildSentFrom(socket)` | 3-line geo extraction | `message:send`, `message:forward` |
| `formatLocation(geo)` | Ternary chain | `message:info` (5 places) |
| `resolveDMDelivery({...})` | 35-line sent/delivered/read branching | `message:send` DM, `message:forward` DM |
| `deliverDMToReceiver({...})` | 30-line emit + unread + notification | `message:send` DM, `message:forward` DM |
| `deliverGroupToMembers({...})` | 30-line batch unread + member loop | `message:send` Group, `message:forward` Group |
| `buildEditPayload(normalized, text)` | 18-line payload construction | `message:edit` DM, `message:edit` Group |
| `checkFeatureAllowed(orgId, key, msgId, threadId)` | 10-line control + time limit check | `message:edit`, `message:delete`, `message:recall` |

### Chat Loading Fixes

| Fix | Problem | Solution |
|-----|---------|----------|
| **Messages reset on new msg** | `useEffect` reset `orderedMessages` on every `messages` prop change — older fetched messages LOST | Thread change → full reset. Same thread → merge (append new + in-place update existing) |
| **Pagination stops early** | Recalled/deleted filtered POST-query — `hasMore = 65 >= 80 = false` | Added `AND message IS NOT NULL` in SQL — LIMIT applies to valid messages only |
| **Backend `hasMore` missing** | Frontend guessed `messages.length >= limit` | Backend now returns `hasMore` explicitly in API response |
| **No-scroll auto-trigger** | Content fits viewport → no scroll → `onScroll` never fires → older messages never load | `useEffect` auto-triggers load when `scrollHeight <= clientHeight` |
| **Floating load button** | "Pull up to load more" text hidden above viewport | Floating up-arrow button at top center (always visible when `hasMore = true`) |
| **Unread badge inflated** | Older message load → `totalMessages` jumps → "99+" badge | `delta === 1` check — only count single new messages, ignore bulk loads |
| **Load toast** | No feedback on older message load | "Older messages loaded" / "No more messages" toast on load complete |
| **`MESSAGE_WINDOW` too small** | `MESSAGE_WINDOW = 20` — only 20 messages visible from 80 fetched | Changed to 30 (matching `MESSAGE_WINDOW_SIZE`) |

### Summarize Cache Fix

| Fix | Problem | Solution |
|-----|---------|----------|
| **Same summary for all files** | `cacheSource = fileKey \|\| text \|\| ''` — empty string for files without fileKey → same SHA-256 hash | Now uses `fileKey \|\| fileUrl \|\| text` + appends `fileName` for uniqueness |

### Other Fixes

| Fix | Details |
|-----|---------|
| **`message:info` DM** | Added `delivered_at` to SELECT query + `deliveredTime` to response |
| **`group:join` validation** | Now verifies user is active member before allowing room join |
| **`tab-visibility` handler** | Added server handler — re-broadcasts `user:online` when user returns to tab |
| **`console.log` leak** | Removed message text from edit handler log — only logs message ID |
| **Group unread sync on connect** | Added batch query for group unread counts on socket connect |
| **Emoji length cap** | `toggleReaction` now caps emoji to 32 chars |
| **Summarize file name overflow** | Long file names now truncate (header) / word-wrap (original section) in SummarizeDialog |

### New AI Assistant Features

| Feature | Description | API |
|---------|-------------|-----|
| **Rate Limiting** | 50 req/hour per user, sliding window, 429 response | Auto in `/chat` |
| **Admin Broadcasts** | Owner creates announcements → auto-injected into AI context | CRUD `/broadcasts` |
| **Knowledge Base** | Owner creates org-specific Q&A → AI uses for answers | CRUD `/knowledge` |
| **Conversation Search** | Search past conversations by keyword | `GET /conversations/search?q=` |
| **Export Conversation** | Download conversation as .txt file | `GET /conversations/:id/export` |

### New Database Tables (Migration: 055)

| Table | Purpose |
|-------|---------|
| `assistant_broadcasts` | Organization announcements with priority + expiry |
| `assistant_knowledge` | Custom knowledge base per org (title/content/category) |
| `assistant_rate_limits` | Per-user request throttling (sliding window) |

### Docs Updated

| Doc | Changes |
|-----|---------|
| `features.md` | Socket reliability, notification map, delivery fixes, performance optimizations |
| `systemrequirement.md` | NEW — server requirements, capacity estimates, scaling roadmap, rate limits, indexes, env vars |
| `database.md` | 55 → 60 tables, all new AI assistant tables documented |
| `api.md` | Full AI Assistant API section (19 endpoints) |
| `task.md` | #28-32 marked done (rate limiting, broadcasts, knowledge base, search, export) |
| `assistant.md` | Complete rewrite with all features, examples, role access matrix |
| `payment.md` | Full PayPal flow added (architecture, step-by-step, currency fallback, troubleshooting) |
