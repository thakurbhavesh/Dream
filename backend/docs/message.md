# Message System - Complete Flow Documentation

> **Backend Model:** `backend/src/chat/chatModel.js`
> **Backend Socket:** `backend/src/socket/index.js`
> **Backend Routes:** `backend/src/chat/chatRoutes.js`
> **Frontend Hook:** `frontend/src/hooks/useChatSocket.js`
> **Frontend Service:** `frontend/src/services/threadService.js`
> **Frontend API:** `frontend/src/services/chatApi.js`

---

## Message Types

| Type | Description | Metadata |
|------|-------------|----------|
| `text` | Plain/rich text message | `{ html, emojiCount }` |
| `file` | File attachment | `{ fileName, fileUrl, fileType, fileSize }` |
| `image` | Image attachment | `{ fileName, fileUrl, fileType, fileSize }` |
| `video` | Video attachment | `{ fileName, fileUrl, fileType, fileSize }` |
| `audio` | Voice message | `{ fileName, fileUrl, duration }` |
| `emoji` | Emoji-only message | `{ isEmojiOnly, emojiCount }` |

> **DB CHECK constraint** on `message_type`: `text`, `file`, `link`, `code`, `system`, `emoji`, `image`, `video`, `audio`.

---

## 1. Send Text Message Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (Sender)                                                │
│                                                                  │
│  Footer.jsx → User types message → clicks Send                  │
│      │                                                           │
│      ▼                                                           │
│  Optimistic insert into UI (direction: "outgoing", status: "sending") │
│      │                                                           │
│      ▼                                                           │
│  chatSocket.sendMessage(threadId, message, "text", metadata)     │
│      │ socket.emit("message:send", {...}, ack)                   │
└──────┼──────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND                                                          │
│                                                                  │
│  socket.on("message:send") handler                               │
│      │                                                           │
│      ├── Parse threadId: "dm-5" → DM, "group-3" → Group         │
│      │                                                           │
│      ├── [DM] chatModel.sendDMMessage({                          │
│      │     orgId, senderId, receiverId, message, messageType,    │
│      │     metadata                                               │
│      │   })                                                       │
│      │   ├── encryptMessage(message)                             │
│      │   ├── encryptMetadata(metadata)                           │
│      │   ├── INSERT INTO messages (...) VALUES (...)             │
│      │   ├── SELECT with JOIN users for sender info              │
│      │   └── Decrypt message + metadata for socket emit          │
│      │                                                           │
│      ├── Determine delivery status:                              │
│      │   ├── isUserOnline(receiverId)?                           │
│      │   │   No  → status = "sent" (undelivered)                │
│      │   │   Yes → getUserActiveThread(receiverId)               │
│      │   │         ├── == senderThread → "read" (auto-mark DB)  │
│      │   │         └── != senderThread → "delivered"             │
│      │                                                           │
│      ├── Emit "message:new" to receiver                          │
│      ├── Emit "notification" to receiver (if online)             │
│      └── ACK to sender: { ok: true, message: {..., status} }    │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (Receiver)                                              │
│                                                                  │
│  useChatSocket → "message:new" listener                          │
│      │                                                           │
│      ├── onNewMessage callback:                                  │
│      │   ├── upsertMessage(threadId, message)  // cache          │
│      │   └── appendMessages(threadId, [message]) // threadService│
│      │                                                           │
│      └── "notification" listener (fires independently):          │
│          ├── playNotificationSound()                             │
│          └── showSystemNotification() (if tab hidden)            │
└─────────────────────────────────────────────────────────────────┘
```

---

### Message ID Replacement

After send acknowledgement, the local UUID is replaced with the server-assigned BIGINT ID. This is critical for recall, react, and edit operations to work correctly (they reference the server ID).

---

## 2. Send File/Image/Video Message Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (Sender)                                                │
│                                                                  │
│  Footer.jsx → User selects file → AttachmentTray shows preview   │
│      │                                                           │
│      ▼                                                           │
│  User clicks Send → onSubmit handler                             │
│      │                                                           │
│      ├── Detect message has __file property (raw File object)    │
│      │                                                           │
│      ├── uploadChatFileWithProgress(file, { onProgress })        │
│      │   ├── Client-side 2GB limit check                         │
│      │   ├── XHR POST to /upload/chat-file                       │
│      │   ├── xhr.upload.onprogress → 0-50% (browser→server)      │
│      │   ├── socket "upload:s3progress" → 50-100% (server→S3)   │
│      │   └── Returns { file_key, file_url, file_name, ... }     │
│      │                                                           │
│      ├── Replace data URL in message with S3 URL                 │
│      │                                                           │
│      └── chatSocket.sendMessage(threadId, fileUrl, type, {       │
│            fileName, fileUrl, fileType, fileSize                 │
│          })                                                       │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND (Upload Endpoint)                                        │
│                                                                  │
│  POST /upload/chat-file                                          │
│      │                                                           │
│      ├── multerChat middleware (disk storage, 2GB limit)         │
│      │   └── Saves to OS temp dir: chat-upload-{timestamp}.ext  │
│      │                                                           │
│      ├── uploadController.uploadChatFile()                       │
│      │   ├── Stream from disk to S3 via @aws-sdk/lib-storage    │
│      │   │   ├── S3 key: files/{userId}/...                     │
│      │   │   ├── Part size: 10MB, Concurrency: 4                │
│      │   │   └── ContentType from file.mimetype                 │
│      │   ├── S3 key stored in DB; signed on demand via          │
│      │   │   signFileUrls.js (presigned URL generated at read)  │
│      │   └── Delete temp file from disk                         │
│      │                                                           │
│      └── Response: { file_key, file_url, file_name,             │
│            file_type, file_size }                                │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
  Then message:send socket flow (same as text, with file metadata).
  File metadata also inserted into `message_files` / `group_message_files` tables on send.
```

