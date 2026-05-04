const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const os = require('node:os');
const db = require('../config/database');
const userModel = require('../models/userModel');
const sessionModel = require('../models/sessionModel');
const userDeviceModel = require('../models/userDeviceModel');
const billingModel = require('../models/billingModel');
const { sendMailAsync } = require('../utils/mail');
const { resolveMailBranding } = require('../utils/mailBranding');
const {
  getVerificationOtpMailTemplate,
  getForgotPasswordOtpMailTemplate,
  getPasswordResetSuccessMailTemplate,
  getWelcomeMailTemplate,
} = require('../templates/mail');
const { success } = require('../utils/response');
const { signProfileFields } = require('../utils/signProfileUrls');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');
const {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshExpiryDate,
} = require('../utils/jwt');
const { resolveGeoFromIp } = require('../utils/ipGeo');
const {
  REFRESH_COOKIE,
  readCookie,
  setAuthCookies,
  clearAuthCookies,
  upsertCsrfCookie,
} = require('../utils/httpCookies');
const { disconnectUser } = require('../socket/index');

const ALLOWED_DEVICE_TYPES = new Set(['mobile', 'desktop', 'tablet', 'other']);
const RETURN_TOKENS_IN_BODY_ENV = String(process.env.AUTH_RETURN_TOKENS_IN_BODY || 'false').toLowerCase() === 'true';
// Mobile apps can't use cookies — always return tokens in body for mobile requests
const shouldReturnTokens = (req) => {
  if (RETURN_TOKENS_IN_BODY_ENV) return true;
  // Detect mobile: explicit device_type in body, or non-browser User-Agent
  const deviceType = req.body?.device_type;
  if (deviceType === 'mobile' || deviceType === 'tablet') return true;
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  if (/expo|react.?native|okhttp|dart|flutter/i.test(ua)) return true;
  return false;
};
const FREE_EMAIL_DOMAINS = new Set([
  '163.com',
  '126.com',
  'gmail.com',
  'yahoo.com',
  'ymail.com',
  'rocketmail.com',
  'outlook.com',
  'outlook.in',
  'outlook.co.in',
  'outlook.co.uk',
  'hotmail.com',
  'hotmail.co.uk',
  'hotmail.fr',
  'hotmail.de',
  'live.com',
  'live.in',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'protonmail.ch',
  'tutanota.com',
  'tuta.io',
  'fastmail.com',
  'gmx.com',
  'gmx.de',
  'gmx.net',
  'mail.com',
  'inbox.com',
  'yandex.com',
  'yandex.ru',
  'yandex.com.tr',
  'zoho.com',
  'zoho.in',
  'zohomail.com',
  'rediffmail.com',
  'indiatimes.com',
  'sify.com',
  'lycos.com',
  'hushmail.com',
  'qq.com',
  'naver.com',
  'daum.net',
  'hanmail.net',
  'seznam.cz',
  'web.de',
  'mail.ru',
  'bk.ru',
  'list.ru',
  'inbox.ru',
]);

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const OTP_RESEND_COOLDOWN_SECONDS = toPositiveInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 30);
const OTP_LOCK_WINDOW_MINUTES = toPositiveInt(process.env.OTP_LOCK_WINDOW_MINUTES, 15);
const REFRESH_REUSE_GRACE_SECONDS = toPositiveInt(process.env.REFRESH_REUSE_GRACE_SECONDS, 5);
const DEFAULT_OWNER_ROLE_ID = 3;

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
const getEmailDomain = (email) => normalizeEmail(email).split('@')[1] || null;

const ensureBusinessEmail = (email) => {
  const normalized = normalizeEmail(email);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
    const err = new Error('Valid email is required');
    err.status = 400;
    throw err;
  }

  const domain = normalized.split('@')[1];
  if (!domain || FREE_EMAIL_DOMAINS.has(domain)) {
    const err = new Error('Only business email is allowed');
    err.status = 400;
    throw err;
  }

  return normalized;
};

const normalizePhone = (value) => {
  const digitsOnly = String(value || '').replace(/\D/g, '');
  if (!/^\d{10}$/.test(digitsOnly)) {
    const err = new Error('Phone number must be exactly 10 digits');
    err.status = 400;
    throw err;
  }
  return digitsOnly;
};

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const normalizeGatewayKey = (value) => {
  const source = String(value || '').trim().toLowerCase();
  if (!source) return '';
  const firstToken = source.split(/[,\|/]/)[0] || '';
  return String(firstToken).split(':')[0].trim();
};

const generateOtpCode = () => {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
};

const getOtpCooldownRemainingSeconds = (createdAt) => {
  if (!createdAt) return 0;
  const createdMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdMs) || createdMs <= 0) return 0;
  const remainingMs = createdMs + OTP_RESEND_COOLDOWN_SECONDS * 1000 - Date.now();
  return Math.max(Math.ceil(remainingMs / 1000), 0);
};

const getOtpLockRemainingSeconds = (otpRow) => {
  if (!otpRow || otpRow.status !== 'failed') return 0;
  const createdMs = new Date(otpRow.created_at).getTime();
  if (!Number.isFinite(createdMs) || createdMs <= 0) return 0;
  const lockMs = OTP_LOCK_WINDOW_MINUTES * 60 * 1000;
  return Math.max(Math.ceil((createdMs + lockMs - Date.now()) / 1000), 0);
};

const buildOtpLockError = (remainingSeconds, fallbackMessage) => {
  const err = new Error(
    remainingSeconds > 0
      ? `Too many failed OTP attempts. Try again in ${remainingSeconds}s.`
      : fallbackMessage
  );
  err.status = 429;
  err.details = {
    locked_for_seconds: remainingSeconds,
    retry_after_seconds: remainingSeconds,
  };
  return err;
};

const enforceOtpIssuePolicy = async (tx, { email, purpose }) => {
  const latestResult = await tx.query(
    `SELECT otp_id, status, created_at
     FROM otp_verifications
     WHERE LOWER(identifier) = LOWER($1)
       AND type = 'email'
       AND purpose = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [email, purpose]
  );

  const latestOtp = latestResult.rows[0] || null;
  if (!latestOtp) {
    return null;
  }

  const lockRemaining = getOtpLockRemainingSeconds(latestOtp);
  if (lockRemaining > 0) {
    throw buildOtpLockError(lockRemaining, 'OTP temporarily blocked. Try again later.');
  }

  const resendRemaining = getOtpCooldownRemainingSeconds(latestOtp.created_at);
  if (resendRemaining > 0) {
    const err = new Error(`Please wait ${resendRemaining}s before requesting another OTP.`);
    err.status = 429;
    err.details = {
      retry_after_seconds: resendRemaining,
      resend_available_in_seconds: resendRemaining,
    };
    throw err;
  }

  return latestOtp;
};

const runInBackground = (promise, context) => {
  if (!promise || typeof promise.then !== 'function') return;
  promise.catch((error) => {
    console.error(`Background task failed: ${context}`, {
      message: error.message,
    });
  });
};

const sendVerificationOtpEmail = async ({
  to,
  ownerName,
  otpCode,
  otpExpiresMinutes = 10,
  purpose = 'verification',
}) => {
  const branding = await resolveMailBranding();
  const template = getVerificationOtpMailTemplate({
    ownerName,
    otpCode,
    otpExpiresMinutes,
    appName: branding.appName,
    purpose,
    supportEmail: branding.supportEmail,
  });
  return sendMailAsync({
    to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
};

const sendForgotPasswordOtpEmail = async ({ to, ownerName, otpCode, otpExpiresMinutes = 10 }) => {
  const branding = await resolveMailBranding();
  const template = getForgotPasswordOtpMailTemplate({
    ownerName,
    otpCode,
    otpExpiresMinutes,
    appName: branding.appName,
    supportEmail: branding.supportEmail,
  });
  return sendMailAsync({
    to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
};

const sendLoginOtpEmail = async ({ to, ownerName, otpCode, otpExpiresMinutes = 10 }) => {
  const branding = await resolveMailBranding();
  const template = getVerificationOtpMailTemplate({
    ownerName,
    otpCode,
    otpExpiresMinutes,
    appName: branding.appName,
    purpose: 'login',
    supportEmail: branding.supportEmail,
  });
  return sendMailAsync({
    to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
};

const sendPasswordResetSuccessEmail = async ({ to, ownerName }) => {
  const branding = await resolveMailBranding();
  const template = getPasswordResetSuccessMailTemplate({
    ownerName,
    appName: branding.appName,
    supportEmail: branding.supportEmail,
  });
  return sendMailAsync({
    to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
};

const sendWelcomeEmail = async ({ to, ownerName }) => {
  const branding = await resolveMailBranding();
  const frontendBase = String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  const loginUrl = frontendBase ? `${frontendBase}/auth/login` : null;
  const template = getWelcomeMailTemplate({
    ownerName,
    appName: branding.appName,
    supportEmail: branding.supportEmail,
    loginUrl,
  });
  return sendMailAsync({
    to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
};

const signPasswordResetToken = ({ user_id, organization_id, email, otp_id }) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error('JWT_SECRET is not set');
    err.status = 500;
    throw err;
  }

  return jwt.sign(
    {
      sub: Number(user_id),
      org: organization_id ? Number(organization_id) : null,
      email: normalizeEmail(email),
      otp_id: Number(otp_id),
      purpose: 'password_reset',
    },
    secret,
    { expiresIn: process.env.RESET_PASSWORD_TOKEN_EXPIRES_IN || '15m' }
  );
};

const verifyPasswordResetToken = (token) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error('JWT_SECRET is not set');
    err.status = 500;
    throw err;
  }
  return jwt.verify(token, secret);
};

const buildResetPasswordLink = ({ resetToken, email }) => {
  const base =
    process.env.RESET_PASSWORD_LINK_BASE ||
    `${String(process.env.FRONTEND_URL || '').replace(/\/+$/, '')}/auth/reset-password`;
  if (!base || base === '/auth/reset-password') return null;

  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(email)}`;
};

const generateOrgKey = (base) => {
  const safe = (base || 'org').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 40) || 'org';
  const suffix = crypto.randomBytes(4).toString('hex');
  return `${safe}_${suffix}`;
};

const sanitizeOptionalText = (value, maxLength = 120) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
};

const isLoopbackIp = (value = '') => {
  const ip = String(value || '').trim().toLowerCase();
  if (!ip) return false;
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === 'localhost' ||
    ip === '::ffff:127.0.0.1'
  );
};

const detectBrowserFromUserAgent = (userAgent = '') => {
  const ua = String(userAgent || '');
  if (!ua) return '';
  if (/EdgA?\/\d+/i.test(ua)) return 'Edge';
  if (/OPR\/\d+/i.test(ua)) return 'Opera';
  if (/Firefox\/\d+/i.test(ua)) return 'Firefox';
  if (/Chrome\/\d+/i.test(ua)) return 'Chrome';
  if (/Version\/\d+.*Safari/i.test(ua)) return 'Safari';
  return '';
};

const buildDeviceNameFallback = ({ hostname, osName, userAgent, ipAddress }) => {
  const host = sanitizeOptionalText(hostname, 120);
  if (host) return host;

  const osLabel = sanitizeOptionalText(osName, 80);
  const browserLabel = sanitizeOptionalText(detectBrowserFromUserAgent(userAgent), 40);
  if (osLabel && browserLabel) return `${osLabel} - ${browserLabel}`;
  if (osLabel) return osLabel;
  if (browserLabel) return browserLabel;

  const ipSuffix = sanitizeOptionalText(ipAddress, 45);
  if (ipSuffix) return `Device-${ipSuffix}`;
  return `Device-${Date.now().toString(36)}`;
};

const getDevicePayload = (req = {}) => {
  const body = req.body || {};
  const forwardedFor = String(req.headers?.['x-forwarded-for'] || '').split(',')[0]?.trim() || null;
  const rawIpAddress = forwardedFor || req.ip || req.socket?.remoteAddress || '0.0.0.0';
  const geo = resolveGeoFromIp(rawIpAddress);
  const rawClientDeviceId =
    body.client_device_id ||
    body.clientDeviceId ||
    req.headers?.['x-device-id'] ||
    null;
  const rawDeviceType = (body.device_type || body.deviceType || 'other').toString().trim().toLowerCase();
  if (!ALLOWED_DEVICE_TYPES.has(rawDeviceType)) {
    const err = new Error('device_type must be one of mobile, desktop, tablet, other');
    err.status = 400;
    throw err;
  }

  const rawDeviceName = sanitizeOptionalText(body.device_name ?? body.deviceName, 120);
  const normalizedClientDeviceId = rawClientDeviceId ? String(rawClientDeviceId).trim().slice(0, 191) : null;
  const hostname =
    sanitizeOptionalText(body.hostname ?? body.host_name ?? req.headers?.['x-client-hostname'], 255) ||
    (isLoopbackIp(rawIpAddress) ? sanitizeOptionalText(os.hostname(), 255) : null);
  const osName =
    sanitizeOptionalText(body.os_name ?? body.osName ?? req.headers?.['x-client-os'], 120) ||
    (isLoopbackIp(rawIpAddress) ? sanitizeOptionalText(os.platform(), 120) : null);
  const userAgent = req.headers?.['user-agent'] || null;
  const resolvedDeviceName =
    rawDeviceName ||
    buildDeviceNameFallback({
      hostname,
      osName,
      userAgent,
      ipAddress: geo.ip_address || rawIpAddress,
    });

  return {
    client_device_id: normalizedClientDeviceId || null,
    device_name: resolvedDeviceName,
    device_type: rawDeviceType,
    hostname,
    os_name: osName,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    accuracy_radius: body.accuracy_radius ?? body.accuracyRadius ?? null,
    country: body.country || geo.country || null,
    city: body.city || geo.city || null,
    ip_address: geo.ip_address || rawIpAddress,
    user_agent: userAgent,
  };
};

const register = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
      const err = new Error('email, name, and password are required');
      err.status = 400;
      throw err;
    }

    const existing = await userModel.findByEmailWithMembership(email);
    if (existing) {
      const err = new Error('Email already exists');
      err.status = 409;
      throw err;
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await userModel.createUser({ email, name, password_hash });
    await logActivitySafe({
      ...buildActorFromRequest(req, {
        actor_id: user.user_id,
        actor_role_key: 'self',
      }),
      ...requestMeta,
      target_type: 'user',
      target_id: user.user_id,
      action: 'auth.register',
      action_category: 'auth',
      action_subtype: 'register',
      description: `User registered with email ${user.email}`,
      new_values: {
        user_id: user.user_id,
        email: user.email,
        name: user.name,
      },
      is_successful: true,
      status: 'success',
    });
    return success(res, { user_id: user.user_id, email: user.email, name: user.name }, 'User registered', 201);
  } catch (error) {
    return next(error);
  }
};

const createNewAccount = async (req, res, next) => {
  try {
    const { company_name, owner_name, email, phone, password } = req.body || {};

    if (!company_name || !owner_name || !email || !phone || !password) {
      const err = new Error('company_name, owner_name, email, phone, password are required');
      err.status = 400;
      throw err;
    }

    if (String(company_name).trim().length < 2 || String(company_name).trim().length > 150) {
      const err = new Error('company_name must be between 2 and 150 characters');
      err.status = 400;
      throw err;
    }

    if (String(owner_name).trim().length < 2 || String(owner_name).trim().length > 120) {
      const err = new Error('owner_name must be between 2 and 120 characters');
      err.status = 400;
      throw err;
    }

    if (String(password).length < 8) {
      const err = new Error('password must be at least 8 characters');
      err.status = 400;
      throw err;
    }

    const normalizedEmail = ensureBusinessEmail(email);
    const emailDomain = getEmailDomain(normalizedEmail);
    if (!emailDomain) {
      const err = new Error('Unable to derive domain from email');
      err.status = 400;
      throw err;
    }

    const normalizedPhone = normalizePhone(phone);
    const orgName = String(company_name).trim();
    const ownerName = String(owner_name).trim();
    const password_hash = await bcrypt.hash(String(password), 10);
    const otpCode = generateOtpCode();

    const account = await db.withTransaction(async (tx) => {
      const existingUser = await tx.query(
        'SELECT user_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [normalizedEmail]
      );

      if (existingUser.rows.length) {
        const err = new Error('Email already exists');
        err.status = 409;
        throw err;
      }

      const existingOrgByDomain = await tx.query(
        `SELECT organization_id
         FROM organizations
         WHERE LOWER(custom_domain) = LOWER($1)
         LIMIT 1`,
        [emailDomain]
      );

      if (existingOrgByDomain.rows.length) {
        const err = new Error('Organization already exist');
        err.status = 409;
        throw err;
      }

      const roleCheck = await tx.query('SELECT role_id FROM roles WHERE role_id = $1 LIMIT 1', [DEFAULT_OWNER_ROLE_ID]);
      if (!roleCheck.rows.length) {
        const err = new Error(`Default role_id ${DEFAULT_OWNER_ROLE_ID} is missing in roles table`);
        err.status = 500;
        throw err;
      }

      const planResult = await tx.query(
        'SELECT plan_id, interval_days, max_users, max_storage_mb FROM plans WHERE plan_id = 1 LIMIT 1'
      );
      if (!planResult.rows.length) {
        const err = new Error('Default plan_id 1 is missing in plans table');
        err.status = 500;
        throw err;
      }
      const defaultPlan = planResult.rows[0];
      const intervalDays = Number(defaultPlan.interval_days);
      if (!Number.isFinite(intervalDays) || intervalDays <= 0) {
        const err = new Error('Default plan interval_days must be greater than 0');
        err.status = 500;
        throw err;
      }

      const userResult = await tx.query(
        `INSERT INTO users (email, name, password_hash, mobile, is_platform_admin, is_global_member)
         VALUES ($1, $2, $3, $4, FALSE, FALSE)
         RETURNING user_id, email, name, mobile`,
        [normalizedEmail, ownerName, password_hash, normalizedPhone]
      );
      const user = userResult.rows[0];

      const baseSubdomain = slugify(orgName) || 'org';
      let subdomain = baseSubdomain;
      let orgKey = generateOrgKey(baseSubdomain);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const subdomainCheck = await tx.query(
          'SELECT organization_id FROM organizations WHERE subdomain = $1 LIMIT 1',
          [subdomain]
        );
        const orgKeyCheck = await tx.query(
          'SELECT organization_id FROM organizations WHERE org_key = $1 LIMIT 1',
          [orgKey]
        );

        if (!subdomainCheck.rows.length && !orgKeyCheck.rows.length) {
          break;
        }

        const suffix = crypto.randomBytes(2).toString('hex');
        subdomain = `${baseSubdomain}-${suffix}`.slice(0, 100);
        orgKey = generateOrgKey(`${baseSubdomain}${suffix}`);
      }

      const organizationResult = await tx.query(
        `INSERT INTO organizations (
           org_key, name, subdomain, custom_domain, owner_id, language_id, timezone_id, storage_used_mb, status
         )
         VALUES ($1, $2, $3, $4, $5, 1, 1, 0, 'active')
         RETURNING organization_id, org_key, name, subdomain, custom_domain, storage_used_mb, status`,
        [orgKey, orgName, subdomain, emailDomain, user.user_id]
      );
      const organization = organizationResult.rows[0];

      await tx.query(
        `INSERT INTO organization_members (organization_id, user_id, role_id, status)
         VALUES ($1, $2, $3, 'active')`,
        [organization.organization_id, user.user_id, DEFAULT_OWNER_ROLE_ID]
      );

      await tx.query(
        `INSERT INTO subscriptions (
           organization_id, plan_id, status, start_date, end_date, max_users, max_storage_mb
         )
         VALUES ($1, $2, 'active', CURRENT_DATE, CURRENT_DATE + ($5 * INTERVAL '1 day'), $3, $4)`,
        [
          organization.organization_id,
          defaultPlan.plan_id,
          defaultPlan.max_users,
          defaultPlan.max_storage_mb,
          intervalDays,
        ]
      );

      const otpResult = await tx.query(
        `INSERT INTO otp_verifications (
           user_id, organization_id, identifier, type, otp_code, purpose, status, expires_at, ip_address
         )
         VALUES ($1, $2, $3, 'email', $4, 'verification', 'pending', NOW() + INTERVAL '10 minutes', $5)
         RETURNING otp_id, expires_at`,
        [user.user_id, organization.organization_id, user.email, otpCode, req.ip || null]
      );

      return {
        user,
        organization,
        otp: otpResult.rows[0],
      };
    });

    runInBackground(sendVerificationOtpEmail({
      to: account.user.email,
      ownerName,
      otpCode,
      otpExpiresMinutes: 10,
      purpose: 'verification',
    }), 'auth.create_account.mail');

    runInBackground(logActivitySafe({
      ...buildActorFromRequest(req, {
        actor_id: account.user.user_id,
        actor_role_key: 'owner',
        context_organization_id: account.organization.organization_id,
      }),
      ...buildRequestMeta(req),
      target_type: 'organization',
      target_id: account.organization.organization_id,
      action: 'auth.create_account',
      action_category: 'auth',
      action_subtype: 'organization_onboarding',
      description: `Account created for ${account.user.email}`,
      new_values: {
        user_id: account.user.user_id,
        email: account.user.email,
        organization_id: account.organization.organization_id,
        otp_id: account.otp.otp_id,
      },
      is_successful: true,
      status: 'success',
    }), 'auth.create_account.activity_log');

    return success(
      res,
      {
        user: account.user,
        organization: account.organization,
        otp: {
          otp_id: account.otp.otp_id,
          expires_at: account.otp.expires_at,
        },
        resend_available_in_seconds: OTP_RESEND_COOLDOWN_SECONDS,
      },
      'Account created. Verification OTP sent to business email.',
      201
    );
  } catch (error) {
    return next(error);
  }
};

const resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      const err = new Error('email is required');
      err.status = 400;
      throw err;
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      const err = new Error('Valid email is required');
      err.status = 400;
      throw err;
    }

    const payload = await db.withTransaction(async (tx) => {
      const userResult = await tx.query(
        `SELECT user_id, name, email, email_verified_at
         FROM users
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [normalizedEmail]
      );

      if (!userResult.rows.length) {
        const err = new Error('Email is not registered');
        err.status = 404;
        throw err;
      }

      const user = userResult.rows[0];
      if (user.email_verified_at) {
        const err = new Error('Email already verified');
        err.status = 409;
        throw err;
      }

      const membershipResult = await tx.query(
        `SELECT om.organization_id
         FROM organization_members om
         WHERE om.user_id = $1
         ORDER BY om.joined_at ASC NULLS LAST
         LIMIT 1`,
        [user.user_id]
      );

      const organizationId = membershipResult.rows[0]?.organization_id || null;

      await enforceOtpIssuePolicy(tx, {
        email: normalizedEmail,
        purpose: 'verification',
      });

      await tx.query(
        `UPDATE otp_verifications
         SET status = 'expired'
         WHERE LOWER(identifier) = LOWER($1)
           AND type = 'email'
           AND purpose = 'verification'
           AND status = 'pending'`,
        [normalizedEmail]
      );

      const otpCode = generateOtpCode();
      const otpInsertResult = await tx.query(
        `INSERT INTO otp_verifications (
           user_id, organization_id, identifier, type, otp_code, purpose, status, expires_at, ip_address
         )
         VALUES ($1, $2, $3, 'email', $4, 'verification', 'pending', NOW() + INTERVAL '10 minutes', $5)
         RETURNING otp_id, expires_at`,
        [user.user_id, organizationId, user.email, otpCode, req.ip || null]
      );

      return {
        email: user.email,
        owner_name: user.name || 'User',
        otp_code: otpCode,
        otp: otpInsertResult.rows[0],
      };
    });

    runInBackground(sendVerificationOtpEmail({
      to: payload.email,
      ownerName: payload.owner_name,
      otpCode: payload.otp_code,
      otpExpiresMinutes: 10,
      purpose: 'login',
    }), 'auth.resend_otp.mail');

    runInBackground(logActivitySafe({
      ...buildActorFromRequest(req, {
        actor_role_key: 'self',
      }),
      ...buildRequestMeta(req),
      target_type: 'otp_verification',
      target_id: payload.otp.otp_id,
      action: 'auth.resend_otp',
      action_category: 'security',
      action_subtype: 'verification_otp',
      description: `Verification OTP resent to ${payload.email}`,
      new_values: {
        email: payload.email,
        otp_id: payload.otp.otp_id,
        expires_at: payload.otp.expires_at,
      },
      is_successful: true,
      status: 'success',
    }), 'auth.resend_otp.activity_log');

    return success(
      res,
      {
        email: payload.email,
        otp: payload.otp,
        resend_available_in_seconds: OTP_RESEND_COOLDOWN_SECONDS,
      },
      'OTP resent successfully'
    );
  } catch (error) {
    return next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      const err = new Error('email is required');
      err.status = 400;
      throw err;
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      const err = new Error('Valid email is required');
      err.status = 400;
      throw err;
    }

    const payload = await db.withTransaction(async (tx) => {
      const userResult = await tx.query(
        `SELECT user_id, name, email
         FROM users
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [normalizedEmail]
      );

      if (!userResult.rows.length) {
        const err = new Error('Email is not registered');
        err.status = 404;
        throw err;
      }

      const user = userResult.rows[0];
      const membershipResult = await tx.query(
        `SELECT organization_id
         FROM organization_members
         WHERE user_id = $1
         ORDER BY joined_at ASC NULLS LAST
         LIMIT 1`,
        [user.user_id]
      );

      const organizationId = membershipResult.rows[0]?.organization_id || null;

      await enforceOtpIssuePolicy(tx, {
        email: normalizedEmail,
        purpose: 'password_reset',
      });

      await tx.query(
        `UPDATE otp_verifications
         SET status = 'expired'
         WHERE LOWER(identifier) = LOWER($1)
           AND type = 'email'
           AND purpose = 'password_reset'
           AND status = 'pending'`,
        [normalizedEmail]
      );

      const otpCode = generateOtpCode();
      const otpResult = await tx.query(
        `INSERT INTO otp_verifications (
           user_id, organization_id, identifier, type, otp_code, purpose, status, expires_at, ip_address
         )
         VALUES ($1, $2, $3, 'email', $4, 'password_reset', 'pending', NOW() + INTERVAL '10 minutes', $5)
         RETURNING otp_id, expires_at`,
        [user.user_id, organizationId, user.email, otpCode, req.ip || null]
      );

      return {
        email: user.email,
        owner_name: user.name || 'User',
        otp_code: otpCode,
        otp: otpResult.rows[0],
      };
    });

    runInBackground(sendForgotPasswordOtpEmail({
      to: payload.email,
      ownerName: payload.owner_name,
      otpCode: payload.otp_code,
      otpExpiresMinutes: 10,
    }), 'auth.forgot_password.mail');

    runInBackground(logActivitySafe({
      ...buildActorFromRequest(req, {
        actor_role_key: 'self',
      }),
      ...buildRequestMeta(req),
      target_type: 'otp_verification',
      target_id: payload.otp.otp_id,
      action: 'auth.forgot_password_otp',
      action_category: 'security',
      action_subtype: 'password_reset_otp',
      description: `Password reset OTP issued for ${payload.email}`,
      new_values: {
        email: payload.email,
        otp_id: payload.otp.otp_id,
        expires_at: payload.otp.expires_at,
      },
      is_successful: true,
      status: 'success',
    }), 'auth.forgot_password.activity_log');

    return success(
      res,
      {
        email: payload.email,
        otp: payload.otp,
        resend_available_in_seconds: OTP_RESEND_COOLDOWN_SECONDS,
      },
      'Password reset OTP sent'
    );
  } catch (error) {
    return next(error);
  }
};

