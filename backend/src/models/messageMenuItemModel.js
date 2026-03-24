const db = require('../config/database');

const createMenuItem = async ({
  menu_key,
  label,
  default_status,
  scope,
  tone,
  icon_class,
  display_order,
}) => {
  const query = `
    INSERT INTO message_menu_items (
      menu_key, label, default_status, scope, tone, icon_class, display_order
    )
    VALUES ($1, $2, COALESCE($3, 'show'), COALESCE($4, 'any'), COALESCE($5, 'normal'), $6, COALESCE($7, 10))
    RETURNING *
  `;
  const values = [
    menu_key,
    label,
    default_status || null,
    scope || null,
    tone || null,
    icon_class || null,
    display_order ?? null,
  ];
  const { rows } = await db.query(query, values);
  return rows[0];
};

const findAll = async ({ search, limit = 50, offset = 0 } = {}) => {
  const filters = [];
  const values = [];
  let idx = 1;

  if (search) {
    values.push(`%${search}%`);
    filters.push(`(
      CAST(menu_item_id AS TEXT) ILIKE $${idx} OR
      menu_key ILIKE $${idx} OR
      label ILIKE $${idx} OR
      default_status ILIKE $${idx} OR
      scope ILIKE $${idx} OR
      tone ILIKE $${idx} OR
      COALESCE(icon_class, '') ILIKE $${idx} OR
      CAST(display_order AS TEXT) ILIKE $${idx} OR
      CAST(created_at AS TEXT) ILIKE $${idx} OR
      CAST(updated_at AS TEXT) ILIKE $${idx}
    )`);
    idx += 1;
  }

  values.push(limit);
  values.push(offset);

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const query = `
    SELECT *, COUNT(*) OVER() AS total_count
    FROM message_menu_items
    ${whereClause}
    ORDER BY display_order ASC, menu_item_id DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  const { rows } = await db.query(query, values);
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const cleaned = rows.map(({ total_count, ...rest }) => rest);
  return { rows: cleaned, total };
};

const findById = async (id) => {
  const { rows } = await db.query('SELECT * FROM message_menu_items WHERE menu_item_id = $1', [id]);
  return rows[0];
};

const findByKey = async (key) => {
  const { rows } = await db.query('SELECT * FROM message_menu_items WHERE menu_key = $1', [key]);
  return rows[0];
};

const updateMenuItem = async (id, payload) => {
  const query = `
    UPDATE message_menu_items
    SET menu_key = $1,
        label = $2,
        default_status = $3,
        scope = $4,
        tone = $5,
        icon_class = $6,
        display_order = $7,
        updated_at = NOW()
    WHERE menu_item_id = $8
    RETURNING *
  `;
  const values = [
    payload.menu_key,
    payload.label,
    payload.default_status || 'show',
    payload.scope || 'any',
    payload.tone || 'normal',
    payload.icon_class || null,
    payload.display_order ?? 10,
    id,
  ];
  const { rows } = await db.query(query, values);
  return rows[0];
};

const updateMenuItemPartial = async (id, payload) => {
  const fields = [];
  const values = [];
  let idx = 1;
  const allowed = [
    'menu_key',
    'label',
    'default_status',
    'scope',
    'tone',
    'icon_class',
    'display_order',
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
  const query = `
    UPDATE message_menu_items
    SET ${fields.join(', ')},
        updated_at = NOW()
    WHERE menu_item_id = $${idx}
    RETURNING *
  `;
  const { rows } = await db.query(query, values);
  return rows[0];
};

const deleteMenuItem = async (id) => {
  const { rows } = await db.query(
    'DELETE FROM message_menu_items WHERE menu_item_id = $1 RETURNING menu_item_id',
    [id]
  );
  return rows[0];
};

module.exports = {
  createMenuItem,
  findAll,
  findById,
  findByKey,
  updateMenuItem,
  updateMenuItemPartial,
  deleteMenuItem,
};
