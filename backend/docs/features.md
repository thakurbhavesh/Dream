# TeamChatX Backend Features

Last updated: 2026-03-13

## 1. Core Stack

- Node.js + Express (MVC structure)
- PostgreSQL (primary relational database)
- Redis (optional cache layer)
- JWT-based authentication
- SMTP mail dispatch (pooled + async background send)

## 2. Security Features

- `HttpOnly` cookie-based auth tokens:
  - `access_token` cookie (short-lived)
  - `refresh_token` cookie (long-lived)
- CSRF protection for unsafe methods (`POST/PUT/PATCH/DELETE`) when auth cookies are present.
  - token bootstrap endpoint: `GET /auth/csrf`
- Role-based access control:
  - `role_id=1` owner-only write APIs
  - `role_id=4` blocked from restricted modules
- Organization-scoped authorization using token org context + membership checks.
- Device-aware session control (`client_device_id`, `device_id`, user device tracking).
- `user_devices` me IP-based geo enrichment (country/city) fallback, jab client values na bheje.
- Session revocation support:
  - single session/device logout
  - logout all devices
- OTP abuse controls:
  - resend cooldown (`OTP_RESEND_COOLDOWN_SECONDS`)
  - temporary lock window after max failed attempts (`OTP_LOCK_WINDOW_MINUTES`)
- Refresh-token reuse detection:
  - if revoked refresh token is reused, backend revokes all active sessions
  - forces security logout across devices.
- Trusted-device management APIs:
  - `GET /auth/trusted-devices`
  - `POST /auth/trusted-devices/:deviceId/revoke`

## 3. Auth and Session Features

- Login with trusted-device flow + OTP fallback for untrusted devices.
- Logout revokes session but does not force OTP on same trusted/known device (`client_device_id` continuity).
- Logout/refresh now re-bind authenticated `client_device_id` to current `device_id`, so same browser/device stays OTP-free after relogin.
- Access token + refresh token rotation model.
- Refresh endpoint creates new session token pair and expires old one.
- Refresh flow includes reuse-suspicion kill switch (`force_logout_all` error detail).
- Password flows:
  - forgot password OTP
  - reset password token flow
  - change password with forced re-login behavior
- Profile and organization context endpoints:
  - `/auth/me`
  - `/auth/user-details`
  - `/auth/organization-details`
- `/auth/me` now includes auth activity timeline (`auth_timeline`) for profile security visibility.

## 4. Organization Features

- Organization onboarding with owner user + subscription bootstrap.
- Organization member management:
  - create/update/deactivate/activate/soft-delete
  - bulk update
  - admin password reset for org users
- Departments, designations, locations CRUD.
- Global member access mapping (`global_access`).
- Organization restrictions:
  - IP restrictions
  - platform restrictions
- Organization message menu permission overrides.

## 5. Product and Website Features

- Master data APIs:
  - roles, plans, languages, timezones, platforms, message-menu-items
- Plan features catalog (`plan_features`)
- Product features module:
  - categories + feature items
  - public/secure catalog consumption
- Site details module:
  - brand profile
  - emails, phones, addresses child records
- Contact-us module:
  - request capture
  - admin notification mail
  - customer acknowledgement mail

## 6. Collaboration and Messaging Features

- Group management
- Group members management
- Group timeline events (audit-style group event history)
- Group permissions tables and schema support
- Chat APIs fully implemented (`/chat` module):
  - `GET /chat/organizations` — active org membership list for logged-in user
  - `GET /chat/threads?org_id=` — DM + group thread list; multi-org support via query param
  - `GET /chat/contacts` — org member contacts for starting DMs
  - `GET /chat/threads/:id/messages` — paginated message fetch (DM or group)
  - `POST /chat/threads/:id/messages` — send message (persists to DB)
  - `POST /chat/threads/:id/read` — mark all messages in thread as read
  - `PATCH /chat/messages/:id` — edit a DM message
  - `DELETE /chat/messages/:id` — delete a DM message
  - Thread ID format: `dm-{userId}` for DMs, `group-{groupId}` for groups
  - DM threads include member profile fields: `email`, `mobile`, `designation`, `department`, `location`
  - Messages stored in: `messages` table (DMs), `group_messages` + `group_message_recipients` (groups)
  - JWT uses `sub` field for user ID (`req.user.sub`)
- Organization profile module (`/organization`):
  - `GET /organization/overview` — org overview
  - `GET /organization/members` — members list
  - `GET /organization/members/:userId` — single member profile
  - `GET /organization/departments` — org departments
  - `GET /organization/designations` — org designations
  - `GET /organization/locations` — org locations

## 7. Observability and Performance Features

- Activity log framework with action categorization.
- Action-level logging for auth, user, group, restrictions, access operations.
- Optimized indexes for API hot paths and activity log filters.
- SQL query packs + migration docs for repeatable environment setup.

## 8. API Design Features

- Consistent JSON success/error envelope.
- Route-level validation middleware.
- Structured middleware chain:
  - auth
  - owner/restricted-role guards
  - payload validators
  - uniqueness/integrity checks
- Centralized error handler.

## Update Log (2026-02-27)

- Added CSRF endpoint note (`GET /auth/csrf`).
- Added OTP abuse controls (`OTP_RESEND_COOLDOWN_SECONDS`, `OTP_LOCK_WINDOW_MINUTES`).
- Added refresh-token reuse detection and trusted-device revoke coverage.
- Strengthened same-device continuity: authenticated logout/refresh binds `client_device_id` to the resolved device row.