const verifyForgotPasswordOtp = async (req, res, next) => {
  try {
    const { email, otp_code } = req.body || {};
    if (!email || !otp_code) {
      const err = new Error('email and otp_code are required');
      err.status = 400;
      throw err;
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      const err = new Error('Valid email is required');
      err.status = 400;
      throw err;
    }

    const normalizedOtp = String(otp_code).trim();
    if (!/^\d{6}$/.test(normalizedOtp)) {
      const err = new Error('otp_code must be a 6-digit code');
      err.status = 400;
      throw err;
    }

    const resetContext = await db.withTransaction(async (tx) => {
      const userResult = await tx.query(
        `SELECT user_id, email
         FROM users
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [normalizedEmail]
      );

      if (!userResult.rows.length) {
        const err = new Error('Email is not registered');
        err.status = 404;
        throw err;
      }

      const user = userResult.rows[0];
      const otpResult = await tx.query(
        `SELECT *
         FROM otp_verifications
         WHERE LOWER(identifier) = LOWER($1)
           AND type = 'email'
           AND purpose = 'password_reset'
         ORDER BY created_at DESC
         LIMIT 1`,
        [normalizedEmail]
      );

      if (!otpResult.rows.length) {
        const err = new Error('No password reset OTP found');
        err.status = 404;
        throw err;
      }

      const otp = otpResult.rows[0];
      if (otp.status === 'verified') {
        const err = new Error('OTP already used');
        err.status = 409;
        throw err;
      }

      if (otp.status === 'failed') {
        const lockRemainingSeconds = getOtpLockRemainingSeconds(otp);
        return {
          otp_error: {
            message:
              lockRemainingSeconds > 0
                ? `Too many failed OTP attempts. Try again in ${lockRemainingSeconds}s.`
                : 'Maximum OTP attempts reached. Please request a new OTP.',
            status: 429,
            details: {
              attempt_number: Number(otp.max_attempts || 5),
              max_attempts: Number(otp.max_attempts || 5),
              attempts_left: 0,
              locked_for_seconds: lockRemainingSeconds,
              retry_after_seconds: lockRemainingSeconds,
            },
          },
        };
      }

      if (otp.status !== 'pending') {
        const err = new Error(`OTP is ${otp.status}. Please request a new OTP`);
        err.status = 400;
        throw err;
      }

      if (otp.expires_at && new Date(otp.expires_at) <= new Date()) {
        await tx.query(
          `UPDATE otp_verifications
           SET status = 'expired'
           WHERE otp_id = $1`,
          [otp.otp_id]
        );
        const err = new Error('OTP expired');
        err.status = 400;
        throw err;
      }

      const nextAttempt = Number(otp.attempt_count || 0) + 1;
      if (otp.otp_code !== normalizedOtp) {
        const maxAttempts = Number(otp.max_attempts || 5);
        const reachedMax = nextAttempt >= maxAttempts;
        const remainingAttempts = Math.max(maxAttempts - nextAttempt, 0);
        const lockRemainingSeconds = reachedMax ? OTP_LOCK_WINDOW_MINUTES * 60 : 0;
        await tx.query(
          `UPDATE otp_verifications
           SET attempt_count = $1,
               status = CASE WHEN $2 THEN 'failed' ELSE status END
           WHERE otp_id = $3`,
          [nextAttempt, reachedMax, otp.otp_id]
        );
        return {
          otp_error: {
            message: reachedMax
              ? `Too many failed OTP attempts. Try again in ${lockRemainingSeconds}s.`
              : `Invalid OTP. Attempt ${nextAttempt}/${maxAttempts}. ${remainingAttempts} attempts left`,
            status: reachedMax ? 429 : 400,
            details: {
              attempt_number: nextAttempt,
              max_attempts: maxAttempts,
              attempts_left: remainingAttempts,
              locked_for_seconds: lockRemainingSeconds,
              retry_after_seconds: lockRemainingSeconds,
            },
          },
        };
      }

      await tx.query(
        `UPDATE otp_verifications
         SET status = 'verified',
             verified_at = NOW()
         WHERE otp_id = $1`,
        [otp.otp_id]
      );

      return {
        user_id: user.user_id,
        email: user.email,
        otp_id: otp.otp_id,
        organization_id: otp.organization_id || null,
      };
    });

    if (resetContext?.otp_error) {
      const err = new Error(resetContext.otp_error.message);
      err.status = resetContext.otp_error.status;
      err.details = resetContext.otp_error.details;
      throw err;
    }

    const reset_token = signPasswordResetToken({
      user_id: resetContext.user_id,
      organization_id: resetContext.organization_id,
      email: resetContext.email,
      otp_id: resetContext.otp_id,
    });
    const reset_link = buildResetPasswordLink({
      resetToken: reset_token,
      email: resetContext.email,
    });

    runInBackground(logActivitySafe({
      ...buildActorFromRequest(req, {
        actor_id: resetContext.user_id,
        actor_role_key: 'self',
        context_organization_id: resetContext.organization_id,
      }),
      ...buildRequestMeta(req),
      target_type: 'otp_verification',
      target_id: resetContext.otp_id,
      action: 'auth.forgot_verify',
      action_category: 'security',
      action_subtype: 'password_reset_otp_verified',
      description: `Password reset OTP verified for ${normalizedEmail}`,
      new_values: {
        email: normalizedEmail,
        otp_id: resetContext.otp_id,
      },
      is_successful: true,
      status: 'success',
    }), 'auth.forgot_verify.activity_log');

    return success(
      res,
      {
        email: normalizedEmail,
        reset_token,
        reset_link,
      },
      'OTP verified. Use reset_token to set a new password.'
    );
  } catch (error) {
    return next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { reset_token, new_password } = req.body || {};
    if (!reset_token || !new_password) {
      const err = new Error('reset_token and new_password are required');
      err.status = 400;
      throw err;
    }

    if (String(new_password).length < 8) {
      const err = new Error('new_password must be at least 8 characters');
      err.status = 400;
      throw err;
    }

    let tokenPayload;
    try {
      tokenPayload = verifyPasswordResetToken(String(reset_token));
    } catch (tokenError) {
      const err = new Error('Invalid or expired reset_token');
      err.status = 401;
      throw err;
    }

    if (tokenPayload?.purpose !== 'password_reset') {
      const err = new Error('Invalid reset_token purpose');
      err.status = 401;
      throw err;
    }

    const tokenUserId = Number(tokenPayload?.sub);
    const tokenOtpId = Number(tokenPayload?.otp_id);
    const tokenEmail = normalizeEmail(tokenPayload?.email || '');

    if (!Number.isFinite(tokenUserId) || tokenUserId <= 0 || !Number.isFinite(tokenOtpId) || tokenOtpId <= 0) {
      const err = new Error('Invalid reset_token payload');
      err.status = 401;
      throw err;
    }

    const resetContext = await db.withTransaction(async (tx) => {
      const userResult = await tx.query(
        `SELECT user_id, email, name, password_hash
         FROM users
         WHERE user_id = $1
         LIMIT 1`,
        [tokenUserId]
      );

      if (!userResult.rows.length) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
      }

      const user = userResult.rows[0];
      if (tokenEmail && normalizeEmail(user.email) !== tokenEmail) {
        const err = new Error('reset_token does not match user');
        err.status = 401;
        throw err;
      }

      const otpResult = await tx.query(
        `SELECT otp_id, status, purpose, user_id, organization_id
         FROM otp_verifications
         WHERE otp_id = $1
         LIMIT 1`,
        [tokenOtpId]
      );

      if (!otpResult.rows.length) {
        const err = new Error('Invalid reset_token reference');
        err.status = 401;
        throw err;
      }

      const otp = otpResult.rows[0];
      if (Number(otp.user_id) !== Number(user.user_id)) {
        const err = new Error('reset_token OTP/user mismatch');
        err.status = 401;
        throw err;
      }

      if (otp.purpose !== 'password_reset') {
        const err = new Error('Invalid OTP purpose for password reset');
        err.status = 401;
        throw err;
      }

      if (otp.status !== 'verified') {
        const err = new Error('Reset token is no longer valid. Verify OTP again.');
        err.status = 401;
        throw err;
      }

      const isSamePassword = await bcrypt.compare(String(new_password), user.password_hash);
      if (isSamePassword) {
        const err = new Error('New password must be different from current password');
        err.status = 400;
        throw err;
      }

      const passwordHash = await bcrypt.hash(String(new_password), 10);
      await tx.query(
        `UPDATE users
         SET password_hash = $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [passwordHash, user.user_id]
      );

      await tx.query(
        `UPDATE user_sessions
         SET status = 'revoked',
             revoked_at = NOW()
         WHERE user_id = $1
           AND status = 'active'`,
        [user.user_id]
      );

      await tx.query(
        `UPDATE otp_verifications
         SET status = 'expired'
         WHERE otp_id = $1`,
        [otp.otp_id]
      );

      return {
        user_id: user.user_id,
        email: user.email,
        name: user.name || 'User',
        organization_id: otp.organization_id || null,
      };
    });

    runInBackground(logActivitySafe({
      ...buildActorFromRequest(req, {
        actor_id: resetContext.user_id,
        actor_role_key: 'self',
        context_organization_id: resetContext.organization_id,
      }),
      ...buildRequestMeta(req),
      target_type: 'user',
      target_id: resetContext.user_id,
      action: 'auth.reset_password',
      action_category: 'security',
      action_subtype: 'password_reset',
      description: `Password reset successful for ${normalizeEmail(resetContext.email)}`,
      new_values: {
        email: normalizeEmail(resetContext.email),
      },
      is_successful: true,
      status: 'success',
    }), 'auth.reset_password.activity_log');

    runInBackground(sendPasswordResetSuccessEmail({
      to: resetContext.email,
      ownerName: resetContext.name,
    }), 'auth.reset_password.mail');

    return success(res, { email: normalizeEmail(resetContext.email) }, 'Password reset successful');
  } catch (error) {
    return next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { old_password, new_password, confirm_password } = req.body || {};
    if (!old_password || !new_password || !confirm_password) {
      const err = new Error('old_password, new_password, confirm_password are required');
      err.status = 400;
      throw err;
    }

    if (String(new_password).length < 8) {
      const err = new Error('new_password must be at least 8 characters');
      err.status = 400;
      throw err;
    }

    if (String(new_password) !== String(confirm_password)) {
      const err = new Error('new_password and confirm_password do not match');
      err.status = 400;
      throw err;
    }

    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }

    const changed = await db.withTransaction(async (tx) => {
      const userResult = await tx.query(
        `SELECT user_id, email, name, password_hash
         FROM users
         WHERE user_id = $1
         LIMIT 1`,
        [userId]
      );

      if (!userResult.rows.length) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
      }

      const user = userResult.rows[0];
      const oldMatches = await bcrypt.compare(String(old_password), user.password_hash);
      if (!oldMatches) {
        const err = new Error('Old password is incorrect');
        err.status = 400;
        throw err;
      }

      const isSamePassword = await bcrypt.compare(String(new_password), user.password_hash);
      if (isSamePassword) {
        const err = new Error('New password must be different from current password');
        err.status = 400;
        throw err;
      }

      const passwordHash = await bcrypt.hash(String(new_password), 10);
      await tx.query(
        `UPDATE users
         SET password_hash = $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [passwordHash, user.user_id]
      );

      await tx.query(
        `UPDATE user_sessions
         SET status = 'revoked',
             revoked_at = NOW()
         WHERE user_id = $1
           AND status = 'active'`,
        [user.user_id]
      );

      return {
        user_id: user.user_id,
        email: user.email,
        name: user.name || 'User',
      };
    });

    runInBackground(logActivitySafe({
      ...buildActorFromRequest(req, {
        actor_id: changed.user_id,
        actor_role_key: 'self',
        context_organization_id: req.user?.org || null,
      }),
      ...buildRequestMeta(req),
      context_organization_id: req.user?.org || null,
      target_type: 'user',
      target_id: changed.user_id,
      action: 'auth.change_password',
      action_category: 'security',
      action_subtype: 'password_change',
      description: `Password changed for ${normalizeEmail(changed.email)}`,
      new_values: {
        email: normalizeEmail(changed.email),
      },
      is_successful: true,
      status: 'success',
    }), 'auth.change_password.activity_log');

    runInBackground(sendPasswordResetSuccessEmail({
      to: changed.email,
      ownerName: changed.name,
    }), 'auth.change_password.mail');

    return success(
      res,
      {
        email: normalizeEmail(changed.email),
      },
      'Password changed successfully. Please login again.'
    );
  } catch (error) {
    return next(error);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp_code } = req.body || {};
    if (!email || !otp_code) {
      const err = new Error('email and otp_code are required');
      err.status = 400;
      throw err;
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      const err = new Error('Valid email is required');
      err.status = 400;
      throw err;
    }

    const normalizedOtp = String(otp_code).trim();
    if (!/^\d{6}$/.test(normalizedOtp)) {
      const err = new Error('otp_code must be a 6-digit code');
      err.status = 400;
      throw err;
    }

    const result = await db.withTransaction(async (tx) => {
      const userResult = await tx.query(
        `SELECT user_id, name, email, email_verified_at
         FROM users
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [normalizedEmail]
      );

      if (!userResult.rows.length) {
        const err = new Error('Email is not registered');
        err.status = 404;
        throw err;
      }

      const user = userResult.rows[0];
      if (user.email_verified_at) {
        const err = new Error('Email already verified');
        err.status = 409;
        throw err;
      }

      const otpResult = await tx.query(
        `SELECT *
         FROM otp_verifications
         WHERE LOWER(identifier) = LOWER($1)
           AND type = 'email'
           AND purpose = 'verification'
         ORDER BY created_at DESC
         LIMIT 1`,
        [normalizedEmail]
      );

      if (!otpResult.rows.length) {
        const err = new Error('No OTP generated for this email');
        err.status = 404;
        throw err;
      }

      const otp = otpResult.rows[0];
      if (otp.status === 'verified') {
        const err = new Error('OTP already used');
        err.status = 409;
        throw err;
      }

      if (otp.status === 'failed') {
        const lockRemainingSeconds = getOtpLockRemainingSeconds(otp);
        const err = buildOtpLockError(
          lockRemainingSeconds,
          'OTP blocked due to max attempts. Please request a new OTP'
        );
        err.details = {
          ...(err.details || {}),
          attempt_number: Number(otp.max_attempts || 5),
          max_attempts: Number(otp.max_attempts || 5),
          attempts_left: 0,
        };
        throw err;
      }

      if (otp.status !== 'pending') {
        const err = new Error(`OTP is ${otp.status}. Please request a new OTP`);
        err.status = 400;
        throw err;
      }

      if (otp.expires_at && new Date(otp.expires_at) <= new Date()) {
        await tx.query(
          `UPDATE otp_verifications
           SET status = 'expired'
           WHERE otp_id = $1`,
          [otp.otp_id]
        );
        const err = new Error('OTP expired');
        err.status = 400;
        throw err;
      }

      const nextAttempt = Number(otp.attempt_count || 0) + 1;
      if (otp.otp_code !== normalizedOtp) {
        const maxAttempts = Number(otp.max_attempts || 5);
        const reachedMax = nextAttempt >= maxAttempts;
        const remainingAttempts = Math.max(maxAttempts - nextAttempt, 0);
        const lockRemainingSeconds = reachedMax ? OTP_LOCK_WINDOW_MINUTES * 60 : 0;
        await tx.query(
          `UPDATE otp_verifications
           SET attempt_count = $1,
               status = CASE WHEN $2 THEN 'failed' ELSE status END
           WHERE otp_id = $3`,
          [nextAttempt, reachedMax, otp.otp_id]
        );
        const err = new Error(
          reachedMax
            ? `Too many failed OTP attempts. Try again in ${lockRemainingSeconds}s.`
            : `Invalid OTP. ${remainingAttempts} attempts left`
        );
        err.status = reachedMax ? 429 : 400;
        err.details = {
          attempt_number: nextAttempt,
          max_attempts: maxAttempts,
          attempts_left: remainingAttempts,
          locked_for_seconds: lockRemainingSeconds,
          retry_after_seconds: lockRemainingSeconds,
        };
        throw err;
      }

      await tx.query(
        `UPDATE otp_verifications
         SET status = 'verified',
             verified_at = NOW()
         WHERE otp_id = $1`,
        [otp.otp_id]
      );

      const verifyUserResult = await tx.query(
        `UPDATE users
         SET email_verified_at = NOW(),
             updated_at = NOW()
         WHERE user_id = $1
           AND email_verified_at IS NULL
         RETURNING user_id`,
        [otp.user_id]
      );

      return {
        user_id: otp.user_id,
        organization_id: otp.organization_id,
        otp_id: otp.otp_id,
        email: user.email,
        name: user.name,
        welcome_eligible: verifyUserResult.rowCount > 0,
      };
    });

    await logActivitySafe({
      ...buildActorFromRequest(req, {
        actor_id: result.user_id,
        actor_role_key: 'self',
        context_organization_id: result.organization_id,
      }),
      ...buildRequestMeta(req),
      target_type: 'otp_verification',
      target_id: result.otp_id,
      action: 'auth.verify_otp',
      action_category: 'security',
      action_subtype: 'email_verification',
      description: `Email verified for ${normalizedEmail}`,
      new_values: {
        email: normalizedEmail,
        user_id: result.user_id,
        organization_id: result.organization_id,
      },
      is_successful: true,
      status: 'success',
    });

    if (result.welcome_eligible) {
      runInBackground(
        sendWelcomeEmail({
          to: result.email || normalizedEmail,
          ownerName: result.name || 'User',
        }),
        'auth.verify_otp.welcome_mail'
      );
    }

    return success(
      res,
      {
        verified: true,
        user_id: result.user_id,
        organization_id: result.organization_id,
      },
      'OTP verified successfully'
    );
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const { email, password, otp_code } = req.body || {};
    if (!email || !password) {
      const err = new Error('email and password are required');
      err.status = 400;
      throw err;
    }

    const user = await userModel.findByEmailWithMembership(email);
    if (!user) {
      const err = new Error('Invalid credentials');
      err.status = 401;
      throw err;
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      const err = new Error('Invalid credentials');
      err.status = 401;
      throw err;
    }

    const normalizedUserStatus = String(user.status || '').trim().toLowerCase();
    if (normalizedUserStatus !== 'active') {
      const err = new Error('Your account is not active. Please contact support.');
      err.status = 403;
      throw err;
    }

    const activeMembershipCheck = await db.query(
      `SELECT organization_id, status
       FROM organization_members
       WHERE user_id = $1
       ORDER BY joined_at DESC
       LIMIT 1`,
      [user.user_id]
    );
    const latestMembership = activeMembershipCheck.rows[0] || null;
    if (!latestMembership || String(latestMembership.status || '').trim().toLowerCase() !== 'active') {
      const err = new Error('Your organization membership is inactive. Please contact admin.');
      err.status = 403;
      throw err;
    }

    const normalizedMembershipStatus = String(user.membership_status || '')
      .trim()
      .toLowerCase();
    if (!user.organization_id || normalizedMembershipStatus !== 'active') {
      const err = new Error('Your organization access is inactive. Please contact admin.');
      err.status = 403;
      throw err;
    }

    const normalizedEmail = normalizeEmail(email);
    const devicePayload = getDevicePayload(req);

    // Check if device is trusted (previously OTP-verified) OR biometric-verified
    const biometricVerified = req.body.biometric_verified === true;
    const trustedDevice =
      !otp_code && devicePayload.client_device_id
        ? await userDeviceModel.findByClientDeviceId({
            user_id: user.user_id,
            client_device_id: devicePayload.client_device_id,
            trustedOnly: true,
          })
        : null;
    // Skip OTP if: device is trusted OR biometric verified on mobile with known device
    const canSkipOtp = Boolean(trustedDevice) || (biometricVerified && devicePayload.client_device_id);

    if (!otp_code && !canSkipOtp) {
      const otpData = await db.withTransaction(async (tx) => {
        await enforceOtpIssuePolicy(tx, {
          email: normalizedEmail,
          purpose: 'login',
        });

        await tx.query(
          `UPDATE otp_verifications
           SET status = 'expired'
           WHERE LOWER(identifier) = LOWER($1)
             AND type = 'email'
             AND purpose = 'login'
             AND status = 'pending'`,
          [normalizedEmail]
        );

        const otpCode = generateOtpCode();
        const otpResult = await tx.query(
          `INSERT INTO otp_verifications (
             user_id, organization_id, identifier, type, otp_code, purpose, status, expires_at, ip_address
           )
           VALUES ($1, $2, $3, 'email', $4, 'login', 'pending', NOW() + INTERVAL '10 minutes', $5)
           RETURNING otp_id, expires_at`,
          [user.user_id, user.organization_id || null, normalizedEmail, otpCode, req.ip || null]
        );

        return {
          otp_code: otpCode,
          otp: otpResult.rows[0],
        };
      });

      runInBackground(sendLoginOtpEmail({
        to: user.email,
        ownerName: user.name || 'User',
        otpCode: otpData.otp_code,
        otpExpiresMinutes: 10,
      }), 'auth.login_otp.mail');

      runInBackground(logActivitySafe({
        ...buildActorFromRequest(req, {
          actor_id: user.user_id,
          actor_role_key: user.role_key || 'self',
          context_organization_id: user.organization_id || null,
        }),
        ...requestMeta,
        context_organization_id: user.organization_id || null,
        target_type: 'otp_verification',
        target_id: otpData.otp.otp_id,
        action: 'auth.login_otp_sent',
        action_category: 'security',
        action_subtype: 'login_otp',
        description: `Login OTP sent for ${user.email}`,
        new_values: {
          email: user.email,
          otp_id: otpData.otp.otp_id,
          expires_at: otpData.otp.expires_at,
        },
        is_successful: true,
        status: 'success',
      }), 'auth.login_otp.activity_log');

      return success(
        res,
        {
          otp_required: true,
          email: user.email,
          otp: otpData.otp,
          resend_available_in_seconds: OTP_RESEND_COOLDOWN_SECONDS,
        },
        'OTP sent to your email. Verify OTP to complete login.'
      );
    }

    if (otp_code) {
      const normalizedOtp = String(otp_code).trim();
      if (!/^\d{6}$/.test(normalizedOtp)) {
        const err = new Error('otp_code must be a 6-digit code');
        err.status = 400;
        throw err;
      }

      const loginOtpCheck = await db.withTransaction(async (tx) => {
        const otpResult = await tx.query(
          `SELECT *
           FROM otp_verifications
           WHERE LOWER(identifier) = LOWER($1)
             AND type = 'email'
             AND purpose = 'login'
           ORDER BY created_at DESC
           LIMIT 1`,
          [normalizedEmail]
        );

        if (!otpResult.rows.length) {
          const err = new Error('No login OTP found. Please login again to receive OTP');
          err.status = 404;
          throw err;
        }

        const otp = otpResult.rows[0];
        if (otp.status === 'verified') {
          const err = new Error('OTP already used. Please login again to receive new OTP');
          err.status = 409;
          throw err;
        }

        if (otp.status === 'failed') {
          const lockRemainingSeconds = getOtpLockRemainingSeconds(otp);
          return {
            otp_error: {
              message:
                lockRemainingSeconds > 0
                  ? `Too many failed OTP attempts. Try again in ${lockRemainingSeconds}s.`
                  : 'Maximum OTP attempts reached. Please login again for new OTP.',
              status: 429,
              details: {
                attempt_number: Number(otp.attempt_count || otp.max_attempts || 5),
                max_attempts: Number(otp.max_attempts || 5),
                attempts_left: 0,
                locked_for_seconds: lockRemainingSeconds,
                retry_after_seconds: lockRemainingSeconds,
              },
            },
          };
        }

        if (otp.status !== 'pending') {
          const err = new Error(`OTP is ${otp.status}. Please login again.`);
          err.status = 400;
          throw err;
        }

        if (otp.expires_at && new Date(otp.expires_at) <= new Date()) {
          await tx.query(
            `UPDATE otp_verifications
             SET status = 'expired'
             WHERE otp_id = $1`,
            [otp.otp_id]
          );
          const err = new Error('OTP expired. Please login again.');
          err.status = 400;
          throw err;
        }

        const nextAttempt = Number(otp.attempt_count || 0) + 1;
        if (otp.otp_code !== normalizedOtp) {
          const maxAttempts = Number(otp.max_attempts || 5);
          const reachedMax = nextAttempt >= maxAttempts;
          const remainingAttempts = Math.max(maxAttempts - nextAttempt, 0);
          const lockRemainingSeconds = reachedMax ? OTP_LOCK_WINDOW_MINUTES * 60 : 0;
          await tx.query(
            `UPDATE otp_verifications
             SET attempt_count = $1,
                 status = CASE WHEN $2 THEN 'failed' ELSE status END
             WHERE otp_id = $3`,
            [nextAttempt, reachedMax, otp.otp_id]
          );
          return {
            otp_error: {
              message: reachedMax
                ? `Too many failed OTP attempts. Try again in ${lockRemainingSeconds}s.`
                : `Invalid OTP. Attempt ${nextAttempt}/${maxAttempts}. ${remainingAttempts} attempts left`,
              status: reachedMax ? 429 : 400,
              details: {
                attempt_number: nextAttempt,
                max_attempts: maxAttempts,
                attempts_left: remainingAttempts,
                locked_for_seconds: lockRemainingSeconds,
                retry_after_seconds: lockRemainingSeconds,
              },
            },
          };
        }

        await tx.query(
          `UPDATE otp_verifications
           SET status = 'verified',
               verified_at = NOW()
           WHERE otp_id = $1`,
          [otp.otp_id]
        );

        return { otp_verified: true };
      });

      if (loginOtpCheck?.otp_error) {
        const err = new Error(loginOtpCheck.otp_error.message);
        err.status = loginOtpCheck.otp_error.status;
        err.details = loginOtpCheck.otp_error.details;
        throw err;
      }
    }

    // Device limit — max 3 active devices
    const MAX_DEVICES = 3;
    const { rows: activeDevices } = await db.query(
      `SELECT device_id, device_name, last_active_at FROM user_devices
       WHERE user_id = $1 ORDER BY last_active_at DESC`,
      [user.user_id]
    );
    if (activeDevices.length >= MAX_DEVICES && !devicePayload.client_device_id) {
      // New device + already at limit — block login, show existing devices
      const deviceList = activeDevices.map(d => d.device_name || 'Unknown').join(', ');
      const err = new Error(`Maximum ${MAX_DEVICES} devices allowed. Currently logged in: ${deviceList}. Please logout from another device first.`);
      err.status = 403;
      err.deviceLimit = true;
      err.devices = activeDevices.map(d => ({ id: d.device_id, name: d.device_name, lastActive: d.last_active_at }));
      throw err;
    }

    const payload = {
      sub: user.user_id,
      email: user.email,
      org: user.organization_id || null,
      role_id: user.role_id || null,
      role: user.role_key || null,
      name: user.name,
    };

    const access_token = signAccessToken(payload);

    const refresh_token = generateRefreshToken();
    const refresh_token_hash = hashToken(refresh_token);
    const expires_at = getRefreshExpiryDate();
    const device = await userDeviceModel.upsertDeviceForLogin({
      user_id: user.user_id,
      ...devicePayload,
      is_trusted: Boolean(otp_code || canSkipOtp),
    });

    await sessionModel.createSession({
      user_id: user.user_id,
      organization_id: user.organization_id,
      refresh_token_hash,
      user_agent: devicePayload.user_agent,
      ip_address: devicePayload.ip_address,
      device_id: device.device_id,
      expires_at,
    });

    const lastLoginResult = await db.query(
      `UPDATE users
       SET last_login_at = NOW()
       WHERE user_id = $1
       RETURNING last_login_at`,
      [user.user_id]
    );
    const lastLoginAt = lastLoginResult.rows[0]?.last_login_at || null;

    await logActivitySafe({
      ...buildActorFromRequest(req, {
        actor_id: user.user_id,
        actor_role_key: user.role_key || 'self',
        context_organization_id: user.organization_id || null,
      }),
      ...requestMeta,
      context_organization_id: user.organization_id || null,
      target_type: 'user_session',
      target_id: device.device_id || null,
      action: 'auth.login',
      action_category: 'auth',
      action_subtype: 'login',
      description: `Login successful for ${user.email}`,
      new_values: {
        user_id: user.user_id,
        organization_id: user.organization_id || null,
        role_id: user.role_id || null,
      },
      is_successful: true,
      status: 'success',
    });

    const csrfToken = setAuthCookies(req, res, {
      accessToken: access_token,
      refreshToken: refresh_token,
    });

    // Derive plan-expired flag for the user's organization (best-effort; non-blocking)
    let plan_expired = false;
    if (user.organization_id) {
      try {
        const subscription = await billingModel.findLatestSubscriptionByOrganization(user.organization_id);
        if (subscription) {
          const subStatus = String(subscription.status || '').toLowerCase();
          const endDate = subscription.end_date ? new Date(subscription.end_date) : null;
          plan_expired =
            subStatus === 'expired' ||
            subStatus === 'cancelled' ||
            subStatus === 'canceled' ||
            (endDate && !Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now());
        }
      } catch (_) { /* ignore — default to false */ }
    }

    return success(
      res,
      {
        ...(shouldReturnTokens(req)
          ? {
              access_token,
              refresh_token,
              token_type: 'Bearer',
              expires_in: process.env.JWT_EXPIRES_IN || '15m',
            }
          : {}),
        csrf_token: csrfToken,
        user: {
          user_id: user.user_id,
          name: user.name || null,
          email: user.email,
          organization_id: user.organization_id || null,
          role_id: user.role_id || null,
          role_key: user.role_key || null,
          last_login_at: lastLoginAt,
          plan_expired,
        },
        otp_skipped_for_trusted_device: Boolean(canSkipOtp),
      },
      'Login successful'
    );
  } catch (error) {
    return next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const bodyRefreshToken = String(req.body?.refresh_token || '').trim();
    const cookieRefreshToken = readCookie(req, REFRESH_COOKIE);
    const refresh_token = cookieRefreshToken || bodyRefreshToken;
    if (!refresh_token) {
      const err = new Error('refresh_token is required');
      err.status = 400;
      throw err;
    }

    const refresh_token_hash = hashToken(refresh_token);
    const session = await sessionModel.findByTokenHash(refresh_token_hash);
    if (!session) {
      clearAuthCookies(res);
      const err = new Error('Invalid refresh token');
      err.status = 401;
      throw err;
    }

    if (session.status !== 'active') {
      const revokedAtMs = session?.revoked_at ? new Date(session.revoked_at).getTime() : 0;
      const elapsedSinceRevoked = revokedAtMs ? Math.max(Math.ceil((Date.now() - revokedAtMs) / 1000), 0) : null;
      const shouldTreatAsReuse =
        session.status === 'revoked' &&
        elapsedSinceRevoked !== null &&
        elapsedSinceRevoked > REFRESH_REUSE_GRACE_SECONDS;

      if (shouldTreatAsReuse) {
        await sessionModel.revokeAllActiveByUser(session.user_id);
        await userDeviceModel.markAllLoggedOutByUser(session.user_id);
        await logActivitySafe({
          ...buildActorFromRequest(req, {
            actor_id: session.user_id,
            actor_role_key: 'self',
            context_organization_id: session.organization_id || null,
          }),
          ...requestMeta,
          context_organization_id: session.organization_id || null,
          target_type: 'user_session',
          target_id: session.session_id || null,
          action: 'auth.refresh_reuse_detected',
          action_category: 'security',
          action_subtype: 'token_reuse',
          description: `Refresh token reuse detected for user ${session.user_id}`,
          new_values: {
            user_id: session.user_id,
            organization_id: session.organization_id || null,
            session_id: session.session_id,
          },
          is_successful: false,
          status: 'failed',
        });
        clearAuthCookies(res);
        const err = new Error('Session compromised. Logged out from all devices.');
        err.status = 401;
        err.details = {
          force_logout_all: true,
          reason: 'refresh_token_reuse_detected',
        };
        throw err;
      }

      clearAuthCookies(res);
      const err = new Error('Invalid refresh token');
      err.status = 401;
      throw err;
    }

    if (session.expires_at && new Date(session.expires_at) <= new Date()) {
      await sessionModel.revokeById(session.session_id);
      clearAuthCookies(res);
      const err = new Error('Refresh token expired');
      err.status = 401;
      throw err;
    }

    const user = await userModel.findByIdWithMembership(session.user_id, session.organization_id);
    if (!user) {
      const err = new Error('User not found');
      err.status = 401;
      throw err;
    }

    const payload = {
      sub: user.user_id,
      email: user.email,
      org: session.organization_id || null,
      role_id: user.role_id || null,
      role: user.role_key || null,
      name: user.name,
    };

    const access_token = signAccessToken(payload);

    await sessionModel.revokeById(session.session_id);

    const new_refresh_token = generateRefreshToken();
    const new_refresh_hash = hashToken(new_refresh_token);
    const new_expires_at = getRefreshExpiryDate();
    const devicePayload = getDevicePayload(req);

    let deviceId = session.device_id || null;
    if (deviceId) {
      await userDeviceModel.touchDevice(deviceId, devicePayload);
      if (devicePayload.client_device_id) {
        await userDeviceModel.bindClientDeviceId({
          user_id: user.user_id,
          device_id: deviceId,
          client_device_id: devicePayload.client_device_id,
        });
      }
    } else {
      const device = await userDeviceModel.upsertDeviceForLogin({
        user_id: user.user_id,
        ...devicePayload,
      });
      deviceId = device.device_id;
    }

    await sessionModel.createSession({
      user_id: user.user_id,
      organization_id: session.organization_id,
      refresh_token_hash: new_refresh_hash,
      user_agent: devicePayload.user_agent,
      ip_address: devicePayload.ip_address,
      device_id: deviceId,
      expires_at: new_expires_at,
    });

    await logActivitySafe({
      ...buildActorFromRequest(req, {
        actor_id: user.user_id,
        actor_role_key: user.role_key || 'self',
        context_organization_id: session.organization_id || null,
      }),
      ...requestMeta,
      context_organization_id: session.organization_id || null,
      target_type: 'user_session',
      target_id: deviceId || null,
      action: 'auth.refresh',
      action_category: 'auth',
      action_subtype: 'token_refresh',
      description: `Token refreshed for ${user.email}`,
      new_values: {
        user_id: user.user_id,
        organization_id: session.organization_id || null,
      },
      is_successful: true,
      status: 'success',
    });

    const csrfToken = setAuthCookies(req, res, {
      accessToken: access_token,
      refreshToken: new_refresh_token,
    });

    return success(
      res,
      {
        ...(shouldReturnTokens(req)
          ? {
              access_token,
              refresh_token: new_refresh_token,
              token_type: 'Bearer',
              expires_in: process.env.JWT_EXPIRES_IN || '15m',
            }
          : {}),
        csrf_token: csrfToken,
      },
      'Token refreshed'
    );
  } catch (error) {
    return next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const tokenUserId = Number(req.user?.sub || 0);
    const tokenOrgId = Number(req.user?.org || 0) || null;
    if (!Number.isFinite(tokenUserId) || tokenUserId <= 0) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }

    const body = req.body || {};
    const refreshTokenRaw = String(body.refresh_token || readCookie(req, REFRESH_COOKIE) || '').trim();
    const explicitDeviceId = Number.parseInt(body.device_id, 10);
    const devicePayload = getDevicePayload(req);

    let resolvedDeviceId = Number.isFinite(explicitDeviceId) && explicitDeviceId > 0 ? explicitDeviceId : null;
    let resolvedSessionId = null;
    let resolvedOrgId = tokenOrgId;

    if (refreshTokenRaw) {
      const refresh_token_hash = hashToken(refreshTokenRaw);
      const existingSession = await sessionModel.findByTokenHash(refresh_token_hash);
      if (existingSession && Number(existingSession.user_id) === tokenUserId) {
        await sessionModel.revokeByTokenHash(refresh_token_hash);
        resolvedSessionId = existingSession.session_id || null;
        resolvedDeviceId = resolvedDeviceId || existingSession.device_id || null;
        resolvedOrgId = existingSession.organization_id || resolvedOrgId;
      }
    }

    if (!resolvedDeviceId && devicePayload.client_device_id) {
      const matchedDevice = await userDeviceModel.findByClientDeviceId({
        user_id: tokenUserId,
        client_device_id: devicePayload.client_device_id,
      });
      resolvedDeviceId = matchedDevice?.device_id || null;
    }

    if (!refreshTokenRaw && !resolvedDeviceId) {
      const err = new Error('Either refresh_token, device_id, or client_device_id is required');
      err.status = 400;
      throw err;
    }

    if (resolvedDeviceId) {
      if (devicePayload.client_device_id) {
        await userDeviceModel.bindClientDeviceId({
          user_id: tokenUserId,
          device_id: resolvedDeviceId,
          client_device_id: devicePayload.client_device_id,
        });
      }
      await sessionModel.revokeActiveByUserAndDevice({
        user_id: tokenUserId,
        device_id: resolvedDeviceId,
      });
      if ((await sessionModel.countActiveByDevice(resolvedDeviceId)) === 0) {
        await userDeviceModel.markLoggedOut(resolvedDeviceId);
      }
    }

    await logActivitySafe({
      ...buildActorFromRequest(req, {
        actor_id: tokenUserId,
        actor_role_key: 'self',
        context_organization_id: resolvedOrgId,
      }),
      ...requestMeta,
      context_organization_id: resolvedOrgId,
      target_type: 'user_session',
      target_id: resolvedSessionId || resolvedDeviceId || null,
      action: 'auth.logout',
      action_category: 'auth',
      action_subtype: 'logout',
      description: `Logout successful for user ${tokenUserId}`,
      new_values: {
        user_id: tokenUserId,
        organization_id: resolvedOrgId,
        device_id: resolvedDeviceId,
      },
      is_successful: true,
      status: 'success',
    });

    // Force disconnect all sockets so user goes Offline immediately
    disconnectUser(tokenUserId);

    clearAuthCookies(res);
    return success(res, null, 'Logged out');
  } catch (error) {
    return next(error);
  }
};

