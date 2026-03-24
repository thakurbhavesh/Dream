const path = require('node:path');
const dotenv = require('dotenv');
const db = require('../config/database');
const { success } = require('../utils/response');
const billingModel = require('../models/billingModel');
const couponModel = require('../models/couponModel');
const { sendMailAsync } = require('../utils/mail');
const { resolveMailBranding } = require('../utils/mailBranding');
const { getBillingPaymentSuccessTemplate } = require('../templates/mail');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');
const { decryptSecretValue, sanitizeSensitiveConfig } = require('../utils/paymentGatewaySecrets');

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const runInBackground = (promise, context) => {
  if (!promise || typeof promise.then !== 'function') return;
  promise.catch((error) => {
    console.error(`Background task failed: ${context}`, {
      message: error.message,
    });
  });
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeCurrency = (value) => {
  const normalized = String(value || process.env.BILLING_CURRENCY_DEFAULT || 'INR')
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : 'INR';
};

const pickFirstDefinedString = (sources = []) => {
  for (const source of sources) {
    const text = String(source ?? '').trim();
    if (text) return text;
  }
  return '';
};

const readConfigValue = (config = {}, key) => {
  if (!config || typeof config !== 'object') return undefined;
  const parts = String(key || '').split('.');
  let cursor = config;
  for (const part of parts) {
    if (!cursor || typeof cursor !== 'object' || !(part in cursor)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
};

const readDecryptedCredential = (config = {}, keys = []) => {
  for (const key of keys) {
    const rawValue = readConfigValue(config, key);
    const text = String(rawValue ?? '').trim();
    if (!text) continue;
    try {
      return decryptSecretValue(text, { allowPlain: true });
    } catch (error) {
      const err = new Error(`Unable to decrypt credential "${key}"`);
      err.status = 500;
      err.cause = error;
      throw err;
    }
  }
  return '';
};

const toMode = (value, fallback = 'sandbox') => {
  const mode = String(value || '').trim().toLowerCase();
  return mode === 'live' ? 'live' : fallback;
};

const normalizeGatewayAccount = (account = {}, index = 0) => {
  const row = asPlainObject(account);
  const modes = asPlainObject(row.modes);
  return {
    account_id: pickFirstDefinedString([row.account_id, row.id, row.key]) || `account_${index + 1}`,
    label: pickFirstDefinedString([row.label, row.account_name, row.name]) || `Account ${index + 1}`,
    status: String(row.status || 'active').trim().toLowerCase(),
    is_default: Boolean(row.is_default),
    default_config: asPlainObject(row.config),
    modes: {
      sandbox: {
        ...asPlainObject(row.sandbox),
        ...asPlainObject(modes.sandbox),
      },
      live: {
        ...asPlainObject(row.live),
        ...asPlainObject(modes.live),
      },
    },
  };
};

const resolveGatewayRuntimeConfig = async (
  gatewayKey,
  { preferredMode = '', preferredAccountId = '' } = {}
) => {
  const row = await billingModel.findPaymentGatewayByKey(gatewayKey).catch(() => null);
  const config = asPlainObject(row?.config_json);
  const provider = String(row?.provider || gatewayKey || '').trim().toLowerCase();
  const accountsRaw = Array.isArray(config.accounts) ? config.accounts : [];
  const accounts = accountsRaw.map((item, index) => normalizeGatewayAccount(item, index));
  const preferredAccount = String(preferredAccountId || '').trim();
  const activeAccountId = preferredAccount || pickFirstDefinedString([config.active_account_id, config.activeAccountId]);
  const activeMode = toMode(preferredMode || config.active_mode || config.activeMode || 'sandbox');
  const activeAccount =
    accounts.find((item) => String(item.account_id) === activeAccountId) ||
    accounts.find((item) => item.is_default) ||
    accounts.find((item) => item.status !== 'inactive') ||
    accounts[0] ||
    null;
  const topLevelModeConfig = asPlainObject(config[activeMode]);
  const baseConfig = asPlainObject(config.credentials);
  const resolvedConfig = {
    ...baseConfig,
    ...topLevelModeConfig,
    ...(activeAccount?.default_config || {}),
    ...(activeAccount?.modes?.[activeMode] || {}),
  };

  return {
    row,
    provider,
    active_mode: activeMode,
    active_account_id: activeAccount?.account_id || '',
    active_account_label: activeAccount?.label || '',
    resolved_config: resolvedConfig,
  };
};

const getStripeClient = ({ gatewayRuntime = null } = {}) => {
  const stripeConfig = asPlainObject(gatewayRuntime?.resolved_config);
  const secretFromDb = readDecryptedCredential(stripeConfig, [
    'secret_key',
    'secretKey',
    'stripe_secret_key',
    'credentials.secret_key',
    'credentials.secretKey',
    'credentials.stripe_secret_key',
    'api_secret',
    'access_key',
  ]);
  const secretKeyRaw =
    secretFromDb ||
    process.env.STRIPE_SECRET_KEY ||
    process.env.BILLING_STRIPE_SECRET_KEY ||
    '';
  const secretKey = String(secretKeyRaw).trim().replace(/^['"]|['"]$/g, '');
  if (!secretKey) {
    const err = new Error('Stripe is not configured. Missing Stripe secret key');
    err.status = 500;
    throw err;
  }
  if (secretKey.startsWith('pk_')) {
    const err = new Error(
      'Invalid Stripe key: publishable key (pk_...) provided instead of secret key (sk_...). ' +
      'Update the "secret_key" field in Owner Dashboard → Payment Gateways → Stripe with sk_live_... or sk_test_...'
    );
    err.status = 500;
    throw err;
  }
  // eslint-disable-next-line global-require
  const Stripe = require('stripe');
  return new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' });
};

const RATE_CACHE = {
  fetchedAt: 0,
  ttlMs: 15 * 60 * 1000,
  rates: null,
};

const getFallbackRates = () => {
  const usdToInr = toNumber(process.env.BILLING_USD_TO_INR, 83.5);
  return { USD: 1, INR: usdToInr > 0 ? usdToInr : 83.5 };
};

const getLiveRates = async () => {
  const now = Date.now();
  if (RATE_CACHE.rates && now - RATE_CACHE.fetchedAt < RATE_CACHE.ttlMs) {
    return RATE_CACHE.rates;
  }

  const apiUrl = String(process.env.BILLING_RATE_API_URL || 'https://open.er-api.com/v6/latest/USD').trim();
  const timeoutMs = Math.max(toNumber(process.env.BILLING_RATE_TIMEOUT_MS, 5000), 1000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`rate api http ${response.status}`);
    }
    const payload = await response.json();
    const rates = payload?.rates && typeof payload.rates === 'object' ? payload.rates : null;
    if (!rates || !Number.isFinite(Number(rates.USD)) || Number(rates.USD) <= 0) {
      throw new Error('invalid rate payload');
    }
    RATE_CACHE.rates = rates;
    RATE_CACHE.fetchedAt = now;
    return rates;
  } catch {
    return getFallbackRates();
  } finally {
    clearTimeout(timer);
  }
};

const convertAmount = async (amount, fromCurrency, toCurrency) => {
  const rates = await getLiveRates();
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  const fromRate = toNumber(rates[from], 0);
  const toRate = toNumber(rates[to], 0);
  if (fromRate <= 0 || toRate <= 0) {
    const fallback = getFallbackRates();
    const fallbackFrom = toNumber(fallback[from], 0);
    const fallbackTo = toNumber(fallback[to], 0);
    if (fallbackFrom <= 0 || fallbackTo <= 0) return amount;
    const usdAmount = amount / fallbackFrom;
    return usdAmount * fallbackTo;
  }
  const usdAmount = amount / fromRate;
  return usdAmount * toRate;
};

const getPeriodMonths = (cycle = 'month') => {
  const normalizedCycle = String(cycle || 'month').trim().toLowerCase();
  return normalizedCycle === 'year' ? 12 : 1;
};

const compactMetadata = (payload = {}) =>
  Object.fromEntries(
    Object.entries(payload)
      .map(([key, value]) => [key, String(value ?? '').trim()])
      .filter(([, value]) => value !== '')
  );

const toStripeCountryCode = (value = '') => {
  const normalized = String(value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
};

const normalizePhoneForStripe = (value = '', phonecode = '') => {
  const normalized = String(value || '').trim();
  if (!normalized) return undefined;
  const compact = normalized.replace(/[^\d+]/g, '');
  if (!compact) return undefined;
  if (compact.startsWith('+')) return compact;
  const prefix = String(phonecode || '').trim().replace(/[^\d]/g, '');
  return prefix ? `+${prefix}${compact}` : compact;
};

const resolveStripeCountryContext = async (address = {}) => {
  const countryId = toNumber(address?.countryId, 0);
  const rawCountry = String(address?.country || '').trim();
  const normalizedCountry = rawCountry.toUpperCase();

  const conditions = [];
  const values = [];
  let idx = 1;

  if (countryId > 0) {
    conditions.push(`country_id = $${idx}`);
    values.push(countryId);
    idx += 1;
  }
  if (normalizedCountry) {
    conditions.push(`UPPER(iso_code) = $${idx}`);
    values.push(normalizedCountry);
    idx += 1;
    conditions.push(`UPPER(name) = $${idx}`);
    values.push(normalizedCountry);
    idx += 1;
  }

  if (!conditions.length) {
    return {
      countryCode: toStripeCountryCode(rawCountry),
      phonecode: '',
    };
  }

  const orderClause = countryId > 0 ? `ORDER BY CASE WHEN country_id = $1 THEN 0 ELSE 1 END, name ASC` : `ORDER BY name ASC`;
  const { rows } = await db.query(
    `SELECT iso_code, phonecode
     FROM countries
     WHERE ${conditions.join(' OR ')}
     ${orderClause}
     LIMIT 1`,
    values
  ).catch(() => ({ rows: [] }));

  const row = rows[0] || null;
  return {
    countryCode: toStripeCountryCode(row?.iso_code || rawCountry),
    phonecode: String(row?.phonecode || '').trim(),
  };
};

const buildStripeCustomerPayload = async ({ address, billingEmail, stripeMetadata } = {}) => {
  const countryContext = await resolveStripeCountryContext(address);
  return {
    name: address?.fullName || undefined,
    email: String(billingEmail || address?.email || '').trim() || undefined,
    phone: normalizePhoneForStripe(address?.mobile, countryContext.phonecode),
    address: {
      line1: address?.addressLine1 || undefined,
      line2: address?.addressLine2 || undefined,
      city: address?.city || undefined,
      state: address?.state || undefined,
      postal_code: address?.postalCode || undefined,
      country: countryContext.countryCode,
    },
    metadata: stripeMetadata,
  };
};

const findReusableStripeCustomer = async (stripe, { billingEmail, organizationId } = {}) => {
  const normalizedEmail = String(billingEmail || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const result = await stripe.customers.list({
    email: normalizedEmail,
    limit: 10,
  });

  const rows = Array.isArray(result?.data) ? result.data : [];
  return (
    rows.find(
      (customer) =>
        String(customer?.metadata?.organization_id || '').trim() === String(organizationId || '').trim()
    ) ||
    rows[0] ||
    null
  );
};

const buildFailureReason = ({
  stage,
  message,
  code = '',
  type = '',
  raw = null,
} = {}) => ({
  stage: String(stage || '').trim() || null,
  message: String(message || '').trim() || 'Payment failed',
  code: String(code || '').trim() || null,
  type: String(type || '').trim() || null,
  raw: raw && typeof raw === 'object' ? raw : null,
});

const normalizeGatewayKey = (value) =>
  String(value || 'stripe')
    .trim()
    .toLowerCase()
    .split(/[,\|/]/)[0]
    .split(':')[0]
    .trim() || 'stripe';

const asPlainObject = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      return {};
    }
  }
  return {};
};

const appendQueryParam = (urlValue, key, val) => {
  const raw = String(urlValue || '').trim();
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    url.searchParams.set(key, val);
    return url.toString();
  } catch {
    const separator = raw.includes('?') ? '&' : '?';
    return `${raw}${separator}${encodeURIComponent(key)}=${encodeURIComponent(val)}`;
  }
};

const getPaypalApiBases = ({ gatewayRuntime = null } = {}) => {
  const paypalConfig = asPlainObject(gatewayRuntime?.resolved_config);
  const mode = toMode(
    gatewayRuntime?.active_mode ||
      paypalConfig.mode ||
      paypalConfig.environment ||
      process.env.PAYPAL_MODE ||
      'sandbox'
  );
  const override = String(
    paypalConfig.api_base_url ||
      paypalConfig.base_url ||
      paypalConfig.endpoint ||
      process.env.PAYPAL_API_BASE_URL ||
      ''
  )
    .trim()
    .replace(/\/+$/, '');
  const defaults =
    mode === 'live'
      ? ['https://api-m.paypal.com', 'https://api.paypal.com']
      : ['https://api-m.sandbox.paypal.com', 'https://api.sandbox.paypal.com'];

  const ordered = [];
  if (override) ordered.push(override);
  defaults.forEach((url) => {
    if (!ordered.includes(url)) ordered.push(url);
  });
  return ordered;
};

const isDnsLookupFailure = (error) => {
  const code = String(error?.code || error?.cause?.code || '').toUpperCase();
  return code === 'ENOTFOUND' || code === 'EAI_AGAIN';
};

const paypalFetchWithFallback = async (path, options = {}, { gatewayRuntime = null } = {}) => {
  const bases = getPaypalApiBases({ gatewayRuntime });
  let lastError = null;
  let lastResponse = null;

  for (const baseUrl of bases) {
    const url = `${baseUrl}${path}`;
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500) {
        return { response, baseUrl };
      }
      lastResponse = response;
    } catch (error) {
      lastError = error;
      if (!isDnsLookupFailure(error)) {
        throw error;
      }
    }
  }

  if (lastResponse) {
    return { response: lastResponse, baseUrl: bases[0] };
  }
  if (lastError) {
    if (isDnsLookupFailure(lastError)) {
      const err = new Error(
        'PayPal host DNS lookup failed. Configure internet/DNS on backend server or set PAYPAL_API_BASE_URL to a resolvable endpoint.'
      );
      err.status = 503;
      err.code = 'PAYPAL_DNS_UNRESOLVED';
      throw err;
    }
    throw lastError;
  }
  throw new Error('PayPal request failed');
};

