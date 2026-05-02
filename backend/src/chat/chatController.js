const model = require('./chatModel');
const db = require('../config/database');
const { success } = require('../utils/response');
const { signProfileFields, signProfileFieldsArray } = require('../utils/signProfileUrls');
const { signMessageFileUrlsArray } = require('../utils/signFileUrls');
const { isUserOnline } = require('../socket/index');

const resolveUser = (req) => {
  const userId = Number(req.user?.sub);
  const orgId  = Number(req.user?.org);
  if (!Number.isFinite(userId) || userId <= 0) {
    const e = new Error('Valid user context required'); e.status = 401; throw e;
  }
  if (!Number.isFinite(orgId) || orgId <= 0) {
    const e = new Error('Valid organization context required'); e.status = 400; throw e;
  }
  return { userId, orgId };
};

// ─── GET /chat/organizations ──────────────────────────────────────────────────
// All organizations the authenticated user is an active member of.
const getOrganizations = async (req, res, next) => {
  try {
    const { userId } = resolveUser(req);
    const orgs = await model.getUserOrganizations(userId);
    return success(res, { organizations: orgs }, 'Organizations retrieved');
  } catch (err) {
    return next(err);
  }
};

// ─── GET /chat/threads ────────────────────────────────────────────────────────
// Returns all DM + group threads for the authenticated user.
// Accepts optional ?org_id query param to fetch threads for a specific org.
const getThreads = async (req, res, next) => {
  try {
    const { userId, orgId: tokenOrgId } = resolveUser(req);
    // Allow caller to specify a different org (must be one user belongs to — validated by query)
    const requestedOrgId = Number(req.query.org_id);
    const orgId = Number.isFinite(requestedOrgId) && requestedOrgId > 0
      ? requestedOrgId
      : tokenOrgId;

    const [dms, groups] = await Promise.all([
      model.getDMThreads(orgId, userId),
      model.getGroupThreads(orgId, userId),
    ]);

    // Sign S3 profile URLs for DM threads
    await signProfileFieldsArray(dms);

    // Normalize DM threads
    const dmThreads = dms.map((row) => {
      const deviceCity = row.device_city || null;
      const deviceCountry = row.device_country || null;
      const deviceLocation = deviceCity && deviceCountry ? `${deviceCity}, ${deviceCountry}` : deviceCountry || deviceCity || null;
      return {
        id: `dm-${row.other_user_id}`,
        threadType: 'dm',
        isGroup: false,
        user_id: String(row.other_user_id),
        username: row.other_name,
        label: row.other_name,
        email: row.other_email,
        profilePicture: row.other_avatar || null,
        mobile: row.other_mobile || null,
        designation: row.designation_name || null,
        department: row.department_name || null,
        location: row.location_name || deviceLocation || null,
        status: isUserOnline(String(row.other_user_id)) ? 'Online' : 'Offline',
        preview: row.message || row.other_email || '',
        messageType: mapMsgType(row.message_type),
        messageMetadata: row.message_metadata || null,
        readStatus: Number(row.unread_count) > 0 ? 'unread' : 'read',
        unreadCount: Number(row.unread_count),
        ...(row.send_time ? { lastMessageAt: row.send_time, lastActivityAt: row.send_time } : {}),
        lastMessageStatus: row.message_id
          ? (row.read_time ? 'read' : row.delivered_at ? 'delivered' : 'sent')
          : null,
        lastMessageDirection: row.message_id
          ? (Number(row.sender_id) === Number(userId) ? 'outgoing' : 'incoming')
          : null,
        isPinned: false,
        isSelfThread: false,
        isGlobal: Boolean(row.is_global),
        // Device info for Message Info overlay
        device_type: row.device_type === 'other' ? 'Browser' : (row.device_type || 'Browser'),
        operating_system: row.os_name || 'Web',
        user_ip: row.ip_address || '',
        city: deviceCity,
        country: deviceCountry,
      };
    });

    // Sign S3 URLs for group threads (group_image)
    await signProfileFieldsArray(groups);

    // Normalize Group threads
    const groupThreads = groups.map((row) => ({
      id: `group-${row.group_id}`,
      threadType: 'group',
      isGroup: true,
      type: 'group',
      group_id: String(row.group_id),
      user_id: null,
      username: row.group_name,
      label: row.group_name,
      description: row.group_description || '',
      profilePicture: row.group_image || null,
      memberCount: Number(row.member_count),
      members: Array.isArray(row.members) ? row.members : [],
      is_airtime: row.is_airtime,
      preview: buildGroupPreview(row),
      messageType: mapMsgType(row.last_message_type),
      messageMetadata: row.last_message_metadata || null,
      readStatus: Number(row.unread_count) > 0 ? 'unread' : 'read',
      unreadCount: Number(row.unread_count),
      lastMessageAt: row.last_message_at || null,
      lastActivityAt: row.last_message_at || null,
      lastSenderName: row.last_sender_name || null,
      lastMessageStatus: row.last_sender_id
        ? (row.last_message_delivery_status || 'sent')
        : null,
      lastMessageDirection: row.last_sender_id
        ? (Number(row.last_sender_id) === Number(userId) ? 'outgoing' : 'incoming')
        : null,
      isPinned: false,
      isSelfThread: false,
      createdBy: row.created_by ? {
        id: String(row.created_by),
        name: row.creator_name || 'Unknown',
      } : null,
      createdAt: row.group_created_at || null,
      created_at: row.group_created_at || null,
      isAdmin: Boolean(row.current_user_is_admin),
      membershipStatus: row.membership_status || 'active',
      hasLeft: row.membership_status === 'left',
      leftAt: row.membership_status === 'left' ? row.membership_updated_at : null,
      canChat: row.membership_status === 'active' && (!row.is_airtime || Boolean(row.current_user_is_admin)),
    }));

    // Merge and sort by last activity
    const allThreads = [...dmThreads, ...groupThreads].sort((a, b) => {
      const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      return tb - ta;
    });

    return success(res, { threads: allThreads, orgId }, 'Threads retrieved');
  } catch (err) {
    return next(err);
  }
};

