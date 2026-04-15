const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const orgUserModel = require('../models/orgUserModel');
const db = require('../config/database');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');
const { sendMailAsync } = require('../utils/mail');
const { resolveMailBranding } = require('../utils/mailBranding');
const {
  getOrgUserAccountCreatedMailTemplate,
  getOrgUserPasswordResetMailTemplate,
} = require('../templates/mail');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');
const { withEntityCache, bumpEntityVersion } = require('../utils/cache');

const ENTITY = 'org_users';

const runInBackground = (promise, context) => {
  if (!promise || typeof promise.then !== 'function') return;
  promise.catch((error) => {
    console.error(`Background task failed: ${context}`, {
      message: error.message,
    });
  });
};

const generateTemporaryPassword = () => crypto.randomBytes(9).toString('base64url');
const isSuperAdminMembership = (user = {}) => {
  const roleId = Number(user?.role_id);
  const roleKey = String(user?.role_key || '').trim().toLowerCase();
  const roleName = String(user?.role_name || '').trim().toLowerCase();
  return roleId === 3 || roleKey === 'super_admin' || roleName === 'super admin';
};

const dispatchCredentialMail = async ({
  type,
  email,
  name,
  tempPassword,
}) => {
  const branding = await resolveMailBranding();
  const templateBuilder =
    type === 'password_reset'
      ? getOrgUserPasswordResetMailTemplate
      : getOrgUserAccountCreatedMailTemplate;
  const template = templateBuilder({
    name,
    tempPassword,
    appName: branding.appName,
    supportEmail: branding.supportEmail,
  });

  try {
    await sendMailAsync({
      to: email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
    return {
      credential_sent: true,
      mail_error: null,
    };
  } catch (error) {
    return {
      credential_sent: false,
      mail_error: error?.message || 'Unable to send credential email',
    };
  }
};

const resolveOrganizationId = async (req) => {
  const tokenOrgId = Number(req.user?.org);
  const requestedOrgId = Number(req.body?.organization_id || req.query?.organization_id);
  const orgId = Number.isFinite(requestedOrgId) && requestedOrgId > 0 ? requestedOrgId : tokenOrgId;

  if (!Number.isFinite(orgId) || orgId <= 0) {
    const err = new Error('Valid organization context is required');
    err.status = 400;
    throw err;
  }

  const requesterUserId = Number(req.user?.sub);
  if (!Number.isFinite(requesterUserId) || requesterUserId <= 0) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  const membershipResult = await db.query(
    `SELECT membership_id
     FROM organization_members
     WHERE organization_id = $1
       AND user_id = $2
       AND status = 'active'
     LIMIT 1`,
    [orgId, requesterUserId]
  );

  if (!membershipResult.rows.length) {
    const err = new Error('Access denied for requested organization');
    err.status = 403;
    throw err;
  }

  return orgId;
};

const createUser = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organization_id });
    const user = await orgUserModel.createUserInOrganization({
      organization_id,
      name: req.body.name,
      email: req.body.email,
      mobile: req.body.mobile,
      role_id: req.body.role_id,
      department_id: req.body.department_id,
      designation_id: req.body.designation_id,
      location_id: req.body.location_id,
      is_platform_admin: req.body.is_platform_admin,
      is_global_member: req.body.is_global_member,
    });

    let credential_sent = null;
    let mail_error = null;
    if (user.temp_password) {
      runInBackground((async () => {
        const delivery = await dispatchCredentialMail({
          type: 'account_created',
          email: user.email,
          name: user.name,
          tempPassword: user.temp_password,
        });
        if (!delivery?.credential_sent) {
          console.error('Credential mail delivery failed', {
            email: user.email,
            error: delivery?.mail_error || 'unknown',
          });
        }
      })(), 'org_user.create.credential_mail');
    }

    const responseData = {
      ...user,
      credential_sent,
      mail_error,
      credentials: user.temp_password
        ? {
          email: user.email,
          temporary_password: user.temp_password,
        }
        : null,
    };
    const activitySafeData = {
      ...responseData,
      credentials: responseData.credentials
        ? {
          email: responseData.credentials.email,
        }
        : null,
    };

    runInBackground(logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organization_id,
      target_type: 'user',
      target_id: responseData.user_id,
      action: 'user.create',
      action_category: 'user_management',
      action_subtype: 'organization_user_create',
      description: `User ${responseData.email} added to organization ${organization_id}`,
      new_values: activitySafeData,
      is_successful: true,
      status: 'success',
    }), 'org_user.create.activity_log');
    bumpEntityVersion(ENTITY);

    return success(res, responseData, 'User created in organization', 201);
  } catch (error) {
    return next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const data = await withEntityCache(ENTITY, req, async () => {
      const all = ['1', 'true', 'yes'].includes(String(req.query?.all || '').toLowerCase());
      const { limit, offset } = all
        ? { limit: 100000, offset: 0 }
        : parsePagination(req.query);
      const search = parseSearch(req.query);
      const { rows, total } = await orgUserModel.findUsersInOrganization({
        organization_id,
        search,
        limit,
        offset,
      });

      return { count: total, rows };
    });

    return success(res, data, 'Organization users retrieved');
  } catch (error) {
    return next(error);
  }
};

