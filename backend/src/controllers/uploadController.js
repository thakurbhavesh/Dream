const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { s3Client, S3_BUCKET, getPresignedUrl } = require('../config/s3');
const db = require('../config/database');
const { success } = require('../utils/response');
const { emitToUser } = require('../socket');

// POST /upload/profile-picture
const uploadProfilePicture = async (req, res, next) => {
  try {
    if (!s3Client) {
      const e = new Error('File uploads are not available — AWS S3 is not configured');
      e.status = 503;
      throw e;
    }
    if (!req.file) {
      const e = new Error('No image file provided');
      e.status = 400;
      throw e;
    }

    const userId = req.user?.sub;
    if (!userId) {
      const e = new Error('Authentication required');
      e.status = 401;
      throw e;
    }

    // Delete old profile picture from S3 if exists
    const { rows } = await db.query('SELECT profile_url FROM users WHERE user_id = $1', [userId]);
    const oldKey = rows[0]?.profile_url;
    if (oldKey && oldKey.startsWith('profiles/')) {
      try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: oldKey }));
      } catch (_) {
        // old file cleanup is best-effort
      }
    }

    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const key = `profiles/${userId}/${crypto.randomBytes(8).toString('hex')}${ext}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        CacheControl: 'max-age=31536000, immutable',
      })
    );

    // Store only the S3 key in DB (not the full URL — keeps bucket private)
    await db.query('UPDATE users SET profile_url = $1, updated_at = NOW() WHERE user_id = $2', [
      key,
      userId,
    ]);

    // Return a presigned URL so frontend can display immediately
    const signedUrl = await getPresignedUrl(key);

    return success(res, { profile_url: signedUrl }, 'Profile picture uploaded');
  } catch (err) {
    return next(err);
  }
};

// DELETE /upload/profile-picture
const removeProfilePicture = async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      const e = new Error('Authentication required');
      e.status = 401;
      throw e;
    }

    const { rows } = await db.query('SELECT profile_url FROM users WHERE user_id = $1', [userId]);
    const oldKey = rows[0]?.profile_url;

    if (oldKey && oldKey.startsWith('profiles/')) {
      try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: oldKey }));
      } catch (_) {
        // best-effort cleanup
      }
    }

    await db.query('UPDATE users SET profile_url = NULL, updated_at = NOW() WHERE user_id = $1', [
      userId,
    ]);

    return success(res, null, 'Profile picture removed');
  } catch (err) {
    return next(err);
  }
};

// Derive extension from mimetype when originalname has none (clipboard paste)
const MIME_TO_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'video/x-matroska': '.mkv',
  'video/x-flv': '.flv',
  'video/x-ms-wmv': '.wmv',
  'video/3gpp': '.3gp',
  'video/ogg': '.ogv',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.weba',
  'audio/aac': '.aac',
  'audio/flac': '.flac',
  'audio/x-m4a': '.m4a',
  'audio/mp4': '.m4a',
  'application/pdf': '.pdf',
};

// Sanitize filename for HTTP headers — remove non-ASCII, quotes, control chars
const sanitizeFileName = (name) =>
  String(name || '')
    .replace(/[^\x20-\x7E]/g, '_')  // non-ASCII → underscore
    .replace(/["\\]/g, '_')          // quotes/backslash → underscore
    .replace(/\s+/g, '_')            // spaces → underscore
    .replace(/_+/g, '_')             // collapse multiple underscores
    .trim() || 'file';

const resolveFileInfo = (file) => {
  const rawName = (file.originalname || '').trim();
  let ext = path.extname(rawName).toLowerCase();

  // Derive extension from mimetype when original has none
  if (!ext && file.mimetype) {
    ext = MIME_TO_EXT[file.mimetype] || '';
  }

  // Build a proper filename if original is generic (blob, image.png, etc.)
  const genericNames = ['blob', 'image.png', 'image.jpg', 'image.jpeg', 'file'];
  const isGeneric = !rawName || genericNames.includes(rawName.toLowerCase());
  const fileName = isGeneric
    ? `pasted-${Date.now()}${ext}`
    : sanitizeFileName(rawName);

  return { ext, fileName };
};

// POST /upload/chat-file
const uploadChatFile = async (req, res, next) => {
  const tmpPath = req.file?.path;
  try {
    if (!s3Client) {
      const e = new Error('File uploads are not available — AWS S3 is not configured');
      e.status = 503;
      throw e;
    }
    if (!req.file) {
      const e = new Error('No file provided');
      e.status = 400;
      throw e;
    }

    const userId = req.user?.sub;
    if (!userId) {
      const e = new Error('Authentication required');
      e.status = 401;
      throw e;
    }

    const { ext, fileName } = resolveFileInfo(req.file);
    const key = `files/${userId}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;

    // uploadId from frontend for correlating S3 progress via socket
    const uploadId = req.body?.uploadId || null;

    // Stream from disk to S3 using multipart upload (handles files up to 2 GB)
    const fileStream = fs.createReadStream(tmpPath);
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: S3_BUCKET,
        Key: key,
        Body: fileStream,
        ContentType: req.file.mimetype,
        ContentDisposition: `inline; filename="${fileName}"`,
      },
      queueSize: 4,           // 4 concurrent part uploads
      partSize: 10 * 1024 * 1024, // 10 MB parts
    });

    // Emit S3 upload progress to frontend via socket
    const fileSize = req.file.size || 0;
    upload.on('httpUploadProgress', (progress) => {
      if (uploadId && userId && fileSize > 0) {
        const percent = Math.round(((progress.loaded || 0) / fileSize) * 100);
        emitToUser(String(userId), 'upload:s3progress', { uploadId, percent });
      }
    });

    await upload.done();

    // Clean up temp file
    fs.unlink(tmpPath, () => {});

    const signedUrl = await getPresignedUrl(key);

    return success(res, {
      file_key: key,
      file_url: signedUrl,
      file_name: fileName,
      file_type: req.file.mimetype,
      file_size: req.file.size,
    }, 'File uploaded');
  } catch (err) {
    // Clean up temp file on error
    if (tmpPath) fs.unlink(tmpPath, () => {});
    return next(err);
  }
};

