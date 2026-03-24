const db = require('../config/database');

// Cache active provider for 60 seconds to avoid DB hit on every AI call
let _cache = null;
let _cacheTs = 0;
const CACHE_TTL = 60_000;

const getActiveProvider = async () => {
  if (_cache && Date.now() - _cacheTs < CACHE_TTL) return _cache;
  const { rows } = await db.query(
    `SELECT * FROM ai_providers WHERE is_active = true AND status = 'active' LIMIT 1`
  );
  _cache = rows[0] || null;
  _cacheTs = Date.now();
  return _cache;
};

const invalidateCache = () => {
  _cache = null;
  _cacheTs = 0;
};

const getAllProviders = async () => {
  const { rows } = await db.query(
    `SELECT provider_id, provider_key, display_name, model, is_active, status,
            CASE WHEN api_key != '' THEN '••••••••' ELSE '' END AS api_key_masked,
            created_at, updated_at
     FROM ai_providers ORDER BY provider_id`
  );
  return rows;
};

const getProviderById = async (id) => {
  const { rows } = await db.query('SELECT * FROM ai_providers WHERE provider_id = $1', [id]);
  return rows[0] || null;
};

const updateProvider = async (id, { api_key, model, is_active }) => {
  const sets = [];
  const values = [];
  let idx = 1;

  if (api_key !== undefined) {
    sets.push(`api_key = $${idx++}`);
    values.push(api_key);
  }
  if (model !== undefined) {
    sets.push(`model = $${idx++}`);
    values.push(model);
  }
  if (is_active !== undefined) {
    // If activating this provider, deactivate all others first
    if (is_active) {
      await db.query(`UPDATE ai_providers SET is_active = false, status = 'inactive', updated_at = NOW()`);
      sets.push(`is_active = true`);
      sets.push(`status = 'active'`);
    } else {
      sets.push(`is_active = false`);
      sets.push(`status = 'inactive'`);
    }
  }

  if (!sets.length) return null;

  sets.push('updated_at = NOW()');
  values.push(id);

  const { rows } = await db.query(
    `UPDATE ai_providers SET ${sets.join(', ')} WHERE provider_id = $${idx} RETURNING
      provider_id, provider_key, display_name, model, is_active, status,
      CASE WHEN api_key != '' THEN '••••••••' ELSE '' END AS api_key_masked,
      created_at, updated_at`,
    values
  );

  invalidateCache();
  return rows[0] || null;
};

module.exports = { getActiveProvider, getAllProviders, getProviderById, updateProvider, invalidateCache };
