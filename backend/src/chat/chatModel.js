const db = require('../config/database');
const { encryptMessage, decryptMessage, encryptMetadata, decryptMetadata } = require('../utils/messageCipher');

/**
 * Build a Map<messageId, reactions[]> from raw action rows.
 * action_type format: 'react:😊'
 */
const buildReactionMap = (reactionRows) => {
  const map = new Map();
  for (const row of reactionRows) {
    const msgId = Number(row.message_id);
    const emoji = (row.action_type || '').replace('react:', '');
    if (!emoji) continue;
    if (!map.has(msgId)) map.set(msgId, []);
    const reactions = map.get(msgId);
    let entry = reactions.find((r) => r.emoji === emoji);
    if (!entry) {
      entry = { emoji, users: [] };
      reactions.push(entry);
    }
    entry.users.push({ id: String(row.user_id), name: row.user_name || '' });
  }
  return map;
};

// ─── Thread List ───────────────────────────────────────────────────────────────

/**
 * Fetch all 1:1 conversation threads for a user.
 * Returns ALL active org members (excluding self) with their last message if any.
 * Members with no message history are included with NULL message fields.
 */
const getDMThreads = async (orgId, userId) => {
  const query = `
    SELECT
      u.user_id             AS other_user_id,
      u.name                AS other_name,
      u.email               AS other_email,
      u.profile_url         AS other_avatar,
      u.status              AS other_status,
      u.mobile              AS other_mobile,
      dept.name             AS department_name,
      desig.name            AS designation_name,
      loc.label             AS location_name,
      lm.message_id,
      lm.sender_id,
      lm.receiver_id,
      lm.message,
      lm.message_type,
      lm.message_metadata,
      lm.send_time,
      lm.read_time,
      lm.delivered_at,
      COALESCE(uc.unread_count, 0) AS unread_count,
      dev.device_name       AS device_name,
      dev.device_type       AS device_type,
      dev.os_name           AS os_name,
      dev.ip_address        AS ip_address,
      dev.city              AS device_city,
      dev.country           AS device_country,
      COALESCE(u.is_global_member, false) AS is_global
    FROM organization_members om
    JOIN users u ON u.user_id = om.user_id
    LEFT JOIN departments  dept  ON dept.department_id  = om.department_id
    LEFT JOIN designations desig ON desig.designation_id = om.designation_id
    LEFT JOIN locations    loc   ON loc.location_id      = om.location_id
    -- Latest active device for device/geo info
    LEFT JOIN LATERAL (
      SELECT device_name, device_type, os_name, ip_address, city, country
      FROM user_devices
      WHERE user_id = u.user_id AND status = 'active'
      ORDER BY last_active_at DESC NULLS LAST
      LIMIT 1
    ) dev ON TRUE
    -- Pre-aggregated unread counts (excludes recalled messages where message=NULL)
    LEFT JOIN (
      SELECT sender_id, COUNT(*) AS unread_count
      FROM messages
      WHERE organization_id = $1 AND receiver_id = $2 AND read_time IS NULL
        AND message IS NOT NULL
      GROUP BY sender_id
    ) uc ON uc.sender_id = u.user_id
    LEFT JOIN LATERAL (
      SELECT message_id, sender_id, receiver_id, message, message_type,
             message_metadata, send_time, read_time, delivered_at
      FROM messages
      WHERE organization_id = $1
        AND (
          (sender_id = $2 AND receiver_id = u.user_id)
          OR (sender_id = u.user_id AND receiver_id = $2)
        )
      ORDER BY send_time DESC
      LIMIT 1
    ) lm ON TRUE
    WHERE om.organization_id = $1
      AND om.status = 'active'
      AND om.user_id != $2
      -- Global member visibility: if user is global, only show to allowed chat partners
      AND (
        COALESCE(u.is_global_member, false) = false
        OR EXISTS (
          SELECT 1 FROM global_access ga
          WHERE ga.org_id = $1 AND ga.user_id = om.user_id AND ga.allow_user_id = $2
            AND ga.status = 'active'
        )
      )
    ORDER BY lm.send_time DESC NULLS LAST, u.name ASC
  `;
  const { rows } = await db.query(query, [orgId, userId]);
  // Decrypt last message preview + metadata
  rows.forEach((r) => {
    if (r.message) r.message = decryptMessage(r.message);
    if (r.message_metadata) r.message_metadata = decryptMetadata(r.message_metadata);
  });
  return rows;
};

/**
 * Fetch all group threads the user belongs to.
 */
