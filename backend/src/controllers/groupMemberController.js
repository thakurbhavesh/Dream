const db = require('../config/database');
const groupMemberModel = require('../models/groupMemberModel');
const groupTimelineModel = require('../models/groupTimelineModel');
const { success } = require('../utils/response');
const { parsePagination } = require('../utils/common/common_function');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');
const { withEntityCache, bumpEntityVersion } = require('../utils/cache');
const { invalidateGroupMembersCache } = require('../socket');

const GROUP_MEMBERS_ENTITY = 'group_members';
const GROUP_TIMELINE_ENTITY = 'group_timeline';
const GROUPS_ENTITY = 'groups';

const parsePositiveInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    const err = new Error(`${fieldName} must be a positive number`);
    err.status = 400;
    throw err;
  }
  return parsed;
};

const resolveOrganizationId = (req, fallbackValue) => {
  const bodyOrg = req.body?.organization_id;
  const tokenOrg = req.user?.org;
  const raw = bodyOrg !== undefined ? bodyOrg : (fallbackValue !== undefined ? fallbackValue : tokenOrg);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    const err = new Error('organization_id is required (body or login token org)');
    err.status = 400;
    throw err;
  }
  return parsed;
};

const ensureRecordOrganization = (recordOrganizationId, organizationId) => {
  if (Number(recordOrganizationId) !== Number(organizationId)) {
    const err = new Error('Group member not found');
    err.status = 404;
    throw err;
  }
};

const ensureGroupOrganizationMatch = async (executor, groupId, organizationId, options = {}) => {
  const requireActive = options.requireActive === true;
  const result = await executor.query(
    `SELECT group_id, organization_id, status
     FROM groups
     WHERE group_id = $1
     LIMIT 1`,
    [groupId]
  );

  if (!result.rows.length) {
    const err = new Error('Group not found');
    err.status = 404;
    throw err;
  }

  const groupOrgId = Number(result.rows[0].organization_id);
  if (groupOrgId !== Number(organizationId)) {
    const err = new Error('organization_id must match the group organization');
    err.status = 400;
    throw err;
  }

  const groupStatus = String(result.rows[0].status || '').toLowerCase();
  if (requireActive && groupStatus !== 'active') {
    const err = new Error('Cannot add member: group is not active');
    err.status = 400;
    throw err;
  }
};

const ensureUserBelongsToOrganization = async (executor, userId, organizationId) => {
  const result = await executor.query(
    `SELECT membership_id
     FROM organization_members
     WHERE user_id = $1
       AND organization_id = $2
       AND status = 'active'
     LIMIT 1`,
    [userId, organizationId]
  );

  if (!result.rows.length) {
    const err = new Error('user_id is not an active member of this organization');
    err.status = 400;
    throw err;
  }
};

