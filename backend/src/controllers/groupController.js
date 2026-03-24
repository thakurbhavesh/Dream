const groupModel = require('../models/groupModel');
const groupTimelineModel = require('../models/groupTimelineModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');
const db = require('../config/database');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');
const { withEntityCache, bumpEntityVersion } = require('../utils/cache');

const GROUPS_ENTITY = 'groups';
const GROUP_TIMELINE_ENTITY = 'group_timeline';
const GROUP_MEMBERS_ENTITY = 'group_members';

const parseBoolean = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'no'].includes(normalized)) return false;
  return undefined;
};

const normalizeGroupName = (value) => String(value || '').trim().replace(/\s+/g, ' ');

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

const ensureGroupOrgAccess = (group, organizationId) => {
  if (!group) return;
  if (Number(group.organization_id) !== Number(organizationId)) {
    const err = new Error('Group not found');
    err.status = 404;
    throw err;
  }
};

const handlePgError = (error) => {
  if (error?.code === '23505') {
    error.status = 409;
    error.message = 'Group name already exists in this organization';
    return error;
  }

  if (error?.code === '23503') {
    error.status = 400;
    if (error.constraint === 'fk_group_org') {
      error.message = 'Invalid organization_id: organization does not exist';
    } else if (error.constraint === 'fk_group_creator') {
      error.message = 'Invalid creator user';
    } else {
      error.message = 'Invalid reference data for group';
    }
    return error;
  }

  if (error?.code === '23514') {
    error.status = 400;
    error.message = 'Invalid status value for group';
    return error;
  }

  return error;
};

const getGroups = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req, req.query?.organization_id);
    const data = await withEntityCache(GROUPS_ENTITY, req, async () => {
      const { limit, offset } = parsePagination(req.query);
      const search = parseSearch(req.query);
      return groupModel.findAll({
        organization_id: organizationId,
        status: req.query.status,
        is_airtime: parseBoolean(req.query.is_airtime),
        search,
        limit,
        offset,
      });
    });

    // Sign group_image S3 keys to presigned URLs
    const { signProfileFieldsArray } = require('../utils/signProfileUrls');
    await signProfileFieldsArray(data.rows);

    return success(res, { count: data.total, rows: data.rows }, 'Groups retrieved');
  } catch (error) {
    return next(handlePgError(error));
  }
};

const getGroup = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req, req.query?.organization_id);
    const groupId = Number(req.params.id);
    if (!Number.isFinite(groupId) || groupId <= 0) {
      const err = new Error('Valid group id is required');
      err.status = 400;
      throw err;
    }

    const group = await withEntityCache(GROUPS_ENTITY, req, async () => groupModel.findById(groupId));
    if (!group) {
      const err = new Error('Group not found');
      err.status = 404;
      throw err;
    }
    ensureGroupOrgAccess(group, organizationId);

    return success(res, group, 'Group retrieved');
  } catch (error) {
    return next(handlePgError(error));
  }
};

const createGroup = async (req, res, next) => {
  try {
    const createdBy = Number(req.user?.sub);
    if (!Number.isFinite(createdBy) || createdBy <= 0) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }

    const organizationId = resolveOrganizationId(req);
    const normalizedGroupName = normalizeGroupName(req.body?.group_name);
    if (!normalizedGroupName) {
      const err = new Error('group_name is required');
      err.status = 400;
      throw err;
    }

    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organizationId });
    const group = await db.withTransaction(async (tx) => {
      const duplicate = await groupModel.findDuplicateByName(
        {
          organization_id: organizationId,
          group_name: normalizedGroupName,
        },
        tx
      );
      if (duplicate) {
        const err = new Error('Group name already exists in this organization');
        err.status = 409;
        throw err;
      }

      const created = await groupModel.createGroup(
        {
          ...req.body,
          group_name: normalizedGroupName,
          organization_id: organizationId,
          created_by: createdBy,
        },
        tx
      );

      await groupTimelineModel.createTimelineEvent(
        {
          group_id: created.group_id,
          actor_user_id: createdBy,
          target_user_id: null,
          event_type: 'group_created',
          event_description: `Group "${created.group_name}" created`,
          organization_id: created.organization_id,
          status: 'visible',
        },
        tx
      );

      await logActivitySafe(
        {
          ...actor,
          ...requestMeta,
          context_organization_id: created.organization_id,
          target_type: 'group',
          target_id: created.group_id,
          action: 'group.create',
          action_category: 'collaboration',
          action_subtype: 'group_create',
          description: `Group "${created.group_name}" created (is_airtime=${created.is_airtime})`,
          new_values: created,
          is_successful: true,
          status: 'success',
        },
        { tx }
      );

      return created;
    });

    bumpEntityVersion(GROUPS_ENTITY);
    bumpEntityVersion(GROUP_TIMELINE_ENTITY);
    bumpEntityVersion(GROUP_MEMBERS_ENTITY);

    return success(res, group, 'Group created', 201);
  } catch (error) {
    return next(handlePgError(error));
  }
};