## Update Log (2026-03-09)

- Billing and commerce features added:
  - per-user plan pricing quote calculation
  - coupon discount support
  - Stripe checkout session + confirm flow
  - payment history persistence and retrieval.
- Geo master support added for dynamic billing address country/state selectors.
- Authentication hardening added: login denied when `organization_members.status <> 'active'`.

## Update Log (2026-03-09, Docs Sync 2)

- Billing address-book capability documented:
  - org can reuse recent addresses (top 2 shown in UI)
  - users can explicitly add new billing address entries
  - duplicate addresses are deduplicated at backend save layer
- Coupon UX note updated:
  - coupon is manually entered by user and applied via quote API



## Update Log (2026-03-09, Latest Sync)

- Billing confirm idempotency hardened for same `session_id`.
- Payment history constraints strengthened:
  - `invoice_number` uniqueness guard.
  - partial unique index on `transaction_id` (`IS NOT NULL`).
- Billing invoice download now exports real `.pdf` (A4 style) with transaction id.
- Admin payment success UX improved:
  - duplicate confirm call removed.
  - success modal auto-close in 2s.
  - confetti visibility fixed.
- Billing UI updates:
  - Subscription Overview uses preset/theme palette colors.
  - readability improved for top status chips.
- User management updates:
  - add user flow optimized (non-blocking credential mail + faster dialog close).
  - role mapping locked:
    - organization create default role = `3`.
    - user form platform admin = `2`, otherwise `4`.
  - default toggles remain unchecked unless user explicitly selects.
- Added/updated migrations:
  - `030_reset_and_seed_plans_reasonable_pricing.sql`
  - `031_payment_history_strong_uniques.sql`
# Docs Sync (2026-03-10)

- Billing feature set now includes:
  - exact structured payment failure reasons
  - reusable billing activity logging
  - deterministic invoice numbering (`INV-TCX...`)
  - thank-you confirmation flow before admin redirect
  - enriched Stripe metadata/customer payloads

## Update Log (2026-03-13)

- Section 6 updated: chat APIs are now fully implemented (not just schema):
  - `/chat` module (`chatRoutes.js`, `chatController.js`, `chatModel.js`) added
  - All DM and group messaging endpoints are live with DB persistence
  - Multi-org support: threads filterable by `org_id` query param
  - DM thread data includes full member profile fields (email, mobile, designation, department, location)
  - Messages saved to `messages` table (DMs) and `group_messages` + `group_message_recipients` (groups)
- Organization profile module (`/organization`) added with overview, members, departments, designations, and locations endpoints.

---

## Latest Features Update (March 2026)

### Messaging Enhancements
- **Message Edit** — Edit sent messages with `edit_time` tracked in DB. Edit history stored in `message_metadata.editHistory`. Both sender and receiver get realtime `message:edited` event with cache-busted payload (`__normalized: false`, `__renderCache: null`).
- **Message Recall/Unsend** — Sets `message = NULL` in DB (not empty string) so recalled messages don't count in unread. Both sides get `message:deleted` event. Recalled messages filtered from `getDMMessages`/`getGroupMessages` post-decryption.
- **Message Info Overlay** — Click info on any message to see: Sent time, Read time, Edit time (from DB `send_time`/`read_time`/`edit_time`), Read/Delivered receipts with geo location and device info. Uses `message:info` socket API for fresh DB data.
- **Message Forward** — Preserves `forwarded: true`, `forwardedBy`, `isForwarded` flags in metadata. Forward icon badge shown on message bubble.
- **Rich Text Formatting** — Bold, Italic, Underline preserved in `content.html` field. Paste from external sources preserves formatting via `sanitizeComposerHtml`. Links open in new tab (`target="_blank"`).
- **Show More / Show Less** — Messages with 4+ lines or 300+ characters auto-collapse with "Show more" toggle. CSS `-webkit-line-clamp` for efficient clipping.

### Translate & Summarize (AI-Powered)
- **Translate Dialog** — Split-panel dialog: languages on left (searchable, popular chips), original + translated on right. Uses Gemini (default) or OpenAI. `POST /translate` API.
- **Summarize Dialog** — Auto-summarizes on open. Supports: text messages, PDF files (pdf-parse extraction), images (Gemini Vision base64), DOCX (XML text extraction), code/text files (direct read). `POST /translate/summarize` API. Regenerate + Copy buttons.
- **Dynamic Menu Items** — Message context menu loaded from `message_menu_items` DB table. Admin can Show/Hide per organization via `organization_message_menu_permissions`. Frontend caches menu items, filters hidden per org.

### Unread Count & Read Receipts
- **Realtime Unread Badge** — Backend emits `thread:update` with DB-accurate unread count on every message send. Frontend `upsertThread` updates sidebar badge instantly.
- **Green Tick (Read)** — When receiver opens thread, `markThreadAsRead` sends `message:read_ack` to sender. Both `threadService.markThreadMessagesRead` and `useConversationCache.markCacheMessagesRead` update for sidebar + chat window green ticks.
- **Unread Sync on Reconnect** — On socket connect, backend queries all pending unread counts and emits `thread:update` per sender.
- **Unread excludes recalled** — Filter: `message IS NOT NULL` (recalled = NULL, file = empty string = counted).

### Geo Location & Device Tracking
- **Sender Location** — `sentFrom: { city, country, device }` injected into `message_metadata` on send from `user_devices` table (cached on socket connect via `loadUserGeo`).
- **Reader Location** — `readFrom` included in `message:read_ack` events. Reader's device info from `user_devices`.
- **Message Info** — Shows sender location, reader location, device type (Desktop/Mobile/Tablet/Browser), platform (OS name).

