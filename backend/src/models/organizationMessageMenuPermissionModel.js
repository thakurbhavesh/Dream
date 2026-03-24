const db = require('../config/database');

const createPermission = async ({
  organization_id,
  menu_item_id,
  permission_type = 'show',
  note = null,
  status = 'active',
}) => {
  const { rows } = await db.query(
    `INSERT INTO organization_message_menu_permissions
      (organization_id, menu_item_id, permission_type, note, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [organization_id, menu_item_id, permission_type, note, status]
  );
  return rows[0];
};

const findAll = async ({
  organization_id,
  search,
  menu_item_id,
  permission_type,
  status,
  limit = 50,
  offset = 0,
} = {}) => {
  const filters = ['organization_id = $1'];
  const values = [organization_id];
  let idx = 2;

  if (menu_item_id) {
    filters.push(`menu_item_id = $${idx}`);
    values.push(menu_item_id);
    idx += 1;
  }

  if (permission_type) {
    filters.push(`permission_type = $${idx}`);
    values.push(permission_type);
    idx += 1;
  }

  if (status) {
    filters.push(`status = $${idx}`);
    values.push(status);
    idx += 1;
  }

  if (search) {
    filters.push(`(
      CAST(permission_id AS TEXT) ILIKE $${idx} OR
      CAST(menu_item_id AS TEXT) ILIKE $${idx} OR
      permission_type ILIKE $${idx} OR
      COALESCE(note, '') ILIKE $${idx} OR
      status ILIKE $${idx}
    )`);
    values.push(`%${search}%`);
    idx += 1;
  }

  values.push(limit, offset);

  const { rows } = await db.query(
    `SELECT *, COUNT(*) OVER() AS total_count
     FROM organization_message_menu_permissions
     WHERE ${filters.join(' AND ')}
     ORDER BY permission_id DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  const total = rows.length ? Number(rows[0].total_count) : 0;
  const cleanedRows = rows.map(({ total_count, ...rest }) => rest);
  return { rows: cleanedRows, total };
};

const findById = async (id, organization_id) => {
  const { rows } = await db.query(
    `SELECT *
     FROM organization_message_menu_permissions
     WHERE permission_id = $1
       AND organization_id = $2
     LIMIT 1`,
    [id, organization_id]
  );
  return rows[0];
};

const updatePermission = async (id, organization_id, payload = {}, { partial = false } = {}) => {
  if (!partial) {
    const { rows } = await db.query(
      `UPDATE organization_message_menu_permissions
       SET menu_item_id = $1,
           permission_type = $2,
           note = $3,
           status = $4,
           updated_at = NOW()
       WHERE permission_id = $5
         AND organization_id = $6
       RETURNING *`,
      [
        payload.menu_item_id,
        payload.permission_type,
        payload.note ?? null,
        payload.status ?? 'active',
        id,
        organization_id,
      ]
    );
    return rows[0];
  }

  const fields = [];
  const values = [];
  let idx = 1;
  const allowed = ['menu_item_id', 'permission_type', 'note', 'status'];
  for (const key of allowed) {
    if (payload[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(payload[key]);
      idx += 1;
    }
  }

  if (!fields.length) return null;

  values.push(id, organization_id);
  const { rows } = await db.query(
    `UPDATE organization_message_menu_permissions
     SET ${fields.join(', ')},
         updated_at = NOW()
     WHERE permission_id = $${idx}
       AND organization_id = $${idx + 1}
     RETURNING *`,
    values
  );
  return rows[0];
};

module.exports = {
  createPermission,
  findAll,
  findById,
  updatePermission,
};

