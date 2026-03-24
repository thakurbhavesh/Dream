const db = require('../config/database');

const createContactRequest = async ({
  name,
  country_code = '+91',
  mobile_number,
  email_address,
  company_name,
  total_users,
  requirement_details = null,
}) => {
  const { rows } = await db.query(
    `INSERT INTO contact_us_requests
      (
        name,
        country_code,
        mobile_number,
        email_address,
        company_name,
        total_users,
        requirement_details
      )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [name, country_code, mobile_number, email_address, company_name, total_users, requirement_details]
  );
  return rows[0];
};

const findAll = async ({ search, status, limit = 50, offset = 0 } = {}) => {
  const filters = [];
  const values = [];
  let idx = 1;

  if (status) {
    filters.push(`status = $${idx}`);
    values.push(status);
    idx += 1;
  }

  if (search) {
    filters.push(`(
      name ILIKE $${idx}
      OR email_address ILIKE $${idx}
      OR mobile_number ILIKE $${idx}
      OR company_name ILIKE $${idx}
      OR COALESCE(requirement_details, '') ILIKE $${idx}
      OR CAST(contact_request_id AS TEXT) ILIKE $${idx}
    )`);
    values.push(`%${search}%`);
    idx += 1;
  }

  values.push(limit, offset);
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT
       *,
       COUNT(*) OVER() AS total_count
     FROM contact_us_requests
     ${whereClause}
     ORDER BY contact_request_id DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    rows: rows.map(({ total_count, ...rest }) => rest),
    total,
  };
};

const findById = async (id) => {
  const { rows } = await db.query(
    `SELECT *
     FROM contact_us_requests
     WHERE contact_request_id = $1
     LIMIT 1`,
    [id]
  );
  return rows[0];
};

module.exports = {
  createContactRequest,
  findAll,
  findById,
};
