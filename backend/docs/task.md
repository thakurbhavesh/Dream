## AI Features (DONE)
- ✅ AI Tone Adjuster — Rewrite in Formal/Friendly/Diplomatic/Professional
- ✅ AI Semantic Search — Search by meaning, not keywords
- ✅ AI Call Transcription & Notes — Auto meeting notes from calls
- ✅ AI Smart Composer — Real-time autocomplete as you type
- ✅ AI Voice-to-Text — Convert audio messages to text using AI (OpenAI Whisper / Gemini)
- ✅ features.md updated with all 5 features + Screen Share + Audio/Video Call + Export Chat

---

## 10K Users Scaling (Code-Level Changes)

### P0 — Critical (Without these, 10K impossible)

1. **PM2 Cluster Mode**
   - Create `ecosystem.config.js` with 4-8 worker instances
   - Single process = single CPU core = bottleneck
   - File: `ecosystem.config.js` (NEW)

2. **Socket.IO Redis Adapter**
   - Install `@socket.io/redis-adapter`
   - Multi-server socket broadcast support
   - Without this, Server A can't talk to Server B users
   - File: `backend/src/socket/index.js`

3. **In-Memory Maps → Redis Migrate**
   - `userSockets` (Map) → Redis Hash
   - `userOrgMap` (Map) → Redis Hash
   - `orgOnlineUsers` (Map) → Redis Set per org
   - `socketActiveThread` (Map) → Redis Hash
   - `_groupMembersCache` (Map) → Redis with TTL
   - `_orgControlsCache` (Map) → Redis with TTL
   - File: `backend/src/socket/index.js`, new `backend/src/utils/redisPresence.js`

4. **DB Pool Tuning + PgBouncer Config**
   - Current: `DB_POOL_MAX=20` (too low for 10K)
   - Fix: PgBouncer connection pooler + `DB_POOL_MAX=50` per worker
   - File: `backend/src/config/database.js`, `.env`

### P1 — Important (Performance under load)

5. **Redis-Based Rate Limiter**
   - Current: in-memory array per socket (120K arrays at 10K users)
   - Fix: Redis sliding window rate limiter (shared across workers)
   - File: `backend/src/socket/index.js`

6. **Connect-Time Heavy Queries → Redis Cache**
   - Current: Full table scan for unread counts on every first connect
   - 10K morning logins = 10K heavy DB queries simultaneously
   - Fix: Cache unread counts in Redis, update incrementally on message events
   - File: `backend/src/socket/index.js`

7. **BullMQ Queue for AI Jobs**
   - Current: AI calls (translate, summarize, smart reply, grammar) are synchronous
   - 100 users using AI simultaneously = backend blocks
   - Fix: BullMQ + Redis queue for async AI processing
   - Files: new `backend/src/queues/aiQueue.js`, modify AI controllers

### P2 — Optimization (Nice to have at 10K, required at 50K+)

8. **Message Decryption Caching**
   - Currently decrypts on every fetch (10K users × 30 msgs = 300K decrypts at peak)
   - Cache decrypted messages in Redis with short TTL
   - File: `backend/src/utils/messageCipher.js`

9. **Group Broadcast Optimization**
   - Current: N+1 check per member (online? notification?)
   - Fix: Batch check via Redis Sets
   - File: `backend/src/socket/index.js`

10. **Socket Stats Optimization**
    - `getSocketStats()` iterates all sockets every 10s
    - At 10K = heavy. Use Redis counters instead
    - File: `backend/src/socket/index.js`

### Server Requirements for 10K Users
- **CPU:** 4+ cores (PM2 uses all)
- **RAM:** 8GB+ (Redis + Node workers)
- **PostgreSQL:** Dedicated server or managed (RDS/Supabase)
- **Redis:** Dedicated instance (ElastiCache or self-hosted)
- **TURN Server:** For reliable WebRTC calls across NAT (coturn or Twilio)
- **Nginx:** Reverse proxy + load balancer + SSL termination
- **SSL:** Required (WebRTC needs HTTPS)
