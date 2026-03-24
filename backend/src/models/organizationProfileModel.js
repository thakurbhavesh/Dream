const db = require('../config/database');

// ─── Organization Overview ────────────────────────────────────────────────────

/**
 * Full org profile: org info + active subscription + member counts.
 */
const getOrganizationOverview = async (organizationId) => {
  const query = `
    SELECT
      o.organization_id,
      o.org_key,
      o.name,
      o.subdomain,
      o.custom_domain,
      o.logo_url,
      o.storage_used_mb,
      o.status,
      o.created_at,
      owner.user_id   AS owner_id,
      owner.name      AS owner_name,
      owner.email     AS owner_email,
      owner.profile_url AS owner_avatar,
      lang.language_code,
      lang.full_name  AS language_name,
      tz.timezone_code,
      tz.display_name AS timezone_name,
      tz.utc_offset,
      -- Subscription
      sub.subscription_id,
      sub.status      AS subscription_status,
      sub.start_date,
      sub.end_date,
      sub.max_users,
      sub.max_storage_mb,
      p.plan_id,
      p.plan_name,
      p.plan_key,
      p.price         AS plan_price,
      p.interval_days,
      -- Member counts
      (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.organization_id AND status = 'active')     AS active_members,
      (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.organization_id AND status = 'invited')    AS invited_members,
      (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.organization_id AND status = 'suspended')  AS suspended_members,
      (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.organization_id AND status = 'left')       AS left_members,
      (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.organization_id)                           AS total_members,
      -- Group / Dept counts
      (SELECT COUNT(*) FROM groups      WHERE organization_id = o.organization_id AND status = 'active') AS total_groups,
      (SELECT COUNT(*) FROM departments WHERE organization_id = o.organization_id)                        AS total_departments,
      (SELECT COUNT(*) FROM designations WHERE organization_id = o.organization_id)                       AS total_designations
    FROM organizations o
    JOIN users owner ON owner.user_id = o.owner_id
    LEFT JOIN languages lang ON lang.language_id = o.language_id
    LEFT JOIN timezones  tz  ON tz.timezone_id   = o.timezone_id
    LEFT JOIN subscriptions sub
      ON sub.organization_id = o.organization_id
      AND sub.status IN ('active', 'trial')
    LEFT JOIN plans p ON p.plan_id = sub.plan_id
    WHERE o.organization_id = $1
    LIMIT 1
  `;
  const { rows } = await db.query(query, [organizationId]);
  return rows[0] || null;
};

// ─── Members List ─────────────────────────────────────────────────────────────

/**
 * Paginated member list with full user + role + department + designation + location.
 * Supports search (name/email), filter by status, department, designation, role.
 */
const getMembers = async (organizationId, {
  search,
  status,
  role_id,
  department_id,
  designation_id,
  location_id,
  limit = 50,
  offset = 0,
} = {}) => {
  const values = [organizationId];
  const filters = ['om.organization_id = $1'];
  let idx = 2;

  if (search) {
    values.push(`%${search}%`);
    filters.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR u.mobile ILIKE $${idx})`);
    idx++;
  }
  if (status) {
    values.push(status);
    filters.push(`om.status = $${idx++}`);
  }
  if (role_id) {
    values.push(Number(role_id));
    filters.push(`om.role_id = $${idx++}`);
  }
  if (department_id) {
    values.push(Number(department_id));
    filters.push(`om.department_id = $${idx++}`);
  }
  if (designation_id) {
    values.push(Number(designation_id));
    filters.push(`om.designation_id = $${idx++}`);
  }
  if (location_id) {
    values.push(Number(location_id));
    filters.push(`om.location_id = $${idx++}`);
  }

  values.push(limit, offset);

  const query = `
    SELECT
      u.user_id,
      u.name,
      u.email,
      u.profile_url,
      u.mobile,
      u.is_global_member,
      u.last_login_at,
      u.status                AS user_status,
      om.membership_id,
      om.role_id,
      r.role_key,
      r.role_name,
      om.department_id,
      dept.name               AS department_name,
      om.designation_id,
      desig.name              AS designation_name,
      om.location_id,
      loc.label               AS location_name,
      loc.city,
      loc.state,
      om.status               AS membership_status,
      om.joined_at,
      COUNT(*) OVER()         AS total_count
    FROM organization_members om
    JOIN users u          ON u.user_id           = om.user_id
    LEFT JOIN roles r     ON r.role_id            = om.role_id
    LEFT JOIN departments dept   ON dept.department_id  = om.department_id
    LEFT JOIN designations desig ON desig.designation_id = om.designation_id
    LEFT JOIN locations loc      ON loc.location_id     = om.location_id
    WHERE ${filters.join(' AND ')}
    ORDER BY om.joined_at ASC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  const { rows } = await db.query(query, values);
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const members = rows.map(({ total_count, ...rest }) => rest);
  return { members, total };
};

