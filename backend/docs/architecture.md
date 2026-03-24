# TeamChatX - Project Architecture

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, MUI (Material-UI), Redux Toolkit |
| Backend | Node.js + Express |
| Real-time | Socket.IO |
| Database | PostgreSQL |
| Cache | Redis (optional, flag-controlled) |
| Storage | AWS S3 |
| Email | Nodemailer (SMTP, dynamic config from DB) |
| AI | Gemini / OpenAI (translation, live assistant) |
| Auth | JWT (access + refresh tokens) |
| Encryption | AES-256-GCM (messages + metadata) |

---

## Project Structure

```
TeamChat/
├── backend/
│   ├── src/
│   │   ├── server.js              # Entry point (HTTP + Socket.IO)
│   │   ├── app.js                 # Express app setup + route mounting
│   │   ├── config/
│   │   │   ├── database.js        # PostgreSQL pool (pg)
│   │   │   ├── redis.js           # Redis client (optional)
│   │   │   ├── s3.js              # AWS S3 client + presigned URLs
│   │   │   ├── multer.js          # Profile pic upload (5MB, memory)
│   │   │   └── multerChat.js      # Chat file upload (2GB max, disk)
│   │   ├── chat/
│   │   │   ├── chatRoutes.js      # /chat/* REST endpoints
│   │   │   ├── chatController.js  # Chat REST handlers
│   │   │   └── chatModel.js       # Chat DB queries (encrypted)
│   │   ├── socket/
│   │   │   └── index.js           # Central socket handler with org controls cache, typing, reactions, recall, file signing
│   │   ├── routes/                # 25+ route files (auth, admin, billing...)
│   │   ├── controllers/           # 33 controller files
│   │   ├── models/                # 33 model files (DB queries)
│   │   ├── middlewares/           # 25 middleware files
│   │   │   ├── auth.js            # JWT authentication
│   │   │   ├── csrf.js            # CSRF protection
│   │   │   ├── errorHandler.js    # Global error handler
│   │   │   ├── requireOwner.js    # Owner-only access
│   │   │   └── requireNotRoleId.js # Block specific roles
│   │   └── utils/
│   │       ├── messageCipher.js   # AES-256-GCM encryption for messages & metadata
│   │       ├── jwt.js             # Token generation/verification
│   │       ├── httpCookies.js     # Cookie management
│   │       ├── mail.js            # Email sending
│   │       ├── cache.js           # Redis caching layer
│   │       ├── activityLog.js     # Activity logging
│   │       ├── signProfileUrls.js # S3 presigned URL signing
│   │       ├── signFileUrls.js    # Signs S3 file URLs on demand for chat files
│   │       └── response.js        # HTTP response helpers
│   ├── migrations/                # 40 SQL migration files
│   ├── .env                       # Environment config
│   └── .env.example               # Template
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Root component
│   │   ├── pages/
│   │   │   ├── dashboard/
│   │   │   │   ├── GeneralApp.jsx # Main chat interface
│   │   │   │   ├── Admin.jsx      # Admin panel
│   │   │   │   ├── Settings.jsx   # User settings
│   │   │   │   └── Owner/         # Owner dashboard
│   │   │   ├── auth/              # Login, Register, Reset
│   │   │   └── website/           # Public pages
│   │   ├── components/
│   │   │   ├── chats/             # Chat list sidebar
│   │   │   │   ├── ChatList.jsx   # Thread roster
│   │   │   │   ├── ChatElement.jsx # DM thread item
│   │   │   │   └── GroupElement.jsx # Group thread item
│   │   │   └── conversation/      # Message area
│   │   │       ├── Header.jsx     # Thread header
│   │   │       ├── Footer.jsx     # Message composer
│   │   │       ├── Message.jsx    # Message renderer
│   │   │       ├── messages/      # Message type components
│   │   │       │   ├── MessageItem.jsx
│   │   │       │   ├── MessageMenu.jsx
│   │   │       │   ├── FileMsg.jsx
│   │   │       │   ├── MediaMsg.jsx
│   │   │       │   └── ...
│   │   │       ├── files/         # File handling
│   │   │       └── emoji/         # Emoji picker
│   │   ├── hooks/
│   │   │   ├── useChatSocket.js   # Socket event bridge
│   │   │   ├── useChatSync.js     # Initial data sync
│   │   │   ├── useThreadData.js   # Thread state (useSyncExternalStore)
│   │   │   ├── useConversationCache.js # LRU message cache
│   │   │   ├── useThreadMessagesState.js # Message windowing
│   │   │   └── useChatLock.js     # PIN-based chat lock
│   │   ├── contexts/
│   │   │   ├── SocketContext.jsx   # Socket.IO connection
│   │   │   ├── PresenceProvider.jsx # Online/Idle/Away
│   │   │   ├── TypingIndicatorContext.jsx # Typing state
│   │   │   ├── ChatLockContext.jsx # Chat lock state
│   │   │   └── ConnectivityContext.jsx # Internet status
│   │   ├── services/
│   │   │   ├── chatApi.js         # Chat REST API calls
│   │   │   └── threadService.js   # Global chat state (singleton)
│   │   ├── utils/
│   │   │   ├── authApi.js         # Auth + fetchWithAuth
│   │   │   ├── secureStorage.js   # Encrypted localStorage
│   │   │   ├── notificationBridge.js # System notifications
│   │   │   └── ...
│   │   ├── redux/
│   │   │   ├── store.js           # Redux store (persist)
│   │   │   └── slices/app.js      # Sidebar state
│   │   └── routes/
│   │       └── index.jsx          # Route config (lazy loaded)
│   ├── public/
│   │   └── sounds/                # Notification sounds (sound1-8.mp3)
│   └── dist/                      # Built output
│
└── docs/                          # This documentation
```