// ─── GET /chat/threads/:id/messages ──────────────────────────────────────────
const getMessages = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const threadId = req.params.id;          // e.g. "dm-42" or "group-7"
    const limit  = Math.min(Number(req.query.limit)  || 50, 100);
    const before = req.query.before || null; // ISO timestamp for pagination

    let messages;
    let rawFetchedCount = 0;

    if (threadId.startsWith('dm-')) {
      const otherUserId = Number(threadId.replace('dm-', ''));
      if (!otherUserId) { const e = new Error('Invalid thread id'); e.status = 400; throw e; }
      // Fetch messages + reader's device info in parallel
      const [rows, readerDevice] = await Promise.all([
        model.getDMMessages(orgId, userId, otherUserId, { limit, before }),
        db.query(
          `SELECT device_name, device_type, os_name, ip_address, city, country
           FROM user_devices WHERE user_id = $1 AND status = 'active'
           ORDER BY last_active_at DESC NULLS LAST LIMIT 1`,
          [otherUserId]
        ).then(r => r.rows[0] || {}).catch(() => ({})),
      ]);
      await signProfileFieldsArray(rows);
      const readerGeo = {
        device: readerDevice.device_name || readerDevice.device_type || 'Browser',
        platform: readerDevice.os_name || 'Web',
        location: readerDevice.city && readerDevice.country ? `${readerDevice.city}, ${readerDevice.country}` : readerDevice.country || readerDevice.city || null,
        ip: readerDevice.ip_address || '',
      };
      rawFetchedCount = Number(rows.rawRowCount ?? rows.length);
      messages = rows.map((row) => normalizeDMMessage(row, userId, readerGeo));
    } else if (threadId.startsWith('group-')) {
      const groupId = Number(threadId.replace('group-', ''));
      if (!groupId) { const e = new Error('Invalid thread id'); e.status = 400; throw e; }

      // Check if user has left or been removed — if so, only show messages up to that time
      const memberResult = await db.query(
        `SELECT status, updated_at FROM group_members
         WHERE group_id = $1 AND user_id = $2 AND organization_id = $3`,
        [groupId, userId, orgId]
      );
      const member = memberResult.rows[0];
      const leftAt = ['left', 'kicked'].includes(member?.status) ? member.updated_at : null;

      const rows = await model.getGroupMessages(orgId, groupId, { limit, before, userId, leftAt });
      await signProfileFieldsArray(rows);
      rawFetchedCount = Number(rows.rawRowCount ?? rows.length);
      messages = rows.map((row) => normalizeGroupMessage(row, userId));
    } else {
      const e = new Error('Unknown thread type'); e.status = 400; throw e;
    }

    // Sign S3 file URLs in file messages (fileKey → fresh presigned URL)
    await signMessageFileUrlsArray(messages);

    // hasMore = true if SQL returned a full page (raw count hit the limit);
    // use raw count instead of filtered count so recalled/deleted messages
    // don't incorrectly signal "end of history".
    const hasMore = rawFetchedCount >= limit;

    return success(res, { messages, threadId, hasMore }, 'Messages retrieved');
  } catch (err) {
    return next(err);
  }
};

// ─── POST /chat/threads/:id/messages ─────────────────────────────────────────
const sendMessage = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const threadId   = req.params.id;
    const { message, message_type = 'text', metadata = null } = req.body;

    if (!message && message_type === 'text') {
      const e = new Error('message is required'); e.status = 400; throw e;
    }

    let saved;

    if (threadId.startsWith('dm-')) {
      const otherUserId = Number(threadId.replace('dm-', ''));
      saved = await model.sendDMMessage({
        orgId, senderId: userId, receiverId: otherUserId,
        message, messageType: message_type, metadata,
      });
      return success(res, normalizeDMMessage(saved, userId), 'Message sent', 201);
    }

    if (threadId.startsWith('group-')) {
      const groupId = Number(threadId.replace('group-', ''));
      saved = await model.sendGroupMessage({
        orgId, groupId, senderId: userId,
        message, messageType: message_type, metadata,
      });
      return success(res, normalizeGroupMessage(saved, userId), 'Message sent', 201);
    }

    const e = new Error('Unknown thread type'); e.status = 400; throw e;
  } catch (err) {
    return next(err);
  }
};

// ─── POST /chat/threads/:id/read ─────────────────────────────────────────────
const markRead = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const threadId = req.params.id;

    if (threadId.startsWith('dm-')) {
      const otherUserId = Number(threadId.replace('dm-', ''));
      await model.markDMMessagesRead(orgId, userId, otherUserId);
    } else if (threadId.startsWith('group-')) {
      const groupId = Number(threadId.replace('group-', ''));
      await model.markGroupMessagesRead(orgId, groupId, userId);
    }

    return success(res, null, 'Marked as read');
  } catch (err) {
    return next(err);
  }
};

// ─── PATCH /chat/messages/:id ─────────────────────────────────────────────────
const editMessage = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const messageId = Number(req.params.id);
    const { message } = req.body;

    if (!message) { const e = new Error('message is required'); e.status = 400; throw e; }

    const updated = await model.editDMMessage(messageId, orgId, userId, message);
    if (!updated) { const e = new Error('Message not found or no permission'); e.status = 404; throw e; }

    return success(res, normalizeDMMessage(updated, userId), 'Message updated');
  } catch (err) {
    return next(err);
  }
};