const getPaypalCredentials = ({ gatewayRuntime = null } = {}) => {
  const paypalConfig = asPlainObject(gatewayRuntime?.resolved_config);
  const clientId = pickFirstDefinedString([
    readConfigValue(paypalConfig, 'client_id'),
    readConfigValue(paypalConfig, 'clientId'),
    readConfigValue(paypalConfig, 'paypal_client_id'),
    process.env.PAYPAL_CLIENT_ID,
  ]);
  const secret = pickFirstDefinedString([
    readDecryptedCredential(paypalConfig, [
      'client_secret',
      'clientSecret',
      'paypal_client_secret',
      'secret',
      'secret_key',
      'credentials.client_secret',
      'credentials.clientSecret',
      'credentials.secret',
    ]),
    process.env.PAYPAL_CLIENT_SECRET,
  ]);
  if (!clientId || !secret) {
    const err = new Error('PayPal is not configured. Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET');
    err.status = 500;
    throw err;
  }
  return { clientId, secret };
};

const getPaypalAccessToken = async ({ gatewayRuntime = null } = {}) => {
  const { clientId, secret } = getPaypalCredentials({ gatewayRuntime });
  const authHeader = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const { response } = await paypalFetchWithFallback(
    '/v1/oauth2/token',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
    },
    { gatewayRuntime }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    const err = new Error(payload?.error_description || payload?.message || 'Unable to fetch PayPal access token');
    err.status = 500;
    throw err;
  }
  return String(payload.access_token);
};

const splitFullName = (fullName = '') => {
  const cleaned = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return { given_name: undefined, surname: undefined };
  const parts = cleaned.split(' ');
  if (parts.length === 1) return { given_name: cleaned, surname: 'User' };
  return {
    given_name: parts.slice(0, -1).join(' '),
    surname: parts.slice(-1).join(' '),
  };
};

const mapCountryCodeForPaypal = (country = '') => {
  const normalized = String(country || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(normalized)) return normalized;
  const map = {
    INDIA: 'IN',
    'UNITED STATES': 'US',
    USA: 'US',
    'UNITED KINGDOM': 'GB',
    UK: 'GB',
  };
  return map[normalized] || undefined;
};

