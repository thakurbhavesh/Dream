# REST API Endpoints

> **Base URL:** `http://localhost:5000` (dev) or `VITE_API_URL` (prod)
> **Auth:** JWT Bearer token in `Authorization` header or `access_token` cookie
> **CSRF:** Required for non-GET requests via `X-CSRF-Token` header
> **CSRF Exemptions:** `/upload/chat-file` and `/upload/profile-picture` are exempted from CSRF protection (JWT Bearer auth is sufficient). Listed in `PUBLIC_MUTATION_ROUTES` in `backend/src/middlewares/csrf.js`.

---

## Authentication (`/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Register new user |
| POST | `/auth/create-account` | No | Create account |
| POST | `/auth/login` | No | Login with email/password |
| POST | `/auth/verify-otp` | No | Verify OTP code |
| POST | `/auth/resend-otp` | No | Resend OTP |
| POST | `/auth/forgot-password` | No | Initiate password reset |
| POST | `/auth/forgot-verify` | No | Verify forgot password OTP |
| POST | `/auth/reset-password` | No | Complete password reset |
| POST | `/auth/change-password` | Yes | Change password |
| GET | `/auth/csrf` | No | Get CSRF token |
| POST | `/auth/refresh` | No | Refresh access token |
| POST | `/auth/logout` | Yes | Logout current session |
| POST | `/auth/logout-all` | Yes | Logout all sessions |
| GET | `/auth/trusted-devices` | Yes | List trusted devices. Includes `usage` object with message/media/file counts and sizes for the user. |
| POST | `/auth/trusted-devices/:deviceId/revoke` | Yes | Revoke device |
| GET | `/auth/me` | Yes | Get current user info. Now includes `usage` object with message/media/file counts and sizes for the user. |
| GET | `/auth/user-details` | Yes | Get user details |
| POST | `/auth/user-details` | Yes | Update user details |
| GET | `/auth/organization-details` | Yes | Get org details. `usage.storage_used_mb` is now calculated dynamically from `message_files` + `group_message_files` tables (not from static `organizations.storage_used_mb`). |

### Owner Endpoints (`/auth/owner`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/auth/owner-dashboard` | Owner | Owner dashboard data |
| GET | `/auth/owner-organizations/:orgId/members` | Owner | Org members |
| GET | `/auth/owner-organizations/:orgId/subscription` | Owner | Subscription info |
| GET | `/auth/owner-organizations/:orgId/payment-history` | Owner | Payment history |
| GET | `/auth/owner/v1/organizations` | Owner | List all orgs |
| GET | `/auth/owner/v1/organizations/:orgId/overview` | Owner | Org overview |
| PATCH | `/auth/owner/v1/organizations/:orgId/members/:userId` | Owner | Update member |
| POST | `/auth/owner/v1/organizations/:orgId/payments/:paymentId/complete` | Owner | Complete payment |
| GET | `/auth/owner/v1/users` | Owner | List all users |
| GET | `/auth/owner/v1/users/:userId/insights` | Owner | User insights |
| POST | `/auth/owner/v1/owners` | Owner | Create owner |

---

## Chat & Messaging (`/chat`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/chat/organizations` | Yes | User's organizations |
| GET | `/chat/threads` | Yes | DM + Group threads (with last message) |
| GET | `/chat/contacts` | Yes | Org members for new DM |
| GET | `/chat/threads/:id/messages` | Yes | Paginated messages (`?limit=50&before=timestamp`). Supports `before` (ISO timestamp) query param for cursor-based pagination. Returns reactions aggregated from `message_actions` table in `metadata.reactions`. File URLs signed on demand. |
| POST | `/chat/threads/:id/messages` | Yes | Send message via REST |
| POST | `/chat/threads/:id/read` | Yes | Mark thread as read |
| PATCH | `/chat/messages/:id` | Yes | Edit message |
| DELETE | `/chat/messages/:id` | Yes | Delete message |

---