const getDirectory = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const search = parseSearch(req.query);
    const { rows } = await orgUserModel.findUsersInOrganization({
      organization_id,
      search,
      limit: 100000,
      offset: 0,
    });
    const selfId = Number(req.user?.sub);
    const list = (rows || [])
      .map((u) => ({
        user_id: Number(u.user_id),
        name: u.name || [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email,
        email: u.email,
        avatar: u.profile_url || u.avatar || '',
      }))
      .filter((u) => u.user_id && u.user_id !== selfId);
    return success(res, { count: list.length, rows: list }, 'Organization directory retrieved');
  } catch (error) {
    return next(error);
  }
};

const getUser = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const user = await withEntityCache(ENTITY, req, async () =>
      orgUserModel.findUserByIdInOrganization(organization_id, req.params.id)
    );
    if (!user) {
      const err = new Error('User not found in organization');
      err.status = 404;
      throw err;
    }

    return success(res, user, 'Organization user retrieved');
  } catch (error) {
    return next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organization_id });
    const oldUser = await orgUserModel.findUserByIdInOrganization(organization_id, req.params.id);
    const user = await orgUserModel.updateUserInOrganization(organization_id, req.params.id, req.body);
    if (!user) {
      const err = new Error('User not found in organization');
      err.status = 404;
      throw err;
    }

    runInBackground(logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organization_id,
      target_type: 'user',
      target_id: user.user_id,
      action: 'user.update',
      action_category: 'user_management',
      action_subtype: 'organization_user_update',
      description: `User ${user.email} updated in organization ${organization_id}`,
      old_values: oldUser,
      new_values: user,
      is_successful: true,
      status: 'success',
    }), 'org_user.update.activity_log');
    bumpEntityVersion(ENTITY);

    return success(res, user, 'Organization user updated');
  } catch (error) {
    return next(error);
  }
};

const bulkUpdateUsers = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organization_id });
    const updates = req.body?.updates || [];
    const rows = await orgUserModel.bulkUpdateUsersInOrganization(organization_id, updates);

    runInBackground(logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organization_id,
      target_type: 'organization_members',
      target_id: organization_id,
      action: 'user.bulk_update',
      action_category: 'user_management',
      action_subtype: 'organization_user_bulk_update',
      description: `${rows.length} users updated in organization ${organization_id}`,
      new_values: {
        count: rows.length,
        user_ids: rows.map((item) => item.user_id),
      },
      is_successful: true,
      status: 'success',
    }), 'org_user.bulk_update.activity_log');
    bumpEntityVersion(ENTITY);

    return success(
      res,
      {
        count: rows.length,
        rows,
      },
      'Organization users updated'
    );
  } catch (error) {
    return next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organization_id });
    const oldUser = await orgUserModel.findUserByIdInOrganization(organization_id, req.params.id);
    if (!oldUser) {
      const err = new Error('User not found in organization');
      err.status = 404;
      throw err;
    }
    if (isSuperAdminMembership(oldUser)) {
      const err = new Error('Super Admin cannot be deleted');
      err.status = 403;
      throw err;
    }
    const user = await orgUserModel.softDeleteUserInOrganization(organization_id, req.params.id);
    if (!user) {
      const err = new Error('User not found in organization');
      err.status = 404;
      throw err;
    }

    runInBackground(logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organization_id,
      target_type: 'user',
      target_id: user.user_id,
      action: 'user.soft_delete',
      action_category: 'user_management',
      action_subtype: 'status_archived',
      description: `User ${user.email} archived and moved to ex-members in organization ${organization_id}`,
      old_values: oldUser,
      new_values: user,
      is_successful: true,
      status: 'success',
    }), 'org_user.soft_delete.activity_log');
    bumpEntityVersion(ENTITY);

    return success(res, user, 'User set to inactive and moved to Ex-Members');
  } catch (error) {
    return next(error);
  }
};