const createPaypalOrder = async ({
  accessToken,
  amount,
  currency,
  description,
  returnUrl,
  cancelUrl,
  billingAddress = {},
  billingEmail = '',
  gatewayRuntime = null,
}) => {
  const payerName = splitFullName(billingAddress?.fullName || billingAddress?.full_name || '');
  const payerCountryCode = mapCountryCodeForPaypal(billingAddress?.country);
  const payerEmail = String(billingEmail || billingAddress?.email || '').trim().toLowerCase() || undefined;

  const { response } = await paypalFetchWithFallback(
    '/v2/checkout/orders',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: String(currency || 'USD').toUpperCase(),
              value: Number(amount || 0).toFixed(2),
            },
            description: String(description || 'TeamChatX Billing'),
          },
        ],
        payer: {
          name: {
            given_name: payerName.given_name,
            surname: payerName.surname,
          },
          email_address: payerEmail,
          address: {
            address_line_1: String(billingAddress?.addressLine1 || billingAddress?.address_line1 || '').trim() || undefined,
            address_line_2: String(billingAddress?.addressLine2 || billingAddress?.address_line2 || '').trim() || undefined,
            admin_area_2: String(billingAddress?.city || '').trim() || undefined,
            admin_area_1: String(billingAddress?.state || '').trim() || undefined,
            postal_code: String(billingAddress?.postalCode || billingAddress?.postal_code || '').trim() || undefined,
            country_code: payerCountryCode,
          },
        },
        application_context: {
          return_url: returnUrl,
          cancel_url: cancelUrl,
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING',
        },
      }),
    },
    { gatewayRuntime }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.id) {
    const detailMessages = Array.isArray(payload?.details)
      ? payload.details
        .map((item) =>
          [String(item?.issue || '').trim(), String(item?.description || '').trim()]
            .filter(Boolean)
            .join(': ')
        )
        .filter(Boolean)
      : [];
    const message =
      detailMessages[0] ||
      String(payload?.message || '').trim() ||
      'Unable to create PayPal order';
    const err = new Error(message);
    err.status = Number(response.status || 400);
    err.code = String(payload?.name || '').trim() || null;
    err.debugId = String(payload?.debug_id || '').trim() || null;
    err.details = Array.isArray(payload?.details) ? payload.details : [];
    throw err;
  }
  return payload;
};

const getPaypalOrder = async ({ accessToken, orderId, gatewayRuntime = null }) => {
  const { response } = await paypalFetchWithFallback(
    `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    },
    { gatewayRuntime }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.id) {
    const err = new Error(payload?.message || 'Unable to retrieve PayPal order');
    err.status = 400;
    throw err;
  }
  return payload;
};

const capturePaypalOrder = async ({ accessToken, orderId, gatewayRuntime = null }) => {
  const { response } = await paypalFetchWithFallback(
    `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'return=representation',
      },
      body: '{}',
    },
    { gatewayRuntime }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.id) {
    const detailMessages = Array.isArray(payload?.details)
      ? payload.details
        .map((item) =>
          [String(item?.issue || '').trim(), String(item?.description || '').trim()]
            .filter(Boolean)
            .join(': ')
        )
        .filter(Boolean)
      : [];
    const message =
      detailMessages[0] ||
      String(payload?.message || '').trim() ||
      'Unable to capture PayPal order';
    const err = new Error(message);
    err.status = Number(response.status || 400);
    err.code = String(payload?.name || '').trim() || null;
    err.debugId = String(payload?.debug_id || '').trim() || null;
    err.details = Array.isArray(payload?.details) ? payload.details : [];
    throw err;
  }
  return payload;
};

const enqueueBillingActivityLog = ({
  req,
  organizationId,
  actor = null,
  requestMeta = null,
  targetType,
  targetId = null,
  action,
  subtype,
  description,
  newValues = null,
  oldValues = null,
  errorMessage = null,
  isSuccessful = true,
  status = 'success',
  context = 'billing.activity_log',
} = {}) => {
  if (!organizationId || !targetType || !action) return;
  const resolvedActor = actor || buildActorFromRequest(req, { context_organization_id: organizationId });
  const resolvedRequestMeta = requestMeta || buildRequestMeta(req);
  const payload = {
    ...resolvedActor,
    ...resolvedRequestMeta,
    context_organization_id: organizationId,
    target_type: targetType,
    target_id: targetId,
    action,
    action_category: 'billing',
    action_subtype: subtype || null,
    description: description || null,
    old_values: oldValues,
    new_values: newValues ? {
      ...newValues,
      ...(errorMessage ? { error_message: errorMessage } : {}),
    } : (errorMessage ? { error_message: errorMessage } : null),
    is_successful: isSuccessful,
    status,
  };

  runInBackground(logActivitySafe(payload), context);
};

const calculateQuote = async ({ plan, userCount, cycle, currency }) => {
  const planCurrency = normalizeCurrency(plan?.default_currency || process.env.BILLING_CURRENCY_DEFAULT || 'INR');
  const perUserMonthlyInPlanCurrency = toNumber(plan?.price, 0);
  const periodMonths = getPeriodMonths(cycle);
  const perUserCycleInPlanCurrency = Number((perUserMonthlyInPlanCurrency * periodMonths).toFixed(4));
  const subTotalInPlanCurrency = Number((perUserCycleInPlanCurrency * userCount).toFixed(4));
  const requestedCurrency = normalizeCurrency(currency || planCurrency);
  const perUserMonthly = Number(
    (await convertAmount(perUserMonthlyInPlanCurrency, planCurrency, requestedCurrency)).toFixed(2)
  );
  const perUserCycle = Number(
    (await convertAmount(perUserCycleInPlanCurrency, planCurrency, requestedCurrency)).toFixed(2)
  );
  const subTotal = Number((await convertAmount(subTotalInPlanCurrency, planCurrency, requestedCurrency)).toFixed(2));

  return {
    currency: requestedCurrency,
    plan_currency: planCurrency,
    period_months: periodMonths,
    per_user_monthly: perUserMonthly,
    per_user_cycle: perUserCycle,
    subtotal: subTotal,
    total: subTotal,
  };
};

const resolveCouponDiscount = async ({ coupon, subtotal, quoteCurrency }) => {
  if (!coupon) {
    return {
      discount_amount: 0,
      discount_label: null,
      coupon: null,
    };
  }

  const now = new Date();
  if (String(coupon.status || '').toLowerCase() !== 'active') {
    const err = new Error('Coupon is inactive');
    err.status = 400;
    throw err;
  }

  if (coupon.valid_from && new Date(coupon.valid_from).getTime() > now.getTime()) {
    const err = new Error('Coupon is not valid yet');
    err.status = 400;
    throw err;
  }
  if (coupon.valid_to && new Date(coupon.valid_to).getTime() < now.getTime()) {
    const err = new Error('Coupon has expired');
    err.status = 400;
    throw err;
  }
  if (coupon.max_uses !== null && coupon.max_uses !== undefined) {
    if (Number(coupon.used_count || 0) >= Number(coupon.max_uses)) {
      const err = new Error('Coupon usage limit reached');
      err.status = 400;
      throw err;
    }
  }

  const discountCurrency = normalizeCurrency(quoteCurrency || process.env.BILLING_CURRENCY_DEFAULT || 'INR');
  const subtotalInDiscountCurrency = Number(toNumber(subtotal, 0).toFixed(2));
  const minOrder = toNumber(coupon.min_order_amount, 0);
  if (minOrder > 0 && subtotalInDiscountCurrency < minOrder) {
    const err = new Error(`Coupon requires minimum order ${minOrder} ${discountCurrency}`);
    err.status = 400;
    throw err;
  }

  const type = String(coupon.discount_type || '').toLowerCase();
  const value = toNumber(coupon.discount_value, 0);
  let discountInQuoteCurrency = 0;

  if (type === 'percent') {
    discountInQuoteCurrency = Number((subtotalInDiscountCurrency * (value / 100)).toFixed(2));
    const maxDiscount = toNumber(coupon.max_discount_amount, 0);
    if (maxDiscount > 0) {
      discountInQuoteCurrency = Math.min(discountInQuoteCurrency, maxDiscount);
    }
  } else {
    // Fixed coupon value is interpreted in the selected checkout currency.
    discountInQuoteCurrency = value;
  }

  discountInQuoteCurrency = Math.max(0, Math.min(discountInQuoteCurrency, subtotalInDiscountCurrency));

  return {
    discount_amount: discountInQuoteCurrency,
    discount_label: `${String(coupon.coupon_code || '').toUpperCase()} applied`,
    coupon: {
      coupon_id: coupon.coupon_id,
      coupon_code: String(coupon.coupon_code || '').toUpperCase(),
      discount_type: type,
      discount_value: value,
    },
  };
};

