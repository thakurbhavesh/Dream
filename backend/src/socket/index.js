const { Server } = require('socket.io');

// XSS sanitization — strip dangerous HTML/script tags from messages
const sanitizeText = (text) => {
  if (typeof text !== 'string') return text;
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // remove iframes
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')  // remove event handlers
    .replace(/<\/?(?:script|iframe|object|embed|form|input|textarea|select|button)\b[^>]*>/gi, '') // strip dangerous tags
    .replace(/javascript\s*:/gi, '') // remove javascript: protocol
    .trim();
};
const jwt = require('jsonwebtoken');
const chatModel = require('../chat/chatModel');
const db = require('../config/database');
const { signProfileFields } = require('../utils/signProfileUrls');
const { signMessageFileUrls } = require('../utils/signFileUrls');
const { encryptMessage, decryptMessage: _rawDecryptMessage, encryptMetadata, decryptMetadata: _rawDecryptMetadata } = require('../utils/messageCipher');
const controlModel = require('../models/organizationControlModel');
const meetingModel = require('../models/meetingModel');
const threadMuteModel = require('../models/threadMuteModel');
const userSettingsModel = require('../models/userSettingsModel');
const scheduledMessageModel = require('../models/scheduledMessageModel');
const disappearingModel = require('../models/disappearingModel');
const { sendMailAsync } = require('../utils/mail');
const webPush = require('../utils/webPush');
const callLogModel = require('../models/callLogModel');
const threadPinModel = require('../models/threadPinModel');

// Fire-and-forget web push so subscribers receive background notifications
const pushToUser = (userId, payload) => {
  webPush.sendPushToUser(userId, payload).catch((err) => {
    console.warn('[webPush] push error:', err.message);
  });
};
const { resolveMailBranding } = require('../utils/mailBranding');

// Safe decrypt wrappers — return fallback instead of crashing the socket handler
const decryptMessage = (val) => {
  try { return _rawDecryptMessage(val); } catch (err) {
    console.error('[socket] decryptMessage failed:', err.message);
    return typeof val === 'string' ? val : '';
  }
};
const decryptMetadata = (val) => {
  try { return _rawDecryptMetadata(val); } catch (err) {
    console.error('[socket] decryptMetadata failed:', err.message);
    return typeof val === 'object' && val !== null ? val : {};
  }
};

/** @type {Server} */
let io = null;

// ─── Organization Controls enforcement ───────────────────────────────────────
// Preload ALL controls for an org in one query, cache for 5 minutes.
// This ensures typing/status events NEVER hit the DB individually.
const _orgControlsCache = new Map();   // orgId → { data: Map<featureKey, row>, ts }
const CONTROL_CACHE_TTL = 5 * 60_000; // 5 minutes

const preloadOrgControls = async (orgId) => {
  try {
    const rows = await controlModel.findAllControls(orgId);
    const map = new Map();
    for (const row of rows) map.set(row.feature_key, row);
    _orgControlsCache.set(orgId, { data: map, ts: Date.now() });
    return map;
  } catch {
    return new Map();
  }
};

const getOrgControl = async (orgId, featureKey) => {
  const cached = _orgControlsCache.get(orgId);
  if (cached && Date.now() - cached.ts < CONTROL_CACHE_TTL) {
    return cached.data.get(featureKey) || null;
  }
  const map = await preloadOrgControls(orgId);
  return map.get(featureKey) || null;
};

/** Invalidate cache when admin updates a control (call from controller) */
const invalidateOrgControlsCache = (orgId) => {
  _orgControlsCache.delete(orgId);
};

// ─── Mute cache (avoids per-notification DB lookups) ─────────────────────────
const _muteCache = new Map(); // `${userId}:${orgId}` → { threads: Set<threadId>, ts }
const MUTE_CACHE_TTL = 2 * 60_000; // 2 minutes

const isThreadMuted = async (userId, orgId, threadId) => {
  const cacheKey = `${userId}:${orgId}`;
  const cached = _muteCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < MUTE_CACHE_TTL) {
    return cached.threads.has(threadId);
  }
  try {
    const mutes = await threadMuteModel.getMutedThreads(userId, orgId);
    const set = new Set(mutes.map(m => m.thread_id));
    _muteCache.set(cacheKey, { threads: set, ts: Date.now() });
    return set.has(threadId);
  } catch {
    return false;
  }
};

const invalidateMuteCache = (userId, orgId) => {
  _muteCache.delete(`${userId}:${orgId}`);
};

// ─── DND check helper ────────────────────────────────────────────────────────
const _dndCache = new Map(); // userId → { value, ts }
const DND_CACHE_TTL = 60_000; // 1 minute

const isUserDND = async (userId) => {
  const cached = _dndCache.get(String(userId));
  if (cached && Date.now() - cached.ts < DND_CACHE_TTL) {
    return cached.value;
  }
  try {
    const dnd = await userSettingsModel.getSetting(Number(userId), 'dnd');
    if (!dnd || !dnd.enabled) {
      _dndCache.set(String(userId), { value: false, ts: Date.now() });
      return false;
    }
    // Check schedule if active
    if (dnd.schedule?.active && dnd.schedule.startTime && dnd.schedule.endTime) {
      const now = new Date();
      const day = now.getDay();
      if (dnd.schedule.days && !dnd.schedule.days.includes(day)) {
        _dndCache.set(String(userId), { value: false, ts: Date.now() });
        return false;
      }
      const [sh, sm] = dnd.schedule.startTime.split(':').map(Number);
      const [eh, em] = dnd.schedule.endTime.split(':').map(Number);
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      let inWindow;
      if (startMin <= endMin) {
        inWindow = nowMin >= startMin && nowMin < endMin;
      } else {
        inWindow = nowMin >= startMin || nowMin < endMin;
      }
      _dndCache.set(String(userId), { value: inWindow, ts: Date.now() });
      return inWindow;
    }
    _dndCache.set(String(userId), { value: true, ts: Date.now() });
    return true;
  } catch {
    return false;
  }
};

const invalidateDndCache = (userId) => {
  _dndCache.delete(String(userId));
};

/**
 * Resolve role_id (from JWT) → role_key string used in allowed_roles JSONB.
 * Role mapping: 1=owner, 2=admin, 3=moderator, 4=user (standard TeamChatX roles).
 * Falls back to DB lookup if the ID is outside the known range.
 */
const _roleIdToKey = { 1: 'owner', 2: 'admin', 3: 'moderator', 4: 'user' };
const _roleKeySet = new Set(['owner', 'admin', 'moderator', 'user']);

const getRoleKey = async (roleId) => {
  // JWT may contain role_key string (e.g. "owner") or numeric role_id (e.g. 1)
  if (typeof roleId === 'string' && _roleKeySet.has(roleId)) return roleId;
  if (_roleIdToKey[roleId]) return _roleIdToKey[roleId];
  try {
    const { rows } = await db.query('SELECT role_key FROM roles WHERE role_id = $1 LIMIT 1', [roleId]);
    const key = rows[0]?.role_key || 'user';
    _roleIdToKey[roleId] = key;
    return key;
  } catch { return 'user'; }
};

/**
 * Check if a feature action is allowed for this org + user role.
 * Returns { allowed, reason, control } — caller decides what to do with denied actions.
 * Also checks time_limit_minutes for edit/recall (message must be within N minutes of creation).
 */
const checkOrgControl = async (orgId, roleId, featureKey, messageCreatedAt) => {
  const control = await getOrgControl(orgId, featureKey);

  // No control row → feature allowed by default
  if (!control) return { allowed: true, control: null };

  // Feature disabled entirely
  if (!control.enabled) return { allowed: false, reason: `${featureKey} is disabled for this organization`, control };

  // Check role permission
  const roleKey = await getRoleKey(roleId);
  const allowedRoles = control.allowed_roles;
  if (allowedRoles && typeof allowedRoles === 'object') {
    if (!allowedRoles[roleKey]) {
      return { allowed: false, reason: `Your role (${roleKey}) cannot ${featureKey}`, control };
    }
  }

  // Check time limit (for edit/recall/delete)
  if (control.time_limit_minutes && messageCreatedAt) {
    const created = new Date(messageCreatedAt);
    const now = new Date();
    const diffMinutes = (now - created) / 60000;
    if (diffMinutes > control.time_limit_minutes) {
      return {
        allowed: false,
        reason: `${featureKey} time limit exceeded (${control.time_limit_minutes} min)`,
        control,
      };
    }
  }

  return { allowed: true, control };
};

// ─── Scalable presence tracking ──────────────────────────────────────────────
// userId (string) → Set<socketId> — supports multi-tab/device per user
const userSockets = new Map();

const addUserSocket = (userId, socketId) => {
  let set = userSockets.get(userId);
  if (!set) { set = new Set(); userSockets.set(userId, set); }
  set.add(socketId);
};

const removeUserSocket = (userId, socketId) => {
  const set = userSockets.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) userSockets.delete(userId);
};

/** Emit to all tabs/devices of a user via their personal room (efficient — no loop) */
const emitToUser = (userId, event, data) => {
  io.to(`user:${String(userId)}`).emit(event, data);
};

const isUserOnline = (userId) => userSockets.has(String(userId));

// userId (string) → orgId — track which org each connected user belongs to
const userOrgMap = new Map();

// orgId → Set<userId> — O(1) lookup for online users per org (avoids full Map scan)
const orgOnlineUsers = new Map();

// ─── Per-socket rate limiter (sliding window, no external dependency) ─────────
// Returns a function: () => boolean (true = allowed, false = rate-limited)
const createRateLimiter = (maxPerWindow, windowMs) => {
  const timestamps = [];
  return () => {
    const now = Date.now();
    // Remove expired timestamps
    while (timestamps.length && timestamps[0] <= now - windowMs) timestamps.shift();
    if (timestamps.length >= maxPerWindow) return false;
    timestamps.push(now);
    return true;
  };
};

// ─── Active thread tracking (for delivery status) ────────────────────────────
// socketId (string) → threadId that socket has open (e.g. "dm-5", "group-3")
// Tracked per-socket so multi-tab users don't overwrite each other's active thread
const socketActiveThread = new Map();

const setUserActiveThread = (userId, threadId, socketId) => {
  if (threadId && socketId) {
    socketActiveThread.set(String(socketId), { userId: String(userId), threadId: String(threadId) });
  } else if (socketId) {
    socketActiveThread.delete(String(socketId));
  }
};

// Returns the active thread if ANY of the user's sockets has it open
const getUserActiveThread = (userId) => {
  const uid = String(userId);
  const sockets = userSockets.get(uid);
  if (!sockets || !sockets.size) return null;
  for (const sid of sockets) {
    const entry = socketActiveThread.get(sid);
    if (entry && entry.threadId) return entry.threadId;
  }
  return null;
};

// ─── Parse cookies from raw header ────────────────────────────────────────────
const parseCookies = (raw) => {
  const map = {};
  if (!raw) return map;
  for (const pair of raw.split(';')) {
    const idx = pair.indexOf('=');
    if (idx < 1) continue;
    map[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return map;
};

// ─── JWT auth middleware ──────────────────────────────────────────────────────
const authenticateSocket = (socket, next) => {
  // Collect all possible token sources (auth.token, Authorization header, access_token cookie).
  // On reconnection the client may send a stale auth.token while the browser cookie
  // has already been refreshed by a REST /auth/refresh call.  Try ALL sources and
  // use the first one that passes jwt.verify so a fresh cookie can rescue an expired
  // explicit token.
  const cookies = parseCookies(socket.handshake.headers?.cookie);
  const candidates = [
    socket.handshake.auth?.token || '',
    (socket.handshake.headers?.authorization || '').replace('Bearer ', ''),
    cookies.access_token || '',
  ].filter(Boolean);

  // De-duplicate (auth.token and cookie may carry the same value)
  const uniqueTokens = [...new Set(candidates)];

  if (uniqueTokens.length === 0) {
    console.warn('[socket] auth: no token found (auth/header/cookie all empty)');
    return next(new Error('Authentication required'));
  }

  for (const token of uniqueTokens) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = payload;
      return next();
    } catch {
      // This token failed — try the next one
    }
  }

  // None of the tokens were valid
  console.warn('[socket] auth: all token sources failed for socket', socket.id);
  next(new Error('Invalid token'));
};

// ─── Init ─────────────────────────────────────────────────────────────────────
const initSocket = (httpServer) => {
  const allowedOrigins = String(
    process.env.CORS_ORIGIN || process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
  ).split(',').map((s) => s.trim()).filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        if (process.env.NODE_ENV !== 'production' &&
          /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) {
          return cb(null, true);
        }
        cb(new Error('CORS'));
      },
      credentials: true,
    },
    // Allow both transports — polling handshake then upgrade to websocket
    transports: ['polling', 'websocket'],
    allowUpgrades: true,
    // Tuned for 50K+ concurrent connections
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1e6,       // 1 MB max message
    perMessageDeflate: false,     // disable compression for lower CPU at scale
    httpCompression: false,
    connectTimeout: 10000,
  });

  io.use(authenticateSocket);
  io.on('connection', onConnection);

  console.log('[socket] Socket.IO initialized');

  // ─── Cache cleanup (every 5 min) — prevent unbounded memory growth ────
  const _cacheCleanupInterval = setInterval(() => {
    const now = Date.now();
    // Clean _orgControlsCache (5 min TTL)
    for (const [k, v] of _orgControlsCache) {
      if (now - v.ts > CONTROL_CACHE_TTL) _orgControlsCache.delete(k);
    }
    // Clean _muteCache (2 min TTL)
    for (const [k, v] of _muteCache) {
      if (now - v.ts > MUTE_CACHE_TTL) _muteCache.delete(k);
    }
    // Clean _dndCache (1 min TTL)
    for (const [k, v] of _dndCache) {
      if (now - v.ts > DND_CACHE_TTL) _dndCache.delete(k);
    }
    // Clean _groupMembersCache (30s TTL)
    for (const [k, v] of _groupMembersCache) {
      if (now - v.ts > 30_000) _groupMembersCache.delete(k);
    }
  }, 5 * 60_000);

  // ─── Scheduled Messages Scheduler (every 30s) ──────────────────────────
  const _schedulerInterval = setInterval(async () => {
    try {
      const dueMessages = await scheduledMessageModel.getDueMessages();
      for (const sm of dueMessages) {
        try {
          const { id, user_id: sUserId, organization_id: sOrgId, thread_id: sThreadId, message: sMsg, message_type: sMsgType, metadata: sMeta } = sm;
          if (sThreadId.startsWith('dm-')) {
            const receiverId = Number(sThreadId.replace('dm-', ''));
            const saved = await chatModel.sendDMMessage({
              orgId: sOrgId, senderId: Number(sUserId), receiverId,
              message: sMsg, messageType: sMsgType || 'text', metadata: { ...(sMeta || {}), scheduled: true },
            });
            if (saved) {
              // Apply disappearing timer if set for this thread
              const disappearTimer = await disappearingModel.getTimer(sThreadId, sOrgId).catch(() => null);
              if (disappearTimer) {
                const expiresAt = new Date(Date.now() + disappearTimer.duration_seconds * 1000);
                await db.query('UPDATE messages SET expires_at = $1 WHERE message_id = $2', [expiresAt, saved.message_id]);
                saved.expires_at = expiresAt;
              }
              const normalized = normalizeDMMessage(saved, Number(sUserId));
              const senderThreadId = `dm-${receiverId}`;
              emitToUser(String(sUserId), 'message:new', { threadId: senderThreadId, message: { ...normalized, direction: 'outgoing' } });
              const receiverThread = getUserActiveThread(String(receiverId));
              const receiverOnline = isUserOnline(String(receiverId));
              await deliverDMToReceiver({
                receiverId, userId: String(sUserId), orgId: sOrgId, normalized, senderThreadId,
                receiverThread, receiverOnline, senderName: 'Scheduled Message', messageType: sMsgType || 'text', message: sMsg,
              });
            }
          } else if (sThreadId.startsWith('group-')) {
            const groupId = Number(sThreadId.replace('group-', ''));
            const saved = await chatModel.sendGroupMessage({
              orgId: sOrgId, senderId: Number(sUserId), groupId,
              message: sMsg, messageType: sMsgType || 'text', metadata: { ...(sMeta || {}), scheduled: true },
            });
            if (saved) {
              // Apply disappearing timer if set for this thread
              const disappearTimerG = await disappearingModel.getTimer(sThreadId, sOrgId).catch(() => null);
              if (disappearTimerG) {
                const expiresAt = new Date(Date.now() + disappearTimerG.duration_seconds * 1000);
                await db.query('UPDATE group_messages SET expires_at = $1 WHERE message_id = $2', [expiresAt, saved.message_id]);
                saved.expires_at = expiresAt;
              }
              const normalized = normalizeGroupMessage(saved, Number(sUserId));
              emitToUser(String(sUserId), 'message:new', { threadId: sThreadId, message: { ...normalized, direction: 'outgoing' } });
              await deliverGroupToMembers({
                groupId, orgId: sOrgId, userId: String(sUserId), normalized,
                senderName: 'Scheduled Message', messageType: sMsgType || 'text', message: sMsg, threadId: sThreadId,
              });
            }
          }
          await scheduledMessageModel.markSent(id);
          emitToUser(String(sUserId), 'scheduled:sent', { id, threadId: sThreadId });
        } catch (err) {
          console.error('[scheduler] failed to send scheduled message', sm.id, err.message);
        }
      }
    } catch (err) {
      console.error('[scheduler] scheduled messages check error:', err.message);
    }
  }, 30_000);

  // ─── Disappearing Messages Cleanup (every 60s) ─────────────────────────
  const _disappearingInterval = setInterval(async () => {
    try {
      const result = await disappearingModel.cleanupExpiredMessages();
      if (result.dmDeleted || result.groupDeleted) {
        console.log(`[scheduler] cleaned up ${result.dmDeleted} DM + ${result.groupDeleted} group expired messages`);
      }
    } catch (err) {
      console.error('[scheduler] disappearing messages cleanup error:', err.message);
    }
  }, 60_000);

  // ─── Mute Expiry Cleanup (every 5 min) ─────────────────────────────────
  const _muteCleanupInterval = setInterval(async () => {
    try { await threadMuteModel.cleanupExpired(); } catch {}
  }, 5 * 60_000);

  // Graceful shutdown — clear all intervals
  const cleanupIntervals = () => {
    clearInterval(_cacheCleanupInterval);
    clearInterval(_schedulerInterval);
    clearInterval(_disappearingInterval);
    clearInterval(_muteCleanupInterval);
  };
  process.on('SIGTERM', cleanupIntervals);
  process.on('SIGINT', cleanupIntervals);

  return io;
};

