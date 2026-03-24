const db = require('../config/database');

const createUser = async ({ email, name, password_hash, is_platform_admin = false, is_global_member = false }) => {
  const query = `
    INSERT INTO users (email, name, password_hash, is_platform_admin, is_global_member)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const values = [email, name, password_hash, is_platform_admin, is_global_member];
  const { rows } = await db.query(query, values);
  return rows[0];
};

const findByEmailWithMembership = async (email) => {
  const query = `
    SELECT
      u.*,
      om.organization_id,
      om.role_id,
      om.status AS membership_status,
      r.role_key,
      r.role_name
    FROM users u
    LEFT JOIN organization_members om
      ON om.user_id = u.user_id
      AND om.status = 'active'
    LEFT JOIN roles r
      ON r.role_id = om.role_id
    WHERE u.email = $1
    ORDER BY om.joined_at ASC NULLS LAST
    LIMIT 1
  `;
  const { rows } = await db.query(query, [email]);
  return rows[0];
};

const findByIdWithMembership = async (userId, organizationId) => {
  const query = `
    SELECT
      u.*,
      om.organization_id,
      om.role_id,
      om.status AS membership_status,
      r.role_key,
      r.role_name
    FROM users u
    LEFT JOIN organization_members om
      ON om.user_id = u.user_id
      AND om.organization_id = $2
      AND om.status = 'active'
    LEFT JOIN roles r
      ON r.role_id = om.role_id
    WHERE u.user_id = $1
    LIMIT 1
  `;
  const { rows } = await db.query(query, [userId, organizationId]);
  return rows[0];
};

module.exports = {
  createUser,
  findByEmailWithMembership,
  findByIdWithMembership,
};