const logoutAll = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const tokenUserId = Number(req.user?.sub || 0);
    const tokenOrgId = Number(req.user?.org || 0) || null;

    if (!Number.isFinite(tokenUserId) || tokenUserId <= 0) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }

    await sessionModel.revokeAllActiveByUser(tokenUserId);
    await userDeviceModel.markAllLoggedOutByUser(tokenUserId);

    await logActivitySafe({
      ...buildActorFromRequest(req, {
        actor_id: tokenUserId,
        actor_role_key: 'self',
        context_organization_id: tokenOrgId,
      }),
      ...requestMeta,
      context_organization_id: tokenOrgId,
      target_type: 'user_session',
      target_id: tokenUserId,
      action: 'auth.logout_all',
      action_category: 'auth',
      action_subtype: 'logout_all',
      description: `Logout from all devices for user ${tokenUserId}`,
      new_values: {
        user_id: tokenUserId,
        organization_id: tokenOrgId,
      },
      is_successful: true,
      status: 'success',
    });

    // Force disconnect all sockets so user goes Offline immediately
    disconnectUser(tokenUserId);

    clearAuthCookies(res);
    return success(res, null, 'Logged out from all devices');
  } catch (error) {
    return next(error);
  }
};

const listTrustedDevices = async (req, res, next) => {
  try {
    const tokenUserId = Number(req.user?.sub || 0);
    const tokenOrgId = Number(req.user?.org || 0) || null;
    if (!Number.isFinite(tokenUserId) || tokenUserId <= 0) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }

    const [devices, usageResult] = await Promise.all([
      userDeviceModel.listTrustedByUser(tokenUserId),
      tokenOrgId ? db.query(
        `SELECT
           -- Text messages (text, emoji, code, link, system)
           (SELECT COUNT(*)::int FROM messages
            WHERE organization_id = $1 AND sender_id = $2
              AND message_type NOT IN ('file','image','video','audio')) AS msg_count,
           (SELECT COALESCE(SUM(LENGTH(message)), 0) FROM messages
            WHERE organization_id = $1 AND sender_id = $2
              AND message_type NOT IN ('file','image','video','audio')) AS msg_bytes,
           -- Images & Videos
           (SELECT COUNT(*)::int FROM messages
            WHERE organization_id = $1 AND sender_id = $2
              AND message_type IN ('image','video')) AS media_count,
           (SELECT COALESCE(SUM(mf.file_size), 0) FROM message_files mf
            JOIN messages m ON m.message_id = mf.message_id
            WHERE m.organization_id = $1 AND m.sender_id = $2
              AND m.message_type IN ('image','video')) AS media_bytes,
           -- Files (file, audio, pdf, doc)
           (SELECT COUNT(*)::int FROM messages
            WHERE organization_id = $1 AND sender_id = $2
              AND message_type IN ('file','audio')) AS file_count,
           (SELECT COALESCE(SUM(mf.file_size), 0) FROM message_files mf
            JOIN messages m ON m.message_id = mf.message_id
            WHERE m.organization_id = $1 AND m.sender_id = $2
              AND m.message_type IN ('file','audio')) AS file_bytes`,
        [tokenOrgId, tokenUserId]
      ) : Promise.resolve({ rows: [{}] }),
    ]);

    const u = usageResult.rows[0] || {};
    const MB = 1024 * 1024;
    const usage = {
      messages: { count: Number(u.msg_count || 0), sizeMB: Number((Number(u.msg_bytes || 0) / MB).toFixed(2)) },
      media: { count: Number(u.media_count || 0), sizeMB: Number((Number(u.media_bytes || 0) / MB).toFixed(2)) },
      files: { count: Number(u.file_count || 0), sizeMB: Number((Number(u.file_bytes || 0) / MB).toFixed(2)) },
    };
    usage.totalSizeMB = Number((usage.messages.sizeMB + usage.media.sizeMB + usage.files.sizeMB).toFixed(2));

    return success(
      res,
      {
        trusted_devices: devices,
        usage,
      },
      'Trusted devices'
    );
  } catch (error) {
    return next(error);
  }
};