// ─── DELETE /chat/messages/:id ────────────────────────────────────────────────
const deleteMessage = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const messageId = Number(req.params.id);

    const deleted = await model.deleteDMMessage(messageId, orgId, userId);
    if (!deleted) { const e = new Error('Message not found or no permission'); e.status = 404; throw e; }

    // Log delete action so message is hidden for this user on next fetch
    await db.query(
      `INSERT INTO message_actions (message_id, user_id, action_type) VALUES ($1, $2, 'delete')`,
      [messageId, userId]
    );

    return success(res, { message_id: messageId }, 'Message deleted');
  } catch (err) {
    return next(err);
  }
};

// ─── GET /chat/contacts ───────────────────────────────────────────────────────
const getContacts = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const contacts = await model.getContacts(orgId, userId);
    await signProfileFieldsArray(contacts);
    return success(res, { contacts }, 'Contacts retrieved');
  } catch (err) {
    return next(err);
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mapMsgType = (dbType) => {
  const t = (dbType || 'text').toLowerCase();
  if (['file', 'image', 'video', 'audio'].includes(t)) return 'file';
  if (t === 'link') return 'link';
  if (t === 'code') return 'code';
  if (t === 'system') return 'system';
  return 'message';
};

const buildGroupPreview = (row) => {
  if (!row.last_message) return '';
  const prefix = row.last_sender_name ? `${row.last_sender_name.split(' ')[0]}: ` : '';
  return `${prefix}${row.last_message}`;
};

const normalizeDMMessage = (row, currentUserId, readerGeo = {}) => {
  const meta = row.message_metadata || {};
  const sentAt = (row.send_time || row.created_at)?.toISOString?.() ?? String(row.send_time || row.created_at);
  const editedAt = row.edit_time ? (row.edit_time?.toISOString?.() ?? String(row.edit_time)) : null;
  const readTimeIso = row.read_time ? (row.read_time?.toISOString?.() ?? String(row.read_time)) : null;
  const isOutgoing = Number(row.sender_id) === Number(currentUserId);

  // Build real receipts from DB data (receiver info + device geo)
  const otherName = isOutgoing ? (row.receiver_name || '') : (row.sender_name || '');
  const otherAvatar = isOutgoing ? (row.receiver_avatar || null) : (row.sender_avatar || null);
  const otherId = String(isOutgoing ? row.receiver_id : row.sender_id);
  const sentFrom = meta.sentFrom || null;
  const senderLocation = sentFrom ? (sentFrom.city && sentFrom.country ? `${sentFrom.city}, ${sentFrom.country}` : sentFrom.country || sentFrom.city || null) : null;

  const deliveredAtIso = row.delivered_at ? (row.delivered_at?.toISOString?.() ?? String(row.delivered_at)) : null;
  const receipts = { read: [], delivered: [] };
  if (isOutgoing) {
    const entry = {
      id: otherId, name: otherName, avatar: otherAvatar,
      deliveredAt: deliveredAtIso || null,
      device: readerGeo.device || 'Browser',
      platform: readerGeo.platform || 'Web',
      location: readerGeo.location || null,
      user_ip: readerGeo.ip || '',
    };
    if (readTimeIso) {
      receipts.read.push({ ...entry, readAt: readTimeIso });
      receipts.delivered.push(entry);
    } else if (deliveredAtIso) {
      receipts.delivered.push(entry);
    }
  }

  return {
    id: String(row.message_id),
    type: (row.message_type || 'text').toLowerCase(),
    direction: isOutgoing ? 'outgoing' : 'incoming',
    author: {
      id: String(row.sender_id),
      name: row.sender_name || '',
      avatar: row.sender_avatar || null,
    },
    content: buildContent(row),
    metadata: {
      ...meta,
      // All 3 DB timestamps for Message Info overlay
      sentAt,
      readAt: readTimeIso,
      ...(editedAt ? { editedAt } : {}),
      ...(senderLocation ? { senderLocation } : {}),
      ...(meta.forwarded ? { forwarded: true, forwardedBy: meta.forwardedBy || '', isForwarded: true } : {}),
      receipts,
    },
    createdAt: sentAt,
    editedAt,
    readAt: readTimeIso,
    status: row.read_time ? 'read' : row.delivered_at ? 'delivered' : 'sent',
  };
};

const normalizeGroupMessage = (row, currentUserId) => {
  const meta = row.message_metadata || {};
  const sentAt = row.created_at?.toISOString?.() ?? String(row.created_at);
  // Compare by timestamp value — Date objects are never === even with same time
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
    status: row.delivery_status || (Number(row.sender_id) === Number(currentUserId) ? 'sent' : null),
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
  // File/media/link/code types need their metadata fields for rendering
  const fileTypes = ['file', 'image', 'video', 'audio'];
  if (fileTypes.includes(row.message_type)) {
    const { sentFrom, editHistory, html, ...fileFields } = meta;
    const rawSize = Number(meta.fileSize || meta.file_size || 0);
    const formattedSize = rawSize > 0 ? humanFileSize(rawSize) : (meta.fileSize || '');
    return { fileName: meta.fileName || '', fileUrl: meta.fileUrl || row.message, ...fileFields, fileSize: formattedSize, rawSize };
  }
  if (row.message_type === 'link') {
    const { sentFrom, editHistory, html, ...linkFields } = meta;
    return { url: row.message, ...linkFields };
  }
  if (row.message_type === 'code') {
    const { sentFrom, editHistory, html, ...codeFields } = meta;
    return { code: row.message, ...codeFields };
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

// ─── GET /chat/search ────────────────────────────────────────────────────────
const searchMessages = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const q = String(req.query.q || '').trim().toLowerCase();
    const threadId = req.query.threadId || null;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    // Type filter: comma-separated list e.g. "image,video,file"
    const typeFilter = req.query.types ? String(req.query.types).toLowerCase().split(',').map(t => t.trim()).filter(Boolean) : null;

    // Allow search with just type filter (no text query needed)
    if ((!q || q.length < 2) && !typeFilter) {
      const e = new Error('Search query (min 2 chars) or type filter is required');
      e.status = 400;
      throw e;
    }

    let allRows = [];

    if (threadId) {
      // Search within a specific thread
      if (threadId.startsWith('dm-')) {
        const otherUserId = Number(threadId.replace('dm-', ''));
        allRows = await model.searchDMMessages(orgId, userId, otherUserId, { limit: 1000 });
      } else if (threadId.startsWith('group-')) {
        const groupId = Number(threadId.replace('group-', ''));
        allRows = await model.searchGroupMessages(orgId, groupId, { limit: 1000, userId });
      }
    } else {
      // Global search across all threads
      const [dmRows, groupRows] = await Promise.all([
        model.searchAllDMMessages(orgId, userId, { limit: 500 }),
        model.searchAllGroupMessages(orgId, userId, { limit: 500 }),
      ]);
      allRows = [...dmRows, ...groupRows];
    }

    // Normalize DB message_type to frontend filter keys
    const normalizeType = (dbType) => {
      const t = (dbType || 'text').toLowerCase();
      if (['text', 'emoji'].includes(t)) return 'text';
      if (t === 'image') return 'image';
      if (t === 'video') return 'video';
      if (t === 'audio') return 'audio';
      if (t === 'file') return 'file';
      if (t === 'link') return 'link';
      if (t === 'code') return 'code';
      if (t === 'location') return 'location';
      return 'text';
    };

    // Filter by type and/or text query
    // Search across: message text, fileName, caption, title, description, url, code, language, filename(code)
    const matched = [];
    for (const row of allRows) {
      if (matched.length >= limit) break;
      const meta = row.message_metadata || {};
      // Skip recalled/deleted messages
      if (meta.recalled || meta.deleted) continue;
      const searchFields = [
        row.message,                    // message text / URL for links / code content
        meta.fileName,                  // file name (image, video, doc, etc.)
        meta.caption,                   // file/image caption
        meta.title,                     // link title
        meta.description,               // link description
        meta.url,                       // link URL
        meta.displayHost,               // link host (e.g. "bing.com")
        meta.code,                      // code snippet content
        meta.language,                  // code language (js, python, etc.)
        meta.filename,                  // code filename
        meta.fileType,                  // file MIME type
        meta.mimeType,                  // media MIME type
      ].filter(Boolean).join(' ').toLowerCase();

      // Type filter
      if (typeFilter && !typeFilter.includes(normalizeType(row.message_type))) continue;

      // Text filter (skip if no text query)
      if (q && q.length >= 2 && !searchFields.includes(q)) continue;

      // Use the same normalize functions as getMessages so results render identically
      const isDM = Boolean(row.message_id);
      const threadKey = isDM
        ? `dm-${Number(row.sender_id) === Number(userId) ? row.receiver_id : row.sender_id}`
        : `group-${row.group_id}`;

      let normalized;
      if (isDM) {
        normalized = normalizeDMMessage(row, userId);
      } else {
        normalized = normalizeGroupMessage(row, userId);
      }
      normalized.threadId = threadKey;
      if (row.group_name) normalized.groupName = row.group_name;

      matched.push(normalized);
    }

    // Sign S3 file URLs so images/files render properly
    await signMessageFileUrlsArray(matched);

    return success(res, { results: matched, query: q, total: matched.length }, 'Search results');
  } catch (err) {
    return next(err);
  }
};

// ─── GET /chat/threads/:id/media — Images, Media, Links, Docs from full DB ──
const getThreadMedia = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const threadId = req.params.id;
    const type = req.query.type || 'all'; // images, media, links, docs, pinned, all
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    const isDM = threadId.startsWith('dm-');
    let allRows = [];
    if (isDM) {
      const otherUserId = Number(threadId.replace('dm-', ''));
      if (!otherUserId) { const e = new Error('Invalid thread id'); e.status = 400; throw e; }
      allRows = await model.searchDMMessages(orgId, userId, otherUserId, { limit: 2000 });
    } else if (threadId.startsWith('group-')) {
      const groupId = Number(threadId.replace('group-', ''));
      if (!groupId) { const e = new Error('Invalid thread id'); e.status = 400; throw e; }
      allRows = await model.searchGroupMessages(orgId, groupId, { limit: 2000, userId });
    } else {
      const e = new Error('Unknown thread type'); e.status = 400; throw e;
    }

    // Per-user pinned message IDs from message_actions table
    let userPinnedIds = new Set();
    if (allRows.length) {
      const actionsTable = isDM ? 'message_actions' : 'group_message_actions';
      const actionsIdCol = isDM ? 'message_id' : 'group_message_id';
      const msgIds = allRows.map((r) => r[isDM ? 'message_id' : 'group_message_id']);
      const { rows: pinRows } = await db.query(
        `SELECT ${actionsIdCol} FROM ${actionsTable}
         WHERE ${actionsIdCol} = ANY($1) AND user_id = $2 AND action_type = 'pin'`,
        [msgIds, userId]
      );
      userPinnedIds = new Set(pinRows.map((r) => r[actionsIdCol]));
    }

    // Filter by type
    const idField = isDM ? 'message_id' : 'group_message_id';
    const typeMap = {
      images: (r) => r.message_type === 'image',
      media: (r) => ['video', 'audio'].includes(r.message_type),
      links: (r) => r.message_type === 'link',
      docs: (r) => ['file', 'code'].includes(r.message_type),
      pinned: (r) => userPinnedIds.has(r[idField]),
      all: (r) => ['image', 'video', 'audio', 'link', 'file', 'code'].includes(r.message_type),
    };

    const filterFn = typeMap[type] || typeMap.all;
    const filtered = allRows
      .filter((r) => {
        const meta = r.message_metadata || {};
        if (meta.recalled) return false;
        return filterFn(r);
      })
      .slice(0, limit);

    // Normalize using same functions as getMessages
    const messages = filtered.map((row) =>
      isDM ? normalizeDMMessage(row, userId) : normalizeGroupMessage(row, userId)
    );

    // Sign S3 URLs for file messages
    await signMessageFileUrlsArray(messages);

    // Counts for all types (for tab labels)
    const counts = {
      images: 0, media: 0, links: 0, docs: 0, pinned: 0,
    };
    for (const row of allRows) {
      const meta = row.message_metadata || {};
      if (meta.recalled) continue;
      if (row.message_type === 'image') counts.images++;
      else if (['video', 'audio'].includes(row.message_type)) counts.media++;
      else if (row.message_type === 'link') counts.links++;
      else if (['file', 'code'].includes(row.message_type)) counts.docs++;
      if (userPinnedIds.has(row[idField])) counts.pinned++;
    }

    return success(res, { messages, counts, type }, 'Thread media retrieved');
  } catch (err) {
    return next(err);
  }
};

