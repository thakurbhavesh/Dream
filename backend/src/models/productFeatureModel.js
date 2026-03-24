const db = require('../config/database');

const getCategoryById = async (id) => {
  const { rows } = await db.query(
    `SELECT *
     FROM feature_categories
     WHERE feature_category_id = $1
     LIMIT 1`,
    [id]
  );
  return rows[0];
};

const getCategoryByKey = async (categoryKey) => {
  const { rows } = await db.query(
    `SELECT *
     FROM feature_categories
     WHERE LOWER(category_key) = LOWER($1)
     LIMIT 1`,
    [categoryKey]
  );
  return rows[0];
};

const findCategories = async ({ search, status, limit = 50, offset = 0 } = {}) => {
  const filters = [];
  const values = [];
  let idx = 1;

  if (status) {
    filters.push(`fc.status = $${idx}`);
    values.push(status);
    idx += 1;
  }

  if (search) {
    filters.push(`(
      CAST(fc.feature_category_id AS TEXT) ILIKE $${idx} OR
      fc.category_key ILIKE $${idx} OR
      fc.category_label ILIKE $${idx}
    )`);
    values.push(`%${search}%`);
    idx += 1;
  }

  values.push(limit, offset);
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT
       fc.*,
       COUNT(fi.feature_item_id)::int AS feature_count,
       COUNT(*) OVER() AS total_count
     FROM feature_categories fc
     LEFT JOIN feature_items fi ON fi.feature_category_id = fc.feature_category_id
     ${whereClause}
     GROUP BY fc.feature_category_id
     ORDER BY fc.display_order ASC, fc.feature_category_id ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    rows: rows.map(({ total_count, ...rest }) => rest),
    total,
  };
};