const updateGroup = async (req, res, next) => {
  try {
    const groupId = Number(req.params.id);
    if (!Number.isFinite(groupId) || groupId <= 0) {
      const err = new Error('Valid group id is required');
      err.status = 400;
      throw err;
    }

    const actorUserId = Number(req.user?.sub);
    const requestMeta = buildRequestMeta(req);
    const group = await db.withTransaction(async (tx) => {
      const existing = await groupModel.findById(groupId, tx);
      if (!existing) return null;
      const actor = buildActorFromRequest(req, { context_organization_id: existing.organization_id });

      const payload = {
        ...req.body,
        organization_id: resolveOrganizationId(req, existing.organization_id),
      };

      if (payload.group_name !== undefined) {
        payload.group_name = normalizeGroupName(payload.group_name);
      }
      if (!payload.group_name) {
        const err = new Error('group_name is required for PUT');
        err.status = 400;
        throw err;
      }

      const duplicate = await groupModel.findDuplicateByName(
        {
          organization_id: payload.organization_id,
          group_name: payload.group_name,
          exclude_group_id: groupId,
        },
        tx
      );
      if (duplicate) {
        const err = new Error('Group name already exists in this organization');
        err.status = 409;
        throw err;
      }

      const updated = await groupModel.updateGroupPut(groupId, payload, tx);
      if (!updated) return null;

      if (Number.isFinite(actorUserId) && actorUserId > 0) {
        await groupTimelineModel.createTimelineEvent(
          {
            group_id: updated.group_id,
            actor_user_id: actorUserId,
            target_user_id: null,
            event_type: 'group_updated',
            event_description: `Group "${updated.group_name}" fully updated`,
            organization_id: updated.organization_id,
            status: 'visible',
          },
          tx
        );
      }

      await logActivitySafe(
        {
          ...actor,
          ...requestMeta,
          context_organization_id: updated.organization_id,
          target_type: 'group',
          target_id: updated.group_id,
          action: 'group.update',
          action_category: 'collaboration',
          action_subtype: 'group_update_put',
          description: `Group "${updated.group_name}" updated via PUT`,
          old_values: existing,
          new_values: updated,
          is_successful: true,
          status: 'success',
        },
        { tx }
      );

      return updated;
    });
    bumpEntityVersion(GROUPS_ENTITY);
    bumpEntityVersion(GROUP_TIMELINE_ENTITY);
    if (!group) {
      const err = new Error('Group not found');
      err.status = 404;
      throw err;
    }

    return success(res, group, 'Group updated');
  } catch (error) {
    return next(error);
  }
};

const patchGroup = async (req, res, next) => {
  try {
    const groupId = Number(req.params.id);
    if (!Number.isFinite(groupId) || groupId <= 0) {
      const err = new Error('Valid group id is required');
      err.status = 400;
      throw err;
    }

    const actorUserId = Number(req.user?.sub);
    const requestMeta = buildRequestMeta(req);
    const group = await db.withTransaction(async (tx) => {
      const existing = await groupModel.findById(groupId, tx);
      if (!existing) return null;
      const actor = buildActorFromRequest(req, { context_organization_id: existing.organization_id });

      const payload = {
        ...req.body,
        organization_id: resolveOrganizationId(req, existing.organization_id),
      };

      if (payload.group_name !== undefined) {
        payload.group_name = normalizeGroupName(payload.group_name);
        if (!payload.group_name) {
          const err = new Error('group_name cannot be empty');
          err.status = 400;
          throw err;
        }
      }

      if (payload.group_name !== undefined || payload.organization_id !== existing.organization_id) {
        const duplicateName = payload.group_name ?? existing.group_name;
        const duplicate = await groupModel.findDuplicateByName(
          {
            organization_id: payload.organization_id,
            group_name: duplicateName,
            exclude_group_id: groupId,
          },
          tx
        );
        if (duplicate) {
          const err = new Error('Group name already exists in this organization');
          err.status = 409;
          throw err;
        }
      }

      const patched = await groupModel.updateGroupPatch(groupId, payload, tx);
      if (!patched) return null;

      if (Number.isFinite(actorUserId) && actorUserId > 0) {
        await groupTimelineModel.createTimelineEvent(
          {
            group_id: patched.group_id,
            actor_user_id: actorUserId,
            target_user_id: null,
            event_type: 'group_patched',
            event_description: `Group "${patched.group_name}" partially updated`,
            organization_id: patched.organization_id,
            status: 'visible',
          },
          tx
        );
      }

      await logActivitySafe(
        {
          ...actor,
          ...requestMeta,
          context_organization_id: patched.organization_id,
          target_type: 'group',
          target_id: patched.group_id,
          action: 'group.patch',
          action_category: 'collaboration',
          action_subtype: 'group_update_patch',
          description: `Group "${patched.group_name}" updated via PATCH`,
          old_values: existing,
          new_values: patched,
          is_successful: true,
          status: 'success',
        },
        { tx }
      );

      return patched;
    });
    bumpEntityVersion(GROUPS_ENTITY);
    bumpEntityVersion(GROUP_TIMELINE_ENTITY);
    if (!group) {
      const err = new Error('Group not found or no fields to update');
      err.status = 404;
      throw err;
    }

    return success(res, group, 'Group updated');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getGroups,
  getGroup,
  createGroup,
  updateGroup,
  patchGroup,
};
