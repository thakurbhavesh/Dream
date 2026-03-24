# TeamChatX — System Requirements & Scaling Guide

Last updated: 2026-03-24

---

## 1. Tech Stack Requirements

### Backend

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | 18+ (LTS recommended, v22 tested) |
| Framework | Express.js | 4.x |
| Real-time | Socket.IO | 4.8+ |
| Database | PostgreSQL | 14+ (18 tested) |
| Cache | Redis | 7+ (optional, flag-controlled via `REDIS_ENABLED`) |
| Storage | AWS S3 | SDK v3 |
| Email | Nodemailer | SMTP (dynamic config from DB `smtp_settings`) |
| AI Providers | Gemini / OpenAI / Claude | API-based (keys in DB `ai_providers`) |
| Payments | Stripe | API v18+ |
| Encryption | AES-256-GCM | Node.js crypto (messages + metadata) |
| File Parsing | pdf-parse, AdmZip | PDF/DOCX content extraction |
| Geo IP | geoip-lite | IP → country/city resolution |

### Frontend (Web)

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | React | 18.x |
| Build | Vite | 5.x |
| UI Library | MUI (Material UI) | 5.x |
| State | Zustand / React Context | — |
| Socket | socket.io-client | 4.x |
| Editor | TipTap / ProseMirror | Rich text editing |

### Mobile App

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | React Native (Expo) | SDK 54 |
| Navigation | Expo Router | 4.x (file-based routing) |
| Socket | socket.io-client | 4.x |
| Auth Storage | expo-secure-store | Encrypted local token storage |
| Biometrics | expo-local-authentication | Fingerprint / Face unlock |
| Notifications | expo-notifications | Local push notifications |
| Camera/Gallery | expo-image-picker | Photo/video capture & selection |
| Audio | expo-audio | Voice message recording & playback |
| Location | expo-location | GPS location sharing |
| Contacts | expo-contacts | Contact card sharing |
| File System | expo-file-system | File download & cache |
| Secure Browser | expo-web-browser | In-app file preview |
| Icons | @expo/vector-icons (Ionicons) | — |
| Gradient | expo-linear-gradient | UI gradients |

---

## 2. Platform Support

### Web Browser

| Browser | Minimum Version |
|---------|----------------|
| Chrome | 90+ |
| Firefox | 90+ |
| Safari | 14+ |
| Edge | 90+ |

### Desktop App

| Platform | Framework |
|----------|-----------|
| Windows | Electron (packaged via electron-builder) |
| macOS | Electron |
| Linux | Electron |

### Mobile App

| Platform | Minimum Version |
|----------|----------------|
| Android | 6.0+ (API 23) |
| iOS | 14.0+ |
| Expo Go | SDK 54 compatible (for development) |
| Production | EAS Build / standalone APK/IPA |

---

## 3. Minimum Server Requirements

### Small Team (1–50 users)

| Resource | Requirement |
|----------|-------------|
| CPU | 1 vCPU |
| RAM | 1 GB |
| Disk | 20 GB SSD |
| DB | Shared PostgreSQL (same server) |
| Network | 10 Mbps |
| OS | Ubuntu 22.04 / Windows Server / Any Node-compatible |
| Process | Single `node src/server.js` |
| DB Pool | `DB_POOL_MAX=10` |

### Medium Organization (50–500 users)

| Resource | Requirement |
|----------|-------------|
| CPU | 2 vCPU |
| RAM | 4 GB |
| Disk | 50 GB SSD |
| DB | Dedicated PostgreSQL (separate server or managed RDS) |
| Network | 50 Mbps |
| Process | PM2 cluster mode (2 workers) |
| DB Pool | `DB_POOL_MAX=30` |
| Redis | Required (session + cache) |

### Large Organization (500–5,000 users)

| Resource | Requirement |
|----------|-------------|
| CPU | 4 vCPU |
| RAM | 8 GB |
| Disk | 100 GB SSD |
| DB | Dedicated PostgreSQL (4 vCPU, 16 GB RAM, SSD) |
| Network | 100 Mbps |
| Process | PM2 cluster mode (4 workers) + Redis adapter for Socket.IO |
| DB Pool | `DB_POOL_MAX=50` per worker |
| Redis | Required |

### Enterprise (5,000–50,000+ users)

