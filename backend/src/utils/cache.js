const { redisClient } = require('../config/redis');

const cacheTtlSeconds = (() => {
  const raw = Number.parseInt(
    process.env.CACHE_TTL_SECONDS || process.env.REDIS_CACHE_TTL,
    10
  );
  if (Number.isNaN(raw) || raw <= 0) return 60;
  return raw;
})();

const resolveRequestOrg = (req = {}) => {
  const candidates = [
    req.query?.organization_id,
    req.query?.org_id,
    req.body?.organization_id,
    req.body?.org_id,
    req.user?.org,
  ];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
};

const getCacheScope = (req) => {
  const orgId = resolveRequestOrg(req);
  if (orgId) return `org:${orgId}`;
  return 'global';
};

const hasRedis = () =>
  redisClient &&
  redisClient.isOpen &&
  typeof redisClient.get === 'function' &&
  typeof redisClient.setEx === 'function';

const getVersionKey = (entity) => `cache:version:${entity}`;

const getEntityVersion = async (entity) => {
  if (!hasRedis()) return '0';

  try {
    const version = await redisClient.get(getVersionKey(entity));
    return version || '0';
  } catch {
    return '0';
  }
};

const withEntityCache = async (entity, req, loader) => {
  if (!hasRedis()) {
    return loader();
  }

  const version = await getEntityVersion(entity);
  const key = `cache:${entity}:v${version}:${getCacheScope(req)}:${req.originalUrl}`;

  try {
    const cached = await redisClient.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Continue with DB fallback.
  }

  const data = await loader();

  try {
    await redisClient.setEx(key, cacheTtlSeconds, JSON.stringify(data));
  } catch {
    // Cache write failures should not affect API responses.
  }

  return data;
};

const bumpEntityVersion = async (entity) => {
  if (!hasRedis() || typeof redisClient.incr !== 'function') return;

  try {
    await redisClient.incr(getVersionKey(entity));
  } catch {
    // Cache invalidation failures should not block writes.
  }
};

module.exports = {
  withEntityCache,
  bumpEntityVersion,
};