const parseCheckoutInput = async (req) => {
  const planId = toNumber(req.body?.plan_id, 0);
  const userCount = Math.max(toNumber(req.body?.user_count, 1), 1);
  const cycle = String(req.body?.cycle || 'month').trim().toLowerCase();
  const country = String(req.body?.country || '').trim();
  const couponCode = String(req.body?.coupon_code || '').trim().toUpperCase();

  if (!planId) {
    const err = new Error('plan_id is required');
    err.status = 400;
    throw err;
  }
  if (!['month', 'year'].includes(cycle)) {
    const err = new Error('cycle must be month or year');
    err.status = 400;
    throw err;
  }

  const plan = await billingModel.findPlanById(planId);
  if (!plan) {
    const err = new Error('Plan not found');
    err.status = 404;
    throw err;
  }
  if (String(plan.status || '').toLowerCase() !== 'active') {
    const err = new Error('Selected plan is not active');
    err.status = 400;
    throw err;
  }

  const currency = normalizeCurrency(req.body?.currency || plan.default_currency || 'INR');
  const quote = await calculateQuote({ plan, userCount, cycle, currency });
  let coupon = null;
  let discount_amount = 0;
  let discount_label = null;
  let couponSummary = null;
  if (couponCode) {
    coupon = await couponModel.findByCode(couponCode);
    if (!coupon) {
      const err = new Error('Invalid coupon code');
      err.status = 400;
      throw err;
    }
    const resolved = await resolveCouponDiscount({
      coupon,
      subtotal: quote.subtotal,
      quoteCurrency: quote.currency,
    });
    discount_amount = resolved.discount_amount;
    discount_label = resolved.discount_label;
    couponSummary = resolved.coupon;
  }

  const totalAfterDiscount = Number(Math.max(quote.total - discount_amount, 0).toFixed(2));
  const finalQuote = {
    ...quote,
    discount_amount,
    discount_label,
    total_before_discount: quote.total,
    total: totalAfterDiscount,
    coupon: couponSummary,
  };
  return {
    planId,
    plan,
    userCount,
    cycle,
    currency,
    country,
    couponCode,
    coupon,
    quote: finalQuote,
  };
};

const normalizeBillingAddressPayload = (input = {}) => ({
  fullName: String(input.full_name || input.fullName || '').trim(),
  companyName: String(input.company || input.company_name || '').trim(),
  email: String(input.email || '').trim().toLowerCase(),
  mobile: String(input.mobile || '').trim(),
  addressLine1: String(input.address_line1 || input.addressLine1 || '').trim(),
  addressLine2: String(input.address_line2 || input.addressLine2 || '').trim(),
  city: String(input.city || '').trim(),
  state: String(input.state || '').trim(),
  postalCode: String(input.postal_code || input.postalCode || '').trim(),
  country: String(input.country || '').trim(),
  countryId: toNumber(input.country_id || input.countryId, 0) || null,
  stateId: toNumber(input.state_id || input.stateId, 0) || null,
});

const validateBillingAddressPayload = (address) => {
  if (!address.fullName) {
    const err = new Error('full_name is required');
    err.status = 400;
    throw err;
  }
  if (!address.email) {
    const err = new Error('email is required');
    err.status = 400;
    throw err;
  }
  if (!address.addressLine1) {
    const err = new Error('address_line1 is required');
    err.status = 400;
    throw err;
  }
  if (!address.city) {
    const err = new Error('city is required');
    err.status = 400;
    throw err;
  }
  if (!address.country) {
    const err = new Error('country is required');
    err.status = 400;
    throw err;
  }
};

const createQuote = async (req, res, next) => {
  try {
    const { plan, userCount, cycle, quote } = await parseCheckoutInput(req);
    return success(
      res,
      {
        plan_id: plan.plan_id,
        plan_name: plan.plan_name,
        user_count: userCount,
        cycle,
        ...quote,
      },
      'Billing quote calculated',
    );
  } catch (error) {
    return next(error);
  }
};

const resolveEnabledGateways = async () => {
  try {
    const rows = await billingModel.listEnabledPaymentGateways();
    const mapped = Array.isArray(rows)
      ? rows.map((row) => ({
        ...row,
        config_json: sanitizeSensitiveConfig(asPlainObject(row?.config_json)),
      }))
      : [];
    if (mapped.length) return mapped;
  } catch {
    // fallback below
  }
  return [
    {
      gateway_key: 'stripe',
      gateway_name: 'Stripe',
      provider: 'stripe',
      is_enabled: true,
      status: 'active',
      display_order: 1,
      config_json: {},
    },
  ];
};

const getPaymentGateways = async (req, res, next) => {
  try {
    const rows = await resolveEnabledGateways();
    return success(
      res,
      {
        count: rows.length,
        rows,
      },
      'Billing payment gateways retrieved'
    );
  } catch (error) {
    return next(error);
  }
};