const resetUserPassword = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organization_id });
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      const err = new Error('email is required');
      err.status = 400;
      throw err;
    }

    const providedPassword = req.body?.new_password ? String(req.body.new_password) : null;
    if (providedPassword && providedPassword.length < 8) {
      const err = new Error('new_password must be at least 8 characters');
      err.status = 400;
      throw err;
    }

    if (providedPassword) {
      const existingUserResult = await db.query(
        `SELECT u.password_hash
         FROM organization_members om
         JOIN users u ON u.user_id = om.user_id
         WHERE om.organization_id = $1
           AND LOWER(u.email) = LOWER($2)
         LIMIT 1`,
        [organization_id, email]
      );

      if (existingUserResult.rows.length) {
        const isSamePassword = await bcrypt.compare(providedPassword, existingUserResult.rows[0].password_hash);
        if (isSamePassword) {
          const err = new Error('New password must be different from current password');
          err.status = 400;
          throw err;
        }
      }
    }

    const tempPassword = providedPassword || generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await orgUserModel.resetUserPasswordByEmailInOrganization(
      organization_id,
      email,
      passwordHash
    );
    if (!user) {
      const err = new Error('User not found in organization');
      err.status = 404;
      throw err;
    }

    const delivery = await dispatchCredentialMail({
      type: 'password_reset',
      email: user.email,
      name: user.name,
      tempPassword,
    });

    runInBackground(logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organization_id,
      target_type: 'user',
      target_id: user.user_id,
      action: 'user.password_reset',
      action_category: 'security',
      action_subtype: 'organization_admin_reset',
      description: `Password reset triggered for ${user.email} in organization ${organization_id}`,
      new_values: {
        email: user.email,
        credential_sent: delivery.credential_sent,
      },
      is_successful: true,
      status: 'success',
    }), 'org_user.reset_password.activity_log');
    bumpEntityVersion(ENTITY);

    return success(
      res,
      {
        email: user.email,
        temporary_password: tempPassword,
        credential_sent: delivery.credential_sent,
        mail_error: delivery.mail_error,
      },
      'User password reset successfully'
    );
  } catch (error) {
    return next(error);
  }
};

const resendInvite = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organization_id });
    const userId = Number(req.params.id);

    if (!Number.isFinite(userId) || userId <= 0) {
      const err = new Error('Valid user id is required');
      err.status = 400;
      throw err;
    }

    const existingUser = await orgUserModel.findUserByIdInOrganization(organization_id, userId);
    if (!existingUser) {
      const err = new Error('User not found in organization');
      err.status = 404;
      throw err;
    }

    const tempPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const updatedUser = await orgUserModel.resetUserPasswordByEmailInOrganization(
      organization_id,
      existingUser.email,
      passwordHash
    );
    if (!updatedUser) {
      const err = new Error('User not found in organization');
      err.status = 404;
      throw err;
    }

    const delivery = await dispatchCredentialMail({
      type: 'account_created',
      email: updatedUser.email,
      name: updatedUser.name,
      tempPassword,
    });

    runInBackground(logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organization_id,
      target_type: 'user',
      target_id: updatedUser.user_id,
      action: 'user.resend_invite',
      action_category: 'user_management',
      action_subtype: 'organization_admin_resend_invite',
      description: `Invite resent for ${updatedUser.email} in organization ${organization_id}`,
      new_values: {
        email: updatedUser.email,
        credential_sent: delivery.credential_sent,
      },
      is_successful: true,
      status: 'success',
    }), 'org_user.resend_invite.activity_log');
    bumpEntityVersion(ENTITY);

    return success(
      res,
      {
        user_id: updatedUser.user_id,
        email: updatedUser.email,
        temporary_password: tempPassword,
        credential_sent: delivery.credential_sent,
        mail_error: delivery.mail_error,
      },
      'Invite resent successfully'
    );
  } catch (error) {
    return next(error);
  }
};

