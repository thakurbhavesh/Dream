const {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_COOKIE,
  readCookie,
} = require('../utils/httpCookies');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PUBLIC_MUTATION_ROUTES = new Set([
  '/auth/register',
  '/auth/create-account',
  '/auth/resend-otp',
  '/auth/forgot-password',
  '/auth/forgot-verify',
  '/auth/reset-password',
  '/auth/login',
  '/auth/verify-otp',
  '/users/forgot-password',
  '/users/forgot-verify',
  '/contact-us',
  '/upload/chat-file',
  '/upload/profile-picture',
]);

// Routes that start with these prefixes skip CSRF (protected by Bearer auth)
const CSRF_EXEMPT_PREFIXES = ['/meetings', '/chat/', '/auth/'];

const csrfProtection = (req, res, next) => {
  if (SAFE_METHODS.has(String(req.method || '').toUpperCase())) {
    return next();
  }

  if (PUBLIC_MUTATION_ROUTES.has(req.path)) {
    return next();
  }

  // Skip CSRF for exempt prefixes (these use Bearer token auth)
  if (CSRF_EXEMPT_PREFIXES.some(prefix => req.path.startsWith(prefix))) {
    return next();
  }

  // Skip CSRF for Bearer token auth (mobile apps, API clients)
  const authHeader = String(req.headers.authorization || '');
  if (authHeader.startsWith('Bearer ')) {
    return next();
  }

  const hasAuthCookie = Boolean(readCookie(req, ACCESS_COOKIE) || readCookie(req, REFRESH_COOKIE));
  if (!hasAuthCookie) {
    return next();
  }

  const cookieToken = readCookie(req, CSRF_COOKIE);
  const headerToken =
    String(req.headers['x-csrf-token'] || req.headers['x-xsrf-token'] || '').trim();

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    const err = new Error('Invalid CSRF token');
    err.status = 403;
    return next(err);
  }

  return next();
};

module.exports = csrfProtection;