const createCheckoutSession = async (req, res, next) => {
  let failedContext = null;
  try {
    const organizationId = toNumber(req.user?.org, 0);
    const actorId = toNumber(req.user?.sub, 0);
    if (!organizationId || !actorId) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organizationId });

    const { planId, plan, userCount, cycle, currency, country, couponCode, coupon, quote } =
      await parseCheckoutInput(req);
    const requestedGateway = normalizeGatewayKey(req.body?.gateway || 'stripe');
    const enabledGateways = await resolveEnabledGateways();
    const enabledGatewayKeys = new Set(enabledGateways.map((row) => normalizeGatewayKey(row?.gateway_key)));
    if (!enabledGatewayKeys.has(requestedGateway)) {
      const err = new Error(`${requestedGateway} gateway is disabled by owner`);
      err.status = 400;
      throw err;
    }
    const gatewayRuntime = await resolveGatewayRuntimeConfig(requestedGateway);

    const billingType = String(req.body?.billing_type || '').trim().toLowerCase() || 'upgrade';
    const address = normalizeBillingAddressPayload(req.body?.address || {});
    validateBillingAddressPayload(address);
    const billingEmail = String(req.body?.billing_email || req.body?.email || '').trim().toLowerCase();
    failedContext = {
      organizationId,
      gateway: requestedGateway,
      planId,
      amount: quote.total,
      currency,
      periodMonths: quote.period_months,
      userCount,
      billingType: billingType || 'upgrade',
      couponCode: couponCode || null,
      discountAmount: toNumber(quote.discount_amount, 0),
      country: address.country || country || null,
      state: address.state || null,
      city: address.city || null,
      postalCode: address.postalCode || null,
      billingName: address.fullName || null,
      billingEmail: billingEmail || address.email || null,
      companyName: address.companyName || null,
      addressLine1: address.addressLine1 || null,
      gatewayMode: gatewayRuntime?.active_mode || null,
      gatewayAccountId: gatewayRuntime?.active_account_id || null,
    };

    await billingModel.saveDefaultBillingAddressForOrganization({
      organizationId,
      actorUserId: actorId,
      fullName: address.fullName,
      companyName: address.companyName,
      email: address.email,
      mobile: address.mobile,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      countryId: address.countryId,
      stateId: address.stateId,
    });

    const organization = await billingModel.findOrganizationById(organizationId);
    const frontendOrigin = String(process.env.FRONTEND_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:5173').trim();
    const successUrl = String(
      req.body?.success_url || `${frontendOrigin}/app/billing/thank-you?session_id={CHECKOUT_SESSION_ID}`
    ).trim();
    const cancelUrl = String(req.body?.cancel_url || `${frontendOrigin}/app/admin?billing_checkout=cancel`).trim();

    const checkoutMetadata = compactMetadata({
      organization_id: organizationId,
      organization_name: organization?.name || '',
      user_id: actorId,
      plan_id: planId,
      plan_key: plan.plan_key,
      plan_name: plan.plan_name,
      plan_default_currency: plan.default_currency,
      user_count: userCount,
      cycle,
      currency,
      country,
      period_months: quote.period_months,
      per_user_monthly: quote.per_user_monthly,
      per_user_cycle: quote.per_user_cycle,
      subtotal: quote.subtotal,
      total_before_discount: quote.total_before_discount ?? quote.total,
      total: quote.total,
      discount_amount: quote.discount_amount || 0,
      coupon_code: couponCode || '',
      coupon_id: coupon?.coupon_id ? String(coupon.coupon_id) : '',
      billing_type: ['upgrade', 'renewal'].includes(billingType) ? billingType : 'upgrade',
      billing_email: (billingEmail || address.email || '').slice(0, 255),
      billing_name: String(address.fullName || '').slice(0, 80),
      billing_company: String(address.companyName || '').slice(0, 120),
      billing_mobile: String(address.mobile || '').slice(0, 30),
      billing_address_line1: String(address.addressLine1 || '').slice(0, 255),
      billing_address_line2: String(address.addressLine2 || '').slice(0, 255),
      billing_country: String(address.country || country || '').slice(0, 50),
      billing_state: String(address.state || '').slice(0, 80),
      billing_city: String(address.city || '').slice(0, 50),
      billing_postal_code: String(address.postalCode || '').slice(0, 30),
      billing_country_id: address.countryId || '',
      billing_state_id: address.stateId || '',
      max_users: plan.max_users,
      max_storage_mb: plan.max_storage_mb,
      gateway: requestedGateway,
      gateway_mode: gatewayRuntime?.active_mode || '',
      gateway_account_id: gatewayRuntime?.active_account_id || '',
      gateway_account_label: gatewayRuntime?.active_account_label || '',
      success_url: successUrl,
      cancel_url: cancelUrl,
      failed_payment_id: req.body?.failed_payment_id ? String(req.body.failed_payment_id) : '',
    });

    if (requestedGateway === 'paypal') {
      const paypalAccessToken = await getPaypalAccessToken({ gatewayRuntime });
      const paypalSuccessUrl = appendQueryParam(successUrl.replace('{CHECKOUT_SESSION_ID}', ''), 'gateway', 'paypal');
      const paypalCancelUrl = appendQueryParam(cancelUrl, 'gateway', 'paypal');
      const paypalDescription = `${plan.plan_name} ${cycle === 'year' ? 'Yearly' : 'Monthly'} | ${organization?.name || 'Organization'}`;
      let paypalCurrency = String(currency || 'USD').toUpperCase();
      let paypalAmount = Number(toNumber(quote.total, 0).toFixed(2));
      let paypalOrder;

      try {
        paypalOrder = await createPaypalOrder({
          accessToken: paypalAccessToken,
          amount: paypalAmount,
          currency: paypalCurrency,
          description: paypalDescription,
          returnUrl: paypalSuccessUrl,
          cancelUrl: paypalCancelUrl,
          billingAddress: address,
          billingEmail,
          gatewayRuntime,
        });
      } catch (paypalError) {
        const statusCode = Number(paypalError?.status || 0);
        const isBusinessValidation = statusCode === 400 || statusCode === 422;
        const detailsText = Array.isArray(paypalError?.details)
          ? paypalError.details
            .map((item) => `${String(item?.issue || '')} ${String(item?.description || '')}`.trim().toLowerCase())
            .join(' | ')
          : '';
        const messageText = String(paypalError?.message || '').toLowerCase();
        const likelyCurrencyIssue =
          detailsText.includes('currency') ||
          detailsText.includes('unprocess') ||
          detailsText.includes('semantic') ||
          messageText.includes('currency') ||
          messageText.includes('unprocess') ||
          messageText.includes('semantic');

        if (isBusinessValidation && paypalCurrency !== 'USD' && likelyCurrencyIssue) {
          const converted = await convertAmount(paypalAmount, paypalCurrency, 'USD');
          paypalCurrency = 'USD';
          paypalAmount = Number(Math.max(toNumber(converted, paypalAmount), 0.01).toFixed(2));
          checkoutMetadata.paypal_fallback = 'currency_to_usd';
          checkoutMetadata.paypal_original_currency = String(currency || '').toUpperCase();
          checkoutMetadata.paypal_original_amount = String(Number(toNumber(quote.total, 0).toFixed(2)));
          checkoutMetadata.paypal_retry_currency = 'USD';
          checkoutMetadata.paypal_retry_amount = String(paypalAmount);

          paypalOrder = await createPaypalOrder({
            accessToken: paypalAccessToken,
            amount: paypalAmount,
            currency: paypalCurrency,
            description: paypalDescription,
            returnUrl: paypalSuccessUrl,
            cancelUrl: paypalCancelUrl,
            billingAddress: address,
            billingEmail,
            gatewayRuntime,
          });
        } else {
          throw paypalError;
        }
      }
      const approvalUrl =
        (Array.isArray(paypalOrder?.links)
          ? (
            paypalOrder.links.find((link) => {
              const rel = String(link?.rel || '').toLowerCase();
              return rel === 'approve' || rel === 'payer-action';
            })?.href ||
            paypalOrder.links.find((link) => Boolean(String(link?.href || '').trim()))?.href
          )
          : null) || '';
      if (!approvalUrl) {
        const err = new Error('PayPal approval URL missing in response');
        err.status = 500;
        throw err;
      }

      await billingModel.upsertBillingCheckoutSession({
        sessionId: paypalOrder.id,
        gateway: 'paypal',
        organizationId,
        actorUserId: actorId,
        amount: paypalAmount,
        currencyCode: paypalCurrency,
        status: 'pending',
        metadata: checkoutMetadata,
      });

      enqueueBillingActivityLog({
        req,
        organizationId,
        actor,
        requestMeta,
        targetType: 'billing_checkout',
        targetId: paypalOrder.id,
        action: 'billing.checkout.create',
        subtype: 'billing_checkout_session_create',
        description: `PayPal checkout order created for plan ${plan.plan_name}`,
        newValues: {
          gateway: 'paypal',
          session_id: paypalOrder.id,
          plan_id: planId,
          plan_name: plan.plan_name,
          user_count: userCount,
          cycle,
          currency: paypalCurrency,
          amount_total: paypalAmount,
          billing_type: billingType,
        },
        context: 'billing.checkout.create.activity_log',
      });

      return success(
        res,
        {
          gateway: 'paypal',
          checkout_url: approvalUrl,
          session_id: paypalOrder.id,
          amount_total: paypalAmount,
          currency: paypalCurrency,
        },
        'PayPal checkout order created',
        201
      );
    }

    const stripe = getStripeClient({ gatewayRuntime });
    const unitAmountMinor = Math.max(Math.round(toNumber(quote.total, 0) * 100), 1);
    const stripeDescription =
      `${plan.plan_name} ${cycle === 'year' ? 'Yearly' : 'Monthly'} | ` +
      `${organization?.name || 'Organization'} | ` +
      `${userCount} user${userCount > 1 ? 's' : ''}`;

    const stripeCustomerPayload = await buildStripeCustomerPayload({
      address,
      billingEmail: req.body?.email || billingEmail || address.email,
      stripeMetadata: checkoutMetadata,
    });
    const reusableCustomer = await findReusableStripeCustomer(stripe, {
      billingEmail: stripeCustomerPayload.email,
      organizationId,
    });
    const stripeCustomer = reusableCustomer
      ? await stripe.customers.update(reusableCustomer.id, stripeCustomerPayload)
      : await stripe.customers.create(stripeCustomerPayload);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: `org-${organizationId}-user-${actorId}-${Date.now()}`,
      payment_method_types: ['card'],
      customer: stripeCustomer.id,
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: false },
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      saved_payment_method_options: {
        payment_method_save: 'enabled',
        payment_method_remove: 'enabled',
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: unitAmountMinor,
            product_data: {
              name: `${plan.plan_name} (${cycle === 'year' ? 'Yearly' : 'Monthly'})`,
              description: `${userCount} users, ${quote.period_months} month(s), per-user base applied`,
            },
          },
        },
      ],
      metadata: checkoutMetadata,
      payment_intent_data: {
        description: stripeDescription,
        metadata: checkoutMetadata,
      },
    });

    await billingModel.upsertBillingCheckoutSession({
      sessionId: session.id,
      gateway: 'stripe',
      organizationId,
      actorUserId: actorId,
      amount: quote.total,
      currencyCode: currency,
      status: 'pending',
      metadata: checkoutMetadata,
    });

    enqueueBillingActivityLog({
      req,
      organizationId,
      actor,
      requestMeta,
      targetType: 'billing_checkout',
      targetId: session.id,
      action: 'billing.checkout.create',
      subtype: 'billing_checkout_session_create',
      description: `Stripe checkout session created for plan ${plan.plan_name}`,
      newValues: {
        gateway: 'stripe',
        session_id: session.id,
        plan_id: planId,
        plan_name: plan.plan_name,
        user_count: userCount,
        cycle,
        currency,
        amount_total: quote.total,
        billing_type: billingType,
      },
      context: 'billing.checkout.create.activity_log',
    });

    return success(
      res,
      {
        gateway: 'stripe',
        checkout_url: session.url,
        session_id: session.id,
        amount_total: quote.total,
        currency,
      },
      'Stripe checkout session created',
      201
    );
  } catch (error) {
    if (failedContext && !error.__billing_payment_logged) {
      try {
        const failedPayment = await billingModel.createPaymentHistory({
          organizationId: failedContext.organizationId,
          subscriptionId: null,
          planId: failedContext.planId,
          amount: toNumber(failedContext.amount, 0),
          paymentStatus: 'failed',
          invoiceNumber: null,
          transactionId: null,
          paymentMethod: `${failedContext.gateway || 'stripe'}:init-failed`,
          currencyCode: failedContext.currency,
          periodMonths: failedContext.periodMonths,
          userCount: failedContext.userCount,
          billingType: failedContext.billingType,
          couponCode: failedContext.couponCode,
          discountAmount: failedContext.discountAmount,
          country: failedContext.country,
          state: failedContext.state,
          city: failedContext.city,
          postalCode: failedContext.postalCode,
          billingName: failedContext.billingName,
          billingEmail: failedContext.billingEmail,
          companyName: failedContext.companyName,
          addressLine1: failedContext.addressLine1,
          failureReason: buildFailureReason({
            stage: 'checkout_session_create',
            message: error?.message || 'Unable to initialize checkout session',
            code: error?.code,
            type: error?.type,
          }),
        });
        enqueueBillingActivityLog({
          req,
          organizationId: failedContext.organizationId,
          targetType: 'payment',
          targetId: failedPayment?.payment_id || null,
          action: 'billing.checkout.create',
          subtype: 'billing_checkout_session_create_failed',
          description: `Billing checkout session creation failed for plan ${failedContext.planId || '-'}`,
          newValues: {
            payment_id: failedPayment?.payment_id || null,
            invoice_number: failedPayment?.invoice_number || null,
            gateway: failedContext.gateway || 'stripe',
            plan_id: failedContext.planId,
            user_count: failedContext.userCount,
            currency: failedContext.currency,
            amount_total: failedContext.amount,
            billing_type: failedContext.billingType,
          },
          errorMessage: error?.message || 'Unable to initialize checkout session',
          isSuccessful: false,
          status: 'failed',
          context: 'billing.checkout.create_failed.activity_log',
        });
      } catch {
        // no-op
      }
    }
    return next(error);
  }
};