| Resource | Requirement |
|----------|-------------|
| App Servers | 2–4 servers, each 4 vCPU / 8 GB RAM |
| Load Balancer | Nginx / AWS ALB (sticky sessions for Socket.IO) |
| DB | PostgreSQL cluster (primary + read replica), 8 vCPU / 32 GB RAM |
| Redis | Dedicated Redis (4 GB+ RAM), used as Socket.IO adapter |
| DB Pool | `DB_POOL_MAX=100` per worker |
| CDN | CloudFront / S3 static hosting for frontend |
| Storage | S3 with lifecycle policies |

---

## 4. Concurrent User Capacity (Current Single-Process Architecture)

### Memory Per Connection

| Component | Size |
|-----------|------|
| WebSocket (Socket.IO) | ~3–5 KB |
| In-memory Maps (userSockets, userOrgMap, orgOnlineUsers, socketActiveThread) | ~200 bytes |
| Rate limiter (11 per socket) | ~500 bytes |
| Caches (org controls, group members) | Shared across connections |
| **Total per user** | **~5 KB** |

### DB Query Load Per Event

| Event | Frequency | DB Queries | Protection |
|-------|-----------|------------|------------|
| **connect** (first tab/device) | Once per session | 3 queries (DM unread + group unread + deliver) | `wasAlreadyOnline` skip for multi-device |
| **connect** (extra tab/device) | Tab/app open | 0 queries | Skipped |
| **message:send DM** | Per message | 4–6 queries | Rate limit: 30/10s |
| **message:send Group** | Per message | 3–4 queries (batch unread) | Rate limit: 30/10s |
| **message:send Self** | Per self-message | 2–3 queries (no delivery) | Rate limit: 30/10s |
| **typing:start/stop** | Per keystroke | 0 queries (cached) | Rate limit: 5/3s |
| **thread:focus** | Per chat switch | 1 query | Rate limit: 10/5s |
| **message:react** | Per reaction | 1–2 queries | Rate limit: 20/10s |
| **message:edit** | Per edit | 2–3 queries | Rate limit: 10/10s |
| **message:info** | Per info click | 2–5 queries | Rate limit: 5/5s |
| **message:pin** | Per pin | 2 queries | Rate limit: 5/10s |
| **message:recall** | Per recall | 1–2 queries (message_actions insert) | Rate limit: 5/10s |
| **message:delete** | Per delete | 1–2 queries (message_actions insert) | Rate limit: 10/10s |
| **message:forward** | Per forward | 4–6 queries | Rate limit: 10/10s |
| **update_activity_status** | On idle/away | 0 queries (cached) | — |
| **tab-visibility** | Tab show/hide | 0 queries (cached) | — |

### Capacity Estimates

| Setup | Connected Users | Active Users (typing/sending) | DB Pool |
|-------|----------------|-------------------------------|---------|
| **Default** (1 process, pool=20) | 10K–15K | 2K–4K | 20 |
| **pool=50** | 20K–30K | 5K–10K | 50 |
| **PM2 4 workers + Redis + pool=50** | 50K–80K | 15K–25K | 200 total |
| **Multi-server + dedicated DB + pool=100** | 100K+ | 30K–50K | 400+ total |

> **Note:** "Active" = sending messages, typing, switching chats. "Connected" = idle users with open socket. Most users are idle at any given time (~80–90%).

---

## 5. Multi-Device Architecture

TeamChatX supports simultaneous connections from multiple devices per user:

| Feature | Implementation |
|---------|---------------|
| Socket tracking | `userSockets` Map: userId → Set of socketIds (web, desktop, mobile) |
| Thread focus | `socketActiveThread` Map: per-socket thread tracking (not per-user) |
| Message delivery | `emitToUser()` sends to ALL connected sockets for a user |
| Online/Offline | `wasAlreadyOnline` flag prevents duplicate connect queries |
| Self-chat | `sender_id === receiver_id` — messages stored, no delivery to "other user" |
| Read receipts | Emitted to all sender sockets; per-socket active thread prevents false unread |

### Device-Specific Behavior

| Platform | Auth | Socket | Token Storage |
|----------|------|--------|---------------|
| Web (browser) | HttpOnly cookies (access + refresh) | Auto-connect on page load | Cookies |
| Desktop (Electron) | HttpOnly cookies | Auto-connect on app launch | Cookies |
| Mobile (React Native) | Bearer token in header | Connect after login, reconnect on foreground | expo-secure-store |

---

## 6. Caching Strategy (Current)