## Upload (`/upload`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/upload/profile-picture` | Yes | Upload profile picture to S3. CSRF exempt. |
| DELETE | `/upload/profile-picture` | Yes | Delete profile picture |
| POST | `/upload/chat-file` | Yes | Upload chat file to S3 `files/` folder. Supports files up to 2GB via multipart upload. Emits `upload:s3progress` via socket during S3 upload. Response: `{ file_key, file_url, file_name, file_type, file_size }`. CSRF exempt. |

---

## Admin CRUD Endpoints

### Roles (`/roles`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/roles` | Yes | List roles |
| POST | `/roles` | Owner | Create role |
| GET | `/roles/:id` | Yes | Get role |
| PUT | `/roles/:id` | Owner | Update role |
| DELETE | `/roles/:id` | Owner | Delete role |

### Organization Users (`/users`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users` | Admin | List org users |
| POST | `/users` | Admin | Create user |
| PATCH | `/users/bulk` | Admin | Bulk update users |
| POST | `/users/reset-password` | Admin | Reset user password |
| GET | `/users/:id` | Admin | Get user |
| PUT | `/users/:id` | Admin | Update user |
| DELETE | `/users/:id` | Admin | Delete user |
| PATCH | `/users/:id/deactivate` | Admin | Deactivate user |
| PATCH | `/users/:id/activate` | Admin | Activate user |
| POST | `/users/:id/resend-invite` | Admin | Resend invite |

### Departments (`/departments`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET/POST | `/departments` | Admin | List/Create |
| GET/PUT/PATCH/DELETE | `/departments/:id` | Admin | CRUD |

### Designations (`/designations`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET/POST | `/designations` | Admin | List/Create |
| GET/PUT/PATCH/DELETE | `/designations/:id` | Admin | CRUD |

### Locations (`/locations`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET/POST | `/locations` | Admin | List/Create |
| GET/PUT/PATCH/DELETE | `/locations/:id` | Admin | CRUD |

### Groups (`/groups`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET/POST | `/groups` | Admin | List/Create |
| GET/PUT/PATCH | `/groups/:id` | Admin | Read/Update |

### Group Members (`/group-members`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET/POST | `/group-members` | Admin | List/Create |
| GET | `/group-members/by-group-name` | Yes | Members by group name |
| GET/PUT/PATCH | `/group-members/:id` | Admin | Read/Update |

### Plans (`/plans`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET/POST | `/plans` | Owner | List/Create |
| GET/PUT/PATCH/DELETE | `/plans/:id` | Owner | CRUD |

### Plan Features (`/plan-features`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/plan-features/plan/:planId/summary` | No | Plan feature summary |
| GET/POST | `/plan-features` | Owner | List/Create |
| GET/PUT/PATCH | `/plan-features/:id` | Owner | CRUD |

---

## Organization Settings

### Organization Controls (`/organization-controls`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/organization-controls` | Yes | List all org controls |
| GET | `/organization-controls/:feature_key` | Yes | Get one control |
| PUT | `/organization-controls/:feature_key` | Admin | Upsert control |

### Organization Profile (`/organization`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/organization/overview` | Yes | Org overview |
| GET | `/organization/members` | Yes | All org members |
| GET | `/organization/members/:userId` | Yes | Specific member |
| GET | `/organization/departments` | Yes | Org departments |
| GET | `/organization/designations` | Yes | Org designations |
| GET | `/organization/locations` | Yes | Org locations |

### Organization Restrictions (`/organization-restrictions`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET/POST | `/organization-restrictions/ip` | Admin | IP restrictions |
| GET/PUT/PATCH | `/organization-restrictions/ip/:id` | Admin | IP CRUD |
| GET/POST | `/organization-restrictions/platform` | Admin | Platform restrictions |
| GET/PUT/PATCH | `/organization-restrictions/platform/:id` | Admin | Platform CRUD |