### Owner Dashboard — System Monitoring
- **Socket Dashboard** — `GET /auth/owner/v1/system/socket-stats`: total connections, unique users online, connections by org, connected users list, socket rooms.
- **System Health** — Server uptime, Node.js version, memory usage (RSS/heap), platform, PID, CPU.
- **Database Stats** — Messages (total + 24h, DM vs Group), users (total/active), devices, organizations, sessions, top active orgs.
- **Realtime Push** — `system:socket-stats:subscribe` for live stats every 10 seconds (owner role only).

### Performance Optimizations
- **DM Query: UNION ALL** — Replaced OR condition with UNION ALL for index-friendly bidirectional message lookup.
- **Unread Count: Pre-aggregated JOIN** — Replaced N correlated subqueries with single LEFT JOIN with GROUP BY.
- **Batch Geo Loading** — `loadUserGeoBatch` fetches geo for multiple users in 1 query (DISTINCT ON).
- **Composite DB Indexes** — `idx_msg_org_sender_receiver_time`, `idx_msg_unread_lookup`, `idx_device_user_status_active`.
- **Conversation Loader Retry** — API fail → retry once → fallback to threadService cache.
- **useStickyScroll Fix** — `isAtBottomRef` (synchronous ref) prevents scroll-to-bottom when user is reading older messages.

### File Upload & Security
- **Max File Size** — 2 GB per chat file upload, 5 MB for profile images.
- **Dangerous File Types Blocked** — `multerChat.js` blocks executable and harmful file extensions at upload time:
  - Executables: `.exe`, `.msi`, `.com`, `.scr`, `.pif`
  - Scripts: `.bat`, `.cmd`, `.sh`, `.bash`, `.ps1`, `.vbs`, `.vbe`, `.wsf`, `.wsh`, `.js`, `.jse`
  - System/Libraries: `.dll`, `.sys`, `.drv`, `.ocx`, `.cpl`
  - Installers: `.deb`, `.rpm`, `.dmg`, `.app`, `.appimage`
  - Shortcuts: `.lnk`, `.url`, `.scf`
  - Registry: `.reg`, `.inf`
  - Java/.NET: `.jar`, `.class`
  - Office macros: `.docm`, `.xlsm`, `.pptm`, `.dotm`, `.xltm`
  - Other: `.hta`, `.crt`, `.ins`, `.isp`, `.msp`, `.sct`, `.ws`
- All other file types (images, videos, audio, PDF, docs, zip, etc.) are allowed.

### File Message Fixes
- **DB Constraint** — `messages.message_type` CHECK updated to include: image, video, audio, emoji, poll (was only: text, file, link, code, system).
- **File Size Formatting** — `humanFileSize()` formats bytes → "6.12 KB" / "3.8 MB" in both socket and controller `buildContent`.
- **buildContent** — File/media types get full metadata spread (fileKey, mimeType, caption, thumbnail, duration). Text types get clean content (text + html + edited + emoji flags only, no metadata leak).

### Message Delivery Status (Tick System)
- **Single Tick (sent)** — Message saved in DB, receiver offline. `delivered_at = NULL`.
- **Double Tick (delivered)** — Receiver came online, `delivered_at = NOW()` set. Backend emits `message:delivered_ack` to sender.
- **Green Tick (read)** — Receiver opened chat, `read_time = NOW()` set. Backend emits `message:read_ack` to sender.
- **DB Column** — `messages.delivered_at` (migration `045_messages_delivered_at.sql`).
- **On User Connect** — All undelivered messages (`delivered_at IS NULL`) marked delivered, grouped `delivered_ack` sent per sender.
- **Thread List** — Sidebar shows tick based on `lastMessageStatus` + `lastMessageDirection` (outgoing only).
- **Realtime** — Ticks update instantly via socket events without page refresh.

### AI-Powered Features

#### 1. AI Smart Reply Suggestions
- **What:** Jab user kisi message pe Reply karta hai, AI 3 professional reply suggestions generate karta hai.
- **How:** Reply click → `POST /translate/smart-reply` → Gemini AI generates 3 contextual replies → chips show above input field.
- **Language Match:** AI detects sender's language (English/Hindi/Hinglish) and replies in the same language.
  - Server-side language detection using regex pattern matching for Hindi Roman words + Devanagari script detection.
- **Example:**
  - Message: `"bhavesh jaane se pehale mujhe hosting ka access deke jana"` (Hinglish)
  - Suggestions: `["Sure, main dekh leta hoon", "Noted, abhi kar deta hoon", "Theek hai, handle kar lunga"]`
  - Message: `"Can you review my PR?"` (English)
  - Suggestions: `["Sure, I'll take a look", "Noted, will review shortly", "Got it, thanks!"]`
- **Click behavior:** Suggestion click → text inserted into composer input (not auto-sent). User can edit before sending.
- **Tone:** Professional workplace tone. No slang (bhai/yaar/bro).

#### 2. AI Grammar Autocorrect
- **What:** Toggle-based grammar/spelling correction while typing in the composer.
- **How:** Footer toolbar magic wand icon (✨) → ON/OFF toggle. When ON, after user stops typing for 1.5 seconds, `POST /translate/grammar` is called.
- **Flow:**
  1. User enables grammar toggle (icon turns blue)
  2. User types: `"i wnt to discus about the proect tommorow"`
  3. After 1.5s pause, AI checks grammar
  4. Suggestion appears above input: `"I want to discuss about the project tomorrow."` (blue left border)
  5. User clicks **Accept** → text replaced in editor. Or **Dismiss** → suggestion removed.
