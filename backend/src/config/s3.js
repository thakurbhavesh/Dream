const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const S3_ENABLED = !!(process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

const s3Client = S3_ENABLED
  ? new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    })
  : null;

const S3_BUCKET = process.env.AWS_S3_BUCKET;

// Generate a presigned GET URL (default 7 days expiry)
const getPresignedUrl = async (key, expiresIn = 604800) => {
  if (!key) return null;
  if (!s3Client) return null;
  const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn });
};

module.exports = { s3Client, S3_BUCKET, getPresignedUrl };