// ─── Connection handler ───────────────────────────────────────────────────────
// ─── Resolve user's latest device geo data ────────────────────────────────────
const formatDeviceType = (type) => {
  if (!type || type === 'other') return 'Browser';
  const map = { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet', web: 'Browser' };
  return map[type.toLowerCase()] || type;
};

const loadUserGeo = async (userId) => {
  try {
    const { rows } = await db.query(
      `SELECT city, country, device_type, os_name
       FROM user_devices WHERE user_id = $1 AND status = 'active'
       ORDER BY last_active_at DESC NULLS LAST LIMIT 1`,
      [userId]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      city: r.city || null,
      country: r.country || null,
      device: formatDeviceType(r.device_type),
      platform: r.os_name || 'Web',
    };
  } catch { return null; }
};

// Batch version — 1 query for multiple users instead of N queries
const loadUserGeoBatch = async (userIds) => {
  if (!userIds?.length) return new Map();
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT ON (user_id) user_id, city, country, device_type, os_name
       FROM user_devices WHERE user_id = ANY($1) AND status = 'active'
       ORDER BY user_id, last_active_at DESC NULLS LAST`,
      [userIds.map(Number)]
    );
    const map = new Map();
    for (const r of rows) {
      map.set(Number(r.user_id), {
        city: r.city || null,
        country: r.country || null,
        device: formatDeviceType(r.device_type),
        platform: r.os_name || 'Web',
      });
    }
    return map;
  } catch { return new Map(); }
};

// ─── Reusable helpers (eliminate duplicate logic across send/forward/edit) ────

/** Build sentFrom geo object from socket's cached device data */
const buildSentFrom = (socket) => {
  const geo = socket.geo || {};
  return (geo.city || geo.country)
    ? { city: geo.city, country: geo.country, device: geo.device || 'Web' }
    : null;
};

/** Format geo into "City, Country" string */
const formatLocation = (geo) => {
  if (!geo) return null;
  if (geo.city && geo.country) return `${geo.city}, ${geo.country}`;
  return geo.country || geo.city || null;
};

/**
 * Resolve DM delivery status + run side effects (DB update, ack emit).
 * Returns 'sent' | 'delivered' | 'read'.
 */
const resolveDMDelivery = ({ saved, receiverId, userId, orgId, threadId }) => {
  const receiverOnline = isUserOnline(String(receiverId));
  const receiverThread = getUserActiveThread(String(receiverId));
  const senderThreadId = `dm-${userId}`;

  if (!receiverOnline) return { status: 'sent', receiverOnline, receiverThread, senderThreadId };

  if (receiverThread === senderThreadId) {
    chatModel.markDMMessagesRead(orgId, receiverId, Number(userId)).catch(err => console.error('[socket] markDMMessagesRead error:', err.message));
    db.query(
      `UPDATE messages SET delivered_at = NOW() WHERE message_id = $1 AND delivered_at IS NULL`,
      [saved.message_id]
    ).catch(err => console.error('[socket] delivered_at update error:', err.message));
    emitToUser(userId, 'message:read_ack', {
      threadId, readBy: String(receiverId),
      readAt: new Date().toISOString(),
    });
    return { status: 'read', receiverOnline, receiverThread, senderThreadId };
  }

  db.query(
    `UPDATE messages SET delivered_at = NOW() WHERE message_id = $1 AND delivered_at IS NULL`,
    [saved.message_id]
  ).catch(err => console.error('[socket] delivered_at update error:', err.message));
  emitToUser(userId, 'message:delivered_ack', {
    threadId,
    deliveredBy: String(receiverId),
    deliveredAt: new Date().toISOString(),
    messageIds: [String(saved.message_id)],
  });
  return { status: 'delivered', receiverOnline, receiverThread, senderThreadId };
};

/** Deliver DM to receiver: message:new + thread:update + notification */
const deliverDMToReceiver = async ({ receiverId, userId, orgId, normalized, senderThreadId, receiverThread, receiverOnline, senderName, messageType, message }) => {
  emitToUser(String(receiverId), 'message:new', {
    threadId: senderThreadId,
    message: { ...normalized, direction: 'incoming' },
  });

  if (receiverThread !== senderThreadId) {
    const unreadResult = await db.query(
      `SELECT COUNT(*) AS cnt FROM messages
       WHERE organization_id = $1 AND sender_id = $2 AND receiver_id = $3
         AND read_time IS NULL AND message IS NOT NULL`,
      [orgId, Number(userId), receiverId]
    ).catch(() => ({ rows: [{ cnt: 0 }] }));
    emitToUser(String(receiverId), 'thread:update', {
      threadId: senderThreadId,
      unreadCount: Number(unreadResult.rows[0]?.cnt || 0),
      readStatus: 'unread',
    });

    const isDND = await isUserDND(receiverId);
    const isMuted = isDND ? true : await isThreadMuted(receiverId, orgId, senderThreadId);
    if (!isMuted) {
      const payload = {
        type: 'message',
        title: senderName || 'New message',
        body: messageType === 'text' ? message : `Sent a ${messageType}`,
        threadId: senderThreadId,
        senderId: userId,
        senderName,
        url: `/app?thread=${encodeURIComponent(senderThreadId)}`,
      };
      if (receiverOnline) {
        emitToUser(String(receiverId), 'notification', payload);
      }
      pushToUser(receiverId, payload);
    }
  } else {
    // Thread is open — ensure unread badge stays at 0
    emitToUser(String(receiverId), 'thread:update', {
      threadId: senderThreadId,
      unreadCount: 0,
      readStatus: 'read',
    });
  }
};

/** Deliver group message to all members: message:new + batch unread + notification */
const deliverGroupToMembers = async ({ groupId, orgId, userId, normalized, senderName, messageType, message, threadId }) => {
  const members = await getGroupMemberIds(groupId);
  const otherMemberIds = members.filter((m) => String(m) !== userId);

  // Batch unread counts in 1 query
  const unreadMap = new Map();
  if (otherMemberIds.length) {
    const { rows: unreadRows } = await db.query(
      `SELECT gmr.user_id, COUNT(*) AS cnt
       FROM group_message_recipients gmr
       JOIN group_messages gm ON gm.group_message_id = gmr.group_message_id
       WHERE gm.organization_id = $1 AND gm.group_id = $2
         AND gmr.user_id = ANY($3) AND gmr.delivery_status != 'read'
       GROUP BY gmr.user_id`,
      [orgId, groupId, otherMemberIds]
    ).catch(() => ({ rows: [] }));
    for (const r of unreadRows) unreadMap.set(Number(r.user_id), Number(r.cnt));
  }

  for (const memberId of otherMemberIds) {
    emitToUser(String(memberId), 'message:new', {
      threadId,
      message: { ...normalized, direction: 'incoming' },
    });
    const memberThread = getUserActiveThread(String(memberId));
    if (memberThread !== threadId) {
      emitToUser(String(memberId), 'thread:update', {
        threadId,
        unreadCount: unreadMap.get(Number(memberId)) || 0,
        readStatus: 'unread',
      });
    } else {
      // Thread is open — ensure unread badge stays at 0
      emitToUser(String(memberId), 'thread:update', {
        threadId,
        unreadCount: 0,
        readStatus: 'read',
      });
    }
    if (isUserOnline(String(memberId)) && memberThread !== threadId) {
      const isDND = await isUserDND(memberId);
      const isMuted = isDND ? true : await isThreadMuted(memberId, orgId, threadId);
      if (!isMuted) {
        emitToUser(String(memberId), 'notification', {
          type: 'message',
          title: 'Group message',
          body: `${senderName}: ${messageType === 'text' ? message : `Sent a ${messageType}`}`,
          threadId,
          senderId: userId,
          senderName,
        });
      }
    }
  }
};

/** Build edit payload shape that frontend expects */
const buildEditPayload = (normalized, newText) => {
  const editText = normalized.content?.text || newText;
  return {
    ...normalized,
    message: editText,
    text: editText,
    preview: editText,
    body: editText,
    content: { text: editText, isEmojiOnly: false, emojiCount: 0 },
    metadata: {
      ...(normalized.metadata || {}),
      editedAt: normalized.editedAt || new Date().toISOString(),
    },
    __normalized: false,
    __renderCache: null,
  };
};

/** Check org control for a feature (edit/delete/recall) with time limit */
const checkFeatureAllowed = async (orgId, featureKey, messageId, threadId) => {
  const ctrl = await getOrgControl(orgId, featureKey);
  if (ctrl && !ctrl.enabled) return { allowed: false, reason: `${featureKey} is disabled for this organization` };
  if (ctrl && ctrl.time_limit_minutes) {
    const msgTime = await getMessageCreatedAt(messageId, threadId);
    if (msgTime) {
      const diffMinutes = (Date.now() - new Date(msgTime).getTime()) / 60000;
      if (diffMinutes > ctrl.time_limit_minutes) {
        return { allowed: false, reason: `${featureKey[0].toUpperCase() + featureKey.slice(1)} time limit exceeded (${ctrl.time_limit_minutes} min)` };
      }
    }
  }
  return { allowed: true };
};

const onConnection = (socket) => {
  const userId = String(socket.user.sub);
  const orgId = socket.user.org;
  const isGuest = !!socket.user.guest;

  // Per-socket rate limiters (protect DB from spam)
  const rl = {
    send:    createRateLimiter(30, 10_000),   // 30 messages per 10s
    edit:    createRateLimiter(10, 10_000),   // 10 edits per 10s
    react:   createRateLimiter(20, 10_000),   // 20 reactions per 10s
    typing:  createRateLimiter(5, 3_000),     // 5 typing events per 3s
    read:    createRateLimiter(10, 5_000),    // 10 read marks per 5s
    focus:   createRateLimiter(10, 5_000),    // 10 focus switches per 5s
    info:    createRateLimiter(5, 5_000),     // 5 info requests per 5s
    pin:     createRateLimiter(5, 10_000),    // 5 pin/unpin per 10s
    recall:  createRateLimiter(5, 10_000),    // 5 recalls per 10s
    del:     createRateLimiter(10, 10_000),   // 10 deletes per 10s
    forward: createRateLimiter(10, 10_000),   // 10 forwards per 10s
    call:        createRateLimiter(10, 10_000), // 10 call actions per 10s
    screenshare: createRateLimiter(10, 10_000), // 10 screenshare actions per 10s
    signal:      createRateLimiter(50, 10_000), // 50 WebRTC signaling msgs per 10s
    annotate:    createRateLimiter(60, 1_000),  // 60 annotation strokes per 1s
    mute:        createRateLimiter(10, 10_000), // 10 mute/unmute per 10s
    dnd:         createRateLimiter(5, 10_000),  // 5 DND toggles per 10s
    schedule:    createRateLimiter(10, 10_000), // 10 scheduled msgs per 10s
    disappear:   createRateLimiter(5, 10_000),  // 5 disappear toggles per 10s
    broadcast:   createRateLimiter(2, 60_000),  // 2 broadcasts per minute
  };

  // Guests skip DB sync — they only need meeting:* handlers
  if (!isGuest) {
    // Preload organization controls into cache on connect (non-blocking)
    if (orgId) preloadOrgControls(orgId).catch(err => console.error('[socket] preloadOrgControls error:', err.message));

    // Sync muted threads to client on connect
    if (orgId) {
      threadMuteModel.getMutedThreads(Number(userId), orgId)
        .then((mutes) => { if (mutes.length) emitToUser(userId, 'thread:mute_sync', mutes); })
        .catch(err => console.error('[socket] mute sync error:', err.message));

      // Sync pinned threads on connect
      threadPinModel.getPinsForUser(Number(userId), orgId)
        .then((pins) => { emitToUser(userId, 'thread:pin_sync', pins); })
        .catch(err => console.error('[socket] pin sync error:', err.message));
    }

    // Sync DND state to client on connect
    userSettingsModel.getSetting(Number(userId), 'dnd')
      .then((dnd) => { if (dnd) emitToUser(userId, 'dnd:state', dnd); })
      .catch(err => console.error('[socket] DND sync error:', err.message));

    // Cache user's device geo data for message metadata (non-blocking)
    loadUserGeo(Number(userId)).then((geo) => { socket.geo = geo || {}; }).catch(() => { socket.geo = {}; });
  } else {
    socket.geo = {};
  }

  const wasAlreadyOnline = isUserOnline(userId);

  if (!isGuest) {
    addUserSocket(userId, socket.id);
    if (orgId) {
      userOrgMap.set(userId, orgId);
      if (!orgOnlineUsers.has(orgId)) orgOnlineUsers.set(orgId, new Set());
      orgOnlineUsers.get(orgId).add(userId);
    }
  }

  // Join personal + org rooms (rooms are the most efficient way to broadcast)
  if (!isGuest) {
    socket.join(`user:${userId}`);
    if (orgId) socket.join(`org:${orgId}`);
  }

  console.log(`[socket] connected user=${userId} sid=${socket.id} tabs=${userSockets.get(userId)?.size}`);

  // Broadcast online to org — only on FIRST tab (not duplicate per tab)
  // Respects organization 'indicators' control
  if (!isGuest && !wasAlreadyOnline && orgId) {
    getOrgControl(orgId, 'indicators').then((ctrl) => {
      if (!ctrl || ctrl.enabled) {
        socket.to(`org:${orgId}`).emit('user:online', { userId, status: 'Online' });
      }
    }).catch(() => {
      socket.to(`org:${orgId}`).emit('user:online', { userId, status: 'Online' });
    });
  }

  // Tell new user who's already online (same org only) — O(1) via orgOnlineUsers Set
  if (!isGuest && orgId) {
    const orgSet = orgOnlineUsers.get(orgId);
    if (orgSet && orgSet.size > 1) {
      const onlineUsers = [];
      for (const uid of orgSet) {
        if (uid !== userId) onlineUsers.push(uid);
      }
      socket.emit('users:online_list', { users: onlineUsers });
    }

    // ── Heavy DB queries only on FIRST tab connect (skip for multi-tab reconnect) ──
    if (!wasAlreadyOnline) {
      // Sync DM unread counts (skip self-chat — Myself thread is managed by frontend)
      db.query(
        `SELECT sender_id, COUNT(*) AS cnt FROM messages
         WHERE organization_id = $1 AND receiver_id = $2 AND sender_id != $2 AND read_time IS NULL AND message IS NOT NULL
         GROUP BY sender_id`,
        [orgId, Number(userId)]
      ).then(({ rows }) => {
        for (const r of rows) {
          socket.emit('thread:update', {
            threadId: `dm-${r.sender_id}`,
            unreadCount: Number(r.cnt),
            readStatus: Number(r.cnt) > 0 ? 'unread' : 'read',
          });
        }
      }).catch(err => console.error('[socket] background task error:', err.message));

      // Sync group unread counts
      db.query(
        `SELECT gm.group_id, COUNT(*) AS cnt
         FROM group_message_recipients gmr
         JOIN group_messages gm ON gm.group_message_id = gmr.group_message_id
         WHERE gm.organization_id = $1 AND gmr.user_id = $2 AND gmr.delivery_status != 'read'
         GROUP BY gm.group_id`,
        [orgId, Number(userId)]
      ).then(({ rows }) => {
        for (const r of rows) {
          socket.emit('thread:update', {
            threadId: `group-${r.group_id}`,
            unreadCount: Number(r.cnt),
            readStatus: Number(r.cnt) > 0 ? 'unread' : 'read',
          });
        }
      }).catch(err => console.error('[socket] background task error:', err.message));
    }

    // ─── Deliver undelivered messages when user comes online (first tab only) ──
    if (!wasAlreadyOnline) {
    // Mark all undelivered DMs as delivered and notify each sender (double tick)
    db.query(
      `UPDATE messages
       SET delivered_at = NOW()
       WHERE organization_id = $1 AND receiver_id = $2
         AND delivered_at IS NULL AND read_time IS NULL AND message IS NOT NULL
       RETURNING message_id, sender_id`,
      [orgId, Number(userId)]
    ).then(({ rows }) => {
      if (!rows.length) return;
      // Group by sender to send one ack per sender
      const senderMap = new Map();
      for (const r of rows) {
        if (!senderMap.has(String(r.sender_id))) senderMap.set(String(r.sender_id), []);
        senderMap.get(String(r.sender_id)).push(String(r.message_id));
      }
      const deliveredAt = new Date().toISOString();
      for (const [senderId, messageIds] of senderMap) {
        emitToUser(senderId, 'message:delivered_ack', {
          threadId: `dm-${userId}`,
          deliveredBy: userId,
          deliveredAt,
          messageIds,
        });
      }
    }).catch(err => console.error('[socket] background task error:', err.message));
    }
  }

  // ─── Auth: allow client to update token mid-session (e.g. after REST refresh) ─
  socket.on('auth:refresh_token', (data, ack) => {
    const newToken = data?.token;
    if (!newToken) return ack?.({ error: 'token required' });
    try {
      const payload = jwt.verify(newToken, process.env.JWT_SECRET);
      socket.user = payload;
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: 'Invalid token' });
    }
  });

  // ─── Send Message ─────────────────────────────────────────────────────────
  socket.on('message:send', async (data, ack) => {
    if (!rl.send()) return ack?.({ error: 'Rate limited' });
    try {
      const { threadId, message, message_type = 'text', metadata: rawMeta = null } = data;
      console.log(`[socket] message:send received threadId=${threadId} userId=${userId} type=${message_type}`);

      // Validate threadId format
      if (!threadId || !/^(dm|group)-\d+$/.test(threadId)) {
        return ack?.({ error: 'Invalid threadId format' });
      }
      // Validate message
      if (!message && message_type === 'text') {
        return ack?.({ error: 'message and threadId required' });
      }
      // Message size limit — 5000 chars max
      if (typeof message === 'string' && message.length > 5000) {
        return ack?.({ error: 'Message too long (max 5000 characters)' });
      }
      // XSS sanitization
      const sanitizedMessage = sanitizeText(message);
      // Inject sender geo location into metadata
      const sentFrom = buildSentFrom(socket);
      const metadata = sentFrom ? { ...(rawMeta || {}), sentFrom } : rawMeta;

      // Check disappearing timer for this thread
      const disappearTimer = await disappearingModel.getTimer(threadId, orgId).catch(() => null);

      if (threadId.startsWith('dm-')) {
        const receiverId = Number(threadId.replace('dm-', ''));
        const isSelfChat = receiverId === Number(userId);
        const saved = await chatModel.sendDMMessage({
          orgId, senderId: Number(userId), receiverId,
          message: sanitizedMessage, messageType: message_type, metadata,
        });

        // Set expires_at if disappearing messages is enabled
        if (saved && disappearTimer) {
          const expiresAt = new Date(Date.now() + disappearTimer.duration_seconds * 1000);
          await db.query('UPDATE messages SET expires_at = $1 WHERE message_id = $2', [expiresAt, saved.message_id]).catch(() => {});
          saved.expires_at = expiresAt;
        }

        await signProfileFields(saved);
        const normalized = normalizeDMMessage(saved, Number(userId));
        await signMessageFileUrls(normalized);

        if (isSelfChat) {
          // Self-chat: mark as read immediately, no delivery to "other" user needed
          console.log(`[socket] self-chat message saved: user=${userId} message_id=${saved?.message_id} threadId=${threadId}`);
          chatModel.markDMMessagesRead(orgId, Number(userId), Number(userId)).catch(err => console.error('[socket] background task error:', err.message));
          ack?.({ ok: true, message: { ...normalized, status: 'read' } });
        } else {
          const delivery = resolveDMDelivery({ saved, receiverId, userId, orgId, threadId });
          await deliverDMToReceiver({
            receiverId, userId, orgId, normalized,
            senderThreadId: delivery.senderThreadId,
            receiverThread: delivery.receiverThread,
            receiverOnline: delivery.receiverOnline,
            senderName: socket.user.name,
            messageType: message_type, message,
          });

          ack?.({ ok: true, message: { ...normalized, status: delivery.status } });
        }

      } else if (threadId.startsWith('group-')) {
        const groupId = Number(threadId.replace('group-', ''));
        const saved = await chatModel.sendGroupMessage({
          orgId, groupId, senderId: Number(userId),
          message: sanitizedMessage, messageType: message_type, metadata,
        });

        // Set expires_at if disappearing messages is enabled
        if (saved && disappearTimer) {
          const expiresAt = new Date(Date.now() + disappearTimer.duration_seconds * 1000);
          await db.query('UPDATE group_messages SET expires_at = $1 WHERE group_message_id = $2', [expiresAt, saved.group_message_id]).catch(() => {});
          saved.expires_at = expiresAt;
        }

        await signProfileFields(saved);
        const normalized = normalizeGroupMessage(saved, Number(userId));
        await signMessageFileUrls(normalized);

        // Poll insertion now happens inside sendGroupMessage transaction (chatModel.js)

        await deliverGroupToMembers({
          groupId, orgId, userId, normalized,
          senderName: socket.user.name,
          messageType: message_type, message, threadId,
        });

        ack?.({ ok: true, message: normalized });
      }
    } catch (err) {
      console.error('[socket] message:send error', err.message);
      ack?.({ error: err.message });
    }
  });

  // ─── Edit Message (sender only) ───────────────────────────────────────────
  socket.on('message:edit', async (data, ack) => {
    if (!rl.edit()) return ack?.({ error: 'Rate limited' });
    try {
      const { messageId, threadId, newText } = data;
      if (!messageId || !newText) return ack?.({ error: 'messageId and newText required' });

      const editCheck = await checkFeatureAllowed(orgId, 'edit', messageId, threadId);
      if (!editCheck.allowed) return ack?.({ error: editCheck.reason });

      if (threadId?.startsWith('dm-')) {
        const updated = await chatModel.editDMMessage(messageId, orgId, Number(userId), newText);
        if (!updated) return ack?.({ error: 'Not found or no permission' });
        await signProfileFields(updated);
        const normalized = normalizeDMMessage(updated, Number(userId));
        await signMessageFileUrls(normalized);
        console.log(`[socket] message:edit DM id=${messageId}`);

        const receiverId = String(
          updated.receiver_id === Number(userId) ? updated.sender_id : updated.receiver_id
        );
        const editPayload = buildEditPayload(normalized, newText);
        emitToUser(receiverId, 'message:edited', {
          threadId: `dm-${userId}`,
          message: { ...editPayload, direction: 'incoming' },
        });
        emitToUser(userId, 'message:edited', {
          threadId,
          message: { ...editPayload, direction: 'outgoing' },
        });
        const recvThread = getUserActiveThread(receiverId);
        if (isUserOnline(receiverId) && recvThread !== `dm-${userId}`) {
          emitToUser(receiverId, 'notification', {
            type: 'edit', title: 'Message edited',
            body: `${socket.user.name} edited a message`,
            threadId: `dm-${userId}`, senderId: userId,
          });
        }
        ack?.({ ok: true, message: normalized });

      } else if (threadId?.startsWith('group-')) {
        const groupId = Number(threadId.replace('group-', ''));
        const updated = await editGroupMessage(messageId, orgId, groupId, Number(userId), newText);
        if (!updated) return ack?.({ error: 'Not found or no permission' });
        const normalized = normalizeGroupMessage(updated, Number(userId));
        await signMessageFileUrls(normalized);
        const grpEditPayload = buildEditPayload(normalized, newText);
        const members = await getGroupMemberIds(groupId);
        for (const memberId of members) {
          const dir = String(memberId) === userId ? 'outgoing' : 'incoming';
          emitToUser(String(memberId), 'message:edited', {
            threadId,
            message: { ...grpEditPayload, direction: dir },
          });
          if (String(memberId) !== userId) {
            const editMemberThread = getUserActiveThread(String(memberId));
            if (isUserOnline(String(memberId)) && editMemberThread !== threadId) {
              emitToUser(String(memberId), 'notification', {
                type: 'edit', title: 'Message edited',
                body: `${socket.user.name} edited a message`,
                threadId, senderId: userId, senderName: socket.user.name,
              });
            }
          }
        }
        ack?.({ ok: true });
      }
    } catch (err) {
      console.error('[socket] message:edit error', err.message);
      ack?.({ error: err.message });
    }
  });

  // ─── Delete Message (sender side only) ────────────────────────────────────
  socket.on('message:delete', async (data, ack) => {
    if (!rl.del()) return ack?.({ error: 'Rate limited' });
    try {
      const { messageId, threadId } = data;
      if (!messageId) return ack?.({ error: 'messageId required' });

      const delCheck = await checkFeatureAllowed(orgId, 'delete', messageId, threadId);
      if (!delCheck.allowed) return ack?.({ error: delCheck.reason });

      if (threadId?.startsWith('dm-')) {
        const deleted = await chatModel.deleteDMMessage(messageId, orgId, Number(userId));
        if (!deleted) return ack?.({ error: 'Not found or no permission' });
        // Log delete action in message_actions
        logMessageAction(messageId, threadId, Number(userId), 'delete', 1).catch(err => console.error('[socket] background task error:', err.message));
        emitToUser(userId, 'message:deleted', { threadId, messageId: String(messageId) });
        ack?.({ ok: true });

      } else if (threadId?.startsWith('group-')) {
        const groupId = Number(threadId.replace('group-', ''));
        const deleted = await chatModel.deleteGroupMessage(messageId, orgId, groupId, Number(userId));
        if (!deleted) return ack?.({ error: 'Not found or no permission' });
        logMessageAction(messageId, threadId, Number(userId), 'delete', 1).catch(err => console.error('[socket] background task error:', err.message));
        emitToUser(userId, 'message:deleted', { threadId, messageId: String(messageId) });
        ack?.({ ok: true });
      }
    } catch (err) {
      console.error('[socket] message:delete error', err.message);
      ack?.({ error: err.message });
    }
  });

  // ─── Pin / Unpin Message ───────────────────────────────────────────────────
  socket.on('message:pin', async (data, ack) => {
    if (!rl.pin()) return ack?.({ error: 'Rate limited' });
    try {
      const { messageId, threadId, pinned } = data;
      if (!messageId || !threadId) return ack?.({ error: 'messageId and threadId required' });

      // Per-user pin: only store in message_actions, no global metadata change
      const isGroup = threadId.startsWith('group-');
      const table = isGroup ? 'group_message_actions' : 'message_actions';
      const idCol = isGroup ? 'group_message_id' : 'message_id';

      if (pinned) {
        // Pin: insert action (ignore if already exists)
        await db.query(
          `INSERT INTO ${table} (${idCol}, user_id, action_type)
           VALUES ($1, $2, 'pin')
           ON CONFLICT DO NOTHING`,
          [messageId, Number(userId)]
        );
      } else {
        // Unpin: remove the pin action for this user
        await db.query(
          `DELETE FROM ${table}
           WHERE ${idCol} = $1 AND user_id = $2 AND action_type = 'pin'`,
          [messageId, Number(userId)]
        );
      }

      // Only notify the user who pinned/unpinned (per-user pin)
      emitToUser(userId, 'message:pinned', {
        threadId, messageId: String(messageId), pinned: !!pinned, pinnedBy: userId,
      });
      ack?.({ ok: true });
    } catch (err) {
      console.error('[socket] message:pin error', err.message);
      ack?.({ error: err.message });
    }
  });

  // ─── Recall / Unsend (both sides) ─────────────────────────────────────────
  socket.on('message:recall', async (data, ack) => {
    if (!rl.recall()) return ack?.({ error: 'Rate limited' });
    try {
      const { messageId, threadId } = data;
      if (!messageId) return ack?.({ error: 'messageId required' });

      const recallCheck = await checkFeatureAllowed(orgId, 'recall', messageId, threadId);
      if (!recallCheck.allowed) return ack?.({ error: recallCheck.reason });

      if (threadId?.startsWith('dm-')) {
        const recalled = await recallDMMessage(messageId, orgId, Number(userId));
        if (!recalled) return ack?.({ error: 'Not found or no permission' });
        const receiverId = String(
          Number(recalled.receiver_id) === Number(userId) ? recalled.sender_id : recalled.receiver_id
        );
        console.log(`[socket] recall DM: sender=${userId} receiver=${receiverId} msgId=${messageId}`);
        const receiverThreadId = `dm-${userId}`;
        // Sender: delete from their view (same as performMessageRemoval does locally)
        emitToUser(userId, 'message:deleted', { threadId, messageId: String(messageId) });
        // Receiver: delete from their view
        emitToUser(receiverId, 'message:deleted', {
          threadId: receiverThreadId, messageId: String(messageId),
        });
        console.log(`[socket] recall emitted delete to both: sender threadId=${threadId}, receiver threadId=${receiverThreadId}`);
        ack?.({ ok: true });

      } else if (threadId?.startsWith('group-')) {
        const groupId = Number(threadId.replace('group-', ''));
        const recalled = await recallGroupMessage(messageId, orgId, groupId, Number(userId));
        if (!recalled) return ack?.({ error: 'Not found or no permission' });
        const members = await getGroupMemberIds(groupId);
        console.log(`[socket] recall group: sender=${userId} groupId=${groupId} msgId=${messageId} members=${members.length}`);
        for (const memberId of members) {
          // Delete from all members' view (sender + receivers)
          emitToUser(String(memberId), 'message:deleted', {
            threadId, messageId: String(messageId),
          });
        }
        ack?.({ ok: true });
      }
    } catch (err) {
      console.error('[socket] message:recall error', err.message);
      ack?.({ error: err.message });
    }
  });

  // ─── Reaction ─────────────────────────────────────────────────────────────
  socket.on('message:react', async (data, ack) => {
    if (!rl.react()) return ack?.({ error: 'Rate limited' });
    try {
      const { messageId, threadId, emoji } = data;
      if (!messageId || !emoji) return ack?.({ error: 'messageId and emoji required' });
      const reaction = await toggleReaction(messageId, threadId, Number(userId), emoji);

      const reactionPayload = { ...reaction, userName: socket.user.name || '' };

      if (threadId?.startsWith('dm-')) {
        const otherUserId = threadId.replace('dm-', '');
        // Do NOT emit back to sender — they already applied the reaction locally
        emitToUser(otherUserId, 'message:reacted', {
          threadId: `dm-${userId}`, messageId: String(messageId), ...reactionPayload,
        });
        const otherThread = getUserActiveThread(otherUserId);
        if (isUserOnline(otherUserId) && otherThread !== `dm-${userId}`) {
          emitToUser(otherUserId, 'notification', {
            type: 'reaction', title: 'Reaction',
            body: `${socket.user.name} reacted ${emoji}`,
            threadId: `dm-${userId}`, senderId: userId,
          });
        }
      } else if (threadId?.startsWith('group-')) {
        const groupId = Number(threadId.replace('group-', ''));
        const members = await getGroupMemberIds(groupId);
        for (const memberId of members) {
          // Skip sender — they already applied the reaction locally
          if (String(memberId) === userId) continue;
          emitToUser(String(memberId), 'message:reacted', {
            threadId, messageId: String(messageId), ...reactionPayload,
          });
          const mThread = getUserActiveThread(String(memberId));
          if (isUserOnline(String(memberId)) && mThread !== threadId) {
            emitToUser(String(memberId), 'notification', {
              type: 'reaction', title: 'Reaction',
              body: `${socket.user.name} reacted ${emoji}`,
              threadId, senderId: userId,
            });
          }
        }
      }
      ack?.({ ok: true });
    } catch (err) {
      console.error('[socket] message:react error', err.message);
      ack?.({ error: err.message });
    }
  });

  // ─── Poll Vote ──────────────────────────────────────────────────────────
  socket.on('poll:vote', async (data, ack) => {
    try {
      const { messageId, threadId, optionId, pollType } = data;
      console.log('[poll:vote] userId=%s messageId=%s optionId=%s pollType=%s', userId, messageId, optionId, pollType);
      if (!messageId || !threadId || !optionId) return ack?.({ error: 'messageId, threadId, and optionId required' });

      const isGroup = threadId.startsWith('group-');
      const table = isGroup ? 'group_messages' : 'messages';
      const idCol = isGroup ? 'group_message_id' : 'message_id';

      const voterId = Number(userId);
      const voterName = socket.user.name || '';

      // Use transaction with row lock to prevent race conditions
      const client = await db.connect();
      let meta;
      try {
        await client.query('BEGIN');
        const { rows: metaRows } = await client.query(
          `SELECT message_metadata FROM ${table} WHERE ${idCol} = $1 FOR UPDATE`,
          [messageId]
        );
        if (!metaRows[0]) { await client.query('ROLLBACK'); return ack?.({ error: 'Message not found' }); }

        meta = metaRows[0].message_metadata
          ? decryptMetadata(metaRows[0].message_metadata)
          : {};

        if (!meta.options || !Array.isArray(meta.options)) { await client.query('ROLLBACK'); return ack?.({ error: 'Not a poll message' }); }

        if (meta.endedAt || (meta.endAt && new Date(meta.endAt) < new Date())) {
          await client.query('ROLLBACK');
          return ack?.({ error: 'Poll has ended' });
        }

        // Update vote in options
        meta.options = meta.options.map((opt) => {
          const voters = Array.isArray(opt.voters) ? opt.voters : [];
          const alreadyVoted = voters.some((v) => String(v.id) === String(voterId));

          if (opt.id === optionId) {
            if (alreadyVoted) {
              return {
                ...opt,
                votes: Math.max(0, (opt.votes || 0) - 1),
                voters: voters.filter((v) => String(v.id) !== String(voterId)),
              };
            }
            return {
              ...opt,
              votes: (opt.votes || 0) + 1,
              voters: [...voters, { id: voterId, name: voterName }],
            };
          }
          if (pollType === 'single' && alreadyVoted) {
            return {
              ...opt,
              votes: Math.max(0, (opt.votes || 0) - 1),
              voters: voters.filter((v) => String(v.id) !== String(voterId)),
            };
          }
          return opt;
        });

        const encMeta = encryptMetadata(meta);
        await client.query(
          `UPDATE ${table} SET message_metadata = $1::jsonb, updated_at = NOW() WHERE ${idCol} = $2`,
          [encMeta, messageId]
        );
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }

      // Also persist vote to group_poll_votes table (best effort)
      if (isGroup) {
        try {
          const { rows: pollRows } = await db.query(
            `SELECT p.poll_id, o.option_id FROM group_polls p
             JOIN group_poll_options o ON o.poll_id = p.poll_id
             WHERE p.group_message_id = $1`,
            [messageId]
          );
          if (pollRows.length > 0) {
            const pollId = pollRows[0].poll_id;
            // Match frontend optionId to DB option by finding its position in meta.options array
            const optIndex = meta.options.findIndex(opt => opt.id === optionId);
            let dbOptionId = null;
            if (optIndex >= 0) {
              // order_no in DB = index + 1 (inserted as i + 1 in sendGroupMessage)
              const { rows: optRows } = await db.query(
                `SELECT option_id FROM group_poll_options WHERE poll_id = $1 AND order_no = $2`,
                [pollId, optIndex + 1]
              );
              dbOptionId = optRows[0]?.option_id;
            }

            if (dbOptionId) {
              // Check if user has an active vote on this exact option
              const { rows: existingVote } = await db.query(
                `SELECT vote_id FROM group_poll_votes WHERE poll_id = $1 AND user_id = $2 AND option_id = $3 AND status = 'active'`,
                [pollId, voterId, dbOptionId]
              );
              if (existingVote.length > 0) {
                // Toggle off — soft delete (status = 'removed')
                await db.query(
                  `UPDATE group_poll_votes SET status = 'removed', updated_at = NOW() WHERE vote_id = $1`,
                  [existingVote[0].vote_id]
                );
                await db.query(`UPDATE group_poll_options SET vote_count = GREATEST(0, vote_count - 1) WHERE option_id = $1`, [dbOptionId]);
              } else {
                // For single poll, soft-remove old active votes first
                if (pollType === 'single') {
                  const { rows: oldVotes } = await db.query(
                    `SELECT vote_id, option_id FROM group_poll_votes WHERE poll_id = $1 AND user_id = $2 AND status = 'active'`,
                    [pollId, voterId]
                  );
                  if (oldVotes.length > 0) {
                    const oldVoteIds = oldVotes.map(v => v.vote_id);
                    const oldOptionIds = oldVotes.map(v => v.option_id);
                    await db.query(
                      `UPDATE group_poll_options SET vote_count = GREATEST(0, vote_count - 1) WHERE option_id = ANY($1::bigint[])`,
                      [oldOptionIds]
                    );
                    await db.query(
                      `UPDATE group_poll_votes SET status = 'removed', updated_at = NOW() WHERE vote_id = ANY($1::bigint[])`,
                      [oldVoteIds]
                    );
                  }
                }
                // Insert new active vote
                await db.query(
                  `INSERT INTO group_poll_votes (poll_id, option_id, user_id, status) VALUES ($1, $2, $3, 'active')`,
                  [pollId, dbOptionId, voterId]
                );
                await db.query(`UPDATE group_poll_options SET vote_count = vote_count + 1 WHERE option_id = $1`, [dbOptionId]);
                console.log('[poll:vote] vote inserted: pollId=%s optionId=%s userId=%s', pollId, dbOptionId, voterId);
              }
            }
          }
        } catch (pollVoteErr) {
          console.error('[socket] poll vote table error', pollVoteErr.message);
        }
      }

      // Emit to all participants
      const payload = { threadId, messageId: String(messageId), options: meta.options, voterId, voterName };
      if (threadId.startsWith('dm-')) {
        const otherUserId = threadId.replace('dm-', '');
        emitToUser(userId, 'poll:voted', payload);
        emitToUser(otherUserId, 'poll:voted', { ...payload, threadId: `dm-${userId}` });
      } else if (threadId.startsWith('group-')) {
        const groupId = Number(threadId.replace('group-', ''));
        const members = await getGroupMemberIds(groupId);
        for (const memberId of members) {
          emitToUser(String(memberId), 'poll:voted', payload);
        }
      }
      ack?.({ ok: true, options: meta.options });
    } catch (err) {
      console.error('[socket] poll:vote error', err.message);
      ack?.({ error: err.message });
    }
  });

  // ─── Poll End ──────────────────────────────────────────────────────────
  socket.on('poll:end', async (data, ack) => {
    try {
      const { messageId, threadId, endedAt } = data;
      if (!messageId || !threadId) return ack?.({ error: 'messageId and threadId required' });

      const isGroup = threadId.startsWith('group-');
      const table = isGroup ? 'group_messages' : 'messages';
      const idCol = isGroup ? 'group_message_id' : 'message_id';

      // Read existing metadata
      const { rows: metaRows } = await db.query(
        `SELECT message_metadata FROM ${table} WHERE ${idCol} = $1`,
        [messageId]
      );
      if (!metaRows[0]) return ack?.({ error: 'Message not found' });

      const meta = metaRows[0].message_metadata
        ? decryptMetadata(metaRows[0].message_metadata)
        : {};

      meta.endedAt = endedAt || new Date().toISOString();
      meta.endedBy = Number(userId);

      const encMeta = encryptMetadata(meta);
      await db.query(
        `UPDATE ${table} SET message_metadata = $1::jsonb, updated_at = NOW() WHERE ${idCol} = $2`,
        [encMeta, messageId]
      );

      // Also update group_polls table (best effort)
      if (isGroup) {
        try {
          await db.query(
            `UPDATE group_polls SET status = 'ended', ended_at = $1, ended_by = $2, updated_at = NOW()
             WHERE group_message_id = $3`,
            [meta.endedAt, Number(userId), messageId]
          );
        } catch (pollEndErr) {
          console.error('[socket] poll end table error', pollEndErr.message);
        }
      }

      // Emit to all participants
      const payload = { threadId, messageId: String(messageId), endedAt: meta.endedAt, endedBy: meta.endedBy };
      if (threadId.startsWith('dm-')) {
        const otherUserId = threadId.replace('dm-', '');
        emitToUser(userId, 'poll:ended', payload);
        emitToUser(otherUserId, 'poll:ended', { ...payload, threadId: `dm-${userId}` });
      } else if (threadId.startsWith('group-')) {
        const groupId = Number(threadId.replace('group-', ''));
        const members = await getGroupMemberIds(groupId);
        for (const memberId of members) {
          emitToUser(String(memberId), 'poll:ended', payload);
        }
      }
      ack?.({ ok: true });
    } catch (err) {
      console.error('[socket] poll:end error', err.message);
      ack?.({ error: err.message });
    }
  });

  // ─── Poll Edit ─────────────────────────────────────────────────────────
  socket.on('poll:edit', async (data, ack) => {
    try {
      const { messageId, threadId, poll } = data;
      if (!messageId || !threadId || !poll) return ack?.({ error: 'messageId, threadId, and poll required' });

      const isGroup = threadId.startsWith('group-');
      const table = isGroup ? 'group_messages' : 'messages';
      const idCol = isGroup ? 'group_message_id' : 'message_id';

      // Read existing metadata, merge with new poll data
      const { rows: metaRows } = await db.query(
        `SELECT message_metadata FROM ${table} WHERE ${idCol} = $1`,
        [messageId]
      );
      if (!metaRows[0]) return ack?.({ error: 'Message not found' });

      const meta = metaRows[0].message_metadata
        ? decryptMetadata(metaRows[0].message_metadata)
        : {};

      // Update poll fields
      if (poll.question !== undefined) meta.question = poll.question;
      if (poll.options) meta.options = poll.options;
      if (poll.type) meta.type = poll.type;
      if (poll.endAt !== undefined) meta.endAt = poll.endAt;
      if (poll.showResultsBeforeVote !== undefined) meta.showResultsBeforeVote = poll.showResultsBeforeVote;
      if (poll.endAccess) meta.endAccess = poll.endAccess;
      meta.editedAt = new Date().toISOString();
      meta.editedBy = Number(userId);

      const encMeta = encryptMetadata(meta);
      // Also update the message text to the poll question
      const msgText = poll.question || meta.question || '';
      const encMsg = encryptMessage(msgText);
      await db.query(
        `UPDATE ${table} SET message = $1, message_metadata = $2::jsonb, updated_at = NOW() WHERE ${idCol} = $3`,
        [encMsg, encMeta, messageId]
      );

      // Update group_polls table too
      if (isGroup) {
        try {
          const pollModel = require('../models/groupPollModel');
          const dbPoll = await pollModel.getPollByMessageId(messageId);
          if (dbPoll) {
            await pollModel.editPoll(dbPoll.poll_id, {
              question: poll.question,
              options: poll.options,
            });
          }
        } catch (pollEditErr) {
          console.error('[socket] poll edit table error', pollEditErr.message);
        }
      }

      // Build updated content for emit
      const updatedContent = { ...meta };

      // Emit to all participants
      const payload = { threadId, messageId: String(messageId), content: updatedContent };
      if (threadId.startsWith('group-')) {
        const groupId = Number(threadId.replace('group-', ''));
        const members = await getGroupMemberIds(groupId);
        for (const memberId of members) {
          emitToUser(String(memberId), 'poll:edited', payload);
        }
      } else if (threadId.startsWith('dm-')) {
        const otherUserId = threadId.replace('dm-', '');
        emitToUser(userId, 'poll:edited', payload);
        emitToUser(otherUserId, 'poll:edited', { ...payload, threadId: `dm-${userId}` });
      }
      ack?.({ ok: true });
    } catch (err) {
      console.error('[socket] poll:edit error', err.message);
      ack?.({ error: err.message });
    }
  });

  // ─── Typing ───────────────────────────────────────────────────────────────
  // Uses same simple enabled-only check as online/offline indicators (no role check).
  socket.on('typing:start', async (data) => {
    if (!rl.typing()) return;
    try {
      const { threadId } = data || {};
      if (!threadId) return;
      // ── Organization control: only check if feature is enabled (same as online/offline) ──
      const ctrl = await getOrgControl(orgId, 'indicators');
      if (ctrl && !ctrl.enabled) return;

      const payload = { userId, name: socket.user.name, isTyping: true };

      if (threadId.startsWith('dm-')) {
        const receiverId = threadId.replace('dm-', '');
        emitToUser(receiverId, 'typing:update', { ...payload, threadId: `dm-${userId}` });
      } else if (threadId.startsWith('group-')) {
        const groupId = Number(threadId.replace('group-', ''));
        const members = await getGroupMemberIds(groupId);
        for (const memberId of members) {
          if (String(memberId) === userId) continue;
          emitToUser(String(memberId), 'typing:update', { ...payload, threadId });
        }
      }
    } catch (err) {
      console.error('[socket] typing:start error', err.message);
    }
  });

  socket.on('typing:stop', async (data) => {
    if (!rl.typing()) return;
    try {
      const { threadId } = data || {};
      if (!threadId) return;
      const ctrl = await getOrgControl(orgId, 'indicators');
      if (ctrl && !ctrl.enabled) return;

      const payload = { userId, name: socket.user.name, isTyping: false };

      if (threadId.startsWith('dm-')) {
        emitToUser(threadId.replace('dm-', ''), 'typing:update', { ...payload, threadId: `dm-${userId}` });
      } else if (threadId.startsWith('group-')) {
        const groupId = Number(threadId.replace('group-', ''));
        const members = await getGroupMemberIds(groupId);
        for (const memberId of members) {
          if (String(memberId) === userId) continue;
          emitToUser(String(memberId), 'typing:update', { ...payload, threadId });
        }
      }
    } catch (err) {
      console.error('[socket] typing:stop error', err.message);
    }
  });

  // ─── Audio/Video Call (WebRTC signaling relay) ──────────────────────────────

  // Track in-progress (answered) calls so we can log them with duration on end
  // key: sorted pair "a-b" → { callerId, calleeId, callType, startedAt }
  const _activeCalls = (io._activeCalls = io._activeCalls || new Map());
  // Pending ringing calls waiting for accept/reject — preserves original callType
  // key: sorted pair "a-b" → { callerId, calleeId, callType }
  const _pendingCalls = (io._pendingCalls = io._pendingCalls || new Map());
  const _callKey = (a, b) => [Number(a), Number(b)].sort((x, y) => x - y).join('-');

  // Persist a call-log DM message so missed/declined calls appear in chat for both sides
  const logCall = async ({ fromUserId, toUserId, callType, outcome, duration_seconds = null, ended_at = null }) => {
    try {
      // Dedicated call_logs table — fast indexed history
      callLogModel.insert({
        organization_id: orgId,
        caller_id: Number(fromUserId),
        callee_id: Number(toUserId),
        call_type: callType || 'audio',
        outcome,
        duration_seconds,
        ended_at,
      }).catch((e) => console.warn('[socket] call_logs insert failed:', e.message));

      const durText = duration_seconds
        ? ` (${Math.floor(duration_seconds / 60)}:${String(duration_seconds % 60).padStart(2, '0')})`
        : '';
      const label = {
        missed: `📞 Missed ${callType === 'video' ? 'video' : 'audio'} call`,
        declined: `📞 ${callType === 'video' ? 'Video' : 'Audio'} call declined`,
        offline: `📞 Missed ${callType === 'video' ? 'video' : 'audio'} call (user was offline)`,
        no_answer: `📞 Missed ${callType === 'video' ? 'video' : 'audio'} call`,
        answered: `📞 ${callType === 'video' ? 'Video' : 'Audio'} call${durText}`,
      }[outcome] || `📞 ${callType === 'video' ? 'Video' : 'Audio'} call`;

      const saved = await chatModel.sendDMMessage({
        orgId,
        senderId: Number(fromUserId),
        receiverId: Number(toUserId),
        message: label,
        messageType: 'text',
        metadata: { callLog: true, callType, outcome },
      });
      if (!saved) return;
      await signProfileFields(saved);
      const normalizedForReceiver = normalizeDMMessage(saved, Number(toUserId));
      const normalizedForSender = normalizeDMMessage(saved, Number(fromUserId));
      await signMessageFileUrls(normalizedForReceiver);
      await signMessageFileUrls(normalizedForSender);

      // Emit to both parties so chat lists update live
      emitToUser(String(toUserId), 'message:new', {
        threadId: `dm-${fromUserId}`,
        message: { ...normalizedForReceiver, direction: 'incoming' },
      });
      emitToUser(String(fromUserId), 'message:new', {
        threadId: `dm-${toUserId}`,
        message: { ...normalizedForSender, direction: 'outgoing' },
      });

      // Thread bump + notification for receiver (missed calls show system notification)
      emitToUser(String(toUserId), 'thread:update', {
        threadId: `dm-${fromUserId}`,
        unreadCount: 1,
        readStatus: 'unread',
      });
      if (outcome !== 'declined') {
        try {
          const isDND = await isUserDND(toUserId);
          const isMuted = isDND ? true : await isThreadMuted(toUserId, orgId, `dm-${fromUserId}`);
          if (!isMuted) {
            const payload = {
              type: 'call-missed',
              title: 'Missed call',
              body: `${socket.user.name || 'Someone'} tried to call you`,
              threadId: `dm-${fromUserId}`,
              url: `/app?thread=dm-${fromUserId}`,
            };
            emitToUser(String(toUserId), 'notification', payload);
            pushToUser(toUserId, payload);
          }
        } catch {}
      }
    } catch (err) {
      console.error('[socket] logCall error:', err.message);
    }
  };

  socket.on('call:request', async (data, ack) => {
    if (!rl.call()) return ack?.({ error: 'Rate limited' });
    try {
      const { targetUserId, callType, signalData } = data || {};
      if (!targetUserId) return ack?.({ error: 'targetUserId required' });
      if (String(targetUserId) === userId) return ack?.({ error: 'Cannot call yourself' });
      if (!isUserOnline(String(targetUserId))) {
        // Record missed call for both sides so caller sees it in history
        logCall({ fromUserId: userId, toUserId: targetUserId, callType: callType || 'audio', outcome: 'offline' });
        return ack?.({ error: 'User is offline' });
      }
      emitToUser(String(targetUserId), 'call:incoming_request', {
        fromUserId: userId,
        fromUserName: socket.user.name || 'Unknown',
        fromUserAvatar: socket.user.avatar || null,
        callType: callType || 'audio',
        signalData: signalData || null,
        timestamp: new Date().toISOString(),
      });
      _pendingCalls.set(_callKey(userId, targetUserId), {
        callerId: Number(userId),
        calleeId: Number(targetUserId),
        callType: callType || 'audio',
      });
      // Don't push notification if callee is already in an active call with anyone
      const calleeBusy = Array.from(_activeCalls.values()).some(
        (c) => c.callerId === Number(targetUserId) || c.calleeId === Number(targetUserId)
      );
      if (!calleeBusy) {
        pushToUser(targetUserId, {
          type: 'call-incoming',
          title: `Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`,
          body: `${socket.user.name || 'Someone'} is calling you`,
          tag: 'incoming-call',
          requireInteraction: true,
          url: '/app',
        });
      }
      ack?.({ ok: true });
    } catch (err) {
      console.error('[socket] call:request error', err.message);
      ack?.({ error: err.message });
    }
  });

  socket.on('call:accept', async (data, ack) => {
    if (!rl.call()) return ack?.({ error: 'Rate limited' });
    try {
      const { targetUserId, signalData, callType } = data || {};
      if (!targetUserId) return ack?.({ error: 'targetUserId required' });
      emitToUser(String(targetUserId), 'call:accepted', {
        fromUserId: userId,
        fromUserName: socket.user.name || 'Unknown',
        signalData: signalData || null,
      });
      // targetUserId is the original caller; userId is the callee accepting
      const key = _callKey(targetUserId, userId);
      const pending = _pendingCalls.get(key);
      _pendingCalls.delete(key);
      _activeCalls.set(key, {
        callerId: Number(targetUserId),
        calleeId: Number(userId),
        callType: pending?.callType || callType || 'audio',
        startedAt: Date.now(),
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  socket.on('call:reject', async (data, ack) => {
    if (!rl.call()) return ack?.({ error: 'Rate limited' });
    try {
      const { targetUserId, reason, callType } = data || {};
      if (!targetUserId) return ack?.({ error: 'targetUserId required' });
      emitToUser(String(targetUserId), 'call:rejected', {
        fromUserId: userId,
        reason: reason || 'declined',
      });
      // targetUserId here is the original caller; userId is the one who declined
      const pendKey = _callKey(targetUserId, userId);
      const pend = _pendingCalls.get(pendKey);
      _pendingCalls.delete(pendKey);
      logCall({
        fromUserId: targetUserId,
        toUserId: userId,
        callType: pend?.callType || callType || 'audio',
        outcome: 'declined',
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  socket.on('call:signal', async (data, ack) => {
    if (!rl.signal()) return ack?.({ error: 'Rate limited' });
    try {
      const { targetUserId, signalData } = data || {};
      if (!targetUserId || !signalData) return ack?.({ error: 'targetUserId and signalData required' });
      emitToUser(String(targetUserId), 'call:signal', {
        fromUserId: userId,
        signalData,
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  socket.on('call:stop', async (data, ack) => {
    if (!rl.call()) return ack?.({ error: 'Rate limited' });
    try {
      const { targetUserId, reason, callType } = data || {};
      if (!targetUserId) return ack?.({ error: 'targetUserId required' });
      emitToUser(String(targetUserId), 'call:stopped', {
        fromUserId: userId,
        reason: reason || 'ended',
      });
      // If caller cancels before callee picks up (no_answer), log it as missed on callee's side
      if (reason === 'no_answer') {
        const pendKey = _callKey(userId, targetUserId);
        const pend = _pendingCalls.get(pendKey);
        _pendingCalls.delete(pendKey);
        logCall({
          fromUserId: userId,
          toUserId: targetUserId,
          callType: pend?.callType || callType || 'audio',
          outcome: 'no_answer',
        });
      } else {
        // Answered call ended — log once with duration
        const key = _callKey(userId, targetUserId);
        const active = _activeCalls.get(key);
        if (active) {
          _activeCalls.delete(key);
          const duration = Math.max(1, Math.round((Date.now() - active.startedAt) / 1000));
          logCall({
            fromUserId: active.callerId,
            toUserId: active.calleeId,
            callType: active.callType,
            outcome: 'answered',
            duration_seconds: duration,
            ended_at: new Date(),
          });
        }
      }
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  // ─── Screen Share (WebRTC signaling relay) ───────────────────────────────────

  socket.on('screenshare:request', async (data, ack) => {
    if (!rl.screenshare()) return ack?.({ error: 'Rate limited' });
    try {
      const { targetUserId } = data || {};
      if (!targetUserId) return ack?.({ error: 'targetUserId required' });
      if (String(targetUserId) === userId) return ack?.({ error: 'Cannot share screen with yourself' });
      if (!isUserOnline(String(targetUserId))) return ack?.({ error: 'User is offline' });
      emitToUser(String(targetUserId), 'screenshare:incoming_request', {
        fromUserId: userId,
        fromUserName: socket.user.name || 'Unknown',
        timestamp: new Date().toISOString(),
      });
      ack?.({ ok: true });
    } catch (err) {
      console.error('[socket] screenshare:request error', err.message);
      ack?.({ error: err.message });
    }
  });

  socket.on('screenshare:accept', async (data, ack) => {
    if (!rl.screenshare()) return ack?.({ error: 'Rate limited' });
    try {
      const { targetUserId } = data || {};
      if (!targetUserId) return ack?.({ error: 'targetUserId required' });
      emitToUser(String(targetUserId), 'screenshare:accepted', {
        fromUserId: userId,
        fromUserName: socket.user.name || 'Unknown',
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  socket.on('screenshare:reject', async (data, ack) => {
    if (!rl.screenshare()) return ack?.({ error: 'Rate limited' });
    try {
      const { targetUserId, reason } = data || {};
      if (!targetUserId) return ack?.({ error: 'targetUserId required' });
      emitToUser(String(targetUserId), 'screenshare:rejected', {
        fromUserId: userId,
        fromUserName: socket.user.name || 'Unknown',
        reason: reason || 'declined',
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  socket.on('screenshare:signal', async (data, ack) => {
    if (!rl.signal()) return ack?.({ error: 'Rate limited' });
    try {
      const { targetUserId, signalData } = data || {};
      if (!targetUserId || !signalData) return ack?.({ error: 'targetUserId and signalData required' });
      emitToUser(String(targetUserId), 'screenshare:signal', {
        fromUserId: userId,
        signalData,
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  socket.on('screenshare:stop', async (data, ack) => {
    if (!rl.screenshare()) return ack?.({ error: 'Rate limited' });
    try {
      const { targetUserId, reason } = data || {};
      if (!targetUserId) return ack?.({ error: 'targetUserId required' });
      emitToUser(String(targetUserId), 'screenshare:stopped', {
        fromUserId: userId,
        reason: reason || 'ended',
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  socket.on('screenshare:annotate', async (data) => {
    if (!rl.annotate()) return;
    try {
      const { targetUserId, annotation } = data || {};
      if (!targetUserId || !annotation) return;
      emitToUser(String(targetUserId), 'screenshare:annotate', {
        fromUserId: userId,
        annotation,
      });
    } catch (err) {
      console.error('[socket] screenshare:annotate error', err.message);
    }
  });

  socket.on('screenshare:pointer', async (data) => {
    if (!rl.annotate()) return;
    try {
      const { targetUserId, position } = data || {};
      if (!targetUserId || !position) return;
      emitToUser(String(targetUserId), 'screenshare:pointer', {
        fromUserId: userId,
        position,
      });
    } catch (err) {
      console.error('[socket] screenshare:pointer error', err.message);
    }
  });

  socket.on('screenshare:control-request', async (data, ack) => {
    if (!rl.screenshare()) return ack?.({ error: 'Rate limited' });
    try {
      const { targetUserId } = data || {};
      if (!targetUserId) return ack?.({ error: 'targetUserId required' });
      emitToUser(String(targetUserId), 'screenshare:control-request', {
        fromUserId: userId,
        fromUserName: socket.user.name || 'Unknown',
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  socket.on('screenshare:control-grant', async (data, ack) => {
    if (!rl.screenshare()) return ack?.({ error: 'Rate limited' });
    try {
      const { targetUserId } = data || {};
      if (!targetUserId) return ack?.({ error: 'targetUserId required' });
      emitToUser(String(targetUserId), 'screenshare:control-granted', {
        fromUserId: userId,
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  socket.on('screenshare:control-revoke', async (data, ack) => {
    if (!rl.screenshare()) return ack?.({ error: 'Rate limited' });
    try {
      const { targetUserId } = data || {};
      if (!targetUserId) return ack?.({ error: 'targetUserId required' });
      emitToUser(String(targetUserId), 'screenshare:control-revoked', {
        fromUserId: userId,
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  // ─── Meeting / Conference ──────────────────────────────────────────────────
  // In-memory meeting rooms: meetingRoomId → Set of { socketId, userId, userName }
  const _meetingRooms = (io._meetingRooms = io._meetingRooms || new Map());
  // Per-room lock state: meetingRoomId → boolean (host blocked further joins)
  const _meetingLocks = (io._meetingLocks = io._meetingLocks || new Map());
  // Per-room spotlight pin: meetingRoomId → targetSocketId (host pin everyone follows)
  const _meetingSpotlights = (io._meetingSpotlights = io._meetingSpotlights || new Map());

  // Auto-end a meeting in DB when the last participant leaves (Google Meet style)
  const _autoEndMeetingIfEmpty = async (meetingRoomId) => {
    try {
      const meeting = await meetingModel.findByMeetingId(meetingRoomId);
      if (!meeting) return;
      if (meeting.status === 'ended' || meeting.status === 'cancelled') return;
      const extra = { ended_at: new Date() };
      if (meeting.started_at) {
        extra.duration_minutes = Math.round(
          (Date.now() - new Date(meeting.started_at).getTime()) / 60000
        );
      }
      await meetingModel.updateStatus(meeting.id, 'ended', extra);
      io.to(`meeting:${meetingRoomId}`).emit('meeting:ended', { meetingRoomId });
    } catch (err) {
      console.error('[socket] auto-end meeting error', err.message);
    }
  };

  socket.on('meeting:join', async (data, ack) => {
    try {
      const { meetingRoomId, userName } = data || {};
      if (!meetingRoomId) return ack?.({ error: 'meetingRoomId required' });

      // Reject when the host has locked the meeting — but always let the host
      // themselves back in (re-join after refresh).
      if (_meetingLocks.get(meetingRoomId) === true) {
        try {
          const meeting = await meetingModel.findByMeetingId(meetingRoomId);
          const isHost = meeting && Number(meeting.host_id) === Number(userId);
          if (!isHost) return ack?.({ error: 'Meeting is locked by the host' });
        } catch {
          return ack?.({ error: 'Meeting is locked by the host' });
        }
      }

      const roomKey = `meeting:${meetingRoomId}`;
      socket.join(roomKey);

      if (!_meetingRooms.has(meetingRoomId)) _meetingRooms.set(meetingRoomId, new Map());
      const room = _meetingRooms.get(meetingRoomId);
      room.set(socket.id, { socketId: socket.id, userId, userName: userName || 'User' });

      // Attendance session open
      try {
        const meeting = await meetingModel.findByMeetingId(meetingRoomId);
        if (meeting) {
          await meetingModel.openAttendanceSession({
            meeting_id: meeting.id,
            user_id: userId ? Number(userId) : null,
            display_name: userName || null,
            socket_id: socket.id,
          });
        }
      } catch (e) { console.warn('[socket] attendance open failed:', e.message); }

      // Tell existing participants about new joiner
      socket.to(roomKey).emit('meeting:user-joined', {
        socketId: socket.id, userId, userName: userName || 'User',
      });

      // Send list of current participants + current room state (lock /
      // spotlight) to the joiner so they boot into the right view.
      const participants = Array.from(room.values());
      const locked = _meetingLocks.get(meetingRoomId) === true;
      const spotlight = _meetingSpotlights.get(meetingRoomId) || null;
      ack?.({ ok: true, participants, locked, spotlight });
    } catch (err) {
      console.error('[socket] meeting:join error', err.message);
      ack?.({ error: err.message });
    }
  });

  socket.on('meeting:leave', async (data, ack) => {
    try {
      const { meetingRoomId } = data || {};
      if (!meetingRoomId) return ack?.({ error: 'meetingRoomId required' });

      const roomKey = `meeting:${meetingRoomId}`;
      socket.leave(roomKey);

      const room = _meetingRooms.get(meetingRoomId);
      let becameEmpty = false;
      if (room) {
        room.delete(socket.id);
        if (room.size === 0) {
          _meetingRooms.delete(meetingRoomId);
          _meetingLocks.delete(meetingRoomId);
          _meetingSpotlights.delete(meetingRoomId);
          becameEmpty = true;
        }
      }
      // If the spotlighted participant left, clear the spotlight for the room
      if (room && _meetingSpotlights.get(meetingRoomId) === socket.id) {
        _meetingSpotlights.delete(meetingRoomId);
        socket.to(roomKey).emit('meeting:spotlight', { targetSocketId: null, byUserId: null });
      }

      // Attendance session close
      try {
        const meeting = await meetingModel.findByMeetingId(meetingRoomId);
        if (meeting) await meetingModel.closeAttendanceSession({ meeting_id: meeting.id, socket_id: socket.id });
      } catch (e) { console.warn('[socket] attendance close failed:', e.message); }

      socket.to(roomKey).emit('meeting:user-left', { socketId: socket.id, userId });
      if (becameEmpty) await _autoEndMeetingIfEmpty(meetingRoomId);
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  // ─── Host controls ────────────────────────────────────────────────────────
  // Verify the current socket is the meeting host or a co-host
  const _assertHost = async (meetingRoomId) => {
    const meeting = await meetingModel.findByMeetingId(meetingRoomId);
    if (!meeting) return { ok: false, error: 'Meeting not found' };
    if (Number(meeting.host_id) === Number(userId)) return { ok: true, meeting };
    // Check co-host
    try {
      const parts = await meetingModel.getParticipants(meeting.id);
      const me = parts.find((p) => Number(p.user_id) === Number(userId));
      if (me && me.role === 'co-host') return { ok: true, meeting };
    } catch (_) {}
    return { ok: false, error: 'Only host or co-host can perform this action' };
  };

  socket.on('meeting:host:mute-all', async (data, ack) => {
    try {
      const { meetingRoomId } = data || {};
      if (!meetingRoomId) return ack?.({ error: 'meetingRoomId required' });
      const check = await _assertHost(meetingRoomId);
      if (!check.ok) return ack?.({ error: check.error });
      const roomKey = `meeting:${meetingRoomId}`;
      // Tell all participants except host to mute
      socket.to(roomKey).emit('meeting:force-mute', { byUserId: userId });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  socket.on('meeting:host:lock', async (data, ack) => {
    try {
      const { meetingRoomId, locked } = data || {};
      if (!meetingRoomId) return ack?.({ error: 'meetingRoomId required' });
      const check = await _assertHost(meetingRoomId);
      if (!check.ok) return ack?.({ error: check.error });
      const next = Boolean(locked);
      if (next) _meetingLocks.set(meetingRoomId, true);
      else _meetingLocks.delete(meetingRoomId);
      io.to(`meeting:${meetingRoomId}`).emit('meeting:locked', { locked: next, byUserId: userId });
      ack?.({ ok: true, locked: next });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  socket.on('meeting:host:spotlight', async (data, ack) => {
    try {
      const { meetingRoomId, targetSocketId } = data || {};
      if (!meetingRoomId) return ack?.({ error: 'meetingRoomId required' });
      const check = await _assertHost(meetingRoomId);
      if (!check.ok) return ack?.({ error: check.error });
      // null / falsy targetSocketId clears the spotlight
      if (targetSocketId) _meetingSpotlights.set(meetingRoomId, String(targetSocketId));
      else _meetingSpotlights.delete(meetingRoomId);
      io.to(`meeting:${meetingRoomId}`).emit('meeting:spotlight', {
        targetSocketId: targetSocketId || null,
        byUserId: userId,
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  socket.on('meeting:host:remove', async (data, ack) => {
    try {
      const { meetingRoomId, targetSocketId } = data || {};
      if (!meetingRoomId || !targetSocketId) return ack?.({ error: 'meetingRoomId and targetSocketId required' });
      const check = await _assertHost(meetingRoomId);
      if (!check.ok) return ack?.({ error: check.error });
      // Don't let host remove themselves
      if (targetSocketId === socket.id) return ack?.({ error: 'Cannot remove yourself' });
      // Tell the target they've been removed — their client will leave the call
      io.to(targetSocketId).emit('meeting:removed', { byUserId: userId, meetingRoomId });
      // Also clean up room membership server-side
      const room = _meetingRooms.get(meetingRoomId);
      if (room) room.delete(targetSocketId);
      io.in(targetSocketId).socketsLeave(`meeting:${meetingRoomId}`);
      // Notify others
      socket.to(`meeting:${meetingRoomId}`).emit('meeting:user-left', { socketId: targetSocketId });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  // WebRTC signaling for meetings (offer/answer/ice)
  socket.on('meeting:signal', async (data, ack) => {
    try {
      const { meetingRoomId, targetSocketId, signalData } = data || {};
      if (!targetSocketId || !signalData) return ack?.({ error: 'targetSocketId and signalData required' });

      io.to(targetSocketId).emit('meeting:signal', {
        fromSocketId: socket.id,
        fromUserId: userId,
        signalData,
        meetingRoomId,
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  // In-meeting chat
  socket.on('meeting:chat', async (data, ack) => {
    try {
      const { meetingRoomId, message } = data || {};
      if (!meetingRoomId || !message) return ack?.({ error: 'meetingRoomId and message required' });

      const roomKey = `meeting:${meetingRoomId}`;
      const chatMsg = {
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        userId,
        userName: data.userName || 'User',
        message,
        timestamp: new Date().toISOString(),
      };

      io.to(roomKey).emit('meeting:chat-message', chatMsg);
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  // Meeting reactions (hand raise, emoji reactions)
  socket.on('meeting:reaction', async (data, ack) => {
    try {
      const { meetingRoomId, reaction } = data || {};
      if (!meetingRoomId || !reaction) return ack?.({ error: 'meetingRoomId and reaction required' });

      const roomKey = `meeting:${meetingRoomId}`;
      io.to(roomKey).emit('meeting:reaction', {
        userId, socketId: socket.id, reaction, userName: data.userName,
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  // Toggle media state broadcast (mute/unmute/video on-off/screen share)
  socket.on('meeting:media-state', async (data, ack) => {
    try {
      const { meetingRoomId, audio, video, screenShare } = data || {};
      if (!meetingRoomId) return ack?.({ error: 'meetingRoomId required' });

      const roomKey = `meeting:${meetingRoomId}`;
      socket.to(roomKey).emit('meeting:media-state', {
        socketId: socket.id, userId, audio, video, screenShare,
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  // Pin / Spotlight participant
  socket.on('meeting:pin', async (data, ack) => {
    try {
      const { meetingRoomId, targetSocketId, pinned } = data || {};
      if (!meetingRoomId) return ack?.({ error: 'meetingRoomId required' });

      const roomKey = `meeting:${meetingRoomId}`;
      io.to(roomKey).emit('meeting:pin', {
        userId, targetSocketId, pinned,
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  // Meeting invite notification
  socket.on('meeting:invite', async (data, ack) => {
    try {
      const { targetUserIds, meetingId, meetingTitle, hostName, scheduledAt } = data || {};
      if (!Array.isArray(targetUserIds) || !meetingId) return ack?.({ error: 'targetUserIds and meetingId required' });

      const senderName = hostName || socket.user.name || 'User';
      const sentFrom = buildSentFrom(socket);

      // Resolve branding for email (fire once, reuse)
      let branding = null;
      try { branding = await resolveMailBranding(); } catch (_) {}
      const appName = branding?.appName || 'TeamChatX';

      for (const targetId of targetUserIds) {
        // 1. Send real-time popup notification
        emitToUser(String(targetId), 'meeting:invited', {
          meetingId, meetingTitle, hostName: senderName, hostUserId: userId,
        });
        pushToUser(targetId, {
          type: 'meeting-invite',
          title: 'Meeting Invitation',
          body: `${senderName || 'Someone'} invited you to "${meetingTitle || 'a meeting'}"`,
          tag: 'meeting-invite',
          requireInteraction: true,
          url: '/app',
        });

        const receiverId = Number(targetId);
        if (receiverId === Number(userId)) continue;

        // 2. Send a DM chat message with meeting invite
        try {
          const inviteText = scheduledAt
            ? `Meeting Invite: "${meetingTitle || 'Meeting'}"\nMeeting ID: ${meetingId}\nScheduled: ${new Date(scheduledAt).toLocaleString()}\n\nJoin using the Meeting ID from the + menu.`
            : `Meeting Invite: "${meetingTitle || 'Meeting'}"\nMeeting ID: ${meetingId}\n\nJoin now using the Meeting ID from the + menu!`;

          const saved = await chatModel.sendDMMessage({
            orgId, senderId: Number(userId), receiverId,
            message: inviteText, messageType: 'text',
            metadata: { meetingInvite: true, meetingId, meetingTitle, scheduledAt, ...(sentFrom ? { sentFrom } : {}) },
          });
          if (saved) {
            const normalized = normalizeDMMessage(saved);
            const senderThreadId = `dm-${receiverId}`;
            const receiverThread = getUserActiveThread(String(receiverId));
            const receiverOnline = isUserOnline(String(receiverId));

            emitToUser(userId, 'message:new', {
              threadId: senderThreadId,
              message: { ...normalized, direction: 'outgoing' },
            });
            await deliverDMToReceiver({
              receiverId, userId, orgId, normalized, senderThreadId,
              receiverThread, receiverOnline, senderName, messageType: 'text', message: inviteText,
            });
          }
        } catch (dmErr) {
          console.error('[socket] meeting invite DM to', targetId, 'failed:', dmErr.message);
        }

        // 3. Send email invite
        try {
          const { rows: userRows } = await db.query('SELECT email, name FROM users WHERE user_id = $1', [receiverId]);
          const targetUser = userRows[0];
          if (targetUser?.email) {
            const scheduleInfo = scheduledAt
              ? `<p style="margin:0 0 8px"><strong>Scheduled:</strong> ${new Date(scheduledAt).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}</p>`
              : `<p style="margin:0 0 8px;color:#1976d2"><strong>Starting now — join immediately!</strong></p>`;

            const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5">
  <div style="max-width:520px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#1565c0,#1976d2);padding:28px 32px;text-align:center">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:600">Meeting Invitation</h1>
    </div>
    <div style="padding:28px 32px">
      <p style="margin:0 0 16px;color:#333;font-size:15px">Hi <strong>${targetUser.name || 'there'}</strong>,</p>
      <p style="margin:0 0 20px;color:#555;font-size:14px"><strong>${senderName}</strong> has invited you to a meeting on <strong>${appName}</strong>.</p>

      <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin:0 0 20px;border-left:4px solid #1976d2">
        <p style="margin:0 0 8px"><strong>Title:</strong> ${meetingTitle || 'Meeting'}</p>
        <p style="margin:0 0 8px"><strong>Meeting ID:</strong> <span style="font-family:monospace;font-size:16px;color:#1565c0;font-weight:700;letter-spacing:1px">${meetingId}</span></p>
        ${scheduleInfo}
      </div>

      <div style="text-align:center;margin:24px 0">
        <div style="display:inline-block;background:#1976d2;color:#fff;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.5px">
          Join with ID: ${meetingId}
        </div>
      </div>

      <p style="margin:0 0 8px;color:#777;font-size:13px"><strong>How to join:</strong></p>
      <ol style="margin:0 0 16px;padding-left:20px;color:#777;font-size:13px">
        <li>Open ${appName}</li>
        <li>Click the <strong>+</strong> button</li>
        <li>Select <strong>Meeting</strong> → <strong>Join</strong> tab</li>
        <li>Enter Meeting ID: <strong>${meetingId}</strong></li>
      </ol>

      <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
      <p style="margin:0;color:#999;font-size:12px;text-align:center">Sent via ${appName}</p>
    </div>
  </div>
</body>
</html>`;

            sendMailAsync({
              to: targetUser.email,
              subject: `${senderName} invited you to "${meetingTitle || 'Meeting'}" — ${appName}`,
              text: `${senderName} invited you to a meeting.\n\nTitle: ${meetingTitle || 'Meeting'}\nMeeting ID: ${meetingId}\n${scheduledAt ? 'Scheduled: ' + new Date(scheduledAt).toLocaleString() + '\n' : ''}\nJoin using the Meeting ID in ${appName}.`,
              html: emailHtml,
            });
          }
        } catch (mailErr) {
          console.error('[socket] meeting invite email to user', targetId, 'failed:', mailErr.message);
        }
      }
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  // Clean up meeting rooms on disconnect
  const _origDisconnectHandler = socket._meetingCleanup;
  socket._meetingCleanup = () => {
    for (const [meetingRoomId, room] of _meetingRooms.entries()) {
      if (room.has(socket.id)) {
        room.delete(socket.id);
        const roomKey = `meeting:${meetingRoomId}`;
        socket.to(roomKey).emit('meeting:user-left', { socketId: socket.id, userId });
        // Best-effort attendance close
        meetingModel.findByMeetingId(meetingRoomId).then((m) => {
          if (m) return meetingModel.closeAttendanceSession({ meeting_id: m.id, socket_id: socket.id });
        }).catch(() => {});
        if (room.size === 0) {
          _meetingRooms.delete(meetingRoomId);
          _autoEndMeetingIfEmpty(meetingRoomId);
        }
      }
    }
  };

  // ─── Tab Visibility (browser tab focus/blur) ────────────────────────────────
  socket.on('tab-visibility', async (data) => {
    if (!orgId) return;
    const { tabcheck } = data || {};
    // tabcheck: 1 = tab visible/focused, 0 = tab hidden/blurred
    if (tabcheck === 1) {
      // User returned to tab — broadcast online status to org
      const ctrl = await getOrgControl(orgId, 'indicators').catch(() => null);
      if (!ctrl || ctrl.enabled) {
        socket.to(`org:${orgId}`).emit('user:online', { userId, status: 'Online' });
      }
    }
  });

  // ─── Presence / Activity Status ────────────────────────────────────────────
  socket.on('update_activity_status', async (data) => {
    if (!orgId) return;
    // ── Organization control: status (Away, Idle, etc.) ──
    const statusCheck = await checkOrgControl(orgId, socket.user.role, 'status');
    if (!statusCheck.allowed) return;

    socket.to(`org:${orgId}`).emit('user:status', {
      userId, status: data?.activity_status || 'Online',
    });
  });

  // ─── Join group rooms ─────────────────────────────────────────────────────
  socket.on('group:join', async (data) => {
    const { groupId } = data || {};
    if (!groupId) return;
    // Verify user is an active member before allowing room join
    const members = await getGroupMemberIds(Number(groupId));
    if (!members.includes(Number(userId))) return;
    socket.join(`group:group-${groupId}`);
  });

  // ─── Mark read (single handler for both message:read and internal use) ───
  const markThreadAsRead = async (threadId) => {
    if (!threadId) return;
    const geo = socket.geo || {};
    const readFrom = (geo.city || geo.country)
      ? { city: geo.city, country: geo.country, device: geo.device || 'Web' }
      : null;

    if (threadId.startsWith('dm-')) {
      const otherUserId = threadId.replace('dm-', '');
      const isSelfChat = String(otherUserId) === String(userId);
      await chatModel.markDMMessagesRead(orgId, Number(userId), Number(otherUserId));

      if (!isSelfChat) {
        // Send read_ack (green tick) to the other user
        const senderThread = `dm-${userId}`;
        emitToUser(otherUserId, 'message:read_ack', {
          threadId: senderThread,
          readBy: userId,
          readByName: socket.user.name,
          readAt: new Date().toISOString(),
          ...(readFrom ? { readFrom } : {}),
        });
        emitToUser(otherUserId, 'thread:update', {
          threadId: senderThread,
          readStatus: 'read',
        });
      }
      // Reset own unread count
      emitToUser(userId, 'thread:update', {
        threadId,
        unreadCount: 0,
        readStatus: 'read',
      });

    } else if (threadId.startsWith('group-')) {
      const groupId = Number(threadId.replace('group-', ''));
      const readRows = await chatModel.markGroupMessagesRead(orgId, groupId, Number(userId));
      // Reset own unread count for this group
      emitToUser(userId, 'thread:update', {
        threadId,
        unreadCount: 0,
        readStatus: 'read',
      });
      // Notify group message senders that their messages were read
      if (readRows.length > 0) {
        // Get unique senders of the messages just marked read
        const { rows: senderRows } = await db.query(
          `SELECT DISTINCT gm.sender_id FROM group_messages gm
           JOIN group_message_recipients gmr ON gmr.group_message_id = gm.group_message_id
           WHERE gmr.recipient_id = ANY($1) AND gm.sender_id != $2`,
          [readRows.map(r => r.recipient_id), Number(userId)]
        ).catch(() => ({ rows: [] }));
        const readAckData = {
          threadId,
          readBy: userId,
          readByName: socket.user.name,
          readAt: new Date().toISOString(),
          ...(geo.city || geo.country ? { readFrom: { city: geo.city, country: geo.country, device: geo.device || 'Web' } } : {}),
        };
        for (const s of senderRows) {
          emitToUser(String(s.sender_id), 'message:read_ack', readAckData);
        }
      }
    }
  };

  socket.on('message:read', async (data) => {
    if (!rl.read()) return;
    try {
      await markThreadAsRead(data?.threadId);
    } catch (err) {
      console.error('[socket] message:read error', err.message);
    }
  });

  // ─── Message Info (full details: times, receipts, geo) ───────────────────
  socket.on('message:info', async (data, ack) => {
    if (!rl.info()) return ack?.({ error: 'Rate limited' });
    try {
      const { messageId, threadId } = data || {};
      if (!messageId || !threadId) return ack?.({ error: 'messageId and threadId required' });

      if (threadId.startsWith('dm-')) {
        // Fetch DM message with all timestamps
        const { rows } = await db.query(
          `SELECT m.message_id, m.sender_id, m.receiver_id, m.message, m.message_type,
                  m.message_metadata, m.send_time, m.delivered_at, m.read_time, m.edit_time,
                  s.name AS sender_name, s.profile_url AS sender_avatar,
                  r.name AS reader_name, r.profile_url AS reader_avatar
           FROM messages m
           JOIN users s ON s.user_id = m.sender_id
           JOIN users r ON r.user_id = m.receiver_id
           WHERE m.message_id = $1 AND m.organization_id = $2`,
          [messageId, orgId]
        );
        if (!rows[0]) return ack?.({ error: 'Message not found' });
        const msg = rows[0];
        msg.message = decryptMessage(msg.message);
        msg.message_metadata = decryptMetadata(msg.message_metadata);
        const meta = msg.message_metadata || {};

        // Get reader's device geo (last active device of the receiver)
        const readerId = msg.sender_id === Number(userId) ? msg.receiver_id : msg.sender_id;
        const readerGeo = await loadUserGeo(readerId);

        // Build receipts — read messages show in BOTH read and delivered sections
        const readReceipts = [];
        const deliveredReceipts = [];
        const readerEntry = {
          id: String(readerId),
          name: msg.sender_id === Number(userId) ? msg.reader_name : msg.sender_name,
          avatar: msg.sender_id === Number(userId) ? msg.reader_avatar : msg.sender_avatar,
          deliveredAt: msg.delivered_at?.toISOString?.() ?? msg.send_time?.toISOString?.() ?? null,
          city: readerGeo?.city || null,
          location: formatLocation(readerGeo),
          device: readerGeo?.device || 'Browser',
          platform: readerGeo?.platform || 'Web',
        };
        if (msg.read_time) {
          readReceipts.push({ ...readerEntry, readAt: msg.read_time?.toISOString?.() ?? String(msg.read_time) });
          deliveredReceipts.push(readerEntry);
        } else {
          deliveredReceipts.push(readerEntry);
        }

        // Sender geo
        const senderGeo = meta.sentFrom || (await loadUserGeo(msg.sender_id)) || {};

        ack?.({
          ok: true,
          info: {
            messageId: String(msg.message_id),
            threadId,
            sendTime: msg.send_time?.toISOString?.() ?? null,
            deliveredTime: msg.delivered_at?.toISOString?.() ?? null,
            readTime: msg.read_time?.toISOString?.() ?? null,
            editTime: msg.edit_time?.toISOString?.() ?? null,
            sender: {
              id: String(msg.sender_id),
              name: msg.sender_name,
              avatar: msg.sender_avatar,
              location: formatLocation(senderGeo),
              device: senderGeo.device || 'Browser',
              platform: 'Web',
            },
            metadata: meta,
            receipts: {
              read: readReceipts,
              delivered: deliveredReceipts,
            },
          },
        });

      } else if (threadId.startsWith('group-')) {
        const groupId = Number(threadId.replace('group-', ''));
        // Fetch group message
        const { rows } = await db.query(
          `SELECT gm.group_message_id, gm.sender_id, gm.message, gm.message_type,
                  gm.message_metadata, gm.created_at, gm.updated_at,
                  s.name AS sender_name, s.profile_url AS sender_avatar
           FROM group_messages gm
           JOIN users s ON s.user_id = gm.sender_id
           WHERE gm.group_message_id = $1 AND gm.organization_id = $2 AND gm.group_id = $3`,
          [messageId, orgId, groupId]
        );
        if (!rows[0]) return ack?.({ error: 'Message not found' });
        const msg = rows[0];
        msg.message = decryptMessage(msg.message);
        msg.message_metadata = decryptMetadata(msg.message_metadata);
        const meta = msg.message_metadata || {};

        // Fetch read receipts from group_message_reads
        const { rows: readRows } = await db.query(
          `SELECT gmr.user_id, gmr.read_at, u.name, u.profile_url AS avatar
           FROM group_message_reads gmr
           JOIN users u ON u.user_id = gmr.user_id
           WHERE gmr.group_message_id = $1`,
          [messageId]
        ).catch(() => ({ rows: [] }));

        const readerIds = new Set(readRows.map(r => r.user_id));
        const members = await getGroupMemberIds(groupId);

        // Batch load geo for ALL members + sender in 1 query instead of N
        const allUserIds = [...new Set([...members, msg.sender_id])];
        const geoMap = await loadUserGeoBatch(allUserIds);

        // Fetch names/avatars for unread members in 1 query
        const unreadMemberIds = members.filter(id => id !== msg.sender_id && !readerIds.has(id));
        const { rows: unreadUsers } = unreadMemberIds.length
          ? await db.query('SELECT user_id, name, profile_url AS avatar FROM users WHERE user_id = ANY($1)', [unreadMemberIds])
          : { rows: [] };
        const unreadUserMap = new Map(unreadUsers.map(u => [u.user_id, u]));

        const readReceipts = readRows.map(r => {
          const geo = geoMap.get(Number(r.user_id)) || {};
          return {
            id: String(r.user_id), name: r.name, avatar: r.avatar,
            readAt: r.read_at?.toISOString?.() ?? String(r.read_at),
            location: formatLocation(geo),
            device: geo.device || 'Browser', platform: 'Web',
          };
        });

        const deliveredReceipts = unreadMemberIds.map(memberId => {
          const u = unreadUserMap.get(memberId);
          if (!u) return null;
          const geo = geoMap.get(Number(memberId)) || {};
          return {
            id: String(memberId), name: u.name, avatar: u.avatar,
            deliveredAt: msg.created_at?.toISOString?.() ?? null,
            location: formatLocation(geo),
            device: geo.device || 'Browser', platform: 'Web',
          };
        }).filter(Boolean);

        const senderGeo = meta.sentFrom || geoMap.get(Number(msg.sender_id)) || {};
        ack?.({
          ok: true,
          info: {
            messageId: String(msg.group_message_id),
            threadId,
            sendTime: msg.created_at?.toISOString?.() ?? null,
            readTime: null,
            editTime: msg.updated_at && msg.updated_at !== msg.created_at ? msg.updated_at?.toISOString?.() : null,
            sender: {
              id: String(msg.sender_id),
              name: msg.sender_name,
              avatar: msg.sender_avatar,
              location: formatLocation(senderGeo),
              device: senderGeo.device || 'Browser',
              platform: 'Web',
            },
            metadata: meta,
            receipts: {
              read: readReceipts,
              delivered: deliveredReceipts,
            },
          },
        });
      }
    } catch (err) {
      console.error('[socket] message:info error', err.message);
      ack?.({ error: err.message });
    }
  });

  // ─── Forward ──────────────────────────────────────────────────────────────
  socket.on('message:forward', async (data, ack) => {
    if (!rl.forward()) return ack?.({ error: 'Rate limited' });
    try {
      const { targetThreadId, message, message_type = 'text', metadata = null } = data;
      if (!targetThreadId || !message) return ack?.({ error: 'targetThreadId and message required' });

      const fwdSentFrom = buildSentFrom(socket);
      const forwardMeta = { ...(metadata || {}), forwarded: true, forwardedBy: socket.user.name, ...(fwdSentFrom ? { sentFrom: fwdSentFrom } : {}) };

      if (targetThreadId.startsWith('dm-')) {
        const receiverId = Number(targetThreadId.replace('dm-', ''));
        const saved = await chatModel.sendDMMessage({
          orgId, senderId: Number(userId), receiverId,
          message, messageType: message_type, metadata: forwardMeta,
        });
        await signProfileFields(saved);
        const normalized = normalizeDMMessage(saved, Number(userId));
        await signMessageFileUrls(normalized);

        const delivery = resolveDMDelivery({ saved, receiverId, userId, orgId, threadId: targetThreadId });
        await deliverDMToReceiver({
          receiverId, userId, orgId, normalized,
          senderThreadId: delivery.senderThreadId,
          receiverThread: delivery.receiverThread,
          receiverOnline: delivery.receiverOnline,
          senderName: socket.user.name,
          messageType: message_type, message,
        });

        ack?.({ ok: true, message: { ...normalized, status: delivery.status } });

      } else if (targetThreadId.startsWith('group-')) {
        const groupId = Number(targetThreadId.replace('group-', ''));
        const saved = await chatModel.sendGroupMessage({
          orgId, groupId, senderId: Number(userId),
          message, messageType: message_type, metadata: forwardMeta,
        });
        await signProfileFields(saved);
        const normalized = normalizeGroupMessage(saved, Number(userId));
        await signMessageFileUrls(normalized);

        await deliverGroupToMembers({
          groupId, orgId, userId, normalized,
          senderName: socket.user.name,
          messageType: message_type, message, threadId: targetThreadId,
        });

        ack?.({ ok: true, message: normalized });
      }
    } catch (err) {
      console.error('[socket] message:forward error', err.message);
      ack?.({ error: err.message });
    }
  });

  // ─── Thread focus (for delivery status tracking) ─────────────────────────
  // Only tracks which thread user is viewing + marks read (reuses markThreadAsRead)
  socket.on('thread:focus', async (data) => {
    if (!rl.focus()) return;
    const { threadId } = data || {};
    setUserActiveThread(userId, threadId || null, socket.id);
    if (threadId) {
      try {
        await markThreadAsRead(threadId);
      } catch (err) {
        console.error('[socket] thread:focus read error', err.message);
      }
    }
  });

  // ─── Owner: Live Socket Stats (subscribe/unsubscribe) ────────────────────
  let _statsInterval = null;
  socket.on('system:socket-stats:subscribe', () => {
    // Only owner (role_id 1 or role 'owner') can subscribe
    const role = socket.user.role || socket.user.role_key;
    const roleId = socket.user.role_id;
    if (roleId !== 1 && role !== 'owner') return;
    if (_statsInterval) clearInterval(_statsInterval);
    // Send immediately, then every 10 seconds
    socket.emit('system:socket-stats', getSocketStats());
    _statsInterval = setInterval(() => {
      if (!socket.connected) { clearInterval(_statsInterval); return; }
      socket.emit('system:socket-stats', getSocketStats());
    }, 10_000);
  });

  socket.on('system:socket-stats:unsubscribe', () => {
    if (_statsInterval) { clearInterval(_statsInterval); _statsInterval = null; }
  });

  // ─── Chat Mute ──────────────────────────────────────────────────────────
  socket.on('thread:mute', async (data, ack) => {
    if (!rl.mute()) return ack?.({ error: 'Rate limited' });
    try {
      const { threadId, duration } = data || {};
      if (!threadId) return ack?.({ error: 'Missing threadId' });

      if (duration === 'unmute') {
        await threadMuteModel.removeMute(Number(userId), orgId, threadId);
        invalidateMuteCache(userId, orgId);
        emitToUser(userId, 'thread:mute_update', { threadId, muted: false, muteUntil: null });
        return ack?.({ ok: true });
      }

      const muteUntil = duration === 'forever' ? null :
        duration === '1h' ? new Date(Date.now() + 3600000) :
        duration === '8h' ? new Date(Date.now() + 28800000) :
        duration === '1w' ? new Date(Date.now() + 604800000) : null;

      await threadMuteModel.upsertMute(Number(userId), orgId, threadId, muteUntil);
      invalidateMuteCache(userId, orgId);
      emitToUser(userId, 'thread:mute_update', {
        threadId, muted: true,
        muteUntil: muteUntil?.toISOString() || null,
      });
      ack?.({ ok: true });
    } catch (err) {
      console.error('[socket] thread:mute error', err.message);
      ack?.({ error: err.message });
    }
  });

  // ─── Thread pin / unpin ────────────────────────────────────────────────
  socket.on('thread:pin', async (data, ack) => {
    if (!rl.pin()) return ack?.({ error: 'Rate limited' });
    try {
      const { threadId, pinned } = data || {};
      if (!threadId) return ack?.({ error: 'Missing threadId' });
      if (!orgId) return ack?.({ error: 'No org context' });
      if (pinned === false) {
        await threadPinModel.unpin(Number(userId), orgId, threadId);
        emitToUser(userId, 'thread:pin_update', { threadId, pinned: false });
      } else {
        const row = await threadPinModel.pin(Number(userId), orgId, threadId);
        emitToUser(userId, 'thread:pin_update', {
          threadId, pinned: true, pinned_at: row?.pinned_at,
        });
      }
      ack?.({ ok: true });
    } catch (err) {
      console.error('[socket] thread:pin error', err.message);
      ack?.({ error: err.message || 'Pin failed' });
    }
  });

  // ─── DND Mode ──────────────────────────────────────────────────────────
  socket.on('dnd:update', async (data, ack) => {
    if (!rl.dnd()) return ack?.({ error: 'Rate limited' });
    try {
      const { enabled, schedule } = data || {};
      const value = { enabled: !!enabled, schedule: schedule || null };
      await userSettingsModel.upsertSetting(Number(userId), 'dnd', value);
      invalidateDndCache(userId);
      emitToUser(userId, 'dnd:state', value);
      ack?.({ ok: true });
    } catch (err) {
      console.error('[socket] dnd:update error', err.message);
      ack?.({ error: err.message });
    }
  });

  // ─── Custom Notification Sound Per Chat ────────────────────────────────
  socket.on('thread:sound:set', async (data, ack) => {
    try {
      const { threadId, sound } = data || {};
      if (!threadId) return ack?.({ error: 'Missing threadId' });
      const existing = await userSettingsModel.getSetting(Number(userId), 'thread_sounds') || {};
      if (sound && sound !== 'default') {
        existing[threadId] = sound;
      } else {
        delete existing[threadId];
      }
      await userSettingsModel.upsertSetting(Number(userId), 'thread_sounds', existing);
      emitToUser(userId, 'thread:sound:updated', { threadId, sound: sound || 'default' });
      ack?.({ ok: true });
    } catch (err) {
      console.error('[socket] thread:sound:set error', err.message);
      ack?.({ error: err.message });
    }
  });

  // ─── Scheduled Messages ────────────────────────────────────────────────
  socket.on('message:schedule', async (data, ack) => {
    if (!rl.schedule()) return ack?.({ error: 'Rate limited' });
    try {
      const { threadId, message, messageType = 'text', metadata = null, sendAt } = data || {};
      if (!threadId || !message || !sendAt) return ack?.({ error: 'threadId, message, and sendAt required' });
      const sendDate = new Date(sendAt);
      if (isNaN(sendDate.getTime()) || sendDate <= new Date()) return ack?.({ error: 'sendAt must be a future date' });
      const scheduled = await scheduledMessageModel.create(
        Number(userId), orgId, threadId, message, messageType, metadata, sendDate
      );
      emitToUser(userId, 'message:scheduled', scheduled);
      ack?.({ ok: true, scheduled });
    } catch (err) {
      console.error('[socket] message:schedule error', err.message);
      ack?.({ error: err.message });
    }
  });

  socket.on('message:schedule:cancel', async (data, ack) => {
    if (!rl.schedule()) return ack?.({ error: 'Rate limited' });
    try {
      const { id } = data || {};
      if (!id) return ack?.({ error: 'Missing id' });
      const cancelled = await scheduledMessageModel.cancel(id, Number(userId));
      if (!cancelled) return ack?.({ error: 'Not found or already sent' });
      emitToUser(userId, 'message:schedule:cancelled', { id });
      ack?.({ ok: true });
    } catch (err) {
      console.error('[socket] message:schedule:cancel error', err.message);
      ack?.({ error: err.message });
    }
  });

  socket.on('scheduled:list', async (data, ack) => {
    try {
      const list = await scheduledMessageModel.getByUser(Number(userId), orgId);
      ack?.({ ok: true, scheduled: list });
    } catch (err) {
      console.error('[socket] scheduled:list error', err.message);
      ack?.({ error: err.message });
    }
  });

  // ─── Disappearing Messages ─────────────────────────────────────────────
  socket.on('thread:disappear:set', async (data, ack) => {
    if (!rl.disappear()) return ack?.({ error: 'Rate limited' });
    try {
      const { threadId, durationSeconds } = data || {};
      if (!threadId) return ack?.({ error: 'Missing threadId' });

      if (!durationSeconds || durationSeconds <= 0) {
        await disappearingModel.removeTimer(threadId, orgId);
        // Notify thread participants
        if (threadId.startsWith('group-')) {
          const groupId = Number(threadId.replace('group-', ''));
          const members = await getGroupMemberIds(groupId);
          for (const mid of members) {
            emitToUser(String(mid), 'thread:disappear:updated', { threadId, durationSeconds: 0, setBy: userId });
          }
        } else {
          const otherUserId = threadId.replace('dm-', '');
          emitToUser(userId, 'thread:disappear:updated', { threadId, durationSeconds: 0, setBy: userId });
          emitToUser(otherUserId, 'thread:disappear:updated', { threadId, durationSeconds: 0, setBy: userId });
        }
        return ack?.({ ok: true });
      }

      await disappearingModel.setTimer(threadId, orgId, Number(userId), durationSeconds);
      if (threadId.startsWith('group-')) {
        const groupId = Number(threadId.replace('group-', ''));
        const members = await getGroupMemberIds(groupId);
        for (const mid of members) {
          emitToUser(String(mid), 'thread:disappear:updated', { threadId, durationSeconds, setBy: userId });
        }
      } else {
        const otherUserId = threadId.replace('dm-', '');
        emitToUser(userId, 'thread:disappear:updated', { threadId, durationSeconds, setBy: userId });
        emitToUser(otherUserId, 'thread:disappear:updated', { threadId, durationSeconds, setBy: userId });
      }
      ack?.({ ok: true });
    } catch (err) {
      console.error('[socket] thread:disappear:set error', err.message);
      ack?.({ error: err.message });
    }
  });

  socket.on('thread:disappear:get', async (data, ack) => {
    try {
      const { threadId } = data || {};
      if (!threadId) return ack?.({ error: 'Missing threadId' });
      const timer = await disappearingModel.getTimer(threadId, orgId);
      ack?.({ ok: true, timer });
    } catch (err) {
      console.error('[socket] thread:disappear:get error', err.message);
      ack?.({ error: err.message });
    }
  });

  // ─── Broadcast ─────────────────────────────────────────────────────────
  socket.on('broadcast:send', async (data, ack) => {
    if (!rl.broadcast()) return ack?.({ error: 'Rate limited (max 2 broadcasts per minute)' });
    try {
      const { contactIds = [], groupIds = [], message, messageType = 'text', metadata = null } = data || {};
      if ((!contactIds.length && !groupIds.length) || !message) {
        return ack?.({ error: 'contactIds/groupIds and message required' });
      }
      if (contactIds.length + groupIds.length > 50) return ack?.({ error: 'Max 50 targets per broadcast' });

      const sentFrom = buildSentFrom(socket);
      let sent = 0;
      let failed = 0;

      // Send to individual contacts (DMs)
      for (const contactId of contactIds) {
        try {
          const receiverId = Number(contactId);
          if (receiverId === Number(userId)) continue;
          const saved = await chatModel.sendDMMessage({
            orgId, senderId: Number(userId), receiverId,
            message, messageType, metadata: { ...(metadata || {}), broadcast: true, ...(sentFrom ? { sentFrom } : {}) },
          });
          if (!saved) { failed++; continue; }
          const normalized = normalizeDMMessage(saved);
          const senderThreadId = `dm-${receiverId}`;
          const receiverThread = getUserActiveThread(String(receiverId));
          const receiverOnline = isUserOnline(String(receiverId));
          const senderName = socket.user.name || 'User';

          emitToUser(userId, 'message:new', {
            threadId: senderThreadId,
            message: { ...normalized, direction: 'outgoing' },
          });
          await deliverDMToReceiver({
            receiverId, userId, orgId, normalized, senderThreadId,
            receiverThread, receiverOnline, senderName, messageType, message,
          });
          sent++;
        } catch (err) {
          console.error('[socket] broadcast DM to', contactId, 'failed:', err.message);
          failed++;
        }
      }

      // Send to groups
      for (const gId of groupIds) {
        try {
          const groupId = Number(gId);
          const threadId = `group-${groupId}`;
          const saved = await chatModel.sendGroupMessage({
            orgId, groupId, senderId: Number(userId),
            message, messageType, metadata: { ...(metadata || {}), broadcast: true, ...(sentFrom ? { sentFrom } : {}) },
          });
          if (!saved) { failed++; continue; }
          const normalized = normalizeGroupMessage(saved, Number(userId));
          await deliverGroupToMembers({
            groupId, orgId, userId, normalized,
            senderName: socket.user.name || 'User',
            messageType, message, threadId,
          });
          sent++;
        } catch (err) {
          console.error('[socket] broadcast group to', gId, 'failed:', err.message);
          failed++;
        }
      }

      ack?.({ ok: true, sent, failed });
    } catch (err) {
      console.error('[socket] broadcast:send error', err.message);
      ack?.({ error: err.message });
    }
  });

  // ─── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    if (_statsInterval) { clearInterval(_statsInterval); _statsInterval = null; }
    // Clean up meeting rooms
    if (socket._meetingCleanup) socket._meetingCleanup();
    socketActiveThread.delete(socket.id);
    if (isGuest) {
      console.log(`[socket] guest disconnected sid=${socket.id} reason=${reason}`);
      return;
    }
    removeUserSocket(userId, socket.id);
    // Clear org mapping on disconnect (only when ALL tabs closed)
    if (!isUserOnline(userId)) {
      userOrgMap.delete(userId);
      // Remove from org online set
      if (orgId) {
        const orgSet = orgOnlineUsers.get(orgId);
        if (orgSet) {
          orgSet.delete(userId);
          if (orgSet.size === 0) orgOnlineUsers.delete(orgId);
        }
      }
    }
    console.log(`[socket] disconnected user=${userId} sid=${socket.id} reason=${reason}`);
    // Broadcast offline only when ALL tabs/devices closed (respects indicators control)
    if (!isUserOnline(userId) && orgId) {
      getOrgControl(orgId, 'indicators').then((ctrl) => {
        if (!ctrl || ctrl.enabled) {
          io.to(`org:${orgId}`).emit('user:offline', { userId, status: 'Offline' });
        }
      }).catch(() => {
        io.to(`org:${orgId}`).emit('user:offline', { userId, status: 'Offline' });
      });
    }
  });
};