### Message Menu Permissions (`/organization-message-menu-permissions`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET/POST | `/organization-message-menu-permissions` | Admin | List/Create |
| GET/PUT/PATCH | `/organization-message-menu-permissions/:id` | Admin | CRUD |

---

## Billing (`/billing`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/billing/payment-history` | Admin | Payment history |
| GET | `/billing/payment-gateways` | Admin | Payment gateways |
| GET | `/billing/plan-comparison` | Admin | Plan comparison |
| GET | `/billing/address` | Admin | Get billing address |
| GET | `/billing/addresses` | Admin | Get billing addresses |
| PUT | `/billing/address` | Admin | Upsert billing address |
| POST | `/billing/quote` | Admin | Create quote |
| POST | `/billing/checkout-session` | Admin | Create checkout |
| POST | `/billing/checkout/confirm` | Admin | Confirm checkout |
| GET | `/billing/checkout/resume` | Admin | Resume checkout |

---

## Other Endpoints

### Translation (`/translate`)
| POST | `/translate` | Yes | Translate text |

### Live Assistant (`/live-assistant`)
| POST | `/live-assistant/chat` | Yes | AI chat assistant |

### Contact Us (`/contact-us`)
| POST | `/contact-us` | No | Submit contact form |
| GET | `/contact-us` | Admin | List submissions |

### Activity Logs (`/activity-logs`)
| GET | `/activity-logs` | Admin | List activity logs |

### Global Access (`/global-access`)
| GET/POST | `/global-access` | Admin | List/Create |
| GET | `/global-access/allowed-users` | Yes | Allowed users |

### Geo Data (`/geo`)
| GET | `/geo/countries` | No | List countries |
| GET | `/geo/states` | Admin | List states |
| GET | `/geo/currencies` | Admin | List currencies |

### Site Details (`/site-details`)
| GET/POST | `/site-details` | Owner | List/Create |
| GET/PUT/PATCH | `/site-details/:id` | Owner | CRUD |

### SMTP Settings (`/smtp-settings`)
| GET/POST | `/smtp-settings` | Owner | List/Create |
| PATCH | `/smtp-settings/:id` | Owner | Update |
| POST | `/smtp-settings/:id/activate` | Owner | Activate |
| DELETE | `/smtp-settings/:id` | Owner | Delete |

---

## Auth Levels

| Level | Middleware | Role |
|-------|-----------|------|
| No Auth | None | Public endpoints |
| Yes | `auth.js` | Any authenticated user |
| Admin | `auth.js` + `blockRole4` | Admins (blocks role_id=4 guests) |
| Owner | `auth.js` + `requireOwner` | Owner only (role_id=1) |

---

## New API Endpoints (March 2026 Update)

### Translation & Summarization

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/translate` | JWT | Translate text to target language (Gemini/OpenAI) |
| POST | `/translate/summarize` | JWT | Summarize text or file content |

**POST /translate**
```json
{
  "text": "Hello, how are you?",
  "targetLanguage": "Hindi"
}
// Response: { "data": { "translated": "नमस्ते, आप कैसे हैं?", "provider": "gemini" } }
```

**POST /translate/summarize**
```json
// Text summarization
{ "text": "Long article text here..." }

// File summarization (PDF, Image, DOCX, Text files)
{
  "fileUrl": "https://s3.../file.pdf",
  "fileKey": "files/abc123.pdf",
  "fileName": "report.pdf",
  "fileType": "application/pdf"
}
// Response: { "data": { "summary": "• Point 1\n• Point 2\n...", "provider": "gemini", "fileExtracted": true } }
```

**Supported file types for summarization:**
- PDF → text extraction via `pdf-parse`
- Images (jpg/png/gif/webp) → Gemini Vision API (base64)
- Text files (txt/md/json/csv/xml/js/py/sql etc.) → direct read
- DOCX → ZIP extract → XML parse
- Other → fallback summary based on file name/type

### Owner Dashboard — System Stats

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/auth/owner/v1/system/socket-stats` | JWT + Owner | System & socket monitoring stats |

