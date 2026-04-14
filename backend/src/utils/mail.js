const nodemailer = require('nodemailer');

const DEFAULT_MAIL_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedTransporter = null;
let cachedFrom = null;
let cacheExpiresAt = 0;

const getSmtpSettingsFromDb = async () => {
  // Lazy-require to avoid circular dependency at module load time
  const smtpSettingsModel = require('../models/smtpSettingsModel');
  const dbSettings = await smtpSettingsModel.findActive();
  if (dbSettings) return dbSettings;

  // Fallback to .env if no active DB config exists
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM, CONTACT_US_NOTIFY_TO } = process.env;
  if (SMTP_HOST && SMTP_USER) {
    return {
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: SMTP_SECURE === 'true',
      smtp_user: SMTP_USER,
      smtp_pass: SMTP_PASS || '',
      from_address: SMTP_FROM || SMTP_USER,
      contact_notify_to: CONTACT_US_NOTIFY_TO || '',
    };
  }
  return null;
};

const getTransporter = async () => {
  const now = Date.now();
  if (cachedTransporter && now < cacheExpiresAt) {
    return { transporter: cachedTransporter, from: cachedFrom };
  }

  const settings = await getSmtpSettingsFromDb();

  if (!settings || !settings.host || !settings.smtp_user) {
    const err = new Error('SMTP settings not configured. Please configure SMTP in the Owner Dashboard.');
    err.status = 500;
    throw err;
  }

  const timeoutMs = DEFAULT_MAIL_TIMEOUT_MS;

  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port || 587,
    secure: settings.secure === true,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
    auth: { user: settings.smtp_user, pass: settings.smtp_pass },
  });

  setImmediate(() => {
    transporter.verify().catch((error) => {
      console.error('SMTP transporter warmup failed', { message: error.message });
    });
  });

  cachedTransporter = transporter;
  cachedFrom = settings.from_address || settings.smtp_user;
  cacheExpiresAt = now + CACHE_TTL_MS;

  return { transporter, from: cachedFrom };
};

const invalidateTransporterCache = () => {
  cachedTransporter = null;
  cachedFrom = null;
  cacheExpiresAt = 0;
};

const sendMail = async ({ to, subject, text, html, replyTo, cc, bcc, attachments }) => {
  const { transporter, from } = await getTransporter();
  return transporter.sendMail({ from, to, subject, text, html, replyTo, cc, bcc, attachments });
};

const sendMailAsync = (payload, options = {}) => {
  const { onSuccess, onError } = options;
  const promise = new Promise((resolve, reject) => {
    setImmediate(async () => {
      try {
        const info = await sendMail(payload);
        if (typeof onSuccess === 'function') onSuccess(info);
        resolve(info);
      } catch (error) {
        if (typeof onError === 'function') {
          onError(error);
        } else {
          console.error('Async mail send failed', {
            message: error.message,
            to: payload?.to,
            subject: payload?.subject,
          });
        }
        reject(error);
      }
    });
  });

  // Avoid unhandled rejection when caller intentionally fire-and-forgets.
  promise.catch(() => {});
  return promise;
};

module.exports = {
  sendMail,
  sendMailAsync,
  invalidateTransporterCache,
};