const getGroupThreads = async (orgId, userId) => {
  const query = `
    SELECT
      g.group_id,
      g.group_name,
      g.group_description,
      g.group_image,
      g.created_by,
      g.created_at AS group_created_at,
      g.is_airtime,
      gm.is_admin AS current_user_is_admin,
      gm.status AS membership_status,
      gm.updated_at AS membership_updated_at,
      creator.name AS creator_name,
      (
        SELECT COUNT(*)
        FROM group_members gm2
        WHERE gm2.group_id = g.group_id AND gm2.status = 'active'
      ) AS member_count,
      lm.message              AS last_message,
      lm.message_type         AS last_message_type,
      lm.message_metadata     AS last_message_metadata,
      lm.created_at           AS last_message_at,
      lm.sender_id            AS last_sender_id,
      sender.name             AS last_sender_name,
      lm.sender_id            AS last_sender_id,
      CASE WHEN lm.sender_id = $2 THEN (
        SELECT CASE
          WHEN COUNT(*) = 0 THEN 'sent'
          WHEN bool_and(gmr2.delivery_status = 'read') THEN 'read'
          WHEN bool_and(gmr2.delivery_status IN ('read', 'delivered')) THEN 'delivered'
          ELSE 'sent'
        END
        FROM group_message_recipients gmr2
        WHERE gmr2.group_message_id = lm.group_message_id
      ) ELSE NULL END AS last_message_delivery_status,
      CASE WHEN gm.status = 'left' THEN 0 ELSE (
        SELECT COUNT(*)
        FROM group_message_recipients gmr
        JOIN group_messages gm3 ON gm3.group_message_id = gmr.group_message_id
        WHERE gm3.group_id = g.group_id
          AND gmr.user_id = $2
          AND gmr.delivery_status != 'read'
      ) END AS unread_count
    FROM group_members gm
    JOIN groups g ON g.group_id = gm.group_id
    LEFT JOIN LATERAL (
      SELECT message, message_type, message_metadata, created_at, sender_id, group_message_id
      FROM group_messages
      WHERE group_id = g.group_id AND organization_id = $1
        AND (gm.status = 'active' OR created_at <= gm.updated_at)
      ORDER BY created_at DESC
      LIMIT 1
    ) lm ON TRUE
    LEFT JOIN users sender ON sender.user_id = lm.sender_id
    LEFT JOIN users creator ON creator.user_id = g.created_by
    WHERE gm.user_id = $2
      AND gm.organization_id = $1
      AND gm.status IN ('active', 'left', 'kicked')
      AND g.status = 'active'
      AND COALESCE(gm.hidden_from_list, FALSE) = FALSE
    ORDER BY lm.created_at DESC NULLS LAST
  `;
  const { rows } = await db.query(query, [orgId, userId]);
  // Decrypt last message preview + metadata
  rows.forEach((r) => {
    if (r.last_message) r.last_message = decryptMessage(r.last_message);
    if (r.last_message_metadata) r.last_message_metadata = decryptMetadata(r.last_message_metadata);
  });

  // Batch fetch members for all groups in 1 query
  if (rows.length) {
    const groupIds = rows.map((r) => r.group_id);
    const { rows: memberRows } = await db.query(
      `SELECT gm.group_id, gm.user_id, gm.is_admin, u.name, u.email, u.profile_url
       FROM group_members gm
       JOIN users u ON u.user_id = gm.user_id
       WHERE gm.group_id = ANY($1) AND gm.status = 'active'
       ORDER BY gm.is_admin DESC, u.name ASC`,
      [groupIds]
    );
    // Sign profile URLs for member avatars
    const { getPresignedUrl } = require('../config/s3');
    const membersByGroup = new Map();
    for (const m of memberRows) {
      if (!membersByGroup.has(m.group_id)) membersByGroup.set(m.group_id, []);
      let avatar = m.profile_url || null;
      if (avatar && avatar.startsWith('profiles/')) {
        try { avatar = await getPresignedUrl(avatar); } catch { /* keep key */ }
      }
      membersByGroup.get(m.group_id).push({
        id: String(m.user_id),
        user_id: m.user_id,
        name: m.name || '',
        email: m.email || '',
        avatar,
        isAdmin: Boolean(m.is_admin),
        role: m.is_admin ? 'Admin' : 'Member',
      });
    }
    rows.forEach((r) => {
      r.members = membersByGroup.get(r.group_id) || [];
    });
  }

  return rows;
};

/**
 * Get contacts (org members) the user can start a DM with.
 */
const getContacts = async (orgId, userId) => {
  const query = `
    SELECT
      u.user_id,
      u.name,
      u.email,
      u.profile_url,
      u.mobile,
      u.status,
      om.role_id,
      dept.name AS department_name,
      desig.name AS designation_name,
      COALESCE(u.is_global_member, false) AS is_global
    FROM organization_members om
    JOIN users u ON u.user_id = om.user_id
    LEFT JOIN departments dept ON dept.department_id = om.department_id
    LEFT JOIN designations desig ON desig.designation_id = om.designation_id
    WHERE om.organization_id = $1
      AND om.status = 'active'
      AND om.user_id != $2
      -- Global member visibility: only show to allowed chat partners
      AND (
        COALESCE(u.is_global_member, false) = false
        OR EXISTS (
          SELECT 1 FROM global_access ga
          WHERE ga.org_id = $1 AND ga.user_id = om.user_id AND ga.allow_user_id = $2
            AND ga.status = 'active'
        )
      )
    ORDER BY u.name ASC
  `;
  const { rows } = await db.query(query, [orgId, userId]);
  return rows;
};

