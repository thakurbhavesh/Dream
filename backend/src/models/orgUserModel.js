const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');
const { getEmailDomain } = require('../utils/businessEmail');

const toBool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes'].includes(normalized);
};

const sanitizeEmail = (email) => String(email || '').trim().toLowerCase();
const DEFAULT_ORG_USER_ROLE_ID = 4;

const normalizeDomain = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .replace(/^@/, '');

const getOrganizationCustomDomain = async (tx, organizationId) => {
  const { rows } = await tx.query(
    `SELECT custom_domain
     FROM organizations
     WHERE organization_id = $1
     LIMIT 1`,
    [organizationId]
  );
  return normalizeDomain(rows[0]?.custom_domain || '');
};

const shouldForceGlobalMemberForDomain = (email, customDomain) => {
  if (!customDomain) return false;
  const emailDomain = normalizeDomain(getEmailDomain(email));
  if (!emailDomain) return false;
  return emailDomain !== customDomain;
};

const ensureRoleExists = async (tx, roleId) => {
  const { rows } = await tx.query('SELECT role_id FROM roles WHERE role_id = $1 LIMIT 1', [roleId]);
  if (!rows.length) {
    const err = new Error('Invalid role_id');
    err.status = 400;
    throw err;
  }
};

const ensureDepartmentDesignation = async (tx, organizationId, departmentId, designationId) => {
  const hasDepartment = Number.isFinite(departmentId) && departmentId > 0;
  const hasDesignation = Number.isFinite(designationId) && designationId > 0;

  if (!hasDepartment && !hasDesignation) {
    return;
  }

  if (departmentId !== null && departmentId !== undefined && !hasDepartment) {
    const err = new Error('Valid department_id is required');
    err.status = 400;
    throw err;
  }

  if (designationId !== null && designationId !== undefined && !hasDesignation) {
    const err = new Error('Valid designation_id is required');
    err.status = 400;
    throw err;
  }

  if (hasDepartment) {
    const departmentResult = await tx.query(
      `SELECT department_id
       FROM departments
       WHERE department_id = $1
         AND organization_id = $2
       LIMIT 1`,
      [departmentId, organizationId]
    );

    if (!departmentResult.rows.length) {
      const err = new Error('Invalid department_id for organization');
      err.status = 400;
      throw err;
    }
  }

  if (hasDesignation) {
    const designationResult = await tx.query(
      `SELECT designation_id, department_id
       FROM designations
       WHERE designation_id = $1
         AND organization_id = $2
       LIMIT 1`,
      [designationId, organizationId]
    );

    if (!designationResult.rows.length) {
      const err = new Error('Invalid designation_id for organization');
      err.status = 400;
      throw err;
    }

    if (hasDepartment && Number(designationResult.rows[0].department_id) !== departmentId) {
      const err = new Error('designation_id does not belong to department_id');
      err.status = 400;
      throw err;
    }
  }
};

const ensureLocationExists = async (tx, organizationId, locationId) => {
  if (locationId === null || locationId === undefined) {
    return;
  }

  if (!Number.isFinite(locationId) || locationId <= 0) {
    const err = new Error('Valid location_id is required');
    err.status = 400;
    throw err;
  }

  const locationResult = await tx.query(
    `SELECT location_id
     FROM locations
     WHERE location_id = $1
       AND organization_id = $2
     LIMIT 1`,
    [locationId, organizationId]
  );

  if (!locationResult.rows.length) {
    const err = new Error('Invalid location_id for organization');
    err.status = 400;
    throw err;
  }
};