// ─── POST /chat/smart-search — AI-powered natural language search ─────────────
const smartSearch = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const { query, threadId } = req.body;
    const limit = Math.min(Number(req.body.limit) || 50, 100);

    if (!query || query.length < 3) {
      const e = new Error('Query must be at least 3 characters');
      e.status = 400;
      throw e;
    }

    // Step 1: Use AI to parse natural language query into structured filters
    const aiProviderModel = require('../models/aiProviderModel');
    const activeProvider = await aiProviderModel.getActiveProvider();
    if (!activeProvider || !activeProvider.api_key) {
      const e = new Error('No active AI provider configured'); e.status = 503; throw e;
    }
    const apiKey = activeProvider.api_key;
    const geminiModel = activeProvider.model || 'gemini-2.0-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

    const aiPrompt = `You are a search query parser for a team chat application. Parse the user's natural language search query into structured filters.

Return ONLY a JSON object with these fields:
- "keywords": array of search keywords to match in message text (extract the core words to search for)
- "types": array of message types to filter (from: "text", "image", "video", "audio", "file", "link", "code"). Empty array = all types.
- "senderName": string - if query mentions a specific person's name, extract it. Empty string if not.
- "dateRange": string - "today", "yesterday", "last7", "last30", "thisMonth", "thisYear", or "" for no date filter.
- "intent": string - brief description of what user is looking for (for display)

Examples:
"Bhavesh ne last week kya files share ki thi?" → {"keywords":[],"types":["file","image","video","audio"],"senderName":"Bhavesh","dateRange":"last7","intent":"Files shared by Bhavesh last week"}
"show me all images" → {"keywords":[],"types":["image"],"senderName":"","dateRange":"","intent":"All images"}
"hosting access wala message" → {"keywords":["hosting","access"],"types":[],"senderName":"","dateRange":"","intent":"Messages about hosting access"}
"links shared today" → {"keywords":[],"types":["link"],"senderName":"","dateRange":"today","intent":"Links shared today"}
"code snippets from Hardik" → {"keywords":[],"types":["code"],"senderName":"Hardik","dateRange":"","intent":"Code shared by Hardik"}

User query: "${query}"
JSON only:`;

    const aiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: aiPrompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
      }),
    });

    if (!aiRes.ok) {
      const body = await aiRes.text().catch(() => '');
      throw Object.assign(new Error(`AI parse error: ${aiRes.status} ${body}`), { status: 502 });
    }

    const aiData = await aiRes.json();
    const rawText = (aiData?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    const cleaned = rawText.replace(/```json\s*/g, '').replace(/```/g, '').trim();
    let filters;
    try { filters = JSON.parse(cleaned); } catch {
      filters = { keywords: [query], types: [], senderName: '', dateRange: '', intent: query };
    }

    // Step 2: Fetch messages from DB
    let allRows = [];
    if (threadId) {
      if (threadId.startsWith('dm-')) {
        const otherUserId = Number(threadId.replace('dm-', ''));
        allRows = await model.searchDMMessages(orgId, userId, otherUserId, { limit: 1000 });
      } else if (threadId.startsWith('group-')) {
        const groupId = Number(threadId.replace('group-', ''));
        allRows = await model.searchGroupMessages(orgId, groupId, { limit: 1000, userId });
      }
    } else {
      const [dmRows, groupRows] = await Promise.all([
        model.searchAllDMMessages(orgId, userId, { limit: 500 }),
        model.searchAllGroupMessages(orgId, userId, { limit: 500 }),
      ]);
      allRows = [...dmRows, ...groupRows];
    }

    // Step 3: Apply AI-parsed filters
    const normalizeType = (t) => {
      const v = (t || 'text').toLowerCase();
      if (['text', 'emoji'].includes(v)) return 'text';
      return v;
    };

    const buildDateRange = (filter) => {
      const now = new Date();
      const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (filter === 'today') return { start: startOfDay(now), end: now };
      if (filter === 'yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); return { start: startOfDay(y), end: startOfDay(now) }; }
      if (filter === 'last7') { const s = new Date(now); s.setDate(s.getDate() - 7); return { start: s, end: now }; }
      if (filter === 'last30') { const s = new Date(now); s.setDate(s.getDate() - 30); return { start: s, end: now }; }
      if (filter === 'thisMonth') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
      if (filter === 'thisYear') return { start: new Date(now.getFullYear(), 0, 1), end: now };
      return null;
    };

    const dateConstraint = filters.dateRange ? buildDateRange(filters.dateRange) : null;
    const typeSet = filters.types?.length ? new Set(filters.types) : null;
    const senderFilter = (filters.senderName || '').toLowerCase();
    const keywords = (filters.keywords || []).map(k => k.toLowerCase());

    const matched = [];
    for (const row of allRows) {
      if (matched.length >= limit) break;
      const meta = row.message_metadata || {};
      if (meta.recalled || meta.deleted) continue;

      // Type filter
      if (typeSet && !typeSet.has(normalizeType(row.message_type))) continue;

      // Sender filter
      if (senderFilter) {
        const name = (row.sender_name || '').toLowerCase();
        if (!name.includes(senderFilter)) continue;
      }

      // Date filter
      if (dateConstraint) {
        const ts = row.send_time || row.created_at;
        if (ts) {
          const msgDate = new Date(ts);
          if (dateConstraint.start && msgDate < dateConstraint.start) continue;
          if (dateConstraint.end && msgDate > dateConstraint.end) continue;
        }
      }

      // Keyword filter
      if (keywords.length) {
        const searchText = [row.message, meta.fileName, meta.caption, meta.title, meta.description, meta.url]
          .filter(Boolean).join(' ').toLowerCase();
        const allMatch = keywords.every(k => searchText.includes(k));
        if (!allMatch) continue;
      }

      const isDM = Boolean(row.message_id);
      const threadKey = isDM
        ? `dm-${Number(row.sender_id) === Number(userId) ? row.receiver_id : row.sender_id}`
        : `group-${row.group_id}`;

      let normalized;
      if (isDM) {
        normalized = normalizeDMMessage(row, userId);
      } else {
        normalized = normalizeGroupMessage(row, userId);
      }
      normalized.threadId = threadKey;
      matched.push(normalized);
    }

    await signMessageFileUrlsArray(matched);

    return success(res, {
      results: matched,
      filters,
      total: matched.length,
    }, 'Smart search results');
  } catch (err) {
    return next(err);
  }
};

