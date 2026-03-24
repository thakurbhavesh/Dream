import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  OutlinedInput,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { LuUserRoundSearch } from "react-icons/lu";
import { RiResetLeftFill } from "react-icons/ri";
import { HiDotsVertical } from "react-icons/hi";
import {
  FiEdit2,
  FiEye,
  FiChevronDown,
  FiKey,
  FiSend,
  FiTrash2,
  FiUserX,
} from "react-icons/fi";
import { API_BASE_URL } from "../../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../../utils/authApi";

export const getInitials = (name = "") => {
  const cleaned = name.trim();
  if (!cleaned) return "??";

  const parts = cleaned.split(/\s+/).filter(Boolean);
  const firstPart = parts[0] ?? "";
  const lastPart = parts[parts.length - 1] ?? "";

  const first = firstPart.charAt(0) || "";
  let second = "";

  if (parts.length > 1) {
    second = lastPart.charAt(0) || "";
  } else {
    second = firstPart.charAt(1) || "";
  }

  const initials = `${first}${second}`.trim().toUpperCase();
  return initials || first.toUpperCase() || "??";
};

export const SearchInput = ({
  placeholder = "Search",
  value,
  onChange,
  sx,
}) => (
  <OutlinedInput
    placeholder={placeholder}
    value={value ?? ""}
    onChange={onChange}
    startAdornment={
      <InputAdornment position="start">
        <Box component="span" aria-hidden>
          <LuUserRoundSearch size={25} />
        </Box>
      </InputAdornment>
    }
    sx={{ maxWidth: 360, borderRadius: 1, width: "100%", ...sx }}
  />
);

export const RefreshButton = ({ onReset = () => {} }) => (
  <Tooltip title="Reset filters" arrow>
    <IconButton color="primary" aria-label="reset filters" onClick={onReset}>
      <Box component="span" aria-hidden sx={{ fontSize: 18 }}>
        <RiResetLeftFill />
      </Box>
    </IconButton>
  </Tooltip>
);

const USER_ACTIONS = [
  "View",
  "Edit",
  "Suspend",
  "Delete (Inactive)",
  "Update password",
  "Resend invite",
];

const toDisplayValue = (value) => {
  const normalized = String(value ?? "").trim();
  return normalized || "N/A";
};

const toDisplayBoolean = (value) => (value ? "Yes" : "No");

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

const isSuperAdminRole = (roleId, roleName = "", roleKey = "") => {
  const normalizedName = String(roleName || "").trim().toLowerCase();
  const normalizedKey = String(roleKey || "").trim().toLowerCase();
  return (
    Number(roleId) === 3 ||
    normalizedName === "super admin" ||
    normalizedKey === "super_admin"
  );
};

const isOwnerRole = (roleId, roleName = "", roleKey = "") => {
  const normalizedName = String(roleName || "").trim().toLowerCase();
  const normalizedKey = String(roleKey || "").trim().toLowerCase();
  return (
    Number(roleId) === 1 ||
    normalizedName === "owner" ||
    normalizedKey === "owner"
  );
};

const formatJoinedAt = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim().toLowerCase());

const hasValidId = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
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

const ViewField = ({ label, value }) => (
  <Box
    sx={{
      px: 1.5,
      py: 1.25,
      borderRadius: 1.5,
      border: "1px solid",
      borderColor: "divider",
      backgroundColor: "background.default",
    }}
  >
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
      {toDisplayValue(value)}
    </Typography>
  </Box>
);

