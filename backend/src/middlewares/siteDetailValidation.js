const { failure } = require('../utils/response');

const ALLOWED_STATUS = ['active', 'inactive'];

const isNil = (value) => value === undefined || value === null;

const normalizeOptionalText = (value) => {
  if (isNil(value)) return null;
  const parsed = String(value).trim();
  return parsed || null;
};

const normalizeRequiredText = (value, fieldName) => {
  const parsed = normalizeOptionalText(value);
  if (!parsed) {
    const err = new Error(`${fieldName} is required`);
    err.status = 400;
    throw err;
  }
  return parsed;
};

const normalizeStatus = (value, fallback = 'active') => {
  if (isNil(value)) return fallback;
  const status = String(value).trim().toLowerCase();
  if (!ALLOWED_STATUS.includes(status)) {
    const err = new Error('status must be active or inactive');
    err.status = 400;
    throw err;
  }
  return status;
};

const normalizeBool = (value, fallback = false) => {
  if (isNil(value)) return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes'].includes(String(value).trim().toLowerCase());
};

const validateSinglePrimary = (rows, keyName, label) => {
  const primaryCount = rows.filter((item) => item[keyName]).length;
  if (primaryCount > 1) {
    const err = new Error(`Only one ${label} can be primary`);
    err.status = 400;
    throw err;
  }
};

const normalizeEmailEntry = (entry) => {
  if (typeof entry === 'string') {
    return {
      email_address: normalizeRequiredText(entry, 'email_address'),
      label: null,
      is_primary: false,
      status: 'active',
    };
  }

  if (!entry || typeof entry !== 'object') {
    const err = new Error('emails must contain string or object items');
    err.status = 400;
    throw err;
  }

  return {
    email_address: normalizeRequiredText(entry.email_address, 'email_address'),
    label: normalizeOptionalText(entry.label),
    is_primary: normalizeBool(entry.is_primary, false),
    status: normalizeStatus(entry.status, 'active'),
  };
};

const normalizePhoneEntry = (entry) => {
  if (typeof entry === 'string') {
    return {
      phone_number: normalizeRequiredText(entry, 'phone_number'),
      label: null,
      is_primary: false,
      status: 'active',
    };
  }

  if (!entry || typeof entry !== 'object') {
    const err = new Error('phones must contain string or object items');
    err.status = 400;
    throw err;
  }

  return {
    phone_number: normalizeRequiredText(entry.phone_number, 'phone_number'),
    label: normalizeOptionalText(entry.label),
    is_primary: normalizeBool(entry.is_primary, false),
    status: normalizeStatus(entry.status, 'active'),
  };
};

const normalizeAddressEntry = (entry) => {
  if (typeof entry === 'string') {
    return {
      label: null,
      address_line_1: normalizeRequiredText(entry, 'address_line_1'),
      address_line_2: null,
      city: null,
      state: null,
      country: null,
      postal_code: null,
      is_primary: false,
      status: 'active',
    };
  }

  if (!entry || typeof entry !== 'object') {
    const err = new Error('addresses must contain string or object items');
    err.status = 400;
    throw err;
  }

  return {
    label: normalizeOptionalText(entry.label),
    address_line_1: normalizeRequiredText(entry.address_line_1, 'address_line_1'),
    address_line_2: normalizeOptionalText(entry.address_line_2),
    city: normalizeOptionalText(entry.city),
    state: normalizeOptionalText(entry.state),
    country: normalizeOptionalText(entry.country),
    postal_code: normalizeOptionalText(entry.postal_code),
    is_primary: normalizeBool(entry.is_primary, false),
    status: normalizeStatus(entry.status, 'active'),
  };
};

const normalizeEmailList = (value) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    const err = new Error('emails must be an array');
    err.status = 400;
    throw err;
  }
  const rows = value.map(normalizeEmailEntry);
  validateSinglePrimary(rows, 'is_primary', 'email');
  return rows;
};

const normalizePhoneList = (value) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    const err = new Error('phones must be an array');
    err.status = 400;
    throw err;
  }
  const rows = value.map(normalizePhoneEntry);
  validateSinglePrimary(rows, 'is_primary', 'phone');
  return rows;
};

const normalizeAddressList = (value) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    const err = new Error('addresses must be an array');
    err.status = 400;
    throw err;
  }
  const rows = value.map(normalizeAddressEntry);
  validateSinglePrimary(rows, 'is_primary', 'address');
  return rows;
};

const normalizeCommonFields = (payload = {}, { requireBrandName }) => {
  const out = {};

  if (requireBrandName || payload.brand_name !== undefined) {
    out.brand_name = requireBrandName
      ? normalizeRequiredText(payload.brand_name, 'brand_name')
      : normalizeOptionalText(payload.brand_name);
    if (!out.brand_name) {
      const err = new Error('brand_name cannot be empty');
      err.status = 400;
      throw err;
    }
  }

  if (payload.logo_url !== undefined) out.logo_url = normalizeOptionalText(payload.logo_url);
  if (payload.mascot_url !== undefined) out.mascot_url = normalizeOptionalText(payload.mascot_url);
  if (payload.google_plus_url !== undefined) out.google_plus_url = normalizeOptionalText(payload.google_plus_url);
  if (payload.linkedin_url !== undefined) out.linkedin_url = normalizeOptionalText(payload.linkedin_url);
  if (payload.twitter_url !== undefined) out.twitter_url = normalizeOptionalText(payload.twitter_url);
  if (payload.youtube_url !== undefined) out.youtube_url = normalizeOptionalText(payload.youtube_url);
  if (payload.status !== undefined || requireBrandName) {
    out.status = normalizeStatus(payload.status, 'active');
  }

  const emails = normalizeEmailList(payload.emails);
  const phones = normalizePhoneList(payload.phones);
  const addresses = normalizeAddressList(payload.addresses);

  if (emails !== undefined) out.emails = emails;
  if (phones !== undefined) out.phones = phones;
  if (addresses !== undefined) out.addresses = addresses;

  return out;
};

const validateCreateSiteDetail = (req, res, next) => {
  try {
    req.body = normalizeCommonFields(req.body || {}, { requireBrandName: true });
    return next();
  } catch (error) {
    return failure(res, error.message, error.status || 400);
  }
};

const validateUpdateSiteDetail = (req, res, next) => {
  try {
    req.body = normalizeCommonFields(req.body || {}, { requireBrandName: true });
    return next();
  } catch (error) {
    return failure(res, error.message, error.status || 400);
  }
};

const validatePatchSiteDetail = (req, res, next) => {
  try {
    const payload = req.body || {};
    if (!Object.keys(payload).length) {
      return failure(res, 'At least one field is required for patch', 400);
    }
    req.body = normalizeCommonFields(payload, { requireBrandName: false });
    return next();
  } catch (error) {
    return failure(res, error.message, error.status || 400);
  }
};

module.exports = {
  validateCreateSiteDetail,
  validateUpdateSiteDetail,
  validatePatchSiteDetail,
};
