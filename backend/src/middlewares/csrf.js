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

// Routes that start with these prefixes skip CSRF.
// Rationale: in cross-origin production (Vercel frontend → Render backend) the
// browser can't reliably propagate same-site cookies, so the frontend uses
// Bearer tokens for these protected APIs. CSRF is meaningless against Bearer
// auth (browsers don't auto-attach Authorization headers to forged requests),
// and the auth middleware on each route already validates the token.
const CSRF_EXEMPT_PREFIXES = [
  '/auth/',
  '/meetings',
  '/chat/',
  '/users',
  '/roles',
  '/plans',
  '/plan-features',
  '/languages',
  '/timezones',
  '/platforms',
  '/message-menu-items',
  '/departments',
  '/designations',
  '/locations',
  '/activity-logs',
  '/global-access',
  '/groups',
  '/group-members',
  '/group-timeline',
  '/organization',
  '/organization-controls',
  '/organization-restrictions',
  '/organization-message-menu-permissions',
  '/site-details',
  '/product-features',
  '/billing',
  '/geo',
  '/coupons',
  '/payment-gateways',
  '/smtp-settings',
  '/live-assistant',
  '/upload',
  '/translate',
  '/ai-providers',
  '/gifs',
];

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