// ─── POST /chat/groups/create ─────────────────────────────────────────────────
// Creates group + adds all members in a single transaction
const createGroupWithMembers = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const { name, description, members: memberIds } = req.body;

    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      const e = new Error('Group name is required'); e.status = 400; throw e;
    }
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      const e = new Error('At least one member is required'); e.status = 400; throw e;
    }

    const result = await db.withTransaction(async (tx) => {
      // 1. Create group
      const { rows: groupRows } = await tx.query(
        `INSERT INTO groups (organization_id, group_name, group_description, created_by, status)
         VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
        [orgId, trimmedName, description || '', userId]
      );
      const group = groupRows[0];
      const groupId = group.group_id;

      // 2. Add creator as admin member
      const uniqueMembers = [...new Set([userId, ...memberIds.map(Number)])];
      for (const memberId of uniqueMembers) {
        const isAdmin = memberId === userId;
        await tx.query(
          `INSERT INTO group_members (group_id, user_id, organization_id, is_admin, status)
           VALUES ($1, $2, $3, $4, 'active') ON CONFLICT (group_id, user_id) DO NOTHING`,
          [groupId, memberId, orgId, isAdmin]
        );
      }

      // 3. Create timeline event
      await tx.query(
        `INSERT INTO group_timeline (group_id, actor_user_id, event_type, event_description, organization_id, status)
         VALUES ($1, $2, 'group_created', $3, $4, 'visible')`,
        [groupId, userId, `Group "${trimmedName}" created`, orgId]
      );

      return { group, memberCount: uniqueMembers.length };
    });

    // Invalidate group members cache
    const { invalidateGroupMembersCache } = require('../socket');
    invalidateGroupMembersCache(result.group.group_id);

    return success(res, {
      group: result.group,
      groupId: result.group.group_id,
      threadId: `group-${result.group.group_id}`,
      memberCount: result.memberCount,
    }, 'Group created', 201);
  } catch (err) {
    return next(err);
  }
};

// ─── POST /chat/groups/:groupId/leave ─────────────────────────────────────────
const leaveGroup = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const groupId = Number(req.params.groupId);
    if (!groupId) {
      const e = new Error('Invalid group ID'); e.status = 400; throw e;
    }

    await db.withTransaction(async (tx) => {
      // Update member status to 'left'
      const { rows } = await tx.query(
        `UPDATE group_members SET status = 'left', updated_at = NOW()
         WHERE group_id = $1 AND user_id = $2 AND organization_id = $3 AND status = 'active'
         RETURNING group_member_id`,
        [groupId, userId, orgId]
      );
      if (!rows.length) {
        const e = new Error('Not a member of this group'); e.status = 404; throw e;
      }

      // Get user name for timeline
      const { rows: userRows } = await tx.query('SELECT name FROM users WHERE user_id = $1', [userId]);
      const userName = userRows[0]?.name || 'Unknown';

      // Add timeline event
      await tx.query(
        `INSERT INTO group_timeline (group_id, actor_user_id, event_type, event_description, organization_id, status)
         VALUES ($1, $2, 'member_left', $3, $4, 'visible')`,
        [groupId, userId, `${userName} left the group`, orgId]
      );
    });

    // Invalidate cache
    const { invalidateGroupMembersCache } = require('../socket');
    invalidateGroupMembersCache(groupId);

    return success(res, { groupId, status: 'left' }, 'Left group successfully');
  } catch (err) {
    return next(err);
  }
};

// ─── POST /chat/groups/:groupId/hide ──────────────────────────────────────────
// Soft-hide a group thread from this user's chat list. Does NOT leave/delete
// the group; only flips `hidden_from_list = TRUE` on the caller's membership
// row so the thread list query filters it out. Idempotent.
const hideGroupThread = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const groupId = Number(req.params.groupId);
    if (!groupId) {
      const e = new Error('Invalid group ID'); e.status = 400; throw e;
    }

    const { rows } = await db.query(
      `UPDATE group_members
         SET hidden_from_list = TRUE, updated_at = NOW()
         WHERE group_id = $1 AND user_id = $2 AND organization_id = $3
         RETURNING group_member_id, status`,
      [groupId, userId, orgId]
    );
    if (!rows.length) {
      const e = new Error('Not a member of this group'); e.status = 404; throw e;
    }

    return success(
      res,
      { groupId, hidden: true, membershipStatus: rows[0].status },
      'Group thread hidden'
    );
  } catch (err) {
    return next(err);
  }
};

// ─── POST /chat/groups/:groupId/unhide ────────────────────────────────────────
// Inverse of hideGroupThread. Useful for "show deleted chats" flows.
const unhideGroupThread = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const groupId = Number(req.params.groupId);
    if (!groupId) {
      const e = new Error('Invalid group ID'); e.status = 400; throw e;
    }

    const { rows } = await db.query(
      `UPDATE group_members
         SET hidden_from_list = FALSE, updated_at = NOW()
         WHERE group_id = $1 AND user_id = $2 AND organization_id = $3
         RETURNING group_member_id`,
      [groupId, userId, orgId]
    );
    if (!rows.length) {
      const e = new Error('Not a member of this group'); e.status = 404; throw e;
    }

    return success(res, { groupId, hidden: false }, 'Group thread restored');
  } catch (err) {
    return next(err);
  }
};

// ─── GET /chat/groups/:groupId/timeline ───────────────────────────────────────
const getGroupTimeline = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const groupId = Number(req.params.groupId);
    if (!groupId) {
      const e = new Error('Invalid group ID'); e.status = 400; throw e;
    }
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const { rows } = await db.query(
      `SELECT gt.timeline_id, gt.event_type, gt.event_description,
              gt.actor_user_id, u.name AS actor_name, gt.target_user_id,
              tu.name AS target_name, gt.created_at
       FROM group_timeline gt
       LEFT JOIN users u ON u.user_id = gt.actor_user_id
       LEFT JOIN users tu ON tu.user_id = gt.target_user_id
       WHERE gt.group_id = $1 AND gt.organization_id = $2 AND gt.status = 'visible'
       ORDER BY gt.created_at DESC
       LIMIT $3 OFFSET $4`,
      [groupId, orgId, limit, offset]
    );

    return success(res, { timeline: rows, groupId }, 'Timeline retrieved');
  } catch (err) {
    return next(err);
  }
};

// ─── GET /chat/groups/:groupId/info ───────────────────────────────────────────
const getGroupInfo = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const groupId = Number(req.params.groupId);
    if (!groupId) {
      const e = new Error('Invalid group ID'); e.status = 400; throw e;
    }

    const { rows: groupRows } = await db.query(
      `SELECT g.*, creator.name AS creator_name,
              (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.group_id AND gm.status = 'active') AS member_count
       FROM groups g
       LEFT JOIN users creator ON creator.user_id = g.created_by
       WHERE g.group_id = $1 AND g.organization_id = $2`,
      [groupId, orgId]
    );
    if (!groupRows.length) {
      const e = new Error('Group not found'); e.status = 404; throw e;
    }

    // Get current user's membership
    const { rows: memberRows } = await db.query(
      `SELECT status, is_admin FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId]
    );
    const membership = memberRows[0] || { status: 'none', is_admin: false };

    const group = groupRows[0];
    return success(res, {
      group: {
        ...group,
        creator_name: group.creator_name,
        member_count: Number(group.member_count),
      },
      membership: {
        status: membership.status,
        isAdmin: Boolean(membership.is_admin),
        canChat: membership.status === 'active' && (!group.is_airtime || Boolean(membership.is_admin)),
      },
    }, 'Group info retrieved');
  } catch (err) {
    return next(err);
  }
};