// ─── DB helpers ───────────────────────────────────────────────────────────────

/** Fetch message created_at/send_time for time-limit checks */
const getMessageCreatedAt = async (messageId, threadId) => {
  try {
    if (threadId?.startsWith('group-')) {
      const { rows } = await db.query(
        'SELECT created_at FROM group_messages WHERE group_message_id = $1 LIMIT 1',
        [messageId]
      );
      return rows[0]?.created_at || null;
    }
    const { rows } = await db.query(
      'SELECT send_time FROM messages WHERE message_id = $1 LIMIT 1',
      [messageId]
    );
    return rows[0]?.send_time || null;
  } catch { return null; }
};

// Cache group members for 30 seconds — avoids repeated DB hits for typing, reactions, etc.
const _groupMembersCache = new Map(); // groupId → { data: number[], ts: number }
const GROUP_MEMBERS_CACHE_TTL = 30_000; // 30 seconds

const getGroupMemberIds = async (groupId) => {
  const cached = _groupMembersCache.get(groupId);
  if (cached && Date.now() - cached.ts < GROUP_MEMBERS_CACHE_TTL) {
    return cached.data;
  }
  const { rows } = await db.query(
    `SELECT user_id FROM group_members WHERE group_id = $1 AND status = 'active'`,
    [groupId]
  );
  const ids = rows.map((r) => r.user_id);
  _groupMembersCache.set(groupId, { data: ids, ts: Date.now() });
  return ids;
};

