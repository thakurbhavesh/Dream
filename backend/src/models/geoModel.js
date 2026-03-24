const db = require('../config/database');

const findCountries = async ({ search, limit = 300, offset = 0 } = {}) => {
  const filters = [];
  const values = [];
  let idx = 1;

  if (search) {
    filters.push(`(
      c.name ILIKE $${idx}
      OR c.iso_code ILIKE $${idx}
      OR COALESCE(c.currency_code, '') ILIKE $${idx}
    )`);
    values.push(`%${search}%`);
    idx += 1;
  }

  values.push(limit, offset);
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const { rows } = await db.query(
    `SELECT c.*, COUNT(*) OVER() AS total_count
     FROM countries c
     ${whereClause}
     ORDER BY c.name ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const cleaned = rows.map(({ total_count, ...rest }) => rest);
  return { rows: cleaned, total };
};

const findStates = async ({
  country_id,
  country_iso,
  search,
  limit = 1000,
  offset = 0,
} = {}) => {
  const filters = [];
  const values = [];
  let idx = 1;

  if (country_id) {
    filters.push(`s.country_id = $${idx}`);
    values.push(country_id);
    idx += 1;
  } else if (country_iso) {
    filters.push(`c.iso_code = $${idx}`);
    values.push(country_iso);
    idx += 1;
  }

  if (search) {
    filters.push(`(
      s.name ILIKE $${idx}
      OR COALESCE(s.iso_code, '') ILIKE $${idx}
    )`);
    values.push(`%${search}%`);
    idx += 1;
  }

  values.push(limit, offset);
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const { rows } = await db.query(
    `SELECT s.*, c.iso_code AS country_iso, c.name AS country_name, COUNT(*) OVER() AS total_count
     FROM states s
     JOIN countries c ON c.country_id = s.country_id
     ${whereClause}
     ORDER BY s.name ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const cleaned = rows.map(({ total_count, ...rest }) => rest);
  return { rows: cleaned, total };
};

const findCurrencies = async ({ search, status, limit = 200, offset = 0 } = {}) => {
  const filters = [];
  const values = [];
  let idx = 1;

  if (status) {
    filters.push(`cr.status = $${idx}`);
    values.push(status);
    idx += 1;
  }

  if (search) {
    filters.push(`(
      cr.currency_code ILIKE $${idx}
      OR cr.currency_name ILIKE $${idx}
      OR COALESCE(cr.currency_symbol, '') ILIKE $${idx}
    )`);
    values.push(`%${search}%`);
    idx += 1;
  }

  values.push(limit, offset);
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT cr.*, COUNT(*) OVER() AS total_count
     FROM currencies cr
     ${whereClause}
     ORDER BY cr.currency_code ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  const total = rows.length ? Number(rows[0].total_count) : 0;
  const cleaned = rows.map(({ total_count, ...rest }) => rest);
  return { rows: cleaned, total };
};

const findTopCountryCurrencies = async ({ search, limit = 50, offset = 0 } = {}) => {
  const filters = [`ccp.status = 'active'`, `c.status = 'active'`, `cr.status = 'active'`];
  const values = [];
  let idx = 1;

  if (search) {
    filters.push(`(
      c.name ILIKE $${idx}
      OR c.iso_code ILIKE $${idx}
      OR cr.currency_code ILIKE $${idx}
      OR cr.currency_name ILIKE $${idx}
    )`);
    values.push(`%${search}%`);
    idx += 1;
  }

  values.push(limit, offset);
  const { rows } = await db.query(
    `SELECT
       ccp.country_currency_priority_id,
       ccp.rank_order,
       c.country_id,
       c.iso_code AS country_iso_code,
       c.name AS country_name,
       c.phonecode,
       cr.currency_code,
       cr.currency_name,
       cr.currency_symbol,
       cr.decimal_places,
       COUNT(*) OVER() AS total_count
     FROM country_currency_priority ccp
     JOIN countries c ON c.iso_code = ccp.country_iso_code
     JOIN currencies cr ON cr.currency_code = ccp.currency_code
     WHERE ${filters.join(' AND ')}
     ORDER BY ccp.rank_order ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  const total = rows.length ? Number(rows[0].total_count) : 0;
  const cleaned = rows.map(({ total_count, ...rest }) => rest);
  return { rows: cleaned, total };
};

const findCountryById = async (id) => {
  const { rows } = await db.query(`SELECT * FROM countries WHERE country_id = $1`, [id]);
  return rows[0] || null;
};

const createCountry = async ({
  iso_code,
  name,
  phonecode = null,
  currency_code = null,
  currency_name = null,
  status = 'active',
}) => {
  const { rows } = await db.query(
    `INSERT INTO countries (iso_code, name, phonecode, currency_code, currency_name, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [iso_code, name, phonecode, currency_code, currency_name, status]
  );
  return rows[0];
};

const updateCountryPartial = async (id, patch = {}) => {
  const allowed = ['iso_code', 'name', 'phonecode', 'currency_code', 'currency_name', 'status'];
  const updates = [];
  const values = [];
  let idx = 1;

  for (const key of allowed) {
    if (patch[key] === undefined) continue;
    updates.push(`${key} = $${idx}`);
    values.push(patch[key]);
    idx += 1;
  }

  if (!updates.length) return null;

  values.push(id);
  const { rows } = await db.query(
    `UPDATE countries
     SET ${updates.join(', ')}, updated_at = NOW()
     WHERE country_id = $${idx}
     RETURNING *`,
    values
  );
  return rows[0] || null;
};

const findStateById = async (id) => {
  const { rows } = await db.query(`SELECT * FROM states WHERE state_id = $1`, [id]);
  return rows[0] || null;
};

const createState = async ({ country_id, iso_code = null, name, status = 'active' }) => {
  const { rows } = await db.query(
    `INSERT INTO states (country_id, iso_code, name, status)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [country_id, iso_code, name, status]
  );
  return rows[0];
};

const updateStatePartial = async (id, patch = {}) => {
  const allowed = ['country_id', 'iso_code', 'name', 'status'];
  const updates = [];
  const values = [];
  let idx = 1;

  for (const key of allowed) {
    if (patch[key] === undefined) continue;
    updates.push(`${key} = $${idx}`);
    values.push(patch[key]);
    idx += 1;
  }

  if (!updates.length) return null;

  values.push(id);
  const { rows } = await db.query(
    `UPDATE states
     SET ${updates.join(', ')}, updated_at = NOW()
     WHERE state_id = $${idx}
     RETURNING *`,
    values
  );
  return rows[0] || null;
};

const findCurrencyByCode = async (code) => {
  const { rows } = await db.query(`SELECT * FROM currencies WHERE currency_code = $1`, [code]);
  return rows[0] || null;
};

const createCurrency = async ({
  currency_code,
  currency_name,
  currency_symbol = null,
  decimal_places = 2,
  status = 'active',
}) => {
  const { rows } = await db.query(
    `INSERT INTO currencies (currency_code, currency_name, currency_symbol, decimal_places, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [currency_code, currency_name, currency_symbol, decimal_places, status]
  );
  return rows[0];
};

const updateCurrencyPartial = async (code, patch = {}) => {
  const allowed = ['currency_name', 'currency_symbol', 'decimal_places', 'status'];
  const updates = [];
  const values = [];
  let idx = 1;

  for (const key of allowed) {
    if (patch[key] === undefined) continue;
    updates.push(`${key} = $${idx}`);
    values.push(patch[key]);
    idx += 1;
  }

  if (!updates.length) return null;

  values.push(code);
  const { rows } = await db.query(
    `UPDATE currencies
     SET ${updates.join(', ')}, updated_at = NOW()
     WHERE currency_code = $${idx}
     RETURNING *`,
    values
  );
  return rows[0] || null;
};

module.exports = {
  findCountries,
  findStates,
  findCurrencies,
  findTopCountryCurrencies,
  findCountryById,
  createCountry,
  updateCountryPartial,
  findStateById,
  createState,
  updateStatePartial,
  findCurrencyByCode,
  createCurrency,
  updateCurrencyPartial,
};