| Cache | TTL | Purpose |
|-------|-----|---------|
| `_orgControlsCache` | 5 min | Organization feature controls (typing, status, edit, recall) |
| `_groupMembersCache` | 30 sec | Group member IDs (avoids DB hit on typing/react/send) |
| `orgOnlineUsers` | Real-time | O(1) online user list per org (replaces O(N) Map scan) |
| `_roleIdToKey` | Permanent | Role ID → role_key mapping (4 standard roles) |
| `socket.geo` | Per connection | User device geo data (loaded once on connect) |
| Mobile JSON cache | Persistent | Thread list + last 50 messages per thread (offline support) |

---

## 7. Rate Limiting (Per Socket)

| Event | Max Calls | Window | Why |
|-------|-----------|--------|-----|
| `message:send` | 30 | 10 sec | Prevent message spam |
| `message:edit` | 10 | 10 sec | Prevent edit spam |
| `message:react` | 20 | 10 sec | Prevent reaction flood |
| `typing:start/stop` | 5 | 3 sec | Prevent typing event flood |
| `message:read` | 10 | 5 sec | Prevent read-mark spam |
| `thread:focus` | 10 | 5 sec | Prevent rapid chat switching |
| `message:info` | 5 | 5 sec | Heavy query, limit clicks |
| `message:pin` | 5 | 10 sec | Prevent pin/unpin toggle spam |
| `message:recall` | 5 | 10 sec | Prevent rapid unsend |
| `message:delete` | 10 | 10 sec | Prevent mass delete |
| `message:forward` | 10 | 10 sec | Prevent forward spam |

---

## 8. Required Environment Variables

### Core (Required)

```env
# Server
PORT=5000
NODE_ENV=production

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<password>
DB_NAME=teamchatx
DB_POOL_MAX=20                    # Increase for scale: 50-100
DB_IDLE_TIMEOUT_MS=10000
DB_CONN_TIMEOUT_MS=5000
# OR use connection string:
# DATABASE_URL=postgresql://user:pass@host:5432/dbname

# JWT
JWT_SECRET=<random-64-char-string>
JWT_EXPIRES_IN=15m                # Access token expiry
JWT_REFRESH_EXPIRES_IN=90d        # Refresh token expiry

# CORS
CORS_ORIGIN=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Encryption
MESSAGE_ENCRYPTION_KEY=<32-byte-hex-key>
```

### Storage (Required for file uploads)

```env
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_REGION=ap-south-1
AWS_S3_BUCKET=teamchatx-files
```

### Optional

```env
# Redis
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379

# Cookies
COOKIE_SECURE=auto                # true in production
COOKIE_SAME_SITE=none             # for cross-origin
COOKIE_DOMAIN=.yourdomain.com

# SMTP (or configure from DB smtp_settings table)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<email>
SMTP_PASS=<password>

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# OTP Controls
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_LOCK_WINDOW_MINUTES=15
```

---

## 9. Required Database Indexes (Performance-Critical)

These indexes are essential for socket query performance:

```sql
-- DM message queries (send, unread count, delivery)
CREATE INDEX IF NOT EXISTS idx_msg_org_sender_receiver_time
  ON messages (organization_id, sender_id, receiver_id, send_time DESC);

CREATE INDEX IF NOT EXISTS idx_msg_unread_lookup
  ON messages (organization_id, receiver_id)
  WHERE read_time IS NULL AND message IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_msg_undelivered
  ON messages (organization_id, receiver_id)
  WHERE delivered_at IS NULL AND read_time IS NULL AND message IS NOT NULL;

-- Group message queries (unread count, read status)
CREATE INDEX IF NOT EXISTS idx_gmr_user_status
  ON group_message_recipients (user_id, delivery_status);

CREATE INDEX IF NOT EXISTS idx_gm_org_group
  ON group_messages (organization_id, group_id);

-- Group members (cached 30s, but still needs fast cold read)
CREATE INDEX IF NOT EXISTS idx_group_members_active
  ON group_members (group_id)
  WHERE status = 'active';

-- User devices (geo lookup on connect)
CREATE INDEX IF NOT EXISTS idx_device_user_status_active
  ON user_devices (user_id, last_active_at DESC)
  WHERE status = 'active';

-- Organization controls (cached 5min)
CREATE INDEX IF NOT EXISTS idx_org_controls_orgid
  ON organization_controls (organization_id);

-- Message actions (reactions, pins, delete, recall)
CREATE INDEX IF NOT EXISTS idx_msg_actions_lookup
  ON message_actions (message_id, user_id, action_type);

CREATE INDEX IF NOT EXISTS idx_grp_msg_actions_lookup
  ON group_message_actions (group_message_id, user_id, action_type);

-- Message actions per-user delete/recall filter
CREATE INDEX IF NOT EXISTS idx_msg_actions_delete
  ON message_actions (message_id, action_type)
  WHERE action_type IN ('delete', 'recall');

CREATE INDEX IF NOT EXISTS idx_grp_msg_actions_delete
  ON group_message_actions (group_message_id, action_type)
  WHERE action_type IN ('delete', 'recall');

-- Sessions (refresh token lookup)
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash
  ON user_sessions (refresh_token_hash);

-- Activity logs (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_time
  ON activity_logs (organization_id, created_at DESC);
```

