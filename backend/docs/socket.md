# Socket.IO Real-Time Event System

> **File:** `backend/src/socket/index.js`
> **Frontend Hook:** `frontend/src/hooks/useChatSocket.js`
> **Context:** `frontend/src/contexts/SocketContext.jsx`

---

## Connection Flow

```
Frontend                          Backend
   │                                │
   ├── getAccessToken()             │
   ├── io(url, { auth: {token} })   │
   │────────────────────────────────>│
   │                                ├── authenticateSocket(socket, next)
   │                                │   ├── Parse token from: auth.token → Authorization header → cookie
   │                                │   ├── jwt.verify(token, JWT_SECRET)
   │                                │   └── socket.user = payload  { sub, org, name, role }
   │                                │        // role = JWT role_key string ("owner"/"admin"/"user")
   │                                │        // getRoleKey() normalises both numeric and string formats
   │                                │
   │                                ├── onConnection(socket)
   │                                │   ├── addUserSocket(userId, socketId)   // Map<userId → Set<socketId>>
   │                                │   ├── socket.join(`user:${userId}`)     // Personal room
   │                                │   ├── socket.join(`org:${orgId}`)       // Org room
   │                                │   ├── Broadcast user:online to org (first tab only)
   │                                │   └── Send users:online_list to new user
   │<────────────────────────────────│
   │   'connect' event               │
```

### Multi-Tab Support
- `userSockets` Map: `userId → Set<socketId>`
- Each tab gets a unique `socketId`, all share the same `userId`
- `user:online` broadcast only on FIRST tab connect
- `user:offline` broadcast only when ALL tabs disconnect
- `emitToUser(userId, event, data)` → `io.to('user:${userId}')` (hits all tabs)

### Reconnection
- Frontend: `reconnection: true`, `reconnectionAttempts: Infinity`, delay 750ms–6000ms
- Socket.IO auto-reconnects at transport level — event listeners survive reconnection
- Backend cleanup: `removeUserSocket` on disconnect, re-add on reconnect

---

## Server → Client Events

### `message:new`
New message received (DM or group).

```json
{
  "threadId": "dm-5",
  "message": {
    "id": "123",
    "type": "text",
    "direction": "incoming",
    "author": { "id": "5", "name": "John", "avatar": "..." },
    "content": { "text": "Hello!" },
    "createdAt": "2026-03-16T10:00:00.000Z",
    "status": "delivered"
  }
}
```

### `message:edited`
A message was edited by its sender.

```json
{
  "threadId": "dm-5",
  "message": { /* same normalized format with updated content + editedAt */ }
}
```

### `message:deleted`
A message was deleted or recalled. Emitted to both sender and receiver for recalls, sender-only for deletes.

```json
{ "threadId": "dm-5", "messageId": "123" }
```

> **Note:** `message:recalled` is no longer emitted. Recalls now emit `message:deleted` to both parties to prevent a race condition where the recalled event could create zombie message entries on the receiver side.

### `message:reacted`
Emoji reaction toggled on a message.

```json
{ "threadId": "dm-5", "messageId": "123", "emoji": "👍", "userId": 3, "action": "added" }
```

### `message:pinned`
A message was pinned/unpinned.

```json
{ "threadId": "dm-5", "messageId": "123", "pinned": true, "pinnedBy": "3" }
```

### `message:read_ack`
Receiver read your messages in a thread.

```json
{ "threadId": "dm-3", "readBy": "3" }
```

### `typing:update`
User typing status change.

```json
{ "threadId": "dm-5", "userId": "5", "name": "John", "isTyping": true }
```

### `user:online`
A user came online (first tab).

```json
{ "userId": "5", "status": "Online" }
```

### `user:offline`
A user went offline (all tabs closed).

```json
{ "userId": "5", "status": "Offline" }
```

### `user:status`
User activity status changed.

```json
{ "userId": "5", "status": "Away" }
```

### `users:online_list`
Sent to newly connected user — who's already online.

```json
{ "users": ["3", "5", "8"] }
```

### `upload:s3progress`
S3 upload progress emitted to sender during file uploads.

```json
{ "uploadId": "abc-123", "percent": 75 }
```

Frontend maps this to the 50–100% range of overall upload progress (0–50% is browser→server XHR progress).

### `notification`
Real-time notification for incoming messages/reactions.
Only emitted when the receiver is online **and** NOT viewing the sender's thread (checked via `getUserActiveThread`). Previously emitted whenever the receiver was online.

```json
{
  "type": "message",
  "title": "John",
  "body": "Hello!",
  "threadId": "dm-5",
  "senderId": "5",
  "senderName": "John"
}
```