const deactivateUser = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organization_id });
    const oldUser = await orgUserModel.findUserByIdInOrganization(organization_id, req.params.id);
    if (!oldUser) {
      const err = new Error('User not found in organization');
      err.status = 404;
      throw err;
    }
    if (isSuperAdminMembership(oldUser)) {
      const err = new Error('Super Admin cannot be suspended');
      err.status = 403;
      throw err;
    }
    const user = await orgUserModel.deactivateUserInOrganization(organization_id, req.params.id);
    if (!user) {
      const err = new Error('User not found in organization');
      err.status = 404;
      throw err;
    }

    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organization_id,
      target_type: 'user',
      target_id: user.user_id,
      action: 'user.deactivate',
      action_category: 'user_management',
      action_subtype: 'status_suspend',
      description: `User ${user.email} deactivated in organization ${organization_id}`,
      old_values: oldUser,
      new_values: user,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);

    return success(res, user, 'User deactivated successfully');
  } catch (error) {
    return next(error);
  }
};

const activateUser = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organization_id });
    const oldUser = await orgUserModel.findUserByIdInOrganization(organization_id, req.params.id);
    const user = await orgUserModel.activateUserInOrganization(organization_id, req.params.id);
    if (!user) {
      const err = new Error('User not found in organization');
      err.status = 404;
      throw err;
    }

    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organization_id,
      target_type: 'user',
      target_id: user.user_id,
      action: 'user.activate',
      action_category: 'user_management',
      action_subtype: 'status_active',
      description: `User ${user.email} activated in organization ${organization_id}`,
      old_values: oldUser,
      new_values: user,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);

    return success(res, user, 'User activated successfully');
  } catch (error) {
    return next(error);
  }
};

const bulkDeleteUsers = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organization_id });
    const user_ids = req.body?.user_ids || [];

    // Check for super admins before deleting
    for (const userId of user_ids) {
      const user = await orgUserModel.findUserByIdInOrganization(organization_id, userId);
      if (!user) {
        const err = new Error(`User not found in organization: ${userId}`);
        err.status = 404;
        throw err;
      }
      if (isSuperAdminMembership(user)) {
        const err = new Error(`Super Admin (user_id: ${userId}) cannot be deleted`);
        err.status = 403;
        throw err;
      }
    }

    const rows = await orgUserModel.bulkSoftDeleteUsersInOrganization(organization_id, user_ids);

    runInBackground(logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organization_id,
      target_type: 'organization_members',
      target_id: organization_id,
      action: 'user.bulk_delete',
      action_category: 'user_management',
      action_subtype: 'organization_user_bulk_delete',
      description: `${rows.length} users archived in organization ${organization_id}`,
      new_values: {
        count: rows.length,
        user_ids: rows.map((item) => item.user_id),
      },
      is_successful: true,
      status: 'success',
    }), 'org_user.bulk_delete.activity_log');
    bumpEntityVersion(ENTITY);

    return success(
      res,
      {
        count: rows.length,
        rows,
      },
      'Users set to inactive and moved to Ex-Members'
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createUser,
  getUsers,
  getDirectory,
  getUser,
  updateUser,
  bulkUpdateUsers,
  bulkDeleteUsers,
  deleteUser,
  resetUserPassword,
  resendInvite,
  deactivateUser,
  activateUser,
};
