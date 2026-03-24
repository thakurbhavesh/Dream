const jwt = require('jsonwebtoken');
const { ACCESS_COOKIE, readCookie } = require('../utils/httpCookies');

const auth = (req, res, next) => {
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
    req.user = payload;
    return next();
  } catch (error) {
    const err = new Error('Invalid token');
    err.status = 401;
    return next(err);
  }
};

module.exports = auth;