- **Language Preservation:** English stays English, Hinglish stays Hinglish. No translation.
- **Example:**
  - Input: `"mujhe hosting ka access chahye pehle"` → Corrected: `"Mujhe hosting ka access chahiye pehle."`
  - Input: `"The meeting is at 3pm today"` → Corrected: `"The meeting is at 3:00 PM today."`
  - Input: `"i wnt to discus about the proect"` → Corrected: `"I want to discuss about the project."`

#### 3. AI Smart Search (Natural Language)
- **What:** Toggle between Normal Search and AI-powered Smart Search. Smart Search understands natural language queries.
- **How:** In-chat search bar has a **Smart** toggle (magic wand icon). When ON, `POST /chat/smart-search` sends query to Gemini AI which parses it into structured filters (keywords, type, sender, date range).
- **Flow:**
  1. User enables Smart toggle in search bar
  2. Types: `"Bhavesh ne last week kya files share ki thi?"`
  3. AI parses → `{ keywords: [], types: ["file","image","video","audio"], senderName: "Bhavesh", dateRange: "last7" }`
  4. Backend filters messages from full DB using parsed filters
  5. Results shown in chat with proper rendering (images, files, links all display correctly)
- **Examples:**
  - `"show me all images"` → filters: type=image → all 8 images from full DB
  - `"hosting access wala message"` → keywords: ["hosting","access"] → text search
  - `"links shared today"` → type=link, date=today
  - `"code snippets from Hardik"` → sender=Hardik, type=code
- **Normal Search (toggle OFF):** Keyword-based text match + manual type/date/user filters.

#### 4. Summarize with Cache
- **What:** AI-generated summary for text messages and files (PDF, DOCX, images, code, etc.).
- **How:** `POST /translate/summarize` → extracts file content (PDF via pdf-parse, DOCX via AdmZip, images via Gemini Vision) → generates 3-5 bullet point summary.
- **Cache:** Summaries stored in `summary_cache` DB table (SHA-256 hash key). Same content = instant cached response, no repeat API call.
- **Regenerate:** Sends `previousSummary` to AI with instruction to generate a completely different summary. Cache overwritten on regenerate.
- **Subtitle:** Shows `"12789 characters · 2150 words"` count.
- **Supported formats:** PDF, DOCX, XLSX, CSV, TXT, JSON, JS, SQL, images (Gemini Vision), and all text-based files.

#### 5. Translate
- **What:** Split-panel translate dialog. Languages on left (searchable, popular chips), original + translated on right.
- **How:** `POST /translate` → Gemini (default) or OpenAI provider.

### Media, Links & Docs (Full Database)
- **What:** Profile sidebar shows ALL shared images, media (video/audio), links, and docs from the complete database — not just loaded chat.
- **How:** `GET /chat/threads/:id/media?type=images|media|links|docs|pinned|all` — dedicated API per type.
- **Counts:** Tab labels show real counts from full DB (e.g., Images (8), Links (10), Docs (18)).
- **File Preview:** Click any file → `FilePreviewOverlay` opens with:
  - Images: native `<img>` rendering (full size, zoom)
  - Videos: `<video>` player with controls
  - Audio: `<audio>` player with controls
  - PDFs: iframe viewer (Google Docs fallback)
  - Office docs (PPTX/DOCX/XLSX): Microsoft Office Online viewer
  - Code/text files (JS/SQL/CSV): monospace text preview
  - Navigation: left/right arrows to browse all files
- **Pinned messages:** File-type pinned messages also open preview on click.

### Full-Database Search
- **What:** Search across ALL messages in database, not just loaded ~50 messages.
- **How:** `GET /chat/search?q=hello&threadId=dm-5&types=image,file&limit=50`
- **Encrypted messages:** Backend decrypts AES-256-GCM encrypted messages, then performs text matching server-side.
- **Search fields:** Message text, fileName, caption, title, description, URL, code content, language, fileType, mimeType.
- **Type filter:** `types` param filters by message type (image, video, file, link, code, audio).
- **Results:** Fully normalized messages with signed S3 URLs — render identically to normal chat messages.

### Pin Messages (Persist)
- **What:** Pin/unpin messages that survive page reload.
- **How:** Pin click → `chatSocket.pinMessage()` → `message:pin` socket event → backend updates `message_metadata.pinned = true` (encrypted) → persists in DB.
- **Previously:** Pin was local-only (frontend state), lost on reload. Now persisted via socket → DB.

### AI Assistant (Live Support Agent)
- **What:** Intelligent, role-aware AI support agent embedded in TeamChatX. Knows all app features and provides step-by-step guidance.
- **Access:** 🤖 Robot icon in left sidebar → toggles assistant panel.
- **Multi-Provider:** Uses active AI provider from `ai_providers` DB table (Gemini/OpenAI/Claude). No `.env` dependency.
- **Role-Aware Responses:**
  - Normal User (role 3/4): Chat features only — messaging, search, AI, files, settings
  - Admin (role 2): Chat + admin panel — user/group management, controls
  - Owner (role 1): Everything — chat + admin + billing + owner dashboard + AI providers