// ─── Single Member ────────────────────────────────────────────────────────────

/**
 * Full profile of a single org member: user + membership + activity.
 */
const getMember = async (organizationId, userId) => {
  const query = `
    SELECT
      u.user_id,
      u.name,
      u.email,
      u.profile_url,
      u.mobile,
      u.is_platform_admin,
      u.is_global_member,
      u.email_verified_at,
      u.last_login_at,
      u.status                  AS user_status,
      u.created_at              AS user_created_at,
      om.membership_id,
      om.organization_id,
      om.role_id,
      r.role_key,
      r.role_name,
      om.department_id,
      dept.name                 AS department_name,
      om.designation_id,
      desig.name                AS designation_name,
      om.location_id,
      loc.label                 AS location_name,
      loc.country,
      om.status                 AS membership_status,
      om.joined_at,
      -- Message stats (1:1 sent)
      (SELECT COUNT(*) FROM messages
        WHERE organization_id = $1 AND sender_id = u.user_id)            AS messages_sent,
      -- Groups count
      (SELECT COUNT(*) FROM group_members
        WHERE organization_id = $1 AND user_id = u.user_id AND status = 'active') AS groups_count
    FROM organization_members om
    JOIN users u          ON u.user_id           = om.user_id
    LEFT JOIN roles r     ON r.role_id            = om.role_id
    LEFT JOIN departments dept   ON dept.department_id  = om.department_id
    LEFT JOIN designations desig ON desig.designation_id = om.designation_id
    LEFT JOIN locations loc      ON loc.location_id     = om.location_id
    WHERE om.organization_id = $1
      AND om.user_id = $2
    LIMIT 1
  `;
  const { rows } = await db.query(query, [organizationId, userId]);
  return rows[0] || null;
};

// ─── Departments / Designations / Locations for filters ──────────────────────

const getDepartments = async (organizationId) => {
  const { rows } = await db.query(
    `SELECT department_id, name,
       (SELECT COUNT(*) FROM organization_members WHERE organization_id = $1 AND department_id = d.department_id AND status = 'active') AS member_count
     FROM departments d
     WHERE organization_id = $1
     ORDER BY name ASC`,
    [organizationId]
  );
  return rows;
};

const getDesignations = async (organizationId) => {
  const { rows } = await db.query(
    `SELECT designation_id, name, department_id,
       (SELECT COUNT(*) FROM organization_members WHERE organization_id = $1 AND designation_id = des.designation_id AND status = 'active') AS member_count
     FROM designations des
     WHERE organization_id = $1
     ORDER BY name ASC`,
    [organizationId]
  );
  return rows;
};

const getLocations = async (organizationId) => {
  const { rows } = await db.query(
    `SELECT location_id, label, city, state, country,
       (SELECT COUNT(*) FROM organization_members WHERE organization_id = $1 AND location_id = l.location_id AND status = 'active') AS member_count
     FROM locations l
     WHERE organization_id = $1
     ORDER BY label ASC`,
    [organizationId]
  );
  return rows;
};

module.exports = {
  getOrganizationOverview,
  getMembers,
  getMember,
  getDepartments,
  getDesignations,
  getLocations,
};
