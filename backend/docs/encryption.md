# End-to-End Message Encryption

> **File:** `backend/src/utils/messageCipher.js`
> **Algorithm:** AES-256-GCM
> **Key:** `CHAT_ENCRYPTION_KEY` env variable (64-char hex = 32 bytes)

---

## Overview

All chat messages and metadata are encrypted before database storage. The database **never** stores plain-text conversation content. Decryption happens after SELECT, before sending to frontend via socket or REST.

```
Frontend (plain text) → Backend → encrypt → PostgreSQL (ciphertext)
PostgreSQL (ciphertext) → Backend → decrypt → Frontend (plain text)
```

---

## Encryption Algorithm

| Parameter | Value |
|-----------|-------|
| Algorithm | AES-256-GCM |
| Key size | 32 bytes (256 bits) |
| IV size | 12 bytes (GCM recommended) |
| Auth tag | 16 bytes (128 bits) |
| Key format | 64-character hex string |

### Generate a Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Encrypted Format

### Message Column (`TEXT`)

```
base64(iv).base64(ciphertext).base64(authTag)
```

Example:
```
dG9rZW5JVjEy.ZW5jcnlwdGVkQ29udGVudA==.YXV0aFRhZ1ZhbHVl
```

Three base64 segments separated by dots (`.`).

### Metadata Column (`JSONB`)

Since PostgreSQL requires valid JSONB, encrypted metadata is wrapped:

```json
{ "_enc": "base64(iv).base64(ciphertext).base64(authTag)" }
```

The `_enc` key signals that the value is encrypted.

---

## Functions

### `encryptMessage(plainText) → string`

```
Input:  "Hello World"
Output: "dG9r...base64iv.ZW5j...base64ct.YXV0...base64tag"
```

- Returns `null` for null/undefined input
- Returns `''` for empty string
- Converts input to String before encryption

### `decryptMessage(payload) → string`

```
Input:  "dG9r...base64iv.ZW5j...base64ct.YXV0...base64tag"
Output: "Hello World"
```

- **Backward compatible**: If input doesn't match 3-dot format, returns as-is (plain text)
- If decryption fails, returns input as-is (corrupted or wrong key)
- This allows gradual migration from plain-text to encrypted

### `encryptMetadata(metadata) → string (JSONB)`

```
Input:  { fileName: "photo.jpg", fileSize: 1024 }
Output: '{"_enc":"dG9r...base64iv.ZW5j...base64ct.YXV0...base64tag"}'
```

1. JSON.stringify the metadata object
2. Encrypt the JSON string
3. Wrap in `{ "_enc": encrypted }`
4. JSON.stringify again for JSONB column

### `decryptMetadata(metadata) → object`

```
Input:  { "_enc": "dG9r...base64iv.ZW5j...base64ct.YXV0...base64tag" }
Output: { fileName: "photo.jpg", fileSize: 1024 }
```

1. Check for `_enc` key → encrypted format
2. Decrypt the `_enc` value
3. JSON.parse the decrypted string
4. If no `_enc` key → return as-is (backward compatible plain JSONB)

---

## Where Encryption Is Applied

### chatModel.js (Core Message Operations)

| Function | Encrypt | Decrypt |
|----------|---------|---------|
| `sendDMMessage()` | message + metadata | response row |
| `sendGroupMessage()` | message + metadata | response row |
| `editDMMessage()` | new message text | response row + metadata |
| `deleteDMMessage()` | metadata `{deleted:true}` | - |
| `getDMMessages()` | - | all rows message + metadata |
| `getGroupMessages()` | - | all rows message + metadata |
| `getDMThreads()` | - | last message preview + metadata |
| `getGroupThreads()` | - | last message preview + metadata |

### socket/index.js (Socket Event Handlers)

| Function | Encrypt | Decrypt |
|----------|---------|---------|
| `recallDMMessage()` | empty message + metadata `{recalled:true}` | - |
| `recallGroupMessage()` | empty message + metadata `{recalled:true}` | - |
| `editGroupMessage()` | new message + metadata `{edited:true}` | response row |
| `message:pin` handler | metadata `{pinned,pinnedBy,pinnedAt}` | existing metadata |

