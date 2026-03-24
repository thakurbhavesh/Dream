const db = require('../config/database');

const normalizeClientDeviceId = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.slice(0, 191);
};

const buildClientDeviceName = (clientDeviceId) => {
  const normalized = normalizeClientDeviceId(clientDeviceId);
  if (!normalized) return null;
  return `client:${normalized}`;
};

const sanitizeDeviceType = (value) => {
  const allowed = new Set(['mobile', 'desktop', 'tablet', 'other']);
  if (!value || typeof value !== 'string') return 'other';
  const normalized = value.trim().toLowerCase();
  return allowed.has(normalized) ? normalized : 'other';
};

const findByClientDeviceId = async ({ user_id, client_device_id, trustedOnly = false }) => {
  const marker = buildClientDeviceName(client_device_id);
  if (!user_id || !marker) return null;

  const query = `
    SELECT *
    FROM user_devices
    WHERE user_id = $1
      AND device_name = $2
      ${trustedOnly ? "AND is_trusted = TRUE" : ""}
    ORDER BY last_active_at DESC
    LIMIT 1
  `;

  const { rows } = await db.query(query, [user_id, marker]);
  return rows[0] || null;
};

const findLatestByFingerprint = async ({ user_id, ip_address, user_agent }) => {
  if (!user_id || !ip_address) return null;

  const query = `
    SELECT *
    FROM user_devices
    WHERE user_id = $1
      AND ip_address = $2
      AND COALESCE(user_agent, '') = COALESCE($3, '')
    ORDER BY last_active_at DESC
    LIMIT 1
  `;

  const { rows } = await db.query(query, [user_id, ip_address, user_agent || null]);
  return rows[0];
};

const createDevice = async ({
  user_id,
  device_name,
  device_type,
  hostname,
  os_name,
  ip_address,
  user_agent,
  latitude,
  longitude,
  accuracy_radius,
  country,
  city,
  is_trusted,
}) => {
  const query = `
    INSERT INTO user_devices (
      user_id,
      device_name,
      device_type,
      hostname,
      os_name,
      ip_address,
      user_agent,
      latitude,
      longitude,
      accuracy_radius,
      country,
      city,
      is_trusted,
      status,
      last_active_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active', NOW())
    RETURNING *
  `;

  const values = [
    user_id,
    device_name || null,
    sanitizeDeviceType(device_type),
    hostname || null,
    os_name || null,
    ip_address,
    user_agent || null,
    latitude ?? null,
    longitude ?? null,
    accuracy_radius ?? null,
    country || null,
    city || null,
    Boolean(is_trusted),
  ];

  const { rows } = await db.query(query, values);
  return rows[0];
};

const touchDevice = async (
  device_id,
  {
    device_name,
    device_type,
    hostname,
    os_name,
    ip_address,
    user_agent,
    latitude,
    longitude,
    accuracy_radius,
    country,
    city,
    is_trusted,
  }
) => {
  const query = `
    UPDATE user_devices
    SET
      device_name = COALESCE($1, device_name),
      device_type = COALESCE($2, device_type),
      hostname = COALESCE($3, hostname),
      os_name = COALESCE($4, os_name),
      ip_address = COALESCE($5, ip_address),
      user_agent = COALESCE($6, user_agent),
      latitude = COALESCE($7, latitude),
      longitude = COALESCE($8, longitude),
      accuracy_radius = COALESCE($9, accuracy_radius),
      country = COALESCE($10, country),
      city = COALESCE($11, city),
      is_trusted = COALESCE($12, is_trusted),
      status = 'active',
      last_active_at = NOW()
    WHERE device_id = $13
    RETURNING *
  `;

  const values = [
    device_name || null,
    device_type ? sanitizeDeviceType(device_type) : null,
    hostname || null,
    os_name || null,
    ip_address || null,
    user_agent || null,
    latitude ?? null,
    longitude ?? null,
    accuracy_radius ?? null,
    country || null,
    city || null,
    typeof is_trusted === 'boolean' ? is_trusted : null,
    device_id,
  ];

  const { rows } = await db.query(query, values);
  return rows[0];
};

const upsertDeviceForLogin = async ({
  user_id,
  client_device_id,
  device_name,
  device_type,
  ip_address,
  user_agent,
  hostname,
  os_name,
  latitude,
  longitude,
  accuracy_radius,
  country,
  city,
  is_trusted,
}) => {
  const clientMarker = buildClientDeviceName(client_device_id);
  const existing = clientMarker
    ? await findByClientDeviceId({ user_id, client_device_id })
    : await findLatestByFingerprint({ user_id, ip_address, user_agent });

  if (existing) {
    return touchDevice(existing.device_id, {
      device_name: clientMarker || device_name,
      device_type,
      hostname,
      os_name,
      ip_address,
      user_agent,
      latitude,
      longitude,
      accuracy_radius,
      country,
      city,
      is_trusted,
    });
  }

  return createDevice({
    user_id,
    device_name: clientMarker || device_name,
    device_type,
    hostname,
    os_name,
    ip_address,
    user_agent,
    latitude,
    longitude,
    accuracy_radius,
    country,
    city,
    is_trusted,
  });
};

const listTrustedByUser = async (user_id) => {
  if (!user_id) return [];
  const { rows } = await db.query(
    `SELECT
       device_id,
       device_name,
       device_type,
       hostname,
       os_name,
       ip_address,
       user_agent,
       country,
       city,
       status,
       is_trusted,
       created_at,
       last_active_at
     FROM user_devices
     WHERE user_id = $1
       AND is_trusted = TRUE
     ORDER BY last_active_at DESC NULLS LAST, created_at DESC`,
    [user_id]
  );
  return rows;
};

const setTrustState = async ({ user_id, device_id, is_trusted }) => {
  if (!user_id || !device_id) return null;
  const { rows } = await db.query(
    `UPDATE user_devices
     SET
       is_trusted = $1,
       updated_at = NOW()
     WHERE user_id = $2
       AND device_id = $3
     RETURNING *`,
    [Boolean(is_trusted), user_id, device_id]
  );
  return rows[0] || null;
};

const markLoggedOut = async (device_id) => {
  if (!device_id) return;
  await db.query(
    `UPDATE user_devices
     SET status = 'logged_out', last_active_at = NOW()
     WHERE device_id = $1`,
    [device_id]
  );
};

const markAllLoggedOutByUser = async (user_id) => {
  if (!user_id) return;
  await db.query(
    `UPDATE user_devices
     SET status = 'logged_out', last_active_at = NOW()
     WHERE user_id = $1`,
    [user_id]
  );
};

const bindClientDeviceId = async ({ user_id, device_id, client_device_id }) => {
  const marker = buildClientDeviceName(client_device_id);
  if (!user_id || !device_id || !marker) return null;
  const { rows } = await db.query(
    `UPDATE user_devices
     SET device_name = $1,
         updated_at = NOW()
     WHERE user_id = $2
       AND device_id = $3
     RETURNING *`,
    [marker, user_id, device_id]
  );
  return rows[0] || null;
};

module.exports = {
  upsertDeviceForLogin,
  findByClientDeviceId,
  findLatestByFingerprint,
  listTrustedByUser,
  setTrustState,
  touchDevice,
  markLoggedOut,
  markAllLoggedOutByUser,
  bindClientDeviceId,
};