const resolveGroupAndUserNames = async (executor, { groupId, userId }) => {
  const [groupResult, userResult] = await Promise.all([
    executor.query(
      `SELECT group_name
       FROM groups
       WHERE group_id = $1
       LIMIT 1`,
      [groupId]
    ),
    executor.query(
      `SELECT name
       FROM users
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    ),
  ]);

  return {
    groupName: String(groupResult.rows[0]?.group_name || `Group ${groupId}`),
    userName: String(userResult.rows[0]?.name || `User ${userId}`),
  };
};

const handlePgError = (error) => {
  if (error?.code === '23505') {
    error.status = 409;
    if (error.constraint === 'uk_group_user') {
      error.message = 'User is already a member of this group';
    } else {
      error.message = 'Duplicate record conflict';
    }
    return error;
  }

  if (error?.code === '23503') {
    error.status = 400;
    if (error.constraint === 'fk_gmem_group') {
      error.message = 'Invalid group_id: group does not exist';
    } else if (error.constraint === 'fk_gmem_user') {
      error.message = 'Invalid user_id: user does not exist';
    } else if (error.constraint === 'fk_gmem_org') {
      error.message = 'Invalid organization_id: organization does not exist';
    } else {
      error.message = 'Invalid reference for group member';
    }
    return error;
  }

  if (error?.code === '23514') {
    error.status = 400;
    error.message = 'Invalid status value for group member';
    return error;
  }

  return error;
};

const getGroupMembers = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req, req.query?.organization_id);
    const data = await withEntityCache(GROUP_MEMBERS_ENTITY, req, async () => {
      const { limit, offset } = parsePagination(req.query);
      const group_id = req.query.group_id ? parsePositiveInt(req.query.group_id, 'group_id') : undefined;
      const user_id = req.query.user_id ? parsePositiveInt(req.query.user_id, 'user_id') : undefined;
      const status = req.query.status ? String(req.query.status).trim().toLowerCase() : undefined;

      return groupMemberModel.findGroupMembers({
        group_id,
        organization_id: organizationId,
        user_id,
        status,
        limit,
        offset,
      });
    });

    return success(res, { count: data.total, rows: data.rows }, 'Group members retrieved');
  } catch (error) {
    return next(handlePgError(error));
  }
};

const getGroupMembersByGroupName = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req, req.query?.organization_id);
    const group_name = String(req.query.group_name || '').trim();
    if (!group_name) {
      const err = new Error('group_name query is required');
      err.status = 400;
      throw err;
    }

    const data = await withEntityCache(GROUP_MEMBERS_ENTITY, req, async () => {
      const { limit, offset } = parsePagination(req.query);
      const status = req.query.status ? String(req.query.status).trim().toLowerCase() : undefined;

      return groupMemberModel.findMembersByGroupName({
        group_name,
        organization_id: organizationId,
        status,
        limit,
        offset,
      });
    });

    const rows = data.rows.map((row) => ({
      group_member_id: row.group_member_id,
      group_id: row.group_id,
      group_name: row.group_name,
      organization_id: row.organization_id,
      user_id: row.user_id,
      name: row.name,
      email: row.email,
      is_admin: row.is_admin,
      member_status: row.member_status,
    }));

    return success(res, { count: data.total, rows }, 'Group members retrieved by group name');
  } catch (error) {
    return next(handlePgError(error));
  }
};

const getGroupMember = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req, req.query?.organization_id);
    const groupMemberId = parsePositiveInt(req.params.id, 'id');
    const member = await withEntityCache(GROUP_MEMBERS_ENTITY, req, async () =>
      groupMemberModel.findGroupMemberById(groupMemberId)
    );
    if (!member) {
      const err = new Error('Group member not found');
      err.status = 404;
      throw err;
    }
    ensureRecordOrganization(member.organization_id, organizationId);
    return success(res, member, 'Group member retrieved');
  } catch (error) {
    return next(handlePgError(error));
  }
};

const createGroupMember = async (req, res, next) => {
  try {
    const actorUserId = parsePositiveInt(req.user?.sub, 'actor_user_id');
    const organizationId = resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organizationId });
    const created = await db.withTransaction(async (tx) => {
      const payload = {
        ...req.body,
        organization_id: organizationId,
      };

      await ensureGroupOrganizationMatch(tx, payload.group_id, payload.organization_id, { requireActive: true });
      await ensureUserBelongsToOrganization(tx, payload.user_id, payload.organization_id);
      const row = await groupMemberModel.createGroupMember(payload, tx);
      const names = await resolveGroupAndUserNames(tx, {
        groupId: row.group_id,
        userId: row.user_id,
      });

      await groupTimelineModel.createTimelineEvent(
        {
          group_id: row.group_id,
          actor_user_id: actorUserId,
          target_user_id: row.user_id,
          event_type: 'member_added',
          event_description: `${names.userName} added to group "${names.groupName}"`,
          organization_id: row.organization_id,
          status: 'visible',
        },
        tx
      );

      await logActivitySafe(
        {
          ...actor,
          ...requestMeta,
          context_organization_id: row.organization_id,
          target_type: 'group_member',
          target_id: row.group_member_id,
          action: 'group_member.create',
          action_category: 'collaboration',
          action_subtype: 'group_member_add',
          description: `User ${row.user_id} added to group ${row.group_id}`,
          new_values: row,
          is_successful: true,
          status: 'success',
        },
        { tx }
      );

      return row;
    });

    bumpEntityVersion(GROUP_MEMBERS_ENTITY);
    bumpEntityVersion(GROUP_TIMELINE_ENTITY);
    bumpEntityVersion(GROUPS_ENTITY);
    invalidateGroupMembersCache(created.group_id);

    return success(res, created, 'Group member created', 201);
  } catch (error) {
    return next(error);
  }
};

const updateGroupMember = async (req, res, next) => {
  try {
    const groupMemberId = parsePositiveInt(req.params.id, 'id');
    const actorUserId = parsePositiveInt(req.user?.sub, 'actor_user_id');
    const requestMeta = buildRequestMeta(req);

    const updated = await db.withTransaction(async (tx) => {
      const before = await groupMemberModel.findGroupMemberById(groupMemberId, tx);
      if (!before) return null;
      const actor = buildActorFromRequest(req, { context_organization_id: before.organization_id });

      const payload = {
        ...req.body,
        organization_id: resolveOrganizationId(req, before.organization_id),
      };

      await ensureGroupOrganizationMatch(tx, payload.group_id, payload.organization_id);
      await ensureUserBelongsToOrganization(tx, payload.user_id, payload.organization_id);

      const row = await groupMemberModel.updateGroupMemberPut(groupMemberId, payload, tx);
      if (!row) return null;
      const names = await resolveGroupAndUserNames(tx, {
        groupId: row.group_id,
        userId: row.user_id,
      });

      await groupTimelineModel.createTimelineEvent(
        {
          group_id: row.group_id,
          actor_user_id: actorUserId,
          target_user_id: row.user_id,
          event_type: 'member_updated',
          event_description: `${names.userName} updated in group "${names.groupName}"`,
          organization_id: row.organization_id,
          status: 'visible',
        },
        tx
      );

      await logActivitySafe(
        {
          ...actor,
          ...requestMeta,
          context_organization_id: row.organization_id,
          target_type: 'group_member',
          target_id: row.group_member_id,
          action: 'group_member.update',
          action_category: 'collaboration',
          action_subtype: 'group_member_update_put',
          description: `Group member ${row.group_member_id} updated via PUT`,
          old_values: before,
          new_values: row,
          is_successful: true,
          status: 'success',
        },
        { tx }
      );

      return { row, before };
    });

    bumpEntityVersion(GROUP_MEMBERS_ENTITY);
    bumpEntityVersion(GROUP_TIMELINE_ENTITY);
    bumpEntityVersion(GROUPS_ENTITY);
    if (updated?.row) invalidateGroupMembersCache(updated.row.group_id);

    if (!updated) {
      const err = new Error('Group member not found');
      err.status = 404;
      throw err;
    }

    return success(res, updated.row, 'Group member updated');
  } catch (error) {
    return next(error);
  }
};

const patchGroupMember = async (req, res, next) => {
  try {
    const groupMemberId = parsePositiveInt(req.params.id, 'id');
    const actorUserId = parsePositiveInt(req.user?.sub, 'actor_user_id');
    const requestMeta = buildRequestMeta(req);

    const patched = await db.withTransaction(async (tx) => {
      const before = await groupMemberModel.findGroupMemberById(groupMemberId, tx);
      if (!before) return null;
      const actor = buildActorFromRequest(req, { context_organization_id: before.organization_id });

      const patchPayload = { ...req.body };
      patchPayload.organization_id = resolveOrganizationId(req, before.organization_id);
      const effectiveGroupId = patchPayload.group_id ?? before.group_id;
      const effectiveOrganizationId = patchPayload.organization_id ?? before.organization_id;
      const effectiveUserId = patchPayload.user_id ?? before.user_id;

      await ensureGroupOrganizationMatch(tx, effectiveGroupId, effectiveOrganizationId);
      await ensureUserBelongsToOrganization(tx, effectiveUserId, effectiveOrganizationId);

      const row = await groupMemberModel.updateGroupMemberPatch(groupMemberId, patchPayload, tx);
      if (!row) return { noFields: true };
      const names = await resolveGroupAndUserNames(tx, {
        groupId: row.group_id,
        userId: row.user_id,
      });

      await groupTimelineModel.createTimelineEvent(
        {
          group_id: row.group_id,
          actor_user_id: actorUserId,
          target_user_id: row.user_id,
          event_type: 'member_patched',
          event_description: `${names.userName} updated in group "${names.groupName}"`,
          organization_id: row.organization_id,
          status: 'visible',
        },
        tx
      );

      await logActivitySafe(
        {
          ...actor,
          ...requestMeta,
          context_organization_id: row.organization_id,
          target_type: 'group_member',
          target_id: row.group_member_id,
          action: 'group_member.patch',
          action_category: 'collaboration',
          action_subtype: 'group_member_update_patch',
          description: `Group member ${row.group_member_id} updated via PATCH`,
          old_values: before,
          new_values: row,
          is_successful: true,
          status: 'success',
        },
        { tx }
      );

      return { row };
    });

    bumpEntityVersion(GROUP_MEMBERS_ENTITY);
    bumpEntityVersion(GROUP_TIMELINE_ENTITY);
    bumpEntityVersion(GROUPS_ENTITY);
    if (patched?.row) invalidateGroupMembersCache(patched.row.group_id);

    if (!patched) {
      const err = new Error('Group member not found');
      err.status = 404;
      throw err;
    }

    if (patched.noFields) {
      const err = new Error('No fields to update');
      err.status = 400;
      throw err;
    }

    return success(res, patched.row, 'Group member updated');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getGroupMembers,
  getGroupMembersByGroupName,
  getGroupMember,
  createGroupMember,
  updateGroupMember,
  patchGroupMember,
};