const getBillingAddress = async (req, res, next) => {
  try {
    const organizationId = toNumber(req.user?.org, 0);
    if (!organizationId) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
    const address = await billingModel.getDefaultBillingAddressByOrganization(organizationId);
    return success(res, address, 'Billing address retrieved');
  } catch (error) {
    return next(error);
  }
};

const getBillingAddresses = async (req, res, next) => {
  try {
    const organizationId = toNumber(req.user?.org, 0);
    if (!organizationId) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
    const limit = Math.min(Math.max(toNumber(req.query.limit, 2), 1), 10);
    const rows = await billingModel.listRecentBillingAddressesByOrganization(organizationId, limit);
    return success(res, { count: rows.length, rows }, 'Billing addresses retrieved');
  } catch (error) {
    return next(error);
  }
};

const upsertBillingAddress = async (req, res, next) => {
  try {
    const organizationId = toNumber(req.user?.org, 0);
    const actorId = toNumber(req.user?.sub, 0);
    if (!organizationId || !actorId) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }

    const address = normalizeBillingAddressPayload(req.body || {});
    validateBillingAddressPayload(address);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organizationId });

    const saved = await billingModel.saveDefaultBillingAddressForOrganization({
      organizationId,
      actorUserId: actorId,
      fullName: address.fullName,
      companyName: address.companyName,
      email: address.email,
      mobile: address.mobile,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      countryId: address.countryId,
      stateId: address.stateId,
      createNew: Boolean(req.body?.create_new || req.body?.createNew),
    });

    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organizationId,
      target_type: 'billing_address',
      target_id: saved?.billing_address_id || null,
      action: 'billing.address.save',
      action_category: 'billing',
      action_subtype: Boolean(req.body?.create_new || req.body?.createNew)
        ? 'billing_address_create'
        : 'billing_address_update',
      description: `Billing address saved for organization ${organizationId}`,
      new_values: {
        billing_address_id: saved?.billing_address_id || null,
        full_name: saved?.full_name || null,
        email: saved?.email || null,
        mobile: saved?.mobile || null,
        country: saved?.country || null,
        state: saved?.state || null,
        city: saved?.city || null,
        postal_code: saved?.postal_code || null,
      },
      is_successful: true,
      status: 'success',
    });

    return success(res, saved, 'Billing address saved');
  } catch (error) {
    return next(error);
  }
};