const recallDMMessage = async (messageId, orgId, senderId) => {
  // Verify message exists and belongs to sender
  const { rows } = await db.query(
    `SELECT message_id, sender_id, receiver_id FROM messages
     WHERE message_id = $1 AND organization_id = $2 AND sender_id = $3`,
    [messageId, orgId, senderId]
  );
  if (!rows.length) return null;
  // Log recall action — fetch queries hide messages with a 'recall' action from ALL users
  await db.query(
    `INSERT INTO message_actions (message_id, user_id, action_type) VALUES ($1, $2, 'recall')`,
    [messageId, senderId]
  );
  return rows[0];
};

const recallGroupMessage = async (messageId, orgId, groupId, senderId) => {
  // Verify message exists and belongs to sender
  const { rows } = await db.query(
    `SELECT group_message_id, sender_id FROM group_messages
     WHERE group_message_id = $1 AND organization_id = $2 AND group_id = $3 AND sender_id = $4`,
    [messageId, orgId, groupId, senderId]
  );
  if (!rows.length) return null;
  // Log recall action — fetch queries hide messages with a 'recall' action from ALL users
  await db.query(
    `INSERT INTO group_message_actions (group_message_id, user_id, action_type) VALUES ($1, $2, 'recall')`,
    [messageId, senderId]
  );
  return rows[0];
};

