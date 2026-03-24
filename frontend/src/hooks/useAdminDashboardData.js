import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "../config/apiBaseUrl";
import { fetchWithAuth } from "../utils/authApi";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no", ""].includes(normalized)) return false;
  return fallback;
};

const isPlatformAdminRole = (roleName = "", roleKey = "") => {
  const normalizedName = String(roleName || "").trim().toLowerCase();
  const normalizedKey = String(roleKey || "").trim().toLowerCase();
  return (
    normalizedName === "super admin" ||
    normalizedName === "admin" ||
    normalizedKey === "super_admin" ||
    normalizedKey === "admin"
  );
};

const normalizeArrayPayload = (payload) => {
  const data = payload?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const resolveOrganizationId = () => {
  if (typeof window === "undefined") return null;
  const candidates = [
    window.localStorage.getItem("organization"),
    window.localStorage.getItem("organization_id"),
    window.localStorage.getItem("organizationId"),
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
};

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  return query.toString();
};

const normalizeUsers = (rows = []) =>
  rows.map((row, index) => ({
    id: Number.isFinite(Number(row?.user_id))
      ? Number(row?.user_id)
      : `user-row-${index + 1}`,
    user_id: Number.isFinite(Number(row?.user_id))
      ? Number(row?.user_id)
      : null,
    name: row?.name || "Unknown",
    email: row?.email || "",
    role_id: toNumber(row?.role_id, row?.is_platform_admin ? 2 : 4),
    role_key: row?.role_key || "",
    role_name: row?.role_name || "",
    department: row?.department_name || "",
    designation: row?.designation_name || "",
    location: row?.location_name || "",
    user_status: row?.user_status || row?.status || "unknown",
    membership_status: row?.membership_status || row?.status || "unknown",
    is_global_member: toBoolean(row?.is_global_member),
    is_platform_admin:
      toBoolean(row?.is_platform_admin) ||
      isPlatformAdminRole(row?.role_name, row?.role_key),
    joined_at: row?.joined_at || null,
    profilePicture: row?.profile_url || "",
  }));

const normalizeDepartments = (rows = []) =>
  rows.map((row, index) => ({
    id: toNumber(row?.department_id, index + 1),
    department_id: toNumber(row?.department_id, index + 1),
    name: row?.name || "",
    status: row?.status || "active",
  }));

const normalizeDesignations = (rows = []) =>
  rows.map((row, index) => ({
    id: toNumber(row?.designation_id, index + 1),
    designation_id: toNumber(row?.designation_id, index + 1),
    title: row?.name || "",
    name: row?.name || "",
    departmentId: toNumber(row?.department_id, 0),
    department_id: toNumber(row?.department_id, 0),
    department_name: row?.department_name || "",
    status: row?.status || "active",
  }));

const normalizeLocations = (rows = []) =>
  rows.map((row, index) => ({
    id: toNumber(row?.location_id, index + 1),
    location_id: toNumber(row?.location_id, index + 1),
    label: row?.label || "",
    city: row?.city || "",
    state: row?.state || "",
    country: row?.country || "",
    address: row?.address || "",
    status: row?.status || "active",
  }));

const normalizeGroups = (rows = []) =>
  rows.map((row, index) => ({
    id: toNumber(row?.group_id, index + 1),
    group_id: toNumber(row?.group_id, index + 1),
    name: row?.group_name || "",
    group_name: row?.group_name || "",
    group_description: row?.group_description || "",
    status: row?.status || "active",
    members: toNumber(row?.active_member_count, 0),
    is_airtime: Boolean(row?.is_airtime),
  }));

const normalizeRoles = (rows = []) =>
  rows.map((row, index) => ({
    id: toNumber(row?.role_id, index + 1),
    role_id: toNumber(row?.role_id, index + 1),
    role_key: row?.role_key || "",
    role_name: row?.role_name || "",
    status: row?.status || "active",
  }));

const normalizeOrganizationSummary = (payload = {}, fallbackOrgId = null) => {
  const data = payload?.data || {};
  const plan = data?.current_plan || null;
  const usage = data?.usage || {};
  const counts = data?.counts || {};

  return {
    organization: data?.organization || {
      organization_id: fallbackOrgId,
      name: "Your Organisation",
    },
    current_plan: plan,
    usage: {
      storage_used_mb: toNumber(usage?.storage_used_mb, 0),
      storage_limit_mb: toNumber(usage?.storage_limit_mb, 0),
      storage_usage_percent: toNumber(usage?.storage_usage_percent, 0),
    },
    counts: {
      total_members: toNumber(counts?.total_members, 0),
      active_members: toNumber(counts?.active_members, 0),
      invited_members: toNumber(counts?.invited_members, 0),
      suspended_members: toNumber(counts?.suspended_members, 0),
      left_members: toNumber(counts?.left_members, 0),
      global_members: toNumber(counts?.global_members, 0),
      platform_admin_members: toNumber(counts?.platform_admin_members, 0),
      departments: toNumber(counts?.departments, 0),
      designations: toNumber(counts?.designations, 0),
      locations: toNumber(counts?.locations, 0),
      total_activity_logs: toNumber(counts?.total_activity_logs, 0),
    },
  };
};

const normalizeProfileMeta = (payload = {}) => {
  const data = payload?.data || {};
  const org = data?.organization || {};
  const userRole = data?.user_role || {};
  const orgMember = data?.organization_member || {};
  const language = org?.language || {};
  const timezone = org?.timezone || {};

  return {
    role_name:
      userRole?.role_name ||
      orgMember?.role_name ||
      userRole?.role_key ||
      orgMember?.role_key ||
      "",
    language: {
      language_id: language?.language_id || org?.language_id || "",
      language_code: language?.language_code || "",
      language_name: language?.language_name || "",
    },
    timezone: {
      timezone_id: timezone?.timezone_id || org?.timezone_id || "",
      timezone_code: timezone?.timezone_code || "",
      timezone_name: timezone?.timezone_name || "",
    },
  };
};

const fetchEndpoint = async (path, query = {}) => {
  const queryString = buildQuery(query);
  const url = queryString ? `${API_BASE_URL}${path}?${queryString}` : `${API_BASE_URL}${path}`;
  const { response, payload } = await fetchWithAuth(url, { method: "GET" });
  if (!response.ok || payload?.status === "error") {
    const message = payload?.message || `Failed to fetch ${path}`;
    throw new Error(message);
  }
  return payload;
};

const unwrapSettledValue = (result, fallback) =>
  result?.status === "fulfilled" ? result.value : fallback;

export const useAdminDashboardData = () => {
  const staticMetaReadyRef = useRef(false);
  const staticMetaCacheRef = useRef({
    departments: [],
    designations: [],
    locations: [],
    roles: [],
  });
  const [state, setState] = useState({
    loading: true,
    refreshing: false,
    error: "",
    organizationId: resolveOrganizationId(),
    organizationSummary: null,
    profileMeta: null,
    users: [],
    groups: [],
    departments: [],
    designations: [],
    locations: [],
    roles: [],
    lastUpdatedAt: null,
  });

  const refresh = useCallback(async (options = {}) => {
    const force = options?.force === true;
    const organizationId = resolveOrganizationId();

    setState((prev) => ({
      ...prev,
      loading: prev.lastUpdatedAt ? prev.loading : true,
      refreshing: Boolean(prev.lastUpdatedAt),
      error: "",
      organizationId,
    }));

    try {
      const commonParams = {
        organization_id: organizationId || undefined,
        limit: 500,
        offset: 0,
      };

      const shouldFetchStaticMeta = force || !staticMetaReadyRef.current;

      const settled = await Promise.allSettled([
        fetchEndpoint("/auth/organization-details", {
          organization_id: organizationId || undefined,
        }),
        fetchEndpoint("/auth/me"),
        fetchEndpoint("/users", { ...commonParams, all: true }),
        fetchEndpoint("/groups", commonParams),
        shouldFetchStaticMeta
          ? fetchEndpoint("/departments", commonParams)
          : Promise.resolve({ data: { rows: staticMetaCacheRef.current.departments } }),
        shouldFetchStaticMeta
          ? fetchEndpoint("/designations", commonParams)
          : Promise.resolve({ data: { rows: staticMetaCacheRef.current.designations } }),
        shouldFetchStaticMeta
          ? fetchEndpoint("/locations", commonParams)
          : Promise.resolve({ data: { rows: staticMetaCacheRef.current.locations } }),
        shouldFetchStaticMeta
          ? fetchEndpoint("/roles", commonParams)
          : Promise.resolve({ data: { rows: staticMetaCacheRef.current.roles } }),
      ]);

      const organizationPayload = unwrapSettledValue(settled[0], { data: null });
      const mePayload = unwrapSettledValue(settled[1], { data: null });
      const usersPayload = unwrapSettledValue(settled[2], { data: { rows: [] } });
      const groupsPayload = unwrapSettledValue(settled[3], { data: { rows: [] } });
      const departmentsPayload = unwrapSettledValue(settled[4], { data: { rows: [] } });
      const designationsPayload = unwrapSettledValue(settled[5], { data: { rows: [] } });
      const locationsPayload = unwrapSettledValue(settled[6], { data: { rows: [] } });
      const rolesPayload = unwrapSettledValue(settled[7], { data: { rows: [] } });

      const normalizedSummary = normalizeOrganizationSummary(
        organizationPayload,
        organizationId,
      );
      const normalizedProfileMeta = normalizeProfileMeta(mePayload);
      const normalizedUsers = normalizeUsers(normalizeArrayPayload(usersPayload));
      const normalizedGroups = normalizeGroups(normalizeArrayPayload(groupsPayload));
      const normalizedDepartments = normalizeDepartments(
        normalizeArrayPayload(departmentsPayload),
      );
      const normalizedDesignations = normalizeDesignations(
        normalizeArrayPayload(designationsPayload),
      );
      const normalizedLocations = normalizeLocations(
        normalizeArrayPayload(locationsPayload),
      );
      const normalizedRoles = normalizeRoles(normalizeArrayPayload(rolesPayload));
      if (shouldFetchStaticMeta) {
        staticMetaCacheRef.current = {
          departments: normalizedDepartments,
          designations: normalizedDesignations,
          locations: normalizedLocations,
          roles: normalizedRoles,
        };
        staticMetaReadyRef.current = true;
      }

      setState((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: "",
        organizationId,
        organizationSummary: normalizedSummary,
        profileMeta: normalizedProfileMeta,
        users: normalizedUsers,
        groups: normalizedGroups,
        departments: normalizedDepartments,
        designations: normalizedDesignations,
        locations: normalizedLocations,
        roles: normalizedRoles,
        lastUpdatedAt: Date.now(),
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: error?.message || "Admin data fetch failed",
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const derived = useMemo(() => {
    const normalize = (value) => String(value || "").trim().toLowerCase();
    const isArchivedStatus = (value) =>
      ["archived", "inactive", "left"].includes(normalize(value));
    const isExMembershipStatus = (value) =>
      ["suspended", "left", "archived", "inactive"].includes(normalize(value));
    const isSuspendedStatus = (value) => normalize(value) === "suspended";
    const isActiveStatus = (value) => normalize(value) === "active";

    const isExMember = (user) =>
      isArchivedStatus(user?.user_status) || isExMembershipStatus(user?.membership_status);

    const isCurrentUser = (user) => !isExMember(user);
    const isLicenseActiveUser = (user) =>
      isActiveStatus(user?.user_status) && isActiveStatus(user?.membership_status);

    const users = state.users.filter((user) => isCurrentUser(user));
    const activeUsers = users.filter((user) => isLicenseActiveUser(user));
    const exMembers = state.users.filter((user) => isExMember(user));
    const suspendedUsers = exMembers.filter(
      (user) => isSuspendedStatus(user?.membership_status),
    );
    const globalMembers = users.filter((user) => user.is_global_member);

    return {
      users,
      activeUsers,
      suspendedUsers,
      exMembers,
      globalMembers,
    };
  }, [state.users]);

  return {
    ...state,
    ...derived,
    refresh,
  };
};

export default useAdminDashboardData;
