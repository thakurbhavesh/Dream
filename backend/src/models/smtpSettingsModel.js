const db = require('../config/database');

const maskPass = (row) => row ? { ...row, smtp_pass: row.smtp_pass ? '********' : '' } : null;

/**
 * Ensure smtp_settings table exists with all required columns.
 * Safe to call on every startup.
 */
const createTableIfNotExists = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS smtp_settings (
      smtp_settings_id  SERIAL       PRIMARY KEY,
      label             VARCHAR(255) NOT NULL DEFAULT 'Default',
      host              VARCHAR(255) NOT NULL DEFAULT '',
      port              INTEGER      NOT NULL DEFAULT 587,
      secure            BOOLEAN      NOT NULL DEFAULT FALSE,
      smtp_user         VARCHAR(255) NOT NULL DEFAULT '',
      smtp_pass         VARCHAR(255) NOT NULL DEFAULT '',
      from_address      VARCHAR(255)          DEFAULT '',
      contact_notify_to TEXT                  DEFAULT '',
      status            VARCHAR(20)  NOT NULL DEFAULT 'inactive',
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  // Migrate: add new columns if upgrading from old schema
  await db.query(`ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS label VARCHAR(255) NOT NULL DEFAULT 'Default'`);
  await db.query(`ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'inactive'`);

  // Migrate: sync status from old is_active if column exists
  await db.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'smtp_settings' AND column_name = 'is_active'
      ) THEN
        UPDATE smtp_settings SET status = 'active'   WHERE is_active = TRUE  AND status = 'inactive';
        UPDATE smtp_settings SET status = 'inactive' WHERE is_active = FALSE AND status = 'active';
        ALTER TABLE smtp_settings DROP COLUMN IF EXISTS is_active;
      END IF;
    END
    $$
  `);
};

const findAll = async () => {
  const { rows } = await db.query(
    `SELECT * FROM smtp_settings ORDER BY
       CASE WHEN status = 'active' THEN 0 ELSE 1 END,
       smtp_settings_id ASC`
  );
  return rows.map(maskPass);
};

const findActive = async () => {
  const { rows } = await db.query(
    `SELECT * FROM smtp_settings WHERE status = 'active' ORDER BY smtp_settings_id DESC LIMIT 1`
  );
  // Return raw row (with real pass) for internal mail use — do NOT expose to API
  return rows[0] || null;
};

const findById = async (id) => {
  const { rows } = await db.query(
    `SELECT * FROM smtp_settings WHERE smtp_settings_id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

const create = async (payload) => {
  const { rows } = await db.query(
    `INSERT INTO smtp_settings
       (label, host, port, secure, smtp_user, smtp_pass, from_address, contact_notify_to, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      payload.label || 'Default',
      payload.host || '',
      Number(payload.port) || 587,
      payload.secure === true || String(payload.secure) === 'true',
      payload.smtp_user || '',
      payload.smtp_pass || '',
      payload.from_address || '',
      payload.contact_notify_to || '',
      'inactive',
    ]
  );
  return maskPass(rows[0]);
};

const updateById = async (id, payload) => {
  const existing = await findById(id);
  if (!existing) return null;

  const fields = [];
  const values = [];
  let idx = 1;

  const allowed = ['label', 'host', 'port', 'secure', 'smtp_user', 'smtp_pass', 'from_address', 'contact_notify_to', 'status'];
  for (const key of allowed) {
    if (payload[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(payload[key]);
      idx++;
    }
  }

  if (!fields.length) return maskPass(existing);

  values.push(id);
  const { rows } = await db.query(
    `UPDATE smtp_settings SET ${fields.join(', ')}, updated_at = NOW()
     WHERE smtp_settings_id = $${idx}
     RETURNING *`,
    values
  );
  return maskPass(rows[0]);
};

/**
 * Set one config as active; all others become inactive.
 * Returns all rows after the change.
 */
const activateById = async (id) => {
  return db.withTransaction(async (tx) => {
    const { rows: check } = await tx.query(
      `SELECT smtp_settings_id FROM smtp_settings WHERE smtp_settings_id = $1`,
      [id]
    );
    if (!check.length) return null;

    await tx.query(`UPDATE smtp_settings SET status = 'inactive', updated_at = NOW()`);
    await tx.query(
      `UPDATE smtp_settings SET status = 'active', updated_at = NOW() WHERE smtp_settings_id = $1`,
      [id]
    );

    const { rows } = await tx.query(
      `SELECT * FROM smtp_settings ORDER BY
         CASE WHEN status = 'active' THEN 0 ELSE 1 END,
         smtp_settings_id ASC`
    );
    return rows.map(maskPass);
  });
};

const deleteById = async (id) => {
  const existing = await findById(id);
  if (!existing) return null;
  if (existing.status === 'active') {
    const err = new Error('Cannot delete the active SMTP config. Activate another config first.');
    err.status = 400;
    throw err;
  }
  await db.query(`DELETE FROM smtp_settings WHERE smtp_settings_id = $1`, [id]);
  return true;
};

module.exports = {
  createTableIfNotExists,
  findAll,
  findActive,
  findById,
  create,
  updateById,
  activateById,
  deleteById,
};