const editGroupMessage = async (messageId, orgId, groupId, senderId, newText) => {
  const encryptedText = encryptMessage(newText);
  // Read existing metadata, decrypt, add edited flag, re-encrypt
  const { rows: metaRows } = await db.query(
    `SELECT message_metadata FROM group_messages WHERE group_message_id = $1 AND organization_id = $2 AND group_id = $3 AND sender_id = $4`,
    [messageId, orgId, groupId, senderId]
  );
  const existingMeta = metaRows[0]?.message_metadata
    ? decryptMetadata(metaRows[0].message_metadata)
    : {};
  const grpEditHistory = Array.isArray(existingMeta.editHistory) ? existingMeta.editHistory : [];
  grpEditHistory.push({ editedAt: new Date().toISOString() });
  const mergedMeta = { ...existingMeta, edited: true, editHistory: grpEditHistory };
  const encMeta = encryptMetadata(mergedMeta);
  const { rows } = await db.query(
    `WITH updated AS (
      UPDATE group_messages SET message = $1, updated_at = NOW(), message_metadata = $2::jsonb
      WHERE group_message_id = $3 AND organization_id = $4 AND group_id = $5 AND sender_id = $6
      RETURNING *
    )
    SELECT updated.*, u.name AS sender_name, u.profile_url AS sender_avatar
    FROM updated JOIN users u ON u.user_id = updated.sender_id`,
    [encryptedText, encMeta, messageId, orgId, groupId, senderId]
  );
  if (rows[0]) {
    rows[0].message = decryptMessage(rows[0].message);
    rows[0].message_metadata = decryptMetadata(rows[0].message_metadata);
  }
  return rows[0] || null;
};

