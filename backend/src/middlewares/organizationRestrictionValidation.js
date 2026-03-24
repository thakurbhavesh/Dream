const net = require('net');
const { failure } = require('../utils/response');

const STATUSES = ['active', 'inactive'];
const RESTRICTION_TYPES = ['allow', 'block'];

const isPositiveInt = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
const normalizeStatus = (value) => String(value || '').trim().toLowerCase();
const normalizeType = (value) => String(value || '').trim().toLowerCase();
const normalizeIp = (value) => String(value || '').trim();

const isValidStatus = (value) => value === undefined || STATUSES.includes(normalizeStatus(value));
const isValidRestrictionType = (value) =>
  value === undefined || RESTRICTION_TYPES.includes(normalizeType(value));
const isValidIpAddress = (value) => net.isIP(normalizeIp(value)) !== 0;

const validateCreateIpRestriction = (req, res, next) => {
  const { ip_address, status } = req.body || {};
  if (!ip_address || !isValidIpAddress(ip_address)) {
    return failure(res, 'ip_address must be a valid IPv4 or IPv6 address', 400);
  }
  if (!isValidStatus(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  req.body.ip_address = normalizeIp(ip_address);
  if (status !== undefined) req.body.status = normalizeStatus(status);
  if (req.body.note !== undefined && req.body.note !== null) req.body.note = String(req.body.note).trim();
  return next();
};

const validatePutIpRestriction = (req, res, next) => {
  const { ip_address, status } = req.body || {};
  if (!ip_address || !isValidIpAddress(ip_address)) {
    return failure(res, 'ip_address must be a valid IPv4 or IPv6 address', 400);
  }
  if (!isValidStatus(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  req.body.ip_address = normalizeIp(ip_address);
  req.body.status = status !== undefined ? normalizeStatus(status) : 'active';
  if (req.body.note !== undefined && req.body.note !== null) req.body.note = String(req.body.note).trim();
  return next();
};

const validatePatchIpRestriction = (req, res, next) => {
  const body = req.body || {};
  const hasAny = body.ip_address !== undefined || body.status !== undefined || body.note !== undefined;
  if (!hasAny) return failure(res, 'At least one field is required for patch', 400);

  if (body.ip_address !== undefined && !isValidIpAddress(body.ip_address)) {
    return failure(res, 'ip_address must be a valid IPv4 or IPv6 address', 400);
  }
  if (!isValidStatus(body.status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  if (body.ip_address !== undefined) req.body.ip_address = normalizeIp(body.ip_address);
  if (body.status !== undefined) req.body.status = normalizeStatus(body.status);
  if (body.note !== undefined && body.note !== null) req.body.note = String(body.note).trim();
  return next();
};

const validateCreatePlatformRestriction = (req, res, next) => {
  const { platform_id, restriction_type, status } = req.body || {};
  if (!isPositiveInt(platform_id)) {
    return failure(res, 'platform_id must be a positive integer', 400);
  }
  if (!restriction_type || !isValidRestrictionType(restriction_type)) {
    return failure(res, 'restriction_type must be allow or block', 400);
  }
  if (!isValidStatus(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  req.body.platform_id = Number(platform_id);
  req.body.restriction_type = normalizeType(restriction_type);
  if (status !== undefined) req.body.status = normalizeStatus(status);
  if (req.body.note !== undefined && req.body.note !== null) req.body.note = String(req.body.note).trim();
  return next();
};

const validatePutPlatformRestriction = (req, res, next) => {
  const { platform_id, restriction_type, status } = req.body || {};
  if (!isPositiveInt(platform_id)) {
    return failure(res, 'platform_id must be a positive integer', 400);
  }
  if (!restriction_type || !isValidRestrictionType(restriction_type)) {
    return failure(res, 'restriction_type must be allow or block', 400);
  }
  if (!isValidStatus(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  req.body.platform_id = Number(platform_id);
  req.body.restriction_type = normalizeType(restriction_type);
  req.body.status = status !== undefined ? normalizeStatus(status) : 'active';
  if (req.body.note !== undefined && req.body.note !== null) req.body.note = String(req.body.note).trim();
  return next();
};

const validatePatchPlatformRestriction = (req, res, next) => {
  const body = req.body || {};
  const hasAny =
    body.platform_id !== undefined ||
    body.restriction_type !== undefined ||
    body.status !== undefined ||
    body.note !== undefined;

  if (!hasAny) return failure(res, 'At least one field is required for patch', 400);
  if (body.platform_id !== undefined && !isPositiveInt(body.platform_id)) {
    return failure(res, 'platform_id must be a positive integer', 400);
  }
  if (!isValidRestrictionType(body.restriction_type)) {
    return failure(res, 'restriction_type must be allow or block', 400);
  }
  if (!isValidStatus(body.status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  if (body.platform_id !== undefined) req.body.platform_id = Number(body.platform_id);
  if (body.restriction_type !== undefined) req.body.restriction_type = normalizeType(body.restriction_type);
  if (body.status !== undefined) req.body.status = normalizeStatus(body.status);
  if (body.note !== undefined && body.note !== null) req.body.note = String(body.note).trim();
  return next();
};

module.exports = {
  validateCreateIpRestriction,
  validatePutIpRestriction,
  validatePatchIpRestriction,
  validateCreatePlatformRestriction,
  validatePutPlatformRestriction,
  validatePatchPlatformRestriction,
};