export const UserActionsMenu = ({
  row,
  onUpdated,
  departments = [],
  designations = [],
  locations = [],
  showInlineActions = false,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    mobile: "",
    role_id: "",
    department_id: "",
    designation_id: "",
    location_id: "",
    is_global_member: false,
    is_platform_admin: false,
  });
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState("");
  const [viewUser, setViewUser] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetForm, setResetForm] = useState({
    email: "",
    new_password: "",
  });
  const [credentialDialog, setCredentialDialog] = useState({
    open: false,
    title: "",
    email: "",
    temporaryPassword: "",
    mailSent: false,
    mailError: "",
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const open = Boolean(anchorEl);
  const normalizedUserStatus = String(row?.user_status || row?.status || "")
    .trim()
    .toLowerCase();
  const normalizedMembershipStatus = String(row?.membership_status || "")
    .trim()
    .toLowerCase();
  const isSuspended =
    normalizedUserStatus === "suspended" || normalizedMembershipStatus === "suspended";
  const statusAction = isSuspended ? "Unsuspend" : "Suspend";
  const hasGlobalMember = viewUser?.is_global_member === true;
  const showDepartment = hasValidId(viewUser?.department_id);
  const showDesignation = hasValidId(viewUser?.designation_id);
  const showLocation = hasValidId(viewUser?.location_id);
  const userId = row?.user_id || row?.id;
  const isTargetSuperAdmin =
    isSuperAdminRole(row?.role_id, row?.role_name, row?.role_key) ||
    isSuperAdminRole(viewUser?.role_id, viewUser?.role_name, viewUser?.role_key);

  const departmentOptions = departments.map((department, index) => ({
    value: Number(department?.department_id ?? department?.id ?? index + 1),
    label: department?.name || "",
  }));

  const designationOptions = designations
    .map((designation, index) => ({
      value: Number(designation?.designation_id ?? designation?.id ?? index + 1),
      label: designation?.name || designation?.title || "",
      department_id: Number(designation?.department_id ?? designation?.departmentId ?? 0),
    }))
    .filter(
      (designation) =>
        !Number(editForm.department_id) ||
        !designation.department_id ||
        designation.department_id === Number(editForm.department_id),
    );

  const locationOptions = locations.map((location, index) => ({
    value: Number(location?.location_id ?? location?.id ?? index + 1),
    label: location?.label || "",
  }));
  const editIsSuperAdmin = isSuperAdminRole(
    editForm.role_id,
    editForm.role_name,
    editForm.role_key,
  );
  const editIsOwner = isOwnerRole(
    editForm.role_id,
    editForm.role_name,
    editForm.role_key,
  );

  const buildEditForm = (data = {}) => ({
    role_name: String(data?.role_name ?? row?.role_name ?? "").trim(),
    role_key: String(data?.role_key ?? row?.role_key ?? "").trim(),
    role_id: String(data?.role_id ?? row?.role_id ?? "").trim(),
    name: String(data?.name ?? row?.name ?? "").trim(),
    email: String(data?.email ?? row?.email ?? "").trim(),
    mobile: String(data?.mobile ?? row?.mobile ?? "").trim(),
    department_id: String(data?.department_id ?? row?.department_id ?? "").trim(),
    designation_id: String(data?.designation_id ?? row?.designation_id ?? "").trim(),
    location_id: String(data?.location_id ?? row?.location_id ?? "").trim(),
    is_global_member:
      typeof data?.is_global_member === "boolean"
        ? data.is_global_member
        : toBoolean(row?.is_global_member),
    is_platform_admin:
      (typeof data?.is_platform_admin === "boolean"
        ? data.is_platform_admin
        : toBoolean(row?.is_platform_admin)) ||
      isPlatformAdminRole(
        data?.role_name ?? row?.role_name,
        data?.role_key ?? row?.role_key,
      ),
  });

  const handleOpenEdit = async () => {
    setEditOpen(true);
    setEditError("");
    setEditLoading(true);

    if (!userId) {
      setEditError("User id missing");
      setEditLoading(false);
      return;
    }

    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/users/${userId}`,
        { method: "GET" },
      );

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to fetch user details");
      }

      setEditForm(buildEditForm(payload?.data || {}));
    } catch (error) {
      setEditError(error?.message || "Unable to load user data");
      setEditForm(buildEditForm({}));
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditSubmit = async () => {
    const name = String(editForm.name || "").trim();
    const email = String(editForm.email || "").trim().toLowerCase();
    const mobile = String(editForm.mobile || "").trim();

    if (!name) {
      setEditError("Name is required");
      return;
    }
    if (!email || !isValidEmail(email)) {
      setEditError("Valid email is required");
      return;
    }

    if (!userId) {
      setEditError("User id missing");
      return;
    }

    setEditError("");
    setEditSaving(true);

    try {
      const resolvedPlatformAdmin = editIsSuperAdmin
        ? true
        : (editIsOwner ? toBoolean(editForm.is_platform_admin) : Boolean(editForm.is_platform_admin));
      const resolvedRoleId = editIsSuperAdmin
        ? 3
        : (editIsOwner
          ? Number(editForm.role_id || 1)
          : (resolvedPlatformAdmin ? 2 : 4));

      const payload = {
        name,
        email,
        mobile,
        role_id: resolvedRoleId,
        department_id: editForm.department_id
          ? Number(editForm.department_id)
          : undefined,
        designation_id: editForm.designation_id
          ? Number(editForm.designation_id)
          : undefined,
        location_id: editForm.location_id ? Number(editForm.location_id) : undefined,
        is_global_member: Boolean(editForm.is_global_member),
        is_platform_admin: resolvedPlatformAdmin,
      };

      const { response, payload: result } = await fetchWithAuth(
        `${API_BASE_URL}/users/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok || result?.status === "error") {
        throw new Error(result?.message || "Failed to update user");
      }

      setEditOpen(false);
      setSnackbar({
        open: true,
        message: "User updated successfully.",
        severity: "success",
      });
      if (typeof onUpdated === "function") {
        await onUpdated();
      }
    } catch (error) {
      setEditError(error?.message || "Unable to update user");
      setSnackbar({
        open: true,
        message: error?.message || "Unable to update user",
        severity: "error",
      });
    } finally {
      setEditSaving(false);
    }
  };

  const handleOpenView = async () => {
    setViewOpen(true);
    setViewError("");
    setViewLoading(true);

    if (!userId) {
      setViewUser(null);
      setViewError("User id missing");
      setViewLoading(false);
      return;
    }

    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/users/${userId}`,
        { method: "GET" },
      );

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to fetch user details");
      }

      const data = payload?.data || {};
      const resolvedRoleName = data?.role_name ?? row?.role_name;
      const resolvedRoleKey = data?.role_key ?? row?.role_key;
      const resolvedPlatformAdmin =
        toBoolean(data?.is_platform_admin, toBoolean(row?.is_platform_admin)) ||
        isPlatformAdminRole(resolvedRoleName, resolvedRoleKey);

      setViewUser({
        user_id: data?.user_id ?? row?.user_id ?? row?.id,
        name: data?.name ?? row?.name,
        email: data?.email ?? row?.email,
        profile_url: data?.profile_url ?? row?.profilePicture,
        mobile: data?.mobile,
        role_key: resolvedRoleKey,
        role_name: resolvedRoleName,
        department_id: data?.department_id,
        designation_id: data?.designation_id,
        location_id: data?.location_id,
        department_name: data?.department_name ?? row?.department,
        designation_name: data?.designation_name ?? row?.designation,
        location_name: data?.location_name ?? row?.location,
        is_platform_admin: resolvedPlatformAdmin,
        is_global_member:
          toBoolean(data?.is_global_member, toBoolean(row?.is_global_member)),
        user_status: data?.user_status ?? row?.user_status,
        membership_status: data?.membership_status ?? row?.membership_status,
        status: data?.status ?? row?.status,
        joined_at: data?.joined_at ?? row?.joined_at,
        organization_id: data?.organization_id ?? row?.organization_id,
      });
    } catch (error) {
      setViewUser(null);
      setViewError(error?.message || "Unable to load user data");
    } finally {
      setViewLoading(false);
    }
  };

  const handleOpenResetPassword = () => {
    setResetError("");
    setResetForm({
      email: String(row?.email || "").trim().toLowerCase(),
      new_password: "",
    });
    setResetOpen(true);
  };

  const handleSuspendUser = async () => {
    if (!userId) {
      setSnackbar({
        open: true,
        message: "User id missing",
        severity: "error",
      });
      return;
    }

    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/users/${userId}/deactivate`,
        { method: "PATCH" },
      );

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to suspend user");
      }

      setSnackbar({
        open: true,
        message: "User suspended successfully.",
        severity: "success",
      });
      if (typeof onUpdated === "function") {
        await onUpdated();
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error?.message || "Unable to suspend user",
        severity: "error",
      });
    }
  };

  const handleDeleteInactiveUser = async () => {
    if (!userId) {
      setSnackbar({
        open: true,
        message: "User id missing",
        severity: "error",
      });
      return;
    }

    const confirmed =
      typeof window !== "undefined"
        ? window.confirm("Set this user as inactive and remove from active users?")
        : true;
    if (!confirmed) return;

    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/users/${userId}`,
        { method: "DELETE" },
      );

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to set user inactive");
      }

      setSnackbar({
        open: true,
        message: "User set inactive and moved to Ex-Members.",
        severity: "success",
      });
      if (typeof onUpdated === "function") {
        await onUpdated();
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error?.message || "Unable to set user inactive",
        severity: "error",
      });
    }
  };

  const handleActivateUser = async () => {
    if (!userId) {
      setSnackbar({
        open: true,
        message: "User id missing",
        severity: "error",
      });
      return;
    }

    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/users/${userId}/activate`,
        { method: "PATCH" },
      );

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to unsuspend user");
      }

      setSnackbar({
        open: true,
        message: "User unsuspended and set to active.",
        severity: "success",
      });
      if (typeof onUpdated === "function") {
        await onUpdated();
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error?.message || "Unable to unsuspend user",
        severity: "error",
      });
    }
  };

  const handleResetPasswordSubmit = async () => {
    const email = String(resetForm.email || "").trim().toLowerCase();
    const newPassword = String(resetForm.new_password || "").trim();

    if (!email || !isValidEmail(email)) {
      setResetError("Valid email is required");
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setResetError("New password must be at least 8 characters");
      return;
    }

    setResetError("");
    setResetSaving(true);
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/users/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            ...(newPassword ? { new_password: newPassword } : {}),
          }),
        },
      );

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to reset password");
      }

      setResetOpen(false);
      const responseData = payload?.data || {};
      const tempPassword = String(responseData?.temporary_password || "").trim();
      const resolvedEmail = String(responseData?.email || email).trim();
      if (tempPassword && resolvedEmail) {
        setCredentialDialog({
          open: true,
          title: "Password Reset Credentials",
          email: resolvedEmail,
          temporaryPassword: tempPassword,
          mailSent: Boolean(responseData?.credential_sent),
          mailError: String(responseData?.mail_error || "").trim(),
        });
      }
      setSnackbar({
        open: true,
        message: responseData?.credential_sent
          ? "Password updated and email sent."
          : "Password updated. Share credentials manually.",
        severity: responseData?.credential_sent ? "success" : "warning",
      });
    } catch (error) {
      const message = error?.message || "Unable to update password";
      setResetError(message);
      setSnackbar({
        open: true,
        message,
        severity: "error",
      });
    } finally {
      setResetSaving(false);
    }
  };

  const handleResendInvite = async () => {
    if (!userId) {
      setSnackbar({
        open: true,
        message: "User id missing",
        severity: "error",
      });
      return;
    }

    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/users/${userId}/resend-invite`,
        { method: "POST" },
      );

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to resend invite");
      }

      const responseData = payload?.data || {};
      const tempPassword = String(responseData?.temporary_password || "").trim();
      const resolvedEmail = String(responseData?.email || row?.email || "").trim();
      if (tempPassword && resolvedEmail) {
        setCredentialDialog({
          open: true,
          title: "Invite Credentials",
          email: resolvedEmail,
          temporaryPassword: tempPassword,
          mailSent: Boolean(responseData?.credential_sent),
          mailError: String(responseData?.mail_error || "").trim(),
        });
      }

      setSnackbar({
        open: true,
        message: responseData?.credential_sent
          ? "Invite sent successfully."
          : "Invite created but email failed. Share credentials manually.",
        severity: responseData?.credential_sent ? "success" : "warning",
      });
      if (typeof onUpdated === "function") {
        await onUpdated();
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error?.message || "Unable to resend invite",
        severity: "error",
      });
    }
  };

  const handleSelect = (action) => {
    if (isTargetSuperAdmin && ["Suspend", "Unsuspend", "Delete (Inactive)"].includes(action)) {
      setAnchorEl(null);
      setSnackbar({
        open: true,
        message: "Super Admin cannot be suspended or deleted.",
        severity: "warning",
      });
      return;
    }
    if (action === "View") {
      setAnchorEl(null);
      handleOpenView();
      return;
    }
    if (action === "Edit") {
      setAnchorEl(null);
      handleOpenEdit();
      return;
    }
    if (action === "Update password") {
      setAnchorEl(null);
      handleOpenResetPassword();
      return;
    }
    if (action === "Suspend") {
      setAnchorEl(null);
      handleSuspendUser();
      return;
    }
    if (action === "Unsuspend") {
      setAnchorEl(null);
      handleActivateUser();
      return;
    }
    if (action === "Resend invite") {
      setAnchorEl(null);
      handleResendInvite();
      return;
    }
    if (action === "Delete (Inactive)") {
      setAnchorEl(null);
      handleDeleteInactiveUser();
      return;
    }
    setAnchorEl(null);
  };

  const menuActions = (showInlineActions
    ? ["Update password", "Resend invite", statusAction, "Delete (Inactive)"]
    : USER_ACTIONS.map((action) => (action === "Suspend" ? statusAction : action)))
    .filter(
      (action) => !isTargetSuperAdmin || !["Suspend", "Unsuspend", "Delete (Inactive)"].includes(action),
    );

  const actionMeta = {
    View: { icon: <FiEye size={14} />, color: "info", label: "View" },
    Edit: { icon: <FiEdit2 size={14} />, color: "primary", label: "Edit" },
    Suspend: { icon: <FiUserX size={14} />, color: "warning", label: "Suspend" },
    Unsuspend: { icon: <FiUserX size={14} />, color: "success", label: "Unsuspend" },
    "Delete (Inactive)": {
      icon: <FiTrash2 size={14} />,
      color: "error",
      label: "Delete Inactive",
    },
    "Update password": {
      icon: <FiKey size={14} />,
      color: "secondary",
      label: "Update Password",
    },
    "Resend invite": {
      icon: <FiSend size={14} />,
      color: "success",
      label: "Resend Invite",
    },
  };

  const baseActionSx = {
    minWidth: 0,
    px: 1.15,
    borderRadius: 1.5,
    fontSize: "0.74rem",
    fontWeight: 700,
    lineHeight: 1,
    textTransform: "none",
    justifyContent: "flex-start",
  };

  const actionSxByType = {
    View: {
      borderColor: "rgba(2,136,209,0.35)",
      color: "info.dark",
      backgroundColor: "rgba(2,136,209,0.08)",
      "&:hover": {
        borderColor: "info.main",
        backgroundColor: "rgba(2,136,209,0.16)",
      },
    },
    Edit: {
      borderColor: "rgba(25,118,210,0.35)",
      color: "primary.dark",
      backgroundColor: "rgba(25,118,210,0.08)",
      "&:hover": {
        borderColor: "primary.main",
        backgroundColor: "rgba(25,118,210,0.16)",
      },
    },
    Suspend: {
      borderColor: "rgba(237,108,2,0.45)",
      color: "warning.dark",
      backgroundColor: "rgba(237,108,2,0.1)",
      "&:hover": {
        borderColor: "warning.main",
        backgroundColor: "rgba(237,108,2,0.2)",
      },
    },
    Unsuspend: {
      borderColor: "rgba(46,125,50,0.4)",
      color: "success.dark",
      backgroundColor: "rgba(46,125,50,0.08)",
      "&:hover": {
        borderColor: "success.main",
        backgroundColor: "rgba(46,125,50,0.16)",
      },
    },
    "Delete (Inactive)": {
      borderColor: "rgba(211,47,47,0.45)",
      color: "error.dark",
      backgroundColor: "rgba(211,47,47,0.08)",
      "&:hover": {
        borderColor: "error.main",
        backgroundColor: "rgba(211,47,47,0.16)",
      },
    },
  };

  return (
    <>
      {showInlineActions ? (
        <Stack direction="row" spacing={0.6} alignItems="center" sx={{ width: "100%" }}>
          <Tooltip title={actionMeta.View.label} arrow>
            <Button
              size="small"
              variant="outlined"
              color={actionMeta.View.color}
              startIcon={actionMeta.View.icon}
              onClick={() => handleSelect("View")}
              title={actionMeta.View.label}
              sx={{
                ...baseActionSx,
                ...(actionSxByType.View || {}),
              }}
            >
              {actionMeta.View.label}
            </Button>
          </Tooltip>
          <Tooltip title={actionMeta.Edit.label} arrow>
            <Button
              size="small"
              variant="outlined"
              color={actionMeta.Edit.color}
              startIcon={actionMeta.Edit.icon}
              onClick={() => handleSelect("Edit")}
              title={actionMeta.Edit.label}
              sx={{
                ...baseActionSx,
                ...(actionSxByType.Edit || {}),
              }}
            >
              {actionMeta.Edit.label}
            </Button>
          </Tooltip>
          <Button
            size="small"
            variant="outlined"
            onClick={(event) => setAnchorEl(event.currentTarget)}
            endIcon={<FiChevronDown size={14} />}
            title="More user actions"
            sx={{
              ...baseActionSx,
              ml: "auto",
              borderColor: "divider",
              color: "text.primary",
              backgroundColor: "background.paper",
              "&:hover": {
                borderColor: "text.secondary",
                backgroundColor: "action.hover",
              },
            }}
          >
            Actions
          </Button>
        </Stack>
      ) : (
        <Tooltip title="User actions" arrow>
          <IconButton
            size="small"
            onClick={(event) => setAnchorEl(event.currentTarget)}
          >
            <HiDotsVertical size={18} />
          </IconButton>
        </Tooltip>
      )}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {menuActions.map((action, index) => (
          <Box key={action}>
            {index === 2 ? <Divider sx={{ my: 0.5 }} /> : null}
            <MenuItem
              onClick={() => handleSelect(action)}
              sx={{
                fontSize: "14px",
                color:
                  action === "Delete (Inactive)"
                    ? "error.main"
                    : action === "Suspend"
                      ? "warning.dark"
                      : action === "Unsuspend"
                        ? "success.dark"
                      : "text.primary",
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 30,
                  color:
                    action === "Delete (Inactive)"
                      ? "error.main"
                      : action === "Suspend"
                        ? "warning.dark"
                        : action === "Unsuspend"
                          ? "success.dark"
                        : "inherit",
                }}
              >
                {actionMeta[action]?.icon || <HiDotsVertical size={13} />}
              </ListItemIcon>
              {actionMeta[action]?.label || action}
            </MenuItem>
          </Box>
        ))}
      </Menu>
      <Dialog
        open={editOpen}
        onClose={() => !editSaving && setEditOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>Edit User</DialogTitle>
        <DialogContent dividers>
          {editLoading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
              <CircularProgress size={26} />
            </Stack>
          ) : (
            <Stack spacing={1.6}>
              {editError && <Alert severity="error">{editError}</Alert>}
              <TextField
                size="small"
                label="Name"
                value={editForm.name}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
              <TextField
                size="small"
                label="Email"
                value={editForm.email}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, email: event.target.value }))
                }
              />
              <TextField
                size="small"
                label="Mobile"
                value={editForm.mobile}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, mobile: event.target.value }))
                }
              />
              <TextField
                size="small"
                label="Department"
                select
                value={editForm.department_id}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    department_id: event.target.value,
                    designation_id: "",
                  }))
                }
              >
                <MenuItem value="">No change</MenuItem>
                {departmentOptions.map((department) => (
                  <MenuItem key={department.value} value={department.value}>
                    {department.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Designation"
                select
                value={editForm.designation_id}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    designation_id: event.target.value,
                  }))
                }
              >
                <MenuItem value="">No change</MenuItem>
                {designationOptions.map((designation) => (
                  <MenuItem key={designation.value} value={designation.value}>
                    {designation.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Location"
                select
                value={editForm.location_id}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    location_id: event.target.value,
                  }))
                }
              >
                <MenuItem value="">No change</MenuItem>
                {locationOptions.map((location) => (
                  <MenuItem key={location.value} value={location.value}>
                    {location.label}
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(editForm.is_global_member)}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        is_global_member: event.target.checked,
                      }))
                    }
                  />
                }
                label="Global Member"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(editForm.is_platform_admin)}
                    disabled={editIsSuperAdmin || editIsOwner}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        is_platform_admin: event.target.checked,
                      }))
                    }
                  />
                }
                label="Platform Admin"
              />
              <Typography variant="caption" color="text.secondary">
                Role: {editIsOwner ? "Owner" : (editIsSuperAdmin ? "Super Admin" : (editForm.is_platform_admin ? "Admin" : "Users"))}
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={editSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleEditSubmit}
            disabled={editSaving || editLoading}
          >
            {editSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={resetOpen}
        onClose={() => !resetSaving && setResetOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>Update Password</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.6}>
            {resetError ? <Alert severity="error">{resetError}</Alert> : null}
            <TextField
              size="small"
              label="Email"
              value={resetForm.email}
              onChange={(event) =>
                setResetForm((prev) => ({
                  ...prev,
                  email: event.target.value,
                }))
              }
            />
            <TextField
              size="small"
              type="password"
              label="New Password"
              value={resetForm.new_password}
              onChange={(event) =>
                setResetForm((prev) => ({
                  ...prev,
                  new_password: event.target.value,
                }))
              }
              helperText="Minimum 8 characters"
            />
            <Typography variant="caption" color="text.secondary">
              Keep password blank to auto-generate random password and send by email.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)} disabled={resetSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleResetPasswordSubmit}
            disabled={resetSaving}
          >
            {resetSaving ? "Updating..." : "Update & Send"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={credentialDialog.open}
        onClose={() =>
          setCredentialDialog((prev) => ({
            ...prev,
            open: false,
          }))
        }
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{credentialDialog.title || "Credentials"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.4}>
            {credentialDialog.mailSent ? (
              <Alert severity="success">
                Email sent successfully. Credentials shown for backup.
              </Alert>
            ) : (
              <Alert severity="warning">
                Email send failed
                {credentialDialog.mailError ? `: ${credentialDialog.mailError}` : ""}. Share
                credentials manually.
              </Alert>
            )}
            <TextField
              size="small"
              label="Email"
              value={credentialDialog.email}
              InputProps={{ readOnly: true }}
            />
            <TextField
              size="small"
              label="Temporary Password"
              value={credentialDialog.temporaryPassword}
              InputProps={{ readOnly: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setCredentialDialog((prev) => ({
                ...prev,
                open: false,
              }))
            }
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>View User</DialogTitle>
        <DialogContent dividers>
          {viewLoading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
              <CircularProgress size={26} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                Loading user details...
              </Typography>
            </Stack>
          ) : viewError ? (
            <Typography variant="body2" color="error.main">
              {viewError}
            </Typography>
          ) : (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ position: "relative", display: "inline-flex" }}>
                  <Avatar
                    src={viewUser?.profile_url || undefined}
                    sx={{ width: 54, height: 54 }}
                  >
                    {getInitials(viewUser?.name || "N/A")}
                  </Avatar>
                  {viewUser?.is_global_member ? (
                    <Box
                      sx={{
                        position: "absolute",
                        right: -1,
                        bottom: -1,
                        width: 11,
                        height: 11,
                        borderRadius: "50%",
                        bgcolor: "#ff8a00",
                        border: "2px solid",
                        borderColor: "background.paper",
                      }}
                    />
                  ) : null}
                </Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {toDisplayValue(viewUser?.name)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {toDisplayValue(viewUser?.email)}
                  </Typography>
                </Box>
                <Box sx={{ ml: "auto" }}>
                  <Chip
                    size="small"
                    label={toDisplayValue(viewUser?.user_status)}
                    color={
                      String(viewUser?.user_status || "").toLowerCase() === "active"
                        ? "success"
                        : "default"
                    }
                    variant="outlined"
                    sx={{ textTransform: "capitalize" }}
                  />
                </Box>
              </Stack>
              <Divider />
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.2}
                useFlexGap
                flexWrap="wrap"
              >
                <Box sx={{ flex: "1 1 48%" }}>
                  <ViewField label="Mobile" value={viewUser?.mobile} />
                </Box>
                <Box sx={{ flex: "1 1 48%" }}>
                  <ViewField label="Role Name" value={viewUser?.role_name} />
                </Box>
                {showDepartment && (
                  <Box sx={{ flex: "1 1 48%" }}>
                    <ViewField label="Department" value={viewUser?.department_name} />
                  </Box>
                )}
                {showDesignation && (
                  <Box sx={{ flex: "1 1 48%" }}>
                    <ViewField
                      label="Designation"
                      value={viewUser?.designation_name}
                    />
                  </Box>
                )}
                {showLocation && (
                  <Box sx={{ flex: "1 1 48%" }}>
                    <ViewField label="Location" value={viewUser?.location_name} />
                  </Box>
                )}
                <Box sx={{ flex: "1 1 48%" }}>
                  <ViewField
                    label="Joined At"
                    value={formatJoinedAt(viewUser?.joined_at)}
                  />
                </Box>
                <Box sx={{ flex: "1 1 48%" }}>
                  <ViewField
                    label="Platform Admin"
                    value={toDisplayBoolean(viewUser?.is_platform_admin)}
                  />
                </Box>
                {hasGlobalMember && (
                  <Box sx={{ flex: "1 1 48%" }}>
                    <ViewField
                      label="Global Member"
                      value={toDisplayBoolean(viewUser?.is_global_member)}
                    />
                  </Box>
                )}
              </Stack>
            </Stack>
          )}
        </DialogContent>
      <DialogActions>
        <Button onClick={() => setViewOpen(false)}>Close</Button>
      </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};
