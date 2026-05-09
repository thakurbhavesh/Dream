// Rate limiters for the auth surface.
//
// The socket layer has its own per-event in-memory limiter; this module is
// for the REST endpoints that are most attractive to attackers — login,
// password reset, OTP send/verify, refresh-token rotation. Limits are
// intentionally tight on the "guess credentials / spam OTP" routes and
// looser on routes that simply read state (e.g. /auth/me).
//
// All limiters key by IP. We honour the X-Forwarded-For header when behind
// Render's proxy (set in app.js via app.set('trust proxy', 1)).
//
// Failure response shape matches the rest of the API ({ status: "error",
// message }), so the existing client error toasts read it cleanly.

const rateLimit = require('express-rate-limit');

const formatHandler = (windowLabel) => (req, res /*, next, options */) => {
  res.status(429).json({
    status: 'error',
    code: 'rate_limited',
    message: `Too many requests. Please wait ${windowLabel} and try again.`,
  });
};

// 5 attempts / 15 minutes — covers credentials-stuffing on /auth/login and
// the OTP guess flow on /auth/verify-otp / /auth/forgot-verify.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', code: 'rate_limited', message: 'Too many login attempts. Try again in 15 minutes.' },
  handler: formatHandler('15 minutes'),
});

// 3 password-reset emails per hour per IP — slows enumeration of registered
// emails (each request reveals "yes, this email exists" via timing or wording).
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', code: 'rate_limited', message: 'Too many reset requests. Try again in 1 hour.' },
  handler: formatHandler('1 hour'),
});

// 5 OTP resends per 10 minutes per IP — generous enough for legitimate retry
// (network blips on SMS/email delivery) but caps abusive spam.
const otpResendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', code: 'rate_limited', message: 'Too many OTP requests. Try again in 10 minutes.' },
  handler: formatHandler('10 minutes'),
});

// 60 refreshes per 15 minutes per IP — refresh tokens rotate naturally, so
// any IP hitting this is either misconfigured or attempting token reuse.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', code: 'rate_limited', message: 'Too many refresh attempts.' },
  handler: formatHandler('15 minutes'),
});

// Loose registration limiter — 10 new accounts per IP per hour. Stops a
// single IP signing up bots while allowing a small office NAT to onboard.
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', code: 'rate_limited', message: 'Too many registration attempts. Try again in 1 hour.' },
  handler: formatHandler('1 hour'),
});

module.exports = {
  authLimiter,
  passwordResetLimiter,
  otpResendLimiter,
  refreshLimiter,
  registrationLimiter,
};