const revokeTrustedDevice = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const tokenUserId = Number(req.user?.sub || 0);
    const tokenOrgId = Number(req.user?.org || 0) || null;
    const deviceId = Number.parseInt(req.params?.deviceId, 10);

    if (!Number.isFinite(tokenUserId) || tokenUserId <= 0) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }

    if (!Number.isFinite(deviceId) || deviceId <= 0) {
      const err = new Error('Valid deviceId is required');
      err.status = 400;
      throw err;
    }

    const updated = await userDeviceModel.setTrustState({
      user_id: tokenUserId,
      device_id: deviceId,
      is_trusted: false,
    });

    if (!updated) {
      const err = new Error('Trusted device not found');
      err.status = 404;
      throw err;
    }

    await sessionModel.revokeActiveByUserAndDevice({
      user_id: tokenUserId,
      device_id: deviceId,
    });
    if ((await sessionModel.countActiveByDevice(deviceId)) === 0) {
      await userDeviceModel.markLoggedOut(deviceId);
    }

    await logActivitySafe({
      ...buildActorFromRequest(req, {
        actor_id: tokenUserId,
        actor_role_key: 'self',
        context_organization_id: tokenOrgId,
      }),
      ...requestMeta,
      context_organization_id: tokenOrgId,
      target_type: 'user_device',
      target_id: deviceId,
      action: 'auth.trusted_device_revoked',
      action_category: 'security',
      action_subtype: 'trusted_device',
      description: `Trusted device revoked for user ${tokenUserId}`,
      new_values: {
        user_id: tokenUserId,
        organization_id: tokenOrgId,
        device_id: deviceId,
      },
      is_successful: true,
      status: 'success',
    });

    return success(res, { device_id: deviceId }, 'Trusted device revoked');
  } catch (error) {
    return next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const tokenUserId = Number(req.user?.sub);
    const orgId = Number(req.user?.org || 0);
    const limitRaw = Number.parseInt(req.query?.limit ?? req.body?.limit, 10);
    const listLimit = Number.isNaN(limitRaw) ? 25 : Math.max(1, Math.min(limitRaw, 100));

    if (!Number.isFinite(tokenUserId) || tokenUserId <= 0) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }

    if (!Number.isFinite(orgId) || orgId <= 0) {
      const err = new Error('Organization context not found in token');
      err.status = 400;
      throw err;
    }

    const userResultPromise = db.query(
      `SELECT
         u.user_id,
         u.email,
         u.name,
         u.profile_url,
         u.mobile,
         u.is_platform_admin,
         u.is_global_member,
         u.email_verified_at,
         u.mobile_verified_at,
         u.last_login_at,
         u.status,
         u.timezone,
         u.created_at,
         u.updated_at
       FROM users u
       WHERE u.user_id = $1
       LIMIT 1`,
      [tokenUserId]
    );

    const organizationResultPromise = db.query(
      `SELECT
         o.organization_id,
         o.org_key,
         o.name,
         o.subdomain,
         o.custom_domain,
         o.owner_id,
         owner.name AS owner_name,
         owner.email AS owner_email,
         o.language_id,
         lang.language_code,
         lang.full_name AS language_name,
         o.timezone_id,
         tz.timezone_code,
         tz.display_name AS timezone_name,
         o.storage_used_mb,
         o.status,
         o.created_at,
         o.updated_at
       FROM organizations o
       LEFT JOIN users owner ON owner.user_id = o.owner_id
       LEFT JOIN languages lang ON lang.language_id = o.language_id
       LEFT JOIN timezones tz ON tz.timezone_id = o.timezone_id
       WHERE o.organization_id = $1
       LIMIT 1`,
      [orgId]
    );

    const membershipResultPromise = db.query(
      `SELECT
         om.membership_id,
         om.organization_id,
         om.user_id,
         om.role_id,
         r.role_key,
         r.role_name,
         om.department_id,
         d.name AS department_name,
         om.designation_id,
         ds.name AS designation_name,
         om.location_id,
         l.label AS location_name,
         om.status AS membership_status,
         om.joined_at
       FROM organization_members om
       LEFT JOIN roles r ON r.role_id = om.role_id
       LEFT JOIN departments d ON d.department_id = om.department_id
       LEFT JOIN designations ds ON ds.designation_id = om.designation_id
       LEFT JOIN locations l ON l.location_id = om.location_id
       WHERE om.organization_id = $1
         AND om.user_id = $2
       LIMIT 1`,
      [orgId, tokenUserId]
    );

    const subscriptionResultPromise = db.query(
      `SELECT
         s.subscription_id,
         s.organization_id,
         s.plan_id,
         s.status,
         s.start_date,
         s.end_date,
         s.max_users,
         s.max_storage_mb,
         p.plan_key,
         p.plan_name,
         p.interval_days,
         p.price,
         p.default_currency
       FROM subscriptions s
       LEFT JOIN plans p ON p.plan_id = s.plan_id
       WHERE s.organization_id = $1
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [orgId]
    );

    const countsResultPromise = db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM organization_members om WHERE om.organization_id = $1) AS total_members,
         (SELECT COUNT(*)::int FROM organization_members om WHERE om.organization_id = $1 AND om.status = 'active') AS active_members,
         (SELECT COUNT(*)::int FROM user_devices ud WHERE ud.user_id = $2) AS user_devices,
         (SELECT COUNT(*)::int FROM user_sessions us WHERE us.user_id = $2 AND us.organization_id = $1) AS user_sessions,
         (SELECT COUNT(*)::int FROM otp_verifications ov WHERE ov.user_id = $2 AND ov.organization_id = $1) AS otp_verifications,
         (SELECT COUNT(*)::int FROM global_access ga WHERE ga.org_id = $1 AND ga.user_id = $2 AND ga.status = 'active') AS global_access_allowed_users,
         (SELECT COUNT(*)::int FROM global_access ga WHERE ga.org_id = $1 AND ga.allow_user_id = $2 AND ga.status = 'active') AS global_access_received`,
      [orgId, tokenUserId]
    );

    const orgMembersResultPromise = db.query(
      `SELECT
         om.membership_id,
         om.user_id,
         u.name,
         u.email,
         om.role_id,
         r.role_key,
         r.role_name,
         om.status,
         om.joined_at
       FROM organization_members om
       JOIN users u ON u.user_id = om.user_id
       LEFT JOIN roles r ON r.role_id = om.role_id
       WHERE om.organization_id = $1
       ORDER BY om.joined_at DESC
       LIMIT $2`,
      [orgId, listLimit]
    );

    const devicesResultPromise = db.query(
      `SELECT
         device_id,
         device_name,
         device_type,
         hostname,
         os_name,
         ip_address,
         user_agent,
         latitude,
         longitude,
         country,
         city,
         created_at,
         last_active_at,
         is_trusted,
         status
       FROM user_devices
       WHERE user_id = $1
       ORDER BY last_active_at DESC
       LIMIT $2`,
      [tokenUserId, listLimit]
    );

    const sessionsResultPromise = db.query(
      `SELECT
         session_id,
         status,
         created_at,
         last_used_at,
         expires_at,
         revoked_at,
         device_id,
         ip_address,
         user_agent
       FROM user_sessions
       WHERE user_id = $1
         AND organization_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [tokenUserId, orgId, listLimit]
    );

    const otpResultPromise = db.query(
      `SELECT
         otp_id,
         purpose,
         status,
         attempt_count,
         max_attempts,
         created_at,
         expires_at,
         verified_at
       FROM otp_verifications
       WHERE user_id = $1
         AND organization_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [tokenUserId, orgId, listLimit]
    );

    const authTimelineResultPromise = db.query(
      `SELECT
         log_id,
         action,
         action_category,
         action_subtype,
         description,
         status,
         is_successful,
         ip_address,
         occurred_at
       FROM activity_log
       WHERE actor_id = $1
         AND context_organization_id = $2
         AND action LIKE 'auth.%'
       ORDER BY occurred_at DESC
       LIMIT $3`,
      [tokenUserId, orgId, listLimit]
    );

    const allowedUsersResultPromise = db.query(
      `SELECT
         ga.global_access_id,
         ga.allow_user_id,
         u.name AS allow_user_name,
         u.email AS allow_user_email,
         ga.status,
         ga.created_at,
         ga.updated_at
       FROM global_access ga
       JOIN users u ON u.user_id = ga.allow_user_id
       WHERE ga.org_id = $1
         AND ga.user_id = $2
       ORDER BY ga.created_at DESC
       LIMIT $3`,
      [orgId, tokenUserId, listLimit]
    );

    // User usage stats: message counts + file sizes
    const usageStatsPromise = orgId ? db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM messages
          WHERE organization_id = $1 AND sender_id = $2
            AND message_type NOT IN ('file','image','video','audio')) AS msg_count,
         (SELECT COALESCE(SUM(LENGTH(message)), 0) FROM messages
          WHERE organization_id = $1 AND sender_id = $2
            AND message_type NOT IN ('file','image','video','audio')) AS msg_bytes,
         (SELECT COUNT(*)::int FROM messages
          WHERE organization_id = $1 AND sender_id = $2
            AND message_type IN ('image','video')) AS media_count,
         (SELECT COALESCE(SUM(mf.file_size), 0) FROM message_files mf
          JOIN messages m ON m.message_id = mf.message_id
          WHERE m.organization_id = $1 AND m.sender_id = $2
            AND m.message_type IN ('image','video')) AS media_bytes,
         (SELECT COUNT(*)::int FROM messages
          WHERE organization_id = $1 AND sender_id = $2
            AND message_type IN ('file','audio')) AS file_count,
         (SELECT COALESCE(SUM(mf.file_size), 0) FROM message_files mf
          JOIN messages m ON m.message_id = mf.message_id
          WHERE m.organization_id = $1 AND m.sender_id = $2
            AND m.message_type IN ('file','audio')) AS file_bytes`,
      [orgId, tokenUserId]
    ) : Promise.resolve({ rows: [{}] });

    const [
      userResult,
      organizationResult,
      membershipResult,
      subscriptionResult,
      countsResult,
      orgMembersResult,
      devicesResult,
      sessionsResult,
      otpResult,
      authTimelineResult,
      allowedUsersResult,
      usageStatsResult,
    ] = await Promise.all([
      userResultPromise,
      organizationResultPromise,
      membershipResultPromise,
      subscriptionResultPromise,
      countsResultPromise,
      orgMembersResultPromise,
      devicesResultPromise,
      sessionsResultPromise,
      otpResultPromise,
      authTimelineResultPromise,
      allowedUsersResultPromise,
      usageStatsPromise,
    ]);

    if (!userResult.rows.length) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }

    if (!organizationResult.rows.length) {
      const err = new Error('Organization not found');
      err.status = 404;
      throw err;
    }

    if (!membershipResult.rows.length) {
      const err = new Error('Membership not found in organization');
      err.status = 403;
      throw err;
    }

    const user = userResult.rows[0];
    await signProfileFields(user);
    const organization = organizationResult.rows[0];
    const membership = membershipResult.rows[0];
    const currentPlan = subscriptionResult.rows[0]
      ? {
          subscription_id: subscriptionResult.rows[0].subscription_id,
          plan_id: subscriptionResult.rows[0].plan_id,
          plan_key: subscriptionResult.rows[0].plan_key || null,
          plan_name: subscriptionResult.rows[0].plan_name || null,
          subscription_status: subscriptionResult.rows[0].status,
          start_date: subscriptionResult.rows[0].start_date,
          end_date: subscriptionResult.rows[0].end_date,
          interval_days: subscriptionResult.rows[0].interval_days ?? null,
          price: subscriptionResult.rows[0].price ?? null,
          default_currency: subscriptionResult.rows[0].default_currency ?? 'INR',
          max_users: subscriptionResult.rows[0].max_users,
          max_storage_mb: subscriptionResult.rows[0].max_storage_mb,
        }
      : null;
    const storageUsedMb = Number(organization.storage_used_mb || 0);
    const storageLimitMb = Number(currentPlan?.max_storage_mb || 0);
    const storageUsagePercent =
      storageLimitMb > 0 ? Number(((storageUsedMb / storageLimitMb) * 100).toFixed(2)) : null;
    const counts = countsResult.rows[0] || {};

    return success(
      res,
      {
        user,
        organization: {
          organization_id: organization.organization_id,
          org_key: organization.org_key,
          name: organization.name,
          subdomain: organization.subdomain,
          custom_domain: organization.custom_domain,
          status: organization.status,
          language: {
            language_id: organization.language_id,
            language_code: organization.language_code || null,
            language_name: organization.language_name || null,
          },
          timezone: {
            timezone_id: organization.timezone_id,
            timezone_code: organization.timezone_code || null,
            timezone_name: organization.timezone_name || null,
          },
          created_at: organization.created_at,
          updated_at: organization.updated_at,
        },
        owner: {
          owner_id: organization.owner_id,
          owner_name: organization.owner_name || null,
          owner_email: organization.owner_email || null,
        },
        organization_member: membership,
        user_role: {
          role_id: membership.role_id,
          role_key: membership.role_key || null,
          role_name: membership.role_name || null,
          membership_status: membership.membership_status,
        },
        current_plan: currentPlan,
        usage: {
          storage_used_mb: storageUsedMb,
          storage_limit_mb: storageLimitMb || null,
          storage_usage_percent: storageUsagePercent,
        },
        counts: {
          total_members: Number(counts.total_members || 0),
          active_members: Number(counts.active_members || 0),
          user_devices: Number(counts.user_devices || 0),
          user_sessions: Number(counts.user_sessions || 0),
          otp_verifications: Number(counts.otp_verifications || 0),
          global_access_allowed_users: Number(counts.global_access_allowed_users || 0),
          global_access_received: Number(counts.global_access_received || 0),
        },
        organization_members: orgMembersResult.rows,
        user_devices: devicesResult.rows,
        user_sessions: sessionsResult.rows,
        otp_verifications: otpResult.rows,
        auth_timeline: authTimelineResult.rows,
        global_access_allowed_users: allowedUsersResult.rows,
        usage: (() => {
          const u = usageStatsResult.rows[0] || {};
          const MB = 1024 * 1024;
          const msgs = { count: Number(u.msg_count || 0), sizeMB: Number((Number(u.msg_bytes || 0) / MB).toFixed(2)) };
          const media = { count: Number(u.media_count || 0), sizeMB: Number((Number(u.media_bytes || 0) / MB).toFixed(2)) };
          const files = { count: Number(u.file_count || 0), sizeMB: Number((Number(u.file_bytes || 0) / MB).toFixed(2)) };
          return { messages: msgs, media, files, totalSizeMB: Number((msgs.sizeMB + media.sizeMB + files.sizeMB).toFixed(2)) };
        })(),
        meta: {
          limit: listLimit,
        },
      },
      'Profile'
    );
  } catch (error) {
    return next(error);
  }
};

const getUserDetails = async (req, res, next) => {
  try {
    const tokenUserId = req.user?.sub;
    const orgId = req.user?.org;
    const inputEmail = normalizeEmail(req.body?.email || req.query?.email || '');
    const fullRaw = String(req.body?.full ?? req.query?.full ?? '').toLowerCase();
    const full = ['1', 'true', 'yes'].includes(fullRaw);
    const limitRaw = Number.parseInt(req.body?.limit ?? req.query?.limit, 10);
    const listLimit = Number.isNaN(limitRaw) ? 25 : Math.max(1, Math.min(limitRaw, 100));

    if (!tokenUserId) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }

    if (!orgId) {
      const err = new Error('Organization context not found in token');
      err.status = 400;
      throw err;
    }

    let userId = tokenUserId;
    if (inputEmail) {
      if (!isValidEmail(inputEmail)) {
        const err = new Error('Valid email is required');
        err.status = 400;
        throw err;
      }

      const targetUserResult = await db.query(
        `SELECT u.user_id
         FROM users u
         JOIN organization_members om
           ON om.user_id = u.user_id
          AND om.organization_id = $1
         WHERE LOWER(u.email) = LOWER($2)
         LIMIT 1`,
        [orgId, inputEmail]
      );

      if (!targetUserResult.rows.length) {
        const err = new Error('User not found in this organization');
        err.status = 404;
        throw err;
      }

      userId = targetUserResult.rows[0].user_id;
    }

    const userPromise = db.query(
      `SELECT
         user_id, email, name, mobile, status, email_verified_at, last_login_at
       FROM users
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    const organizationPromise = db.query(
      `SELECT
         organization_id, org_key, name, subdomain, custom_domain,
         storage_used_mb, status
       FROM organizations
       WHERE organization_id = $1
       LIMIT 1`,
      [orgId]
    );

    const membershipPromise = db.query(
      `SELECT
         om.membership_id, om.organization_id, om.user_id, om.role_id, om.status, om.joined_at,
         r.role_key, r.role_name
       FROM organization_members om
       LEFT JOIN roles r ON r.role_id = om.role_id
       WHERE om.organization_id = $1
         AND om.user_id = $2
       LIMIT 1`,
      [orgId, userId]
    );

    const subscriptionPromise = db.query(
      `SELECT
         s.subscription_id, s.organization_id, s.plan_id, s.status, s.start_date, s.end_date,
         s.max_users, s.max_storage_mb,
         p.plan_key, p.plan_name, p.interval_days, p.price, p.default_currency
       FROM subscriptions s
       LEFT JOIN plans p ON p.plan_id = s.plan_id
       WHERE s.organization_id = $1
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [orgId]
    );

    const membersPromise = full
      ? db.query(
        `SELECT
             om.membership_id, om.organization_id, om.user_id, om.role_id, om.status, om.joined_at,
             u.name, u.email, r.role_key, r.role_name
           FROM organization_members om
           JOIN users u ON u.user_id = om.user_id
           LEFT JOIN roles r ON r.role_id = om.role_id
           WHERE om.organization_id = $1
           ORDER BY om.joined_at DESC
           LIMIT $2`,
        [orgId, listLimit]
      )
      : db.query(
        `SELECT COUNT(*)::int AS total
           FROM organization_members
           WHERE organization_id = $1`,
        [orgId]
      );

    const devicesPromise = full
      ? db.query(
        `SELECT
         device_id, device_name, device_type, ip_address, user_agent,
         hostname, os_name,
         latitude, longitude, country, city,
         last_active_at, is_trusted, status
       FROM user_devices
       WHERE user_id = $1
       ORDER BY last_active_at DESC
       LIMIT $2`,
        [userId, listLimit]
      )
      : db.query(
        `SELECT COUNT(*)::int AS total
           FROM user_devices
           WHERE user_id = $1`,
        [userId]
      );

    const sessionsPromise = full
      ? db.query(
        `SELECT
         session_id, status, created_at, last_used_at,
         expires_at, revoked_at, device_id, ip_address
       FROM user_sessions
       WHERE user_id = $1
         AND organization_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
        [userId, orgId, listLimit]
      )
      : db.query(
        `SELECT COUNT(*)::int AS total
           FROM user_sessions
           WHERE user_id = $1
             AND organization_id = $2`,
        [userId, orgId]
      );

    const otpPromise = full
      ? db.query(
        `SELECT
         otp_id, purpose, status, attempt_count, max_attempts,
         created_at, expires_at, verified_at
       FROM otp_verifications
       WHERE user_id = $1
         AND organization_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
        [userId, orgId, listLimit]
      )
      : db.query(
        `SELECT COUNT(*)::int AS total
           FROM otp_verifications
           WHERE user_id = $1
             AND organization_id = $2`,
        [userId, orgId]
      );

    const [
      userResult,
      organizationResult,
      membershipResult,
      membersResult,
      subscriptionResult,
      devicesResult,
      sessionsResult,
      otpResult,
    ] = await Promise.all([
      userPromise,
      organizationPromise,
      membershipPromise,
      membersPromise,
      subscriptionPromise,
      devicesPromise,
      sessionsPromise,
      otpPromise,
    ]);

    if (!userResult.rows.length) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }

    if (!organizationResult.rows.length) {
      const err = new Error('Organization not found');
      err.status = 404;
      throw err;
    }

    const organizationMember = membershipResult.rows[0] || null;
    const subscription = subscriptionResult.rows[0] || null;
    const currentPlan = subscription
      ? {
        plan_id: subscription.plan_id,
        plan_key: subscription.plan_key || null,
        plan_name: subscription.plan_name || null,
        status: subscription.status,
        start_date: subscription.start_date,
        end_date: subscription.end_date,
        interval_days: subscription.interval_days ?? null,
        price: subscription.price ?? null,
        default_currency: subscription.default_currency ?? 'INR',
      }
      : null;
    const userRole = organizationMember
      ? {
        role_id: organizationMember.role_id,
        role_key: organizationMember.role_key || null,
        role_name: organizationMember.role_name || null,
        membership_status: organizationMember.status,
      }
      : null;

    if (!full) {
      return success(
        res,
        {
          user: {
            user_id: userResult.rows[0].user_id,
            email: userResult.rows[0].email,
            name: userResult.rows[0].name,
            status: userResult.rows[0].status,
          },
          organization: {
            organization_id: organizationResult.rows[0].organization_id,
            name: organizationResult.rows[0].name,
            custom_domain: organizationResult.rows[0].custom_domain,
            status: organizationResult.rows[0].status,
          },
          current_plan: currentPlan,
          user_role: userRole,
          counts: {
            organization_members: membersResult.rows[0]?.total || 0,
            user_devices: devicesResult.rows[0]?.total || 0,
            user_sessions: sessionsResult.rows[0]?.total || 0,
            otp_verifications: otpResult.rows[0]?.total || 0,
          },
        },
        'User details retrieved'
      );
    }

    return success(
      res,
      {
        user: userResult.rows[0],
        organization: organizationResult.rows[0],
        organization_member: organizationMember,
        user_role: userRole,
        organization_members: membersResult.rows,
        subscription,
        current_plan: currentPlan,
        user_devices: devicesResult.rows,
        user_sessions: sessionsResult.rows,
        otp_verifications: otpResult.rows,
        meta: {
          limit: listLimit,
        },
      },
      'User details retrieved'
    );
  } catch (error) {
    return next(error);
  }
};

const getOrganizationDetails = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const tokenUserId = Number(req.user?.sub);
    const tokenOrgId = Number(req.user?.org);
    const requestedOrgId = Number(req.query?.organization_id || req.body?.organization_id);
    const organizationId =
      Number.isFinite(requestedOrgId) && requestedOrgId > 0 ? requestedOrgId : tokenOrgId;

    if (!Number.isFinite(tokenUserId) || tokenUserId <= 0) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }

    if (!Number.isFinite(organizationId) || organizationId <= 0) {
      const err = new Error('Valid organization_id is required');
      err.status = 400;
      throw err;
    }

    const membershipAccess = await db.query(
      `SELECT membership_id
       FROM organization_members
       WHERE organization_id = $1
         AND user_id = $2
         AND status = 'active'
       LIMIT 1`,
      [organizationId, tokenUserId]
    );

    if (!membershipAccess.rows.length) {
      const err = new Error('Access denied for requested organization');
      err.status = 403;
      throw err;
    }

    const organizationPromise = db.query(
      `SELECT
         o.organization_id,
         o.org_key,
         o.name,
         o.subdomain,
         o.custom_domain,
         o.owner_id,
         owner.name AS owner_name,
         owner.email AS owner_email,
         o.language_id,
         o.timezone_id,
         o.storage_used_mb,
         o.status,
         o.created_at,
         o.updated_at
       FROM organizations o
       LEFT JOIN users owner ON owner.user_id = o.owner_id
       WHERE o.organization_id = $1
       LIMIT 1`,
      [organizationId]
    );

    const subscriptionPromise = db.query(
      `SELECT
         s.subscription_id,
         s.organization_id,
         s.plan_id,
         s.status,
         s.start_date,
         s.end_date,
         s.max_users,
         s.max_storage_mb,
         p.plan_key,
         p.plan_name,
         p.interval_days,
         p.price,
         p.default_currency
       FROM subscriptions s
       LEFT JOIN plans p ON p.plan_id = s.plan_id
       WHERE s.organization_id = $1
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [organizationId]
    );

    const memberStatsPromise = db.query(
      `SELECT
         COUNT(*)::int AS total_members,
         COUNT(*) FILTER (WHERE om.status = 'active')::int AS active_members,
         COUNT(*) FILTER (WHERE om.status = 'invited')::int AS invited_members,
         COUNT(*) FILTER (WHERE om.status = 'suspended')::int AS suspended_members,
         COUNT(*) FILTER (WHERE om.status = 'left')::int AS left_members,
         COUNT(*) FILTER (WHERE u.is_global_member = TRUE)::int AS global_members,
         COUNT(*) FILTER (WHERE u.is_platform_admin = TRUE)::int AS platform_admin_members
       FROM organization_members om
       JOIN users u ON u.user_id = om.user_id
       WHERE om.organization_id = $1`,
      [organizationId]
    );

    const roleStatsPromise = db.query(
      `SELECT
         r.role_id,
         r.role_key,
         r.role_name,
         COUNT(*)::int AS total
       FROM organization_members om
       LEFT JOIN roles r ON r.role_id = om.role_id
       WHERE om.organization_id = $1
       GROUP BY r.role_id, r.role_key, r.role_name
       ORDER BY total DESC, r.role_id ASC`,
      [organizationId]
    );

    const structureStatsPromise = db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM departments d WHERE d.organization_id = $1) AS departments,
         (SELECT COUNT(*)::int FROM designations ds WHERE ds.organization_id = $1) AS designations,
         (SELECT COUNT(*)::int FROM locations l WHERE l.organization_id = $1) AS locations`,
      [organizationId]
    );

    const activityStatsPromise = db.query(
      `SELECT COUNT(*)::int AS total_activity_logs
       FROM activity_log
       WHERE context_organization_id = $1`,
      [organizationId]
    );

    // Calculate real storage usage from message_files + group_message_files
    const storageStatsPromise = db.query(
      `SELECT
         COALESCE(SUM(dm_files.total_size), 0) + COALESCE(SUM(gm_files.total_size), 0) AS total_bytes
       FROM (
         SELECT SUM(mf.file_size) AS total_size
         FROM message_files mf
         JOIN messages m ON m.message_id = mf.message_id
         WHERE m.organization_id = $1
       ) dm_files,
       (
         SELECT SUM(gmf.file_size) AS total_size
         FROM group_message_files gmf
         JOIN group_messages gm ON gm.group_message_id = gmf.group_message_id
         WHERE gm.organization_id = $1
       ) gm_files`,
      [organizationId]
    );

    const [organizationResult, subscriptionResult, memberStatsResult, roleStatsResult, structureStatsResult, activityStatsResult, storageStatsResult] =
      await Promise.all([
        organizationPromise,
        subscriptionPromise,
        memberStatsPromise,
        roleStatsPromise,
        structureStatsPromise,
        activityStatsPromise,
        storageStatsPromise,
      ]);

    if (!organizationResult.rows.length) {
      const err = new Error('Organization not found');
      err.status = 404;
      throw err;
    }

    const organization = organizationResult.rows[0];
    const subscription = subscriptionResult.rows[0] || null;
    const memberStats = memberStatsResult.rows[0] || {};
    const structureStats = structureStatsResult.rows[0] || {};
    const totalActivityLogs = Number(activityStatsResult.rows[0]?.total_activity_logs || 0);
    // Real storage from file tables (bytes → MB)
    const totalFileBytes = Number(storageStatsResult.rows[0]?.total_bytes || 0);
    const usedStorageMb = Number((totalFileBytes / (1024 * 1024)).toFixed(2));
    const maxStorageMb = Number(subscription?.max_storage_mb || 0);
    const storageUsagePercent =
      maxStorageMb > 0 ? Number(((usedStorageMb / maxStorageMb) * 100).toFixed(2)) : null;

    await logActivitySafe({
      ...buildActorFromRequest(req, { context_organization_id: organizationId }),
      ...requestMeta,
      context_organization_id: organizationId,
      target_type: 'organization',
      target_id: organizationId,
      action: 'organization.details.view',
      action_category: 'organization_management',
      action_subtype: 'organization_summary_read',
      description: `Organization details viewed for organization ${organizationId}`,
      new_values: {
        organization_id: organizationId,
      },
      is_successful: true,
      status: 'success',
    });

    return success(
      res,
      {
        organization: {
          organization_id: organization.organization_id,
          org_key: organization.org_key,
          name: organization.name,
          subdomain: organization.subdomain,
          custom_domain: organization.custom_domain,
          status: organization.status,
          created_at: organization.created_at,
          updated_at: organization.updated_at,
        },
        owner: {
          owner_id: organization.owner_id,
          owner_name: organization.owner_name || null,
          owner_email: organization.owner_email || null,
        },
        current_plan: subscription
          ? {
              subscription_id: subscription.subscription_id,
              plan_id: subscription.plan_id,
              plan_key: subscription.plan_key || null,
              plan_name: subscription.plan_name || null,
              subscription_status: subscription.status,
              start_date: subscription.start_date,
              end_date: subscription.end_date,
              interval_days: subscription.interval_days ?? null,
              price: subscription.price ?? null,
              default_currency: subscription.default_currency ?? 'INR',
              max_users: subscription.max_users,
              max_storage_mb: subscription.max_storage_mb,
            }
          : null,
        usage: {
          storage_used_mb: usedStorageMb,
          storage_limit_mb: maxStorageMb || null,
          storage_usage_percent: storageUsagePercent,
        },
        counts: {
          total_members: Number(memberStats.total_members || 0),
          active_members: Number(memberStats.active_members || 0),
          invited_members: Number(memberStats.invited_members || 0),
          suspended_members: Number(memberStats.suspended_members || 0),
          left_members: Number(memberStats.left_members || 0),
          global_members: Number(memberStats.global_members || 0),
          platform_admin_members: Number(memberStats.platform_admin_members || 0),
          departments: Number(structureStats.departments || 0),
          designations: Number(structureStats.designations || 0),
          locations: Number(structureStats.locations || 0),
          total_activity_logs: totalActivityLogs,
        },
        role_distribution: roleStatsResult.rows.map((row) => ({
          role_id: row.role_id,
          role_key: row.role_key,
          role_name: row.role_name,
          total: Number(row.total || 0),
        })),
      },
      'Organization details retrieved'
    );
  } catch (error) {
    return next(error);
  }
};

const getOwnerDashboard = async (req, res, next) => {
  try {
    const limit = Math.min(toPositiveInt(req.query?.limit, 20), 100);
    const offset = Math.max(toPositiveInt(req.query?.offset, 0), 0);
    const search = String(req.query?.search || "").trim();

    const values = [];
    const where = [];
    let idx = 1;

    if (search) {
      where.push(`(
        o.name ILIKE $${idx}
        OR COALESCE(o.org_key, '') ILIKE $${idx}
        OR COALESCE(o.subdomain, '') ILIKE $${idx}
        OR COALESCE(o.custom_domain, '') ILIKE $${idx}
        OR COALESCE(owner.name, '') ILIKE $${idx}
        OR COALESCE(owner.email, '') ILIKE $${idx}
      )`);
      values.push(`%${search}%`);
      idx += 1;
    }

    values.push(limit, offset);
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { rows } = await db.query(
      `SELECT
         o.organization_id,
         o.org_key,
         o.name,
         o.subdomain,
         o.custom_domain,
         o.status,
         o.created_at,
         o.updated_at,
         owner.user_id AS owner_id,
         owner.name AS owner_name,
         owner.email AS owner_email,
         COALESCE(plan_info.plan_name, '') AS plan_name,
         COALESCE(plan_info.plan_key, '') AS plan_key,
         COALESCE(member_stats.total_members, 0)::int AS total_members,
         COALESCE(member_stats.active_members, 0)::int AS active_members,
         COALESCE(member_stats.invited_members, 0)::int AS invited_members,
         COALESCE(member_stats.suspended_members, 0)::int AS suspended_members,
         COUNT(*) OVER()::int AS total_count
       FROM organizations o
       LEFT JOIN users owner ON owner.user_id = o.owner_id
       LEFT JOIN LATERAL (
         SELECT
           p.plan_name,
           p.plan_key
         FROM subscriptions s
         LEFT JOIN plans p ON p.plan_id = s.plan_id
         WHERE s.organization_id = o.organization_id
         ORDER BY s.created_at DESC
         LIMIT 1
       ) AS plan_info ON TRUE
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*)::int AS total_members,
           COUNT(*) FILTER (WHERE om.status = 'active')::int AS active_members,
           COUNT(*) FILTER (WHERE om.status = 'invited')::int AS invited_members,
           COUNT(*) FILTER (WHERE om.status = 'suspended')::int AS suspended_members
         FROM organization_members om
         WHERE om.organization_id = o.organization_id
       ) AS member_stats ON TRUE
       ${whereClause}
       ORDER BY o.created_at DESC, o.organization_id DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      values
    );

    const total = rows.length ? Number(rows[0].total_count || 0) : 0;
    const cleanedRows = rows.map(({ total_count, ...rest }) => rest);

    return success(
      res,
      {
        count: total,
        rows: cleanedRows,
        meta: {
          limit,
          offset,
          search,
        },
      },
      "Owner dashboard data retrieved"
    );
  } catch (error) {
    return next(error);
  }
};