// POST /upload/group-image/:groupId
const uploadGroupImage = async (req, res, next) => {
  try {
    if (!s3Client) {
      const e = new Error('File uploads are not available — AWS S3 is not configured');
      e.status = 503;
      throw e;
    }
    if (!req.file) {
      const e = new Error('No image file provided');
      e.status = 400;
      throw e;
    }
    const userId = req.user?.sub;
    const orgId = req.user?.org;
    const groupId = Number(req.params.groupId);
    if (!userId || !orgId || !groupId) {
      const e = new Error('Authentication and group ID required');
      e.status = 400;
      throw e;
    }

    // Verify group exists and user is a member
    const { rows: groupRows } = await db.query(
      `SELECT g.group_id, g.group_image FROM groups g
       JOIN group_members gm ON gm.group_id = g.group_id
       WHERE g.group_id = $1 AND g.organization_id = $2 AND gm.user_id = $3 AND gm.status = 'active'`,
      [groupId, orgId, userId]
    );
    if (!groupRows.length) {
      const e = new Error('Group not found or not a member');
      e.status = 404;
      throw e;
    }

    // Delete old group image from S3
    const oldKey = groupRows[0]?.group_image;
    if (oldKey && oldKey.startsWith('groups/')) {
      try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: oldKey }));
      } catch (_) { /* best-effort */ }
    }

    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const key = `groups/${groupId}/${crypto.randomBytes(8).toString('hex')}${ext}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        CacheControl: 'max-age=31536000, immutable',
      })
    );

    // Store S3 key in DB
    await db.query('UPDATE groups SET group_image = $1, updated_at = NOW() WHERE group_id = $2', [key, groupId]);

    const signedUrl = await getPresignedUrl(key);
    return success(res, { group_image: signedUrl, key }, 'Group image uploaded');
  } catch (err) {
    return next(err);
  }
};

// DELETE /upload/group-image/:groupId
const removeGroupImage = async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    const orgId = req.user?.org;
    const groupId = Number(req.params.groupId);

    const { rows } = await db.query(
      `SELECT g.group_image FROM groups g
       JOIN group_members gm ON gm.group_id = g.group_id
       WHERE g.group_id = $1 AND g.organization_id = $2 AND gm.user_id = $3 AND gm.status = 'active'`,
      [groupId, orgId, userId]
    );
    const oldKey = rows[0]?.group_image;
    if (oldKey && oldKey.startsWith('groups/')) {
      try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: oldKey }));
      } catch (_) { /* best-effort */ }
    }

    await db.query('UPDATE groups SET group_image = NULL, updated_at = NOW() WHERE group_id = $1', [groupId]);
    return success(res, null, 'Group image removed');
  } catch (err) {
    return next(err);
  }
};

// GET /upload/file-proxy?key=files/5/abc123.png
// Proxies S3 file through backend so frontend can fetch with proper CORS for clipboard copy
const fileProxy = async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      const e = new Error('Authentication required');
      e.status = 401;
      throw e;
    }

    const key = req.query.key;
    if (!key || typeof key !== 'string') {
      const e = new Error('key query parameter is required');
      e.status = 400;
      throw e;
    }

    // Only allow proxying files from known S3 prefixes
    const allowedPrefixes = ['files/', 'chat-files/', 'profiles/', 'groups/'];
    if (!allowedPrefixes.some((p) => key.startsWith(p))) {
      const e = new Error('Invalid file key');
      e.status = 400;
      throw e;
    }

    const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
    const s3Response = await s3Client.send(command);

    res.setHeader('Content-Type', s3Response.ContentType || 'application/octet-stream');
    if (s3Response.ContentLength) {
      res.setHeader('Content-Length', s3Response.ContentLength);
    }
    res.setHeader('Cache-Control', 'private, max-age=300');

    s3Response.Body.pipe(res);
  } catch (err) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
      const e = new Error('File not found');
      e.status = 404;
      return next(e);
    }
    return next(err);
  }
};

module.exports = { uploadProfilePicture, removeProfilePicture, uploadChatFile, uploadGroupImage, removeGroupImage, fileProxy };