- **Language Match:** Responds in user's language (English/Hindi/Hinglish auto-detected).
- **Features:**
  - Suggested Questions: 2-3 clickable follow-up chips after every response
  - Feedback: 👍👎 buttons on every response, stored in `assistant_feedback` table
  - Code Highlight: Code blocks with language label + copy button
  - Conversation History: Auto-saved to `assistant_conversations` DB table (JSONB)
  - History Panel: Clock icon → list/load/delete past conversations
  - Resize: Small (320×420) / Medium (380×540) / Large (480×full height)
  - Usage Tracking: Response time + question count per user per day in `assistant_usage` table
  - Multi-language Welcome: Browser language detected → Hindi/English welcome
  - Theme Sync: Dark/light mode matches app
- **Backend:** `POST /live-assistant/chat` → resolves AI provider → calls Gemini/OpenAI/Claude → tracks usage → returns reply
- **DB Tables:** `ai_providers`, `assistant_feedback`, `assistant_conversations`, `assistant_usage`

### AI Provider Management (Dynamic)
- **What:** AI provider config stored in DB instead of `.env`. Admin can switch providers from Owner Dashboard.
- **Table:** `ai_providers` — provider_key, api_key, model, is_active, status
- **Providers:** Google Gemini, OpenAI, Anthropic Claude (seeded on setup)
- **UI:** Owner Dashboard → System Monitoring → AI Providers
  - Card per provider with color coding (Gemini=green, OpenAI=blue, Claude=red)
  - Configure: API key + model selection
  - Activate/Deactivate: One active at a time, auto-deactivates others
- **Access:** GET = any user, PATCH = owner only (role_id=1)
- **Used by:** All AI features — Translate, Summarize, Smart Reply, Grammar, Smart Search, AI Assistant, Tone Adjuster, Semantic Search, Call Notes, Smart Composer, Voice-to-Text, Auto-Translate
- **Cache:** Active provider cached 60 seconds to avoid DB hit per AI call

### User Timezone
- **What:** Users select timezone in Profile settings. All chat times display in user's timezone.
- **DB:** `users.timezone` column (default 'UTC'), 335 timezones in `timezones` table
- **API:** `PATCH /auth/me/timezone` to update, `GET /auth/me` returns timezone
- **Frontend:** `utils/timezone.js` global store, `formatTime()` / `formatDayLabel()` / `formatThreadTimestamp()` all timezone-aware
- **Affected:** Message bubbles, day dividers, thread list times, message info overlay (sent/read/edited timestamps)

### Create Group (In-Chat)
- **What:** Users can create groups directly from the chat sidebar without going to Admin panel.
- **How:** Click the **+** FAB button (bottom-right of chat list) → **Create Group** → Fill details → **Create**
- **Dialog fields:**
  - **Group Name** (required, max 100 chars)
  - **Purpose / Description** (optional)
  - **Add Members** — searchable list of all org members
  - **Selected Members** — shows selected members (creator auto-added)
- **Validation:** Group name required + at least 1 member
- **Toast:** "Group created" on success, error message on failure
- **FAB Menu:**
  - **Create Group** — visible to all roles (1, 2, 3, 4)
  - **Broadcast** — visible to **Owner only** (role_id = 1), hidden for all other roles
- **Component:** `ChatListActionsMenu.jsx` → `GroupMembersDialog.jsx`
- **Backend:** `POST /groups` + `POST /group-members` (existing APIs)

## Update Log (2026-03-19) — Socket Reliability & Notification Overhaul

### Socket Auth — Stale Token Reconnection Fix
- **Problem:** Socket reconnection failed when JWT access token expired (15 min). Client sent stale `auth.token` which took priority over a fresh `access_token` cookie (refreshed by REST API calls). Result: user appeared offline on server, no messages delivered, no online status broadcast.
- **Fix:** `authenticateSocket` middleware now tries ALL token sources (auth.token, Authorization header, access_token cookie) and uses the first one that passes `jwt.verify()`. A fresh cookie now rescues an expired explicit token on reconnect.
- **New Event:** `auth:refresh_token` socket event — client can push a fresh token mid-session after REST refresh. Server verifies and updates `socket.user`.

### Online Status — Cross-Org Leak Fix
- **Problem:** `users:online_list` event sent ALL online users from ALL organizations to the connecting user.
- **Fix:** Added `userOrgMap` (userId → orgId) tracking. `users:online_list` now only includes users from the same organization. Map cleaned up on disconnect.

### DM Message Status — `normalizeDMMessage` Fix
- **Problem:** `status` field was `row.read_time ? 'read' : 'delivered'` — undelivered messages (no `delivered_at`) incorrectly showed as `delivered` (double tick) when fetched via REST API.
- **Fix:** Now `row.read_time ? 'read' : row.delivered_at ? 'delivered' : 'sent'`.

### DM `message:send` — Missing `delivered_ack`
- **Problem:** When receiver was online but not viewing the sender's thread (status = `delivered`), the sender's ack response had `status: 'delivered'` but no `message:delivered_ack` event was emitted. Sender's UI wouldn't update to double tick in real-time.
- **Fix:** Added `emitToUser(userId, 'message:delivered_ack', ...)` in the `delivered` branch.

### `message:forward` — Full Delivery Status
- **Problem:** Forwarded DM messages had no delivery status logic (sent/delivered/read), no `delivered_at` DB update, no `thread:update` unread count, no `delivered_ack`/`read_ack` to sender.
- **Fix:** Forward handler now has identical delivery logic to `message:send` — determines status, updates `delivered_at`, emits `delivered_ack`/`read_ack`, sends `thread:update` with unread count, and returns status in ack.

