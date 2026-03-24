const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error('JWT_SECRET is not set');
    err.status = 500;
    throw err;
  }
  return secret;
};

const parseDurationMs = (value, fallbackMs) => {
  if (!value) return fallbackMs;
  const match = String(value).trim().match(/^(\d+)([smhd])?$/i);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return amount * (multipliers[unit] || 1000);
};

const signAccessToken = (payload) => {
  const expiresIn = process.env.JWT_EXPIRES_IN || '15m';
  return jwt.sign(payload, getJwtSecret(), { expiresIn });
};

const generateRefreshToken = () => {
  return crypto.randomBytes(48).toString('base64url');
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const getRefreshExpiryDate = () => {
  const ms = parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN || '30d', 30 * 24 * 3600 * 1000);
  return new Date(Date.now() + ms);
};

module.exports = {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshExpiryDate,
};