// ─── Messages ──────────────────────────────────────────────────────────────────

/**
 * Fetch paginated 1:1 messages between two users.
 */
const getDMMessages = async (orgId, userId, otherUserId, { limit = 50, before } = {}) => {
  const values = [orgId, userId, otherUserId, limit];
  let beforeClause = '';

  if (before) {
    values.push(before);
    beforeClause = `AND m.send_time < $${values.length}`;
  }

  // Self-chat: sender = receiver, no UNION needed (would duplicate rows)
  const isSelf = Number(userId) === Number(otherUserId);
  const query = isSelf
    ? `
      SELECT
        m.message_id, m.sender_id, m.receiver_id, m.message, m.message_type,
        m.message_metadata, m.send_time, m.read_time, m.edit_time, m.delivered_at,
        s.name AS sender_name, s.profile_url AS sender_avatar,
        s.name AS receiver_name, s.profile_url AS receiver_avatar
      FROM messages m
      JOIN users s ON s.user_id = m.sender_id
      WHERE m.organization_id = $1 AND m.sender_id = $2 AND m.receiver_id = $3
        AND m.message IS NOT NULL
        AND (m.expires_at IS NULL OR m.expires_at > NOW())
        ${beforeClause}
      ORDER BY m.send_time DESC
      LIMIT $4
    `
    : `
      SELECT * FROM (
        SELECT
          m.message_id, m.sender_id, m.receiver_id, m.message, m.message_type,
          m.message_metadata, m.send_time, m.read_time, m.edit_time, m.delivered_at,
          s.name AS sender_name, s.profile_url AS sender_avatar,
          r.name AS receiver_name, r.profile_url AS receiver_avatar
        FROM messages m
        JOIN users s ON s.user_id = m.sender_id
        JOIN users r ON r.user_id = m.receiver_id
        WHERE m.organization_id = $1 AND m.sender_id = $2 AND m.receiver_id = $3
          AND m.message IS NOT NULL
          AND (m.expires_at IS NULL OR m.expires_at > NOW())
          ${beforeClause}
        UNION ALL
        SELECT
          m.message_id, m.sender_id, m.receiver_id, m.message, m.message_type,
          m.message_metadata, m.send_time, m.read_time, m.edit_time, m.delivered_at,
          s.name AS sender_name, s.profile_url AS sender_avatar,
          r.name AS receiver_name, r.profile_url AS receiver_avatar
        FROM messages m
        JOIN users s ON s.user_id = m.sender_id
        JOIN users r ON r.user_id = m.receiver_id
        WHERE m.organization_id = $1 AND m.sender_id = $3 AND m.receiver_id = $2
          AND m.message IS NOT NULL
          AND (m.expires_at IS NULL OR m.expires_at > NOW())
          ${beforeClause}
      ) combined
      ORDER BY send_time DESC
      LIMIT $4
    `;

  const { rows } = await db.query(query, values);
  // Decrypt messages + metadata from DB
  rows.forEach((r) => {
    r.message = decryptMessage(r.message);
    r.message_metadata = decryptMetadata(r.message_metadata);
  });

  // Attach reactions, find user's delete actions and recall actions from message_actions
  if (rows.length) {
    const msgIds = rows.map((r) => r.message_id);
    const { rows: actionRows } = await db.query(
      `SELECT ma.message_id, ma.action_type, ma.user_id, u.name AS user_name
       FROM message_actions ma
       JOIN users u ON u.user_id = ma.user_id
       WHERE ma.message_id = ANY($1) AND (ma.action_type LIKE 'react:%' OR ma.action_type = 'delete' OR ma.action_type = 'recall')`,
      [msgIds]
    );

    // Build set of message IDs deleted by this user + recalled by anyone
    const deletedByUser = new Set();
    const recalledMessages = new Set();
    const reactionOnlyRows = [];
    for (const row of actionRows) {
      if (row.action_type === 'delete' && Number(row.user_id) === userId) {
        deletedByUser.add(Number(row.message_id));
      } else if (row.action_type === 'recall') {
        recalledMessages.add(Number(row.message_id));
      } else if (row.action_type.startsWith('react:')) {
        reactionOnlyRows.push(row);
      }
    }

    const reactionMap = buildReactionMap(reactionOnlyRows);
    rows.forEach((r) => {
      const reactions = reactionMap.get(Number(r.message_id));
      if (reactions?.length) {
        r.message_metadata = { ...(r.message_metadata || {}), reactions };
      }
      if (deletedByUser.has(Number(r.message_id))) {
        r._deletedByUser = true;
      }
      if (recalledMessages.has(Number(r.message_id))) {
        r._recalled = true;
      }
    });
  }

  // Filter out recalled messages (hidden from everyone) and messages deleted by this user
  const filtered = rows.filter((r) => {
    const meta = r.message_metadata || {};
    return !meta.recalled && !r._recalled && !r._deletedByUser;
  });

  const result = filtered.reverse(); // chronological order
  // Expose raw (pre-filter) fetched count so callers can compute pagination
  // correctly even when some rows are hidden (recalled/deleted-by-user).
  result.rawRowCount = rows.length;
  return result;
};