### `message:delete` — Group Support Added
- **Problem:** Delete handler only had DM branch. Group message delete silently did nothing.
- **Fix:** Added `deleteGroupMessage` to `chatModel.js` + group branch in socket handler. Same pattern as DM — marks metadata `deleted: true`, sets `message = NULL`, emits `message:deleted` to sender.

### Group `message:send` — Missing `thread:update`
- **Problem:** Group messages didn't send `thread:update` with unread count to members not viewing the group thread. Sidebar unread badge didn't update in real-time.
- **Fix:** Added `thread:update` emit with DB-queried unread count from `group_message_recipients` for each member not viewing the thread.

### Group `message:edit` — Missing Notification
- **Problem:** DM edit had notification but group edit didn't.
- **Fix:** Added `type: 'edit'` notification for group members (online + not viewing thread).

### `tab-visibility` — Server Handler Added
- **Problem:** Frontend emitted `tab-visibility` event on tab focus/blur but server had no handler — event silently dropped.
- **Fix:** Added handler that re-broadcasts `user:online` to org room when user returns to tab (`tabcheck === 1`).

### Notification Coverage (Final Map)
| Event | DM | Group | Notification |
|---|---|---|---|
| `message:send` | `type: 'message'` | `type: 'message'` | Yes |
| `message:forward` | `type: 'message'` | `type: 'message'` | Yes |
| `message:edit` | `type: 'edit'` | `type: 'edit'` | Yes |
| `message:react` | `type: 'reaction'` | `type: 'reaction'` | Yes |
| `message:pin` | — | — | No |
| `message:recall` | — | — | No |
| `message:delete` | — | — | No |

All notifications follow the same pattern: only sent when receiver is **online** AND **not viewing the thread**.

---

## Mobile App (React Native Expo)

### Tech Stack
- React Native + Expo SDK 54
- Expo Router (file-based routing)
- Socket.IO Client (real-time messaging)
- AsyncStorage (offline cache)
- SecureStore (tokens, biometric credentials)
- expo-image, expo-audio, expo-local-authentication

### Authentication
- Email/Password login with OTP verification
- Biometric login (Fingerprint / Face ID) — credentials stored in SecureStore
- Auto token refresh on expiry
- Persistent login across app restarts

### Chat Features
- **Real-time messaging** via Socket.IO (polling + websocket upgrade)
- **REST API fallback** — messages send even when socket disconnected
- **Message types**: text, image, video, audio, file, link, code, emoji
- **Message actions** (long-press menu):
  - Delete (per-user, own messages)
  - Unsend/Recall (both sides, own messages)
  - Edit (own text messages, with edit bar UI)
  - Copy (text/link/code to clipboard)
  - Reply (with reply context bar + metadata)
  - Forward (contact picker + `message:forward` socket event)
  - Pin/Unpin
  - Translate (via backend AI)
  - Summarize (via backend AI)
  - Info (message details)
  - Select (multi-select mode for bulk actions)
- **Show more/less** — long messages (>300 chars) truncated with expand toggle
- **Date separators** — Today, Yesterday, Monday, etc.
- **Delivery ticks** — sent (✓), delivered (✓✓ grey), read (✓✓ blue)
- **Typing indicator** support
- **Inverted FlatList** — messages always start at bottom
- **Scroll-to-bottom FAB** with animated show/hide

### File Sharing
- **Image picker** — gallery (multi-select up to 5) + camera
- **Document picker** — any file type
- **File preview before send** — thumbnail cards with name, size, remove button
- **Audio recording** — expo-audio, waveform UI, duration timer
- **Dangerous file blocking** — `.exe`, `.bat`, `.dll` etc. blocked at upload
- **In-app preview** — images/files open in expo-web-browser, links open in external browser

### Search
- **Thread filter** — local search by chat name (instant)
- **Global search** — `GET /chat/search` across all messages in all chats
- **In-chat search** — search within specific thread with type filter chips (text, image, video, file, link, audio, code)
- **Advanced search page** — `/chat/search` with type filters, result cards per type

### Offline & Cache
- **AsyncStorage JSON cache** for threads, messages (50 per thread), profiles
- **Cache-first loading** — instant UI from cache, then silent API refresh
- **New messages auto-cached** on receive
- **Cache cleared on logout**

### Notifications
- **Local notifications** via expo-notifications
- **Android channels** — Messages (MAX), Groups (HIGH)
- **Smart suppression** — no notification if viewing same thread
- **Deduplication** — same sender+thread within 2 seconds = skip
- **Tap notification** → navigates to chat thread
- **Badge count** on app icon

### Contact Info (WhatsApp-style)
- **Profile hero** — avatar, name, designation (gradient header)
- **Quick actions** — Message, Search, Mute, Report
- **Personal details** — email, phone, department, designation, location, joined date
- **Stats** — messages sent, groups count
- **Media/Links/Docs tabs** — pill-style tabs with counts
  - Images: grid view with in-app preview modal
  - Links: card list with thumbnail/globe icon, hostname, date
  - Docs: card list with extension badge, size, download button
- **Global search** in contact info — search across all chats

### Settings (Single scroll, expandable sections)
- **Profile Info** — department, designation, mobile, company, domain, location, timezone
- **Change Password** — old/new/confirm with validation
- **Active Devices** — OS-specific icons (Android/iOS/Windows), current device indicator, revoke, logout all
- **Appearance** — dark mode toggle, Light/Dark/System theme chips
- **Customize** — brand color (8 presets + custom HEX), font selection (5 fonts), font size (S/M/L) — all apply globally
- **Permissions** — camera, gallery, microphone, notifications with grant/deny status
- **About** — version info