---

## 3. Edit Message Flow

```
Sender: chatSocket.editMessage(messageId, threadId, newText)
   │
   ▼ socket.emit("message:edit", {...}, ack)
   │
   ▼ Backend:
   │  ├── [DM]  chatModel.editDMMessage(messageId, orgId, senderId, newText)
   │  │   ├── encryptMessage(newText)
   │  │   ├── UPDATE messages SET message=$1, edit_time=NOW()
   │  │   └── Decrypt for response
   │  │
   │  ├── [Group] editGroupMessage(messageId, orgId, groupId, senderId, newText)
   │  │   ├── encryptMessage(newText)
   │  │   ├── Read metadata → decrypt → add {edited:true} → encrypt
   │  │   └── UPDATE group_messages SET message=$1, message_metadata=$2
   │  │
   │  ├── Emit "message:edited" to receiver / group members
   │  └── ACK to sender
   │
   ▼ Frontend (Receiver):
      onMessageEdited → upsertMessage() + patchMessage()
```

---

## 3b. Reply Flow

```
Sender: replies to a message
   │
   ▼ replyTo context stored in message metadata:
   │  { messageId, authorName, snippet, type }
   │
   ▼ sendViaSocket merges replyTo into socket metadata when sending
   │
   ▼ Backend: saved as part of encrypted message_metadata
```

---

## 4. Delete Message Flow (Sender-Side Only)

```
Sender: chatSocket.deleteMessage(messageId, threadId)
   │
   ▼ Backend:
   │  ├── chatModel.deleteDMMessage(messageId, orgId, senderId)
   │  │   ├── Read metadata → decrypt → add {deleted:true} → encrypt
   │  │   ├── UPDATE messages SET message=NULL, message_metadata=$encrypted
   │  │   └── Only sender's own messages (WHERE sender_id = $senderId)
   │  │
   │  ├── logMessageAction(messageId, threadId, userId, 'delete')
   │  │   └── INSERT INTO message_actions (message_id, user_id, action_type)
   │  │
   │  └── Emit "message:deleted" to SENDER only
   │
   ▼ Frontend (Sender):
      onMessageDeleted → removeMessageFromCache() + removeStoredMessage()
```

---

## 5. Recall (Unsend) Message Flow (Both Sides)

```
Sender: chatSocket.recallMessage(messageId, threadId)
   │
   ▼ Backend:
   │  ├── recallDMMessage(messageId, orgId, senderId)
   │  │   ├── Read metadata → decrypt → add {recalled:true} → encrypt
   │  │   ├── encryptMessage('')   // empty string, encrypted
   │  │   └── UPDATE messages SET message=$enc, message_metadata=$encMeta
   │  │
   │  └── Emit "message:deleted" to BOTH sender + receiver
   │      (simplified: no separate "message:recalled" event —
   │       old dual-event approach caused race condition / zombie entries)
   │
   ▼ Frontend (Both):
      onMessageDeleted → removeMessageFromCache() + removeStoredMessage()
```

---

## 6. Reaction Flow