/**
 * Fetch paginated group messages.
 */
const getGroupMessages = async (orgId, groupId, { limit = 50, before, userId, leftAt } = {}) => {
  const values = [orgId, groupId, limit];
  let beforeClause = '';

  if (before) {
    values.push(before);
    beforeClause = `AND gm.created_at < $${values.length}`;
  }

  if (leftAt) {
    values.push(leftAt);
    beforeClause += ` AND gm.created_at <= $${values.length}`;
  }

  // Add userId parameter for delivery status subquery
  values.push(userId || 0);
  const userIdParam = values.length;

  const query = `
    SELECT
      gm.group_message_id,
      gm.group_id,
      gm.sender_id,
      gm.message,
      gm.message_type,
      gm.message_metadata,
      gm.created_at,
      gm.updated_at,
      u.name        AS sender_name,
      u.profile_url AS sender_avatar,
      CASE WHEN gm.sender_id = $${userIdParam} THEN (
        SELECT CASE
          WHEN COUNT(*) = 0 THEN 'sent'
          WHEN bool_and(gmr.delivery_status = 'read') THEN 'read'
          WHEN bool_and(gmr.delivery_status IN ('read', 'delivered')) THEN 'delivered'
          ELSE 'sent'
        END
        FROM group_message_recipients gmr
        WHERE gmr.group_message_id = gm.group_message_id
      ) ELSE NULL END AS delivery_status
    FROM group_messages gm
    JOIN users u ON u.user_id = gm.sender_id
    WHERE gm.organization_id = $1
      AND gm.group_id = $2
      AND gm.message IS NOT NULL
      AND (gm.expires_at IS NULL OR gm.expires_at > NOW())
      ${beforeClause}
    ORDER BY gm.created_at DESC
    LIMIT $3
  `;

  const { rows } = await db.query(query, values);
  // Decrypt messages + metadata from DB
  rows.forEach((r) => {
    r.message = decryptMessage(r.message);
    r.message_metadata = decryptMetadata(r.message_metadata);
  });

  // Attach reactions, find user's delete actions and recall actions from group_message_actions
  if (rows.length) {
    const msgIds = rows.map((r) => r.group_message_id);
    const { rows: actionRows } = await db.query(
      `SELECT gma.group_message_id AS message_id, gma.action_type, gma.user_id, u.name AS user_name
       FROM group_message_actions gma
       JOIN users u ON u.user_id = gma.user_id
       WHERE gma.group_message_id = ANY($1) AND (gma.action_type LIKE 'react:%' OR gma.action_type = 'delete' OR gma.action_type = 'recall')`,
      [msgIds]
    );

    // Build set of message IDs deleted by this user + recalled by anyone
    const deletedByUser = new Set();
    const recalledMessages = new Set();
    const reactionOnlyRows = [];
    for (const row of actionRows) {
      if (row.action_type === 'delete' && Number(row.user_id) === userId) {
        deletedByUser.add(Number(row.message_id));
      } else if (row.action_type === 'recall') {
        recalledMessages.add(Number(row.message_id));
      } else if (row.action_type.startsWith('react:')) {
        reactionOnlyRows.push(row);
      }
    }

    const reactionMap = buildReactionMap(reactionOnlyRows);
    rows.forEach((r) => {
      const reactions = reactionMap.get(Number(r.group_message_id));
      if (reactions?.length) {
        r.message_metadata = { ...(r.message_metadata || {}), reactions };
      }
      if (deletedByUser.has(Number(r.group_message_id))) {
        r._deletedByUser = true;
      }
      if (recalledMessages.has(Number(r.group_message_id))) {
        r._recalled = true;
      }
    });
  }

  // Filter out recalled messages (hidden from everyone) and messages deleted by this user
  const filtered = rows.filter((r) => {
    const meta = r.message_metadata || {};
    return !meta.recalled && !r._recalled && !r._deletedByUser;
  });

  const result = filtered.reverse();
  // Expose raw (pre-filter) fetched count for accurate pagination.
  result.rawRowCount = rows.length;
  return result;
};

// ─── Send Message ──────────────────────────────────────────────────────────────

