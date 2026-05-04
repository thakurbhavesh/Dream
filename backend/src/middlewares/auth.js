const jwt = require('jsonwebtoken');
const { ACCESS_COOKIE, readCookie } = require('../utils/httpCookies');

const auth = (req, res, next) => {
  // Validate JWT_SECRET exists
  if (!process.env.JWT_SECRET) {
    console.error('[FATAL] JWT_SECRET not configured');
    const err = new Error('Server configuration error');
    err.status = 500;
    return next(err);
  }

  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');
  const cookieToken = readCookie(req, ACCESS_COOKIE);
  const resolvedToken = type === 'Bearer' && token ? token : cookieToken;

  if (!resolvedToken) {
    const err = new Error('Unauthorized');
    err.status = 401;
    return next(err);
  }

  try {
    const payload = jwt.verify(resolvedToken, process.env.JWT_SECRET);
    // Reject only tokens with no `sub` at all. Accept both numeric user ids
    // and string subs (e.g. 'guest-123' for meeting guests). `org` is optional
    // since owner-level / pre-org-assignment tokens may legitimately omit it.
    if (payload?.sub === undefined || payload?.sub === null || payload?.sub === '') {
      const err = new Error('Invalid token claims');
      err.status = 401;
      return next(err);
    }
    req.user = payload;
    return next();
  } catch (error) {
    const err = new Error('Invalid or expired token');
    err.status = 401;
    return next(err);
  }
};

module.exports = auth;