```
User: chatSocket.reactToMessage(messageId, threadId, emoji)
   │
   ▼ Backend:
   │  ├── toggleReaction(messageId, threadId, userId, emoji)
   │  │   ├── Check if reaction exists in message_actions
   │  │   │   ├── Exists → DELETE (remove reaction) → { action: "removed" }
   │  │   │   └── Not exists → INSERT → { action: "added" }
   │  │   └── action_type stored as "react:{emoji}" (e.g. "react:👍")
   │  │
   │  ├── Emit "message:reacted" to all participants
   │  └── Emit "notification" type="reaction" to other users (if online)
   │
   ▼ Frontend:
      onMessageReacted callback

Reactions loaded on getMessages via buildReactionMap() aggregation.
Included in message_metadata.reactions array:
  [{ emoji, users: [{ id, name }] }]
```

---

## 7. Pin/Unpin Message Flow

```
User: chatSocket.pinMessage(messageId, threadId, true/false)
   │
   ▼ Backend:
   │  ├── logMessageAction(messageId, threadId, userId, 'pin', pinValue)
   │  │   └── INSERT INTO message_actions
   │  │
   │  ├── Read existing metadata → decrypt
   │  ├── Merge: { pinned: true, pinnedBy, pinnedAt }
   │  ├── Encrypt merged metadata
   │  ├── UPDATE table SET message_metadata = $encrypted
   │  │
   │  └── Emit "message:pinned" to all participants
   │
   ▼ Frontend:
      onMessagePinned callback
```

---

## 8. Mark Read Flow

```
User opens a thread / focuses thread
   │
   ├── [Via thread:focus] socket.emit("thread:focus", { threadId })
   │   └── Backend:
   │       ├── setUserActiveThread(userId, threadId)
   │       ├── [DM] markDMMessagesRead(orgId, userId, otherUserId)
   │       │   └── UPDATE messages SET read_time=NOW() WHERE read_time IS NULL
   │       ├── [Group] markGroupMessagesRead(orgId, groupId, userId)
   │       │   └── UPDATE group_message_recipients SET delivery_status='read'
   │       └── Emit "message:read_ack" to sender
   │
   └── [Via message:read] socket.emit("message:read", { threadId })
       └── Same backend flow as above
```

---

## 9. Forward Message Flow

```
User: chatSocket.forwardMessage(targetThreadId, message, type, metadata)
   │
   ▼ Backend:
   │  ├── Add { forwarded: true, forwardedBy: name } to metadata
   │  ├── Encrypt + save (same as sendDMMessage / sendGroupMessage)
   │  ├── Emit "message:new" to target receiver / group
   │  └── Emit "notification" to target receiver (if online)
   │
   ▼ Frontend:
      ForwardMessageDialog → select target thread → emit
```

---

## Thread Loading Flow (REST API)

```
App initializes
   │
   ▼ useChatSync hook:
   │  ├── fetchUserOrganizations()    GET /chat/organizations
   │  │   └── Returns: [{ organization_id, org_name, role_key, ... }]
   │  │
   │  └── For each org: fetchThreads(orgId)   GET /chat/threads?org_id=X
   │      └── Backend chatController:
   │          ├── chatModel.getDMThreads(orgId, userId)
   │          │   └── All org members + last message (encrypted → decrypted)
   │          └── chatModel.getGroupThreads(orgId, userId)
   │              └── User's groups + last message (encrypted → decrypted)
   │
   ▼ threadService.commit():
      Store threads in memory + localStorage (chatx.threadCache.v1)
```

### Message Pagination (Infinite Scroll Up)

```
User scrolls up in a thread → "Load older messages"
   │
   ▼ fetchOlderMessages calls backend API with `before` timestamp
   │  (for real threads — was previously only reading from local cache)
   │
   ▼ fetchMessages(threadId, { limit: 50, before: oldestTimestamp })
   │  GET /chat/threads/{id}/messages?limit=50&before=...
   │
   ▼ Backend chatController:
   │  ├── [DM]    chatModel.getDMMessages(orgId, userId, otherUserId, { limit, before })
   │  ├── [Group] chatModel.getGroupMessages(orgId, groupId, { limit, before })
   │  └── Decrypt all messages + metadata → return chronological order
   │
   ▼ Frontend:
      appendMessages(threadId, messages) → prepend to existing list
      Supports infinite scroll up.
```

---

## Message Normalization

Backend normalizes DB rows before sending to frontend:

### DM Message → `normalizeDMMessage(row, currentUserId)`

