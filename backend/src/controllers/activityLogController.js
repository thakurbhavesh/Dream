const db = require('../config/database');
const activityLogModel = require('../models/activityLogModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');

const resolveOrganizationId = async (req) => {
  const tokenOrgId = Number(req.user?.org);
  const requestedOrgId = Number(req.query?.organization_id || req.body?.organization_id);
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

const parseBool = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'no'].includes(normalized)) return false;
  return undefined;
};

const getActivityLogs = async (req, res, next) => {
  try {
    const context_organization_id = await resolveOrganizationId(req);
    const { limit, offset } = parsePagination(req.query);
    const search = parseSearch(req.query);

    const userIdRaw = req.query.user_id ?? req.body?.user_id;
    const actorIdRaw = req.query.actor_id ?? req.body?.actor_id;
    const user_id = userIdRaw !== undefined ? Number(userIdRaw) : undefined;
    const actor_id = actorIdRaw !== undefined ? Number(actorIdRaw) : undefined;

    if (userIdRaw !== undefined && (!Number.isFinite(user_id) || user_id <= 0)) {
      const err = new Error('user_id must be a positive number');
      err.status = 400;
      throw err;
    }

    if (actorIdRaw !== undefined && (!Number.isFinite(actor_id) || actor_id <= 0)) {
      const err = new Error('actor_id must be a positive number');
      err.status = 400;
      throw err;
    }

    const occurred_from = req.query.occurred_from || req.body?.occurred_from;
    const occurred_to = req.query.occurred_to || req.body?.occurred_to;
    const action = req.query.action || req.body?.action;
    const action_category = req.query.action_category || req.body?.action_category;
    const status = req.query.status || req.body?.status;
    const is_successful = parseBool(req.query.is_successful ?? req.body?.is_successful);
    const exclude_actions_raw = req.query.exclude_actions || req.body?.exclude_actions;
    const exclude_actions = exclude_actions_raw
      ? (Array.isArray(exclude_actions_raw) ? exclude_actions_raw : String(exclude_actions_raw).split(',').map(s => s.trim()).filter(Boolean))
      : undefined;

    const { rows, total } = await activityLogModel.findActivityLogs({
      context_organization_id,
      user_id,
      actor_id,
      action,
      action_category,
      exclude_actions,
      status,
      is_successful,
      search,
      occurred_from,
      occurred_to,
      limit,
      offset,
    });

    // Collect all unique IDs referenced in descriptions for batch name resolution
    const planIds = new Set();
    const userIds = new Set();
    const deptIds = new Set();
    const groupIds = new Set();
    for (const item of rows) {
      const desc = item.description || '';
      // Match patterns like "plan 4", "user 2", "department 3", "group 5"
      for (const m of desc.matchAll(/\bplan\s+(\d+)/gi)) planIds.add(Number(m[1]));
      for (const m of desc.matchAll(/\buser\s+(\d+)/gi)) userIds.add(Number(m[1]));
      for (const m of desc.matchAll(/\bdepartment\s+(\d+)/gi)) deptIds.add(Number(m[1]));
      for (const m of desc.matchAll(/\bgroup\s+(\d+)/gi)) groupIds.add(Number(m[1]));
    }

    // Batch fetch names for referenced entities
    const nameMap = {};
    const batchLookup = async (ids, table, idCol, nameCol, prefix) => {
      if (!ids.size) return;
      const arr = Array.from(ids);
      const { rows: nameRows } = await db.query(
        `SELECT ${idCol} AS id, ${nameCol} AS name FROM ${table} WHERE ${idCol} = ANY($1)`,
        [arr]
      );
      for (const r of nameRows) nameMap[`${prefix}:${r.id}`] = r.name;
    };
    await Promise.all([
      batchLookup(planIds, 'plans', 'plan_id', 'plan_name', 'plan'),
      batchLookup(userIds, 'users', 'user_id', 'name', 'user'),
      batchLookup(deptIds, 'departments', 'department_id', 'name', 'department'),
      batchLookup(groupIds, 'groups', 'group_id', 'group_name', 'group'),
    ]);

    const resolveDescription = (desc, orgId, orgName) => {
      if (!desc) return '';
      let result = desc;
      // Replace organization ID
      if (orgName && orgId) {
        result = result.replace(new RegExp(`\\borganization\\s+${orgId}\\b`, 'gi'), orgName);
      }
      // Replace plan/user/department/group IDs with names
      result = result.replace(/\b(plan|user|department|group)\s+(\d+)\b/gi, (match, type, id) => {
        const key = `${type.toLowerCase()}:${id}`;
        return nameMap[key] ? nameMap[key] : match;
      });
      return result;
    };

    const formattedRows = rows.map((item) => {
      const description = resolveDescription(
        item.description,
        item.context_organization_id,
        item.context_organization_name
      );

      return {
      log_id: item.log_id,
      occurred_at: item.occurred_at,
      status: item.status,
      is_successful: item.is_successful,
      action: item.action,
      action_category: item.action_category,
      action_subtype: item.action_subtype,
      description,
      organization: {
        organization_id: item.context_organization_id,
        name: item.context_organization_name || null,
      },
      user: {
        user_id: item.target_type === 'user' ? item.target_id : item.actor_id,
        name: item.user_name || null,
        email: item.user_email || null,
      },
      actor: {
        actor_id: item.actor_id,
        role_key: item.actor_role_key,
        name: item.actor_name || null,
        email: item.actor_email || null,
      },
      target: {
        type: item.target_type,
        id: item.target_id,
        name: item.target_user_name || null,
        email: item.target_user_email || null,
      },
      changes: {
        old_values: item.old_values || null,
        new_values: item.new_values || null,
      },
      request_meta: {
        ip_address: item.ip_address || null,
        user_agent: item.user_agent || null,
      },
    }; });

    return success(
      res,
      {
        count: total,
        rows: formattedRows,
      },
      'Activity logs retrieved'
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getActivityLogs,
};