/** Log an action (pin, delete, react) into message_actions / group_message_actions */
const logMessageAction = async (messageId, threadId, userId, actionType, actionValue = 1) => {
  const isGroup = threadId?.startsWith('group-');
  const table = isGroup ? 'group_message_actions' : 'message_actions';
  const idCol = isGroup ? 'group_message_id' : 'message_id';
  await db.query(
    `INSERT INTO ${table} (${idCol}, user_id, action_type) VALUES ($1, $2, $3)`,
    [messageId, userId, actionType === 'react' ? `react:${actionValue}` : actionType]
  );
};

const toggleReaction = async (messageId, threadId, userId, emoji) => {
  const isGroup = threadId?.startsWith('group-');
  const table = isGroup ? 'group_message_actions' : 'message_actions';
  const idCol = isGroup ? 'group_message_id' : 'message_id';
  const actionType = `react:${String(emoji).slice(0, 32)}`;

  // Atomic toggle: DELETE returns row if existed, otherwise INSERT
  const { rows: deleted } = await db.query(
    `DELETE FROM ${table} WHERE ${idCol} = $1 AND user_id = $2 AND action_type = $3 RETURNING action_id`,
    [messageId, userId, actionType]
  );
  if (deleted.length > 0) {
    return { emoji, userId, action: 'removed' };
  }
  await db.query(
    `INSERT INTO ${table} (${idCol}, user_id, action_type) VALUES ($1, $2, $3)`,
    [messageId, userId, actionType]
  );
  return { emoji, userId, action: 'added' };
};