// ─── GET /chat/exchange-info — Message/file/image/video counts with date filter
const getExchangeInfo = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const period = req.query.period || 'all';

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const periodMap = {
      today: todayStart,
      yesterday: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
      '7d': new Date(Date.now() - 7 * 86400000),
      '30d': new Date(Date.now() - 30 * 86400000),
      month: new Date(now.getFullYear(), now.getMonth(), 1),
      year: new Date(now.getFullYear(), 0, 1),
    };
    const since = periodMap[period] || null;

    // Use parameterized queries — $2 is the date filter (or epoch start for "all")
    const sinceDate = since || new Date('1970-01-01');

    const dmQuery = `
      SELECT
        COUNT(*) FILTER (WHERE m.message_type = 'text') AS text_count,
        COUNT(*) FILTER (WHERE m.message_type = 'file') AS file_count,
        COUNT(*) FILTER (WHERE m.message_type = 'image') AS image_count,
        COUNT(*) FILTER (WHERE m.message_type = 'video') AS video_count,
        COUNT(*) FILTER (WHERE m.message_type = 'audio') AS audio_count,
        COUNT(*) FILTER (WHERE m.message_type = 'link') AS link_count,
        COUNT(*) AS total,
        COALESCE(SUM(mf.file_size), 0) AS total_file_size
      FROM messages m
      LEFT JOIN message_files mf ON mf.message_id = m.message_id
      WHERE m.organization_id = $1 AND m.message IS NOT NULL AND m.send_time >= $2
    `;

    const gmQuery = `
      SELECT
        COUNT(*) FILTER (WHERE gm.message_type = 'text') AS text_count,
        COUNT(*) FILTER (WHERE gm.message_type = 'file') AS file_count,
        COUNT(*) FILTER (WHERE gm.message_type = 'image') AS image_count,
        COUNT(*) FILTER (WHERE gm.message_type = 'video') AS video_count,
        COUNT(*) FILTER (WHERE gm.message_type = 'audio') AS audio_count,
        COUNT(*) FILTER (WHERE gm.message_type = 'link') AS link_count,
        COUNT(*) AS total,
        COALESCE(SUM(gmf.file_size), 0) AS total_file_size
      FROM group_messages gm
      LEFT JOIN group_message_files gmf ON gmf.group_message_id = gm.group_message_id
      WHERE gm.organization_id = $1 AND gm.message IS NOT NULL AND gm.created_at >= $2
    `;

    const [dmResult, gmResult] = await Promise.all([
      db.query(dmQuery, [orgId, sinceDate]),
      db.query(gmQuery, [orgId, sinceDate]),
    ]);

    const dm = dmResult.rows[0] || {};
    const gm = gmResult.rows[0] || {};

    const add = (a, b) => Number(a || 0) + Number(b || 0);
    const totalSize = add(dm.total_file_size, gm.total_file_size);

    const formatSize = (bytes) => {
      const n = Number(bytes);
      if (!n || n <= 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
      const val = n / Math.pow(1024, i);
      return `${i === 0 ? val : val.toFixed(val < 10 ? 2 : 1)} ${units[i]}`;
    };

    return success(res, {
      period,
      messages: add(dm.text_count, gm.text_count),
      files: add(dm.file_count, gm.file_count),
      images: add(dm.image_count, gm.image_count),
      videos: add(dm.video_count, gm.video_count),
      audios: add(dm.audio_count, gm.audio_count),
      links: add(dm.link_count, gm.link_count),
      total: add(dm.total, gm.total),
      total_file_size: totalSize,
      total_file_size_label: formatSize(totalSize),
    }, 'Exchange info retrieved');
  } catch (err) {
    return next(err);
  }
};

