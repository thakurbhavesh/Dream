const { getPresignedUrl } = require('../config/s3');

// S3 key prefixes used for chat files (current + legacy)
const FILE_KEY_PREFIXES = ['files/', 'chat-files/'];

const isS3FileKey = (value) =>
  typeof value === 'string' && FILE_KEY_PREFIXES.some((p) => value.startsWith(p));

/**
 * Sign file URLs inside a message's content/metadata.
 * Looks for fileUrl / fileKey and replaces fileUrl with a fresh presigned URL.
 * Works on both decrypted metadata objects and normalised content objects.
 * Mutates the object in place for performance.
 */
const signFileFields = async (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  // Direct fileKey → sign and set fileUrl
  if (isS3FileKey(obj.fileKey)) {
    obj.fileUrl = await getPresignedUrl(obj.fileKey);
  } else if (isS3FileKey(obj.fileUrl)) {
    // fileUrl contains a raw S3 key (not yet signed) — sign it
    obj.fileKey = obj.fileUrl;
    obj.fileUrl = await getPresignedUrl(obj.fileKey);
  }

  // Handle url field (used by some message types)
  if (isS3FileKey(obj.url)) {
    obj.url = await getPresignedUrl(obj.url);
  }
  if (isS3FileKey(obj.downloadUrl)) {
    obj.downloadUrl = await getPresignedUrl(obj.downloadUrl);
  }

  // Handle files array inside content
  if (Array.isArray(obj.files)) {
    await Promise.all(obj.files.map((file) => signFileFields(file)));
  }

  return obj;
};

/**
 * Sign file URLs in a normalised message object.
 * Checks both message.content and message.metadata.
 */
const signMessageFileUrls = async (message) => {
  if (!message || typeof message !== 'object') return message;
  if (message.content) await signFileFields(message.content);
  if (message.metadata) await signFileFields(message.metadata);
  return message;
};

/**
 * Sign file URLs for an array of normalised messages.
 */
const signMessageFileUrlsArray = (messages) =>
  Array.isArray(messages) ? Promise.all(messages.map(signMessageFileUrls)) : Promise.resolve(messages);

module.exports = { signFileFields, signMessageFileUrls, signMessageFileUrlsArray, isS3FileKey };