### UI/UX
- **Onboarding** — animated feature grid, trust badges, Get Started CTA
- **Login** — compact no-scroll layout, biometric button, gradient branding
- **Register** — 2-column fields, all required, phone mandatory
- **Splash screen** — animated icons in orbit, brand gradient
- **Dark mode** — full support across all screens
- **Brand theming** — accent color, font, font size persist in SecureStore
- **Global font override** — `Text.render` + `TextInput.render` monkey-patched for font family
- **Status bar** — dark text on light mode, light text on colored headers
- **Safe area** — proper insets for all devices (notch, gesture nav)
- **WhatsApp-style chat bubbles** — green own/white other, notch tail, forwarded label, reply context
- **Performance** — FlatList optimization (removeClippedSubviews, maxToRenderPerBatch, windowSize, getItemLayout)

### AI Tone Adjuster
- **What:** Rewrite any message in Formal, Friendly, Diplomatic, or Professional tone.
- **How:** Right-click message → "Adjust Tone" → select tone → AI rewrites → Copy result.
- **API:** `POST /translate/tone-adjust` — `{ text, tone }` → `{ adjusted, original, tone, provider }`
- **Language Aware:** Keeps same language (English stays English, Hindi stays Hindi, Hinglish stays Hinglish).
- **UI:** `ToneAdjusterDialog.jsx` — color-coded tone chips, original vs adjusted text, copy button.

### AI Semantic Search
- **What:** Search messages by meaning, not exact keywords. "meetings about deployment last week" → finds relevant messages even without exact word match.
- **How:** Search bar → enable "Semantic" toggle → type query → AI expands into keywords + synonyms + date hints → filters from full DB.
- **API:** `POST /translate/semantic-search` — `{ query, threadId, limit }` → `{ results, interpretation, expandedTerms, dateHint }`
- **UI:** Purple "Semantic" toggle next to "Smart" toggle in search bar. Mutually exclusive with Smart Search.

### AI Call Transcription & Notes
- **What:** Auto-generate meeting notes after audio/video call ends.
- **How:** Call ends (>10 seconds) → `CallNotesDialog` auto-opens → AI generates structured notes from chat context.
- **API:** `POST /translate/call-notes` — `{ callDuration, participants, chatContext }` → `{ notes: { summary, keyPoints, actionItems } }`
- **UI:** `CallNotesDialog.jsx` — Summary section (blue accent), Key Points (numbered), Action Items (checkmarks), Copy Notes button.

### AI Smart Composer
- **What:** Real-time autocomplete suggestions as user types in the chat composer.
- **How:** Enable lightning bolt toggle in footer toolbar → type 10+ characters → wait 2 seconds → AI suggests 3 completions → click chip to insert.
- **API:** `POST /translate/smart-compose` — `{ partialText, context, threadType }` → `{ completions: [string, string, string] }`
- **UI:** Orange lightning icon toggle in footer toolbar. Completion chips appear above editor (same style as Smart Reply chips). Click to accept.

### AI Voice-to-Text (Audio Transcription)
- **What:** Convert any audio/voice message to polished text using AI.
- **How:** Audio message → click "Convert to Text" button (Aa icon) → AI transcribes audio → text appears below player with copy button.
- **API:** `POST /translate/transcribe-audio` — `{ fileUrl, fileKey, fileName }` → `{ transcription, provider }`
- **Providers:** OpenAI (Whisper API) for accurate speech-to-text, Gemini (inline audio) for transcription. Anthropic not supported for audio.
- **UI:** Blue Aa icon button on audio player. Transcription box with primary accent, copy button. Click again to hide.

### AI Translate & Send
- **What:** Translate typed message to any language before sending. User sees the translated text in the composer, can review/edit, then send normally.
- **How:** Footer toolbar → green Globe icon → pick language → type message → click **Convert** chip → translated text replaces input → click **Original** to revert → send when ready.
- **API:** Uses existing `POST /translate` endpoint with selected target language.
- **UI Flow:**
  1. Globe icon in toolbar → language picker menu (14 languages)
  2. Indicator bar appears: `{Language}` | `Change` | `Convert` | `OFF`
  3. Type any message → click **Convert** → input text replaced with translation
  4. **Convert** chip becomes **Original** chip (orange) → click to revert to original text
  5. **Translating...** spinner shown during API call
  6. Send button works instantly (no delay — translation already done)
- **Languages:** English, Hindi, Spanish, French, German, Arabic, Chinese, Japanese, Korean, Portuguese, Russian, Italian, Turkish, Urdu.
- **Persistence:** Selected language saved in localStorage across sessions.

### Screen Share (WebRTC)
- **What:** 1:1 screen sharing via WebRTC peer-to-peer.
- **How:** Header → Screen Share icon → select screen/window → peer accepts → live stream.
- **Socket Events:** `screenshare:request`, `screenshare:accept`, `screenshare:reject`, `screenshare:signal`, `screenshare:stop`
- **Features:** Annotation canvas, remote control (request/grant/revoke), data channel messaging.

### Audio/Video Call (WebRTC)
- **What:** 1:1 audio and video calls via WebRTC.
- **How:** Header → Phone/Video icon → peer accepts → bidirectional call with mute/camera toggle.
- **Socket Events:** `call:request`, `call:accept`, `call:reject`, `call:signal`, `call:stop`
- **Features:** Call timer, mute audio, toggle camera, minimize/fullscreen, calling/connecting/active states.
- **Sounds:** Web Audio API — incoming ringtone, outgoing ring, connected chime, ended tone.
- **Call Notes:** Auto-generate AI meeting notes after call ends (>10 seconds).