```javascript
{
  id: String(message_id),
  type: "text" | "file" | "link" | "code" | "system" | "emoji" | "image" | "video" | "audio",
  direction: "outgoing" | "incoming",
  author: { id, name, avatar },
  content: { text, ...metadata },
  createdAt: "ISO string",
  editedAt: "ISO string" | null,
  status: "read" | "delivered"
}
```

### Group Message → `normalizeGroupMessage(row, currentUserId)`

```javascript
{
  id: String(group_message_id),
  type: "text" | "file" | ...,
  direction: "outgoing" | "incoming",
  author: { id, name, avatar },
  content: { text, ...metadata },
  createdAt: "ISO string",
  editedAt: null,
  status: "delivered"
}
```

### Content Builder → `buildContent(row)`

| Condition | Content Object |
|-----------|---------------|
| `metadata.deleted` | `{ text: "", deleted: true }` |
| `metadata.recalled` | `{ text: "", recalled: true }` |
| `message_type === "file"` | `{ fileName, fileUrl, ...meta }` |
| Default (text) | `{ text: message, ...meta }` |

---

## Database Tables

### `messages` (DM)

| Column | Type | Description |
|--------|------|-------------|
| message_id | SERIAL PK | Auto-increment ID |
| organization_id | INT FK | Organization |
| sender_id | INT FK | Sender user |
| receiver_id | INT FK | Receiver user |
| message | TEXT | **Encrypted** message content |
| message_type | VARCHAR | text/file/link/code/system/emoji/image/video/audio |
| message_metadata | JSONB | **Encrypted** `{"_enc": "iv.ct.tag"}` |
| send_time | TIMESTAMP | When sent |
| read_time | TIMESTAMP | When read (NULL = unread) |
| edit_time | TIMESTAMP | When edited (NULL = not edited) |
| updated_at | TIMESTAMP | Last modification |

### `group_messages`

| Column | Type | Description |
|--------|------|-------------|
| group_message_id | SERIAL PK | Auto-increment ID |
| organization_id | INT FK | Organization |
| group_id | INT FK | Group |
| sender_id | INT FK | Sender user |
| message | TEXT | **Encrypted** message content |
| message_type | VARCHAR | text/file/link/code/system/emoji/image/video/audio |
| message_metadata | JSONB | **Encrypted** `{"_enc": "iv.ct.tag"}` |
| created_at | TIMESTAMP | When sent |
| updated_at | TIMESTAMP | Last modification |

### `group_message_recipients`

| Column | Type | Description |
|--------|------|-------------|
| recipient_id | SERIAL PK | Auto-increment ID |
| group_message_id | INT FK | Group message |
| group_id | INT FK | Group |
| user_id | INT FK | Recipient user |
| delivery_status | VARCHAR | sent/delivered/read |
| read_at | TIMESTAMP | When read |

### `message_actions` / `group_message_actions`

| Column | Type | Description |
|--------|------|-------------|
| action_id | SERIAL PK | Auto-increment ID |
| message_id / group_message_id | INT FK | Message reference |
| user_id | INT FK | Who performed action |
| action_type | VARCHAR | "pin", "delete", "react:👍" |

---