const getOwnerV1Organizations = async (req, res, next) => {
  try {
    const limit = Math.min(toPositiveInt(req.query?.limit, 20), 100);
    const offset = Math.max(toPositiveInt(req.query?.offset, 0), 0);
    const search = String(req.query?.search || "").trim();

    const values = [];
    const where = [];
    let idx = 1;

    if (search) {
      where.push(`(
        o.name ILIKE $${idx}
        OR COALESCE(o.org_key, '') ILIKE $${idx}
        OR COALESCE(o.subdomain, '') ILIKE $${idx}
        OR COALESCE(o.custom_domain, '') ILIKE $${idx}
        OR COALESCE(owner.name, '') ILIKE $${idx}
        OR COALESCE(owner.email, '') ILIKE $${idx}
      )`);
      values.push(`%${search}%`);
      idx += 1;
    }

    values.push(limit, offset);
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { rows } = await db.query(
      `SELECT
         o.organization_id,
         o.org_key,
         o.name,
         o.subdomain,
         o.custom_domain,
         o.status,
         o.created_at,
         o.updated_at,
         owner.user_id AS owner_id,
         owner.name AS owner_name,
         owner.email AS owner_email,
         COALESCE(plan_info.plan_name, '') AS plan_name,
         COALESCE(plan_info.plan_key, '') AS plan_key,
         COALESCE(member_stats.total_members, 0)::int AS total_members,
         COALESCE(member_stats.active_members, 0)::int AS active_members,
         COALESCE(member_stats.invited_members, 0)::int AS invited_members,
         COALESCE(member_stats.suspended_members, 0)::int AS suspended_members,
         COUNT(*) OVER()::int AS total_count
       FROM organizations o
       LEFT JOIN users owner ON owner.user_id = o.owner_id
       LEFT JOIN LATERAL (
         SELECT
           p.plan_name,
           p.plan_key
         FROM subscriptions s
         LEFT JOIN plans p ON p.plan_id = s.plan_id
         WHERE s.organization_id = o.organization_id
         ORDER BY s.created_at DESC
         LIMIT 1
       ) AS plan_info ON TRUE
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*)::int AS total_members,
           COUNT(*) FILTER (WHERE om.status = 'active')::int AS active_members,
           COUNT(*) FILTER (WHERE om.status = 'invited')::int AS invited_members,
           COUNT(*) FILTER (WHERE om.status = 'suspended')::int AS suspended_members
         FROM organization_members om
         WHERE om.organization_id = o.organization_id
       ) AS member_stats ON TRUE
       ${whereClause}
       ORDER BY o.created_at DESC, o.organization_id DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      values
    );

    const total = rows.length ? Number(rows[0].total_count || 0) : 0;
    const cleanedRows = rows.map(({ total_count, ...rest }) => rest);

    return success(
      res,
      {
        count: total,
        rows: cleanedRows,
        meta: {
          limit,
          offset,
          search,
        },
      },
      "Owner organizations retrieved"
    );
  } catch (error) {
    return next(error);
  }
};

const getOwnerV1OrganizationOverview = async (req, res, next) => {
  try {
    const organizationId = Number.parseInt(req.params?.organizationId, 10);
    if (!Number.isFinite(organizationId) || organizationId <= 0) {
      const err = new Error("Valid organizationId is required");
      err.status = 400;
      throw err;
    }

    const membersLimit = Math.min(toPositiveInt(req.query?.members_limit, 200), 2000);
    const membersOffset = Math.max(toPositiveInt(req.query?.members_offset, 0), 0);
    const membersSearch = String(req.query?.members_search || "").trim();

    const paymentsLimit = Math.min(toPositiveInt(req.query?.payments_limit, 20), 100);
    const paymentsOffset = Math.max(toPositiveInt(req.query?.payments_offset, 0), 0);
    const paymentsSearch = String(req.query?.payments_search || "").trim();
    const paymentsStatus = String(req.query?.payments_status || "").trim().toLowerCase();

    const orgResult = await db.query(
      `SELECT
         o.organization_id,
         o.org_key,
         o.name,
         o.subdomain,
         o.custom_domain,
         o.status,
         o.created_at,
         o.updated_at,
         o.owner_id,
         u.name AS owner_name,
         u.email AS owner_email
       FROM organizations o
       LEFT JOIN users u ON u.user_id = o.owner_id
       WHERE o.organization_id = $1
       LIMIT 1`,
      [organizationId]
    );
    if (!orgResult.rows.length) {
      const err = new Error("Organization not found");
      err.status = 404;
      throw err;
    }

    const membersWhere = ["om.organization_id = $1"];
    const membersValues = [organizationId];
    let membersIdx = 2;
    if (membersSearch) {
      membersWhere.push(`(
        COALESCE(u.name, '') ILIKE $${membersIdx}
        OR COALESCE(u.email, '') ILIKE $${membersIdx}
        OR COALESCE(u.mobile, '') ILIKE $${membersIdx}
        OR COALESCE(r.role_name, '') ILIKE $${membersIdx}
        OR COALESCE(r.role_key, '') ILIKE $${membersIdx}
      )`);
      membersValues.push(`%${membersSearch}%`);
      membersIdx += 1;
    }

    const membersCountResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM organization_members om
       LEFT JOIN users u ON u.user_id = om.user_id
       LEFT JOIN roles r ON r.role_id = om.role_id
       WHERE ${membersWhere.join(" AND ")}`,
      membersValues
    );

    const membersResult = await db.query(
      `SELECT
         om.membership_id,
         om.organization_id,
         om.user_id,
         om.role_id,
         om.status AS membership_status,
         om.joined_at,
         u.name,
         u.email,
         u.mobile,
         u.status AS user_status,
         r.role_key,
         r.role_name
       FROM organization_members om
       LEFT JOIN users u ON u.user_id = om.user_id
       LEFT JOIN roles r ON r.role_id = om.role_id
       WHERE ${membersWhere.join(" AND ")}
       ORDER BY om.joined_at DESC, om.membership_id DESC
       LIMIT $${membersIdx} OFFSET $${membersIdx + 1}`,
      [...membersValues, membersLimit, membersOffset]
    );

    const subscriptionResult = await db.query(
      `SELECT
         s.subscription_id,
         s.organization_id,
         s.plan_id,
         s.status,
         s.start_date,
         s.end_date,
         s.max_users,
         s.max_storage_mb,
         s.created_at,
         s.updated_at,
         p.plan_name,
         p.plan_key,
         p.price,
         p.default_currency,
         p.interval_days
       FROM subscriptions s
       LEFT JOIN plans p ON p.plan_id = s.plan_id
       WHERE s.organization_id = $1
       ORDER BY s.created_at DESC, s.subscription_id DESC
       LIMIT 1`,
      [organizationId]
    );

    const paymentsWhere = ["ph.organization_id = $1"];
    const paymentsValues = [organizationId];
    let paymentsIdx = 2;
    if (paymentsStatus) {
      paymentsWhere.push(`LOWER(COALESCE(ph.payment_status, '')) = $${paymentsIdx}`);
      paymentsValues.push(paymentsStatus);
      paymentsIdx += 1;
    }
    if (paymentsSearch) {
      paymentsWhere.push(`(
        COALESCE(ph.invoice_number, '') ILIKE $${paymentsIdx}
        OR COALESCE(ph.transaction_id, '') ILIKE $${paymentsIdx}
        OR COALESCE(ph.billing_email, '') ILIKE $${paymentsIdx}
        OR COALESCE(p.plan_name, '') ILIKE $${paymentsIdx}
      )`);
      paymentsValues.push(`%${paymentsSearch}%`);
      paymentsIdx += 1;
    }

    const paymentsCountResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM payment_history ph
       LEFT JOIN plans p ON p.plan_id = ph.plan_id
       WHERE ${paymentsWhere.join(" AND ")}`,
      paymentsValues
    );

    const paymentsResult = await db.query(
      `SELECT
         ph.payment_id,
         ph.organization_id,
         ph.subscription_id,
         ph.plan_id,
         ph.amount,
         ph.payment_date,
         ph.payment_status,
         ph.invoice_number,
         ph.transaction_id,
         ph.payment_method,
         ph.currency_code,
         ph.period_months,
         ph.user_count,
         ph.billing_type,
         ph.coupon_code,
         ph.discount_amount,
         ph.billing_name,
         ph.billing_email,
         ph.country,
         ph.state,
         ph.city,
         ph.postal_code,
         p.plan_name,
         p.plan_key
       FROM payment_history ph
       LEFT JOIN plans p ON p.plan_id = ph.plan_id
       WHERE ${paymentsWhere.join(" AND ")}
       ORDER BY ph.payment_date DESC, ph.payment_id DESC
       LIMIT $${paymentsIdx} OFFSET $${paymentsIdx + 1}`,
      [...paymentsValues, paymentsLimit, paymentsOffset]
    );

    return success(
      res,
      {
        organization: orgResult.rows[0],
        members: {
          count: Number(membersCountResult.rows[0]?.total || 0),
          rows: membersResult.rows,
          meta: {
            limit: membersLimit,
            offset: membersOffset,
            search: membersSearch,
          },
        },
        subscription: subscriptionResult.rows[0] || null,
        payments: {
          count: Number(paymentsCountResult.rows[0]?.total || 0),
          rows: paymentsResult.rows,
          meta: {
            limit: paymentsLimit,
            offset: paymentsOffset,
            search: paymentsSearch,
            status: paymentsStatus || null,
          },
        },
      },
      "Owner organization overview retrieved"
    );
  } catch (error) {
    return next(error);
  }
};

const getOwnerV1Users = async (req, res, next) => {
  try {
    const limit = Math.min(toPositiveInt(req.query?.limit, 20), 200);
    const offset = Math.max(toPositiveInt(req.query?.offset, 0), 0);
    const search = String(req.query?.search || "").trim();
    const organizationId = Number.parseInt(req.query?.organization_id, 10);

    const values = [];
    const where = [];
    let idx = 1;

    if (Number.isFinite(organizationId) && organizationId > 0) {
      where.push(`om.organization_id = $${idx}`);
      values.push(organizationId);
      idx += 1;
    }

    if (search) {
      where.push(`(
        COALESCE(u.name, '') ILIKE $${idx}
        OR COALESCE(u.email, '') ILIKE $${idx}
        OR COALESCE(u.mobile, '') ILIKE $${idx}
        OR COALESCE(o.name, '') ILIKE $${idx}
        OR COALESCE(r.role_name, '') ILIKE $${idx}
      )`);
      values.push(`%${search}%`);
      idx += 1;
    }

    values.push(limit, offset);
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { rows } = await db.query(
      `SELECT
         om.membership_id,
         om.organization_id,
         o.name AS organization_name,
         om.user_id,
         u.name,
         u.email,
         u.mobile,
         u.status AS user_status,
         om.role_id,
         r.role_name,
         r.role_key,
         om.status AS membership_status,
         om.joined_at,
         COUNT(*) OVER()::int AS total_count
       FROM organization_members om
       JOIN users u ON u.user_id = om.user_id
       LEFT JOIN organizations o ON o.organization_id = om.organization_id
       LEFT JOIN roles r ON r.role_id = om.role_id
       ${whereClause}
       ORDER BY om.joined_at DESC, om.membership_id DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      values
    );

    const total = rows.length ? Number(rows[0].total_count || 0) : 0;
    const cleanedRows = rows.map(({ total_count, ...rest }) => rest);

    return success(
      res,
      {
        count: total,
        rows: cleanedRows,
        meta: {
          limit,
          offset,
          search,
          organization_id: Number.isFinite(organizationId) && organizationId > 0 ? organizationId : null,
        },
      },
      "Owner users retrieved"
    );
  } catch (error) {
    return next(error);
  }
};

