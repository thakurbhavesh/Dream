import { agentSelfId } from "./CommonData";

const primaryOrg = {
  id: null,
  label: "My Organization",
};

const cleanString = (value, fallback = "") => {
  if (value == null) return fallback;
  const trimmed = String(value).trim();
  return trimmed || fallback;
};

const deriveInitials = (label = "") => {
  if (typeof label !== "string") {
    return "";
  }
  return label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};



export const DEFAULT_PROFILE = Object.freeze({
  id: agentSelfId,
  user_id: agentSelfId,
  username: "myself",
  name: "Myself",
  displayName: "Myself",
  fullName: "Myself",
  role: "",
  designation: "",
  designationId: null,
  designation_id: null,
  department: "",
  departmentId: null,
  department_id: null,
  email: "",
  mobile: "",
  company: primaryOrg?.label ?? "TeamChatX",
  organizationId: primaryOrg?.id ?? null,
  organization_id: primaryOrg?.id ?? null,
  organizationLabel: primaryOrg?.label ?? "My Organization",
  domainName: "teamchatx.com",
  domain_name: "teamchatx.com",
  location: "",
  locationId: null,
  location_id: null,
  avatar: "",
  initials: "MY",
  status: "Online",
});

export const normalizeProfilePayload = (profile = {}) => {
  const merged = { ...DEFAULT_PROFILE, ...profile };
  const id =
    cleanString(merged.id) ||
    cleanString(merged.user_id) ||
    DEFAULT_PROFILE.id;
  const email = cleanString(merged.email, DEFAULT_PROFILE.email);
  const displayName =
    cleanString(merged.displayName) ||
    cleanString(merged.name) ||
    cleanString(merged.fullName) ||
    DEFAULT_PROFILE.displayName;
  const organizationId =
    cleanString(merged.organizationId) ||
    cleanString(merged.organization_id) ||
    DEFAULT_PROFILE.organizationId;
  const company = cleanString(merged.company, DEFAULT_PROFILE.company);
  const domainName =
    cleanString(merged.domainName) ||
    cleanString(merged.domain_name) ||
    DEFAULT_PROFILE.domainName;
  const initials =
    cleanString(merged.initials) ||
    deriveInitials(displayName || company) ||
    DEFAULT_PROFILE.initials;

  return {
    ...merged,
    id,
    user_id: merged.user_id ?? id,
    username:
      cleanString(merged.username) ||
      (email ? email.split("@")[0] : DEFAULT_PROFILE.username),
    name: cleanString(merged.name) || displayName,
    displayName,
    fullName: cleanString(merged.fullName) || displayName,
    role: cleanString(merged.role) || merged.designation || DEFAULT_PROFILE.role,
    designation:
      cleanString(merged.designation) ||
      cleanString(merged.role) ||
      DEFAULT_PROFILE.designation,
    designationId:
      merged.designationId ?? merged.designation_id ?? DEFAULT_PROFILE.designationId,
    designation_id:
      merged.designation_id ?? merged.designationId ?? DEFAULT_PROFILE.designation_id,
    department: cleanString(merged.department, DEFAULT_PROFILE.department),
    departmentId:
      merged.departmentId ?? merged.department_id ?? DEFAULT_PROFILE.departmentId,
    department_id:
      merged.department_id ?? merged.departmentId ?? DEFAULT_PROFILE.department_id,
    email,
    mobile: cleanString(merged.mobile, DEFAULT_PROFILE.mobile),
    company,
    organizationId,
    organization_id: organizationId,
    organizationLabel:
      cleanString(merged.organizationLabel) ||
      company ||
      DEFAULT_PROFILE.organizationLabel,
    domainName,
    domain_name: domainName,
    location: cleanString(merged.location, DEFAULT_PROFILE.location),
    locationId:
      merged.locationId ?? merged.location_id ?? DEFAULT_PROFILE.locationId,
    location_id:
      merged.location_id ?? merged.locationId ?? DEFAULT_PROFILE.location_id,
    avatar: cleanString(merged.avatar, DEFAULT_PROFILE.avatar),
    initials,
    status: cleanString(merged.status, DEFAULT_PROFILE.status),
    timezone: cleanString(merged.timezone) || "UTC",
  };
};

export default {
  DEFAULT_PROFILE,
  normalizeProfilePayload,
};