---

## Data Flow Architecture

Messages flow through AES-256-GCM encryption (via `messageCipher.js`) before DB storage. File uploads go through: **Browser → Backend (multer) → S3 (multipart upload with progress)**.

```
┌──────────────────────────────────────────────────────────────┐
│                         FRONTEND                              │
│                                                               │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │ GeneralApp  │───>│ useChatSocket│───>│ SocketContext   │  │
│  │ (Main Page) │    │ (Hook)       │    │ (io connection) │  │
│  └──────┬──────┘    └──────────────┘    └───────┬────────┘  │
│         │                                        │           │
│  ┌──────▼──────┐    ┌──────────────┐    ┌───────▼────────┐  │
│  │ threadService│<──│ useThreadData│    │  Socket.IO      │  │
│  │ (Singleton) │    │ (Hook)       │    │  WebSocket      │  │
│  └──────┬──────┘    └──────────────┘    └───────┬────────┘  │
│         │                                        │           │
│  ┌──────▼──────┐    ┌──────────────┐            │           │
│  │ localStorage│    │  chatApi.js  │────REST────┘           │
│  │ (cache)     │    │  (HTTP)      │                        │
│  └─────────────┘    └──────────────┘                        │
└──────────────────────────────────────────────────────────────┘
                           │ Socket.IO + REST
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                         BACKEND                               │
│                                                               │
│  ┌──────────┐   ┌─────────────┐   ┌──────────────────────┐  │
│  │ Express  │   │ Socket.IO   │   │ Middleware            │  │
│  │ Routes   │   │ Server      │   │ (auth, csrf, roles)   │  │
│  └────┬─────┘   └──────┬──────┘   └──────────────────────┘  │
│       │                 │                                     │
│  ┌────▼─────────────────▼──────┐                             │
│  │       Controllers           │                             │
│  │  (chatController, etc.)     │                             │
│  └────────────┬────────────────┘                             │
│               │                                               │
│  ┌────────────▼────────────────┐   ┌──────────────────────┐  │
│  │       Models                │   │  messageCipher.js     │  │
│  │  (chatModel, etc.)         │──>│  (encrypt/decrypt)    │  │
│  └────────────┬────────────────┘   └──────────────────────┘  │
│               │                                               │
│  ┌────────────▼────────────────┐   ┌──────────────────────┐  │
│  │     PostgreSQL              │   │  AWS S3              │  │
│  │  (encrypted data)           │   │  (files/images)      │  │
│  └─────────────────────────────┘   └──────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Role System

| role_id | Role Key | Access Level |
|---------|----------|-------------|
| 1 | owner | Full access — all endpoints, owner dashboard |
| 2 | admin | Admin panel, user/org management, billing |
| 3 | member | Chat, profile, settings |
| 4 | guest | Chat only (blocked from admin routes via `blockRole4`) |

---

## Database (PostgreSQL)

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts (name, email, password hash, profile) |
| `organizations` | Organization entities |
| `organization_members` | User-org membership (role, dept, designation, location) |
| `roles` | Role definitions |
| `messages` | DM messages (encrypted) |
| `group_messages` | Group messages (encrypted) |
| `group_message_recipients` | Per-user delivery status for group messages |
| `groups` | Group entities |
| `group_members` | Group membership |
| `message_actions` | Pin/delete/react actions on DM messages |
| `group_message_actions` | Pin/delete/react actions on group messages |

### Support Tables

| Table | Purpose |
|-------|---------|
| `departments` | Organizational departments |
| `designations` | Job titles/designations |
| `locations` | Office locations |
| `plans` | Subscription plans |
| `subscriptions` | Active subscriptions |
| `payment_history` | Payment records |
| `activity_log` | Audit trail |
| `user_devices` | Device tracking |
| `user_sessions` | Login sessions |
| `languages` | Supported languages |
| `timezones` | Timezone list |
| `platforms` | Supported platforms |
| `organization_controls` | Feature flags per org |
| `payment_gateways` | Payment gateway configurations |
| `billing_checkout_sessions` | Billing checkout session records |
| `smtp_settings` | Dynamic SMTP configuration per org |

55 tables total. 40 SQL migration files in `backend/migrations/`

---

## Key Patterns

### State Management (Frontend)
- **threadService** (Singleton): Global chat state using `useSyncExternalStore` (like Zustand)
- **Redux**: Only for sidebar state (`app` slice)
- **Context**: Socket, Presence, Typing, ChatLock, Connectivity, Settings

### Caching
- **Frontend**: localStorage (`chatx.threadCache.v1`), LRU conversation cache (20 max)
- **Backend**: Redis (optional, version-invalidated entity cache)
- **Socket**: Organization controls preloaded into memory cache (5-min TTL) on socket connect. Invalidated on admin update.

### Performance
- Upload progress throttled to 5% increments
- `threadService.emit` debounced 50ms
- Message cache capped at 200/thread
- localStorage persistence disabled (backend is source of truth)

### Security
- JWT access tokens (15m) + refresh tokens (90d)
- CSRF protection on mutations (CSRF exemption for file upload routes — JWT auth sufficient)
- AES-256-GCM message encryption
- Encrypted localStorage (frontend secure storage)
- S3 presigned URLs (7-day expiry)
- File URLs stored as S3 keys, signed on demand with presigned URLs

### Real-time
- Socket.IO with room-based broadcasting
- Personal rooms (`user:{id}`) for DMs/notifications
- Org rooms (`org:{id}`) for presence broadcasts
- Group rooms (`group:group-{id}`) for typing indicators

---

## Environment Variables

See `backend/.env.example` for full list. Key ones:

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (default 5000) |
| `DB_*` | PostgreSQL connection |
| `REDIS_*` | Redis connection (optional) |
| `JWT_SECRET` | JWT signing key |
| `CHAT_ENCRYPTION_KEY` | AES-256 encryption key (64 hex chars) |
| `AWS_*` | S3 credentials + bucket |
| `SMTP_*` | Email server |
| `FRONTEND_ORIGIN` | CORS origin |
| `TRANSLATE_PROVIDER` | gemini or openai |
| `GEMINI_API_KEY` | Google Gemini API key |

---

## Architecture Updates (March 2026)

### Organization Controls Cache
- Controls cached per org in `_orgControlsCache` Map with 5-minute TTL
- `preloadOrgControls(orgId)` on socket connect (non-blocking)
- `getOrgControl(orgId, featureKey)` checks cache first, falls back to DB
- `invalidateOrgControlsCache(orgId)` called from admin controller on updates
- Feature checks: typing/online use `getOrgControl` (enabled-only check), edit/delete/recall use inline check (enabled + time_limit, no role check)

### Geo Location Tracking
- `user_devices` table stores: city, country, device_type, os_name, ip_address, latitude, longitude
- Geo data from `ipapi.co` API (frontend `chatx_login_geo_hint_v1` sessionStorage cache, 30min TTL)
- Socket connect: `loadUserGeo(userId)` queries latest device → cached on `socket.geo`
- Message send: `sentFrom: { city, country, device }` injected into `message_metadata`
- Read receipt: `readFrom` included in `message:read_ack` event
- Batch loading: `loadUserGeoBatch(userIds)` for group message:info (1 query for N users)

### Message Encryption Flow
```
Send:  plainText → encryptMessage() → "iv.ciphertext.tag" (base64) → DB
Fetch: DB → "iv.ciphertext.tag" → decryptMessage() → plainText
Meta:  object → JSON.stringify → encrypt → { _enc: "iv.ct.tag" } → DB (JSONB)
```
- Algorithm: AES-256-GCM (256-bit key, 12-byte IV, 128-bit auth tag)
- Key: `CHAT_ENCRYPTION_KEY` env (64-char hex = 32 bytes)
- Backward compat: plain-text messages returned as-is if not in encrypted format

### Two Separate buildContent Functions
- `socket/index.js` → used for realtime events (message:send, message:edit, etc.)
- `chatController.js` → used for HTTP API responses (getMessages, getThreads)
- Both must stay in sync — file types get full metadata spread, text types get clean content (no metadata leak)

### Dynamic Message Menu
- `message_menu_items` DB table → admin configurable
- `organization_message_menu_permissions` → per-org show/hide
- Frontend: `fetchMenuItems()` loads from API + caches, filters hidden per org permissions
- Fallback: hardcoded menu items if API fails
- Runtime overrides: disabled states (edit/copy/forward), label overrides (Pin/Unpin)

### Owner Dashboard System Monitoring
- `GET /auth/owner/v1/system/socket-stats` → REST API
- `system:socket-stats:subscribe` → realtime socket push (10s interval, owner only)
- Stats: socket connections, users online, org breakdown, room stats, memory, uptime, DB counts