const getOwnerV1UserInsights = async (req, res, next) => {
  try {
    const userId = Number.parseInt(req.params?.userId, 10);
    const organizationId = Number.parseInt(req.query?.organization_id, 10);
    const limit = Math.min(toPositiveInt(req.query?.limit, 100), 500);

    if (!Number.isFinite(userId) || userId <= 0) {
      const err = new Error("Valid userId is required");
      err.status = 400;
      throw err;
    }
    if (!Number.isFinite(organizationId) || organizationId <= 0) {
      const err = new Error("Valid organization_id is required");
      err.status = 400;
      throw err;
    }

    const membershipResult = await db.query(
      `SELECT
         om.membership_id,
         om.organization_id,
         om.user_id,
         om.role_id,
         om.status AS membership_status,
         om.joined_at,
         r.role_key,
         r.role_name
       FROM organization_members om
       LEFT JOIN roles r ON r.role_id = om.role_id
       WHERE om.organization_id = $1
         AND om.user_id = $2
       LIMIT 1`,
      [organizationId, userId]
    );
    if (!membershipResult.rows.length) {
      const err = new Error("User is not a member of this organization");
      err.status = 404;
      throw err;
    }

    const [userResult, organizationResult, devicesResult, sessionsResult] = await Promise.all([
      db.query(
        `SELECT user_id, name, email, mobile, status, email_verified_at, last_login_at
         FROM users
         WHERE user_id = $1
         LIMIT 1`,
        [userId]
      ),
      db.query(
        `SELECT organization_id, name, org_key, subdomain, custom_domain, status
         FROM organizations
         WHERE organization_id = $1
         LIMIT 1`,
        [organizationId]
      ),
      db.query(
        `SELECT
           device_id, device_name, device_type, ip_address, user_agent,
           hostname, os_name, country, city, last_active_at, is_trusted, status
         FROM user_devices
         WHERE user_id = $1
         ORDER BY last_active_at DESC
         LIMIT $2`,
        [userId, limit]
      ),
      db.query(
        `SELECT
           session_id, status, created_at, last_used_at, expires_at,
           revoked_at, device_id, ip_address
         FROM user_sessions
         WHERE user_id = $1
           AND organization_id = $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [userId, organizationId, limit]
      ),
    ]);

    if (!userResult.rows.length) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }
    if (!organizationResult.rows.length) {
      const err = new Error("Organization not found");
      err.status = 404;
      throw err;
    }

    return success(
      res,
      {
        user: userResult.rows[0],
        organization: organizationResult.rows[0],
        organization_member: membershipResult.rows[0],
        user_devices: devicesResult.rows,
        user_sessions: sessionsResult.rows,
        counts: {
          user_devices: Number(devicesResult.rows.length || 0),
          user_sessions: Number(sessionsResult.rows.length || 0),
        },
        meta: { limit },
      },
      "Owner user insights retrieved"
    );
  } catch (error) {
    return next(error);
  }
};

const updateOwnerV1OrganizationMember = async (req, res, next) => {
  try {
    const organizationId = Number.parseInt(req.params?.organizationId, 10);
    const userId = Number.parseInt(req.params?.userId, 10);
    if (!Number.isFinite(organizationId) || organizationId <= 0) {
      const err = new Error("Valid organizationId is required");
      err.status = 400;
      throw err;
    }
    if (!Number.isFinite(userId) || userId <= 0) {
      const err = new Error("Valid userId is required");
      err.status = 400;
      throw err;
    }

    const roleIdRaw = req.body?.role_id;
    const membershipStatusRaw = req.body?.membership_status;

    const updates = [];
    const values = [organizationId, userId];
    let idx = 3;

    if (roleIdRaw !== undefined) {
      const roleId = Number(roleIdRaw);
      if (!Number.isFinite(roleId) || roleId <= 0) {
        const err = new Error("role_id must be a positive number");
        err.status = 400;
        throw err;
      }
      const roleExists = await db.query("SELECT role_id FROM roles WHERE role_id = $1 LIMIT 1", [roleId]);
      if (!roleExists.rows.length) {
        const err = new Error("Invalid role_id");
        err.status = 400;
        throw err;
      }
      updates.push(`role_id = $${idx}`);
      values.push(roleId);
      idx += 1;
    }

    if (membershipStatusRaw !== undefined) {
      const normalized = String(membershipStatusRaw || "").trim().toLowerCase();
      if (!["active", "invited", "suspended", "left"].includes(normalized)) {
        const err = new Error("membership_status must be active, invited, suspended, or left");
        err.status = 400;
        throw err;
      }
      updates.push(`status = $${idx}`);
      values.push(normalized);
      idx += 1;
    }

    if (!updates.length) {
      const err = new Error("At least one field is required for update");
      err.status = 400;
      throw err;
    }

    const orgExists = await db.query(
      "SELECT organization_id FROM organizations WHERE organization_id = $1 LIMIT 1",
      [organizationId]
    );
    if (!orgExists.rows.length) {
      const err = new Error("Organization not found");
      err.status = 404;
      throw err;
    }

    const result = await db.query(
      `UPDATE organization_members om
       SET ${updates.join(", ")}, updated_at = NOW()
       WHERE om.organization_id = $1 AND om.user_id = $2
       RETURNING
         om.membership_id,
         om.organization_id,
         om.user_id,
         om.role_id,
         om.status AS membership_status,
         om.joined_at,
         om.updated_at`,
      values
    );

    if (!result.rows.length) {
      const err = new Error("Member not found in organization");
      err.status = 404;
      throw err;
    }

    const row = result.rows[0];
    const detail = await db.query(
      `SELECT
         om.membership_id,
         om.organization_id,
         om.user_id,
         om.role_id,
         om.status AS membership_status,
         om.joined_at,
         om.updated_at,
         u.name,
         u.email,
         u.mobile,
         r.role_key,
         r.role_name
       FROM organization_members om
       LEFT JOIN users u ON u.user_id = om.user_id
       LEFT JOIN roles r ON r.role_id = om.role_id
       WHERE om.membership_id = $1
       LIMIT 1`,
      [row.membership_id]
    );

    return success(res, detail.rows[0] || row, "Owner member updated");
  } catch (error) {
    return next(error);
  }
};

const completeOwnerV1OrganizationPayment = async (req, res, next) => {
  try {
    const organizationId = Number.parseInt(req.params?.organizationId, 10);
    const paymentId = Number.parseInt(req.params?.paymentId, 10);
    if (!Number.isFinite(organizationId) || organizationId <= 0) {
      const err = new Error('Valid organizationId is required');
      err.status = 400;
      throw err;
    }
    if (!Number.isFinite(paymentId) || paymentId <= 0) {
      const err = new Error('Valid paymentId is required');
      err.status = 400;
      throw err;
    }

    const requestedGateway = normalizeGatewayKey(req.body?.gateway || req.body?.payment_method);
    const requestedTransactionId = String(req.body?.transaction_id || '').trim();
    const requestedPlanId = Number.parseInt(req.body?.plan_id, 10);
    const requestedUserCount = Number.parseInt(req.body?.user_count, 10);
    const requestedBillingType = String(req.body?.billing_type || '').trim().toLowerCase();
    const requestedPeriodMonths = Number.parseInt(req.body?.period_months, 10);
    const requestedNote = String(req.body?.note || '').trim();

    const orgResult = await db.query(
      `SELECT organization_id, name
       FROM organizations
       WHERE organization_id = $1
       LIMIT 1`,
      [organizationId]
    );
    if (!orgResult.rows.length) {
      const err = new Error('Organization not found');
      err.status = 404;
      throw err;
    }

    const actor = buildActorFromRequest(req);
    const requestMeta = buildRequestMeta(req);

    const completed = await db.withTransaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock($1, $2)', [organizationId, paymentId]);

      const paymentResult = await tx.query(
        `SELECT
           ph.payment_id,
           ph.organization_id,
           ph.subscription_id,
           ph.plan_id,
           ph.amount,
           ph.payment_status,
           ph.invoice_number,
           ph.transaction_id,
           ph.payment_method,
           ph.currency_code,
           ph.period_months,
           ph.user_count,
           ph.billing_type,
           ph.discount_amount,
           ph.billing_name,
           ph.billing_email,
           ph.company_name,
           ph.address_line1,
           ph.country,
           ph.state,
           ph.city,
           ph.postal_code,
           ph.coupon_code,
           ph.payment_date,
           p.plan_name,
           p.default_currency,
           p.interval_days,
           p.max_users,
           p.max_storage_mb
         FROM payment_history ph
         LEFT JOIN plans p ON p.plan_id = ph.plan_id
         WHERE ph.organization_id = $1
           AND ph.payment_id = $2
         FOR UPDATE OF ph`,
        [organizationId, paymentId]
      );
      if (!paymentResult.rows.length) {
        const err = new Error('Payment record not found for organization');
        err.status = 404;
        throw err;
      }

      const paymentRow = paymentResult.rows[0];
      const paymentStatus = String(paymentRow.payment_status || '').trim().toLowerCase();
      if (['success', 'paid', 'completed'].includes(paymentStatus)) {
        const latestSubscription = await billingModel.findLatestSubscriptionByOrganization(organizationId, tx);
        return {
          alreadyCompleted: true,
          payment: paymentRow,
          subscription: latestSubscription || null,
          planName: paymentRow.plan_name || null,
          billingType: String(paymentRow.billing_type || '').trim().toLowerCase() || 'renewal',
        };
      }
      if (paymentStatus === 'refunded') {
        const err = new Error('Refunded payment cannot be completed again');
        err.status = 400;
        throw err;
      }

      let plan = null;
      if (Number.isFinite(requestedPlanId) && requestedPlanId > 0) {
        plan = await billingModel.findPlanById(requestedPlanId, tx);
        if (!plan) {
          const err = new Error('Selected plan not found');
          err.status = 400;
          throw err;
        }
      }
      if (!plan) {
        const fallbackPlanId = Number(paymentRow.plan_id || 0);
        if (fallbackPlanId > 0) {
          plan = await billingModel.findPlanById(fallbackPlanId, tx);
        }
      }
      if (!plan) {
        const latestSubscription = await billingModel.findLatestSubscriptionByOrganization(organizationId, tx);
        if (latestSubscription?.plan_id) {
          plan = await billingModel.findPlanById(Number(latestSubscription.plan_id), tx);
        }
      }
      if (!plan) {
        const err = new Error('Plan context missing for this payment');
        err.status = 400;
        throw err;
      }

      const billingType = ['renewal', 'upgrade', 'new'].includes(requestedBillingType)
        ? requestedBillingType
        : String(paymentRow.billing_type || '').trim().toLowerCase() || 'renewal';
      const periodMonths = Number.isFinite(requestedPeriodMonths) && requestedPeriodMonths > 0
        ? requestedPeriodMonths
        : Math.max(Number(paymentRow.period_months || 1), 1);
      const currencyCode = String(paymentRow.currency_code || plan.default_currency || 'INR').trim().toUpperCase();
      const baseGateway = requestedGateway || normalizeGatewayKey(paymentRow.payment_method) || 'owner-manual';
      const paymentMethod = `${baseGateway}:${currencyCode}:${billingType}`;
      const transactionId = requestedTransactionId || `owner-manual-${organizationId}-${paymentId}-${Date.now()}`;

      const amount = Number.isFinite(Number(req.body?.amount))
        ? Number(req.body.amount)
        : Number.isFinite(Number(req.body?.price))
          ? Number(req.body.price)
        : Number(paymentRow.amount || plan.price || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        const err = new Error('Valid payment amount is required');
        err.status = 400;
        throw err;
      }
      const userCount = Number.isFinite(requestedUserCount) && requestedUserCount > 0
        ? Math.floor(requestedUserCount)
        : Math.max(Number(paymentRow.user_count || 0), 1);

      const latestSubscription = await billingModel.findLatestSubscriptionByOrganization(organizationId, tx);
      let startDateObj = new Date();
      if (
        billingType === 'renewal' &&
        latestSubscription?.end_date &&
        new Date(latestSubscription.end_date).getTime() > Date.now()
      ) {
        startDateObj = new Date(latestSubscription.end_date);
      }
      const startDate = startDateObj.toISOString().slice(0, 10);
      const endDateObj = new Date(startDateObj);
      endDateObj.setMonth(endDateObj.getMonth() + periodMonths);
      const endDate = endDateObj.toISOString().slice(0, 10);

      let subscription = null;
      if (latestSubscription?.subscription_id) {
        subscription = await billingModel.updateSubscriptionPlan(
          {
            subscriptionId: latestSubscription.subscription_id,
            planId: plan.plan_id,
            startDate,
            endDate,
            maxUsers: Math.max(
              Number(plan.max_users || 0),
              Number(latestSubscription.max_users || 0),
              userCount
            ),
            maxStorageMb: Number(plan.max_storage_mb || latestSubscription.max_storage_mb || 0),
          },
          tx
        );
      } else {
        subscription = await billingModel.createSubscriptionForOrganization(
          {
            organizationId,
            planId: plan.plan_id,
            startDate,
            endDate,
            maxUsers: Math.max(Number(plan.max_users || 0), userCount),
            maxStorageMb: Number(plan.max_storage_mb || 0),
          },
          tx
        );
      }

      let updatedPaymentResult;
      try {
        updatedPaymentResult = await tx.query(
          `UPDATE payment_history
           SET subscription_id = $1,
               plan_id = $2,
               amount = $3,
               payment_status = 'success',
               payment_method = $4,
               transaction_id = $5,
               currency_code = $6,
               period_months = $7,
               billing_type = $8,
               user_count = $9,
               failure_reason = NULL,
               payment_date = NOW(),
               updated_at = NOW()
           WHERE payment_id = $10
             AND organization_id = $11
           RETURNING *`,
          [
            subscription?.subscription_id || latestSubscription?.subscription_id || null,
            plan.plan_id,
            amount,
            paymentMethod,
            transactionId,
            currencyCode,
            periodMonths,
            billingType,
            userCount,
            paymentId,
            organizationId,
          ]
        );
      } catch (error) {
        if (error?.code === '23505') {
          const duplicate = await billingModel.findPaymentByTransactionId(transactionId, tx);
          if (duplicate && Number(duplicate.payment_id) !== paymentId) {
            const err = new Error('transaction_id already exists; provide a unique value');
            err.status = 409;
            throw err;
          }
        }
        throw error;
      }

      const payment = updatedPaymentResult.rows[0] || null;
      return {
        alreadyCompleted: false,
        payment,
        subscription,
        planName: plan.plan_name || null,
        billingType,
      };
    });

    await logActivitySafe({
      actor,
      contextOrganizationId: organizationId,
      targetType: 'payment',
      targetId: completed?.payment?.payment_id || paymentId,
      action: 'owner.payment.complete',
      actionCategory: 'billing',
      actionSubtype: completed?.alreadyCompleted ? 'owner_payment_already_completed' : 'owner_payment_completed',
      description: completed?.alreadyCompleted
        ? `Owner requested completion for already paid payment #${paymentId}`
        : `Owner completed payment #${paymentId} for organization #${organizationId}`,
      newValues: {
        organization_id: organizationId,
        payment_id: completed?.payment?.payment_id || paymentId,
        invoice_number: completed?.payment?.invoice_number || null,
        transaction_id: completed?.payment?.transaction_id || requestedTransactionId || null,
        payment_status: completed?.payment?.payment_status || 'success',
        payment_method: completed?.payment?.payment_method || requestedGateway || null,
        plan_id: completed?.payment?.plan_id || null,
        amount: completed?.payment?.amount || null,
        user_count: completed?.payment?.user_count || null,
        plan_name: completed?.planName || null,
        subscription_id: completed?.subscription?.subscription_id || null,
        note: requestedNote || null,
      },
      requestMeta,
      isSuccessful: true,
      status: 'success',
    });

    return success(
      res,
      completed,
      completed?.alreadyCompleted
        ? 'Payment was already completed earlier'
        : 'Payment completed by owner successfully'
    );
  } catch (error) {
    return next(error);
  }
};

const createOwnerV1 = async (req, res, next) => {
  try {
    const { company_name, owner_name, email, phone, password } = req.body || {};
    const requestedSubdomain = String(req.body?.subdomain || "").trim();
    const requestedOrgKey = String(req.body?.org_key || "").trim();
    const requestedCustomDomain = String(req.body?.custom_domain || "").trim();
    const requestedPlanId = Number(req.body?.plan_id || 1);

    if (!company_name || !owner_name || !email || !phone || !password) {
      const err = new Error("company_name, owner_name, email, phone, password are required");
      err.status = 400;
      throw err;
    }
    if (String(company_name).trim().length < 2 || String(company_name).trim().length > 120) {
      const err = new Error("company_name must be between 2 and 120 characters");
      err.status = 400;
      throw err;
    }
    if (String(owner_name).trim().length < 2 || String(owner_name).trim().length > 120) {
      const err = new Error("owner_name must be between 2 and 120 characters");
      err.status = 400;
      throw err;
    }
    if (String(password).length < 8) {
      const err = new Error("password must be at least 8 characters");
      err.status = 400;
      throw err;
    }

    const normalizedEmail = ensureBusinessEmail(email);
    const emailDomain = getEmailDomain(normalizedEmail);
    if (!emailDomain) {
      const err = new Error("Unable to derive domain from email");
      err.status = 400;
      throw err;
    }

    const normalizedPhone = normalizePhone(phone);
    const orgName = String(company_name).trim();
    const ownerName = String(owner_name).trim();
    const password_hash = await bcrypt.hash(String(password), 10);

    const created = await db.withTransaction(async (tx) => {
      const ownerRoleId = 1;
      const existingUser = await tx.query(
        "SELECT user_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
        [normalizedEmail]
      );
      if (existingUser.rows.length) {
        const err = new Error("Email already exists");
        err.status = 409;
        throw err;
      }

      const roleCheck = await tx.query("SELECT role_id FROM roles WHERE role_id = $1 LIMIT 1", [ownerRoleId]);
      if (!roleCheck.rows.length) {
        const err = new Error(`Required owner role_id ${ownerRoleId} is missing in roles table`);
        err.status = 500;
        throw err;
      }

      const planResult = await tx.query(
        "SELECT plan_id, interval_days, max_users, max_storage_mb FROM plans WHERE plan_id = $1 LIMIT 1",
        [requestedPlanId]
      );
      if (!planResult.rows.length) {
        const err = new Error(`Plan not found: ${requestedPlanId}`);
        err.status = 400;
        throw err;
      }
      const selectedPlan = planResult.rows[0];
      const intervalDays = Number(selectedPlan.interval_days);
      if (!Number.isFinite(intervalDays) || intervalDays <= 0) {
        const err = new Error("Selected plan interval_days must be greater than 0");
        err.status = 500;
        throw err;
      }

      const customDomain = requestedCustomDomain || emailDomain;
      const existingOrgByDomain = await tx.query(
        `SELECT organization_id
         FROM organizations
         WHERE LOWER(custom_domain) = LOWER($1)
         LIMIT 1`,
        [customDomain]
      );
      if (existingOrgByDomain.rows.length) {
        const err = new Error("Organization already exists for this custom_domain");
        err.status = 409;
        throw err;
      }

      const userResult = await tx.query(
        `INSERT INTO users (email, name, password_hash, mobile, is_platform_admin, is_global_member, status)
         VALUES ($1, $2, $3, $4, FALSE, FALSE, 'active')
         RETURNING user_id, email, name, mobile`,
        [normalizedEmail, ownerName, password_hash, normalizedPhone]
      );
      const user = userResult.rows[0];

      const baseSubdomain = slugify(requestedSubdomain || orgName) || "org";
      let subdomain = baseSubdomain;
      let orgKey = requestedOrgKey || generateOrgKey(baseSubdomain);

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const subdomainCheck = await tx.query(
          "SELECT organization_id FROM organizations WHERE subdomain = $1 LIMIT 1",
          [subdomain]
        );
        const orgKeyCheck = await tx.query(
          "SELECT organization_id FROM organizations WHERE org_key = $1 LIMIT 1",
          [orgKey]
        );
        if (!subdomainCheck.rows.length && !orgKeyCheck.rows.length) {
          break;
        }
        const suffix = crypto.randomBytes(2).toString("hex");
        subdomain = `${baseSubdomain}-${suffix}`.slice(0, 100);
        orgKey = generateOrgKey(`${baseSubdomain}${suffix}`);
      }

      const organizationResult = await tx.query(
        `INSERT INTO organizations (
           org_key, name, subdomain, custom_domain, owner_id, language_id, timezone_id, storage_used_mb, status
         )
         VALUES ($1, $2, $3, $4, $5, 1, 1, 0, 'active')
         RETURNING organization_id, org_key, name, subdomain, custom_domain, owner_id, status, created_at`,
        [orgKey, orgName, subdomain, customDomain, user.user_id]
      );
      const organization = organizationResult.rows[0];

      await tx.query(
        `INSERT INTO organization_members (organization_id, user_id, role_id, status)
         VALUES ($1, $2, $3, 'active')`,
        [organization.organization_id, user.user_id, ownerRoleId]
      );

      const subscriptionResult = await tx.query(
        `INSERT INTO subscriptions (
           organization_id, plan_id, status, start_date, end_date, max_users, max_storage_mb
         )
         VALUES ($1, $2, 'active', CURRENT_DATE, CURRENT_DATE + ($5 * INTERVAL '1 day'), $3, $4)
         RETURNING subscription_id, plan_id, status, start_date, end_date, max_users, max_storage_mb`,
        [
          organization.organization_id,
          selectedPlan.plan_id,
          selectedPlan.max_users,
          selectedPlan.max_storage_mb,
          intervalDays,
        ]
      );

      return {
        owner: user,
        organization,
        subscription: subscriptionResult.rows[0] || null,
      };
    });

    return success(res, created, "Owner account created", 201);
  } catch (error) {
    return next(error);
  }
};

const getOwnerOrganizationMembers = async (req, res, next) => {
  try {
    const organizationId = Number.parseInt(req.params?.organizationId, 10);
    if (!Number.isFinite(organizationId) || organizationId <= 0) {
      const err = new Error('Valid organizationId is required');
      err.status = 400;
      throw err;
    }

    const limit = Math.min(toPositiveInt(req.query?.limit, 20), 200);
    const offset = Math.max(toPositiveInt(req.query?.offset, 0), 0);
    const search = String(req.query?.search || '').trim();

    const orgResult = await db.query(
      `SELECT organization_id, name
       FROM organizations
       WHERE organization_id = $1
       LIMIT 1`,
      [organizationId]
    );
    if (!orgResult.rows.length) {
      const err = new Error('Organization not found');
      err.status = 404;
      throw err;
    }

    const where = [`om.organization_id = $1`];
    const values = [organizationId];
    let idx = 2;

    if (search) {
      where.push(`(
        COALESCE(u.name, '') ILIKE $${idx}
        OR COALESCE(u.email, '') ILIKE $${idx}
        OR COALESCE(u.mobile, '') ILIKE $${idx}
        OR COALESCE(r.role_name, '') ILIKE $${idx}
        OR COALESCE(r.role_key, '') ILIKE $${idx}
      )`);
      values.push(`%${search}%`);
      idx += 1;
    }

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM organization_members om
       LEFT JOIN users u ON u.user_id = om.user_id
       LEFT JOIN roles r ON r.role_id = om.role_id
       WHERE ${where.join(' AND ')}`,
      values
    );

    const listValues = [...values, limit, offset];
    const listResult = await db.query(
      `SELECT
         om.membership_id,
         om.organization_id,
         om.user_id,
         om.role_id,
         om.status AS membership_status,
         om.joined_at,
         u.name,
         u.email,
         u.mobile,
         u.status AS user_status,
         r.role_key,
         r.role_name
       FROM organization_members om
       LEFT JOIN users u ON u.user_id = om.user_id
       LEFT JOIN roles r ON r.role_id = om.role_id
       WHERE ${where.join(' AND ')}
       ORDER BY om.joined_at DESC, om.membership_id DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      listValues
    );

    return success(
      res,
      {
        organization: orgResult.rows[0],
        count: Number(countResult.rows[0]?.total || 0),
        rows: listResult.rows,
        meta: {
          limit,
          offset,
          search,
        },
      },
      'Owner organization members retrieved'
    );
  } catch (error) {
    return next(error);
  }
};