**Response:**
```json
{
  "socket": {
    "totalConnections": 12,
    "uniqueUsersOnline": 5,
    "connectionsByOrg": { "1": 8, "2": 4 },
    "usersList": [{ "userId": "3", "tabs": 2, "activeThread": "dm-5" }],
    "roomStats": { "orgRooms": 2, "userRooms": 5, "groupRooms": 3, "totalRooms": 10 }
  },
  "system": {
    "serverUptime": 3600,
    "serverUptimeFormatted": "1h 0m 0s",
    "memoryUsage": { "rss": "85.2 MB", "heapUsed": "42.1 MB", "heapTotal": "65.3 MB" },
    "nodeVersion": "v20.x.x",
    "platform": "win32"
  },
  "database": {
    "messages": { "total": 5420, "last24h": 128, "dmTotal": 3200, "groupTotal": 2220 },
    "users": { "total": 45, "active": 38 },
    "devices": { "total": 62 },
    "organizations": { "total": 5, "active": 4 },
    "sessions": { "active": 15 },
    "topActiveOrgs": [{ "organizationId": 1, "name": "Aabhyasa", "messagesLast24h": 85 }]
  }
}
```

### Message Menu Items (Dynamic)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/message-menu-items` | JWT | List all menu items (admin sees all, chat menu filtered by org perms) |
| POST | `/message-menu-items` | JWT + Owner | Create menu item |
| GET | `/message-menu-items/:id` | JWT | Get single item |
| PUT/PATCH | `/message-menu-items/:id` | JWT + Owner | Update item |
| DELETE | `/message-menu-items/:id` | JWT + Owner | Delete item |

**DB Table: `message_menu_items`**
```
menu_item_id | menu_key    | label      | default_status | scope | tone   | display_order
1            | delete      | Delete     | show           | any   | danger | 10
12           | summarize   | Summarize  | show           | any   | normal | 120
```

### Organization Message Menu Permissions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/organization-message-menu-permissions` | JWT | List org permissions |
| POST | `/organization-message-menu-permissions` | JWT + Admin | Create permission |
| PATCH | `/organization-message-menu-permissions/:id` | JWT + Admin | Update permission (show/hide) |

**How it works:**
- Admin sets `permission_type: 'hide'` for a menu item → that item won't appear in message context menu for that org's users
- Frontend `fetchMenuItems()` fetches both menu items and org permissions, filters hidden items locally
- Admin panel sees ALL items regardless of permissions (can toggle back to "show")

---

## Added 2026-04-14

### Web Push (VAPID)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET  | `/push/vapid-public-key` | public | Returns `{ publicKey, configured }` so the browser can build a subscription |
| POST | `/push/subscribe` | JWT | Body `{ subscription }` — upserts the subscription for the current user |
| POST | `/push/unsubscribe` | JWT | Body `{ endpoint }` — removes a subscription by endpoint |

Requires `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in the
backend env. Expired subscriptions (404/410) are auto-pruned on send.

### Call History
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/calls?limit=&offset=&peer_id=` | JWT | Call history for current user (both directions). `peer_id` filters to calls with one contact. |

Response joins `users` for peer name/avatar and tags each row with
`direction: 'incoming' | 'outgoing'` relative to the current user.

### Meetings — past + guest
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET  | `/meetings/past?limit=&offset=` | JWT | Ended / cancelled / 4h+ past scheduled meetings for the user. |
| GET  | `/meetings/guest/:token` | public | Preview meeting info for an invited guest (no code required). |
| POST | `/meetings/guest/:token/verify` | public | Body `{ code, display_name? }` — if the 6-digit code matches, returns a short-lived guest JWT (`guest: true`, 4h) used for the socket handshake. |

Existing `POST /meetings/` also accepts an optional `guest_emails: string[]`
(max 2 distinct, validated) — each address gets a `meeting_guests` row plus
an emailed invite with link + code.