// ─── Message normalizers ──────────────────────────────────────────────────────

const normalizeDMMessage = (row, currentUserId) => {
  const meta = row.message_metadata || {};
  const sentAt = row.send_time?.toISOString?.() ?? String(row.send_time || new Date().toISOString());
  const editedAt = row.edit_time ? (row.edit_time?.toISOString?.() ?? String(row.edit_time)) : null;
  return {
    id: String(row.message_id),
    type: (row.message_type || 'text').toLowerCase(),
    direction: Number(row.sender_id) === Number(currentUserId) ? 'outgoing' : 'incoming',
    author: {
      id: String(row.sender_id),
      name: row.sender_name || '',
      avatar: row.sender_avatar || null,
    },
    content: buildContent(row),
    metadata: {
      ...meta,
      sentAt,
      ...(editedAt ? { editedAt } : {}),
      ...(meta.forwarded ? { forwarded: true, forwardedBy: meta.forwardedBy || '', isForwarded: true } : {}),
    },
    createdAt: sentAt,
    editedAt,
    ...(row.expires_at ? { expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at) } : {}),
    status: row.read_time ? 'read' : row.delivered_at ? 'delivered' : 'sent',
  };
};

const normalizeGroupMessage = (row, currentUserId) => {
  const meta = row.message_metadata || {};
  const sentAt = row.created_at?.toISOString?.() ?? String(row.created_at || new Date().toISOString());
  // Compare by timestamp value, not by reference — Date objects are never === even with same time
  const updatedMs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
  const createdMs = row.created_at ? new Date(row.created_at).getTime() : 0;
  const editedAt = row.updated_at && updatedMs > createdMs
    ? (row.updated_at?.toISOString?.() ?? String(row.updated_at))
    : null;
  return {
    id: String(row.group_message_id),
    type: (row.message_type || 'text').toLowerCase(),
    direction: Number(row.sender_id) === Number(currentUserId) ? 'outgoing' : 'incoming',
    author: {
      id: String(row.sender_id),
      name: row.sender_name || '',
      avatar: row.sender_avatar || null,
    },
    content: buildContent(row),
    metadata: {
      ...meta,
      sentAt,
      ...(editedAt ? { editedAt } : {}),
      ...(meta.forwarded ? { forwarded: true, forwardedBy: meta.forwardedBy || '', isForwarded: true } : {}),
    },
    createdAt: sentAt,
    editedAt,
    ...(row.expires_at ? { expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at) } : {}),
    status: 'delivered',
  };
};

