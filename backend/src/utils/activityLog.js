const activityLogModel = require('../models/activityLogModel');

const normalizeIp = (rawIp) => {
  if (!rawIp) return null;
  const first = String(rawIp).split(',')[0].trim();
  if (!first) return null;
  if (first.startsWith('::ffff:')) {
    return first.slice(7);
  }
  return first;
};

const buildRequestMeta = (req = {}) => {
  const forwardedIp = req.headers?.['x-forwarded-for'];
  const ip = normalizeIp(forwardedIp || req.ip || req.socket?.remoteAddress);
  return {
    ip_address: ip,
    user_agent: req.headers?.['user-agent'] || null,
  };
};

const buildActorFromRequest = (req = {}, fallback = {}) => {
  const actorId = req.user?.sub ?? fallback.actor_id ?? null;
  const actorRoleKey = req.user?.role || req.user?.role_key || fallback.actor_role_key || 'system';
  const contextOrganizationId = req.user?.org ?? fallback.context_organization_id ?? null;

  return {
    actor_id: actorId,
    actor_role_key: actorRoleKey,
    context_organization_id: contextOrganizationId,
  };
};

const logActivitySafe = async (payload, options = {}) => {
  try {
    await activityLogModel.createActivityLog(payload, options.tx || null);
  } catch (error) {
    console.error('Failed to write activity log', error.message);
  }
};

module.exports = {
  buildRequestMeta,
  buildActorFromRequest,
  logActivitySafe,
};
