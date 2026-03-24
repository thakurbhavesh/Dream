const { failure } = require('../utils/response');

const normalizeText = (value) => {
  if (value === undefined || value === null) return null;
  const parsed = String(value).trim();
  return parsed || null;
};

const normalizeCountryCode = (value) => {
  const raw = normalizeText(value);
  if (!raw) return '+91';
  const normalized = raw.replace(/\s+/g, '');
  if (!/^\+[1-9]\d{0,3}$/.test(normalized)) return null;
  return normalized;
};

const normalizeMobile = (value) => {
  const raw = normalizeText(value);
  if (!raw) return null;
  const normalized = raw.replace(/[\s\-()]/g, '');
  if (!/^\d{6,15}$/.test(normalized)) return null;
  return normalized;
};

const validateCreateContactRequest = (req, res, next) => {
  try {
    const body = req.body || {};

    const name = normalizeText(body.name);
    const country_code = normalizeCountryCode(body.country_code);
    const mobile_number = normalizeMobile(body.mobile_number);
    const email_address = normalizeText(body.email_address);
    const company_name = normalizeText(body.company_name);
    const requirement_details = normalizeText(body.requirement_details);
    const total_users = Number(body.total_users);

    if (!name) return failure(res, 'name is required', 400);
    if (!mobile_number) return failure(res, 'mobile_number is required', 400);
    if (!country_code) return failure(res, 'country_code must be like +91 or +1', 400);
    if (!email_address) return failure(res, 'email_address is required', 400);
    if (!company_name) return failure(res, 'company_name is required', 400);
    if (!Number.isInteger(total_users) || total_users <= 0) {
      return failure(res, 'total_users must be a positive integer', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email_address)) {
      return failure(res, 'email_address must be valid', 400);
    }

    req.body = {
      name,
      country_code,
      mobile_number,
      email_address: email_address.toLowerCase(),
      company_name,
      total_users,
      requirement_details,
    };

    return next();
  } catch (error) {
    return failure(res, error.message || 'Invalid request payload', error.status || 400);
  }
};

module.exports = {
  validateCreateContactRequest,
};