## Frontend Caching Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    threadService                         │
│  (Singleton - useSyncExternalStore pattern)              │
│                                                         │
│  State: {                                               │
│    organizations: [...],                                │
│    threadsByOrg: { orgId: [...threads] },               │
│    messagesByThread: { threadId: [...messages] },       │
│    loadingByOrg: { orgId: true/false },                │
│    updatedAt: timestamp                                 │
│  }                                                      │
│                                                         │
│  Persistence: localStorage key "chatx.threadCache.v1"   │
│  Max cached per thread: 50 messages                     │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│              useConversationCache (LRU)                  │
│  Max 20 conversations in memory                         │
│  Prevents re-fetching when switching threads            │
│  Methods: loadThread, prime, upsertMessage, invalidate  │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│           useThreadMessagesState                         │
│  Single-thread message state manager                    │
│  Handles: windowing, pagination, optimistic sends       │
│  Returns: groups, visibleMessages, hasMore, loadOlder   │
└─────────────────────────────────────────────────────────┘
```

---

## File Size Display

`getFileDetailLabel` formats numeric `fileSize` through `formatFileSize()` (human-readable KB/MB/GB output instead of raw bytes like "475572").

---

## CSRF Exemptions

`/upload/chat-file` and `/upload/profile-picture` are exempted from CSRF protection (they use JWT auth instead).

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `backend/src/chat/chatModel.js` | All DB queries (encrypt/decrypt) |
| `backend/src/chat/chatController.js` | REST API handlers |
| `backend/src/chat/chatRoutes.js` | Route definitions |
| `backend/src/socket/index.js` | Socket event handlers |
| `backend/src/utils/messageCipher.js` | AES-256-GCM encryption |
| `backend/src/utils/signFileUrls.js` | Generate presigned S3 URLs on demand |
| `frontend/src/hooks/useChatSocket.js` | Socket event bridge |
| `frontend/src/hooks/useChatSync.js` | Initial data sync |
| `frontend/src/hooks/useThreadData.js` | Thread state hook |
| `frontend/src/hooks/useConversationCache.js` | LRU message cache |
| `frontend/src/hooks/useThreadMessagesState.js` | Message windowing |
| `frontend/src/services/chatApi.js` | REST API calls |
| `frontend/src/services/threadService.js` | Global chat state |
| `frontend/src/components/conversation/Footer.jsx` | Message composer |
| `frontend/src/components/conversation/Message.jsx` | Message renderer |
| `frontend/src/pages/dashboard/GeneralApp.jsx` | Main chat page |

---

## Message Features Update (March 2026)

### Message Info Overlay
When user clicks "Info" on a message, the frontend opens MessageInfoOverlay which:
1. Emits `socket.emit("message:info", { messageId, threadId })` for fresh DB data
2. Displays: Sent time, Read time, Edit time (from `send_time`/`read_time`/`edit_time` columns)
3. Shows Read receipts with: name, avatar, readAt, location (city, country), device type, platform
4. Shows Delivered receipts with: name, avatar, deliveredAt, location, device type
5. Shows sender device info and location in header
6. Message content clipped to ~80px in info overlay (no "Show more")

### Show More / Show Less
- Messages with 4+ lines or 300+ characters auto-collapse
- `CollapsibleText` component wraps TextMsg render paths
- CSS `-webkit-line-clamp: 4` for efficient visual clipping
- Click "Show more" → expands full text
- Click "Show less" → collapses back
- Emoji-only messages excluded from collapse

### Translate Feature
- Menu action: "Translate" → opens TranslateDialog
- Split-panel dialog: language list (left) + original & translated text (right)
- Popular language chips for quick selection
- Searchable language list (from `/languages` API with fallback)
- API: `POST /translate { text, targetLanguage }` → Gemini/OpenAI
- Translated text stored in `message.content.translatedText`

### Summarize Feature
- Menu action: "Summarize" → opens SummarizeDialog
- Auto-summarizes on open (no extra click)
- File support: PDF (pdf-parse), Images (Gemini Vision), DOCX (XML extract), Text files (direct read)
- API: `POST /translate/summarize { text, fileUrl, fileKey, fileName, fileType }`
- Regenerate + Copy buttons
- Purple gradient theme

### Rich Text Formatting
- Bold (B), Italic (I), Underline (U) supported in contentEditable editor
- `content.html` field stores formatted HTML
- `sanitizeComposerHtml()` strips unsafe tags, preserves: B, STRONG, I, EM, U, BR, SPAN, DIV, P, A, UL, OL, LI
- Paste: HTML checked first (preserves formatting), plain text fallback
- `buildContent()` includes `html` field for text messages (not leaked for files)
- Links: `target="_blank"` + `rel="noopener noreferrer"` on all `<a>` tags

### File Message Fixes
- DB constraint updated: `message_type IN ('text', 'file', 'image', 'video', 'audio', 'link', 'code', 'system', 'emoji', 'poll')`
- `buildContent()` for file types: full metadata spread minus `sentFrom`/`editHistory`/`html`
- File size formatted: `humanFileSize()` → "6.12 KB", "3.8 MB"
- Both `rawSize` (number) and `fileSize` (formatted string) included

### Recalled Message Handling
- `recallDMMessage` sets `message = NULL` (not empty string)
- Unread count filter: `AND message IS NOT NULL` — includes files (empty string), excludes recalled (NULL)
- `getDMMessages`/`getGroupMessages` filter post-decryption: `!meta.recalled && !meta.deleted`

### Edit Message Payload
Edit events include all text-fallback fields to bust frontend caches:
```javascript
{
  content: { text: "new text", isEmojiOnly: false, emojiCount: 0 },
  message: "new text",
  text: "new text",
  preview: "new text",
  body: "new text",
  metadata: { editedAt: "..." },
  __normalized: false,
  __renderCache: null
}
```