---

## 10. Scaling Roadmap (Future)

### Phase 1: Vertical Scale (5K–10K users)

**Changes needed: 0 code changes, config only**

```env
DB_POOL_MAX=50
```

- Upgrade server: 4 vCPU, 8 GB RAM
- Upgrade PostgreSQL: 4 vCPU, 16 GB RAM, SSD
- Add all indexes from Section 9
- Enable Redis cache

### Phase 2: PM2 Clustering (10K–50K users)

**Changes needed: 2 things**

#### 1. PM2 Cluster Mode — Multi-core CPU utilization

```bash
npm install pm2 -g
```

Create `ecosystem.config.js`:
```js
module.exports = {
  apps: [{
    name: 'teamchatx',
    script: 'src/server.js',
    instances: 'max',       // Uses all CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      DB_POOL_MAX: 50,      // Per worker
    },
  }],
};
```

```bash
pm2 start ecosystem.config.js
```

#### 2. Redis Adapter for Socket.IO — Cross-worker socket communication

Without this, User A on Worker 1 can't send messages to User B on Worker 2.

```bash
npm install @socket.io/redis-adapter redis
```

Modify `socket/index.js`:
```js
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const initSocket = async (httpServer) => {
  // ... existing io setup ...

  // Add Redis adapter for multi-process support
  if (process.env.REDIS_URL) {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[socket] Redis adapter attached — multi-process ready');
  }

  io.use(authenticateSocket);
  io.on('connection', onConnection);
};
```

> **Note:** `userSockets`, `userOrgMap`, `orgOnlineUsers`, `socketActiveThread` Maps are per-worker. With Redis adapter, socket.io rooms (`user:X`, `org:X`) work across workers automatically, but presence Maps would need Redis-backed storage for 100% accuracy. For most use cases, the per-worker Maps are sufficient because `emitToUser` uses socket.io rooms which Redis adapter handles.

### Phase 3: Horizontal Scale (50K–100K+ users)

- Multiple app servers behind Nginx/ALB (sticky sessions: `ip_hash` or cookie-based)
- PostgreSQL read replicas for heavy read queries (message:info, search, media)
- Dedicated Redis cluster (Sentinel or ElastiCache)
- S3 + CloudFront CDN for file delivery
- Connection draining on deploy (graceful shutdown already implemented)