const confirmCheckoutSession = async (req, res, next) => {
  try {
    const organizationId = toNumber(req.user?.org, 0);
    if (!organizationId) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organizationId });

    const sessionId = String(req.body?.session_id || '').trim();
    if (!sessionId) {
      const err = new Error('session_id is required');
      err.status = 400;
      throw err;
    }
    const checkoutRecord = await billingModel.findBillingCheckoutSessionBySessionId(sessionId);
    const gateway = normalizeGatewayKey(req.body?.gateway || checkoutRecord?.gateway || 'stripe');
    const metadataFromRecord = asPlainObject(checkoutRecord?.metadata);
    const gatewayRuntime = await resolveGatewayRuntimeConfig(gateway, {
      preferredMode: metadataFromRecord.gateway_mode || req.body?.gateway_mode || '',
      preferredAccountId: metadataFromRecord.gateway_account_id || req.body?.gateway_account_id || '',
    });
    const normalizedRecordOrgId = toNumber(checkoutRecord?.organization_id, 0);
    if (normalizedRecordOrgId && normalizedRecordOrgId !== organizationId) {
      const err = new Error('Invalid checkout session for this organization');
      err.status = 403;
      throw err;
    }

    const finalizePayment = async ({ metadata, transactionId, amountMajor, currencyCode, billingEmail }) => {
      const safeMetadata = asPlainObject(metadata);
      const sessionOrgId = toNumber(safeMetadata.organization_id, organizationId);
      if (!sessionOrgId || sessionOrgId !== organizationId) {
        const err = new Error('Invalid checkout session for this organization');
        err.status = 403;
        throw err;
      }
      const billingType = String(safeMetadata.billing_type || '').trim().toLowerCase() || 'upgrade';
      const periodMonths = Math.max(toNumber(safeMetadata.period_months, 1), 1);
      const confirmResult = await db.withTransaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(($1)::integer, hashtext(($2)::text))', [organizationId, sessionId]);
        const existingByTxn = await billingModel.findPaymentByTransactionId(transactionId, tx);
        if (existingByTxn) {
          return {
            alreadyConfirmed: true,
            payment: existingByTxn,
            subscription: null,
            planName: null,
            billingType,
          };
        }

        const planId = toNumber(safeMetadata.plan_id, 0);
        const plan = await billingModel.findPlanById(planId, tx);
        if (!plan) {
          const err = new Error('Plan not found while confirming payment');
          err.status = 404;
          throw err;
        }

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

        let subscription;
        if (latestSubscription?.subscription_id) {
          subscription = await billingModel.updateSubscriptionPlan(
            {
              subscriptionId: latestSubscription.subscription_id,
              planId: plan.plan_id,
              startDate,
              endDate,
              maxUsers: toNumber(plan.max_users, latestSubscription.max_users || 0),
              maxStorageMb: toNumber(plan.max_storage_mb, latestSubscription.max_storage_mb || 0),
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
              maxUsers: toNumber(plan.max_users, 0),
              maxStorageMb: toNumber(plan.max_storage_mb, 0),
            },
            tx
          );
        }

        const paymentMethod = `${gateway}:${String(currencyCode || safeMetadata.currency || 'INR').toUpperCase()}:${billingType}`;
        const failedPaymentId = toNumber(safeMetadata.failed_payment_id, 0);
        let paymentRecord;

        if (failedPaymentId > 0) {
          // Repay: update the original failed payment record to success
          paymentRecord = await billingModel.updatePaymentHistoryToSuccess(
            failedPaymentId,
            {
              transactionId,
              subscriptionId: subscription?.subscription_id || latestSubscription?.subscription_id || null,
              amount: amountMajor,
              paymentMethod,
              currencyCode: String(currencyCode || safeMetadata.currency || '').toUpperCase() || null,
              billingEmail: String(billingEmail || safeMetadata.billing_email || '').trim().toLowerCase() || null,
            },
            tx
          );
        }

        if (!paymentRecord) {
          try {
            paymentRecord = await billingModel.createPaymentHistory(
              {
                organizationId,
                subscriptionId: subscription?.subscription_id || latestSubscription?.subscription_id || null,
                planId: plan.plan_id,
                amount: amountMajor,
                paymentStatus: 'success',
                invoiceNumber: null,
                transactionId,
                paymentMethod,
                currencyCode: String(currencyCode || safeMetadata.currency || '').toUpperCase() || null,
                periodMonths,
                userCount: toNumber(safeMetadata.user_count, 0) || null,
                billingType: billingType || null,
                couponCode: String(safeMetadata.coupon_code || '').trim().toUpperCase() || null,
                discountAmount: toNumber(safeMetadata.discount_amount, 0) || 0,
                country: String(safeMetadata.billing_country || '').trim() || null,
                state: String(safeMetadata.billing_state || '').trim() || null,
                city: String(safeMetadata.billing_city || '').trim() || null,
                postalCode: String(safeMetadata.billing_postal_code || '').trim() || null,
                billingName: String(safeMetadata.billing_name || '').trim() || null,
                billingEmail: String(billingEmail || safeMetadata.billing_email || '').trim().toLowerCase() || null,
                companyName: String(safeMetadata.billing_company || '').trim() || null,
                addressLine1: String(safeMetadata.billing_address_line1 || '').trim() || null,
              },
              tx
            );
          } catch (insertError) {
            if (insertError?.code === '23505') {
              const duplicatePayment = await billingModel.findPaymentByTransactionId(transactionId, tx);
              if (duplicatePayment) {
                return {
                  alreadyConfirmed: true,
                  payment: duplicatePayment,
                  subscription: null,
                  planName: null,
                  billingType,
                };
              }
            }
            throw insertError;
          }
        }

        return {
          alreadyConfirmed: false,
          payment: paymentRecord,
          subscription,
          planName: plan.plan_name,
          billingType,
        };
      });

      const couponId = toNumber(safeMetadata.coupon_id, 0);
      if (!confirmResult.alreadyConfirmed && couponId > 0) {
        await couponModel.incrementUsage(couponId);
      }
      return { confirmResult, metadata: safeMetadata, billingType };
    };

    let metadata = metadataFromRecord;
    let transactionId = '';
    let amountMajor = 0;
    let currencyCode = '';
    let billingEmail = '';

    if (gateway === 'paypal') {
      const paypalAccessToken = await getPaypalAccessToken({ gatewayRuntime });
      let order = await getPaypalOrder({ accessToken: paypalAccessToken, orderId: sessionId, gatewayRuntime });
      if (String(order?.status || '').toUpperCase() !== 'COMPLETED') {
        order = await capturePaypalOrder({ accessToken: paypalAccessToken, orderId: sessionId, gatewayRuntime });
      }
      const orderStatus = String(order?.status || '').toUpperCase();
      if (orderStatus !== 'COMPLETED') {
        const failedReason = buildFailureReason({
          stage: 'checkout_confirm',
          message: 'PayPal payment is not completed',
          code: orderStatus || null,
          type: 'paypal',
          raw: { session_id: sessionId, status: orderStatus },
        });
        await billingModel.markBillingCheckoutSessionStatus(sessionId, { status: 'failed', failureReason: failedReason });
        const err = new Error('Payment is not completed');
        err.status = 400;
        throw err;
      }

      const purchaseUnit = Array.isArray(order?.purchase_units) ? order.purchase_units[0] : null;
      const capture = Array.isArray(purchaseUnit?.payments?.captures) ? purchaseUnit.payments.captures[0] : null;
      transactionId = String(capture?.id || order?.id || sessionId).trim();
      amountMajor = Number(toNumber(capture?.amount?.value || purchaseUnit?.amount?.value || metadata?.total, 0).toFixed(2));
      currencyCode = String(capture?.amount?.currency_code || purchaseUnit?.amount?.currency_code || metadata?.currency || 'USD').toUpperCase();
      billingEmail =
        String(order?.payer?.email_address || metadata?.billing_email || '').trim().toLowerCase() || '';
    } else {
      const stripe = getStripeClient({ gatewayRuntime });
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      metadata = Object.keys(metadata).length ? metadata : asPlainObject(session?.metadata);
      const paid = session && String(session.payment_status || '').toLowerCase() === 'paid';
      if (!paid) {
        const failedReason = buildFailureReason({
          stage: 'checkout_confirm',
          message: 'Payment is not completed',
          code: String(session?.status || '').trim() || null,
          type: String(session?.payment_status || '').trim() || null,
          raw: {
            session_id: sessionId,
            checkout_status: session?.status || null,
            payment_status: session?.payment_status || null,
            currency: session?.currency || metadata.currency || null,
            payment_intent: session?.payment_intent || null,
          },
        });
        await billingModel.markBillingCheckoutSessionStatus(sessionId, { status: 'failed', failureReason: failedReason });
        const failedPayment = await billingModel.createPaymentHistory({
          organizationId,
          subscriptionId: null,
          planId: toNumber(metadata.plan_id, 0) || null,
          amount: Number((toNumber(session?.amount_total, 0) / 100).toFixed(2)),
          paymentStatus: 'failed',
          invoiceNumber: null,
          transactionId: String(session?.payment_intent || session?.id || '').trim() || null,
          paymentMethod: `stripe:${String(session?.currency || metadata.currency || 'usd').toUpperCase()}:confirm-failed`,
          currencyCode: String(metadata.currency || session?.currency || '').toUpperCase() || null,
          periodMonths: Math.max(toNumber(metadata.period_months, 1), 1),
          userCount: toNumber(metadata.user_count, 0) || null,
          billingType: String(metadata.billing_type || '').trim().toLowerCase() || 'upgrade',
          couponCode: String(metadata.coupon_code || '').trim().toUpperCase() || null,
          discountAmount: toNumber(metadata.discount_amount, 0) || 0,
          country: String(metadata.billing_country || '').trim() || null,
          state: String(metadata.billing_state || '').trim() || null,
          city: String(metadata.billing_city || '').trim() || null,
          postalCode: String(metadata.billing_postal_code || '').trim() || null,
          billingName: String(metadata.billing_name || '').trim() || null,
          billingEmail: String(session?.customer_details?.email || metadata.billing_email || '').trim().toLowerCase() || null,
          companyName: String(metadata.billing_company || '').trim() || null,
          addressLine1: String(metadata.billing_address_line1 || '').trim() || null,
          failureReason: failedReason,
        });
        enqueueBillingActivityLog({
          req,
          organizationId,
          actor,
          requestMeta,
          targetType: 'payment',
          targetId: failedPayment?.payment_id || null,
          action: 'billing.checkout.confirm',
          subtype: 'billing_checkout_confirm_failed',
          description: `Billing checkout confirm failed for session ${sessionId}`,
          newValues: {
            payment_id: failedPayment?.payment_id || null,
            invoice_number: failedPayment?.invoice_number || null,
            session_id: sessionId,
            payment_status: session?.payment_status || null,
            checkout_status: session?.status || null,
          },
          errorMessage: 'Payment is not completed',
          isSuccessful: false,
          status: 'failed',
          context: 'billing.checkout.confirm_failed.activity_log',
        });
        const err = new Error('Payment is not completed');
        err.status = 400;
        throw err;
      }
      transactionId = String(session.payment_intent || session.id || '').trim();
      amountMajor = Number((toNumber(session.amount_total, 0) / 100).toFixed(2));
      currencyCode = String(metadata.currency || session.currency || '').toUpperCase() || 'USD';
      billingEmail = String(session.customer_details?.email || metadata.billing_email || '').trim().toLowerCase();
    }

    const { confirmResult, billingType } = await finalizePayment({
      metadata,
      transactionId,
      amountMajor,
      currencyCode,
      billingEmail,
    });

    await billingModel.markBillingCheckoutSessionStatus(sessionId, { status: 'confirmed' });

    if (billingEmail && !confirmResult.alreadyConfirmed) {
      const org = await billingModel.findOrganizationById(organizationId);
      const branding = await resolveMailBranding();
      const amountLabel = Number(amountMajor).toLocaleString(
        String(currencyCode).toUpperCase() === 'USD' ? 'en-US' : 'en-IN',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      );
      const discountAmountNum = Number(toNumber(metadata.discount_amount, 0).toFixed(2));
      const totalAmountNum = Number(toNumber(amountMajor, 0).toFixed(2));
      const subtotalNum = Number((totalAmountNum + Math.max(discountAmountNum, 0)).toFixed(2));
      const formatMoney = (value) =>
        Number(value || 0).toLocaleString(
          String(currencyCode).toUpperCase() === 'USD' ? 'en-US' : 'en-IN',
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        );
      const template = getBillingPaymentSuccessTemplate(
        {
          organization_name: org?.name || '',
          plan_name: confirmResult.planName || String(metadata.plan_name || '').trim() || 'Plan',
          amount_label: amountLabel,
          currency: String(currencyCode || metadata.currency || 'INR').toUpperCase(),
          user_count: metadata.user_count || '',
          cycle_label: String(metadata.period_months || '') === '12' ? 'Yearly' : 'Monthly',
          billing_type: billingType,
          invoice_number: confirmResult.payment?.invoice_number || null,
          transaction_id: transactionId,
          payment_date: new Date().toISOString(),
          billing_email: billingEmail,
          billing_name: String(metadata.billing_name || '').trim(),
          company_name: String(metadata.billing_company || '').trim(),
          billing_address_line1: String(metadata.billing_address_line1 || '').trim(),
          billing_city: String(metadata.billing_city || '').trim(),
          billing_state: String(metadata.billing_state || '').trim(),
          billing_country: String(metadata.billing_country || '').trim(),
          billing_postal_code: String(metadata.billing_postal_code || '').trim(),
          coupon_code: String(metadata.coupon_code || '').trim().toUpperCase(),
          subtotal_label: formatMoney(subtotalNum),
          discount_label: formatMoney(discountAmountNum),
          total_label: formatMoney(totalAmountNum),
        },
        { appName: branding.appName, supportEmail: branding.supportEmail }
      );
      sendMailAsync({
        to: billingEmail,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
    }

    enqueueBillingActivityLog({
      req,
      organizationId,
      actor,
      requestMeta,
      targetType: 'payment',
      targetId: confirmResult.payment?.payment_id || null,
      action: 'billing.checkout.confirm',
      subtype: confirmResult.alreadyConfirmed
        ? 'billing_checkout_confirm_duplicate'
        : 'billing_checkout_confirm_success',
      description: confirmResult.alreadyConfirmed
        ? `Billing payment already confirmed for session ${sessionId}`
        : `Billing payment confirmed successfully for session ${sessionId}`,
      newValues: {
        gateway,
        session_id: sessionId,
        invoice_number: confirmResult.payment?.invoice_number || null,
        transaction_id: confirmResult.payment?.transaction_id || transactionId,
        payment_status: confirmResult.payment?.payment_status || 'success',
        subscription_id: confirmResult.subscription?.subscription_id || null,
        plan_name: confirmResult.planName || String(metadata.plan_name || '').trim() || null,
        billing_type: billingType,
        amount_total: amountMajor,
        currency: String(currencyCode || metadata.currency || '').toUpperCase() || null,
      },
      context: 'billing.checkout.confirm_success.activity_log',
    });

    return success(
      res,
      {
        gateway,
        payment: confirmResult.payment,
        subscription: confirmResult.subscription,
      },
      confirmResult.alreadyConfirmed ? 'Payment already confirmed' : 'Checkout confirmed and subscription updated'
    );
  } catch (error) {
    return next(error);
  }
};