const getOwnerOrganizationSubscription = async (req, res, next) => {
  try {
    const organizationId = Number.parseInt(req.params?.organizationId, 10);
    if (!Number.isFinite(organizationId) || organizationId <= 0) {
      const err = new Error('Valid organizationId is required');
      err.status = 400;
      throw err;
    }

    const [orgResult, subscriptionResult] = await Promise.all([
      db.query(
        `SELECT organization_id, name
         FROM organizations
         WHERE organization_id = $1
         LIMIT 1`,
        [organizationId]
      ),
      db.query(
        `SELECT
           s.subscription_id,
           s.organization_id,
           s.plan_id,
           s.status,
           s.start_date,
           s.end_date,
           s.max_users,
           s.max_storage_mb,
           s.created_at,
           s.updated_at,
           p.plan_name,
           p.plan_key,
           p.price,
           p.default_currency,
           p.interval_days
         FROM subscriptions s
         LEFT JOIN plans p ON p.plan_id = s.plan_id
         WHERE s.organization_id = $1
         ORDER BY s.created_at DESC, s.subscription_id DESC
         LIMIT 1`,
        [organizationId]
      ),
    ]);

    if (!orgResult.rows.length) {
      const err = new Error('Organization not found');
      err.status = 404;
      throw err;
    }

    return success(
      res,
      {
        organization: orgResult.rows[0],
        subscription: subscriptionResult.rows[0] || null,
      },
      'Owner organization subscription retrieved'
    );
  } catch (error) {
    return next(error);
  }
};

const getOwnerOrganizationPaymentHistory = async (req, res, next) => {
  try {
    const organizationId = Number.parseInt(req.params?.organizationId, 10);
    if (!Number.isFinite(organizationId) || organizationId <= 0) {
      const err = new Error('Valid organizationId is required');
      err.status = 400;
      throw err;
    }

    const limit = Math.min(toPositiveInt(req.query?.limit, 20), 100);
    const offset = Math.max(toPositiveInt(req.query?.offset, 0), 0);
    const search = String(req.query?.search || '').trim();
    const status = String(req.query?.status || '').trim().toLowerCase();

    const orgResult = await db.query(
      `SELECT organization_id, name
       FROM organizations
       WHERE organization_id = $1
       LIMIT 1`,
      [organizationId]
    );
    if (!orgResult.rows.length) {
      const err = new Error('Organization not found');
      err.status = 404;
      throw err;
    }

    const where = ['ph.organization_id = $1'];
    const values = [organizationId];
    let idx = 2;

    if (status) {
      where.push(`LOWER(COALESCE(ph.payment_status, '')) = $${idx}`);
      values.push(status);
      idx += 1;
    }

    if (search) {
      where.push(`(
        COALESCE(ph.invoice_number, '') ILIKE $${idx}
        OR COALESCE(ph.transaction_id, '') ILIKE $${idx}
        OR COALESCE(ph.billing_email, '') ILIKE $${idx}
        OR COALESCE(p.plan_name, '') ILIKE $${idx}
      )`);
      values.push(`%${search}%`);
      idx += 1;
    }

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM payment_history ph
       LEFT JOIN plans p ON p.plan_id = ph.plan_id
       WHERE ${where.join(' AND ')}`,
      values
    );

    const listValues = [...values, limit, offset];
    const listResult = await db.query(
      `SELECT
         ph.payment_id,
         ph.organization_id,
         ph.subscription_id,
         ph.plan_id,
         ph.amount,
         ph.payment_date,
         ph.payment_status,
         ph.invoice_number,
         ph.transaction_id,
         ph.payment_method,
         ph.currency_code,
         ph.period_months,
         ph.user_count,
         ph.billing_type,
         ph.coupon_code,
         ph.discount_amount,
         ph.billing_name,
         ph.billing_email,
         ph.country,
         ph.state,
         ph.city,
         ph.postal_code,
         p.plan_name,
         p.plan_key
       FROM payment_history ph
       LEFT JOIN plans p ON p.plan_id = ph.plan_id
       WHERE ${where.join(' AND ')}
       ORDER BY ph.payment_date DESC, ph.payment_id DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      listValues
    );

    return success(
      res,
      {
        organization: orgResult.rows[0],
        count: Number(countResult.rows[0]?.total || 0),
        rows: listResult.rows,
        meta: {
          limit,
          offset,
          search,
          status: status || null,
        },
      },
      'Owner organization payment history retrieved'
    );
  } catch (error) {
    return next(error);
  }
};

// ─── Owner: System & Socket Stats ────────────────────────────────────────────
const getOwnerV1SystemStats = async (req, res, next) => {
  try {
    const { getSocketStats } = require('../socket/index');
    const socketStats = getSocketStats();

    // DB stats — run in parallel
    const [
      msgTotal,
      msg24h,
      usersTotal,
      usersActive,
      devicesTotal,
      orgsTotal,
      orgsActive,
      sessionsActive,
    ] = await Promise.all([
      db.query('SELECT COUNT(*) AS count FROM messages').then(r => Number(r.rows[0]?.count || 0)).catch(() => 0),
      db.query("SELECT COUNT(*) AS count FROM messages WHERE send_time > NOW() - INTERVAL '24 hours'").then(r => Number(r.rows[0]?.count || 0)).catch(() => 0),
      db.query('SELECT COUNT(*) AS count FROM users').then(r => Number(r.rows[0]?.count || 0)).catch(() => 0),
      db.query("SELECT COUNT(*) AS count FROM users WHERE status = 'active'").then(r => Number(r.rows[0]?.count || 0)).catch(() => 0),
      db.query('SELECT COUNT(*) AS count FROM user_devices').then(r => Number(r.rows[0]?.count || 0)).catch(() => 0),
      db.query('SELECT COUNT(*) AS count FROM organizations').then(r => Number(r.rows[0]?.count || 0)).catch(() => 0),
      db.query("SELECT COUNT(*) AS count FROM organizations WHERE status = 'active'").then(r => Number(r.rows[0]?.count || 0)).catch(() => 0),
      db.query("SELECT COUNT(*) AS count FROM sessions WHERE revoked_at IS NULL").then(r => Number(r.rows[0]?.count || 0)).catch(() => 0),
    ]);

    // Group messages count
    const grpMsgTotal = await db.query('SELECT COUNT(*) AS count FROM group_messages').then(r => Number(r.rows[0]?.count || 0)).catch(() => 0);
    const grpMsg24h = await db.query("SELECT COUNT(*) AS count FROM group_messages WHERE created_at > NOW() - INTERVAL '24 hours'").then(r => Number(r.rows[0]?.count || 0)).catch(() => 0);

    // Top active orgs (by message count in last 24h)
    const topOrgs = await db.query(`
      SELECT o.organization_id, o.name, COUNT(m.message_id) AS msg_count
      FROM organizations o
      LEFT JOIN messages m ON m.organization_id = o.organization_id AND m.send_time > NOW() - INTERVAL '24 hours'
      WHERE o.status = 'active'
      GROUP BY o.organization_id, o.name
      ORDER BY msg_count DESC
      LIMIT 10
    `).then(r => r.rows).catch(() => []);

    return success(res, {
      ...socketStats,
      database: {
        messages: {
          total: msgTotal + grpMsgTotal,
          last24h: msg24h + grpMsg24h,
          dmTotal: msgTotal,
          dm24h: msg24h,
          groupTotal: grpMsgTotal,
          group24h: grpMsg24h,
        },
        users: {
          total: usersTotal,
          active: usersActive,
        },
        devices: {
          total: devicesTotal,
        },
        organizations: {
          total: orgsTotal,
          active: orgsActive,
        },
        sessions: {
          active: sessionsActive,
        },
        topActiveOrgs: topOrgs.map(r => ({
          organizationId: r.organization_id,
          name: r.name,
          messagesLast24h: Number(r.msg_count),
        })),
      },
    }, 'System stats retrieved');
  } catch (error) {
    return next(error);
  }
};

const getCsrfToken = async (req, res, next) => {
  try {
    const token = upsertCsrfCookie(req, res);
    return success(res, { csrf_token: token }, 'CSRF token ready');
  } catch (error) {
    return next(error);
  }
};

// ─── Update Timezone ─────────────────────────────────────────────────────────
const updateTimezone = async (req, res, next) => {
  try {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      const err = new Error('Unauthorized'); err.status = 401; throw err;
    }
    const { timezone } = req.body;
    if (!timezone || typeof timezone !== 'string') {
      const err = new Error('timezone is required'); err.status = 400; throw err;
    }
    // Validate timezone string using Intl
    try { Intl.DateTimeFormat(undefined, { timeZone: timezone }); } catch {
      const err = new Error(`Invalid timezone: ${timezone}`); err.status = 400; throw err;
    }
    await db.query('UPDATE users SET timezone = $1, updated_at = NOW() WHERE user_id = $2', [timezone, userId]);
    return success(res, { timezone }, 'Timezone updated');
  } catch (err) {
    return next(err);
  }
};

// ─── OTP Verification Logs ──────────────────────────────────────────────────
const getOtpLogs = async (req, res, next) => {
  try {
    const orgId = Number(req.user?.org || 0);
    const roleId = Number(req.user?.role_id || 0);
    const isSuperAdmin = roleId === 3 || roleId === 1; // Super Admin or Owner

    const { rows } = await db.query(
      `SELECT ov.otp_id, ov.user_id, u.name, u.email, u.profile_url,
              ov.identifier, ov.type, ov.otp_code, ov.purpose, ov.status,
              ov.attempt_count, ov.max_attempts, ov.ip_address,
              ov.created_at, ov.expires_at, ov.verified_at, ov.updated_at
       FROM otp_verifications ov
       LEFT JOIN users u ON u.user_id = ov.user_id
       WHERE ov.organization_id = $1
          OR (ov.organization_id IS NULL AND ov.user_id IS NULL)
       ORDER BY ov.created_at DESC
       LIMIT 25`,
      [orgId]
    );

    // Mask OTP code for non-Super Admins
    const safeRows = rows.map(r => ({
      ...r,
      otp_code: isSuperAdmin ? r.otp_code : '••••••',
    }));

    return success(res, { rows: safeRows, count: safeRows.length, canViewOtp: isSuperAdmin }, 'OTP logs retrieved');
  } catch (err) {
    return next(err);
  }
};

// ─── QR Code Login ──────────────────────────────────────────────────────────

// 1. Web calls this to generate QR code data
const qrGenerate = async (req, res, next) => {
  try {
    const qrId = crypto.randomUUID();
    const qrToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await db.query(
      `INSERT INTO qr_sessions (qr_id, qr_token, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [qrId, qrToken, req.ip, req.headers['user-agent'] || '', expiresAt]
    );

    return success(res, { qrId, qrToken, expiresAt }, 'QR session created');
  } catch (err) {
    return next(err);
  }
};

// 2. Mobile calls this after scanning QR — links the session to the user
const qrConfirm = async (req, res, next) => {
  try {
    const { qrToken } = req.body;
    const mobileUserId = Number(req.user?.sub);
    const mobileOrgId = Number(req.user?.org || 0);

    if (!qrToken) {
      const err = new Error('qrToken is required');
      err.status = 400;
      throw err;
    }

    // Find and validate QR session
    const { rows } = await db.query(
      `SELECT * FROM qr_sessions WHERE qr_token = $1 LIMIT 1`,
      [qrToken]
    );

    if (!rows.length) {
      const err = new Error('Invalid or expired QR code');
      err.status = 404;
      throw err;
    }

    const session = rows[0];

    if (session.status !== 'pending') {
      const err = new Error('QR code already used');
      err.status = 410;
      throw err;
    }

    if (new Date(session.expires_at) < new Date()) {
      await db.query(`UPDATE qr_sessions SET status = 'expired' WHERE qr_id = $1`, [session.qr_id]);
      const err = new Error('QR code expired');
      err.status = 410;
      throw err;
    }

    // Get user info for token generation
    const userRes = await db.query(
      `SELECT u.user_id, u.email, u.name, om.role_id, r.role_key
       FROM users u
       LEFT JOIN organization_members om ON om.user_id = u.user_id AND om.organization_id = $2
       LEFT JOIN roles r ON r.role_id = om.role_id
       WHERE u.user_id = $1 LIMIT 1`,
      [mobileUserId, mobileOrgId]
    );

    if (!userRes.rows.length) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }

    const user = userRes.rows[0];

    // Generate web access token
    const webPayload = {
      sub: user.user_id,
      email: user.email,
      org: mobileOrgId,
      role_id: user.role_id || null,
      role: user.role_key || null,
      name: user.name,
    };
    const webAccessToken = signAccessToken(webPayload);
    const webRefreshToken = generateRefreshToken();

    // Update QR session as linked
    await db.query(
      `UPDATE qr_sessions
       SET status = 'linked', user_id = $1, organization_id = $2,
           web_access_token = $3, web_refresh_token = $4, linked_at = NOW()
       WHERE qr_id = $5`,
      [mobileUserId, mobileOrgId, webAccessToken, webRefreshToken, session.qr_id]
    );

    return success(res, { ok: true }, 'QR login authorized');
  } catch (err) {
    return next(err);
  }
};

// 3. Web polls this to check if mobile has confirmed
const qrStatus = async (req, res, next) => {
  try {
    const { qrId } = req.query;

    if (!qrId) {
      const err = new Error('qrId is required');
      err.status = 400;
      throw err;
    }

    const { rows } = await db.query(
      `SELECT status, user_id, organization_id, web_access_token, web_refresh_token, expires_at
       FROM qr_sessions WHERE qr_id = $1 LIMIT 1`,
      [qrId]
    );

    if (!rows.length) {
      const err = new Error('QR session not found');
      err.status = 404;
      throw err;
    }

    const session = rows[0];

    // Check expiry
    if (new Date(session.expires_at) < new Date() && session.status === 'pending') {
      await db.query(`UPDATE qr_sessions SET status = 'expired' WHERE qr_id = $1`, [qrId]);
      return success(res, { status: 'expired' }, 'QR expired');
    }

    if (session.status === 'linked') {
      // Mark as used so it can't be polled again
      await db.query(`UPDATE qr_sessions SET status = 'used', used_at = NOW() WHERE qr_id = $1`, [qrId]);

      // Get user info
      const userRes = await db.query(
        `SELECT u.user_id, u.email, u.name, u.profile_url FROM users u WHERE u.user_id = $1 LIMIT 1`,
        [session.user_id]
      );
      const user = userRes.rows[0] || {};

      return success(res, {
        status: 'linked',
        accessToken: session.web_access_token,
        refreshToken: session.web_refresh_token,
        user: { id: user.user_id, email: user.email, name: user.name, avatar: user.profile_url },
      }, 'QR login confirmed');
    }

    return success(res, { status: session.status }, 'QR status');
  } catch (err) {
    return next(err);
  }
};

// 4. Mobile calls this to list all QR-linked web sessions
const qrLinkedDevices = async (req, res, next) => {
  try {
    const userId = Number(req.user?.sub);
    const { rows } = await db.query(
      `SELECT qr_id, ip_address, user_agent, status, linked_at, used_at, created_at
       FROM qr_sessions
       WHERE user_id = $1 AND status IN ('linked', 'used')
       ORDER BY linked_at DESC
       LIMIT 20`,
      [userId]
    );

    const devices = rows.map(r => {
      const ua = r.user_agent || '';
      let browser = 'Web Browser';
      let os = 'Unknown';
      if (ua.includes('Chrome')) browser = 'Chrome';
      else if (ua.includes('Firefox')) browser = 'Firefox';
      else if (ua.includes('Safari')) browser = 'Safari';
      else if (ua.includes('Edge')) browser = 'Edge';
      if (ua.includes('Windows')) os = 'Windows';
      else if (ua.includes('Mac')) os = 'macOS';
      else if (ua.includes('Linux')) os = 'Linux';
      else if (ua.includes('Android')) os = 'Android';
      else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

      return {
        qr_id: r.qr_id,
        browser,
        os,
        ip_address: r.ip_address,
        status: r.status,
        linked_at: r.linked_at || r.used_at,
        created_at: r.created_at,
      };
    });

    return success(res, { devices }, 'Linked devices');
  } catch (err) {
    return next(err);
  }
};

// 5. Mobile calls this to logout a QR-linked web session
const qrLogout = async (req, res, next) => {
  try {
    const userId = Number(req.user?.sub);
    const { qrId } = req.params;

    // Get session before deleting — need the web token to invalidate
    const { rows: sessions } = await db.query(
      `SELECT qr_id, web_access_token FROM qr_sessions WHERE qr_id = $1 AND user_id = $2`,
      [qrId, userId]
    );

    if (!sessions.length) {
      const err = new Error('Session not found');
      err.status = 404;
      throw err;
    }

    const session = sessions[0];

    // Delete QR session
    await db.query(`DELETE FROM qr_sessions WHERE qr_id = $1`, [qrId]);

    // Blacklist the web access token — add to revoked list
    if (session.web_access_token) {
      try {
        await db.query(
          `INSERT INTO revoked_tokens (token_hash, user_id, revoked_at, reason)
           VALUES ($1, $2, NOW(), 'qr_logout')
           ON CONFLICT DO NOTHING`,
          [hashToken(session.web_access_token), userId]
        );
      } catch {
        // Table might not exist yet — that's ok, token will expire naturally
      }
    }

    // Emit socket event to force web logout
    const io = req.app?.get?.('io');
    if (io) {
      // Emit to all sockets of this user — web will catch it and logout
      const { emitToUser } = require('../socket/index');
      if (typeof emitToUser === 'function') {
        emitToUser(String(userId), 'auth:force_logout', { reason: 'linked_device_removed', qrId });
      }
    }

    return success(res, { ok: true }, 'Device logged out');
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  register,
  createNewAccount,
  resendOtp,
  forgotPassword,
  verifyForgotPasswordOtp,
  resetPassword,
  changePassword,
  verifyOtp,
  login,
  refresh,
  logout,
  logoutAll,
  listTrustedDevices,
  revokeTrustedDevice,
  me,
  getUserDetails,
  getOrganizationDetails,
  getOwnerDashboard,
  getOwnerV1Organizations,
  getOwnerV1OrganizationOverview,
  getOwnerV1Users,
  getOwnerV1UserInsights,
  updateOwnerV1OrganizationMember,
  completeOwnerV1OrganizationPayment,
  createOwnerV1,
  getOwnerOrganizationMembers,
  getOwnerOrganizationSubscription,
  getOwnerOrganizationPaymentHistory,
  getOwnerV1SystemStats,
  getCsrfToken,
  updateTimezone,
  getOtpLogs,
  qrGenerate,
  qrConfirm,
  qrStatus,
  qrLinkedDevices,
  qrLogout,
};
