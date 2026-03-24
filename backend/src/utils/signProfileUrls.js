const { getPresignedUrl } = require('../config/s3');

const PROFILE_URL_FIELDS = ['profile_url', 'other_avatar', 'sender_avatar', 'owner_avatar', 'group_image'];
const S3_KEY_PREFIXES = ['profiles/', 'groups/'];

/**
 * Sign all S3 profile_url fields in a single object (mutates in place).
 */
const signProfileFields = async (obj) => {
  if (!obj) return obj;
  const promises = PROFILE_URL_FIELDS.map(async (field) => {
    if (obj[field] && typeof obj[field] === 'string' && S3_KEY_PREFIXES.some((p) => obj[field].startsWith(p))) {
      obj[field] = await getPresignedUrl(obj[field]);
    }
  });
  await Promise.all(promises);
  return obj;
};

/**
 * Sign profile URLs for an array of objects (parallel).
 */
const signProfileFieldsArray = (arr) =>
  Array.isArray(arr) ? Promise.all(arr.map(signProfileFields)) : Promise.resolve(arr);

module.exports = { signProfileFields, signProfileFieldsArray };