// ─── Export Chat ──────────────────────────────────────────────────────────────
const exportChat = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const threadId = req.params.id;

    let messages = [];
    let chatLabel = 'Chat';

    if (threadId.startsWith('dm-')) {
      const otherUserId = Number(threadId.replace('dm-', ''));
      if (!otherUserId) { const e = new Error('Invalid thread id'); e.status = 400; throw e; }

      // Get other user's name
      const userRes = await db.query('SELECT name FROM users WHERE user_id = $1', [otherUserId]);
      chatLabel = userRes.rows[0]?.name || `User ${otherUserId}`;

      // Fetch all messages (large limit for export)
      const rows = await model.getDMMessages(orgId, userId, otherUserId, { limit: 10000 });
      messages = rows.map((row) => ({
        sender: Number(row.sender_id) === userId ? 'You' : (row.sender_name || chatLabel),
        content: row.message || '',
        type: row.message_type || 'text',
        time: row.created_at ? new Date(row.created_at).toLocaleString() : '',
      }));
    } else if (threadId.startsWith('group-')) {
      const groupId = Number(threadId.replace('group-', ''));
      if (!groupId) { const e = new Error('Invalid thread id'); e.status = 400; throw e; }

      const groupRes = await db.query('SELECT group_name FROM groups WHERE group_id = $1', [groupId]);
      chatLabel = groupRes.rows[0]?.group_name || `Group ${groupId}`;

      const rows = await model.getGroupMessages(orgId, groupId, { limit: 10000, userId });
      messages = rows.map((row) => ({
        sender: Number(row.sender_id) === userId ? 'You' : (row.sender_name || 'Unknown'),
        content: row.message || '',
        type: row.message_type || 'text',
        time: row.created_at ? new Date(row.created_at).toLocaleString() : '',
      }));
    } else {
      const e = new Error('Unknown thread type'); e.status = 400; throw e;
    }

    const lines = [
      `# Chat Export: ${chatLabel}`,
      `Exported: ${new Date().toLocaleString()}`,
      `Messages: ${messages.length}`,
      '',
      '---',
      '',
    ];

    for (const msg of messages) {
      const typeTag = msg.type !== 'text' ? ` [${msg.type}]` : '';
      lines.push(`**${msg.sender}** (${msg.time})${typeTag}:`);
      lines.push(msg.content || `[${msg.type}]`);
      lines.push('');
    }

    const text = lines.join('\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="chat-export-${threadId}.txt"`);
    return res.send(text);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getOrganizations,
  getThreads,
  getMessages,
  sendMessage,
  markRead,
  editMessage,
  deleteMessage,
  getContacts,
  searchMessages,
  getThreadMedia,
  smartSearch,
  createGroupWithMembers,
  leaveGroup,
  hideGroupThread,
  unhideGroupThread,
  getGroupTimeline,
  getGroupInfo,
  getExchangeInfo,
  exportChat,
};