const sendDMMessage = async ({ orgId, senderId, receiverId, message, messageType = 'text', metadata = null }) => {
  const encryptedMsg = encryptMessage(message);
  const query = `
    WITH inserted AS (
      INSERT INTO messages (organization_id, sender_id, receiver_id, message, message_type, message_metadata, send_time)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    )
    SELECT inserted.*, u.name AS sender_name, u.profile_url AS sender_avatar
    FROM inserted
    JOIN users u ON u.user_id = inserted.sender_id
  `;
  const encryptedMeta = metadata ? encryptMetadata(metadata) : null;
  const { rows } = await db.query(query, [orgId, senderId, receiverId, encryptedMsg, messageType, encryptedMeta]);
  // Decrypt for in-memory use (socket emit)
  if (rows[0]) {
    rows[0].message = decryptMessage(rows[0].message);
    rows[0].message_metadata = decryptMetadata(rows[0].message_metadata);

    // Insert into message_files if this is a file-type message
    if (['file', 'image', 'video', 'audio'].includes(messageType) && metadata) {
      const meta = typeof metadata === 'object' ? metadata : {};
      const fileName = meta.fileName || meta.file_name || '';
      const fileUrl = meta.fileKey || meta.fileUrl || meta.file_url || '';
      const fileType = (meta.fileType || meta.file_type || messageType).slice(0, 255);
      const fileSize = Number(meta.fileSize || meta.file_size) || 0;
      if (fileName || fileUrl) {
        await db.query(
          `INSERT INTO message_files (message_id, file_name, file_url, file_type, file_size)
           VALUES ($1, $2, $3, $4, $5)`,
          [rows[0].message_id, fileName.slice(0, 255), fileUrl, fileType, fileSize]
        ).catch(err => console.error('[chatModel] message_files insert error:', err.message));
      }
    }
  }
  return rows[0];
};

