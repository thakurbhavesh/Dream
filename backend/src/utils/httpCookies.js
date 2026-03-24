const crypto = require('crypto');

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';
const CSRF_COOKIE = 'csrf_token';

const parseDurationMs = (value, fallbackMs) => {
  if (!value) return fallbackMs;
  const match = String(value).trim().match(/^(\d+)([smhd])?$/i);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return amount * (multipliers[unit] || 1000);
};

const parseCookiesFromHeader = (rawHeader = '') => {
  return String(rawHeader || '')
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const idx = pair.indexOf('=');
      if (idx < 0) return acc;
      const key = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (!key) return acc;
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
};

const readCookie = (req, name) => {
  const cookieHeader = req?.headers?.cookie || '';
  const cookies = parseCookiesFromHeader(cookieHeader);
  return String(cookies[name] || '').trim();
};

const getCookieSecurityConfig = () => {
  const secureMode = String(process.env.COOKIE_SECURE || 'auto').toLowerCase();
  const secure =
    secureMode === 'true'
      ? true
      : secureMode === 'false'
      ? false
      : String(process.env.NODE_ENV || '').toLowerCase() === 'production';

  const sameSiteEnv = String(process.env.COOKIE_SAME_SITE || '').trim().toLowerCase();
  const sameSite =
    sameSiteEnv === 'none' || sameSiteEnv === 'strict' || sameSiteEnv === 'lax'
      ? sameSiteEnv
      : secure
      ? 'none'
      : 'lax';

  const domain = String(process.env.COOKIE_DOMAIN || '').trim();

  return {
    secure,
    sameSite,
    ...(domain ? { domain } : {}),
  };
};

const getAccessCookieOptions = () => {
  const maxAge = parseDurationMs(process.env.JWT_EXPIRES_IN || '15m', 15 * 60 * 1000);
  return {
    ...getCookieSecurityConfig(),
    httpOnly: true,
    path: '/',
    maxAge,
  };
};

const getRefreshCookieOptions = () => {
  const maxAge = parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN || '90d', 90 * 24 * 3600 * 1000);
  return {
    ...getCookieSecurityConfig(),
    httpOnly: true,
    path: '/auth',
    maxAge,
  };
};

const getCsrfCookieOptions = () => {
  const maxAge = parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN || '90d', 90 * 24 * 3600 * 1000);
  return {
    ...getCookieSecurityConfig(),
    httpOnly: false,
    path: '/',
    maxAge,
  };
};

const generateCsrfToken = () => crypto.randomBytes(32).toString('base64url');

const upsertCsrfCookie = (req, res) => {
  const existing = readCookie(req, CSRF_COOKIE);
  const token = existing || generateCsrfToken();
  res.cookie(CSRF_COOKIE, token, getCsrfCookieOptions());
  return token;
};

const setAuthCookies = (req, res, { accessToken, refreshToken }) => {
  const csrfToken = upsertCsrfCookie(req, res);
  res.cookie(ACCESS_COOKIE, accessToken, getAccessCookieOptions());
  res.cookie(REFRESH_COOKIE, refreshToken, getRefreshCookieOptions());
  return csrfToken;
};

const clearAuthCookies = (res) => {
  const clearBase = { ...getCookieSecurityConfig(), maxAge: 0, expires: new Date(0) };
  res.cookie(ACCESS_COOKIE, '', { ...clearBase, httpOnly: true, path: '/' });
  res.cookie(REFRESH_COOKIE, '', { ...clearBase, httpOnly: true, path: '/auth' });
  res.cookie(CSRF_COOKIE, '', { ...clearBase, httpOnly: false, path: '/' });
};

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_COOKIE,
  readCookie,
  parseCookiesFromHeader,
  setAuthCookies,
  clearAuthCookies,
  upsertCsrfCookie,
};