### Export Chat
- **What:** Download DM conversation as text (.txt) or PDF (.pdf).
- **How:** Header → three-dot menu → Export Chat → choose format → file downloads.
- **Text:** Backend endpoint `GET /chat/threads/:threadId/export?format=txt`.
- **PDF:** Client-side jsPDF generation with message formatting.

### Socket Connection
- **Singleton global socket** — shared across all screens
- **Auto-reconnect** on app foreground, token refresh on auth error
- **Polling → WebSocket upgrade** for compatibility
- **Connection status** — "Online" / "Connecting..." in chat header, red offline banner
- **Event handler persistence** — survives reconnects via global registry

---

## Added 2026-04-14

### Pinned Chats
- **What:** Pin up to 20 chats to the top of the chat list, per user.
- **How:** Right-click a thread in the list → Pin chat. Pinned threads sort by
  `pinned_at DESC` above everything else and show a small blue pin icon next
  to the mute indicator.
- **State:** `user_thread_pins` table, soft-capped at 20 in `threadPinModel`.
- **Socket events:** `thread:pin` (emit), `thread:pin_sync` (on connect),
  `thread:pin_update` (broadcast to all of the user's tabs).

### Missed Call History in Chat
- **What:** Declined / unanswered / offline calls post a `📞 Missed audio/video
  call` text entry into the DM thread for both sides.
- **How:** `socket.logCall` is invoked from `call:reject`, `call:stop` (reason
  `no_answer`) and the offline branch of `call:request`. Writes both a DM and
  a `call_logs` row in one pass.

### Per-Contact Call History Dialog
- **What:** "Call History" entry in the conversation header three-dot menu
  (DM threads only). Opens a dialog scoped to that contact with All /
  Missed / Audio / Video filters, direction icons and duration.
- **API:** `GET /calls?peer_id=<userId>`.

### Full-Page Meeting Hub
- **What:** Dedicated `/app/meeting` route replacing the modal. Tabs: Instant,
  Schedule, Join. Invite org members via the user picker, add up to two
  external guests by email in the same form.
- **Sidebar:** `PiVideoConferenceFill` icon under Chats. Only one sidebar icon
  is highlighted at a time.

### Meeting History (Past)
- **What:** `MeetingsList` gains Upcoming / Past tabs. Past includes status
  `ended` / `cancelled` and any meeting whose `scheduled_at` is 4h+ in the
  past. Shows host, time and `duration_minutes`.
- **API:** `GET /meetings/past?limit=&offset=`.

### External Guest Meeting Join
- **What:** Invited external emails receive a branded invite with a link
  `/guest/<access_token>` and a 6-digit `access_code`. Guests open the link,
  enter name + code, and join the `MeetingRoom` directly — no signup or
  login.
- **API:** `POST /meetings/` accepts `guest_emails[]` (max 2).
  `GET /meetings/guest/:token` returns meeting preview.
  `POST /meetings/guest/:token/verify` issues a short-lived guest JWT
  (`guest: true`, 4h) used for the socket handshake.
- **Email:** Uses `sendMailAsync` with a branded HTML template.

### Background Web Push (VAPID)
- **What:** Users receive notifications for messages, incoming calls, missed
  calls, meeting invites and screen-share requests even when the tab or
  browser is closed.
- **Stack:** `web-push` (backend) + service worker `push` handler
  (`frontend/public/sw.js`) + VAPID key pair in env.
- **Client registration:** `ensurePushSubscription()` runs 1.5s after
  `DashboardLayout` mounts; it diffs the existing `PushSubscription` against
  the current VAPID key and re-subscribes on mismatch.
- **De-dup:** Service worker suppresses the native toast when any window
  client is `visible && focused` (in-app UI handles it); incoming-call pushes
  always show to avoid missing ringing.

### Live Mute / Camera Indicators in calls
- **What:** Mute and camera toggles broadcast a `call:signal { type: 'media-state' }`
  frame so the peer UI shows a red "muted" / "camera off" badge in real time.
- **Applies to:** 1:1 audio/video calls on both web and mobile.

### Minimize-Safe Call Audio
- **What:** A hidden `<audio autoPlay>` element mounted at the overlay root
  keeps the remote call audio playing through calling / connecting / active /
  minimized states and across the call-notes dialog.

### Caller Ring Timeout (45s)
- **What:** Outgoing calls cancel after 45 seconds if unanswered. Fires a
  `call:stop { reason: 'no_answer' }` so the backend records a missed entry
  for both parties.

### Cross-Platform Call Interop
- **What:** Web and mobile now share the same signaling flow: call:request
  (no offer) → call:accept → offer-via-call:signal → answer-via-call:signal.
  Mobile↔Web calls used to die at pick up because of a pre-offer mismatch;
  they no longer do.

### Reliable Background Connection
- **What:** Sockets refresh the access token on every reconnect attempt and
  force-reconnect on `visibilitychange`, `focus` and `online`. Tabs that were
  suspended for hours now recover without a reload.

### Screen-Share Incoming Notification
- **What:** `useScreenShare` now shows a system notification (and requests
  permission on mount) when an incoming share request arrives.

### Sidebar Meeting Shortcut
- **What:** Added a Meeting quick-action icon under the Chats icon that
  navigates to `/app/meeting`, with active-state highlight.