**Frontend handling (`useChatSocket.js`):**
1. Calls `onNotification` callback (if provided)
2. Plays notification sound (user's selected sound from Settings)
3. Shows browser `Notification` if `document.hidden`

---

## Client → Server Events

### `message:send` → ack `{ ok, message, error }`

```json
{
  "threadId": "dm-5",
  "message": "Hello!",
  "message_type": "text",
  "metadata": null
}
```

**Backend flow:**
1. Parse `threadId` → DM (`dm-{userId}`) or Group (`group-{groupId}`)
2. Encrypt message + metadata → `chatModel.sendDMMessage()` / `sendGroupMessage()`
3. Determine delivery status:
   - **sent** → receiver offline
   - **delivered** → receiver online, different thread open
   - **read** → receiver online, sender's thread focused (auto-mark read in DB)
4. Emit `message:new` to receiver
5. Emit `notification` to receiver (if online and not viewing sender's thread)
6. ACK to sender with `{ ok: true, message: { ...normalized, status } }`
7. **Message ID replacement:** The ACK returns the server-generated DB ID (BIGINT). Frontend replaces the local UUID with this ID so that subsequent recall, react, and edit operations use the correct server ID.

**Reply context:** If `metadata.replyTo` is present, `sendViaSocket` merges it into the socket metadata so the receiver sees the quoted message.

### `message:edit` → ack `{ ok, message, error }`

```json
{ "messageId": 123, "threadId": "dm-5", "newText": "Updated text" }
```

**Backend flow:**
1. Encrypt new text → update in DB
2. Emit `message:edited` to other party / group members
3. (DM only) Emit `notification` type="edit" to receiver

### `message:delete` → ack `{ ok, error }`

```json
{ "messageId": 123, "threadId": "dm-5" }
```

**Backend flow:**
1. Soft delete: `message = NULL`, metadata `{ deleted: true }` (encrypted)
2. Log action in `message_actions` table
3. Emit `message:deleted` to sender only (sender-side delete)

### `message:recall` → ack `{ ok, error }`

```json
{ "messageId": 123, "threadId": "dm-5" }
```

**Backend flow:**
1. Set `message = ''` (encrypted), metadata `{ recalled: true }` (encrypted)
2. Emit `message:deleted` to both sender + receiver / all group members (no longer emits `message:recalled`)

### `message:react` → ack `{ ok, error }`

```json
{ "messageId": 123, "threadId": "dm-5", "emoji": "👍" }
```

**Backend flow:**
1. Toggle reaction in `message_actions` / `group_message_actions` table
2. Emit `message:reacted` to all participants
3. Emit `notification` type="reaction" to other users

**Reaction data in REST API:** When messages are loaded via `getMessages`, reactions from `message_actions`/`group_message_actions` tables are aggregated and included in `message_metadata.reactions`.

### `message:pin` → ack `{ ok, error }`

```json
{ "messageId": 123, "threadId": "dm-5", "pinned": true }
```

**Backend flow:**
1. Log pin action in `message_actions`
2. Read existing metadata → decrypt → merge pin info → re-encrypt → update DB
3. Emit `message:pinned` to all participants

### `message:forward` → ack `{ ok, message, error }`

```json
{
  "targetThreadId": "dm-8",
  "message": "Forwarded text",
  "message_type": "text",
  "metadata": null
}
```

**Backend flow:**
1. Add `{ forwarded: true, forwardedBy: name }` to metadata
2. Encrypt + save via `sendDMMessage()` / `sendGroupMessage()`
3. Emit `message:new` + `notification` to receiver

### `message:read`
Mark all messages in a thread as read (no ACK).

```json
{ "threadId": "dm-5" }
```

**Backend flow:**
1. DM: `markDMMessagesRead()` → set `read_time = NOW()` for unread messages
2. Group: `markGroupMessagesRead()` → set `delivery_status = 'read'`
3. DM: Emit `message:read_ack` to sender

### `thread:focus`
Tell server which thread user is currently viewing (for delivery status).

```json
{ "threadId": "dm-5" }
```

**Backend flow:**
1. `setUserActiveThread(userId, threadId)` — stored in `userActiveThread` Map
2. Auto-mark messages as read in the focused thread
3. Emit `message:read_ack` to sender (DM only)

### `typing:start` / `typing:stop`

```json
{ "threadId": "dm-5" }
```

**Backend flow:**
- DM: Emit `typing:update` to the other user
- Group: Emit `typing:update` to the group room

**Debug logging:** `typing:start` logs `[socket] typing:start DM user=X → receiver=Y` on success, or `[socket] typing BLOCKED: user=X role=Y reason=Z` when organization controls block it.

### `group:join`

```json
{ "groupId": 3 }
```

Joins socket to `group:group-3` room for group-level broadcasts.

### `update_activity_status`

```json
{ "activity_status": "Away" }
```

Broadcasts `user:status` to org room.

---

## Presence Tracking Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Backend (In-Memory)                     │
│                                                           │
│  userSockets: Map<userId → Set<socketId>>                │
│  ├── "3" → { "abc123", "def456" }  ← 2 tabs             │
│  └── "5" → { "ghi789" }           ← 1 tab               │
│                                                           │
│  userActiveThread: Map<userId → threadId>                 │
│  ├── "3" → "dm-5"    ← User 3 viewing DM with user 5    │
│  └── "5" → "group-2" ← User 5 viewing group 2           │
│                                                           │
│  isUserOnline(userId) → userSockets.has(userId)           │
│  getUserActiveThread(userId) → userActiveThread.get(...)  │
└──────────────────────────────────────────────────────────┘
```

### Delivery Status Logic (DM)

```
Receiver offline?          → status = "sent"      (undelivered)
Receiver online + different thread? → status = "delivered"
Receiver online + sender's chat open? → status = "read" (auto-mark in DB)
```

---

## Notification Flow

```
Sender sends message
       │
       ▼
Backend saves to DB (encrypted)
       │
       ▼
Emit message:new to receiver
       │
       ▼
Is receiver online? ──No──> Done (no notification)
       │
      Yes
       │
       ▼
Emit 'notification' event to receiver
       │
       ▼
Frontend useChatSocket handler:
  1. console.log("[socket] notification received:", data)
  2. callbacksRef.current.onNotification?.(data)
  3. playNotificationSound()
     └── Read user's selected sound from secureStorage (chatx.notificationSound)
     └── new Audio(soundUrl).play()
  4. if (document.hidden && data.title)
     └── showSystemNotification({ title, body })
         └── new Notification(title, { body, icon })
```

---

## Disconnect Flow

```
Tab closed / network lost
       │
       ▼
socket.on('disconnect')
  ├── removeUserSocket(userId, socketId)
  ├── if (no more tabs online)
  │   ├── userActiveThread.delete(userId)
  │   └── Broadcast user:offline to org
  └── else: user still online via other tabs
```

---

## Room Architecture

| Room Pattern       | Members                     | Used For                          |
|--------------------|-----------------------------|-----------------------------------|
| `user:{userId}`    | All tabs of one user        | Direct messages, notifications    |
| `org:{orgId}`      | All users in org            | Online/offline broadcasts         |
| `group:group-{id}` | Users who joined the group  | Group typing indicators           |

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/socket/index.js` | Socket.IO server — all event handlers |
| `frontend/src/hooks/useChatSocket.js` | Frontend hook — event listeners + emitters |
| `frontend/src/contexts/SocketContext.jsx` | Socket connection provider |
| `frontend/src/contexts/PresenceProvider.jsx` | Activity status (Online/Idle/Away) |
| `frontend/src/contexts/TypingIndicatorContext.jsx` | Typing indicator state |

---

### thread:update (Server → Client)
Sent when a thread's metadata changes (unread count, read status).
```json
{
  "threadId": "dm-3",
  "unreadCount": 5,
  "readStatus": "unread"
}
```
**Emitted when:**
- New message sent to receiver (unreadCount from DB)
- Receiver opens thread (unreadCount: 0, readStatus: "read")
- Sender's messages read by receiver (readStatus: "read")
**Frontend handler:** `onThreadUpdate` → `upsertThread(orgId, { id: threadId, ...data })`

### message:info (Client → Server with ACK)
Fetches full message details including DB timestamps and receipts.
```json
// Request
{ "messageId": "91", "threadId": "dm-3" }

// Response (ACK)
{
  "ok": true,
  "info": {
    "messageId": "91",
    "threadId": "dm-3",
    "sendTime": "2026-03-17T11:41:00Z",
    "readTime": "2026-03-17T11:42:00Z",
    "editTime": "2026-03-17T11:45:00Z",
    "sender": { "id": "2", "name": "Bhavesh", "location": "Varanasi, India", "device": "Desktop" },
    "receipts": {
      "read": [{ "id": "3", "name": "Hardik", "readAt": "...", "location": "Varanasi, India", "device": "Desktop" }],
      "delivered": [{ "id": "3", "name": "Hardik", "deliveredAt": "...", "location": "Varanasi, India" }]
    }
  }
}
```

### system:socket-stats:subscribe / unsubscribe (Client → Server)
Owner-only. Subscribe to receive live system stats every 10 seconds.
```json
// Subscribe
socket.emit("system:socket-stats:subscribe")

// Receive (every 10s)
socket.on("system:socket-stats", {
  "socket": { "totalConnections": 12, "uniqueUsersOnline": 5, "connectionsByOrg": { "1": 8 }, "usersList": [...], "roomStats": {...} },
  "system": { "serverUptime": 3600, "memoryUsage": {...}, "nodeVersion": "v20.x", "platform": "win32" },
  "timestamp": "2026-03-17T12:30:00Z"
})

// Unsubscribe
socket.emit("system:socket-stats:unsubscribe")
```

### markThreadAsRead (Internal Helper)
Reusable function used by both `message:read` and `thread:focus` handlers.
- Marks messages as read in DB (`markDMMessagesRead`)
- Sends `message:read_ack` to sender (green tick)
- Sends `thread:update` to sender (readStatus: "read")
- Sends `thread:update` to self (unreadCount: 0)
- Skips self-thread (dm-ownId)
- Always sends read_ack (no org control blocking)

### Unread Count Sync on Connect
When a user connects/reconnects, the backend queries all pending unread messages and emits `thread:update` for each sender:
```sql
SELECT sender_id, COUNT(*) AS cnt FROM messages
WHERE organization_id = $1 AND receiver_id = $2 AND read_time IS NULL AND message IS NOT NULL
GROUP BY sender_id
```
This ensures correct unread badges even if messages were missed during disconnect.

### Organization Controls for Socket Events
- `indicators` control: typing start/stop + online/offline (only checks `enabled`, not roles)
- Edit/Delete/Recall: check `enabled` + `time_limit_minutes` (no role check, sender enforced by SQL)
- Controls cached for 5 minutes per org (`preloadOrgControls`)
- Cache invalidated via `invalidateOrgControlsCache(orgId)` from admin controller

---

## Added 2026-04-14

### Thread pin / unpin
Client emits:
- `thread:pin` — `{ threadId, pinned }` — backend upserts / removes a row in
  `user_thread_pins`. A soft cap of 20 returns `{ error: 'Max 20 pinned chats' }`.

Server emits (to the user):
- `thread:pin_sync` — on connect, array of `{ thread_id, pinned_at }`.
- `thread:pin_update` — after a pin/unpin, `{ threadId, pinned, pinned_at? }`.

### Call log persistence
`socket.logCall({ fromUserId, toUserId, callType, outcome })` now:
1. Inserts a row in `call_logs` (fast, indexed lookup for the `/calls` API).
2. Sends a DM text message "📞 Missed audio/video call" (or equivalent) so
   both sides see it in chat.
3. Emits a `notification` event (with per-thread mute/DND gating) and fires
   a web push via `pushToUser` so closed-tab users still get notified.

### Outcomes recorded
- `offline` — callee was not online at request time
- `declined` — callee clicked Reject
- `no_answer` — 45s ring timeout (caller or callee side)
- `answered` — reserved for successful completion logs (future)

### Web Push alongside in-app notifications
Every `emitToUser(..., 'notification', payload)` that isn't muted/DND-blocked
is mirrored with `pushToUser(userId, payload)` — the service worker suppresses
the native toast when any visible client is focused, so there are no
duplicates for users actively looking at the app. Incoming-call pushes are
shown unconditionally.

### Guest socket handshake
Clients can connect with a guest JWT (`guest: true`) issued by
`POST /meetings/guest/:token/verify`. `authenticateSocket` accepts it like any
other JWT, and `onConnection` skips:
- DB-backed sync (`thread:mute_sync`, `thread:pin_sync`, `dnd:state`, geo load)
- Online-presence registration and `user:online` broadcasts
- `user:<id>` / `org:<id>` room joins
- `disconnect`-time online-map cleanup

Only meeting-scoped events (`meeting:join`, `meeting:signal`, `meeting:leave`,
`meeting:chat`, `meeting:reaction`, `meeting:media-state`, `meeting:pin`) are
active for guest sockets.

### Cross-platform call signaling (parity)
Both web and mobile now follow the same flow:
1. `call:request` — carries only `{ targetUserId, callType }`.
2. Callee clicks Accept → `call:accept`.
3. Caller hears `call:accepted`, runs `startCallerFlow`: getUserMedia → createOffer
   → send `call:signal { type: 'offer', sdp }`.
4. Callee's `call:signal` handler spins up PC on the first offer, answers via
   `call:signal { type: 'answer', sdp }`, flushes any queued ICE candidates.

Additional `call:signal` subtypes used during an active call:
- `media-state` — `{ muted?, videoOff? }`, updates peer indicators on the
  other side.

### Auth reliability
- On `reconnect_attempt` the client fetches a fresh access token via
  `getAccessToken({ refreshIfNeeded: true })` and updates `socket.auth` before
  the reconnect. Guest sockets skip this since their token is short-lived.
- Client forces a reconnect on `visibilitychange → visible`, `window.focus`
  and `navigator.online`, so an inactive tab can't be left in a half-dead
  state until the next message.
