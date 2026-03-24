const siteDetailModel = require('../models/siteDetailModel');

const DEFAULT_APP_NAME = process.env.APP_NAME || 'TeamChatX';
const DEFAULT_SUPPORT_EMAIL =
  process.env.SECURITY_SUPPORT_EMAIL || 'support@teamchatx.com';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedValue = null;
let cacheExpiresAt = 0;

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const extractFirstEmail = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const angleMatch = raw.match(/<([^>]+)>/);
  const candidate = angleMatch?.[1] || raw;
  const normalized = normalizeEmail(candidate);
  return isValidEmail(normalized) ? normalized : '';
};

const parseEnvEmails = (rawValue) =>
  String(rawValue || '')
    .split(',')
    .map((item) => extractFirstEmail(item))
    .filter((email) => isValidEmail(email));

const getPrimarySiteEmail = (siteDetail = {}) => {
  const emails = Array.isArray(siteDetail.emails) ? siteDetail.emails : [];
  const activeEmails = emails.filter((item) => {
    const status = String(item?.status || '').trim().toLowerCase();
    return !status || status === 'active';
  });
  const source = activeEmails.length ? activeEmails : emails;
  const primary = source.find((item) => item?.is_primary) || source[0];
  const candidate = normalizeEmail(primary?.email_address || '');
  return isValidEmail(candidate) ? candidate : '';
};

const getNotifyRecipientsFromSite = (siteDetail = {}) => {
  const emails = Array.isArray(siteDetail.emails) ? siteDetail.emails : [];
  const selected = emails
    .filter((item) => {
      const status = String(item?.status || '').trim().toLowerCase();
      return !status || status === 'active';
    })
    .map((item) => normalizeEmail(item?.email_address || ''))
    .filter((email) => isValidEmail(email));
  return Array.from(new Set(selected));
};

const resolveFromSiteDetails = async () => {
  const rows = await siteDetailModel.findAll();
  const selected =
    rows.find((item) => String(item?.status || '').trim().toLowerCase() === 'active') || rows[0] || null;
  if (!selected) return null;
  return {
    appName: String(selected.brand_name || '').trim() || DEFAULT_APP_NAME,
    supportEmail: getPrimarySiteEmail(selected) || extractFirstEmail(DEFAULT_SUPPORT_EMAIL),
    notifyRecipients: getNotifyRecipientsFromSite(selected),
  };
};

const resolveSmtpNotifyTo = async () => {
  try {
    const smtpSettingsModel = require('../models/smtpSettingsModel');
    const settings = await smtpSettingsModel.findActive();
    if (settings?.contact_notify_to) {
      return parseEnvEmails(settings.contact_notify_to);
    }
  } catch (_) {
    // ignore
  }
  return [];
};

const resolveMailBranding = async ({ useCache = true } = {}) => {
  const now = Date.now();
  if (useCache && cachedValue && now < cacheExpiresAt) {
    return cachedValue;
  }

  const dbNotifyRecipients = await resolveSmtpNotifyTo();
  const fallbackRecipients =
    dbNotifyRecipients.length > 0
      ? dbNotifyRecipients
      : [extractFirstEmail(DEFAULT_SUPPORT_EMAIL)].filter((email) => isValidEmail(email));

  const fallback = {
    appName: DEFAULT_APP_NAME,
    supportEmail: extractFirstEmail(DEFAULT_SUPPORT_EMAIL) || 'support@teamchatx.com',
    notifyRecipients: fallbackRecipients.length ? fallbackRecipients : ['support@teamchatx.com'],
  };

  try {
    const fromSite = await resolveFromSiteDetails();
    const resolved = fromSite
      ? {
          appName: fromSite.appName || fallback.appName,
          supportEmail: fromSite.supportEmail || fallback.supportEmail,
          notifyRecipients:
            fromSite.notifyRecipients && fromSite.notifyRecipients.length
              ? fromSite.notifyRecipients
              : fallback.notifyRecipients,
        }
      : fallback;
    cachedValue = resolved;
    cacheExpiresAt = now + CACHE_TTL_MS;
    return resolved;
  } catch (error) {
    return fallback;
  }
};

module.exports = {
  resolveMailBranding,
};