const sendGroupMessage = async ({ orgId, groupId, senderId, message, messageType = 'text', metadata = null }) => {
  const encryptedMsg = encryptMessage(message);
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Insert group message
    const msgResult = await client.query(
      `WITH inserted AS (
        INSERT INTO group_messages (organization_id, group_id, sender_id, message, message_type, message_metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      )
      SELECT inserted.*, u.name AS sender_name, u.profile_url AS sender_avatar
      FROM inserted
      JOIN users u ON u.user_id = inserted.sender_id`,
      [orgId, groupId, senderId, encryptedMsg, messageType, metadata ? encryptMetadata(metadata) : null]
    );
    const newMsg = msgResult.rows[0];
    // Decrypt for in-memory use (socket emit)
    if (newMsg) {
      newMsg.message = decryptMessage(newMsg.message);
      newMsg.message_metadata = decryptMetadata(newMsg.message_metadata);
    }

    // Insert recipient rows for all active members (except sender)
    await client.query(
      `INSERT INTO group_message_recipients (group_message_id, group_id, user_id, delivery_status)
       SELECT $1, $2, user_id, 'sent'
       FROM group_members
       WHERE group_id = $2 AND organization_id = $3 AND status = 'active' AND user_id != $4`,
      [newMsg.group_message_id, groupId, orgId, senderId]
    );

    // Insert into group_message_files if this is a file-type message
    if (['file', 'image', 'video', 'audio'].includes(messageType) && metadata) {
      const meta = typeof metadata === 'object' ? metadata : {};
      const fileName = meta.fileName || meta.file_name || '';
      const fileUrl = meta.fileKey || meta.fileUrl || meta.file_url || '';
      const fileType = (meta.fileType || meta.file_type || messageType).slice(0, 255);
      const fileSize = Number(meta.fileSize || meta.file_size) || 0;
      if (fileName || fileUrl) {
        await client.query(
          `INSERT INTO group_message_files (group_message_id, file_name, file_url, file_type, file_size)
           VALUES ($1, $2, $3, $4, $5)`,
          [newMsg.group_message_id, fileName.slice(0, 255), fileUrl, fileType, fileSize]
        );
      }
    }

    // Insert into group_polls + group_poll_options if this is a poll message
    if (messageType === 'poll' && metadata) {
      const question = metadata.question || message || 'Poll';
      const pollType = metadata.type || 'single';
      const showResults = metadata.showResultsBeforeVote ?? false;
      const endsAt = metadata.endAt || null;
      const endPermission = metadata.endAccess === 'creator' ? 'creator_only' : 'creator_admin';

      console.log(`[chatModel] poll INSERT: group_message_id=${newMsg.group_message_id}, question=${question}, options=${JSON.stringify(metadata.options)?.slice(0, 300)}`);

      const pollResult = await client.query(
        `INSERT INTO group_polls (group_message_id, group_id, question, poll_type, show_results_before_vote, ends_at, end_permission, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING poll_id`,
        [newMsg.group_message_id, groupId, question, pollType, showResults, endsAt, endPermission, senderId]
      );
      const pollId = pollResult.rows[0]?.poll_id;
      console.log(`[chatModel] poll row inserted poll_id=${pollId}`);

      if (pollId && Array.isArray(metadata.options)) {
        for (let i = 0; i < metadata.options.length; i++) {
          const opt = metadata.options[i];
          const optText = opt.label || opt.text || `Option ${i + 1}`;
          await client.query(
            `INSERT INTO group_poll_options (poll_id, option_text, order_no) VALUES ($1, $2, $3)`,
            [pollId, optText, i + 1]
          );
        }
        console.log(`[chatModel] poll options inserted count=${metadata.options.length}`);
      }
    }

    await client.query('COMMIT');
    return newMsg;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── Read / Edit / Delete ─────────────────────────────────────────────────────

const markDMMessagesRead = async (orgId, receiverId, senderId) => {
  const query = `
    UPDATE messages
    SET read_time = NOW(), delivered_at = COALESCE(delivered_at, NOW()), updated_at = NOW()
    WHERE organization_id = $1
      AND sender_id = $2
      AND receiver_id = $3
      AND read_time IS NULL
    RETURNING message_id
  `;
  const { rows } = await db.query(query, [orgId, senderId, receiverId]);
  return rows;
};

const markGroupMessagesRead = async (orgId, groupId, userId) => {
  const query = `
    UPDATE group_message_recipients gmr
    SET delivery_status = 'read', read_at = NOW()
    FROM group_messages gm
    WHERE gm.group_message_id = gmr.group_message_id
      AND gm.organization_id = $1
      AND gm.group_id = $2
      AND gmr.user_id = $3
      AND gmr.delivery_status != 'read'
    RETURNING gmr.recipient_id, gmr.group_message_id
  `;
  const { rows } = await db.query(query, [orgId, groupId, userId]);

  // Insert into group_message_reads so message:info overlay shows read receipts
  if (rows.length > 0) {
    const messageIds = [...new Set(rows.map(r => r.group_message_id))];
    await db.query(
      `INSERT INTO group_message_reads (group_message_id, user_id, read_at)
       SELECT unnest($1::bigint[]), $2, NOW()
       ON CONFLICT (group_message_id, user_id) DO NOTHING`,
      [messageIds, userId]
    );
  }

  return rows;
};

const editDMMessage = async (messageId, orgId, senderId, newMessage) => {
  const encryptedMsg = encryptMessage(newMessage);
  // Use transaction with row lock to prevent edit history race condition
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: metaRows } = await client.query(
      `SELECT message_metadata FROM messages
       WHERE message_id = $1 AND organization_id = $2 AND sender_id = $3
       FOR UPDATE`,
      [messageId, orgId, senderId]
    );
    if (!metaRows[0]) { await client.query('ROLLBACK'); return null; }

    const existingMeta = metaRows[0].message_metadata
      ? decryptMetadata(metaRows[0].message_metadata)
      : {};
    const editHistory = Array.isArray(existingMeta.editHistory) ? existingMeta.editHistory : [];
    editHistory.push({ editedAt: new Date().toISOString() });
    const mergedMeta = { ...existingMeta, edited: true, editHistory };
    const encMeta = encryptMetadata(mergedMeta);

    const { rows } = await client.query(
      `WITH updated AS (
        UPDATE messages
        SET message = $1, message_metadata = $2::jsonb, edit_time = NOW(), updated_at = NOW()
        WHERE message_id = $3 AND organization_id = $4 AND sender_id = $5
        RETURNING *
      )
      SELECT updated.*, u.name AS sender_name, u.profile_url AS sender_avatar
      FROM updated
      JOIN users u ON u.user_id = updated.sender_id`,
      [encryptedMsg, encMeta, messageId, orgId, senderId]
    );
    await client.query('COMMIT');

    if (rows[0]) {
      rows[0].message = decryptMessage(rows[0].message);
      rows[0].message_metadata = decryptMetadata(rows[0].message_metadata);
    }
    return rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const deleteDMMessage = async (messageId, orgId, userId) => {
  // Verify message exists in this org (sender OR receiver can delete for themselves)
  const { rows } = await db.query(
    `SELECT message_id FROM messages
     WHERE message_id = $1 AND organization_id = $2
       AND (sender_id = $3 OR receiver_id = $3)`,
    [messageId, orgId, userId]
  );
  if (!rows.length) return null;
  // Don't modify the message — just record the delete action in message_actions
  // The fetch query filters out messages where the user has a delete action
  return rows[0];
};

/**
 * Get all organizations the user is an active member of.
 * Returns org details + the user's role in each org.
 */
const getUserOrganizations = async (userId) => {
  const query = `
    SELECT
      o.organization_id,
      o.name            AS org_name,
      o.logo_url,
      o.subdomain,
      o.org_key,
      om.role_id,
      r.role_key,
      r.role_name,
      om.status         AS membership_status,
      om.joined_at
    FROM organization_members om
    JOIN organizations o ON o.organization_id = om.organization_id
    LEFT JOIN roles r    ON r.role_id = om.role_id
    WHERE om.user_id = $1
      AND om.status = 'active'
      AND o.status  = 'active'
    ORDER BY om.joined_at ASC
  `;
  const { rows } = await db.query(query, [userId]);
  return rows;
};

/**
 * Search messages across a specific DM thread (all messages, not paginated).
 * Returns raw rows — caller must decrypt and filter.
 */
const searchDMMessages = async (orgId, userId, otherUserId, { limit = 500 } = {}) => {
  const isSelf = Number(userId) === Number(otherUserId);
  const query = isSelf
    ? `
      SELECT
        m.message_id, m.sender_id, m.receiver_id, m.message, m.message_type,
        m.message_metadata, m.send_time, m.read_time, m.edit_time, m.delivered_at,
        s.name AS sender_name, s.profile_url AS sender_avatar,
        s.name AS receiver_name, s.profile_url AS receiver_avatar
      FROM messages m
      JOIN users s ON s.user_id = m.sender_id
      WHERE m.organization_id = $1 AND m.sender_id = $2 AND m.receiver_id = $3
      ORDER BY m.send_time DESC
      LIMIT $4
    `
    : `
      SELECT * FROM (
        SELECT
          m.message_id, m.sender_id, m.receiver_id, m.message, m.message_type,
          m.message_metadata, m.send_time, m.read_time, m.edit_time, m.delivered_at,
          s.name AS sender_name, s.profile_url AS sender_avatar,
          r.name AS receiver_name, r.profile_url AS receiver_avatar
        FROM messages m
        JOIN users s ON s.user_id = m.sender_id
        JOIN users r ON r.user_id = m.receiver_id
        WHERE m.organization_id = $1 AND m.sender_id = $2 AND m.receiver_id = $3
        UNION ALL
        SELECT
          m.message_id, m.sender_id, m.receiver_id, m.message, m.message_type,
          m.message_metadata, m.send_time, m.read_time, m.edit_time, m.delivered_at,
          s.name AS sender_name, s.profile_url AS sender_avatar,
          r.name AS receiver_name, r.profile_url AS receiver_avatar
        FROM messages m
        JOIN users s ON s.user_id = m.sender_id
        JOIN users r ON r.user_id = m.receiver_id
        WHERE m.organization_id = $1 AND m.sender_id = $3 AND m.receiver_id = $2
      ) combined
      ORDER BY send_time DESC
      LIMIT $4
    `;
  const { rows } = await db.query(query, [orgId, userId, otherUserId, limit]);
  rows.forEach((r) => {
    r.message = decryptMessage(r.message);
    r.message_metadata = decryptMetadata(r.message_metadata);
  });

  // Filter out messages deleted by this user via message_actions
  const msgIds = rows.map((r) => r.message_id);
  let deletedByUser = new Set();
  let recalledMessages = new Set();
  if (msgIds.length) {
    const { rows: actionRows } = await db.query(
      `SELECT message_id, action_type, user_id FROM message_actions
       WHERE message_id = ANY($1) AND (action_type = 'delete' OR action_type = 'recall')`,
      [msgIds]
    );
    for (const row of actionRows) {
      if (row.action_type === 'delete' && Number(row.user_id) === userId) {
        deletedByUser.add(Number(row.message_id));
      } else if (row.action_type === 'recall') {
        recalledMessages.add(Number(row.message_id));
      }
    }
  }

  return rows.filter((r) => {
    const meta = r.message_metadata || {};
    return !meta.recalled && !recalledMessages.has(Number(r.message_id)) && !deletedByUser.has(Number(r.message_id));
  });
};

/**
 * Search messages across a specific group thread.
 */
const searchGroupMessages = async (orgId, groupId, { limit = 500, userId } = {}) => {
  const query = `
    SELECT
      gm.group_message_id, gm.group_id, gm.sender_id, gm.message, gm.message_type,
      gm.message_metadata, gm.created_at, gm.updated_at,
      u.name AS sender_name, u.profile_url AS sender_avatar
    FROM group_messages gm
    JOIN users u ON u.user_id = gm.sender_id
    WHERE gm.organization_id = $1 AND gm.group_id = $2
    ORDER BY gm.created_at DESC
    LIMIT $3
  `;
  const { rows } = await db.query(query, [orgId, groupId, limit]);
  rows.forEach((r) => {
    r.message = decryptMessage(r.message);
    r.message_metadata = decryptMetadata(r.message_metadata);
  });

  // Filter out messages deleted by this user + recalled by anyone via group_message_actions
  const msgIds = rows.map((r) => r.group_message_id);
  let deletedByUser = new Set();
  let recalledMessages = new Set();
  if (msgIds.length && userId) {
    const { rows: actionRows } = await db.query(
      `SELECT group_message_id, action_type, user_id FROM group_message_actions
       WHERE group_message_id = ANY($1) AND (action_type = 'delete' OR action_type = 'recall')`,
      [msgIds]
    );
    for (const row of actionRows) {
      if (row.action_type === 'delete' && Number(row.user_id) === userId) {
        deletedByUser.add(Number(row.group_message_id));
      } else if (row.action_type === 'recall') {
        recalledMessages.add(Number(row.group_message_id));
      }
    }
  }

  return rows.filter((r) => {
    const meta = r.message_metadata || {};
    return !meta.recalled && !recalledMessages.has(Number(r.group_message_id)) && !deletedByUser.has(Number(r.group_message_id));
  });
};

/**
 * Search across ALL DM threads for a user (global search).
 */
const searchAllDMMessages = async (orgId, userId, { limit = 1000 } = {}) => {
  const query = `
    SELECT
      m.message_id, m.sender_id, m.receiver_id, m.message, m.message_type,
      m.message_metadata, m.send_time, m.read_time, m.edit_time, m.delivered_at,
      s.name AS sender_name, s.profile_url AS sender_avatar,
      r.name AS receiver_name, r.profile_url AS receiver_avatar
    FROM messages m
    JOIN users s ON s.user_id = m.sender_id
    JOIN users r ON r.user_id = m.receiver_id
    WHERE m.organization_id = $1
      AND (m.sender_id = $2 OR m.receiver_id = $2)
    ORDER BY m.send_time DESC
    LIMIT $3
  `;
  const { rows } = await db.query(query, [orgId, userId, limit]);
  rows.forEach((r) => {
    r.message = decryptMessage(r.message);
    r.message_metadata = decryptMetadata(r.message_metadata);
  });

  const msgIds = rows.map((r) => r.message_id);
  let deletedByUser = new Set();
  let recalledMessages = new Set();
  if (msgIds.length) {
    const { rows: actionRows } = await db.query(
      `SELECT message_id, action_type, user_id FROM message_actions
       WHERE message_id = ANY($1) AND (action_type = 'delete' OR action_type = 'recall')`,
      [msgIds]
    );
    for (const row of actionRows) {
      if (row.action_type === 'delete' && Number(row.user_id) === userId) {
        deletedByUser.add(Number(row.message_id));
      } else if (row.action_type === 'recall') {
        recalledMessages.add(Number(row.message_id));
      }
    }
  }

  return rows.filter((r) => {
    const meta = r.message_metadata || {};
    return !meta.recalled && !recalledMessages.has(Number(r.message_id)) && !deletedByUser.has(Number(r.message_id));
  });
};

/**
 * Search across ALL group threads for a user.
 */
const searchAllGroupMessages = async (orgId, userId, { limit = 1000 } = {}) => {
  const query = `
    SELECT
      gm.group_message_id, gm.group_id, gm.sender_id, gm.message, gm.message_type,
      gm.message_metadata, gm.created_at, gm.updated_at,
      u.name AS sender_name, u.profile_url AS sender_avatar,
      g.group_name
    FROM group_messages gm
    JOIN users u ON u.user_id = gm.sender_id
    JOIN groups g ON g.group_id = gm.group_id
    WHERE gm.organization_id = $1
      AND gm.group_id IN (
        SELECT group_id FROM group_members WHERE user_id = $2 AND status = 'active'
      )
    ORDER BY gm.created_at DESC
    LIMIT $3
  `;
  const { rows } = await db.query(query, [orgId, userId, limit]);
  rows.forEach((r) => {
    r.message = decryptMessage(r.message);
    r.message_metadata = decryptMetadata(r.message_metadata);
  });

  const msgIds = rows.map((r) => r.group_message_id);
  let deletedByUser = new Set();
  let recalledMessages = new Set();
  if (msgIds.length) {
    const { rows: actionRows } = await db.query(
      `SELECT group_message_id, action_type, user_id FROM group_message_actions
       WHERE group_message_id = ANY($1) AND (action_type = 'delete' OR action_type = 'recall')`,
      [msgIds]
    );
    for (const row of actionRows) {
      if (row.action_type === 'delete' && Number(row.user_id) === userId) {
        deletedByUser.add(Number(row.group_message_id));
      } else if (row.action_type === 'recall') {
        recalledMessages.add(Number(row.group_message_id));
      }
    }
  }

  return rows.filter((r) => {
    const meta = r.message_metadata || {};
    return !meta.recalled && !recalledMessages.has(Number(r.group_message_id)) && !deletedByUser.has(Number(r.group_message_id));
  });
};

const deleteGroupMessage = async (messageId, orgId, groupId, userId) => {
  // Verify message exists in this group (any group member can delete for themselves)
  const { rows } = await db.query(
    `SELECT gm.group_message_id FROM group_messages gm
     JOIN group_members gmem ON gmem.group_id = gm.group_id AND gmem.user_id = $4 AND gmem.status = 'active'
     WHERE gm.group_message_id = $1 AND gm.organization_id = $2 AND gm.group_id = $3`,
    [messageId, orgId, groupId, userId]
  );
  if (!rows.length) return null;
  // Don't modify the message — just record the delete action in group_message_actions
  // The fetch query filters out messages where the user has a delete action
  return rows[0];
};

module.exports = {
  getDMThreads,
  getGroupThreads,
  getContacts,
  getDMMessages,
  getGroupMessages,
  sendDMMessage,
  sendGroupMessage,
  markDMMessagesRead,
  markGroupMessagesRead,
  editDMMessage,
  deleteDMMessage,
  deleteGroupMessage,
  getUserOrganizations,
  searchDMMessages,
  searchGroupMessages,
  searchAllDMMessages,
  searchAllGroupMessages,
};