Nginx config for sticky WebSocket:
```nginx
upstream teamchatx {
    ip_hash;
    server app1:5000;
    server app2:5000;
}

server {
    location /socket.io/ {
        proxy_pass http://teamchatx;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

---

## 11. Monitoring Checklist (Production)

| Metric | Tool | Threshold |
|--------|------|-----------|
| DB connection pool utilization | `pg_stat_activity` | Alert at 80% pool usage |
| DB slow queries | `pg_stat_statements` | Alert on queries > 100ms |
| Node.js heap usage | PM2 / `process.memoryUsage()` | Alert at 80% of max heap |
| Socket connections count | Owner Dashboard (`system:socket-stats`) | Monitor trend |
| WebSocket errors | Socket.IO `connect_error` events | Alert on spike |
| CPU usage | OS monitoring | Alert at 80% sustained |
| Redis memory | `redis-cli INFO memory` | Alert at 80% maxmemory |
| S3 storage | AWS CloudWatch | Monitor growth rate |
| Mobile app crashes | Expo crash reporting / Sentry | Alert on new crash types |

---

## 12. Security Requirements

| Requirement | Implementation |
|-------------|---------------|
| HTTPS | Required in production (TLS termination at LB or Nginx) |
| JWT Secret | Minimum 64 characters, random, rotated periodically |
| Encryption Key | 32-byte hex key for AES-256-GCM message encryption |
| CSRF Protection | Double-submit cookie pattern on unsafe methods (skipped for Bearer token auth) |
| HttpOnly Cookies | `access_token` and `refresh_token` cookies (web/desktop) |
| Bearer Token | Mobile app uses `Authorization: Bearer <token>` header |
| Biometric Auth | expo-local-authentication for fingerprint/face unlock (mobile) |
| Rate Limiting | Per-socket sliding window on all events |
| File Upload | Dangerous extensions blocked at multer level (exe, bat, dll, js, etc.) |
| File Selection | Frontend blocks dangerous file types in file picker `accept` attribute |
| SQL Injection | Parameterized queries only (no string interpolation for values) |
| CORS | Explicit origin whitelist, no wildcard in production |
| Refresh Token Reuse | Detected → all sessions revoked → force logout |
| Device Trust | `user_devices` table tracks trusted devices with geo/IP info |
| OTP Verification | Email-based OTP with rate limiting and lockout window |
| Trusted Device Skip | Same device + same user → skip OTP on subsequent logins |

---

## 13. Mobile App Permissions (Play Store / App Store)

| Permission | Usage | Required For |
|------------|-------|-------------|
| `CAMERA` | Take photos & record videos for chat | Photo/video messages |
| `READ_MEDIA_IMAGES` / `PHOTO_LIBRARY` | Select photos from gallery | Image sharing |
| `RECORD_AUDIO` / `MICROPHONE` | Voice message recording | Audio messages |
| `ACCESS_FINE_LOCATION` | Share current GPS location | Location messages |
| `READ_CONTACTS` | Share contact cards | Contact sharing |
| `POST_NOTIFICATIONS` | Show message alerts | Push notifications |
| `USE_BIOMETRIC` / `USE_FINGERPRINT` | Biometric login | Fingerprint/Face unlock |
| `INTERNET` | API calls + WebSocket | Core functionality |

### Play Store Privacy Policy Requirements

- Explain all permission usage in privacy policy
- Camera & microphone: declare in `app.json` → `android.permissions`
- Location: declare `ACCESS_FINE_LOCATION` + justify in Data Safety section
- Contacts: read-only access, not stored on server
- Biometric: data never leaves device, used only for local authentication

### App Store Requirements

- `NSCameraUsageDescription`: "Used to take photos and videos for chat messages"
- `NSMicrophoneUsageDescription`: "Used to record voice messages"
- `NSPhotoLibraryUsageDescription`: "Used to share images and videos in chats"
- `NSLocationWhenInUseUsageDescription`: "Used to share your location with other users"
- `NSContactsUsageDescription`: "Used to share contact cards in chats"
- `NSFaceIDUsageDescription`: "Used for biometric login authentication"

---

## 14. Deployment Checklist

### Backend

- [ ] Set `NODE_ENV=production`
- [ ] Configure all required env vars (Section 8)
- [ ] Run database migrations
- [ ] Create required indexes (Section 9)
- [ ] Configure CORS for production domain
- [ ] Set secure cookie settings (`COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`)
- [ ] Configure S3 bucket with proper CORS policy
- [ ] Set up SMTP for email (OTP, notifications)
- [ ] Configure Stripe (if billing enabled)
- [ ] Set up PM2 for process management
- [ ] Configure Nginx reverse proxy with WebSocket support
- [ ] Enable HTTPS (TLS certificate)
- [ ] Set up log rotation

### Frontend (Web)

- [ ] Build with `npm run build` (Vite production build)
- [ ] Deploy `dist/` to CDN or static hosting
- [ ] Configure `.env.production` with API URL

### Mobile App

- [ ] Update `src/api/config.js` with production API URL
- [ ] Run `eas build --platform android` for Android APK/AAB
- [ ] Run `eas build --platform ios` for iOS IPA
- [ ] Configure app signing (keystore for Android, provisioning for iOS)
- [ ] Submit to Play Store / App Store
- [ ] Set up OTA updates via `expo-updates` (optional)

### Desktop App

- [ ] Build with electron-builder for Windows/macOS/Linux
- [ ] Code sign the binaries
- [ ] Set up auto-update server