const getPaymentHistory = async (req, res, next) => {
  try {
    const organizationId = toNumber(req.user?.org, 0);
    if (!organizationId) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }

    const limit = Math.min(Math.max(toNumber(req.query.limit, 50), 1), 200);
    const offset = Math.max(toNumber(req.query.offset, 0), 0);
    const rows = await billingModel.listPaymentHistoryByOrganization({
      organizationId,
      limit,
      offset,
    });
    return success(res, { count: rows.length, rows }, 'Payment history retrieved');
  } catch (error) {
    return next(error);
  }
};

const getPlanComparison = async (req, res, next) => {
  try {
    const status = String(req.query.status || 'active').trim().toLowerCase();
    const rows = await billingModel.getPlanComparisonFromFeatureItems({
      status,
      limitPlans: Math.min(Math.max(toNumber(req.query.limit_plans, 20), 1), 50),
    });
    return success(res, { count: rows.length, rows }, 'Plan comparison retrieved');
  } catch (error) {
    return next(error);
  }
};

const resumeCheckoutSession = async (req, res, next) => {
  try {
    const organizationId = toNumber(req.user?.org, 0);
    if (!organizationId) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }

    const sessionId = String(req.query?.session_id || '').trim();
    if (!sessionId) {
      const err = new Error('session_id is required');
      err.status = 400;
      throw err;
    }

    const checkoutRecord = await billingModel.findBillingCheckoutSessionBySessionId(sessionId);
    if (!checkoutRecord || toNumber(checkoutRecord.organization_id, 0) !== organizationId) {
      const err = new Error('Checkout session not found');
      err.status = 404;
      throw err;
    }

    if (checkoutRecord.status !== 'pending') {
      const err = new Error(`Checkout session is already ${checkoutRecord.status}`);
      err.status = 400;
      throw err;
    }

    const gateway = normalizeGatewayKey(checkoutRecord.gateway || 'stripe');
    const metadataFromRecord = asPlainObject(checkoutRecord.metadata);
    const gatewayRuntime = await resolveGatewayRuntimeConfig(gateway, {
      preferredMode: metadataFromRecord.gateway_mode || '',
      preferredAccountId: metadataFromRecord.gateway_account_id || '',
    });

    let checkoutUrl = null;

    if (gateway === 'stripe') {
      const stripe = getStripeClient({ gatewayRuntime });
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (!session || session.status === 'expired') {
        const err = new Error('Stripe checkout session has expired. Please start a new payment.');
        err.status = 410;
        throw err;
      }
      checkoutUrl = session.url;
    } else if (gateway === 'paypal') {
      const paypalAccessToken = await getPaypalAccessToken({ gatewayRuntime });
      const order = await getPaypalOrder({ accessToken: paypalAccessToken, orderId: sessionId, gatewayRuntime });
      const approvalLink = Array.isArray(order?.links)
        ? order.links.find((l) => String(l?.rel || '').toLowerCase() === 'approve')
        : null;
      checkoutUrl = approvalLink?.href || null;
      if (!checkoutUrl) {
        const err = new Error('PayPal order approval link not found. Please start a new payment.');
        err.status = 410;
        throw err;
      }
    }

    return success(res, { checkout_url: checkoutUrl, gateway, session_id: sessionId }, 'Resume URL retrieved');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getBillingAddress,
  getBillingAddresses,
  upsertBillingAddress,
  createQuote,
  createCheckoutSession,
  confirmCheckoutSession,
  resumeCheckoutSession,
  getPaymentGateways,
  getPaymentHistory,
  getPlanComparison,
};