### Edit Operation Flow

Editing a message follows a **read→decrypt→merge→encrypt** pattern to preserve existing metadata:

```
1. Read current row from DB (encrypted message + metadata)
2. Decrypt existing metadata → e.g. { replyTo: 42, fileName: "doc.pdf" }
3. Merge { edited: true } into decrypted metadata → { replyTo: 42, fileName: "doc.pdf", edited: true }
4. Encrypt the merged metadata + new message text
5. UPDATE the row with new ciphertext
```

This ensures fields like `replyTo` are not lost when the `edited` flag is added.

### Recall Operation Flow

Recalling (unsending) a message:

```
1. Set metadata to { recalled: true } (encrypted)
2. Set message column to encrypted empty string ("")
3. UPDATE the row — original content is permanently destroyed
```

The frontend checks `metadata.recalled` and displays a "message was recalled" placeholder.

### File Metadata

File metadata fields (`fileName`, `fileKey`, `fileType`, `fileSize`, `replyTo`) are encrypted inside the `message_metadata` JSONB column using the `_enc` wrapper format. File URLs stored in metadata are **S3 object keys** (not full URLs) — they are encrypted at rest and signed on demand with `getSignedUrl()` after decryption, producing short-lived presigned S3 URLs for the frontend.

---

## Encryption Flow Example

### Sending a DM Message

```
1. Frontend sends plain text via socket:
   socket.emit("message:send", { message: "Hello!", metadata: { html: "Hello!" } })

2. Backend chatModel.sendDMMessage():
   encryptedMsg = encryptMessage("Hello!")
   → "dG9r...iv.ZW5j...ct.YXV0...tag"

   encryptedMeta = encryptMetadata({ html: "Hello!" })
   → '{"_enc":"abc...iv.def...ct.ghi...tag"}'

3. INSERT INTO messages (..., message, message_metadata)
   VALUES (..., 'dG9r...iv.ZW5j...ct.YXV0...tag', '{"_enc":"abc...iv.def...ct.ghi...tag"}')

4. After INSERT, decrypt for socket response:
   row.message = decryptMessage(row.message)     → "Hello!"
   row.message_metadata = decryptMetadata(row.message_metadata) → { html: "Hello!" }

5. Normalize + emit to receiver as plain text
```

### Reading a DM Thread

```
1. Frontend: GET /chat/threads/dm-5/messages

2. Backend chatModel.getDMMessages():
   SELECT * FROM messages WHERE ...

3. For each row:
   row.message = decryptMessage(row.message)     → plain text
   row.message_metadata = decryptMetadata(row.message_metadata) → object

4. Return decrypted array to frontend
```

---

## Backward Compatibility

The system handles a mixed database with both encrypted and plain-text messages:

```
decryptMessage("Hello")           → "Hello"     (no dots → plain text, return as-is)
decryptMessage("iv.ct.tag")       → "Decrypted" (3 dots → decrypt)
decryptMessage("not.valid.enc")   → "not.valid.enc" (decrypt fails → return as-is)
```

```
decryptMetadata({ html: "Hi" })           → { html: "Hi" }   (no _enc → plain)
decryptMetadata({ _enc: "iv.ct.tag" })    → { html: "Hi" }   (has _enc → decrypt)
```

---

## Security Notes

- Key is loaded once from `CHAT_ENCRYPTION_KEY` env variable and cached in memory
- Each message gets a unique random IV (12 bytes via `crypto.randomBytes`)
- GCM mode provides both confidentiality and authenticity (auth tag)
- Key rotation requires re-encrypting all existing messages
- Frontend NEVER sees encrypted content — decryption is server-side only

---

## Environment Setup

```env
# .env
CHAT_ENCRYPTION_KEY=a8d22cf0d203b77a4459ac8719b9b32f090b56ce22c43aabd0c06f07e26ee89e
```

Must be exactly 64 hex characters (32 bytes). Generate with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
