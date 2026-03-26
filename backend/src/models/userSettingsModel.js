const db = require('../config/database');

/**
 * Get a single setting for a user.
 */
const getSetting = async (userId, settingKey) => {
  const { rows } = await db.query(
    `SELECT setting_value FROM user_settings
     WHERE user_id = $1 AND setting_key = $2`,
    [userId, settingKey]
  );
  return rows[0]?.setting_value ?? null;
};

/**
 * Upsert a setting for a user.
 */
const upsertSetting = async (userId, settingKey, settingValue) => {
  const { rows } = await db.query(
    `INSERT INTO user_settings (user_id, setting_key, setting_value, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (user_id, setting_key)
     DO UPDATE SET setting_value = $3::jsonb, updated_at = NOW()
     RETURNING *`,
    [userId, settingKey, JSON.stringify(settingValue)]
  );
  return rows[0];
};

/**
 * Delete a setting.
 */
const deleteSetting = async (userId, settingKey) => {
  await db.query(
    `DELETE FROM user_settings WHERE user_id = $1 AND setting_key = $2`,
    [userId, settingKey]
  );
};

/**
 * Get all settings for a user.
 */
const getAllSettings = async (userId) => {
  const { rows } = await db.query(
    `SELECT setting_key, setting_value FROM user_settings WHERE user_id = $1`,
    [userId]
  );
  return rows;
};

module.exports = {
  getSetting,
  upsertSetting,
  deleteSetting,
  getAllSettings,
};