const humanFileSize = (bytes) => {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const val = n / Math.pow(1024, i);
  return `${i === 0 ? val : val.toFixed(val < 10 ? 2 : 1)} ${units[i]}`;
};

const buildContent = (row) => {
  const meta = row.message_metadata || {};
  if (meta.deleted) return { text: '', deleted: true };
  if (meta.recalled) return { text: '', recalled: true };
  // File/media types need ALL metadata fields (fileKey, mimeType, caption, thumbnail, duration, etc.)
  const fileTypes = ['file', 'image', 'video', 'audio'];
  if (fileTypes.includes(row.message_type)) {
    const { sentFrom, editHistory, html, ...fileFields } = meta;
    // Format fileSize to human-readable (6264 → "6.12 KB")
    const rawSize = Number(meta.fileSize || meta.file_size || 0);
    const formattedSize = rawSize > 0 ? humanFileSize(rawSize) : (meta.fileSize || '');
    return { fileName: meta.fileName || '', fileUrl: meta.fileUrl || row.message, ...fileFields, fileSize: formattedSize, rawSize };
  }
  // Link messages — preserve preview metadata (title, description, thumbnail)
  if (row.message_type === 'link') {
    const { sentFrom, editHistory, ...linkFields } = meta;
    return {
      url: meta.url || row.message || '',
      title: meta.title || '',
      description: meta.description || '',
      thumbnail: meta.thumbnail || meta.image || '',
      caption: meta.caption || '',
      displayHost: meta.displayHost || '',
      ...linkFields,
    };
  }
  // Poll messages — pass all poll payload fields into content for PollMsg component
  if (row.message_type === 'poll') {
    const { sentFrom, editHistory, ...pollFields } = meta;
    return {
      question: meta.question || row.message || 'Poll',
      type: meta.type || 'single',
      options: Array.isArray(meta.options) ? meta.options : [],
      allowMultiple: meta.allowMultiple || meta.type === 'multiple',
      endAt: meta.endAt || null,
      createdBy: meta.createdBy || null,
      endAccess: meta.endAccess || 'creator-or-admin',
      editAccess: meta.editAccess || meta.endAccess || 'creator-or-admin',
      showResultsBeforeVote: meta.showResultsBeforeVote ?? false,
      totalVotes: meta.totalVotes || 0,
      viewerVotes: meta.viewerVotes || [],
    };
  }
  // Text messages — text + html (formatting) + emoji flags, no metadata leak
  return {
    text: row.message || '',
    ...(typeof meta.html === 'string' && meta.html ? { html: meta.html } : {}),
    ...(meta.edited ? { edited: true } : {}),
    ...(meta.isEmojiOnly ? { isEmojiOnly: true, emojiCount: meta.emojiCount || 0 } : {}),
  };
};

const getIO = () => io;

/** Force disconnect all sockets for a user (called on logout) */
const disconnectUser = (userId) => {
  const uid = String(userId);
  const sockets = userSockets.get(uid);
  if (!sockets || !io) return;
  for (const sid of sockets) {
    const s = io.sockets.sockets.get(sid);
    if (s) s.disconnect(true);
  }
  // cleanup is handled by the disconnect handler automatically
};

// ─── Socket Stats (for owner dashboard) ──────────────────────────────────────
const getSocketStats = () => {
  // Total connections & unique users
  let totalConnections = 0;
  const usersOnline = [];
  for (const [uid, sockets] of userSockets) {
    totalConnections += sockets.size;
    usersOnline.push({
      userId: uid,
      tabs: sockets.size,
      activeThread: getUserActiveThread(uid) || null,
    });
  }

  // Org-wise breakdown from socket rooms
  const connectionsByOrg = {};
  const roomStats = { orgRooms: 0, userRooms: 0, groupRooms: 0, totalRooms: 0 };
  if (io) {
    const rooms = io.sockets.adapter.rooms;
    for (const [roomName, sids] of rooms) {
      // Skip rooms that are just socket IDs (every socket auto-joins its own ID room)
      if (io.sockets.sockets.has(roomName)) continue;
      roomStats.totalRooms++;
      if (roomName.startsWith('org:')) {
        roomStats.orgRooms++;
        const orgId = roomName.replace('org:', '');
        connectionsByOrg[orgId] = (connectionsByOrg[orgId] || 0) + sids.size;
      } else if (roomName.startsWith('user:')) {
        roomStats.userRooms++;
      } else if (roomName.startsWith('group:')) {
        roomStats.groupRooms++;
      }
    }
  }

  // System stats
  const mem = process.memoryUsage();
  const system = {
    serverUptime: process.uptime(),
    serverUptimeFormatted: formatUptime(process.uptime()),
    memoryUsage: {
      rss: formatBytes(mem.rss),
      heapUsed: formatBytes(mem.heapUsed),
      heapTotal: formatBytes(mem.heapTotal),
      external: formatBytes(mem.external),
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
    },
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    cpuUsage: process.cpuUsage(),
  };

  return {
    socket: {
      totalConnections,
      uniqueUsersOnline: userSockets.size,
      connectionsByOrg,
      usersList: usersOnline,
      roomStats,
    },
    system,
    timestamp: new Date().toISOString(),
  };
};

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
};

const formatUptime = (seconds) => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
};

/** Invalidate group members cache (call from controller when members are added/removed/updated) */
const invalidateGroupMembersCache = (groupId) => {
  _groupMembersCache.delete(Number(groupId));
};

module.exports = { initSocket, getIO, emitToUser, isUserOnline, disconnectUser, invalidateOrgControlsCache, invalidateGroupMembersCache, getSocketStats };