const createCategory = async ({
  category_key,
  category_label,
  display_order = 10,
  status = 'active',
}) => {
  const { rows } = await db.query(
    `INSERT INTO feature_categories
      (category_key, category_label, display_order, status)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [category_key, category_label, display_order, status]
  );
  return rows[0];
};

const updateCategoryPartial = async (id, payload = {}) => {
  const fields = [];
  const values = [];
  let idx = 1;
  const allowed = ['category_key', 'category_label', 'display_order', 'status'];

  for (const key of allowed) {
    if (payload[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(payload[key]);
      idx += 1;
    }
  }

  if (!fields.length) return null;

  values.push(id);
  const { rows } = await db.query(
    `UPDATE feature_categories
     SET ${fields.join(', ')},
         updated_at = NOW()
     WHERE feature_category_id = $${idx}
     RETURNING *`,
    values
  );
  return rows[0];
};

const findItems = async ({
  search,
  status,
  feature_category_id,
  category_key,
  limit = 50,
  offset = 0,
} = {}) => {
  const filters = [];
  const values = [];
  let idx = 1;

  if (feature_category_id) {
    filters.push(`fi.feature_category_id = $${idx}`);
    values.push(feature_category_id);
    idx += 1;
  }

  if (category_key) {
    filters.push(`LOWER(fc.category_key) = LOWER($${idx})`);
    values.push(category_key);
    idx += 1;
  }

  if (status) {
    filters.push(`fi.status = $${idx}`);
    values.push(status);
    idx += 1;
  }

  if (search) {
    filters.push(`(
      CAST(fi.feature_item_id AS TEXT) ILIKE $${idx} OR
      fi.title ILIKE $${idx} OR
      COALESCE(fi.description, '') ILIKE $${idx} OR
      COALESCE(fc.category_label, '') ILIKE $${idx} OR
      COALESCE(fc.category_key, '') ILIKE $${idx}
    )`);
    values.push(`%${search}%`);
    idx += 1;
  }

  values.push(limit, offset);
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT
       fi.*,
       fc.category_key,
       fc.category_label,
       COUNT(*) OVER() AS total_count
     FROM feature_items fi
     JOIN feature_categories fc ON fc.feature_category_id = fi.feature_category_id
     ${whereClause}
     ORDER BY fc.display_order ASC, fi.display_order ASC, fi.feature_item_id ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    rows: rows.map(({ total_count, ...rest }) => rest),
    total,
  };
};

const findItemById = async (id) => {
  const { rows } = await db.query(
    `SELECT
       fi.*,
       fc.category_key,
       fc.category_label
     FROM feature_items fi
     JOIN feature_categories fc ON fc.feature_category_id = fi.feature_category_id
     WHERE fi.feature_item_id = $1
     LIMIT 1`,
    [id]
  );
  return rows[0];
};

const getItemByCategoryAndTitle = async (feature_category_id, title) => {
  const { rows } = await db.query(
    `SELECT *
     FROM feature_items
     WHERE feature_category_id = $1
       AND LOWER(title) = LOWER($2)
     LIMIT 1`,
    [feature_category_id, title]
  );
  return rows[0];
};

const createItem = async ({
  feature_category_id,
  title,
  description = null,
  icon_url = null,
  display_order = 10,
  status = 'active',
}) => {
  const { rows } = await db.query(
    `INSERT INTO feature_items
      (feature_category_id, title, description, icon_url, display_order, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [feature_category_id, title, description, icon_url, display_order, status]
  );
  return findItemById(rows[0].feature_item_id);
};

const updateItemPartial = async (id, payload = {}) => {
  const fields = [];
  const values = [];
  let idx = 1;
  const allowed = [
    'feature_category_id',
    'title',
    'description',
    'icon_url',
    'display_order',
    'status',
  ];

  for (const key of allowed) {
    if (payload[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(payload[key]);
      idx += 1;
    }
  }

  if (!fields.length) return null;

  values.push(id);
  const { rows } = await db.query(
    `UPDATE feature_items
     SET ${fields.join(', ')},
         updated_at = NOW()
     WHERE feature_item_id = $${idx}
     RETURNING feature_item_id`,
    values
  );

  if (!rows[0]) return null;
  return findItemById(rows[0].feature_item_id);
};

const findCatalog = async ({ status } = {}) => {
  const values = [];
  let categoryStatusClause = '';
  let itemStatusClause = '';

  if (status) {
    values.push(status);
    categoryStatusClause = 'WHERE fc.status = $1';
    itemStatusClause = 'AND fi.status = $1';
  }

  const { rows } = await db.query(
    `SELECT
       fc.feature_category_id,
       fc.category_key,
       fc.category_label,
       fc.display_order AS category_display_order,
       fc.status AS category_status,
       fi.feature_item_id,
       fi.title,
       fi.description,
       fi.icon_url,
       fi.display_order AS item_display_order,
       fi.status AS item_status
     FROM feature_categories fc
     LEFT JOIN feature_items fi
       ON fi.feature_category_id = fc.feature_category_id
       ${itemStatusClause}
     ${categoryStatusClause}
     ORDER BY fc.display_order ASC, fc.feature_category_id ASC, fi.display_order ASC, fi.feature_item_id ASC`,
    values
  );

  const categoriesMap = new Map();
  for (const row of rows) {
    if (!categoriesMap.has(row.feature_category_id)) {
      categoriesMap.set(row.feature_category_id, {
        feature_category_id: row.feature_category_id,
        category_key: row.category_key,
        category_label: row.category_label,
        display_order: row.category_display_order,
        status: row.category_status,
        items: [],
      });
    }

    if (row.feature_item_id) {
      categoriesMap.get(row.feature_category_id).items.push({
        feature_item_id: row.feature_item_id,
        title: row.title,
        description: row.description,
        icon_url: row.icon_url,
        display_order: row.item_display_order,
        status: row.item_status,
      });
    }
  }

  return Array.from(categoriesMap.values());
};

module.exports = {
  getCategoryById,
  getCategoryByKey,
  findCategories,
  createCategory,
  updateCategoryPartial,
  findItems,
  findItemById,
  getItemByCategoryAndTitle,
  createItem,
  updateItemPartial,
  findCatalog,
};