const getOrganizationLicenseSnapshot = async (tx, organizationId) => {
  const subscriptionResult = await tx.query(
    `SELECT max_users
     FROM subscriptions
     WHERE organization_id = $1
       AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [organizationId]
  );

  const maxUsers = Number(subscriptionResult.rows[0]?.max_users || 0);
  const activeMembersResult = await tx.query(
    `SELECT COUNT(*)::int AS total
     FROM organization_members
     WHERE organization_id = $1
       AND status = 'active'`,
    [organizationId]
  );
  const activeMembers = Number(activeMembersResult.rows[0]?.total || 0);

  return {
    maxUsers,
    activeMembers,
  };
};

const mapUserRow = (row) => ({
  user_id: row.user_id,
  name: row.name,
  email: row.email,
  profile_url: row.profile_url,
  mobile: row.mobile,
  is_platform_admin: row.is_platform_admin,
  is_global_member: row.is_global_member,
  organization_id: row.organization_id,
  role_id: row.role_id,
  role_key: row.role_key,
  role_name: row.role_name,
  department_id: row.department_id,
  department_name: row.department_name,
  designation_id: row.designation_id,
  designation_name: row.designation_name,
  location_id: row.location_id,
  location_name: row.location_name,
  user_status: row.user_status,
  membership_status: row.membership_status,
  status: row.membership_status,
  joined_at: row.joined_at,
});

const selectUserInOrganization = async (tx, organizationId, userId) => {
  const query = `
    SELECT
      u.user_id,
      u.name,
      u.email,
      u.profile_url,
      u.mobile,
      u.status AS user_status,
      u.is_platform_admin,
      u.is_global_member,
      om.membership_id,
      om.organization_id,
      om.department_id,
      dept.name AS department_name,
      om.designation_id,
      desig.name AS designation_name,
      om.location_id,
      loc.label AS location_name,
      om.status AS membership_status,
      om.joined_at,
      r.role_key,
      r.role_name
    FROM organization_members om
    JOIN users u ON u.user_id = om.user_id
    LEFT JOIN roles r ON r.role_id = om.role_id
    LEFT JOIN departments dept ON dept.department_id = om.department_id
    LEFT JOIN designations desig ON desig.designation_id = om.designation_id
    LEFT JOIN locations loc ON loc.location_id = om.location_id
    WHERE om.organization_id = $1
      AND om.user_id = $2
    LIMIT 1
  `;
  const { rows } = await tx.query(query, [organizationId, userId]);
  return rows[0] || null;
};

const createUserInOrganization = async ({
  organization_id,
  name,
  email,
  mobile,
  role_id,
  department_id,
  designation_id,
  location_id,
  is_platform_admin,
  is_global_member,
}) => {
  const normalizedEmail = sanitizeEmail(email);
  const explicitRoleId = Number(role_id);
  const requestedPlatformAdmin = toBool(is_platform_admin);
  const requestedGlobalMember = toBool(is_global_member);
  const roleId =
    Number.isFinite(explicitRoleId) && explicitRoleId > 0
      ? explicitRoleId
      : DEFAULT_ORG_USER_ROLE_ID;
  const departmentId =
    department_id === undefined || department_id === null || String(department_id).trim() === ''
      ? null
      : Number(department_id);
  const designationId =
    designation_id === undefined || designation_id === null || String(designation_id).trim() === ''
      ? null
      : Number(designation_id);
  const locationId =
    location_id === undefined || location_id === null || String(location_id).trim() === ''
      ? null
      : Number(location_id);

  return db.withTransaction(async (tx) => {
    const organizationCustomDomain = await getOrganizationCustomDomain(tx, organization_id);
    const forceGlobalMember = shouldForceGlobalMemberForDomain(normalizedEmail, organizationCustomDomain);
    const effectiveGlobalMember = requestedGlobalMember || forceGlobalMember;
    const license = await getOrganizationLicenseSnapshot(tx, organization_id);
    if (license.maxUsers > 0 && license.activeMembers >= license.maxUsers) {
      const err = new Error(
        `User limit reached for current plan (${license.activeMembers}/${license.maxUsers}). Please upgrade licenses.`
      );
      err.status = 409;
      throw err;
    }

    await ensureRoleExists(tx, roleId);
    await ensureDepartmentDesignation(tx, organization_id, departmentId, designationId);
    await ensureLocationExists(tx, organization_id, locationId);

    const existingUserResult = await tx.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [normalizedEmail]
    );

    let userId;
    let tempPassword;

    if (existingUserResult.rows.length) {
      userId = existingUserResult.rows[0].user_id;
      const existingIsGlobalMember = toBool(existingUserResult.rows[0].is_global_member);
      const globalMemberToPersist =
        is_global_member === undefined && !forceGlobalMember
          ? null
          : forceGlobalMember
            ? true
            : requestedGlobalMember ?? existingIsGlobalMember;

      const existingMembership = await tx.query(
        `SELECT membership_id
         FROM organization_members
         WHERE organization_id = $1 AND user_id = $2
         LIMIT 1`,
        [organization_id, userId]
      );

      if (existingMembership.rows.length) {
        const err = new Error('User already exists in this organization');
        err.status = 409;
        throw err;
      }

      await tx.query(
        `UPDATE users
         SET name = COALESCE($1, name),
             mobile = COALESCE($2, mobile),
             is_platform_admin = COALESCE($3, is_platform_admin),
             is_global_member = COALESCE($4, is_global_member),
             updated_at = NOW()
         WHERE user_id = $5`,
        [
          name || null,
          mobile || null,
          is_platform_admin === undefined ? null : toBool(is_platform_admin),
          globalMemberToPersist,
          userId,
        ]
      );
    } else {
      tempPassword = crypto.randomBytes(6).toString('base64url');
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      const insertUser = await tx.query(
        `INSERT INTO users (
          email, name, password_hash, mobile, is_platform_admin, is_global_member
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING user_id`,
        [
          normalizedEmail,
          name,
          passwordHash,
          mobile || null,
          requestedPlatformAdmin,
          effectiveGlobalMember,
        ]
      );

      userId = insertUser.rows[0].user_id;
    }

    const membershipInsert = await tx.query(
      `INSERT INTO organization_members (
         organization_id, user_id, role_id, department_id, designation_id, location_id, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       RETURNING membership_id`,
      [organization_id, userId, roleId, departmentId, designationId, locationId]
    );

    const userRow = await selectUserInOrganization(tx, organization_id, userId);
    return {
      ...mapUserRow(userRow),
      temp_password: tempPassword || null,
      membership_id: membershipInsert.rows[0].membership_id,
    };
  });
};

const findUsersInOrganization = async ({ organization_id, search, limit = 50, offset = 0 }) => {
  const filters = ['om.organization_id = $1'];
  const values = [organization_id];
  let idx = 2;

  if (search) {
    values.push(`%${search}%`);
    filters.push(`(
      u.name ILIKE $${idx} OR
      u.email ILIKE $${idx} OR
      COALESCE(u.mobile, '') ILIKE $${idx} OR
      CAST(u.user_id AS TEXT) ILIKE $${idx} OR
      COALESCE(r.role_name, '') ILIKE $${idx} OR
      COALESCE(r.role_key, '') ILIKE $${idx} OR
      COALESCE(dept.name, '') ILIKE $${idx} OR
      COALESCE(desig.name, '') ILIKE $${idx}
    )`);
    idx += 1;
  }

  const whereSql = filters.join(' AND ');
  let total = 0;

  if (search) {
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM organization_members om
      JOIN users u ON u.user_id = om.user_id
      LEFT JOIN roles r ON r.role_id = om.role_id
      LEFT JOIN departments dept ON dept.department_id = om.department_id
      LEFT JOIN designations desig ON desig.designation_id = om.designation_id
      WHERE ${whereSql}
    `;
    const countResult = await db.query(countQuery, values);
    total = Number(countResult.rows[0]?.total || 0);
  } else {
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM organization_members om
      WHERE ${whereSql}
    `;
    const countResult = await db.query(countQuery, values);
    total = Number(countResult.rows[0]?.total || 0);
  }

  if (!total) return { rows: [], total: 0 };

  const dataValues = [...values, limit, offset];

  const query = `
    SELECT
      u.user_id,
      u.name,
      u.email,
      u.profile_url,
      u.mobile,
      u.status AS user_status,
      u.is_platform_admin,
      u.is_global_member,
      om.membership_id,
      om.organization_id,
      om.role_id,
      om.department_id,
      dept.name AS department_name,
      om.designation_id,
      desig.name AS designation_name,
      om.location_id,
      loc.label AS location_name,
      om.status AS membership_status,
      om.joined_at,
      r.role_key,
      r.role_name
    FROM organization_members om
    JOIN users u ON u.user_id = om.user_id
    LEFT JOIN roles r ON r.role_id = om.role_id
    LEFT JOIN departments dept ON dept.department_id = om.department_id
    LEFT JOIN designations desig ON desig.designation_id = om.designation_id
    LEFT JOIN locations loc ON loc.location_id = om.location_id
    WHERE ${whereSql}
    ORDER BY om.joined_at DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  const { rows } = await db.query(query, dataValues);
  const cleaned = rows.map((rest) => mapUserRow(rest));
  return { rows: cleaned, total };
};

const findUserByIdInOrganization = async (organization_id, user_id) => {
  const query = `
    SELECT
      u.user_id,
      u.name,
      u.email,
      u.profile_url,
      u.mobile,
      u.status AS user_status,
      u.is_platform_admin,
      u.is_global_member,
      om.membership_id,
      om.organization_id,
      om.role_id,
      om.department_id,
      dept.name AS department_name,
      om.designation_id,
      desig.name AS designation_name,
      om.location_id,
      loc.label AS location_name,
      om.status AS membership_status,
      om.joined_at,
      r.role_key,
      r.role_name
    FROM organization_members om
    JOIN users u ON u.user_id = om.user_id
    LEFT JOIN roles r ON r.role_id = om.role_id
    LEFT JOIN departments dept ON dept.department_id = om.department_id
    LEFT JOIN designations desig ON desig.designation_id = om.designation_id
    LEFT JOIN locations loc ON loc.location_id = om.location_id
    WHERE om.organization_id = $1
      AND om.user_id = $2
    LIMIT 1
  `;
  const { rows } = await db.query(query, [organization_id, user_id]);
  return rows[0] ? mapUserRow(rows[0]) : null;
};

const resetUserPasswordByEmailInOrganization = async (organization_id, email, password_hash) => {
  return db.withTransaction(async (tx) => {
    const { rows } = await tx.query(
      `SELECT u.user_id
       FROM organization_members om
       JOIN users u ON u.user_id = om.user_id
       WHERE om.organization_id = $1
         AND LOWER(u.email) = LOWER($2)
       LIMIT 1`,
      [organization_id, email]
    );

    if (!rows.length) return null;

    const userId = rows[0].user_id;
    await tx.query(
      `UPDATE users
       SET password_hash = $1,
           updated_at = NOW()
       WHERE user_id = $2`,
      [password_hash, userId]
    );

    await tx.query(
      `UPDATE user_sessions
       SET status = 'revoked',
           revoked_at = NOW()
       WHERE user_id = $1
         AND status = 'active'`,
      [userId]
    );

    const updated = await selectUserInOrganization(tx, organization_id, userId);
    return mapUserRow(updated);
  });
};

const updateUserInOrganization = async (organization_id, user_id, payload = {}) => {
  return db.withTransaction(async (tx) => {
    const current = await selectUserInOrganization(tx, organization_id, user_id);
    if (!current) return null;
    const organizationCustomDomain = await getOrganizationCustomDomain(tx, organization_id);

    const nextMembershipStatus =
      payload.membership_status !== undefined
        ? String(payload.membership_status || '').trim().toLowerCase()
        : null;
    const currentMembershipStatus = String(current.membership_status || '')
      .trim()
      .toLowerCase();
    const isActivatingMembership =
      nextMembershipStatus === 'active' && currentMembershipStatus !== 'active';

    if (isActivatingMembership) {
      const license = await getOrganizationLicenseSnapshot(tx, organization_id);
      if (license.maxUsers > 0 && license.activeMembers >= license.maxUsers) {
        const err = new Error(
          `User limit reached for current plan (${license.activeMembers}/${license.maxUsers}). Please upgrade licenses.`
        );
        err.status = 409;
        throw err;
      }
    }

    const usersUpdates = {};

    if (payload.name !== undefined) usersUpdates.name = payload.name;
    if (payload.email !== undefined) {
      const normalizedEmail = sanitizeEmail(payload.email);
      const duplicate = await tx.query(
        'SELECT user_id FROM users WHERE LOWER(email) = LOWER($1) AND user_id <> $2 LIMIT 1',
        [normalizedEmail, user_id]
      );
      if (duplicate.rows.length) {
        const err = new Error('Email already exists');
        err.status = 409;
        throw err;
      }
      usersUpdates.email = normalizedEmail;
    }
    if (payload.mobile !== undefined) usersUpdates.mobile = payload.mobile || null;
    if (payload.is_platform_admin !== undefined) {
      usersUpdates.is_platform_admin = toBool(payload.is_platform_admin);
    }
    if (payload.is_global_member !== undefined) {
      usersUpdates.is_global_member = toBool(payload.is_global_member);
    }
    if (payload.user_status !== undefined) usersUpdates.status = payload.user_status;

    const emailForDomainCheck = usersUpdates.email || sanitizeEmail(current.email);
    if (shouldForceGlobalMemberForDomain(emailForDomainCheck, organizationCustomDomain)) {
      usersUpdates.is_global_member = true;
    }

    const userUpdateEntries = Object.entries(usersUpdates);
    if (userUpdateEntries.length) {
      const usersValues = userUpdateEntries.map(([, value]) => value);
      const usersFields = userUpdateEntries.map(([field], index) => `${field} = $${index + 1}`);
      usersValues.push(user_id);
      await tx.query(
        `UPDATE users
         SET ${usersFields.join(', ')},
             updated_at = NOW()
         WHERE user_id = $${userUpdateEntries.length + 1}`,
        usersValues
      );
    }

    const memberFields = [];
    const memberValues = [];
    let mIdx = 1;

    const pushMemberField = (field, value) => {
      memberFields.push(`${field} = $${mIdx}`);
      memberValues.push(value);
      mIdx += 1;
    };

    let nextDepartmentId = current.department_id ? Number(current.department_id) : null;
    let nextDesignationId = current.designation_id ? Number(current.designation_id) : null;
    let nextLocationId = current.location_id ? Number(current.location_id) : null;

    if (payload.department_id !== undefined) {
      nextDepartmentId = Number(payload.department_id);
      pushMemberField('department_id', nextDepartmentId);
    }

    if (payload.designation_id !== undefined) {
      nextDesignationId = Number(payload.designation_id);
      pushMemberField('designation_id', nextDesignationId);
    }

    if (payload.location_id !== undefined) {
      nextLocationId = Number(payload.location_id);
      pushMemberField('location_id', nextLocationId);
    }

    if (payload.role_id !== undefined) {
      const roleId = Number(payload.role_id);
      if (!Number.isFinite(roleId) || roleId <= 0) {
        const err = new Error('Invalid role_id');
        err.status = 400;
        throw err;
      }
      await ensureRoleExists(tx, roleId);
      pushMemberField('role_id', roleId);
    }

    if (payload.membership_status !== undefined) {
      pushMemberField('status', payload.membership_status);
    }

    if (payload.department_id !== undefined || payload.designation_id !== undefined) {
      await ensureDepartmentDesignation(tx, organization_id, Number(nextDepartmentId), Number(nextDesignationId));
    }
    if (payload.location_id !== undefined) {
      await ensureLocationExists(tx, organization_id, Number(nextLocationId));
    }

    if (memberFields.length) {
      memberValues.push(organization_id, user_id);
      await tx.query(
        `UPDATE organization_members
         SET ${memberFields.join(', ')},
             updated_at = NOW()
         WHERE organization_id = $${mIdx}
           AND user_id = $${mIdx + 1}`,
        memberValues
      );
    }

    const updated = await selectUserInOrganization(tx, organization_id, user_id);
    return mapUserRow(updated);
  });
};

const bulkUpdateUsersInOrganization = async (organization_id, updates = []) => {
  const rows = [];

  for (const item of updates) {
    const userId = Number(item.user_id);
    const payload = { ...item };
    delete payload.user_id;

    const updated = await updateUserInOrganization(organization_id, userId, payload);
    if (!updated) {
      const err = new Error(`User not found in organization: ${userId}`);
      err.status = 404;
      throw err;
    }
    rows.push(updated);
  }

  return rows;
};

const softDeleteUserInOrganization = async (organization_id, user_id) => {
  return db.withTransaction(async (tx) => {
    const current = await selectUserInOrganization(tx, organization_id, user_id);
    if (!current) return null;

    await tx.query(
      `UPDATE users
       SET status = 'archived',
           updated_at = NOW()
       WHERE user_id = $1`,
      [user_id]
    );

    await tx.query(
      `UPDATE organization_members
       SET status = 'left',
           updated_at = NOW()
       WHERE organization_id = $1
         AND user_id = $2`,
      [organization_id, user_id]
    );

    const updated = await selectUserInOrganization(tx, organization_id, user_id);
    return mapUserRow(updated);
  });
};

const deactivateUserInOrganization = async (organization_id, user_id) => {
  return db.withTransaction(async (tx) => {
    const current = await selectUserInOrganization(tx, organization_id, user_id);
    if (!current) return null;

    await tx.query(
      `UPDATE users
       SET status = 'suspended',
           updated_at = NOW()
       WHERE user_id = $1`,
      [user_id]
    );

    await tx.query(
      `UPDATE organization_members
       SET status = 'suspended',
           updated_at = NOW()
       WHERE organization_id = $1
         AND user_id = $2`,
      [organization_id, user_id]
    );

    const updated = await selectUserInOrganization(tx, organization_id, user_id);
    return mapUserRow(updated);
  });
};

const activateUserInOrganization = async (organization_id, user_id) => {
  return db.withTransaction(async (tx) => {
    const current = await selectUserInOrganization(tx, organization_id, user_id);
    if (!current) return null;

    const currentMembershipStatus = String(current.membership_status || '')
      .trim()
      .toLowerCase();
    if (currentMembershipStatus !== 'active') {
      const license = await getOrganizationLicenseSnapshot(tx, organization_id);
      if (license.maxUsers > 0 && license.activeMembers >= license.maxUsers) {
        const err = new Error(
          `User limit reached for current plan (${license.activeMembers}/${license.maxUsers}). Please upgrade licenses.`
        );
        err.status = 409;
        throw err;
      }
    }

    await tx.query(
      `UPDATE users
       SET status = 'active',
           updated_at = NOW()
       WHERE user_id = $1`,
      [user_id]
    );

    await tx.query(
      `UPDATE organization_members
       SET status = 'active',
           updated_at = NOW()
       WHERE organization_id = $1
         AND user_id = $2`,
      [organization_id, user_id]
    );

    const updated = await selectUserInOrganization(tx, organization_id, user_id);
    return mapUserRow(updated);
  });
};

const bulkSoftDeleteUsersInOrganization = async (organization_id, user_ids = []) => {
  const results = [];

  for (const user_id of user_ids) {
    const deleted = await softDeleteUserInOrganization(organization_id, user_id);
    if (!deleted) {
      const err = new Error(`User not found in organization: ${user_id}`);
      err.status = 404;
      throw err;
    }
    results.push(deleted);
  }

  return results;
};

module.exports = {
  createUserInOrganization,
  findUsersInOrganization,
  findUserByIdInOrganization,
  resetUserPasswordByEmailInOrganization,
  updateUserInOrganization,
  bulkUpdateUsersInOrganization,
  softDeleteUserInOrganization,
  bulkSoftDeleteUsersInOrganization,
  deactivateUserInOrganization,
  activateUserInOrganization,
};
