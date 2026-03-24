import { useCallback, useEffect, useMemo, useState } from "react";
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
  Drawer,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { alpha, useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { FiCreditCard, FiDownload, FiEdit2, FiEye, FiGift, FiMenu, FiMoon, FiSettings, FiSun, FiTrash2, FiUserPlus, FiUsers } from "react-icons/fi";
import { API_BASE_URL } from "../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../utils/authApi";
import authStore from "../../../utils/auth";
import { downloadInvoicePdf } from "../../../utils/invoicePdf";
import SettingsDrawer from "../../../components/settings/drawer/index.jsx";
import OwnerSidebar from "./OwnerSidebar";

const ORG_PAGE_SIZE = 20;
const RESOURCE_PAGE_SIZE = 20;
const OWNER_THEME_STORAGE_KEY = "owner_dashboard_theme_mode";
const OWNER_DIALOG_SIZE_STORAGE_KEY = "owner_dashboard_dialog_size";
const OWNER_DIALOG_WIDTHS = {
  small: 980,
  medium: 1260,
  large: 1520,
};
const ORG_WORKSPACE_SECTION_TITLES = {
  organizations: "Organizations",
  "organization-members": "Organization Members",
  "organization-subscription": "Organization Subscription",
  "organization-payments": "Payment History",
};

const normalizeDialogSize = (value) => {
  const key = String(value || "").toLowerCase();
  if (key === "small" || key === "medium" || key === "large") return key;
  return "medium";
};

const getDialogPaperSx = (size, minViewport = 32) => {
  const normalized = normalizeDialogSize(size);
  const width = OWNER_DIALOG_WIDTHS[normalized];
  return {
    width: `min(${width}px, calc(100vw - ${minViewport}px))`,
    maxWidth: `${width}px`,
    m: 0,
  };
};

const DialogSizeSelector = ({ value, onChange }) => {
  const normalized = normalizeDialogSize(value);
  return (
    <Stack direction="row" spacing={0.6} alignItems="center">
      {["small", "medium", "large"].map((sizeKey) => {
        const selected = normalized === sizeKey;
        return (
          <Button
            key={sizeKey}
            size="small"
            variant={selected ? "contained" : "outlined"}
            onClick={() => onChange(sizeKey)}
            sx={{
              minWidth: 72,
              textTransform: "none",
            }}
          >
            {sizeKey.charAt(0).toUpperCase() + sizeKey.slice(1)}
          </Button>
        );
      })}
    </Stack>
  );
};

// ─── Gateway Config Editor ────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);

const kvFromObj = (obj) => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  return Object.entries(obj).map(([key, value]) => ({ _id: uid(), key, value: String(value ?? "") }));
};

const kvToObj = (arr) =>
  (arr || []).reduce((acc, { key, value }) => {
    const k = String(key || "").trim();
    if (k) acc[k] = value;
    return acc;
  }, {});

const parseGatewayConfig = (raw) => {
  let config = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) config = raw;
  else if (typeof raw === "string") { try { config = JSON.parse(raw); } catch { config = {}; } }
  return {
    active_mode: String(config.active_mode || config.activeMode || "sandbox"),
    accounts: (Array.isArray(config.accounts) ? config.accounts : []).map((acc) => ({
      _id: uid(),
      account_id: String(acc.account_id || acc.id || ""),
      label: String(acc.label || acc.name || ""),
      is_default: Boolean(acc.is_default),
      sandbox: kvFromObj(acc.sandbox || acc.modes?.sandbox || {}),
      live: kvFromObj(acc.live || acc.modes?.live || {}),
    })),
  };
};

const serializeGatewayConfig = (state) => ({
  active_mode: state.active_mode || "sandbox",
  accounts: (state.accounts || []).map(({ _id, sandbox, live, ...rest }) => ({
    ...rest,
    sandbox: kvToObj(sandbox),
    live: kvToObj(live),
  })),
});

const GatewayKVSection = ({ accId, mode, rows, label, color, bgColor, borderColor, readOnly, onAdd, onRemove, onUpdate }) => (
  <Box sx={{ p: 1.25, borderRadius: 1.5, backgroundColor: bgColor, border: `1px solid ${borderColor}` }}>
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
      <Typography variant="caption" sx={{ fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.6 }}>
        {label} Credentials
      </Typography>
      {!readOnly && (
        <Button size="small" onClick={() => onAdd(accId, mode)} sx={{ fontSize: 11, py: 0.2, px: 1, minWidth: 0 }}>
          + Add Field
        </Button>
      )}
    </Box>
    <Stack spacing={0.6}>
      {rows.length === 0 && (
        <Typography variant="caption" sx={{ color: "text.disabled", pl: 0.5 }}>
          No credentials. Click &quot;+ Add Field&quot; to add.
        </Typography>
      )}
      {rows.map((kv) => (
        <Box key={kv._id} sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
          <TextField
            size="small"
            placeholder="field name"
            value={kv.key}
            onChange={(e) => onUpdate(accId, mode, kv._id, "key", e.target.value)}
            InputProps={{ readOnly, sx: { fontFamily: "monospace", fontSize: 12 } }}
            sx={{ flex: "0 0 155px" }}
          />
          <TextField
            size="small"
            placeholder="value"
            value={kv.value}
            onChange={(e) => onUpdate(accId, mode, kv._id, "value", e.target.value)}
            InputProps={{ readOnly, sx: { fontFamily: "monospace", fontSize: 12 } }}
            sx={{ flex: 1 }}
            type={/(secret|password|token|private)/i.test(kv.key) ? "password" : "text"}
          />
          {!readOnly && (
            <IconButton size="small" onClick={() => onRemove(accId, mode, kv._id)} sx={{ color: "#ef4444", p: 0.5 }}>
              <FiTrash2 size={13} />
            </IconButton>
          )}
        </Box>
      ))}
    </Stack>
  </Box>
);

const GatewayConfigEditor = ({ value, onChange, readOnly }) => {
  const state =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : { active_mode: "sandbox", accounts: [] };

  const upd = (fn) => { if (!readOnly) onChange(fn(state)); };

  const addAccount = () =>
    upd((s) => ({
      ...s,
      accounts: [
        ...s.accounts,
        { _id: uid(), account_id: "", label: "", is_default: s.accounts.length === 0, sandbox: [], live: [] },
      ],
    }));

  const removeAccount = (id) =>
    upd((s) => ({ ...s, accounts: s.accounts.filter((a) => a._id !== id) }));

  const updAccount = (id, field, val) =>
    upd((s) => ({
      ...s,
      accounts: s.accounts.map((a) => (a._id === id ? { ...a, [field]: val } : a)),
    }));

  const setDefault = (id) =>
    upd((s) => ({
      ...s,
      accounts: s.accounts.map((a) => ({ ...a, is_default: a._id === id })),
    }));

  const addKV = (accId, mode) =>
    upd((s) => ({
      ...s,
      accounts: s.accounts.map((a) =>
        a._id === accId ? { ...a, [mode]: [...a[mode], { _id: uid(), key: "", value: "" }] } : a
      ),
    }));

  const removeKV = (accId, mode, kvId) =>
    upd((s) => ({
      ...s,
      accounts: s.accounts.map((a) =>
        a._id === accId ? { ...a, [mode]: a[mode].filter((kv) => kv._id !== kvId) } : a
      ),
    }));

  const updKV = (accId, mode, kvId, field, val) =>
    upd((s) => ({
      ...s,
      accounts: s.accounts.map((a) =>
        a._id === accId
          ? { ...a, [mode]: a[mode].map((kv) => (kv._id === kvId ? { ...kv, [field]: val } : kv)) }
          : a
      ),
    }));

  return (
    <Box sx={{ gridColumn: "1 / -1" }}>
      <Stack spacing={0.5} sx={{ mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1e293b" }}>
          Gateway Configuration
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Secret keys / tokens are auto-encrypted on save. Masked values shown after save — enter new value to update.
        </Typography>
      </Stack>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: "rgba(148,163,184,0.4)" }}>
        <Stack spacing={2.5}>
          {/* Active Mode */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: "#475569", minWidth: 95 }}>
              Active Mode
            </Typography>
            {["sandbox", "live"].map((m) => (
              <Button
                key={m}
                size="small"
                variant={state.active_mode === m ? "contained" : "outlined"}
                color={m === "live" ? "success" : "primary"}
                onClick={() => upd((s) => ({ ...s, active_mode: m }))}
                disabled={readOnly}
                sx={{ fontWeight: 600, minWidth: 100, textTransform: "none" }}
              >
                {m === "live" ? "🟢 Live" : "🔵 Sandbox"}
              </Button>
            ))}
            <Typography variant="caption" sx={{ color: state.active_mode === "live" ? "#15803d" : "#1d4ed8" }}>
              {state.active_mode === "live"
                ? "Real payments — charges apply."
                : "Test mode — no real charges."}
            </Typography>
          </Box>

          {/* Accounts */}
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: "#1e293b" }}>
                Accounts ({state.accounts.length})
              </Typography>
              {!readOnly && (
                <Button size="small" variant="outlined" onClick={addAccount} sx={{ fontSize: 12 }}>
                  + Add Account
                </Button>
              )}
            </Box>
            {state.accounts.length === 0 && (
              <Typography variant="body2" sx={{ color: "text.disabled" }}>
                No accounts added. Click &quot;+ Add Account&quot; to start.
              </Typography>
            )}
            <Stack spacing={1.5}>
              {state.accounts.map((acc, idx) => (
                <Paper
                  key={acc._id}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    borderColor: acc.is_default ? "#3b82f6" : "rgba(148,163,184,0.4)",
                    backgroundColor: acc.is_default ? "#f0f7ff" : "#fafafa",
                  }}
                >
                  {/* Account header row */}
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1.5, flexWrap: "wrap" }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "#94a3b8", minWidth: 22 }}>
                      #{idx + 1}
                    </Typography>
                    <TextField
                      size="small"
                      label="Account ID"
                      placeholder="main"
                      value={acc.account_id}
                      onChange={(e) => updAccount(acc._id, "account_id", e.target.value)}
                      InputProps={{ readOnly }}
                      sx={{ flex: "0 0 145px" }}
                    />
                    <TextField
                      size="small"
                      label="Label"
                      placeholder="Main Account"
                      value={acc.label}
                      onChange={(e) => updAccount(acc._id, "label", e.target.value)}
                      InputProps={{ readOnly }}
                      sx={{ flex: 1, minWidth: 130 }}
                    />
                    <Button
                      size="small"
                      variant={acc.is_default ? "contained" : "outlined"}
                      onClick={() => setDefault(acc._id)}
                      disabled={readOnly || acc.is_default}
                      sx={{ fontSize: 11, py: 0.5, flexShrink: 0, textTransform: "none" }}
                    >
                      {acc.is_default ? "✓ Default" : "Set Default"}
                    </Button>
                    {!readOnly && (
                      <IconButton size="small" onClick={() => removeAccount(acc._id)} sx={{ color: "#ef4444" }}>
                        <FiTrash2 size={15} />
                      </IconButton>
                    )}
                  </Box>
                  {/* Sandbox + Live columns */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                      gap: 1.5,
                    }}
                  >
                    <GatewayKVSection
                      accId={acc._id} mode="sandbox" rows={acc.sandbox}
                      label="Sandbox" color="#2563eb" bgColor="#eff6ff" borderColor="#bfdbfe"
                      readOnly={readOnly} onAdd={addKV} onRemove={removeKV} onUpdate={updKV}
                    />
                    <GatewayKVSection
                      accId={acc._id} mode="live" rows={acc.live}
                      label="Live" color="#16a34a" bgColor="#f0fdf4" borderColor="#bbf7d0"
                      readOnly={readOnly} onAdd={addKV} onRemove={removeKV} onUpdate={updKV}
                    />
                  </Box>
                </Paper>
              ))}
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

const OWNER_MODULES = {
  "payment-gateways": {
    title: "Payment Gateways",
    endpoint: "/payment-gateways",
    idKeys: ["payment_gateway_id", "id"],
    canCreate: true,
    canUpdate: true,
    canDelete: false,
    updateMethods: ["PATCH", "PUT"],
    formFields: [
      { name: "gateway_key", label: "Gateway Key", type: "text", required: true },
      { name: "gateway_name", label: "Gateway Name", type: "text", required: true },
      { name: "provider", label: "Provider", type: "text" },
      { name: "display_order", label: "Display Order", type: "number" },
      {
        name: "is_enabled",
        label: "Enabled",
        type: "select",
        options: [
          { label: "Enabled", value: "true" },
          { label: "Disabled", value: "false" },
        ],
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
      { name: "config_json", label: "Config JSON", type: "gateway_config" },
    ],
  },
  plans: {
    title: "Plans",
    endpoint: "/plans",
    idKeys: ["plan_id", "id"],
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    updateMethods: ["PATCH", "PUT"],
    formFields: [
      { name: "plan_key", label: "Plan Key", type: "text", required: true },
      { name: "plan_name", label: "Plan Name", type: "text", required: true },
      { name: "description", label: "Description", type: "multiline" },
      { name: "price", label: "Price", type: "number" },
      { name: "default_currency", label: "Currency", type: "text" },
      { name: "interval_days", label: "Interval Days", type: "number", required: true },
      { name: "max_users", label: "Max Users", type: "number" },
      { name: "max_storage_mb", label: "Max Storage (MB)", type: "number" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
    ],
  },
  "plan-features": {
    title: "Plan Features",
    endpoint: "/plan-features",
    idKeys: ["plan_feature_id", "id"],
    canCreate: true,
    canUpdate: true,
    canDelete: false,
    updateMethods: ["PATCH", "PUT"],
    formFields: [
      { name: "plan_id", label: "Plan", type: "select", required: true },
      { name: "feature_name", label: "Feature Name", type: "text", required: true },
      { name: "feature_description", label: "Feature Description", type: "multiline" },
      { name: "feature_icon", label: "Feature Icon", type: "text" },
      { name: "section_label", label: "Section Label", type: "text" },
      { name: "display_order", label: "Display Order", type: "number" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
    ],
  },
  coupons: {
    title: "Coupons",
    endpoint: "/coupons",
    idKeys: ["coupon_id", "id"],
    canCreate: true,
    canUpdate: true,
    canDelete: false,
    updateMethods: ["PATCH", "PUT"],
    formFields: [
      { name: "coupon_code", label: "Coupon Code", type: "text", required: true },
      { name: "coupon_name", label: "Coupon Name", type: "text" },
      { name: "description", label: "Description", type: "multiline" },
      {
        name: "discount_type",
        label: "Discount Type",
        type: "select",
        required: true,
        options: [
          { label: "Percent", value: "percent" },
          { label: "Fixed", value: "fixed" },
        ],
      },
      { name: "discount_value", label: "Discount Value", type: "number", required: true },
      { name: "min_order_amount", label: "Min Order Amount", type: "number" },
      { name: "max_discount_amount", label: "Max Discount Amount", type: "number" },
      { name: "max_uses", label: "Max Uses", type: "number" },
      {
        name: "valid_from",
        label: "Valid From",
        type: "text",
        helperText: "Use ISO datetime. Example: 2026-03-10T00:00:00Z",
      },
      {
        name: "valid_to",
        label: "Valid To",
        type: "text",
        helperText: "Use ISO datetime. Example: 2026-04-10T23:59:59Z",
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
    ],
  },
  roles: {
    title: "Roles",
    endpoint: "/roles",
    idKeys: ["role_id", "id"],
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    updateMethods: ["PATCH", "PUT"],
    formFields: [
      { name: "role_key", label: "Role Key", type: "text", required: true },
      { name: "role_name", label: "Role Name", type: "text", required: true },
      { name: "description", label: "Description", type: "multiline" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
    ],
  },
  "site-details": {
    title: "Site Details",
    endpoint: "/site-details",
    idKeys: ["site_detail_id", "id"],
    canCreate: true,
    canUpdate: true,
    canDelete: false,
    updateMethods: ["PATCH", "PUT"],
    formFields: [
      { name: "brand_name", label: "Brand Name", type: "text", required: true },
      { name: "logo_url", label: "Logo URL", type: "text" },
      { name: "mascot_url", label: "Mascot URL", type: "text" },
      { name: "google_plus_url", label: "Google+ URL", type: "text" },
      { name: "linkedin_url", label: "LinkedIn URL", type: "text" },
      { name: "twitter_url", label: "Twitter URL", type: "text" },
      { name: "youtube_url", label: "YouTube URL", type: "text" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
      {
        name: "emails",
        label: "Emails",
        type: "multiline_array",
        helperText: "One email per line",
      },
      {
        name: "phones",
        label: "Phones",
        type: "multiline_array",
        helperText: "One phone per line",
      },
      {
        name: "addresses",
        label: "Addresses",
        type: "multiline_array",
        helperText: "One address per line",
      },
    ],
  },
  "contact-requests": {
    title: "Contact Requests",
    endpoint: "/contact-us",
    idKeys: ["contact_request_id", "id"],
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  },
  "user-details": {
    title: "User Details",
    endpoint: "/auth/owner/v1/users",
    idKeys: ["user_id", "id"],
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  },
  languages: {
    title: "Languages",
    endpoint: "/languages",
    idKeys: ["language_id", "id"],
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    updateMethods: ["PATCH", "PUT"],
    formFields: [
      { name: "language_code", label: "Language Code", type: "text", required: true },
      { name: "full_name", label: "Language Name", type: "text", required: true },
      { name: "native_name", label: "Native Name", type: "text", required: true },
      {
        name: "direction",
        label: "Direction",
        type: "select",
        options: [
          { label: "LTR", value: "ltr" },
          { label: "RTL", value: "rtl" },
        ],
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
    ],
  },
  timezones: {
    title: "Timezones",
    endpoint: "/timezones",
    idKeys: ["timezone_id", "id"],
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    updateMethods: ["PATCH", "PUT"],
    formFields: [
      { name: "timezone_code", label: "Timezone Code", type: "text", required: true },
      { name: "display_name", label: "Timezone Name", type: "text", required: true },
      { name: "utc_offset", label: "UTC Offset", type: "text", required: true },
      { name: "country_code", label: "Country Code", type: "text" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
    ],
  },
  platforms: {
    title: "Platforms",
    endpoint: "/platforms",
    idKeys: ["platform_id", "id"],
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    updateMethods: ["PATCH", "PUT"],
    formFields: [
      { name: "platform_key", label: "Platform Key", type: "text", required: true },
      { name: "platform_name", label: "Platform Name", type: "text", required: true },
      {
        name: "category",
        label: "Category",
        type: "select",
        options: [
          { label: "Browser", value: "browser" },
          { label: "OS", value: "os" },
          { label: "Device", value: "device" },
          { label: "Other", value: "other" },
        ],
      },
      { name: "icon_class", label: "Icon Class", type: "text" },
    ],
  },
  "message-menu-items": {
    title: "Message Menu Items",
    endpoint: "/message-menu-items",
    idKeys: ["message_menu_item_id", "menu_item_id", "id"],
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    updateMethods: ["PATCH", "PUT"],
    formFields: [
      { name: "menu_key", label: "Menu Key", type: "text", required: true },
      { name: "label", label: "Label", type: "text", required: true },
      {
        name: "default_status",
        label: "Default Status",
        type: "select",
        options: [
          { label: "Show", value: "show" },
          { label: "Hide", value: "hide" },
          { label: "Disable", value: "disable" },
        ],
      },
      {
        name: "scope",
        label: "Scope",
        type: "select",
        options: [
          { label: "Any", value: "any" },
          { label: "Self", value: "self" },
          { label: "Admin", value: "admin" },
        ],
      },
      {
        name: "tone",
        label: "Tone",
        type: "select",
        options: [
          { label: "Normal", value: "normal" },
          { label: "Danger", value: "danger" },
          { label: "Warning", value: "warning" },
          { label: "Info", value: "info" },
        ],
      },
      { name: "icon_class", label: "Icon Class", type: "text" },
      { name: "display_order", label: "Display Order", type: "number" },
    ],
  },
  "feature-categories": {
    title: "Feature Categories",
    endpoint: "/product-features/categories",
    idKeys: ["feature_category_id", "id"],
    canCreate: true,
    canUpdate: true,
    canDelete: false,
    updateMethods: ["PATCH", "PUT"],
    formFields: [
      { name: "category_key", label: "Category Key", type: "text", required: true },
      { name: "category_label", label: "Category Label", type: "text", required: true },
      { name: "display_order", label: "Display Order", type: "number" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
    ],
  },
  "product-features": {
    title: "Product Features",
    endpoint: "/product-features",
    idKeys: ["feature_item_id", "id"],
    canCreate: true,
    canUpdate: true,
    canDelete: false,
    updateMethods: ["PATCH", "PUT"],
    formFields: [
      { name: "feature_category_id", label: "Feature Category", type: "select", valueType: "number", required: true, options: [] },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "description", label: "Description", type: "multiline" },
      { name: "icon_url", label: "Icon URL", type: "text" },
      { name: "display_order", label: "Display Order", type: "number" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
    ],
  },
  "geo-countries": {
    title: "Geo Countries",
    endpoint: "/geo/countries",
    idKeys: ["country_id", "id"],
    canCreate: true,
    canUpdate: true,
    canDelete: false,
    updateMethods: ["PATCH"],
    formFields: [
      { name: "iso_code", label: "ISO Code", type: "text", required: true },
      { name: "name", label: "Country Name", type: "text", required: true },
      { name: "phonecode", label: "Phone Code", type: "text" },
      { name: "currency_code", label: "Currency Code", type: "text" },
      { name: "currency_name", label: "Currency Name", type: "text" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
    ],
  },
  "geo-states": {
    title: "Geo States",
    endpoint: "/geo/states",
    idKeys: ["state_id", "id"],
    blockedRoleIds: [4],
    canCreate: true,
    canUpdate: true,
    canDelete: false,
    updateMethods: ["PATCH"],
    formFields: [
      { name: "country_id", label: "Country", type: "select", required: true, valueType: "number", options: [] },
      { name: "name", label: "State Name", type: "text", required: true },
      { name: "iso_code", label: "State Code", type: "text" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
    ],
  },
  "geo-currencies": {
    title: "Geo Currencies",
    endpoint: "/geo/currencies",
    idKeys: ["currency_code", "currency_id", "id"],
    blockedRoleIds: [4],
    canCreate: true,
    canUpdate: true,
    canDelete: false,
    updateMethods: ["PATCH"],
    formFields: [
      { name: "currency_code", label: "Currency Code", type: "text", required: true, readOnlyOnEdit: true },
      { name: "currency_name", label: "Currency Name", type: "text", required: true },
      { name: "currency_symbol", label: "Currency Symbol", type: "text" },
      { name: "decimal_places", label: "Decimal Places", type: "number" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
    ],
  },
  "activity-logs": {
    title: "Activity Logs",
    endpoint: "/activity-logs",
    idKeys: ["activity_log_id", "log_id", "id"],
    blockedRoleIds: [4],
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  },
};

const stringifyPrimitive = (value) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const toArrayText = (value, keyName) => {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (item && typeof item === "object") {
        const nested = keyName ? item?.[keyName] : item?.value;
        return stringifyPrimitive(nested || "");
      }
      return stringifyPrimitive(item);
    })
    .filter((line) => line.trim())
    .join("\n");
};

const normalizeForCompare = (value) => {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value === undefined || value === null) return "";
  return String(value);
};

const toFormStateFromRow = (moduleConfig, row = null) => {
  const fields = moduleConfig.formFields || [];
  return fields.reduce((acc, field) => {
    if (field.type === "gateway_config") {
      acc[field.name] = row ? parseGatewayConfig(row[field.name]) : { active_mode: "sandbox", accounts: [] };
      return acc;
    }
    if (!row) {
      acc[field.name] = "";
      return acc;
    }
    if (field.type === "multiline_array") {
      const nestedKey =
        field.name === "emails"
          ? "email_address"
          : field.name === "phones"
            ? "phone_number"
            : field.name === "addresses"
              ? "address_line_1"
              : "value";
      acc[field.name] = toArrayText(row?.[field.name], nestedKey);
      return acc;
    }
    if (field.type === "json") {
      const val = row?.[field.name];
      if (val && typeof val === "object") {
        acc[field.name] = JSON.stringify(val, null, 2);
      } else if (typeof val === "string" && val.trim()) {
        try {
          acc[field.name] = JSON.stringify(JSON.parse(val), null, 2);
        } catch {
          acc[field.name] = val;
        }
      } else {
        acc[field.name] = "{}";
      }
      return acc;
    }
    acc[field.name] = stringifyPrimitive(row?.[field.name]);
    return acc;
  }, {});
};

const buildPayloadFromForm = ({ moduleConfig, formState, mode, originalRow, updateMethod }) => {
  const fields = moduleConfig.formFields || [];
  const payload = {};

  for (const field of fields) {
    const rawValue = formState?.[field.name];
    let transformed;

    if (field.type === "gateway_config") {
      const s = rawValue;
      transformed =
        s && typeof s === "object" && Array.isArray(s.accounts) && s.accounts.length > 0
          ? serializeGatewayConfig(s)
          : null;
    } else if (field.type === "multiline_array") {
      transformed = String(rawValue || "")
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
    } else if (field.type === "json") {
      const text = String(rawValue || "").trim();
      if (!text || text === "{}") {
        transformed = null;
      } else {
        try {
          transformed = JSON.parse(text);
        } catch {
          throw new Error(`${field.label} must be valid JSON`);
        }
      }
    } else if (field.type === "number" || field.valueType === "number") {
      if (String(rawValue || "").trim() === "") transformed = null;
      else {
        transformed = Number(rawValue);
        if (!Number.isFinite(transformed)) {
          throw new Error(`${field.label} must be a valid number`);
        }
      }
    } else {
      transformed = String(rawValue || "").trim();
    }

    const isRequired = field.required && (mode === "create" || updateMethod === "PUT");
    if (isRequired) {
      if (
        transformed === null ||
        transformed === "" ||
        (Array.isArray(transformed) && transformed.length === 0)
      ) {
        throw new Error(`${field.label} is required`);
      }
    }

    if (updateMethod === "PATCH" && mode === "edit") {
      if (field.type === "gateway_config") {
        // Always include — encrypted values in DB won't match masked display, can't diff reliably
      } else if (field.type === "json") {
        const origJson = originalRow?.[field.name];
        const origStr = JSON.stringify(origJson && typeof origJson === "object" ? origJson : {});
        const newStr = JSON.stringify(transformed ?? {});
        if (origStr === newStr) continue;
      } else {
        const originalValue = field.type === "multiline_array"
          ? Array.isArray(originalRow?.[field.name])
            ? originalRow[field.name].map((item) => {
                if (item && typeof item === "object") {
                  if (field.name === "emails") return item.email_address || "";
                  if (field.name === "phones") return item.phone_number || "";
                  if (field.name === "addresses") return item.address_line_1 || "";
                }
                return String(item || "");
              }).filter(Boolean)
            : []
          : originalRow?.[field.name];
        if (normalizeForCompare(originalValue) === normalizeForCompare(transformed)) {
          continue;
        }
      }
    }

    if (transformed === "" || transformed === null) {
      if (updateMethod === "PUT" || mode === "create") {
        continue;
      }
    } else {
      payload[field.name] = transformed;
    }
  }

  return payload;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toCellText = (value) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
};

const toDisplayLabel = (key) =>
  String(key || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const normalizeGatewayToken = (token) => String(token || "").split(":")[0].trim();

const normalizeGatewayParts = (value) =>
  String(value || "")
    .split(/[,\|/]+/)
    .map((part) => normalizeGatewayToken(part))
    .filter(Boolean);

const getPrimaryGateway = (value) => normalizeGatewayParts(value)[0] || "N/A";
const PAYPAL_FAVICON_URL =
  "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://paypal.com&size=256";
const STRIPE_FAVICON_URL =
  "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://stripe.com&size=256";
const getGatewayIconUrl = (value) => {
  const key = String(getPrimaryGateway(value) || "").trim().toLowerCase();
  if (key.includes("paypal")) return PAYPAL_FAVICON_URL;
  if (key.includes("stripe")) return STRIPE_FAVICON_URL;
  return "";
};

const renderGatewayChip = (value) => {
  const gateway = getPrimaryGateway(value);
  const normalized = gateway.toLowerCase();
  const label = toDisplayLabel(gateway);
  const iconUrl = normalized.includes("paypal")
    ? PAYPAL_FAVICON_URL
    : normalized.includes("stripe")
      ? STRIPE_FAVICON_URL
      : "";
  const chipColor = normalized.includes("paypal")
    ? "secondary"
    : normalized.includes("stripe")
      ? "primary"
      : normalized.includes("razorpay")
        ? "success"
        : "default";

  return (
    <Chip
      size="small"
      variant="outlined"
      label={label}
      color={chipColor}
      icon={
        iconUrl ? (
          <Box
            component="img"
            src={iconUrl}
            alt={label}
            sx={{
              width: 16,
              height: 16,
              borderRadius: 0.8,
              display: "block",
              objectFit: "cover",
            }}
          />
        ) : (
          <Box
            component="span"
            sx={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
              fontWeight: 800,
            }}
          >
            {label.charAt(0)}
          </Box>
        )
      }
      sx={{ textTransform: "capitalize" }}
    />
  );
};

const toDisplayValue = (value, key = "") => {
  if (value === null || value === undefined || value === "") return "N/A";
  if (Array.isArray(value)) {
    if (!value.length) return "N/A";
    return value
      .map((item) => {
        if (item && typeof item === "object") {
          return (
            item.email_address ||
            item.phone_number ||
            item.address_line_1 ||
            item.name ||
            item.value ||
            JSON.stringify(item)
          );
        }
        return String(item);
      })
      .join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);

  const normalizedKey = String(key).toLowerCase();
  if (normalizedKey.includes("date") || normalizedKey.endsWith("_at")) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString();
    }
  }
  return String(value);
};

const toPrettyJson = (value) => {
  if (!value || typeof value !== "object") return "N/A";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const getActivityActorLabel = (row) =>
  row?.actor?.name || row?.actor?.email || row?.actor_role_key || "N/A";

const getActivityUserLabel = (row) =>
  row?.user?.name || row?.user?.email || row?.target?.name || row?.target?.email || "N/A";

const getActivityTargetLabel = (row) => {
  const targetType = row?.target?.type ? String(row.target.type) : "N/A";
  const targetId = row?.target?.id ?? "N/A";
  return `${targetType} #${targetId}`;
};

const getActivityOrgLabel = (row) =>
  row?.organization?.name || row?.organization?.organization_id || row?.context_organization_id || "N/A";

const isIdField = (key) => {
  const normalized = String(key || "").toLowerCase();
  return normalized === "id" || normalized.endsWith("_id");
};

const isAuditField = (key) => {
  const normalized = String(key || "").toLowerCase();
  return normalized === "created_at" || normalized === "updated_at";
};

const isStatusField = (key) => String(key || "").toLowerCase().includes("status");

const getStatusChipColor = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["active", "paid", "completed", "success"].includes(normalized)) return "success";
  if (["inactive", "failed", "rejected", "cancelled", "canceled", "expired"].includes(normalized)) return "error";
  if (["pending", "invited", "trial", "new"].includes(normalized)) return "warning";
  if (["processing", "in-progress", "in_progress"].includes(normalized)) return "info";
  return "default";
};

const renderStatusChip = (value) => (
  <Chip
    size="small"
    variant="outlined"
    label={toCellText(value)}
    color={getStatusChipColor(value)}
    sx={{ textTransform: "capitalize" }}
  />
);

const canOwnerCompletePayment = (row) => {
  const status = String(row?.payment_status || row?.status || "").trim().toLowerCase();
  return status === "pending" || status === "failed";
};

const toRows = (payload) => {
  const data = payload?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  if (data && typeof data === "object") return [data];
  return [];
};

const toCount = (payload, rows) => {
  const data = payload?.data;
  const count = Number(data?.count);
  if (Number.isFinite(count) && count >= 0) return count;
  return rows.length;
};

const resolveRowId = (row, idKeys = []) => {
  const keys = [...idKeys, "id"];
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
};

const ResourcePanel = ({
  moduleConfig,
  currentRoleId = 1,
  dialogSize = "medium",
  onDialogSizeChange = () => {},
}) => {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [createForm, setCreateForm] = useState(() => toFormStateFromRow(moduleConfig, null));
  const [editForm, setEditForm] = useState(() => toFormStateFromRow(moduleConfig, null));
  const [selectedRow, setSelectedRow] = useState(null);
  const [featureCategoryOptions, setFeatureCategoryOptions] = useState([]);
  const [featureCategoryLoading, setFeatureCategoryLoading] = useState(false);
  const [countryOptions, setCountryOptions] = useState([]);
  const [countryOptionsLoading, setCountryOptionsLoading] = useState(false);
  const [planOptions, setPlanOptions] = useState([]);
  const [planOptionsLoading, setPlanOptionsLoading] = useState(false);
  const [filterPlanId, setFilterPlanId] = useState("");
  const [userInsightLoading, setUserInsightLoading] = useState(false);
  const [userInsightError, setUserInsightError] = useState("");
  const [userInsightUser, setUserInsightUser] = useState(null);
  const [userInsightOrganization, setUserInsightOrganization] = useState(null);
  const [userInsightMembership, setUserInsightMembership] = useState(null);
  const [userDevicesRows, setUserDevicesRows] = useState([]);
  const [userSessionsRows, setUserSessionsRows] = useState([]);
  const [userProfileDialogOpen, setUserProfileDialogOpen] = useState(false);
  const [userDevicesDialogOpen, setUserDevicesDialogOpen] = useState(false);
  const [userSessionsDialogOpen, setUserSessionsDialogOpen] = useState(false);
  const modalPaperSx = getDialogPaperSx(dialogSize);
  const modalDialogSx = {
    "& .MuiDialog-container": {
      px: { xs: 1.5, md: 0 },
      pl: { md: "310px" },
      pr: { md: "50px" },
    },
  };
  const renderDialogHeading = (title, subtitle = "") => (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      alignItems={{ xs: "flex-start", sm: "center" }}
      justifyContent="space-between"
      spacing={1}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="h6" sx={{ fontSize: { xs: 18, sm: 20 } }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Stack>
      <DialogSizeSelector value={dialogSize} onChange={onDialogSizeChange} />
    </Stack>
  );
  const isContactRequests = moduleConfig.endpoint === "/contact-us";
  const isUsersModule = moduleConfig.endpoint === "/auth/owner/v1/users";
  const isOwnerRole = Number(currentRoleId) === 1;
  const canCreate = Boolean(moduleConfig.canCreate && isOwnerRole);
  const canUpdate = Boolean(moduleConfig.canUpdate && isOwnerRole);
  const canDelete = Boolean(moduleConfig.canDelete && isOwnerRole);

  useEffect(() => {
    setOffset(0);
    setSearch("");
    setSearchInput("");
    setError("");
    setSelectedRow(null);
    setOpenCreate(false);
    setOpenEdit(false);
    setOpenView(false);
    setUserInsightError("");
    setUserInsightUser(null);
    setUserInsightOrganization(null);
    setUserInsightMembership(null);
    setUserDevicesRows([]);
    setUserSessionsRows([]);
    setUserProfileDialogOpen(false);
    setUserDevicesDialogOpen(false);
    setUserSessionsDialogOpen(false);
    setCreateForm(toFormStateFromRow(moduleConfig, null));
    setEditForm(toFormStateFromRow(moduleConfig, null));
    setFeatureCategoryOptions([]);
    setCountryOptions([]);
    setPlanOptions([]);
    setFilterPlanId("");
  }, [moduleConfig]);

  const fetchUserInsight = useCallback(async (row) => {
    const userId = Number(row?.user_id);
    const organizationId = Number(row?.organization_id);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new Error("User id missing");
    }
    if (!Number.isFinite(organizationId) || organizationId <= 0) {
      throw new Error("Organization id missing");
    }
    setUserInsightLoading(true);
    setUserInsightError("");
    try {
      const params = new URLSearchParams();
      params.set("organization_id", String(organizationId));
      params.set("limit", "100");
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/auth/owner/v1/users/${userId}/insights?${params.toString()}`,
        { method: "GET" },
      );
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Unable to load user details");
      }
      const userData = payload?.data?.user || null;
      const organizationData = payload?.data?.organization || null;
      const membershipData = payload?.data?.organization_member || null;
      const devices = Array.isArray(payload?.data?.user_devices) ? payload.data.user_devices : [];
      const sessions = Array.isArray(payload?.data?.user_sessions) ? payload.data.user_sessions : [];
      setUserInsightUser(userData);
      setUserInsightOrganization(organizationData);
      setUserInsightMembership(membershipData);
      setUserDevicesRows(devices);
      setUserSessionsRows(sessions);
    } catch (fetchError) {
      setUserInsightUser(null);
      setUserInsightOrganization(null);
      setUserInsightMembership(null);
      setUserDevicesRows([]);
      setUserSessionsRows([]);
      setUserInsightError(fetchError?.message || "Unable to load user details");
      throw fetchError;
    } finally {
      setUserInsightLoading(false);
    }
  }, []);

  useEffect(() => {
    if (moduleConfig.endpoint !== "/product-features") return;
    let cancelled = false;

    const fetchFeatureCategories = async () => {
      setFeatureCategoryLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "500");
        params.set("offset", "0");
        const { response, payload } = await fetchWithAuth(
          `${API_BASE_URL}/product-features/categories?${params.toString()}`,
          { method: "GET" },
        );
        if (cancelled || response.status === 304) return;
        if (!response.ok || payload?.status === "error") {
          throw new Error(payload?.message || "Unable to load feature categories");
        }
        const rows = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
        const options = rows.map((row) => ({
          label: toCellText(row.category_label),
          value: String(row.feature_category_id),
        }));
        setFeatureCategoryOptions(options);
      } catch {
        if (!cancelled) setFeatureCategoryOptions([]);
      } finally {
        if (!cancelled) setFeatureCategoryLoading(false);
      }
    };

    fetchFeatureCategories();
    return () => {
      cancelled = true;
    };
  }, [moduleConfig.endpoint]);

  useEffect(() => {
    if (moduleConfig.endpoint !== "/geo/states") return;
    let cancelled = false;

    const fetchCountries = async () => {
      setCountryOptionsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "500");
        params.set("offset", "0");
        const { response, payload } = await fetchWithAuth(
          `${API_BASE_URL}/geo/countries?${params.toString()}`,
          { method: "GET" },
        );
        if (cancelled || response.status === 304) return;
        if (!response.ok || payload?.status === "error") {
          throw new Error(payload?.message || "Unable to load countries");
        }
        const rows = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
        const options = rows.map((row) => ({
          label: `${toCellText(row.name)} (${toCellText(row.iso_code)})`,
          value: String(row.country_id),
        }));
        setCountryOptions(options);
      } catch {
        if (!cancelled) setCountryOptions([]);
      } finally {
        if (!cancelled) setCountryOptionsLoading(false);
      }
    };

    fetchCountries();
    return () => {
      cancelled = true;
    };
  }, [moduleConfig.endpoint]);

  useEffect(() => {
    if (moduleConfig.endpoint !== "/plan-features") return;
    let cancelled = false;
    const fetchPlans = async () => {
      setPlanOptionsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "500");
        params.set("offset", "0");
        const { response, payload } = await fetchWithAuth(
          `${API_BASE_URL}/plans?${params.toString()}`,
          { method: "GET" },
        );
        if (cancelled || response.status === 304) return;
        if (!response.ok || payload?.status === "error") {
          throw new Error(payload?.message || "Unable to load plans");
        }
        const planRows = toRows(payload);
        const options = planRows.map((row) => ({
          label: toCellText(row.plan_name || row.plan_key || String(row.plan_id)),
          value: String(row.plan_id),
        }));
        if (!cancelled) setPlanOptions(options);
      } catch {
        if (!cancelled) setPlanOptions([]);
      } finally {
        if (!cancelled) setPlanOptionsLoading(false);
      }
    };
    fetchPlans();
    return () => {
      cancelled = true;
    };
  }, [moduleConfig.endpoint]);

  const visibleColumns = useMemo(() => {
    const allKeys = new Set();
    rows.forEach((row) =>
      Object.keys(row || {}).forEach((key) => {
        if (!isIdField(key) && !isAuditField(key)) allKeys.add(key);
      }),
    );

    if (isContactRequests) {
      const contactPriority = [
        "name",
        "status",
        "email_address",
        "country_code",
        "mobile_number",
        "total_users",
      ];
      const ordered = [
        ...contactPriority.filter((key) => allKeys.has(key)),
        ...Array.from(allKeys).filter((key) => !contactPriority.includes(key)),
      ];
      return ordered.slice(0, 6);
    }

    const prioritized = [
      "name",
      "title",
      "plan_name",
      "role_name",
      "status",
      "email_address",
    ];
    const ordered = [
      ...prioritized.filter((key) => allKeys.has(key)),
      ...Array.from(allKeys).filter((key) => !prioritized.includes(key)),
    ];
    return ordered.slice(0, 5);
  }, [rows, isContactRequests]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("limit", String(RESOURCE_PAGE_SIZE));
      params.set("offset", String(offset));
      if (search.trim()) params.set("search", search.trim());
      if (moduleConfig.endpoint === "/plan-features" && filterPlanId) params.set("plan_id", filterPlanId);

      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}${moduleConfig.endpoint}?${params.toString()}`,
        { method: "GET" },
      );

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || `Unable to load ${moduleConfig.title}`);
      }

      const nextRows = toRows(payload);
      setRows(nextRows);
      setTotalCount(toCount(payload, nextRows));
    } catch (fetchError) {
      setError(fetchError?.message || `Unable to load ${moduleConfig.title}`);
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [moduleConfig.endpoint, moduleConfig.title, offset, search, filterPlanId]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const handleCreate = async () => {
    try {
      const payload = buildPayloadFromForm({
        moduleConfig,
        formState: createForm,
        mode: "create",
        originalRow: null,
        updateMethod: "POST",
      });
      setSaving(true);
      const { response, payload: result } = await fetchWithAuth(`${API_BASE_URL}${moduleConfig.endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok || result?.status === "error") {
        throw new Error(result?.message || `Unable to create ${moduleConfig.title}`);
      }
      setOpenCreate(false);
      setCreateForm(toFormStateFromRow(moduleConfig, null));
      await fetchRows();
    } catch (createError) {
      setError(createError?.message || `Unable to create ${moduleConfig.title}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (row) => {
    setSelectedRow(row);
    setEditForm(toFormStateFromRow(moduleConfig, row || null));
    setOpenEdit(true);
  };

  const handleEdit = async () => {
    if (!selectedRow) return;
    const rowId = resolveRowId(selectedRow, moduleConfig.idKeys);
    if (!rowId) {
      setError("Row id missing for update");
      return;
    }
    try {
      const payload = buildPayloadFromForm({
        moduleConfig,
        formState: editForm,
        mode: "edit",
        originalRow: selectedRow,
        updateMethod: "PATCH",
      });
      if (!Object.keys(payload).length) {
        throw new Error("No changes found for update");
      }
      setSaving(true);
      const { response, payload: result } = await fetchWithAuth(
        `${API_BASE_URL}${moduleConfig.endpoint}/${rowId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok || result?.status === "error") {
        throw new Error(result?.message || `Unable to update ${moduleConfig.title}`);
      }
      setOpenEdit(false);
      setEditForm(toFormStateFromRow(moduleConfig, null));
      await fetchRows();
    } catch (editError) {
      setError(editError?.message || `Unable to update ${moduleConfig.title}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    const rowId = resolveRowId(row, moduleConfig.idKeys);
    if (!rowId) {
      setError("Row id missing for delete");
      return;
    }
    const ok =
      typeof window !== "undefined"
        ? window.confirm("Delete this record?")
        : true;
    if (!ok) return;

    try {
      setSaving(true);
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}${moduleConfig.endpoint}/${rowId}`,
        { method: "DELETE" },
      );
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || `Unable to delete ${moduleConfig.title}`);
      }
      await fetchRows();
    } catch (deleteError) {
      setError(deleteError?.message || `Unable to delete ${moduleConfig.title}`);
    } finally {
      setSaving(false);
    }
  };

  const gridRows = useMemo(
    () =>
      rows.map((row, index) => ({
        ...row,
        __srNo: offset + index + 1,
        __rowKey: resolveRowId(row, moduleConfig.idKeys) || `row-${index}`,
      })),
    [rows, moduleConfig.idKeys, offset],
  );

  const gridColumns = useMemo(() => {
    const isPaymentGatewaysModule = moduleConfig.endpoint === "/payment-gateways";
    const isPlansModule = moduleConfig.endpoint === "/plans";
    const isCouponsModule = moduleConfig.endpoint === "/coupons";
    const isRolesModule = moduleConfig.endpoint === "/roles";
    const isLanguagesModule = moduleConfig.endpoint === "/languages";
    const isTimezonesModule = moduleConfig.endpoint === "/timezones";
    const isPlatformsModule = moduleConfig.endpoint === "/platforms";
    const isMessageMenuItemsModule = moduleConfig.endpoint === "/message-menu-items";
    const isFeatureCategoriesModule = moduleConfig.endpoint === "/product-features/categories";
    const isProductFeaturesModule = moduleConfig.endpoint === "/product-features";
    const isGeoCountriesModule = moduleConfig.endpoint === "/geo/countries";
    const isGeoStatesModule = moduleConfig.endpoint === "/geo/states";
    const isGeoCurrenciesModule = moduleConfig.endpoint === "/geo/currencies";
    const isActivityLogsModule = moduleConfig.endpoint === "/activity-logs";
    const isContactRequestsModule = moduleConfig.endpoint === "/contact-us";
    const isUsersModule = moduleConfig.endpoint === "/auth/owner/v1/users";
    const serialColumn = {
      field: "__srNo",
      headerName: "Sr.",
      minWidth: 80,
      maxWidth: 90,
      sortable: false,
      filterable: false,
      renderCell: (params) => toCellText(params.value),
    };

    const baseColumns = isPlansModule
      ? [
          serialColumn,
          {
            field: "plan_name",
            headerName: "Plan Name",
            minWidth: 220,
            flex: 1.3,
            renderCell: (params) => (
              <Typography variant="body2" fontWeight={700} noWrap title={toCellText(params.value)}>
                {toCellText(params.value)}
              </Typography>
            ),
          },
          {
            field: "price",
            headerName: "Price",
            minWidth: 120,
            flex: 0.8,
            renderCell: (params) => toCellText(params.value),
          },
          {
            field: "interval_days",
            headerName: "Interval Days",
            minWidth: 130,
            flex: 0.8,
            renderCell: (params) => toCellText(params.value),
          },
          {
            field: "status",
            headerName: "Status",
            minWidth: 120,
            flex: 0.8,
            renderCell: (params) => renderStatusChip(params.value),
          },
        ]
      : isCouponsModule
        ? [
            {
              field: "coupon_code",
              headerName: "Coupon Code",
              minWidth: 220,
              flex: 1.4,
              renderCell: (params) => (
                <Typography variant="body2" fontWeight={700} noWrap title={toCellText(params.value)}>
                  {toCellText(params.value)}
                </Typography>
              ),
            },
            {
              field: "discount_type",
              headerName: "Discount Type",
              minWidth: 160,
              flex: 1,
              renderCell: (params) => toCellText(params.value),
            },
            {
              field: "status",
              headerName: "Status",
              minWidth: 120,
              flex: 0.8,
              renderCell: (params) => renderStatusChip(params.value),
            },
          ]
      : isRolesModule
        ? [
            serialColumn,
            {
              field: "role_name",
              headerName: "Role Name",
              minWidth: 220,
              flex: 1.2,
              renderCell: (params) => (
                <Typography variant="body2" fontWeight={700} noWrap title={toCellText(params.value)}>
                  {toCellText(params.value)}
                </Typography>
              ),
            },
            {
              field: "status",
              headerName: "Status",
              minWidth: 120,
              flex: 0.8,
              renderCell: (params) => renderStatusChip(params.value),
            },
          ]
      : isLanguagesModule
        ? [
            serialColumn,
            {
              field: "full_name",
              headerName: "Language Name",
              minWidth: 220,
              flex: 1.2,
              renderCell: (params) => (
                <Typography variant="body2" fontWeight={700} noWrap title={toCellText(params.value)}>
                  {toCellText(params.value)}
                </Typography>
              ),
            },
            {
              field: "language_code",
              headerName: "Code",
              minWidth: 120,
              flex: 0.8,
              renderCell: (params) => toCellText(params.value),
            },
            {
              field: "native_name",
              headerName: "Native Name",
              minWidth: 170,
              flex: 1,
              renderCell: (params) => toCellText(params.value),
            },
            {
              field: "direction",
              headerName: "Direction",
              minWidth: 120,
              flex: 0.8,
              renderCell: (params) => toCellText(params.value).toUpperCase(),
            },
            {
              field: "status",
              headerName: "Status",
              minWidth: 120,
              flex: 0.8,
              renderCell: (params) => renderStatusChip(params.value),
            },
          ]
      : isTimezonesModule
        ? [
            serialColumn,
            {
              field: "display_name",
              headerName: "Timezone",
              minWidth: 240,
              flex: 1.3,
              renderCell: (params) => (
                <Typography variant="body2" fontWeight={700} noWrap title={toCellText(params.value)}>
                  {toCellText(params.value)}
                </Typography>
              ),
            },
            {
              field: "timezone_code",
              headerName: "Code",
              minWidth: 130,
              flex: 0.8,
              renderCell: (params) => toCellText(params.value),
            },
            {
              field: "utc_offset",
              headerName: "UTC Offset",
              minWidth: 120,
              flex: 0.8,
              renderCell: (params) => toCellText(params.value),
            },
            {
              field: "country_code",
              headerName: "Country",
              minWidth: 120,
              flex: 0.8,
              renderCell: (params) => toCellText(params.value),
            },
            {
              field: "status",
              headerName: "Status",
              minWidth: 120,
              flex: 0.8,
              renderCell: (params) => renderStatusChip(params.value),
            },
          ]
      : isPlatformsModule
        ? [
            serialColumn,
            {
              field: "platform_name",
              headerName: "Platform",
              minWidth: 220,
              flex: 1.2,
              renderCell: (params) => (
                <Typography variant="body2" fontWeight={700} noWrap title={toCellText(params.value)}>
                  {toCellText(params.value)}
                </Typography>
              ),
            },
            {
              field: "platform_key",
              headerName: "Key",
              minWidth: 160,
              flex: 1,
              renderCell: (params) => (
                <Typography variant="body2" noWrap title={toCellText(params.value)}>
                  {toCellText(params.value)}
                </Typography>
              ),
            },
            {
              field: "category",
              headerName: "Category",
              minWidth: 120,
              flex: 0.8,
              renderCell: (params) => toCellText(params.value),
            },
            {
              field: "icon_class",
              headerName: "Icon Class",
              minWidth: 170,
              flex: 1,
              renderCell: (params) => toCellText(params.value),
            },
          ]
      : isMessageMenuItemsModule
        ? [
            serialColumn,
            {
              field: "label",
              headerName: "Label",
              minWidth: 220,
              flex: 1.8,
              renderCell: (params) => (
                <Typography variant="body2" fontWeight={700} noWrap title={toCellText(params.value)}>
                  {toCellText(params.value)}
                </Typography>
              ),
            },
          ]
      : isFeatureCategoriesModule
        ? [
            serialColumn,
            {
              field: "category_label",
              headerName: "Category",
              minWidth: 220,
              flex: 1.2,
              renderCell: (params) => (
                <Typography variant="body2" fontWeight={700} noWrap title={toCellText(params.value)}>
                  {toCellText(params.value)}
                </Typography>
              ),
            },
            {
              field: "category_key",
              headerName: "Key",
              minWidth: 170,
              flex: 1,
              renderCell: (params) => toCellText(params.value),
            },
            {
              field: "feature_count",
              headerName: "Features",
              minWidth: 120,
              flex: 0.8,
              renderCell: (params) => toCellText(params.value),
            },
            {
              field: "display_order",
              headerName: "Order",
              minWidth: 100,
              flex: 0.7,
              renderCell: (params) => toCellText(params.value),
            },
            {
              field: "status",
              headerName: "Status",
              minWidth: 120,
              flex: 0.8,
              renderCell: (params) => renderStatusChip(params.value),
            },
          ]
      : isProductFeaturesModule
        ? [
            serialColumn,
            {
              field: "title",
              headerName: "Feature Title",
              minWidth: 220,
              flex: 1.3,
              renderCell: (params) => (
                <Typography variant="body2" fontWeight={700} noWrap title={toCellText(params.value)}>
                  {toCellText(params.value)}
                </Typography>
              ),
            },
            {
              field: "category_label",
              headerName: "Category",
              minWidth: 170,
              flex: 1,
              renderCell: (params) => toCellText(params.value),
            },
            {
              field: "display_order",
              headerName: "Order",
              minWidth: 100,
              flex: 0.7,
              renderCell: (params) => toCellText(params.value),
            },
            {
              field: "status",
              headerName: "Status",
              minWidth: 120,
              flex: 0.8,
              renderCell: (params) => renderStatusChip(params.value),
            },
          ]
      : isGeoCountriesModule
        ? [
            serialColumn,
            {
              field: "name",
              headerName: "Country",
              minWidth: 220,
              flex: 1.2,
              renderCell: (params) => (
                <Typography variant="body2" fontWeight={700} noWrap title={toCellText(params.value)}>
                  {toCellText(params.value)}
                </Typography>
              ),
            },
            {
              field: "iso_code",
              headerName: "ISO",
              minWidth: 110,
              flex: 0.6,
              renderCell: (params) => toCellText(params.value),
            },
            {
              field: "phonecode",
              headerName: "Phone Code",
              minWidth: 120,
              flex: 0.6,
              renderCell: (params) => toCellText(params.value),
            },
            {
              field: "currency_code",
              headerName: "Currency",
              minWidth: 120,
              flex: 0.7,
              renderCell: (params) => toCellText(params.value),
            },
          ]
      : isGeoStatesModule
        ? [
            serialColumn,
            {
              field: "name",
              headerName: "State",
              minWidth: 220,
              flex: 1.2,
              renderCell: (params) => (
                <Typography variant="body2" fontWeight={700} noWrap title={toCellText(params.value)}>
                  {toCellText(params.value)}
                </Typography>
              ),
            },
            {
              field: "iso_code",
              headerName: "Code",
              minWidth: 120,
              flex: 0.7,
              renderCell: (params) => toCellText(params.value),
            },
            {
              field: "country_name",
              headerName: "Country",
              minWidth: 180,
              flex: 1,
              renderCell: (params) => toCellText(params.value),
            },
            {
              field: "country_iso",
              headerName: "Country ISO",
              minWidth: 130,
              flex: 0.8,
              renderCell: (params) => toCellText(params.value),
            },
          ]
      : isGeoCurrenciesModule
        ? [
            serialColumn,
            {
              field: "currency_name",
              headerName: "Currency",
              minWidth: 200,
              flex: 1.1,
              renderCell: (params) => (
                <Typography variant="body2" fontWeight={700} noWrap title={toCellText(params.value)}>
                  {toCellText(params.value)}
                </Typography>
              ),
            },
            {
              field: "currency_code",
              headerName: "Code",
              minWidth: 110,
              flex: 0.7,
              renderCell: (params) => toCellText(params.value),
            },
            {
              field: "status",
              headerName: "Status",
              minWidth: 120,
              flex: 0.8,
              renderCell: (params) => renderStatusChip(params.value),
            },
          ]
      : isActivityLogsModule
        ? [
            {
              field: "__user",
              headerName: "User",
              minWidth: 220,
              flex: 1.2,
              sortable: false,
              filterable: false,
              renderCell: (params) => toCellText(getActivityUserLabel(params.row)),
            },
            {
              field: "__organization",
              headerName: "Organization",
              minWidth: 230,
              flex: 1.3,
              sortable: false,
              filterable: false,
              renderCell: (params) => toCellText(getActivityOrgLabel(params.row)),
            },
            {
              field: "action_category",
              headerName: "Category",
              minWidth: 170,
              flex: 0.8,
              renderCell: (params) => toCellText(params.value),
            },
            {
              field: "occurred_at",
              headerName: "Date",
              minWidth: 190,
              flex: 1,
              renderCell: (params) => toDisplayValue(params.value, "occurred_at"),
            },
          ]
      : isContactRequestsModule
        ? [
            serialColumn,
            {
              field: "name",
              headerName: "Name",
              minWidth: 220,
              flex: 1.2,
              renderCell: (params) => (
                <Typography variant="body2" fontWeight={700} noWrap title={toCellText(params.value)}>
                  {toCellText(params.value)}
                </Typography>
              ),
            },
            {
              field: "email_address",
              headerName: "Email",
              minWidth: 240,
              flex: 1.4,
              renderCell: (params) => (
                <Typography variant="body2" noWrap title={toCellText(params.value)}>
                  {toCellText(params.value)}
                </Typography>
              ),
            },
            {
              field: "mobile_number",
              headerName: "Mobile",
              minWidth: 170,
              flex: 1,
              renderCell: (params) => {
                const countryCode = toCellText(params.row?.country_code);
                const mobile = toCellText(params.value);
                return `${countryCode} ${mobile}`.trim();
              },
            },
            {
              field: "total_users",
              headerName: "Total Users",
              minWidth: 130,
              flex: 0.8,
              renderCell: (params) => toCellText(params.value),
            },
            {
              field: "status",
              headerName: "Status",
              minWidth: 120,
              flex: 0.8,
              renderCell: (params) => renderStatusChip(params.value),
            },
          ]
      : isPaymentGatewaysModule
        ? [
            serialColumn,
            {
              field: "gateway_name",
              headerName: "Gateway Name",
              minWidth: 160,
              flex: 1.2,
              renderCell: (params) => (
                <Typography variant="body2" fontWeight={700} noWrap title={toCellText(params.value)}>
                  {toCellText(params.value)}
                </Typography>
              ),
            },
            {
              field: "config_json",
              headerName: "Active Mode",
              minWidth: 130,
              flex: 0.9,
              sortable: false,
              renderCell: (params) => {
                const cfg = params.value && typeof params.value === "object" ? params.value : {};
                const mode = String(cfg.active_mode || cfg.activeMode || "sandbox").toLowerCase();
                return (
                  <Chip
                    label={mode === "live" ? "🟢 Live" : "🔵 Sandbox"}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      fontSize: 12,
                      backgroundColor: mode === "live" ? "#dcfce7" : "#dbeafe",
                      color: mode === "live" ? "#15803d" : "#1d4ed8",
                      border: `1px solid ${mode === "live" ? "#86efac" : "#93c5fd"}`,
                    }}
                  />
                );
              },
            },
            {
              field: "status",
              headerName: "Status",
              minWidth: 110,
              flex: 0.7,
              renderCell: (params) => renderStatusChip(params.value),
            },
            {
              field: "is_enabled",
              headerName: "Enabled",
              minWidth: 110,
              flex: 0.7,
              renderCell: (params) => {
                const enabled = params.value === true || params.value === "true";
                return (
                  <Chip
                    label={enabled ? "Yes" : "No"}
                    size="small"
                    sx={{
                      fontWeight: 600,
                      fontSize: 12,
                      backgroundColor: enabled ? "#f0fdf4" : "#fef2f2",
                      color: enabled ? "#16a34a" : "#dc2626",
                      border: `1px solid ${enabled ? "#bbf7d0" : "#fecaca"}`,
                    }}
                  />
                );
              },
            },
          ]
      : isUsersModule
        ? [
            serialColumn,
            {
              field: "organization_name",
              headerName: "Organization",
              minWidth: 220,
              flex: 1.2,
              renderCell: (params) => (
                <Typography variant="body2" fontWeight={700} noWrap title={toCellText(params.value)}>
                  {toCellText(params.value)}
                </Typography>
              ),
            },
            {
              field: "name",
              headerName: "Name",
              minWidth: 220,
              flex: 1.2,
              renderCell: (params) => (
                <Typography variant="body2" fontWeight={700} noWrap title={toCellText(params.value)}>
                  {toCellText(params.value)}
                </Typography>
              ),
            },
            {
              field: "email",
              headerName: "Email",
              minWidth: 240,
              flex: 1.4,
              renderCell: (params) => (
                <Typography variant="body2" noWrap title={toCellText(params.value)}>
                  {toCellText(params.value)}
                </Typography>
              ),
            },
          ]
      : [
          serialColumn,
          ...visibleColumns.map((column) => ({
            field: column,
            headerName: toDisplayLabel(column),
            flex: 1,
            minWidth: 150,
            renderCell: (params) => {
              if (isStatusField(column)) return renderStatusChip(params.value);

              if (isContactRequests && column === "name") {
                return (
                  <Typography variant="body2" fontWeight={600} noWrap title={toCellText(params.value)}>
                    {toCellText(params.value)}
                  </Typography>
                );
              }

              if (isContactRequests && column === "email_address") {
                return (
                  <Typography variant="body2" noWrap title={toCellText(params.value)}>
                    {toCellText(params.value)}
                  </Typography>
                );
              }

              if (isContactRequests && column === "mobile_number") {
                const countryCode = toCellText(params.row?.country_code);
                const mobile = toCellText(params.value);
                return `${countryCode} ${mobile}`.trim();
              }

              return toCellText(params.value);
            },
          })),
        ];

    const actionColumn = {
      field: "__actions",
      headerName: "Action",
      minWidth: isUsersModule ? 410 : canUpdate || canDelete ? 260 : 130,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.6} justifyContent="flex-end" sx={{ py: 0.5 }}>
          {isUsersModule ? (
            <>
              <Button
                size="small"
                color="info"
                variant="contained"
                startIcon={<FiEye size={14} />}
                onClick={async () => {
                  try {
                    await fetchUserInsight(params.row);
                    setUserProfileDialogOpen(true);
                  } catch {
                    // Error already handled in state.
                  }
                }}
                disabled={userInsightLoading}
              >
                View
              </Button>
              <Button
                size="small"
                color="primary"
                variant="contained"
                startIcon={<FiUsers size={14} />}
                onClick={async () => {
                  try {
                    await fetchUserInsight(params.row);
                    setUserDevicesDialogOpen(true);
                  } catch {
                    // Error already handled in state.
                  }
                }}
                disabled={userInsightLoading}
              >
                Devices
              </Button>
              <Button
                size="small"
                color="secondary"
                variant="contained"
                startIcon={<FiEye size={14} />}
                onClick={async () => {
                  try {
                    await fetchUserInsight(params.row);
                    setUserSessionsDialogOpen(true);
                  } catch {
                    // Error already handled in state.
                  }
                }}
                disabled={userInsightLoading}
              >
                Sessions
              </Button>
            </>
          ) : (
            <>
          <Button
            size="small"
            color="info"
            variant="contained"
            startIcon={<FiEye size={14} />}
            onClick={() => {
              setSelectedRow(params.row);
              setOpenView(true);
            }}
          >
            View
          </Button>
          {canUpdate ? (
            <Button
              size="small"
              color="warning"
              variant="contained"
              startIcon={<FiEdit2 size={14} />}
              onClick={() => handleOpenEdit(params.row)}
            >
              Edit
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              size="small"
              color="error"
              variant="contained"
              startIcon={<FiTrash2 size={14} />}
              onClick={() => handleDelete(params.row)}
            >
              Delete
            </Button>
          ) : null}
            </>
          )}
        </Stack>
      ),
    };

    return [...baseColumns, actionColumn];
  }, [visibleColumns, canUpdate, canDelete, moduleConfig.endpoint, handleDelete, isContactRequests, isUsersModule, fetchUserInsight, userInsightLoading]);

  const resourceColumnVisibilityModel = useMemo(() => {
    if (!isSmall) return {};
    const model = {};
    visibleColumns.forEach((key, index) => {
      model[key] = index < 4;
    });
    return model;
  }, [isSmall, visibleColumns]);

  const formFields = moduleConfig.formFields || [];

  const renderReadOnlyObject = (rowObject) => (
    <Stack spacing={1}>
      {Object.entries(rowObject || {})
        .filter(([key]) => !String(key).startsWith("__") && !isIdField(key) && !isAuditField(key))
        .map(([key, value]) => (
          <TextField
            key={key}
            fullWidth
            size="small"
            label={key}
            value={typeof value === "object" ? JSON.stringify(value) : toCellText(value)}
            InputProps={{ readOnly: true }}
          />
        ))}
    </Stack>
  );

  const renderPrettyView = (rowObject) => {
    if (moduleConfig.endpoint === "/activity-logs") {
      const actorLabel = getActivityActorLabel(rowObject);
      const userLabel = getActivityUserLabel(rowObject);
      const targetLabel = getActivityTargetLabel(rowObject);
      const orgLabel = getActivityOrgLabel(rowObject);
      const oldValues = rowObject?.changes?.old_values ?? rowObject?.old_values ?? rowObject?.oldValues;
      const newValues = rowObject?.changes?.new_values ?? rowObject?.new_values ?? rowObject?.newValues;
      const ipAddress = rowObject?.request_meta?.ip_address || "N/A";
      const userAgent = rowObject?.request_meta?.user_agent || "N/A";
      const parseAuditPayload = (value) => {
        if (value == null) return {};
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (!trimmed) return {};
          try {
            const parsed = JSON.parse(trimmed);
            return parsed && typeof parsed === "object" ? parsed : { value: parsed };
          } catch {
            return { value: trimmed };
          }
        }
        if (typeof value === "object") return value;
        return { value };
      };
      const formatActivityValue = (value, keyName = "") => {
        if (value === null || value === undefined || value === "") return "N/A";
        if (typeof value === "boolean") return value ? "Yes" : "No";
        if (typeof value === "number") return String(value);
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (!trimmed) return "N/A";
          const lowerKey = String(keyName || "").toLowerCase();
          if (lowerKey.includes("date") || lowerKey.endsWith("_at")) {
            const parsed = new Date(trimmed);
            if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString();
          }
          return trimmed;
        }
        if (Array.isArray(value)) {
          if (!value.length) return "N/A";
          return value
            .map((item) => formatActivityValue(item, keyName))
            .filter((item) => item && item !== "N/A")
            .join(", ");
        }
        if (typeof value === "object") {
          const namedValue =
            value?.name ||
            value?.label ||
            value?.title ||
            value?.value ||
            value?.email ||
            value?.phone ||
            value?.id;
          if (namedValue !== undefined && namedValue !== null && String(namedValue).trim()) {
            return String(namedValue).trim();
          }
          const entries = Object.entries(value)
            .filter(([, nested]) => nested !== null && nested !== undefined && nested !== "")
            .map(([nestedKey, nestedValue]) => `${toDisplayLabel(nestedKey)}: ${formatActivityValue(nestedValue, nestedKey)}`);
          return entries.length ? entries.join(" | ") : "N/A";
        }
        return String(value);
      };
      const oldMap = parseAuditPayload(oldValues);
      const newMap = parseAuditPayload(newValues);
      const changedKeys = Array.from(new Set([...Object.keys(oldMap), ...Object.keys(newMap)]));
      const hasChanges = changedKeys.length > 0;
      const changeItems = changedKeys.map((key) => {
        const fromValue = formatActivityValue(oldMap[key], key);
        const toValue = formatActivityValue(newMap[key], key);
        const label = toDisplayLabel(key);
        return {
          key,
          label,
          fromValue,
          toValue,
          summary: `${label} changed from ${fromValue} to ${toValue}`,
        };
      });

      return (
        <Stack spacing={1.6}>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            <Stack spacing={0.7}>
              <Typography variant="h6" fontWeight={700}>
                {toDisplayValue(rowObject?.action)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {toDisplayValue(rowObject?.description)}
              </Typography>
              <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`Category: ${toDisplayValue(rowObject?.action_category)}`} variant="outlined" />
                <Chip size="small" label={`Subtype: ${toDisplayValue(rowObject?.action_subtype)}`} variant="outlined" />
                <Chip size="small" label={`Status: ${toDisplayValue(rowObject?.status)}`} color={getStatusChipColor(rowObject?.status)} />
                <Chip
                  size="small"
                  label={rowObject?.is_successful ? "Result: Success" : "Result: Failed"}
                  color={rowObject?.is_successful ? "success" : "error"}
                  variant="outlined"
                />
              </Stack>
            </Stack>
          </Paper>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.2 }}>
            {[
              { label: "Date & Time", value: toDisplayValue(rowObject?.occurred_at, "occurred_at") },
              { label: "Organization", value: toDisplayValue(orgLabel) },
              { label: "Actor", value: toDisplayValue(actorLabel) },
              { label: "User", value: toDisplayValue(userLabel) },
              { label: "Target", value: toDisplayValue(targetLabel) },
              { label: "IP Address", value: toDisplayValue(ipAddress) },
            ].map((item) => (
              <Paper key={item.label} variant="outlined" sx={{ p: 1.3, borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  {item.label}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.3, fontWeight: 600, wordBreak: "break-word" }}>
                  {item.value}
                </Typography>
              </Paper>
            ))}
          </Box>

          <Paper variant="outlined" sx={{ p: 1.3, borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">
              User Agent
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.3, wordBreak: "break-word" }}>
              {toDisplayValue(userAgent)}
            </Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.3, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Changes
            </Typography>
            {!hasChanges ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                No field-level changes available for this activity.
              </Typography>
            ) : (
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 0.9, mt: 0.9 }}>
                {changeItems.map((item) => (
                  <Paper
                    key={item.key}
                    variant="outlined"
                    sx={{ p: 1.1, borderRadius: 1.6, backgroundColor: "#f8fafc", borderColor: "rgba(148,163,184,0.38)" }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {item.summary}
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={0.8} sx={{ mt: 0.55 }} alignItems={{ sm: "center" }}>
                      <Chip size="small" label={`From: ${item.fromValue}`} variant="outlined" />
                      <Chip size="small" label={`To: ${item.toValue}`} color="primary" variant="outlined" />
                    </Stack>
                  </Paper>
                ))}
              </Box>
            )}
          </Paper>
        </Stack>
      );
    }

    if (moduleConfig.endpoint === "/contact-us") {
      const requesterName = rowObject?.name || "Contact Request";
      const requesterEmail = rowObject?.email_address || rowObject?.email || "N/A";
      const requesterMobile = rowObject?.mobile_number || rowObject?.mobile || "N/A";
      const countryCode = rowObject?.country_code || "N/A";
      const totalUsers = rowObject?.total_users ?? "N/A";
      const requirementText =
        rowObject?.requirement_details ||
        rowObject?.message ||
        rowObject?.description ||
        "No requirement details provided.";
      const statusValue = rowObject?.status || "new";

      return (
        <Stack spacing={2}>
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 1.6, sm: 2 },
              borderRadius: 2.2,
              background: "linear-gradient(135deg, #f8fbff 0%, #eef6ff 100%)",
              borderColor: "#d7e6fb",
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Avatar sx={{ width: 56, height: 56, bgcolor: "#2563eb", color: "#fff", fontWeight: 700 }}>
                {String(requesterName)
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("") || "CR"}
              </Avatar>
              <Stack spacing={0.3} sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h6" fontWeight={800} noWrap>
                  {toDisplayValue(requesterName)}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {toDisplayValue(requesterEmail)}
                </Typography>
              </Stack>
              <Chip
                label={toDisplayValue(statusValue)}
                color={getStatusChipColor(statusValue)}
                variant="outlined"
                size="small"
              />
            </Stack>
          </Paper>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 1.4,
            }}
          >
            {[
              { label: "Mobile Number", value: `${toDisplayValue(countryCode)} ${toDisplayValue(requesterMobile)}` },
              { label: "Total Users", value: toDisplayValue(totalUsers) },
              { label: "Email Address", value: toDisplayValue(requesterEmail) },
              { label: "Contact Type", value: "Inbound Lead Request" },
            ].map((item) => (
              <Paper key={item.label} variant="outlined" sx={{ p: 1.5, borderRadius: 2, minHeight: 90 }}>
                <Stack spacing={0.6}>
                  <Typography variant="caption" color="text.secondary">
                    {item.label}
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, wordBreak: "break-word" }}>
                    {item.value}
                  </Typography>
                </Stack>
              </Paper>
            ))}
          </Box>

          <Paper
            variant="outlined"
            sx={{
              p: 1.6,
              borderRadius: 2,
              borderColor: "#dbeafe",
              backgroundColor: "#f8fbff",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Requirement Details
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {toDisplayValue(requirementText)}
            </Typography>
          </Paper>
        </Stack>
      );
    }

    const cleanEntries = Object.entries(rowObject || {}).filter(
      ([key]) => !String(key).startsWith("__") && !isIdField(key) && !isAuditField(key),
    );
    const statusValue = rowObject?.status || rowObject?.membership_status || rowObject?.payment_status || "N/A";
    const displayName =
      rowObject?.name ||
      rowObject?.plan_name ||
      rowObject?.role_name ||
      rowObject?.brand_name ||
      moduleConfig.title;
    const subtitle =
      rowObject?.email ||
      rowObject?.email_address ||
      rowObject?.owner_email ||
      rowObject?.plan_key ||
      rowObject?.role_key ||
      rowObject?.org_key ||
      "";

    return (
      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: "#cbd5e1", color: "#fff", fontWeight: 700 }}>
              {String(displayName || "")
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join("") || "N/A"}
            </Avatar>
            <Stack spacing={0.3} sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" fontWeight={700} noWrap>
                {toDisplayValue(displayName)}
              </Typography>
              {subtitle ? (
                <Typography variant="body2" color="text.secondary" noWrap>
                  {toDisplayValue(subtitle)}
                </Typography>
              ) : null}
            </Stack>
            <Chip
              label={toDisplayValue(statusValue)}
              color={String(statusValue).toLowerCase() === "active" ? "success" : "default"}
              variant="outlined"
              size="small"
            />
          </Stack>
        </Paper>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 1.25,
          }}
        >
          {cleanEntries.map(([key, value]) => (
            <Paper
              key={key}
              variant="outlined"
              sx={{
                p: 1.5,
                borderRadius: 2,
                gridColumn: ["description", "requirement_details", "addresses"].includes(String(key).toLowerCase())
                  ? { xs: "1 / -1", sm: "1 / -1" }
                  : "auto",
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {toDisplayLabel(key)}
              </Typography>
              {isStatusField(key) ? (
                <Box sx={{ mt: 0.5 }}>{renderStatusChip(value)}</Box>
              ) : (
                <Typography variant="body1" sx={{ mt: 0.35, wordBreak: "break-word" }}>
                  {toDisplayValue(value, key)}
                </Typography>
              )}
            </Paper>
          ))}
        </Box>
      </Stack>
    );
  };

  const renderFormFields = ({ formState, setFormState, readOnly = false, mode = "create" }) => (
    <Stack spacing={2}>
      {formFields.length > 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 1.5, sm: 2 },
            borderRadius: 2.5,
            backgroundColor: "#fff",
            borderColor: "rgba(148,163,184,0.35)",
          }}
        >
          <Stack spacing={2}>
            <Stack spacing={0.5}>
              <Typography sx={{ fontSize: 28, fontWeight: 700, color: "#1e293b", lineHeight: 1.2 }}>
                {mode === "edit" ? `Edit ${moduleConfig.title}` : `Add ${moduleConfig.title}`}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {mode === "edit"
                  ? `Update details for ${moduleConfig.title.toLowerCase()}.`
                  : `Fill details to create a new ${moduleConfig.title.toLowerCase()} entry.`}
              </Typography>
            </Stack>

            <Paper
              sx={{
                p: 1.25,
                borderRadius: 2,
                backgroundColor: "#e8f1fb",
                color: "#1e3a5f",
                border: "1px solid #d6e5f6",
              }}
              elevation={0}
            >
              <Typography variant="body2" fontWeight={600}>
                Please verify details before submitting.
              </Typography>
            </Paper>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: 1.5,
              }}
            >
              {formFields.map((field) => {
                const value = formState?.[field.name] ?? "";
                const isMulti = field.type === "multiline" || field.type === "multiline_array";
                const isJson = field.type === "json";
                const fieldPlaceholder =
                  field.placeholder ||
                  (field.type === "multiline_array"
                    ? `Enter ${field.label} (one per line)`
                    : `Enter ${field.label}`);
                const commonSx = {
                  gridColumn: isMulti || isJson ? "1 / -1" : "auto",
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 1.8,
                    backgroundColor: "#fff",
                    minHeight: isMulti || isJson ? "auto" : 56,
                  },
                  "& .MuiInputBase-input": { fontSize: 16, py: isMulti || isJson ? 1.25 : 1.7 },
                };

                if (field.type === "gateway_config") {
                  return (
                    <GatewayConfigEditor
                      key={field.name}
                      value={formState?.[field.name]}
                      onChange={(newVal) => setFormState((prev) => ({ ...prev, [field.name]: newVal }))}
                      readOnly={readOnly}
                    />
                  );
                }

                if (isJson) {
                  const isDisabledByModeJson = mode === "edit" && Boolean(field.readOnlyOnEdit);
                  return (
                    <TextField
                      key={field.name}
                      fullWidth
                      size="small"
                      label={field.label}
                      value={value}
                      multiline
                      minRows={6}
                      maxRows={20}
                      placeholder={fieldPlaceholder}
                      InputProps={{
                        readOnly: readOnly || isDisabledByModeJson,
                        sx: { fontFamily: "monospace", fontSize: 13 },
                      }}
                      helperText={field.helperText || ""}
                      onChange={(event) => {
                        if (readOnly || isDisabledByModeJson) return;
                        setFormState((prev) => ({ ...prev, [field.name]: event.target.value }));
                      }}
                      disabled={readOnly || isDisabledByModeJson}
                      sx={commonSx}
                    />
                  );
                }

                if (field.type === "select") {
                  const isFeatureCategoryField =
                    moduleConfig.endpoint === "/product-features" && field.name === "feature_category_id";
                  const isGeoStateCountryField =
                    moduleConfig.endpoint === "/geo/states" && field.name === "country_id";
                  const isPlanField =
                    moduleConfig.endpoint === "/plan-features" && field.name === "plan_id";
                  const selectOptions = isFeatureCategoryField
                    ? featureCategoryOptions
                    : isGeoStateCountryField
                      ? countryOptions
                      : isPlanField
                        ? planOptions
                        : (field.options || []);
                  const isSelectLoading =
                    (isFeatureCategoryField && featureCategoryLoading) ||
                    (isGeoStateCountryField && countryOptionsLoading) ||
                    (isPlanField && planOptionsLoading);
                  const isDisabledByMode = mode === "edit" && Boolean(field.readOnlyOnEdit);
                  return (
                    <TextField
                      key={field.name}
                      select
                      fullWidth
                      size="small"
                      label={field.label}
                      value={value}
                      onChange={(event) => {
                        if (readOnly || isDisabledByMode) return;
                        setFormState((prev) => ({ ...prev, [field.name]: event.target.value }));
                      }}
                      InputProps={{ readOnly }}
                      helperText={
                        isFeatureCategoryField && featureCategoryLoading
                          ? "Loading categories..."
                          : isGeoStateCountryField && countryOptionsLoading
                            ? "Loading countries..."
                            : isPlanField && planOptionsLoading
                              ? "Loading plans..."
                              : (field.helperText || "")
                      }
                      disabled={readOnly || isDisabledByMode || isSelectLoading}
                      sx={commonSx}
                    >
                      <MenuItem value="">Select {field.label}</MenuItem>
                      {selectOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  );
                }

                const isDisabledByMode = mode === "edit" && Boolean(field.readOnlyOnEdit);
                return (
                  <TextField
                    key={field.name}
                    fullWidth
                    size="small"
                    type={field.type === "number" ? "number" : "text"}
                    label={field.label}
                    value={value}
                    multiline={isMulti}
                    minRows={isMulti ? 3 : undefined}
                    placeholder={fieldPlaceholder}
                    InputProps={{ readOnly: readOnly || isDisabledByMode }}
                    helperText={field.helperText || ""}
                    onChange={(event) => {
                      if (readOnly || isDisabledByMode) return;
                      setFormState((prev) => ({ ...prev, [field.name]: event.target.value }));
                    }}
                    disabled={readOnly || isDisabledByMode}
                    sx={commonSx}
                  />
                );
              })}
            </Box>
          </Stack>
        </Paper>
      ) : null}

      {!formFields.length ? (
        readOnly
          ? renderReadOnlyObject(selectedRow || {})
          : <Alert severity="info">No form fields configured for {moduleConfig.title}.</Alert>
      ) : null}
    </Stack>
  );

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={1.5}
        >
          <Typography variant="h6" fontWeight={800}>
            {moduleConfig.title}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: { xs: "100%", md: "auto" } }}>
            {canCreate ? (
              <Button
                variant="contained"
                fullWidth={isSmall}
                onClick={() => {
                  setCreateForm(toFormStateFromRow(moduleConfig, null));
                  setOpenCreate(true);
                }}
                disabled={saving}
              >
                Add
              </Button>
            ) : null}
            <Button variant="outlined" fullWidth={isSmall} onClick={fetchRows} disabled={loading || saving}>
              Refresh
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          {moduleConfig.endpoint === "/plan-features" ? (
            <TextField
              select
              size="small"
              label="Filter by Plan"
              value={filterPlanId}
              onChange={(event) => {
                setFilterPlanId(event.target.value);
                setOffset(0);
              }}
              disabled={planOptionsLoading}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">All Plans</MenuItem>
              {planOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
          <TextField
            fullWidth
            size="small"
            label={`Search ${moduleConfig.title}`}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setOffset(0);
                setSearch(searchInput.trim());
              }
            }}
          />
          <Button
            variant="contained"
            fullWidth={isSmall}
            onClick={() => {
              setOffset(0);
              setSearch(searchInput.trim());
            }}
          >
            Search
          </Button>
          <Button
            variant="outlined"
            fullWidth={isSmall}
            onClick={() => {
              setSearchInput("");
              setSearch("");
              setFilterPlanId("");
              setOffset(0);
            }}
          >
            Reset
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
            <CircularProgress size={28} />
          </Stack>
        ) : (
          <>
            <Box sx={{ height: { xs: 420, md: 520 } }}>
              <DataGrid
                rows={gridRows}
                columns={gridColumns}
                getRowId={(row) => row.__rowKey}
                disableRowSelectionOnClick
                columnVisibilityModel={resourceColumnVisibilityModel}
                pageSizeOptions={[RESOURCE_PAGE_SIZE]}
                hideFooter
                sx={{
                  "& .MuiDataGrid-cell": {
                    fontSize: { xs: 12, md: 13 },
                    display: "flex",
                    alignItems: "center",
                  },
                  "& .MuiDataGrid-columnHeaderTitle": { fontSize: { xs: 12, md: 13 }, fontWeight: 700 },
                  ...(isContactRequests
                    ? {
                        "& .MuiDataGrid-columnHeaders": {
                          backgroundColor: "#f8fafc",
                          borderBottom: "1px solid rgba(148,163,184,0.28)",
                        },
                        "& .MuiDataGrid-row:hover": {
                          backgroundColor: "rgba(59,130,246,0.05)",
                        },
                      }
                    : {}),
                }}
              />
            </Box>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", sm: "center" }}
              spacing={1}
              sx={{ p: 1.5, borderTop: "1px solid", borderColor: "divider" }}
            >
              <Typography variant="caption" color="text.secondary">
                Showing {rows.length ? offset + 1 : 0} - {Math.min(offset + rows.length, totalCount)} of {totalCount}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth={isSmall}
                  onClick={() => setOffset((prev) => Math.max(prev - RESOURCE_PAGE_SIZE, 0))}
                  disabled={offset === 0}
                >
                  Previous
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth={isSmall}
                  onClick={() => {
                    if (offset + RESOURCE_PAGE_SIZE >= totalCount) return;
                    setOffset((prev) => prev + RESOURCE_PAGE_SIZE);
                  }}
                  disabled={offset + RESOURCE_PAGE_SIZE >= totalCount}
                >
                  Next
                </Button>
              </Stack>
            </Stack>
          </>
        )}
      </Paper>

      {isUsersModule ? (
        <>
          <Dialog
            open={userProfileDialogOpen}
            onClose={() => setUserProfileDialogOpen(false)}
            maxWidth={false}
            fullWidth
            sx={modalDialogSx}
            PaperProps={{ sx: modalPaperSx }}
          >
            <DialogTitle>
              {renderDialogHeading(
                "User Complete Details",
                userInsightUser?.email
                  ? `${toCellText(userInsightUser.name)} (${toCellText(userInsightUser.email)})`
                  : "",
              )}
            </DialogTitle>
            <DialogContent dividers>
              {userInsightError ? <Alert severity="error" sx={{ mb: 1.2 }}>{userInsightError}</Alert> : null}
              {userInsightLoading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ py: 5 }}>
                  <CircularProgress size={24} />
                </Stack>
              ) : (
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
                    <Paper variant="outlined" sx={{ p: 1.25, flex: 1 }}>
                      <Typography variant="caption" color="text.secondary">User</Typography>
                      <Typography variant="h6" sx={{ lineHeight: 1.2 }}>{toCellText(userInsightUser?.name)}</Typography>
                      <Typography variant="body2" color="text.secondary">{toCellText(userInsightUser?.email)}</Typography>
                      <Stack direction="row" spacing={0.8} sx={{ mt: 1 }} flexWrap="wrap">
                        {renderStatusChip(userInsightUser?.status)}
                        <Chip size="small" label={`User ID: ${toCellText(userInsightUser?.user_id)}`} variant="outlined" />
                      </Stack>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1.25, flex: 1 }}>
                      <Typography variant="caption" color="text.secondary">Organization</Typography>
                      <Typography variant="h6" sx={{ lineHeight: 1.2 }}>{toCellText(userInsightOrganization?.name)}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {toCellText(userInsightOrganization?.org_key)} | {toCellText(userInsightOrganization?.subdomain)}
                      </Typography>
                      <Stack direction="row" spacing={0.8} sx={{ mt: 1 }} flexWrap="wrap">
                        {renderStatusChip(userInsightOrganization?.status)}
                        <Chip size="small" label={`Org ID: ${toCellText(userInsightOrganization?.organization_id)}`} variant="outlined" />
                      </Stack>
                    </Paper>
                  </Stack>

                  <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
                    <Paper variant="outlined" sx={{ p: 1.25, flex: 1 }}>
                      <Typography variant="caption" color="text.secondary">Membership</Typography>
                      <Typography variant="body2">Role: {toCellText(userInsightMembership?.role_name || userInsightMembership?.role_key)}</Typography>
                      <Typography variant="body2">Role ID: {toCellText(userInsightMembership?.role_id)}</Typography>
                      <Typography variant="body2">Joined: {toDisplayValue(userInsightMembership?.joined_at, "joined_at")}</Typography>
                      <Stack direction="row" spacing={0.8} sx={{ mt: 1 }} flexWrap="wrap">
                        {renderStatusChip(userInsightMembership?.membership_status)}
                        <Chip size="small" label={`Membership ID: ${toCellText(userInsightMembership?.membership_id)}`} variant="outlined" />
                      </Stack>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1.25, flex: 1 }}>
                      <Typography variant="caption" color="text.secondary">Security & Activity</Typography>
                      <Typography variant="body2">Mobile: {toCellText(userInsightUser?.mobile)}</Typography>
                      <Typography variant="body2">Email Verified: {toDisplayValue(userInsightUser?.email_verified_at, "email_verified_at")}</Typography>
                      <Typography variant="body2">Last Login: {toDisplayValue(userInsightUser?.last_login_at, "last_login_at")}</Typography>
                      <Stack direction="row" spacing={0.8} sx={{ mt: 1 }} flexWrap="wrap">
                        <Chip size="small" label={`Devices: ${userDevicesRows.length}`} color="primary" variant="outlined" />
                        <Chip size="small" label={`Sessions: ${userSessionsRows.length}`} color="secondary" variant="outlined" />
                      </Stack>
                    </Paper>
                  </Stack>
                </Stack>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setUserProfileDialogOpen(false)}>Close</Button>
            </DialogActions>
          </Dialog>

          <Dialog
            open={userDevicesDialogOpen}
            onClose={() => setUserDevicesDialogOpen(false)}
            maxWidth={false}
            fullWidth
            sx={modalDialogSx}
            PaperProps={{ sx: modalPaperSx }}
          >
            <DialogTitle>
              {renderDialogHeading(
                "User Devices",
                userInsightUser?.email
                  ? `${toCellText(userInsightUser.name)} (${toCellText(userInsightUser.email)})${
                      userInsightOrganization?.name ? ` | ${toCellText(userInsightOrganization.name)}` : ""
                    }`
                  : "",
              )}
            </DialogTitle>
            <DialogContent dividers>
              {userInsightError ? <Alert severity="error" sx={{ mb: 1.2 }}>{userInsightError}</Alert> : null}
              {userInsightLoading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ py: 5 }}>
                  <CircularProgress size={24} />
                </Stack>
              ) : (
                <Box sx={{ height: { xs: 360, md: 460 } }}>
                  <DataGrid
                    rows={userDevicesRows.map((row, index) => ({ ...row, __rowKey: row?.device_id || `device-${index}` }))}
                    columns={[
                      {
                        field: "device_id",
                        headerName: "Device ID",
                        minWidth: 100,
                        maxWidth: 120,
                        renderCell: (params) => toCellText(params.value),
                      },
                      {
                        field: "device_name",
                        headerName: "Device",
                        minWidth: 250,
                        flex: 1.2,
                        renderCell: (params) => (
                          <Typography variant="body2" noWrap title={toCellText(params.value)}>
                            {toCellText(params.value)}
                          </Typography>
                        ),
                      },
                      {
                        field: "hostname",
                        headerName: "Host",
                        minWidth: 170,
                        flex: 0.9,
                        renderCell: (params) => (
                          <Typography variant="body2" noWrap title={toCellText(params.value)}>
                            {toCellText(params.value)}
                          </Typography>
                        ),
                      },
                      { field: "device_type", headerName: "Type", minWidth: 110, flex: 0.7 },
                      { field: "os_name", headerName: "OS", minWidth: 120, flex: 0.7, renderCell: (params) => toCellText(params.value).toUpperCase() },
                      { field: "ip_address", headerName: "IP Address", minWidth: 130, flex: 0.8 },
                      {
                        field: "__location",
                        headerName: "Location",
                        minWidth: 220,
                        flex: 1,
                        sortable: false,
                        valueGetter: (_value, row) => {
                          const city = toCellText(row?.city);
                          const country = toCellText(row?.country);
                          if (city !== "-" && country !== "-") return `${city}, ${country}`;
                          return city !== "-" ? city : country;
                        },
                        renderCell: (params) => (
                          <Typography variant="body2" noWrap title={toCellText(params.value)}>
                            {toCellText(params.value)}
                          </Typography>
                        ),
                      },
                      {
                        field: "__coordinates",
                        headerName: "Coordinates",
                        minWidth: 180,
                        flex: 0.9,
                        sortable: false,
                        valueGetter: (_value, row) => {
                          const lat = row?.latitude;
                          const lng = row?.longitude;
                          if (lat == null || lng == null || String(lat) === "" || String(lng) === "") return "-";
                          return `${lat}, ${lng}`;
                        },
                        renderCell: (params) => (
                          <Typography variant="body2" noWrap title={toCellText(params.value)}>
                            {toCellText(params.value)}
                          </Typography>
                        ),
                      },
                      {
                        field: "is_trusted",
                        headerName: "Trusted",
                        minWidth: 120,
                        flex: 0.7,
                        renderCell: (params) =>
                          params.value ? (
                            <Chip size="small" label="Trusted" color="success" variant="outlined" />
                          ) : (
                            <Chip size="small" label="Untrusted" color="warning" variant="outlined" />
                          ),
                      },
                      { field: "status", headerName: "Status", minWidth: 120, flex: 0.7, renderCell: (params) => renderStatusChip(params.value) },
                      {
                        field: "last_active_at",
                        headerName: "Last Active",
                        minWidth: 180,
                        flex: 0.9,
                        renderCell: (params) => toDisplayValue(params.value, "last_active_at"),
                      },
                      {
                        field: "created_at",
                        headerName: "Created",
                        minWidth: 180,
                        flex: 0.9,
                        renderCell: (params) => toDisplayValue(params.value, "created_at"),
                      },
                      {
                        field: "updated_at",
                        headerName: "Updated",
                        minWidth: 180,
                        flex: 0.9,
                        renderCell: (params) => toDisplayValue(params.value, "updated_at"),
                      },
                      {
                        field: "user_agent",
                        headerName: "User Agent",
                        minWidth: 360,
                        flex: 1.8,
                        renderCell: (params) => (
                          <Typography variant="body2" noWrap title={toCellText(params.value)}>
                            {toCellText(params.value)}
                          </Typography>
                        ),
                      },
                    ]}
                    getRowId={(row) => row.__rowKey}
                    disableRowSelectionOnClick
                    hideFooter
                  />
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setUserDevicesDialogOpen(false)}>Close</Button>
            </DialogActions>
          </Dialog>

          <Dialog
            open={userSessionsDialogOpen}
            onClose={() => setUserSessionsDialogOpen(false)}
            maxWidth={false}
            fullWidth
            sx={modalDialogSx}
            PaperProps={{ sx: modalPaperSx }}
          >
            <DialogTitle>
              {renderDialogHeading(
                "User Sessions",
                userInsightUser?.email
                  ? `${toCellText(userInsightUser.name)} (${toCellText(userInsightUser.email)})${
                      userInsightOrganization?.name ? ` | ${toCellText(userInsightOrganization.name)}` : ""
                    }`
                  : "",
              )}
            </DialogTitle>
            <DialogContent dividers>
              {userInsightError ? <Alert severity="error" sx={{ mb: 1.2 }}>{userInsightError}</Alert> : null}
              {userInsightLoading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ py: 5 }}>
                  <CircularProgress size={24} />
                </Stack>
              ) : (
                <Box sx={{ height: { xs: 360, md: 460 } }}>
                  <DataGrid
                    rows={userSessionsRows.map((row, index) => ({
                      ...row,
                      __srNo: index + 1,
                      __rowKey: row?.session_id || `session-${index}`,
                    }))}
                    columns={[
                      { field: "__srNo", headerName: "Sr.", minWidth: 80, maxWidth: 90, sortable: false, filterable: false },
                      { field: "session_id", headerName: "Session ID", minWidth: 220, flex: 1.2 },
                      {
                        field: "__deviceDetails",
                        headerName: "Device Details",
                        minWidth: 300,
                        flex: 1.4,
                        sortable: false,
                        valueGetter: (_value, row) => {
                          const sessionDeviceId = String(row?.device_id ?? "").trim();
                          if (!sessionDeviceId) return "-";
                          const matchedDevice = userDevicesRows.find(
                            (deviceRow) => String(deviceRow?.device_id ?? "").trim() === sessionDeviceId,
                          );
                          if (!matchedDevice) return `Device #${sessionDeviceId}`;
                          const name = toCellText(matchedDevice?.device_name);
                          const host = toCellText(matchedDevice?.hostname);
                          const os = toCellText(matchedDevice?.os_name).toUpperCase();
                          return `${name} | ${host} | ${os}`;
                        },
                        renderCell: (params) => (
                          <Typography variant="body2" noWrap title={toCellText(params.value)}>
                            {toCellText(params.value)}
                          </Typography>
                        ),
                      },
                      { field: "ip_address", headerName: "IP Address", minWidth: 160, flex: 1 },
                      { field: "last_used_at", headerName: "Last Used", minWidth: 180, flex: 1, renderCell: (params) => toDisplayValue(params.value, "last_used_at") },
                      { field: "status", headerName: "Status", minWidth: 120, flex: 0.8, renderCell: (params) => renderStatusChip(params.value) },
                    ]}
                    getRowId={(row) => row.__rowKey}
                    disableRowSelectionOnClick
                    hideFooter
                  />
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setUserSessionsDialogOpen(false)}>Close</Button>
            </DialogActions>
          </Dialog>
        </>
      ) : null}

      <Dialog
        open={openCreate}
        onClose={() => !saving && setOpenCreate(false)}
        maxWidth={false}
        fullWidth
        sx={modalDialogSx}
        PaperProps={{ sx: modalPaperSx }}
      >
        <DialogTitle sx={{ pb: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>{renderDialogHeading(`Create ${moduleConfig.title}`)}</DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 1.5, sm: 2 } }}>
          {renderFormFields({
            formState: createForm,
            setFormState: setCreateForm,
            readOnly: false,
            mode: "create",
          })}
        </DialogContent>
        <DialogActions sx={{ px: { xs: 1.5, sm: 2 }, pb: 2 }}>
          <Button onClick={() => setOpenCreate(false)} disabled={saving} variant="outlined">
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving} sx={{ minWidth: 120 }}>
            {saving ? "Saving..." : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openEdit}
        onClose={() => !saving && setOpenEdit(false)}
        maxWidth={false}
        fullWidth
        sx={modalDialogSx}
        PaperProps={{ sx: modalPaperSx }}
      >
        <DialogTitle sx={{ pb: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>{renderDialogHeading(`Edit ${moduleConfig.title}`)}</DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 1.5, sm: 2 } }}>
          {renderFormFields({
            formState: editForm,
            setFormState: setEditForm,
            readOnly: false,
            mode: "edit",
          })}
        </DialogContent>
        <DialogActions sx={{ px: { xs: 1.5, sm: 2 }, pb: 2 }}>
          <Button onClick={() => setOpenEdit(false)} disabled={saving} variant="outlined">
            Cancel
          </Button>
          <Button variant="contained" onClick={handleEdit} disabled={saving} sx={{ minWidth: 120 }}>
            {saving ? "Saving..." : "Update"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openView}
        onClose={() => setOpenView(false)}
        maxWidth={false}
        fullWidth
        sx={modalDialogSx}
        PaperProps={{ sx: modalPaperSx }}
      >
        <DialogTitle>{renderDialogHeading(`View ${moduleConfig.title}`)}</DialogTitle>
        <DialogContent dividers>
          {formFields.length
            ? renderPrettyView(selectedRow || {})
            : renderReadOnlyObject(selectedRow || {})}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenView(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

// ─── SMTP Settings Panel ──────────────────────────────────────────────────────
const SMTP_EMPTY_FORM = {
  label: "",
  host: "",
  port: "587",
  secure: "false",
  smtp_user: "",
  smtp_pass: "",
  from_address: "",
  contact_notify_to: "",
  status: "inactive",
};

const SmtpFormDialog = ({ open, onClose, onSaved, editRow, isDark, cardBg, cardBorder }) => {
  const [form, setForm] = useState(SMTP_EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editRow) {
      setForm({
        label: editRow.label || "",
        host: editRow.host || "",
        port: String(editRow.port || "587"),
        secure: String(editRow.secure ?? "false"),
        smtp_user: editRow.smtp_user || "",
        smtp_pass: editRow.smtp_pass || "",
        from_address: editRow.from_address || "",
        contact_notify_to: editRow.contact_notify_to || "",
        status: String(editRow.status || "inactive"),
      });
    } else {
      setForm(SMTP_EMPTY_FORM);
    }
    setError("");
  }, [open, editRow]);

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async () => {
    if (!form.host.trim()) { setError("SMTP Host is required"); return; }
    if (!form.smtp_user.trim()) { setError("SMTP Username is required"); return; }
    setSaving(true);
    setError("");
    try {
      const body = {
        ...form,
        port: Number(form.port) || 587,
        secure: form.secure === "true",
      };
      // Don't send masked password back
      if (body.smtp_pass === "********") delete body.smtp_pass;

      const url = editRow
        ? `${API_BASE_URL}/smtp-settings/${editRow.smtp_settings_id}`
        : `${API_BASE_URL}/smtp-settings`;
      const method = editRow ? "PATCH" : "POST";

      const { response, payload } = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) { setError(payload?.message || "Failed to save"); return; }
      const saved = payload?.data || null;
      const wantsActive = String(form.status || "").toLowerCase() === "active";
      const savedId = saved?.smtp_settings_id || editRow?.smtp_settings_id;
      if (wantsActive && savedId) {
        const activateResult = await fetchWithAuth(`${API_BASE_URL}/smtp-settings/${savedId}/activate`, { method: "POST" });
        if (!activateResult.response.ok) {
          setError(activateResult.payload?.message || "Saved, but failed to activate");
          return;
        }
        onSaved(activateResult.payload?.data || saved);
        return;
      }
      onSaved(saved);
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { name: "label", label: "Config Label", placeholder: "e.g. Primary, Transactional", span: 2 },
    { name: "host", label: "SMTP Host", placeholder: "smtp.example.com", required: true },
    { name: "port", label: "SMTP Port", type: "number", placeholder: "587", required: true },
    { name: "secure", label: "Secure (SSL/TLS)", type: "select", options: [{ label: "No (STARTTLS / port 587)", value: "false" }, { label: "Yes (SSL / port 465)", value: "true" }] },
    { name: "smtp_user", label: "SMTP Username", placeholder: "user@example.com", required: true },
    { name: "smtp_pass", label: "SMTP Password", type: "password", placeholder: editRow ? "Leave blank to keep existing" : "Enter password" },
    { name: "from_address", label: "From Address", placeholder: "no-reply@example.com" },
    { name: "contact_notify_to", label: "Contact Notify Emails (comma-separated)", placeholder: "admin@example.com, support@example.com", span: 2 },
    {
      name: "status",
      label: "Status",
      type: "select",
      helperText: "Activating here will switch the active config.",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ],
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { width: "min(640px, calc(100vw - 32px))", m: 0, background: cardBg, border: "1px solid", borderColor: cardBorder } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>{editRow ? "Edit SMTP Config" : "Add SMTP Config"}</DialogTitle>
      <DialogContent dividers>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "1fr 1fr", pt: 0.5 }}>
          {fields.map((field) => {
            const sx = field.span === 2 ? { gridColumn: "span 2" } : {};
            if (field.type === "select") {
              return (
                <TextField
                  key={field.name}
                  select
                  label={field.label}
                  value={form[field.name] ?? ""}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  size="small"
                  fullWidth
                  helperText={field.helperText}
                  disabled={Boolean(field.disabled)}
                  sx={sx}
                >
                  {field.options.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                </TextField>
              );
            }
            return (
              <TextField
                key={field.name}
                label={field.label}
                type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
                value={form[field.name] ?? ""}
                onChange={(e) => handleChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                required={field.required}
                size="small"
                fullWidth
                sx={sx}
              />
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving}>
          {saving ? "Saving..." : editRow ? "Update" : "Add Config"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const SmtpSettingsPanel = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const cardBg = isDark ? "rgba(15,23,42,0.82)" : "#ffffff";
  const cardBorder = isDark ? "rgba(71,85,105,0.45)" : "rgba(148,163,184,0.3)";
  const textSecondary = isDark ? "rgba(191,219,254,0.7)" : "#64748b";

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [listError, setListError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const [activating, setActivating] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const loadAll = useCallback(() => {
    setLoading(true);
    setListError("");
    fetchWithAuth(`${API_BASE_URL}/smtp-settings`)
      .then(({ response, payload }) => {
        if (!response.ok) { setListError(payload?.message || "Failed to load"); return; }
        setRows(Array.isArray(payload?.data) ? payload.data : []);
      })
      .catch((err) => setListError(err.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSaved = (data) => {
    setDialogOpen(false);
    setEditRow(null);
    setActionSuccess(editRow ? "Config updated." : "Config added.");
    setActionError("");
    loadAll();
  };

  const handleActivate = async (id) => {
    setActivating(id);
    setActionError("");
    setActionSuccess("");
    try {
      const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/smtp-settings/${id}/activate`, { method: "POST" });
      if (!response.ok) { setActionError(payload?.message || "Failed to activate"); return; }
      setRows(Array.isArray(payload?.data) ? payload.data : []);
      setActionSuccess("Config set as Active.");
    } catch (err) {
      setActionError(err.message || "Failed to activate");
    } finally {
      setActivating(null);
    }
  };

  const handleDeleteConfirm = async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setDeleting(id);
    setActionError("");
    setActionSuccess("");
    try {
      const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/smtp-settings/${id}`, { method: "DELETE" });
      if (!response.ok) { setActionError(payload?.message || "Failed to delete"); return; }
      setRows((prev) => prev.filter((r) => r.smtp_settings_id !== id));
      setActionSuccess("Config deleted.");
    } catch (err) {
      setActionError(err.message || "Failed to delete");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2.2, borderRadius: 2, background: cardBg, border: "1px solid", borderColor: cardBorder }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1.5} sx={{ mb: 2 }}>
          <Stack spacing={0.4}>
            <Typography variant="h6" fontWeight={800}>SMTP Settings</Typography>
            <Typography variant="body2" sx={{ color: textSecondary }}>
              Multiple configs supported. The <strong>Active</strong> one is used for all outgoing emails.
            </Typography>
          </Stack>
          <Button variant="contained" size="small" onClick={() => { setEditRow(null); setDialogOpen(true); }}>
            + Add SMTP Config
          </Button>
        </Stack>

        {actionError ? <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setActionError("")}>{actionError}</Alert> : null}
        {actionSuccess ? <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setActionSuccess("")}>{actionSuccess}</Alert> : null}
        {listError ? <Alert severity="error" sx={{ mb: 1.5 }}>{listError}</Alert> : null}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
        ) : rows.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography variant="body2" sx={{ color: textSecondary }}>No SMTP configs yet. Click "+ Add SMTP Config" to get started.</Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, borderColor: cardBorder, background: "transparent" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ background: isDark ? "rgba(30,41,59,0.6)" : "rgba(241,245,249,0.8)" }}>
                  {["Label", "Host : Port", "Security", "Username", "From Address", "Notify To", "Status", "Actions"].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12, color: textSecondary, whiteSpace: "nowrap" }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const isActive = row.status === "active";
                  return (
                    <TableRow
                      key={row.smtp_settings_id}
                      sx={{
                        background: isActive
                          ? (isDark ? "rgba(21,128,61,0.10)" : "rgba(240,253,244,0.7)")
                          : "transparent",
                        "&:last-child td": { border: 0 },
                      }}
                    >
                      <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>{row.label || "Unnamed Config"}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{row.host}:{row.port}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{row.secure ? "SSL" : "STARTTLS"}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{row.smtp_user || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{row.from_address || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{row.contact_notify_to || "—"}</TableCell>
                      <TableCell>
                        <Chip
                          label={isActive ? "Active" : "Inactive"}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: 11,
                            fontWeight: 700,
                            bgcolor: isActive
                              ? (isDark ? "rgba(34,197,94,0.22)" : "rgba(220,252,231,1)")
                              : (isDark ? "rgba(100,116,139,0.22)" : "rgba(241,245,249,1)"),
                            color: isActive
                              ? (isDark ? "#4ade80" : "#15803d")
                              : (isDark ? "#94a3b8" : "#64748b"),
                            border: "1px solid",
                            borderColor: isActive
                              ? (isDark ? "rgba(74,222,128,0.4)" : "rgba(134,239,172,0.6)")
                              : (isDark ? "rgba(100,116,139,0.3)" : "rgba(203,213,225,0.8)"),
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          {!isActive ? (
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              disabled={activating === row.smtp_settings_id}
                              onClick={() => handleActivate(row.smtp_settings_id)}
                              sx={{ textTransform: "none", minWidth: 72, fontSize: 12 }}
                            >
                              {activating === row.smtp_settings_id ? "..." : "Set Active"}
                            </Button>
                          ) : null}
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => { setEditRow(row); setDialogOpen(true); }}
                            sx={{ textTransform: "none", fontSize: 12 }}
                          >
                            Edit
                          </Button>
                          {!isActive ? (
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              disabled={deleting === row.smtp_settings_id}
                              onClick={() => setConfirmDeleteId(row.smtp_settings_id)}
                              sx={{ textTransform: "none", fontSize: 12 }}
                            >
                              {deleting === row.smtp_settings_id ? "..." : "Delete"}
                            </Button>
                          ) : null}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <SmtpFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditRow(null); }}
        onSaved={handleSaved}
        editRow={editRow}
        isDark={isDark}
        cardBg={cardBg}
        cardBorder={cardBorder}
      />

      {/* Delete confirmation */}
      <Dialog open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} PaperProps={{ sx: { background: cardBg, border: "1px solid", borderColor: cardBorder } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete SMTP Config?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">This action cannot be undone. The active config cannot be deleted.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

const OwnerDashboard = () => {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("organizations");
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgError, setOrgError] = useState("");
  const [orgRows, setOrgRows] = useState([]);
  const [orgCount, setOrgCount] = useState(0);
  const [orgOffset, setOrgOffset] = useState(0);
  const [orgSearchInput, setOrgSearchInput] = useState("");
  const [orgSearch, setOrgSearch] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState(0);
  const [selectedOrgName, setSelectedOrgName] = useState("");

  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");
  const [membersRows, setMembersRows] = useState([]);
  const [membersCount, setMembersCount] = useState(0);
  const [membersSearchInput, setMembersSearchInput] = useState("");
  const [membersSearch, setMembersSearch] = useState("");
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [memberViewOpen, setMemberViewOpen] = useState(false);
  const [memberViewRow, setMemberViewRow] = useState(null);
  const [memberEditOpen, setMemberEditOpen] = useState(false);
  const [memberEditSaving, setMemberEditSaving] = useState(false);
  const [memberEditError, setMemberEditError] = useState("");
  const [memberEditRow, setMemberEditRow] = useState(null);
  const [memberEditForm, setMemberEditForm] = useState({ role_id: "", membership_status: "active" });
  const [roleOptions, setRoleOptions] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState("");

  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState("");
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [selectedOrgDetails, setSelectedOrgDetails] = useState(null);

  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState("");
  const [paymentsRows, setPaymentsRows] = useState([]);
  const [paymentsCount, setPaymentsCount] = useState(0);
  const [paymentsOffset, setPaymentsOffset] = useState(0);
  const [paymentsSearchInput, setPaymentsSearchInput] = useState("");
  const [paymentsSearch, setPaymentsSearch] = useState("");
  const [paymentsGatewayFilter, setPaymentsGatewayFilter] = useState("all");
  const [paymentViewOpen, setPaymentViewOpen] = useState(false);
  const [selectedPaymentRow, setSelectedPaymentRow] = useState(null);
  const [ownerPayOpen, setOwnerPayOpen] = useState(false);
  const [ownerPaySaving, setOwnerPaySaving] = useState(false);
  const [ownerPayError, setOwnerPayError] = useState("");
  const [ownerPaySuccess, setOwnerPaySuccess] = useState("");
  const [ownerPayRow, setOwnerPayRow] = useState(null);
  const [ownerPayPlanOptions, setOwnerPayPlanOptions] = useState([]);
  const [ownerPayPlansLoading, setOwnerPayPlansLoading] = useState(false);
  const [ownerPayForm, setOwnerPayForm] = useState({
    gateway: "stripe",
    plan_id: "",
    amount: "",
    user_count: "",
    transaction_id: "",
    note: "",
  });
  const [ownerSettingsOpen, setOwnerSettingsOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [createOwnerOpen, setCreateOwnerOpen] = useState(false);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [createOwnerSaving, setCreateOwnerSaving] = useState(false);
  const [createOwnerError, setCreateOwnerError] = useState("");
  const [createOwnerSuccess, setCreateOwnerSuccess] = useState("");
  const [siteBrandName, setSiteBrandName] = useState("");
  const [createOwnerForm, setCreateOwnerForm] = useState({
    company_name: "",
    owner_name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [ownerThemeMode, setOwnerThemeMode] = useState(() => {
    if (typeof window === "undefined") return "light";
    const stored = String(window.localStorage.getItem(OWNER_THEME_STORAGE_KEY) || "").toLowerCase();
    return stored === "dark" ? "dark" : "light";
  });
  const [ownerDialogSize, setOwnerDialogSize] = useState(() => {
    if (typeof window === "undefined") return "medium";
    const stored = window.localStorage.getItem(OWNER_DIALOG_SIZE_STORAGE_KEY);
    return normalizeDialogSize(stored);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(OWNER_THEME_STORAGE_KEY, ownerThemeMode);
  }, [ownerThemeMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(OWNER_DIALOG_SIZE_STORAGE_KEY, ownerDialogSize);
  }, [ownerDialogSize]);

  const ownerDialogPaperSx = useMemo(() => getDialogPaperSx(ownerDialogSize), [ownerDialogSize]);
  const renderOwnerDialogHeading = (title, subtitle = "") => (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      alignItems={{ xs: "flex-start", sm: "center" }}
      justifyContent="space-between"
      spacing={1}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="h6" sx={{ fontSize: { xs: 18, sm: 20 } }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Stack>
      <DialogSizeSelector value={ownerDialogSize} onChange={setOwnerDialogSize} />
    </Stack>
  );

  const fetchSiteBrandName = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("limit", "1");
      params.set("offset", "0");
      const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/site-details?${params.toString()}`, {
        method: "GET",
      });
      if (response.status === 304) return;
      if (!response.ok || payload?.status === "error") return;
      const rows = Array.isArray(payload?.data?.rows)
        ? payload.data.rows
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      const brandName = String(rows?.[0]?.brand_name || "").trim();
      if (brandName) setSiteBrandName(brandName);
    } catch {
      // Ignore sidebar brand load failure and use fallback title.
    }
  }, []);

  useEffect(() => {
    fetchSiteBrandName();
  }, [fetchSiteBrandName]);

  const ownerUi = useMemo(() => {
    const dark = ownerThemeMode === "dark";
    const primaryMain = theme.palette.primary.main;
    const primaryLight = theme.palette.primary.light || theme.palette.primary.main;
    return {
      isDark: dark,
      pageBg: dark
        ? "linear-gradient(180deg, #0b1220 0%, #0f172a 100%)"
        : "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
      panelBg: dark ? "#111827" : "#ffffff",
      panelBorder: dark ? "rgba(51,65,85,0.75)" : "rgba(15,23,42,0.08)",
      surfaceSoft: dark ? "#0f1a30" : "#ffffff",
      surfaceSoftBorder: dark ? "rgba(71,85,105,0.45)" : "rgba(15,23,42,0.08)",
      textPrimary: dark ? "#e6edf8" : "#13213a",
      textSecondary: dark ? "#a6b7d4" : "#55657f",
      brandA: primaryMain,
      brandB: primaryLight,
      accentSoft: alpha(primaryMain, dark ? 0.28 : 0.14),
      accentText: dark ? alpha(primaryLight, 0.95) : primaryMain,
      successBtn: dark ? "#22c55e" : "#16a34a",
      addOwnerText: dark ? "#052e16" : "#f0fdf4",
      topBarBg: dark
        ? "linear-gradient(135deg, rgba(15,23,42,0.94), rgba(30,41,59,0.9))"
        : "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
      topBarBorder: dark ? "rgba(71,85,105,0.6)" : "rgba(148,163,184,0.35)",
      cardBg: dark
        ? "rgba(17,24,39,0.9)"
        : "#ffffff",
      cardBorder: dark ? "rgba(71,85,105,0.5)" : "rgba(15,23,42,0.08)",
      searchFieldBg: dark ? "rgba(15,23,42,0.68)" : "#ffffff",
      searchFieldBorder: dark ? "rgba(71,85,105,0.7)" : alpha(primaryMain, 0.22),
    };
  }, [ownerThemeMode, theme.palette.primary.light, theme.palette.primary.main]);

  const fetchOrganizations = useCallback(async () => {
    setOrgLoading(true);
    setOrgError("");
    try {
      const params = new URLSearchParams();
      params.set("limit", String(ORG_PAGE_SIZE));
      params.set("offset", String(orgOffset));
      if (orgSearch.trim()) params.set("search", orgSearch.trim());

      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/auth/owner/v1/organizations?${params.toString()}`,
        { method: "GET" },
      );
      if (response.status === 304) return;
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Unable to load organizations");
      }

      const rows = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
      const count = Number(payload?.data?.count || 0);
      setOrgRows(rows);
      setOrgCount(Number.isFinite(count) ? count : rows.length);
      if (rows.length) {
        const existingSelection = rows.find((row) => Number(row.organization_id) === Number(selectedOrgId));
        const selected = existingSelection || rows[0];
        setSelectedOrgId(Number(selected.organization_id));
        setSelectedOrgName(String(selected.name || ""));
      } else {
        setSelectedOrgId(0);
        setSelectedOrgName("");
        setSelectedOrgDetails(null);
      }
    } catch (error) {
      setOrgError(error?.message || "Unable to load organizations");
      setOrgRows([]);
      setOrgCount(0);
      setSelectedOrgId(0);
      setSelectedOrgName("");
      setSelectedOrgDetails(null);
    } finally {
      setOrgLoading(false);
    }
  }, [orgOffset, orgSearch, selectedOrgId]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const fetchRoleOptions = useCallback(async () => {
    setRolesLoading(true);
    setRolesError("");
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      params.set("offset", "0");
      const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/roles?${params.toString()}`, {
        method: "GET",
      });
      if (response.status === 304) return;
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Unable to load roles");
      }
      const rows = Array.isArray(payload?.data?.rows)
        ? payload.data.rows
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      const options = rows
        .map((row) => ({
          value: Number(row?.role_id),
          label: row?.role_name || row?.role_key || `Role ${row?.role_id}`,
        }))
        .filter((row) => Number.isFinite(row.value) && row.value > 0);
      setRoleOptions(options);
    } catch (error) {
      setRolesError(error?.message || "Unable to load roles");
      setRoleOptions([]);
    } finally {
      setRolesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoleOptions();
  }, [fetchRoleOptions]);

  const orgSummary = useMemo(() => {
    return orgRows.reduce(
      (acc, row) => {
        acc.totalMembers += toNumber(row?.total_members, 0);
        acc.activeMembers += toNumber(row?.active_members, 0);
        return acc;
      },
      { totalMembers: 0, activeMembers: 0 },
    );
  }, [orgRows]);

  const fetchSelectedOrganizationOverview = useCallback(async () => {
    if (!selectedOrgId) {
      setSelectedOrgDetails(null);
      setSubscriptionData(null);
      setMembersRows([]);
      setMembersCount(0);
      setPaymentsRows([]);
      setPaymentsCount(0);
      return;
    }

    setSubscriptionLoading(true);
    setSubscriptionError("");
    setMembersLoading(true);
    setMembersError("");
    setPaymentsLoading(true);
    setPaymentsError("");

    try {
      const params = new URLSearchParams();
      params.set("members_limit", "2000");
      params.set("members_offset", "0");
      if (membersSearch.trim()) params.set("members_search", membersSearch.trim());
      params.set("payments_limit", String(RESOURCE_PAGE_SIZE));
      params.set("payments_offset", String(paymentsOffset));
      if (paymentsSearch.trim()) params.set("payments_search", paymentsSearch.trim());

      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/auth/owner/v1/organizations/${selectedOrgId}/overview?${params.toString()}`,
        { method: "GET" },
      );
      if (response.status === 304) return;
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Unable to load organization overview");
      }

      const organization = payload?.data?.organization || null;
      const subscription = payload?.data?.subscription || null;
      const membersRowsData = Array.isArray(payload?.data?.members?.rows) ? payload.data.members.rows : [];
      const membersTotal = Number(payload?.data?.members?.count || 0);
      const paymentRowsData = Array.isArray(payload?.data?.payments?.rows) ? payload.data.payments.rows : [];
      const paymentTotal = Number(payload?.data?.payments?.count || 0);

      setSelectedOrgDetails(organization);
      if (organization?.name) {
        setSelectedOrgName(String(organization.name));
      }
      setSubscriptionData(subscription);
      setMembersRows(membersRowsData);
      setMembersCount(Number.isFinite(membersTotal) ? membersTotal : membersRowsData.length);
      setPaymentsRows(paymentRowsData);
      setPaymentsCount(Number.isFinite(paymentTotal) ? paymentTotal : paymentRowsData.length);
    } catch (error) {
      const message = error?.message || "Unable to load organization overview";
      setSubscriptionError(message);
      setMembersError(message);
      setPaymentsError(message);
      setSelectedOrgDetails(null);
      setSubscriptionData(null);
      setMembersRows([]);
      setMembersCount(0);
      setPaymentsRows([]);
      setPaymentsCount(0);
    } finally {
      setSubscriptionLoading(false);
      setMembersLoading(false);
      setPaymentsLoading(false);
    }
  }, [selectedOrgId, membersSearch, paymentsOffset, paymentsSearch]);

  const fetchSelectedOrganizationSubscription = useCallback(async () => {
    await fetchSelectedOrganizationOverview();
  }, [fetchSelectedOrganizationOverview]);

  const fetchSelectedOrganizationMembers = useCallback(async () => {
    await fetchSelectedOrganizationOverview();
  }, [fetchSelectedOrganizationOverview]);

  const fetchSelectedOrganizationPayments = useCallback(async () => {
    await fetchSelectedOrganizationOverview();
  }, [fetchSelectedOrganizationOverview]);

  useEffect(() => {
    fetchSelectedOrganizationOverview();
  }, [fetchSelectedOrganizationOverview]);

  const fetchOwnerPayPlans = useCallback(async () => {
    setOwnerPayPlansLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      params.set("offset", "0");
      const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/plans?${params.toString()}`, {
        method: "GET",
      });
      if (response.status === 304) return;
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Unable to load plans");
      }
      const rows = Array.isArray(payload?.data?.rows)
        ? payload.data.rows
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      const options = rows
        .map((row) => ({
          value: Number(row?.plan_id),
          label: String(row?.plan_name || row?.plan_key || `Plan ${row?.plan_id}`),
          price: Number(row?.price),
          currency: String(row?.default_currency || "INR"),
        }))
        .filter((row) => Number.isFinite(row.value) && row.value > 0);
      setOwnerPayPlanOptions(options);
    } catch {
      setOwnerPayPlanOptions([]);
    } finally {
      setOwnerPayPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOwnerPayPlans();
  }, [fetchOwnerPayPlans]);

  const handleOpenMemberEdit = useCallback((row) => {
    setMemberEditRow(row || null);
    setMemberEditError("");
    setMemberEditForm({
      role_id: row?.role_id !== undefined && row?.role_id !== null ? String(row.role_id) : "",
      membership_status: String(row?.membership_status || "active").toLowerCase(),
    });
    setMemberEditOpen(true);
  }, []);

  const handleOpenMemberView = useCallback((row) => {
    setMemberViewRow(row || null);
    setMemberViewOpen(true);
  }, []);

  const handleSaveMemberUpdate = useCallback(async () => {
    if (!selectedOrgId || !memberEditRow?.user_id) {
      setMemberEditError("Member context missing for update");
      return;
    }

    const nextRoleId = Number(memberEditForm.role_id);
    if (!Number.isFinite(nextRoleId) || nextRoleId <= 0) {
      setMemberEditError("Please select a valid role");
      return;
    }

    const nextMembershipStatus = String(memberEditForm.membership_status || "").trim().toLowerCase();
    if (!["active", "invited", "suspended", "left"].includes(nextMembershipStatus)) {
      setMemberEditError("Please select a valid status");
      return;
    }

    const payload = {};
    if (Number(memberEditRow.role_id) !== nextRoleId) payload.role_id = nextRoleId;
    if (String(memberEditRow.membership_status || "").toLowerCase() !== nextMembershipStatus) {
      payload.membership_status = nextMembershipStatus;
    }

    if (!Object.keys(payload).length) {
      setMemberEditError("No changes found");
      return;
    }

      setMemberEditSaving(true);
      setMemberEditError("");
      try {
        const { response, payload: result } = await fetchWithAuth(
          `${API_BASE_URL}/auth/owner/v1/organizations/${selectedOrgId}/members/${memberEditRow.user_id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok || result?.status === "error") {
        throw new Error(result?.message || "Unable to update member");
      }

      setMemberEditOpen(false);
      setMemberEditRow(null);
      await Promise.all([fetchSelectedOrganizationMembers(), fetchOrganizations()]);
    } catch (error) {
      setMemberEditError(error?.message || "Unable to update member");
    } finally {
      setMemberEditSaving(false);
    }
  }, [memberEditForm, memberEditRow, selectedOrgId, fetchSelectedOrganizationMembers, fetchOrganizations]);

  const handleOpenCreateOwner = useCallback(() => {
    setCreateOwnerError("");
    setCreateOwnerSuccess("");
    setCreateOwnerForm({
      company_name: "",
      owner_name: "",
      email: "",
      phone: "",
      password: "",
    });
    setCreateOwnerOpen(true);
  }, []);

  const handleCreateOwnerSubmit = useCallback(async () => {
    const companyName = createOwnerForm.company_name.trim();
    const ownerName = createOwnerForm.owner_name.trim();
    const email = createOwnerForm.email.trim();
    const phone = createOwnerForm.phone.trim();
    const password = createOwnerForm.password;

    if (!companyName || !ownerName || !email || !phone || !password) {
      setCreateOwnerError("Company name, owner name, email, phone and password are required");
      return;
    }
    if (password.length < 8) {
      setCreateOwnerError("Password must be at least 8 characters");
      return;
    }
    setCreateOwnerSaving(true);
    setCreateOwnerError("");
    setCreateOwnerSuccess("");

    try {
      const payload = {
        company_name: companyName,
        owner_name: ownerName,
        email,
        phone,
        password,
      };

      const { response, payload: result } = await fetchWithAuth(`${API_BASE_URL}/auth/owner/v1/owners`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok || result?.status === "error") {
        throw new Error(result?.message || "Unable to create owner");
      }

      const createdOrganization = result?.data?.organization || null;
      if (createdOrganization?.organization_id) {
        setSelectedOrgId(Number(createdOrganization.organization_id));
        setSelectedOrgName(String(createdOrganization.name || ""));
      }
      setCreateOwnerSuccess("New owner created successfully");
      await fetchOrganizations();
      setCreateOwnerOpen(false);
    } catch (error) {
      setCreateOwnerError(error?.message || "Unable to create owner");
    } finally {
      setCreateOwnerSaving(false);
    }
  }, [createOwnerForm, fetchOrganizations]);

  const formatDateTime = useCallback((value) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleString();
  }, []);

  const handleOpenPaymentView = useCallback((row) => {
    setSelectedPaymentRow(row || null);
    setPaymentViewOpen(true);
  }, []);

  const handleOpenOwnerPay = useCallback((row) => {
    const gateway = normalizeGatewayToken(row?.payment_method || row?.gateway || "stripe").toLowerCase() || "stripe";
    const planId = Number(row?.plan_id || subscriptionData?.plan_id || 0);
    const amount = Number(row?.amount ?? row?.final_amount ?? 0);
    const userCount = Number(row?.user_count || subscriptionData?.max_users || selectedOrgDetails?.total_members || 1);
    setOwnerPayError("");
    setOwnerPaySuccess("");
    setOwnerPayRow(row || null);
    setOwnerPayForm({
      gateway,
      plan_id: Number.isFinite(planId) && planId > 0 ? String(planId) : "",
      amount: Number.isFinite(amount) && amount > 0 ? String(amount) : "",
      user_count: Number.isFinite(userCount) && userCount > 0 ? String(userCount) : "1",
      transaction_id: "",
      note: "",
    });
    setOwnerPayOpen(true);
  }, [selectedOrgDetails?.total_members, subscriptionData?.max_users, subscriptionData?.plan_id]);

  const handleSubmitOwnerPay = useCallback(async () => {
    if (!selectedOrgId || !ownerPayRow?.payment_id) {
      setOwnerPayError("Payment context missing");
      return;
    }
    const gateway = String(ownerPayForm.gateway || "").trim().toLowerCase();
    const planId = Number(ownerPayForm.plan_id || 0);
    const amount = Number(ownerPayForm.amount || 0);
    const userCount = Number(ownerPayForm.user_count || 0);
    const transactionId = String(ownerPayForm.transaction_id || "").trim();
    if (!gateway) {
      setOwnerPayError("Gateway is required");
      return;
    }
    if (!Number.isFinite(planId) || planId <= 0) {
      setOwnerPayError("Please select a valid plan");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setOwnerPayError("Please enter a valid price");
      return;
    }
    if (!Number.isFinite(userCount) || userCount <= 0) {
      setOwnerPayError("Please enter a valid users count");
      return;
    }
    if (!transactionId) {
      setOwnerPayError("Transaction ID is required");
      return;
    }

    setOwnerPaySaving(true);
    setOwnerPayError("");
    setOwnerPaySuccess("");
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/auth/owner/v1/organizations/${selectedOrgId}/payments/${ownerPayRow.payment_id}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gateway,
            plan_id: planId,
            amount,
            user_count: Math.floor(userCount),
            transaction_id: transactionId,
            note: String(ownerPayForm.note || "").trim() || null,
          }),
        },
      );
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Unable to complete payment");
      }

      const updatedPayment = payload?.data?.payment || null;
      if (updatedPayment?.payment_id) {
        setSelectedPaymentRow(updatedPayment);
      }
      setOwnerPaySuccess(payload?.message || "Payment completed successfully");
      await Promise.all([fetchSelectedOrganizationOverview(), fetchOrganizations()]);
      setOwnerPayOpen(false);
    } catch (error) {
      setOwnerPayError(error?.message || "Unable to complete payment");
    } finally {
      setOwnerPaySaving(false);
    }
  }, [fetchOrganizations, fetchSelectedOrganizationOverview, ownerPayForm, ownerPayRow, selectedOrgId]);

  const handleDownloadInvoice = useCallback(
    async (row) => {
      const payment = row || selectedPaymentRow;
      if (!payment) return;
      try {
        const company = {
          name: "TeamChatX",
          address: "Sector 62, Tower A, Noida, UP, India, 201301",
          email: "support@teamchatx.com",
          phone: "+91 9876543210",
        };
        await downloadInvoicePdf({
          payment: {
            invoice: payment?.invoice_number || `INV-${payment?.payment_id || "NA"}`,
            payment_date: payment?.payment_date,
            status: payment?.payment_status || payment?.status,
            transaction_id: payment?.transaction_id,
            plan_name: payment?.plan_name,
            user_count: payment?.user_count,
            period_months: Number(payment?.period_months || 1),
            amount: Number(payment?.final_amount ?? payment?.amount ?? 0),
            currency: payment?.currency_code || "INR",
            discount_amount: Number(payment?.discount_amount || 0),
            coupon_code: payment?.coupon_code || "",
          },
          company,
        });
      } catch (error) {
        console.error("Invoice generation failed", error);
      }
    },
    [selectedPaymentRow],
  );

  const handleLogout = async () => {
    try {
      await fetchWithAuth(`${API_BASE_URL}/auth/logout`, { method: "POST" });
    } catch {
      // Ignore network logout failure.
    } finally {
      authStore.logout();
      navigate("/auth/login", { replace: true });
    }
  };

  useEffect(() => {
    if (activeSection === "organization-members" && selectedOrgId) {
      setMembersDialogOpen(true);
    }
  }, [activeSection, selectedOrgId]);

  const organizationGridRows = useMemo(
    () =>
      orgRows.map((row, index) => ({
        ...row,
        __srNo: orgOffset + index + 1,
        __rowKey: row.organization_id || `org-${index}`,
      })),
    [orgRows, orgOffset],
  );

  const organizationColumns = useMemo(
    () => [
      {
        field: "__srNo",
        headerName: "Sr.",
        minWidth: 80,
        maxWidth: 90,
        sortable: false,
        filterable: false,
      },
      {
        field: "name",
        headerName: "Organization",
        flex: 1.2,
        minWidth: 200,
        renderCell: (params) => (
          <Stack spacing={0.15}>
            <Typography fontWeight={600}>{toCellText(params.row.name)}</Typography>
            <Typography variant="caption" color="text.secondary">
              {toCellText(params.row.subdomain || params.row.org_key)}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "owner_name",
        headerName: "Owner",
        flex: 1.1,
        minWidth: 220,
        renderCell: (params) => (
          <Stack spacing={0.15}>
            <Typography>{toCellText(params.row.owner_name)}</Typography>
            <Typography variant="caption" color="text.secondary">
              {toCellText(params.row.owner_email)}
            </Typography>
          </Stack>
        ),
      },
      { field: "total_members", headerName: "Total Members", minWidth: 130, type: "number" },
      {
        field: "status",
        headerName: "Status",
        minWidth: 120,
        flex: 0.8,
        renderCell: (params) => renderStatusChip(params.value),
      },
      {
        field: "__actions",
        headerName: "Action",
        minWidth: 250,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="contained"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedOrgId(Number(params.row.organization_id));
                setSelectedOrgName(String(params.row.name || ""));
                setMembersDialogOpen(true);
              }}
            >
              Members
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="secondary"
              onClick={async (event) => {
                event.stopPropagation();
                setSelectedOrgId(Number(params.row.organization_id));
                setSelectedOrgName(String(params.row.name || ""));
                setSubscriptionDialogOpen(true);
                await fetchSelectedOrganizationOverview();
              }}
            >
              Subscription
            </Button>
          </Stack>
        ),
      },
    ],
    [fetchSelectedOrganizationOverview],
  );

  const memberGridRows = useMemo(
    () =>
      membersRows.map((row, index) => ({
        ...row,
        __srNo: index + 1,
        joined_at_label: row.joined_at ? new Date(row.joined_at).toLocaleDateString() : "-",
        __rowKey: row.membership_id || `member-${index}`,
      })),
    [membersRows],
  );

  const memberColumns = useMemo(
    () => [
      { field: "__srNo", headerName: "Sr.", minWidth: 80, maxWidth: 90, sortable: false, filterable: false },
      { field: "name", headerName: "Name", minWidth: 170, flex: 1 },
      { field: "email", headerName: "Email", minWidth: 220, flex: 1.2 },
      {
        field: "role_name",
        headerName: "Role",
        minWidth: 140,
        flex: 0.8,
        renderCell: (params) => toCellText(params.row.role_name || params.row.role_key),
      },
      {
        field: "membership_status",
        headerName: "Status",
        minWidth: 120,
        flex: 0.7,
        renderCell: (params) => renderStatusChip(params.value),
      },
      {
        field: "__actions",
        headerName: "Action",
        minWidth: 240,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const row = params.row;
          return (
            <Stack direction="row" spacing={0.8}>
              <Button
                size="small"
                color="info"
                variant="contained"
                startIcon={<FiEye size={14} />}
                onClick={() => handleOpenMemberView(row)}
              >
                View
              </Button>
              <Button
                size="small"
                color="warning"
                variant="contained"
                startIcon={<FiEdit2 size={14} />}
                onClick={() => handleOpenMemberEdit(row)}
              >
                Edit
              </Button>
            </Stack>
          );
        },
      },
    ],
    [handleOpenMemberEdit, handleOpenMemberView],
  );

  const paymentGatewayOptions = useMemo(() => {
    const seen = new Set();
    paymentsRows.forEach((row) => {
      normalizeGatewayParts(row?.payment_method || row?.gateway).forEach((gateway) => {
        const key = gateway.toLowerCase();
        if (key) seen.add(key);
      });
    });
    return Array.from(seen)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: toDisplayLabel(value) }));
  }, [paymentsRows]);

  const filteredPaymentsRows = useMemo(() => {
    if (paymentsGatewayFilter === "all") return paymentsRows;
    return paymentsRows.filter((row) =>
      normalizeGatewayParts(row?.payment_method || row?.gateway)
        .map((gateway) => gateway.toLowerCase())
        .includes(paymentsGatewayFilter),
    );
  }, [paymentsRows, paymentsGatewayFilter]);

  const paymentGridRows = useMemo(
    () =>
      filteredPaymentsRows.map((row, index) => ({
        ...row,
        __srNo: paymentsOffset + index + 1,
        payment_date_label: row.payment_date ? new Date(row.payment_date).toLocaleDateString() : "-",
        gateway_label: getPrimaryGateway(row.payment_method || row.gateway || "N/A"),
        amount_label:
          row.amount !== undefined && row.amount !== null
            ? `${row.currency_code || "INR"} ${row.amount}`
            : "-",
        __rowKey: row.payment_id || `payment-${index}`,
      })),
    [filteredPaymentsRows, paymentsOffset],
  );

  const paymentColumns = useMemo(
    () => [
      { field: "__srNo", headerName: "Sr.", minWidth: 80, maxWidth: 90, sortable: false, filterable: false },
      { field: "invoice_number", headerName: "Invoice", minWidth: 150, flex: 1 },
      { field: "payment_date_label", headerName: "Date", minWidth: 120, flex: 0.8 },
      { field: "plan_name", headerName: "Plan", minWidth: 150, flex: 1 },
      {
        field: "gateway_label",
        headerName: "Gateway",
        minWidth: 130,
        flex: 0.8,
        renderCell: (params) => renderGatewayChip(params.value),
      },
      { field: "amount_label", headerName: "Amount", minWidth: 130, flex: 0.8 },
      {
        field: "payment_status",
        headerName: "Status",
        minWidth: 120,
        flex: 0.7,
        renderCell: (params) => renderStatusChip(params.value),
      },
      {
        field: "__actions",
        headerName: "Action",
        minWidth: 320,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const row = params.row;
          return (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="contained"
                startIcon={<FiEye size={14} />}
                onClick={() => handleOpenPaymentView(row)}
              >
                View
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FiDownload size={14} />}
                onClick={() => handleDownloadInvoice(row)}
              >
                Invoice
              </Button>
              {canOwnerCompletePayment(row) ? (
                <Button
                  size="small"
                  color="success"
                  variant="contained"
                  startIcon={<FiCreditCard size={14} />}
                  onClick={() => handleOpenOwnerPay(row)}
                >
                  Complete
                </Button>
              ) : null}
            </Stack>
          );
        },
      },
    ],
    [handleDownloadInvoice, handleOpenOwnerPay, handleOpenPaymentView],
  );

  const organizationColumnVisibilityModel = useMemo(
    () =>
      isSmall
        ? {
            __srNo: true,
            owner_name: false,
          }
        : {},
    [isSmall],
  );

  const memberColumnVisibilityModel = useMemo(
    () =>
      isSmall
        ? {
            __srNo: true,
          }
        : {},
    [isSmall],
  );

  const paymentColumnVisibilityModel = useMemo(
    () =>
      isSmall
        ? {
            __srNo: true,
          }
        : {},
    [isSmall],
  );
  const currentRoleId = useMemo(() => {
    if (typeof window === "undefined") return 0;
    return Number(window.localStorage.getItem("role") || 0);
  }, []);
  const hiddenSidebarItemIds = useMemo(
    () =>
      Object.entries(OWNER_MODULES)
        .filter(([, config]) => Array.isArray(config?.blockedRoleIds) && config.blockedRoleIds.includes(currentRoleId))
        .map(([moduleKey]) => moduleKey),
    [currentRoleId],
  );

  useEffect(() => {
    if (!hiddenSidebarItemIds.includes(activeSection)) return;
    setActiveSection("organizations");
  }, [activeSection, hiddenSidebarItemIds]);

  const selectedOrganizationRow = useMemo(() => {
    if (selectedOrgDetails) return selectedOrgDetails;
    return orgRows.find((row) => Number(row.organization_id) === Number(selectedOrgId)) || null;
  }, [selectedOrgDetails, orgRows, selectedOrgId]);
  const activeSectionTitle =
    ORG_WORKSPACE_SECTION_TITLES[activeSection] ||
    OWNER_MODULES[activeSection]?.title ||
    "Overview";
  const isOrganizationWorkspaceSection = [
    "organizations",
    "organization-members",
    "organization-subscription",
    "organization-payments",
  ].includes(activeSection);
  const overviewHealth = useMemo(() => {
    const activeOrganizations = orgRows.filter((row) => String(row?.status || "").toLowerCase() === "active").length;
    const inactiveOrganizations = orgRows.filter((row) => String(row?.status || "").toLowerCase() !== "active").length;
    const monthlyRevenue = paymentsRows.reduce((sum, row) => sum + toNumber(row?.amount, 0), 0);
    const successfulPayments = paymentsRows.filter((row) =>
      ["success", "paid", "completed"].includes(String(row?.payment_status || "").toLowerCase()),
    ).length;
    const selectedOrgMembers = membersCount || toNumber(selectedOrganizationRow?.total_members, 0);
    return {
      activeOrganizations,
      inactiveOrganizations,
      monthlyRevenue,
      successfulPayments,
      selectedOrgMembers,
    };
  }, [orgRows, paymentsRows, membersCount, selectedOrganizationRow]);
  const topOrganizations = useMemo(
    () =>
      [...orgRows]
        .sort((a, b) => toNumber(b?.total_members, 0) - toNumber(a?.total_members, 0))
        .slice(0, 5),
    [orgRows],
  );
  const recentPaymentsPreview = useMemo(() => filteredPaymentsRows.slice(0, 5), [filteredPaymentsRows]);

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      sx={{ minHeight: "100dvh", background: ownerUi.pageBg, color: ownerUi.textPrimary, overflowX: "hidden" }}
    >
      <Box sx={{ display: { xs: "none", md: "block" }, width: 260, flexShrink: 0 }}>
        <Box sx={{ position: "fixed", top: 0, left: 0, width: 260, height: "100dvh", zIndex: 1200 }}>
          <OwnerSidebar
            active={activeSection}
            onSelect={setActiveSection}
            mode={ownerThemeMode}
            hiddenItemIds={hiddenSidebarItemIds}
            brandName={siteBrandName}
          />
        </Box>
      </Box>

      <Drawer
        anchor="left"
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { width: 280, maxWidth: "88vw", border: 0, bgcolor: "transparent", boxShadow: "none" },
        }}
      >
        <OwnerSidebar
          active={activeSection}
          onSelect={setActiveSection}
          mode={ownerThemeMode}
          hiddenItemIds={hiddenSidebarItemIds}
          brandName={siteBrandName}
          onNavigate={() => setMobileSidebarOpen(false)}
        />
      </Drawer>
      <SettingsDrawer
        open={ownerSettingsOpen}
        setOpen={setOwnerSettingsOpen}
        hideChatLayout
        dialogSize={ownerDialogSize}
        onDialogSizeChange={setOwnerDialogSize}
      />

      <Box sx={{ flexGrow: 1, minWidth: 0, p: { xs: 1.2, md: 2.5 } }}>
        <Stack spacing={2}>
          <Paper
            sx={{
              p: 1.1,
              borderRadius: 2,
              position: "sticky",
              top: 8,
              zIndex: 9,
              background: ownerUi.topBarBg,
              border: "1px solid",
              borderColor: ownerUi.topBarBorder,
              color: ownerUi.textPrimary,
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <IconButton
                  size="small"
                  onClick={() => setMobileSidebarOpen(true)}
                  sx={{ display: { xs: "inline-flex", md: "none" } }}
                >
                  <FiMenu size={18} />
                </IconButton>
                <Typography variant="subtitle1" fontWeight={800} sx={{ color: ownerUi.textPrimary }}>
                  Owner Control Center
                </Typography>
                <Chip
                  size="small"
                  label={activeSectionTitle}
                  sx={{
                    display: { xs: "none", sm: "inline-flex" },
                    bgcolor: ownerUi.accentSoft,
                    color: ownerUi.accentText,
                  }}
                />
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setOwnerSettingsOpen(true)}
                  startIcon={<FiSettings size={14} />}
                  sx={{
                    borderColor: ownerUi.topBarBorder,
                    color: ownerUi.textPrimary,
                    whiteSpace: "nowrap",
                  }}
                >
                  Settings
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setOwnerThemeMode((prev) => (prev === "dark" ? "light" : "dark"))}
                  startIcon={ownerUi.isDark ? <FiSun size={14} /> : <FiMoon size={14} />}
                  sx={{
                    borderColor: ownerUi.topBarBorder,
                    color: ownerUi.textPrimary,
                    whiteSpace: "nowrap",
                  }}
                >
                  {ownerUi.isDark ? "Light" : "Dark"}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleLogout}
                  sx={{
                    bgcolor: "#dc2626",
                    color: "#fff",
                    "&:hover": { bgcolor: "#b91c1c" },
                    whiteSpace: "nowrap",
                  }}
                >
                  Logout
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {activeSection === "overview" ? (
            <Stack spacing={2}>
              <Paper sx={{ p: 2.2, borderRadius: 2, background: ownerUi.cardBg, border: "1px solid", borderColor: ownerUi.cardBorder }}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", md: "center" }}
                >
                  <Stack spacing={0.45}>
                    <Typography variant="h6" fontWeight={800}>
                      Platform Overview
                    </Typography>
                    <Typography variant="body2" sx={{ color: ownerUi.textSecondary }}>
                      Quick summary of organizations, members, and billing controls.
                    </Typography>
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: { xs: "100%", md: "auto" } }}>
                    <Button fullWidth={isSmall} variant="contained" onClick={() => setActiveSection("organizations")}>
                      Manage Organizations
                    </Button>
                    <Button fullWidth={isSmall} variant="outlined" onClick={() => setActiveSection("plans")}>
                      Manage Plans
                    </Button>
                  </Stack>
                </Stack>
              </Paper>

              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", xl: "repeat(3, minmax(0, 1fr))" },
                }}
              >
                {[
                  {
                    title: "Organizations",
                    value: orgCount,
                    caption: "Total tenant organizations",
                    icon: "ORG",
                  },
                  {
                    title: "Members",
                    value: orgSummary.totalMembers,
                    caption: "Members in current organization dataset",
                    icon: "USR",
                  },
                  {
                    title: "Active Members",
                    value: orgSummary.activeMembers,
                    caption: "Active memberships",
                    icon: "ACT",
                  },
                  {
                    title: "Selected Org Members",
                    value: overviewHealth.selectedOrgMembers,
                    caption: selectedOrgName || "No organization selected",
                    icon: "SEL",
                  },
                  {
                    title: "Payments (Loaded)",
                    value: paymentsCount,
                    caption: "Payment records in selected organization",
                    icon: "PAY",
                  },
                  {
                    title: "Loaded Revenue",
                    value: `${subscriptionData?.default_currency || "INR"} ${overviewHealth.monthlyRevenue.toFixed(2)}`,
                    caption: "Sum of loaded payment rows",
                    icon: "REV",
                  },
                ].map((card) => (
                  <Paper
                    key={card.title}
                    sx={{
                      p: 1.8,
                      borderRadius: 2,
                      backgroundColor: ownerUi.surfaceSoft,
                      border: "1px solid",
                      borderColor: ownerUi.surfaceSoftBorder,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Typography variant="caption" sx={{ color: ownerUi.textSecondary }}>
                        {card.title}
                      </Typography>
                      <Box
                        sx={{
                          minWidth: 34,
                          height: 24,
                          px: 1,
                          borderRadius: 99,
                          bgcolor: ownerUi.accentSoft,
                          color: ownerUi.accentText,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {card.icon}
                      </Box>
                    </Stack>
                    <Typography variant="h5" fontWeight={800} sx={{ mt: 0.8 }} noWrap>
                      {card.value}
                    </Typography>
                    <Typography variant="caption" sx={{ color: ownerUi.textSecondary }}>
                      {card.caption}
                    </Typography>
                  </Paper>
                ))}
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: { xs: "1fr", lg: "1.1fr 1fr" },
                }}
              >
                <Paper sx={{ p: 2, borderRadius: 2, bgcolor: ownerUi.panelBg, border: "1px solid", borderColor: ownerUi.panelBorder }}>
                  <Stack spacing={1.1}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Organization Health
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Paper variant="outlined" sx={{ p: 1.2, flex: 1, bgcolor: ownerUi.surfaceSoft, borderColor: ownerUi.surfaceSoftBorder }}>
                        <Typography variant="caption" sx={{ color: ownerUi.textSecondary }}>Active Organizations</Typography>
                        <Typography fontWeight={700}>{overviewHealth.activeOrganizations}</Typography>
                      </Paper>
                      <Paper variant="outlined" sx={{ p: 1.2, flex: 1, bgcolor: ownerUi.surfaceSoft, borderColor: ownerUi.surfaceSoftBorder }}>
                        <Typography variant="caption" sx={{ color: ownerUi.textSecondary }}>Inactive Organizations</Typography>
                        <Typography fontWeight={700}>{overviewHealth.inactiveOrganizations}</Typography>
                      </Paper>
                      <Paper variant="outlined" sx={{ p: 1.2, flex: 1, bgcolor: ownerUi.surfaceSoft, borderColor: ownerUi.surfaceSoftBorder }}>
                        <Typography variant="caption" sx={{ color: ownerUi.textSecondary }}>Successful Payments</Typography>
                        <Typography fontWeight={700}>{overviewHealth.successfulPayments}</Typography>
                      </Paper>
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button variant="contained" color="success" startIcon={<FiUserPlus size={14} />} onClick={handleOpenCreateOwner}>
                        Add Owner
                      </Button>
                      <Button variant="contained" onClick={() => setActiveSection("organizations")}>
                        Open Organizations
                      </Button>
                      <Button variant="outlined" onClick={() => setActiveSection("plans")}>
                        Open Plans
                      </Button>
                      <Button variant="outlined" onClick={() => setActiveSection("activity-logs")}>
                        Activity Logs
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>

                <Paper sx={{ p: 2, borderRadius: 2, bgcolor: ownerUi.panelBg, border: "1px solid", borderColor: ownerUi.panelBorder }}>
                  <Stack spacing={1}>
                    {selectedOrgId ? (
                      <>
                        <Typography variant="h6" fontWeight={800}>
                          {selectedOrgName || `Organization #${selectedOrgId}`}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                          <Chip size="small" label={`Org ID ${selectedOrgId}`} />
                          <Chip size="small" label={`Members ${overviewHealth.selectedOrgMembers}`} />
                          {renderStatusChip(subscriptionData?.status || selectedOrganizationRow?.status || "active")}
                        </Stack>
                        <Typography variant="body2" sx={{ color: ownerUi.textSecondary }}>
                          Plan: {toCellText(subscriptionData?.plan_name || "No active plan")}
                        </Typography>
                        <Typography variant="body2" sx={{ color: ownerUi.textSecondary }}>
                          Validity: {subscriptionData?.start_date ? new Date(subscriptionData.start_date).toLocaleDateString() : "-"}
                          {" - "}
                          {subscriptionData?.end_date ? new Date(subscriptionData.end_date).toLocaleDateString() : "-"}
                        </Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <Button variant="contained" onClick={() => setMembersDialogOpen(true)}>
                            View Members
                          </Button>
                          <Button variant="outlined" onClick={async () => {
                            setSubscriptionDialogOpen(true);
                            await fetchSelectedOrganizationOverview();
                          }}>
                            Subscription & Payments
                          </Button>
                        </Stack>
                      </>
                    ) : (
                      <Alert severity="info">Select an organization to see full overview.</Alert>
                    )}
                  </Stack>
                </Paper>
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: { xs: "1fr", lg: "1.1fr 1fr" },
                }}
              >
                <Paper sx={{ p: 2, borderRadius: 2, bgcolor: ownerUi.panelBg, border: "1px solid", borderColor: ownerUi.panelBorder }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1.2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Top Organizations By Members
                    </Typography>
                    <Button size="small" variant="text" onClick={() => setActiveSection("organizations")}>
                      View all
                    </Button>
                  </Stack>
                  {topOrganizations.length ? (
                    <Stack spacing={0.8}>
                      {topOrganizations.map((row, idx) => (
                        <Stack
                          key={row.organization_id || idx}
                          direction={{ xs: "column", sm: "row" }}
                          alignItems={{ xs: "flex-start", sm: "center" }}
                          justifyContent="space-between"
                          spacing={0.8}
                          sx={{ p: 1.15, borderRadius: 1.5, bgcolor: ownerUi.surfaceSoft, border: "1px solid", borderColor: ownerUi.surfaceSoftBorder }}
                        >
                          <Stack spacing={0.25}>
                            <Typography variant="body2" fontWeight={700}>
                              {toCellText(row.name)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: ownerUi.textSecondary }}>
                              {toCellText(row.owner_email)}
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.8} alignItems="center">
                            <Chip size="small" icon={<FiUsers size={12} />} label={`Members ${toNumber(row.total_members, 0)}`} />
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                setSelectedOrgId(Number(row.organization_id));
                                setSelectedOrgName(String(row.name || ""));
                                setMembersDialogOpen(true);
                              }}
                            >
                              View
                            </Button>
                            {renderStatusChip(row.status)}
                          </Stack>
                        </Stack>
                      ))}
                    </Stack>
                  ) : (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "text.secondary" }}>
                      <FiGift size={15} />
                      <Typography variant="body2">No organizations loaded for snapshot.</Typography>
                    </Stack>
                  )}
                </Paper>

                <Paper sx={{ p: 2, borderRadius: 2, bgcolor: ownerUi.panelBg, border: "1px solid", borderColor: ownerUi.panelBorder }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1.2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Recent Payments
                    </Typography>
                    <Button size="small" variant="text" onClick={() => setSubscriptionDialogOpen(true)} disabled={!selectedOrgId}>
                      Open full
                    </Button>
                  </Stack>
                  {recentPaymentsPreview.length ? (
                    <Stack spacing={0.8}>
                      {recentPaymentsPreview.map((payment, index) => (
                        <Stack
                          key={payment.payment_id || payment.invoice_number || index}
                          direction={{ xs: "column", sm: "row" }}
                          alignItems={{ xs: "flex-start", sm: "center" }}
                          justifyContent="space-between"
                          spacing={1}
                          sx={{ p: 1.15, borderRadius: 1.5, bgcolor: ownerUi.surfaceSoft, border: "1px solid", borderColor: ownerUi.surfaceSoftBorder }}
                        >
                          <Stack spacing={0.2}>
                            <Typography variant="body2" fontWeight={700}>
                              {toCellText(payment.invoice_number)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: ownerUi.textSecondary }}>
                              {formatDateTime(payment.payment_date)}
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.8} alignItems="center">
                            {renderGatewayChip(payment.payment_method || payment.gateway || "N/A")}
                            <Typography variant="body2" fontWeight={700}>
                              {(payment.currency_code || "INR")} {toCellText(payment.amount)}
                            </Typography>
                            {renderStatusChip(payment.payment_status)}
                            <Button size="small" variant="outlined" onClick={() => handleOpenPaymentView(payment)}>
                              View
                            </Button>
                            <Button size="small" variant="outlined" onClick={() => handleDownloadInvoice(payment)}>
                              Invoice
                            </Button>
                            {canOwnerCompletePayment(payment) ? (
                              <Button
                                size="small"
                                color="success"
                                variant="contained"
                                startIcon={<FiCreditCard size={14} />}
                                onClick={() => handleOpenOwnerPay(payment)}
                              >
                                Complete
                              </Button>
                            ) : null}
                          </Stack>
                        </Stack>
                      ))}
                    </Stack>
                  ) : (
                    <Alert severity="info">No payment records available for selected organization.</Alert>
                  )}
                </Paper>
              </Box>
            </Stack>
          ) : null}

          {isOrganizationWorkspaceSection ? (
            <Stack spacing={2}>
              <Paper
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: ownerUi.panelBg,
                  border: "1px solid",
                  borderColor: ownerUi.panelBorder,
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ flexWrap: "nowrap", overflowX: "auto", "&::-webkit-scrollbar": { height: 6 } }}
                >
                  <TextField
                    fullWidth
                    size="small"
                    label="Search organizations"
                    value={orgSearchInput}
                    onChange={(event) => setOrgSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        setOrgOffset(0);
                        setOrgSearch(orgSearchInput.trim());
                      }
                    }}
                    sx={{
                      minWidth: { xs: 240, md: 320 },
                      flex: 1,
                      "& .MuiOutlinedInput-root": {
                        bgcolor: ownerUi.searchFieldBg,
                        color: ownerUi.textPrimary,
                      },
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: ownerUi.searchFieldBorder,
                      },
                      "& .MuiInputLabel-root": {
                        color: ownerUi.textSecondary,
                      },
                    }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => {
                      setOrgOffset(0);
                      setOrgSearch(orgSearchInput.trim());
                    }}
                    sx={{
                      minWidth: 98,
                      height: 40,
                      whiteSpace: "nowrap",
                      background: `linear-gradient(135deg, ${ownerUi.brandA}, ${ownerUi.brandB})`,
                    }}
                  >
                    Search
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setOrgSearchInput("");
                      setOrgSearch("");
                      setOrgOffset(0);
                    }}
                    sx={{ minWidth: 90, height: 40, whiteSpace: "nowrap", borderColor: ownerUi.searchFieldBorder, color: ownerUi.textPrimary }}
                  >
                    Reset
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<FiUserPlus size={14} />}
                    onClick={handleOpenCreateOwner}
                    sx={{
                      minWidth: 122,
                      height: 40,
                      whiteSpace: "nowrap",
                      bgcolor: ownerUi.successBtn,
                      color: ownerUi.addOwnerText,
                      fontWeight: 700,
                      "&:hover": { bgcolor: ownerUi.successBtn },
                    }}
                  >
                    Add Owner
                  </Button>
                </Stack>
              </Paper>

              <Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
                {orgError ? <Alert severity="error">{orgError}</Alert> : null}
                {orgLoading ? (
                  <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
                    <CircularProgress size={28} />
                  </Stack>
                ) : (
                  <>
                    <Box sx={{ height: { xs: 420, md: 520 } }}>
                      <DataGrid
                        rows={organizationGridRows}
                        columns={organizationColumns}
                        columnVisibilityModel={organizationColumnVisibilityModel}
                        getRowId={(row) => row.__rowKey}
                        disableRowSelectionOnClick
                        hideFooter
                        pageSizeOptions={[ORG_PAGE_SIZE]}
                        onRowClick={(params) => {
                          setSelectedOrgId(Number(params.row.organization_id));
                          setSelectedOrgName(String(params.row.name || ""));
                          setMembersSearch("");
                          setMembersSearchInput("");
                          setPaymentsOffset(0);
                          setPaymentsSearch("");
                          setPaymentsSearchInput("");
                        }}
                        sx={{
                          "& .MuiDataGrid-row.Mui-selected": {
                            backgroundColor: "rgba(25,118,210,0.12)",
                          },
                          "& .MuiDataGrid-cell": { fontSize: { xs: 12, md: 13 } },
                          "& .MuiDataGrid-columnHeaderTitle": { fontSize: { xs: 12, md: 13 }, fontWeight: 700 },
                        }}
                      />
                    </Box>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      alignItems={{ xs: "stretch", sm: "center" }}
                      spacing={1}
                      sx={{ p: 1.5, borderTop: "1px solid", borderColor: "divider" }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Showing {orgRows.length ? orgOffset + 1 : 0} - {Math.min(orgOffset + orgRows.length, orgCount)} of {orgCount}
                      </Typography>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          fullWidth={isSmall}
                          onClick={() => setOrgOffset((prev) => Math.max(prev - ORG_PAGE_SIZE, 0))}
                          disabled={orgOffset === 0}
                        >
                          Previous
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          fullWidth={isSmall}
                          onClick={() => {
                            if (orgOffset + ORG_PAGE_SIZE >= orgCount) return;
                            setOrgOffset((prev) => prev + ORG_PAGE_SIZE);
                          }}
                          disabled={orgOffset + ORG_PAGE_SIZE >= orgCount}
                        >
                          Next
                        </Button>
                      </Stack>
                    </Stack>
                  </>
                )}
              </Paper>

              {selectedOrgId ? (
                <Dialog
                  open={membersDialogOpen}
                  onClose={() => setMembersDialogOpen(false)}
                  disableScrollLock
                  fullWidth={false}
                  maxWidth={false}
                  sx={{
                    "& .MuiDialog-container": {
                      p: { xs: 1.5, md: 2.5 },
                      pl: { md: "300px" },
                      pr: { md: "40px" },
                    },
                  }}
                  PaperProps={{
                    sx: ownerDialogPaperSx,
                  }}
                >
                  <DialogTitle>
                    {renderOwnerDialogHeading(
                      "Organization Members",
                      selectedOrgName || `Organization #${selectedOrgId}`,
                    )}
                  </DialogTitle>
                  <DialogContent dividers>
                    <Stack spacing={2}>
                      <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
                        <Paper variant="outlined" sx={{ p: 1.2, flex: 1 }}>
                          <Typography variant="caption" color="text.secondary">Organization</Typography>
                          <Typography fontWeight={700}>{toCellText(selectedOrganizationRow?.name || selectedOrgName)}</Typography>
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 1.2, flex: 1 }}>
                          <Typography variant="caption" color="text.secondary">Owner</Typography>
                          <Typography fontWeight={700}>{toCellText(selectedOrganizationRow?.owner_name)}</Typography>
                          <Typography variant="caption" color="text.secondary">{toCellText(selectedOrganizationRow?.owner_email)}</Typography>
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 1.2, flex: 1 }}>
                          <Typography variant="caption" color="text.secondary">Plan</Typography>
                          <Typography fontWeight={700}>{toCellText(subscriptionData?.plan_name)}</Typography>
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 1.2, flex: 1 }}>
                          <Typography variant="caption" color="text.secondary">Members</Typography>
                          <Typography fontWeight={700}>{membersCount}</Typography>
                        </Paper>
                      </Stack>

                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", md: "center" }}
                        spacing={1.2}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Members: {membersRows.length} of {membersCount}
                        </Typography>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                          <TextField
                            size="small"
                            label="Search members"
                            value={membersSearchInput}
                            onChange={(event) => setMembersSearchInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                setMembersSearch(membersSearchInput.trim());
                              }
                            }}
                          />
                          <Button variant="contained" onClick={() => setMembersSearch(membersSearchInput.trim())}>
                            Search
                          </Button>
                          <Button
                            variant="outlined"
                            onClick={() => {
                              setMembersSearchInput("");
                              setMembersSearch("");
                            }}
                          >
                            Reset
                          </Button>
                        </Stack>
                      </Stack>

                      {membersError ? <Alert severity="error">{membersError}</Alert> : null}
                      {membersLoading ? (
                        <Stack alignItems="center" justifyContent="center" sx={{ py: 2.5 }}>
                          <CircularProgress size={24} />
                        </Stack>
                      ) : (
                        <Box sx={{ height: { xs: 320, md: 360 } }}>
                          <DataGrid
                            rows={memberGridRows}
                            columns={memberColumns}
                            columnVisibilityModel={memberColumnVisibilityModel}
                            getRowId={(row) => row.__rowKey}
                            disableRowSelectionOnClick
                            hideFooter
                            pageSizeOptions={[RESOURCE_PAGE_SIZE]}
                            sx={{
                              "& .MuiDataGrid-cell": { fontSize: { xs: 12, md: 13 } },
                              "& .MuiDataGrid-columnHeaderTitle": { fontSize: { xs: 12, md: 13 }, fontWeight: 700 },
                            }}
                          />
                        </Box>
                      )}

                    </Stack>
                  </DialogContent>
                  <DialogActions>
                    <Button variant="outlined" onClick={fetchSelectedOrganizationOverview}>
                      Refresh Members
                    </Button>
                    <Button onClick={() => setMembersDialogOpen(false)}>Close</Button>
                  </DialogActions>
                </Dialog>
              ) : null}

              {selectedOrgId ? (
                <Dialog
                  open={subscriptionDialogOpen}
                  onClose={() => setSubscriptionDialogOpen(false)}
                  disableScrollLock
                  fullWidth={false}
                  maxWidth={false}
                  sx={{
                    "& .MuiDialog-container": {
                      p: { xs: 1.5, md: 2.5 },
                      pl: { md: "300px" },
                      pr: { md: "40px" },
                    },
                  }}
                  PaperProps={{
                    sx: ownerDialogPaperSx,
                  }}
                >
                  <DialogTitle>
                    {renderOwnerDialogHeading(
                      "Subscription & Payment History",
                      selectedOrgName || `Organization #${selectedOrgId}`,
                    )}
                  </DialogTitle>
                  <DialogContent dividers>
                    <Stack spacing={2}>
                      <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
                        <Paper variant="outlined" sx={{ p: 1.2, flex: 1 }}>
                          <Typography variant="caption" color="text.secondary">Plan</Typography>
                          <Typography fontWeight={700}>{subscriptionData?.plan_name || "No active plan"}</Typography>
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 1.2, flex: 1 }}>
                          <Typography variant="caption" color="text.secondary">Status</Typography>
                          <Typography fontWeight={700}>{toCellText(subscriptionData?.status)}</Typography>
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 1.2, flex: 1 }}>
                          <Typography variant="caption" color="text.secondary">Price</Typography>
                          <Typography fontWeight={700}>
                            {subscriptionData?.price !== undefined && subscriptionData?.price !== null
                              ? `${subscriptionData?.default_currency || "INR"} ${subscriptionData?.price}`
                              : "-"}
                          </Typography>
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 1.2, flex: 1 }}>
                          <Typography variant="caption" color="text.secondary">Validity</Typography>
                          <Typography fontWeight={700}>
                            {subscriptionData?.start_date ? new Date(subscriptionData.start_date).toLocaleDateString() : "-"}
                            {" - "}
                            {subscriptionData?.end_date ? new Date(subscriptionData.end_date).toLocaleDateString() : "-"}
                          </Typography>
                        </Paper>
                      </Stack>

                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", md: "center" }}
                        spacing={1.2}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Payments (this page): {filteredPaymentsRows.length}
                        </Typography>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                          <TextField
                            select
                            size="small"
                            label="Gateway"
                            value={paymentsGatewayFilter}
                            onChange={(event) => setPaymentsGatewayFilter(event.target.value)}
                            sx={{ minWidth: 150 }}
                          >
                            <MenuItem value="all">All Gateways</MenuItem>
                            {paymentGatewayOptions.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            size="small"
                            label="Search payments"
                            value={paymentsSearchInput}
                            onChange={(event) => setPaymentsSearchInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                setPaymentsOffset(0);
                                setPaymentsSearch(paymentsSearchInput.trim());
                              }
                            }}
                          />
                          <Button
                            variant="contained"
                            onClick={() => {
                              setPaymentsOffset(0);
                              setPaymentsSearch(paymentsSearchInput.trim());
                            }}
                          >
                            Search
                          </Button>
                        </Stack>
                      </Stack>

                      {subscriptionError ? <Alert severity="error">{subscriptionError}</Alert> : null}
                      {paymentsError ? <Alert severity="error">{paymentsError}</Alert> : null}
                      {subscriptionLoading || paymentsLoading ? (
                        <Stack alignItems="center" justifyContent="center" sx={{ py: 3 }}>
                          <CircularProgress size={24} />
                        </Stack>
                      ) : (
                        <>
                          <Box sx={{ height: { xs: 300, md: 420 } }}>
                            <DataGrid
                              rows={paymentGridRows}
                              columns={paymentColumns}
                              columnVisibilityModel={paymentColumnVisibilityModel}
                              getRowId={(row) => row.__rowKey}
                              disableRowSelectionOnClick
                              hideFooter
                              pageSizeOptions={[RESOURCE_PAGE_SIZE]}
                              sx={{
                                "& .MuiDataGrid-cell": { fontSize: { xs: 12, md: 13 } },
                                "& .MuiDataGrid-columnHeaderTitle": { fontSize: { xs: 12, md: 13 }, fontWeight: 700 },
                              }}
                            />
                          </Box>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => setPaymentsOffset((prev) => Math.max(prev - RESOURCE_PAGE_SIZE, 0))}
                              disabled={paymentsOffset === 0}
                            >
                              Previous
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                if (paymentsOffset + RESOURCE_PAGE_SIZE >= paymentsCount) return;
                                setPaymentsOffset((prev) => prev + RESOURCE_PAGE_SIZE);
                              }}
                              disabled={paymentsOffset + RESOURCE_PAGE_SIZE >= paymentsCount}
                            >
                              Next
                            </Button>
                          </Stack>
                        </>
                      )}
                    </Stack>
                  </DialogContent>
                  <DialogActions>
                    <Button variant="outlined" onClick={fetchSelectedOrganizationOverview}>
                      Refresh
                    </Button>
                    <Button onClick={() => setSubscriptionDialogOpen(false)}>Close</Button>
                  </DialogActions>
                </Dialog>
              ) : null}

              <Dialog
                open={memberViewOpen}
                onClose={() => setMemberViewOpen(false)}
                disableScrollLock
                fullWidth={false}
                maxWidth={false}
                PaperProps={{ sx: ownerDialogPaperSx }}
              >
                <DialogTitle>
                  {renderOwnerDialogHeading(
                    "Member Details",
                    memberViewRow
                      ? `${toCellText(memberViewRow.name)} (${toCellText(memberViewRow.email)})`
                      : "",
                  )}
                </DialogTitle>
                <DialogContent dividers>
                  {memberViewRow ? (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                        gap: 1.2,
                      }}
                    >
                      {[
                        { label: "Name", value: toCellText(memberViewRow.name) },
                        { label: "Email", value: toCellText(memberViewRow.email) },
                        { label: "Mobile", value: toCellText(memberViewRow.mobile || "-") },
                        { label: "Role", value: toCellText(memberViewRow.role_name || memberViewRow.role_key) },
                        { label: "Membership Status", value: toCellText(memberViewRow.membership_status) },
                        { label: "User Status", value: toCellText(memberViewRow.user_status) },
                        { label: "Organization", value: toCellText(selectedOrgName || selectedOrgDetails?.name || "-") },
                        { label: "Joined At", value: toDisplayValue(memberViewRow.joined_at, "joined_at") },
                        { label: "User ID", value: toCellText(memberViewRow.user_id) },
                        { label: "Membership ID", value: toCellText(memberViewRow.membership_id) },
                      ].map((item) => (
                        <Paper key={item.label} variant="outlined" sx={{ p: 1.25, borderRadius: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {item.label}
                          </Typography>
                          <Typography variant="body2" fontWeight={700} sx={{ mt: 0.4, wordBreak: "break-word" }}>
                            {item.value}
                          </Typography>
                        </Paper>
                      ))}
                    </Box>
                  ) : (
                    <Alert severity="info">No member selected.</Alert>
                  )}
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setMemberViewOpen(false)}>Close</Button>
                </DialogActions>
              </Dialog>

              <Dialog
                open={memberEditOpen}
                onClose={() => !memberEditSaving && setMemberEditOpen(false)}
                disableScrollLock
                fullWidth={false}
                maxWidth={false}
                PaperProps={{ sx: ownerDialogPaperSx }}
              >
                <DialogTitle>
                  {renderOwnerDialogHeading(
                    "Update Member",
                    memberEditRow
                      ? `${toCellText(memberEditRow.name)} (${toCellText(memberEditRow.email)})`
                      : "",
                  )}
                </DialogTitle>
                <DialogContent dividers>
                  <Stack spacing={1.4} sx={{ pt: 0.5 }}>
                    {memberEditError ? <Alert severity="error">{memberEditError}</Alert> : null}
                    {rolesError ? <Alert severity="warning">{rolesError}</Alert> : null}
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Role"
                      value={memberEditForm.role_id}
                      onChange={(event) => {
                        setMemberEditForm((prev) => ({ ...prev, role_id: event.target.value }));
                      }}
                      disabled={memberEditSaving || rolesLoading}
                    >
                      {roleOptions.map((role) => (
                        <MenuItem key={role.value} value={String(role.value)}>
                          {role.label}
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Membership Status"
                      value={memberEditForm.membership_status}
                      onChange={(event) => {
                        setMemberEditForm((prev) => ({ ...prev, membership_status: event.target.value }));
                      }}
                      disabled={memberEditSaving}
                    >
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="invited">Invited</MenuItem>
                      <MenuItem value="suspended">Suspended</MenuItem>
                      <MenuItem value="left">Left</MenuItem>
                    </TextField>
                  </Stack>
                </DialogContent>
                <DialogActions>
                  <Button variant="outlined" onClick={fetchRoleOptions} disabled={rolesLoading || memberEditSaving}>
                    {rolesLoading ? "Loading roles..." : "Refresh Roles"}
                  </Button>
                  <Button onClick={() => setMemberEditOpen(false)} disabled={memberEditSaving}>
                    Cancel
                  </Button>
                  <Button variant="contained" onClick={handleSaveMemberUpdate} disabled={memberEditSaving}>
                    {memberEditSaving ? "Updating..." : "Update"}
                  </Button>
                </DialogActions>
              </Dialog>

              <Dialog
                open={createOwnerOpen}
                onClose={() => !createOwnerSaving && setCreateOwnerOpen(false)}
                disableScrollLock
                fullWidth={false}
                maxWidth={false}
                PaperProps={{ sx: ownerDialogPaperSx }}
              >
                <DialogTitle>{renderOwnerDialogHeading("Create New Owner")}</DialogTitle>
                <DialogContent dividers>
                  <Stack spacing={1.25} sx={{ pt: 0.5 }}>
                    {createOwnerError ? <Alert severity="error">{createOwnerError}</Alert> : null}
                    {createOwnerSuccess ? <Alert severity="success">{createOwnerSuccess}</Alert> : null}
                    <Box
                      sx={{
                        display: "grid",
                        gap: 1.25,
                        gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                      }}
                    >
                      <TextField
                        size="small"
                        label="Company Name"
                        placeholder="Enter company name"
                        value={createOwnerForm.company_name}
                        onChange={(event) => setCreateOwnerForm((prev) => ({ ...prev, company_name: event.target.value }))}
                        disabled={createOwnerSaving}
                        required
                      />
                      <TextField
                        size="small"
                        label="Owner Name"
                        placeholder="Enter owner name"
                        value={createOwnerForm.owner_name}
                        onChange={(event) => setCreateOwnerForm((prev) => ({ ...prev, owner_name: event.target.value }))}
                        disabled={createOwnerSaving}
                        required
                      />
                      <TextField
                        size="small"
                        label="Business Email"
                        type="email"
                        placeholder="Enter business email"
                        value={createOwnerForm.email}
                        onChange={(event) => setCreateOwnerForm((prev) => ({ ...prev, email: event.target.value }))}
                        disabled={createOwnerSaving}
                        required
                      />
                      <TextField
                        size="small"
                        label="Phone (10 digits)"
                        placeholder="Enter phone number"
                        value={createOwnerForm.phone}
                        onChange={(event) => setCreateOwnerForm((prev) => ({ ...prev, phone: event.target.value }))}
                        disabled={createOwnerSaving}
                        required
                      />
                      <TextField
                        size="small"
                        label="Password"
                        type="password"
                        placeholder="Enter password"
                        value={createOwnerForm.password}
                        onChange={(event) => setCreateOwnerForm((prev) => ({ ...prev, password: event.target.value }))}
                        disabled={createOwnerSaving}
                        required
                        sx={{ gridColumn: { xs: "span 1", md: "span 2" } }}
                      />
                    </Box>
                  </Stack>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setCreateOwnerOpen(false)} disabled={createOwnerSaving}>
                    Cancel
                  </Button>
                  <Button variant="contained" onClick={handleCreateOwnerSubmit} disabled={createOwnerSaving}>
                    {createOwnerSaving ? "Creating..." : "Create Owner"}
                  </Button>
                </DialogActions>
              </Dialog>

              <Dialog
                open={paymentViewOpen}
                onClose={() => setPaymentViewOpen(false)}
                disableScrollLock
                fullWidth={false}
                maxWidth={false}
                sx={{
                  "& .MuiDialog-container": {
                    p: { xs: 1.5, md: 2.5 },
                    pl: { md: "300px" },
                    pr: { md: "40px" },
                  },
                }}
                PaperProps={{
                  sx: ownerDialogPaperSx,
                }}
              >
                <DialogTitle>
                  {renderOwnerDialogHeading(
                    "Payment Details",
                    selectedOrgName || `Organization #${selectedOrgId}`,
                  )}
                </DialogTitle>
                <DialogContent dividers>
                  {selectedPaymentRow ? (
                    <Stack spacing={2}>
                      <Paper
                        variant="outlined"
                        sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, rgba(30,64,175,0.12), rgba(59,130,246,0.08))" }}
                      >
                        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.25}>
                          <Stack spacing={0.4}>
                            <Typography variant="caption" color="text.secondary">Invoice</Typography>
                            <Typography variant="h5" fontWeight={800}>
                              {toCellText(selectedPaymentRow.invoice_number || `INV-${selectedPaymentRow.payment_id || "-"}`)}
                            </Typography>
                            <Typography color="text.secondary">
                              {toCellText(selectedPaymentRow.plan_name)} for {toCellText(selectedOrgName)}
                            </Typography>
                          </Stack>
                          <Stack spacing={0.4} alignItems={{ xs: "flex-start", md: "flex-end" }}>
                            {renderStatusChip(selectedPaymentRow.payment_status)}
                            <Typography variant="caption" color="text.secondary">
                              Paid on {formatDateTime(selectedPaymentRow.payment_date)}
                            </Typography>
                            <Typography variant="h4" fontWeight={800}>
                              {(selectedPaymentRow.currency_code || "INR")} {toCellText(selectedPaymentRow.amount)}
                            </Typography>
                          </Stack>
                        </Stack>
                      </Paper>

                      <Box
                        sx={{
                          display: "grid",
                          gap: 2,
                          gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                        }}
                      >
                        <Paper variant="outlined" sx={{ p: 1.6, borderRadius: 2 }}>
                          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Invoice & Subscription</Typography>
                          <Stack spacing={0.9}>
                            <Typography variant="body2"><b>Invoice Number:</b> {toCellText(selectedPaymentRow.invoice_number)}</Typography>
                            <Typography variant="body2"><b>Invoice Date:</b> {formatDateTime(selectedPaymentRow.payment_date)}</Typography>
                            <Typography variant="body2"><b>Plan:</b> {toCellText(selectedPaymentRow.plan_name)}</Typography>
                            <Typography variant="body2"><b>Users / Cycle:</b> {toCellText(selectedPaymentRow.user_count)} / {toCellText(selectedPaymentRow.billing_type)}</Typography>
                            <Typography variant="body2"><b>Status:</b> {toCellText(selectedPaymentRow.payment_status)}</Typography>
                            <Typography variant="body2"><b>Transaction ID:</b> {toCellText(selectedPaymentRow.transaction_id)}</Typography>
                          </Stack>
                        </Paper>

                        <Paper variant="outlined" sx={{ p: 1.6, borderRadius: 2 }}>
                          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Amount Summary</Typography>
                          <Stack spacing={0.9}>
                            <Typography variant="body2">
                              <b>Sub Total:</b> {(selectedPaymentRow.currency_code || "INR")} {toCellText(selectedPaymentRow.amount)}
                            </Typography>
                            <Typography variant="body2">
                              <b>Discount:</b> {(selectedPaymentRow.currency_code || "INR")} {toCellText(selectedPaymentRow.discount_amount || 0)}
                            </Typography>
                            <Typography variant="h5" fontWeight={800} sx={{ mt: 0.6 }}>
                              Grand Total: {(selectedPaymentRow.currency_code || "INR")}{" "}
                              {(() => {
                                const amount = Number(selectedPaymentRow.amount || 0);
                                const discount = Number(selectedPaymentRow.discount_amount || 0);
                                return (amount - discount).toFixed(2);
                              })()}
                            </Typography>
                            <Box sx={{ pt: 0.4 }}>
                              <Typography variant="caption" color="text.secondary">Currency</Typography>
                              <Typography variant="body1" fontWeight={700}>
                                {toCellText(selectedPaymentRow.currency_code || "INR")}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary">Method</Typography>
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                                {getGatewayIconUrl(selectedPaymentRow.payment_method || selectedPaymentRow.gateway || "N/A") ? (
                                  <Box
                                    component="img"
                                    src={getGatewayIconUrl(selectedPaymentRow.payment_method || selectedPaymentRow.gateway || "N/A")}
                                    alt={toDisplayLabel(getPrimaryGateway(selectedPaymentRow.payment_method || selectedPaymentRow.gateway || "N/A"))}
                                    sx={{
                                      width: 24,
                                      height: 24,
                                      borderRadius: 1,
                                      border: "1px solid",
                                      borderColor: "divider",
                                      p: 0.2,
                                      backgroundColor: "#fff",
                                    }}
                                  />
                                ) : null}
                                <Typography variant="body1" fontWeight={700}>
                                  {toDisplayLabel(getPrimaryGateway(selectedPaymentRow.payment_method || selectedPaymentRow.gateway || "N/A"))}
                                </Typography>
                              </Stack>
                            </Box>
                            <Typography variant="body2"><b>Billing Name:</b> {toCellText(selectedPaymentRow.billing_name)}</Typography>
                            <Typography variant="body2"><b>Billing Email:</b> {toCellText(selectedPaymentRow.billing_email)}</Typography>
                            <Typography variant="body2"><b>Country/State:</b> {toCellText(selectedPaymentRow.country)} / {toCellText(selectedPaymentRow.state)}</Typography>
                          </Stack>
                        </Paper>
                      </Box>
                    </Stack>
                  ) : (
                    <Alert severity="info">No payment record selected.</Alert>
                  )}
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setPaymentViewOpen(false)}>Close</Button>
                  {canOwnerCompletePayment(selectedPaymentRow) ? (
                    <Button
                      color="success"
                      variant="contained"
                      startIcon={<FiCreditCard size={14} />}
                      onClick={() => handleOpenOwnerPay(selectedPaymentRow)}
                    >
                      Complete Payment
                    </Button>
                  ) : null}
                  <Button
                    variant="contained"
                    startIcon={<FiDownload size={14} />}
                    onClick={() => handleDownloadInvoice(selectedPaymentRow)}
                    disabled={!selectedPaymentRow}
                  >
                    Download Invoice
                  </Button>
                </DialogActions>
              </Dialog>

              <Dialog
                open={ownerPayOpen}
                onClose={() => {
                  if (ownerPaySaving) return;
                  setOwnerPayOpen(false);
                }}
                disableScrollLock
                fullWidth={false}
                maxWidth={false}
                PaperProps={{ sx: ownerDialogPaperSx }}
              >
                <DialogTitle>{renderOwnerDialogHeading("Complete Payment as Owner")}</DialogTitle>
                <DialogContent dividers>
                  <Stack spacing={1.4} sx={{ pt: 0.4 }}>
                    {ownerPayError ? <Alert severity="error">{ownerPayError}</Alert> : null}
                    {ownerPaySuccess ? <Alert severity="success">{ownerPaySuccess}</Alert> : null}
                    <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1.5 }}>
                      <Typography variant="body2"><b>Invoice:</b> {toCellText(ownerPayRow?.invoice_number)}</Typography>
                      <Typography variant="body2"><b>Status:</b> {toCellText(ownerPayRow?.payment_status)}</Typography>
                      <Typography variant="body2"><b>Amount:</b> {(ownerPayRow?.currency_code || "INR")} {toCellText(ownerPayRow?.amount)}</Typography>
                      <Typography variant="body2"><b>Plan:</b> {toCellText(ownerPayRow?.plan_name)}</Typography>
                      <Typography variant="body2"><b>Users:</b> {toCellText(ownerPayRow?.user_count)}</Typography>
                    </Paper>
                    <TextField
                      select
                      size="small"
                      label="Plan"
                      value={ownerPayForm.plan_id}
                      onChange={(event) => {
                        const nextPlanId = String(event.target.value || "");
                        const selectedPlan = ownerPayPlanOptions.find((item) => String(item.value) === nextPlanId);
                        setOwnerPayForm((prev) => ({
                          ...prev,
                          plan_id: nextPlanId,
                          amount:
                            selectedPlan && Number.isFinite(selectedPlan.price) && selectedPlan.price > 0
                              ? String(selectedPlan.price)
                              : prev.amount,
                        }));
                      }}
                      disabled={ownerPaySaving || ownerPayPlansLoading}
                      required
                    >
                      {!ownerPayPlanOptions.length ? (
                        <MenuItem value="" disabled>
                          {ownerPayPlansLoading ? "Loading plans..." : "No plans available"}
                        </MenuItem>
                      ) : null}
                      {ownerPayPlanOptions.map((option) => (
                        <MenuItem key={option.value} value={String(option.value)}>
                          {option.label} {Number.isFinite(option.price) ? `(${option.currency} ${option.price})` : ""}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                      <TextField
                        size="small"
                        type="number"
                        label="Price"
                        placeholder="Enter amount"
                        value={ownerPayForm.amount}
                        onChange={(event) => setOwnerPayForm((prev) => ({ ...prev, amount: event.target.value }))}
                        disabled={ownerPaySaving}
                        required
                        fullWidth
                        inputProps={{ min: 1, step: "0.01" }}
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Users"
                        placeholder="Enter users count"
                        value={ownerPayForm.user_count}
                        onChange={(event) => setOwnerPayForm((prev) => ({ ...prev, user_count: event.target.value }))}
                        disabled={ownerPaySaving}
                        required
                        fullWidth
                        inputProps={{ min: 1, step: 1 }}
                      />
                    </Stack>
                    <TextField
                      select
                      size="small"
                      label="Gateway"
                      placeholder="Select payment gateway"
                      value={ownerPayForm.gateway}
                      onChange={(event) => setOwnerPayForm((prev) => ({ ...prev, gateway: event.target.value }))}
                      disabled={ownerPaySaving}
                      required
                    >
                      <MenuItem value="stripe">Stripe</MenuItem>
                      <MenuItem value="paypal">Paypal</MenuItem>
                      <MenuItem value="razorpay">Razorpay</MenuItem>
                      <MenuItem value="upi">UPI</MenuItem>
                      <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                      <MenuItem value="cash">Cash</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </TextField>
                    <TextField
                      size="small"
                      label="Transaction ID"
                      placeholder="Enter confirmed transaction ID"
                      value={ownerPayForm.transaction_id}
                      onChange={(event) => setOwnerPayForm((prev) => ({ ...prev, transaction_id: event.target.value }))}
                      disabled={ownerPaySaving}
                      required
                    />
                    <TextField
                      size="small"
                      label="Note (optional)"
                      placeholder="Recovery note for audit log"
                      value={ownerPayForm.note}
                      onChange={(event) => setOwnerPayForm((prev) => ({ ...prev, note: event.target.value }))}
                      disabled={ownerPaySaving}
                      multiline
                      minRows={2}
                    />
                  </Stack>
                </DialogContent>
                <DialogActions>
                  <Button
                    onClick={() => setOwnerPayOpen(false)}
                    disabled={ownerPaySaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    color="success"
                    variant="contained"
                    startIcon={<FiCreditCard size={14} />}
                    onClick={handleSubmitOwnerPay}
                    disabled={ownerPaySaving}
                  >
                    {ownerPaySaving ? "Processing..." : "Complete Payment"}
                  </Button>
                </DialogActions>
              </Dialog>

            </Stack>
          ) : null}

          {OWNER_MODULES[activeSection] ? (
            <ResourcePanel
              moduleConfig={OWNER_MODULES[activeSection]}
              currentRoleId={currentRoleId}
              dialogSize={ownerDialogSize}
              onDialogSizeChange={setOwnerDialogSize}
            />
          ) : null}

          {activeSection === "smtp-settings" ? <SmtpSettingsPanel /> : null}

          {activeSection === "socket-dashboard" ? (
            <SocketDashboardPanel ownerUi={ownerUi} />
          ) : null}

          {activeSection === "system-health" ? (
            <SystemHealthPanel ownerUi={ownerUi} />
          ) : null}

          {activeSection === "ai-providers" ? (
            <AiProvidersPanel ownerUi={ownerUi} />
          ) : null}
        </Stack>
      </Box>
    </Stack>
  );
};

// ─── Socket Dashboard Panel ──────────────────────────────────────────────────
const SocketDashboardPanel = ({ ownerUi }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = useCallback(async () => {
    try {
      const result = await fetchWithAuth(`${API_BASE_URL}/auth/owner/v1/system/socket-stats`);
      const response = result?.response;
      const data = result?.data;
      if (!response?.ok) throw new Error(data?.message || `HTTP ${response?.status || "?"}`);
      const resolved = data?.data || data || {};
      setStats(resolved);
      setError("");
    } catch (err) {
      console.error("[SocketDashboard] fetch error:", err);
      setError(err?.message || "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) return <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={32} /></Box>;
  if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  if (!stats) return <Alert severity="info" sx={{ m: 2 }}>No stats available</Alert>;

  const s = stats.socket || {};
  const dark = ownerUi.isDark;

  const StatCard = ({ label, value, sub }) => (
    <Paper sx={{ p: 2, borderRadius: 2, bgcolor: ownerUi.cardBg, border: "1px solid", borderColor: ownerUi.cardBorder, flex: 1, minWidth: 140 }}>
      <Typography variant="caption" sx={{ color: ownerUi.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Typography>
      <Typography variant="h4" sx={{ fontWeight: 800, color: ownerUi.accentText, mt: 0.5 }}>{value}</Typography>
      {sub ? <Typography variant="caption" sx={{ color: ownerUi.textSecondary }}>{sub}</Typography> : null}
    </Paper>
  );

  return (
    <Stack spacing={2}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: ownerUi.textPrimary }}>Socket Dashboard</Typography>

      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2 }}>
        <StatCard label="Total Connections" value={s.totalConnections || 0} sub="Active socket connections (all tabs)" />
        <StatCard label="Users Online" value={s.uniqueUsersOnline || 0} sub="Unique users connected" />
        <StatCard label="Socket Rooms" value={s.roomStats?.totalRooms || 0} sub={`Org: ${s.roomStats?.orgRooms || 0} | User: ${s.roomStats?.userRooms || 0} | Group: ${s.roomStats?.groupRooms || 0}`} />
      </Stack>

      {s.connectionsByOrg && Object.keys(s.connectionsByOrg).length > 0 ? (
        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: ownerUi.cardBg, border: "1px solid", borderColor: ownerUi.cardBorder }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: ownerUi.textPrimary, mb: 1 }}>Connections by Organization</Typography>
          <Stack spacing={0.5}>
            {Object.entries(s.connectionsByOrg).map(([orgId, count]) => (
              <Stack key={orgId} direction="row" justifyContent="space-between" sx={{ px: 1, py: 0.5, borderRadius: 1, bgcolor: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}>
                <Typography variant="body2" sx={{ color: ownerUi.textPrimary }}>Org #{orgId}</Typography>
                <Chip size="small" label={`${count} connections`} sx={{ bgcolor: ownerUi.accentSoft, color: ownerUi.accentText, fontWeight: 600 }} />
              </Stack>
            ))}
          </Stack>
        </Paper>
      ) : null}

      {s.usersList?.length > 0 ? (
        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: ownerUi.cardBg, border: "1px solid", borderColor: ownerUi.cardBorder }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: ownerUi.textPrimary, mb: 1 }}>Connected Users ({s.usersList.length})</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: ownerUi.textSecondary, fontWeight: 600 }}>User ID</TableCell>
                  <TableCell sx={{ color: ownerUi.textSecondary, fontWeight: 600 }}>Tabs</TableCell>
                  <TableCell sx={{ color: ownerUi.textSecondary, fontWeight: 600 }}>Active Thread</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {s.usersList.map((u) => (
                  <TableRow key={u.userId}>
                    <TableCell sx={{ color: ownerUi.textPrimary }}>{u.userId}</TableCell>
                    <TableCell><Chip size="small" label={u.tabs} sx={{ bgcolor: ownerUi.accentSoft, color: ownerUi.accentText }} /></TableCell>
                    <TableCell sx={{ color: ownerUi.textSecondary }}>{u.activeThread || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : null}

      {stats.database ? (
        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: ownerUi.cardBg, border: "1px solid", borderColor: ownerUi.cardBorder }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: ownerUi.textPrimary, mb: 1 }}>Message Stats</Typography>
          <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 1 }}>
            <StatCard label="Messages (24h)" value={stats.database.messages?.last24h || 0} sub={`DM: ${stats.database.messages?.dm24h || 0} | Group: ${stats.database.messages?.group24h || 0}`} />
            <StatCard label="Total Messages" value={stats.database.messages?.total || 0} sub={`DM: ${stats.database.messages?.dmTotal || 0} | Group: ${stats.database.messages?.groupTotal || 0}`} />
          </Stack>
        </Paper>
      ) : null}

      {stats.database?.topActiveOrgs?.length > 0 ? (
        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: ownerUi.cardBg, border: "1px solid", borderColor: ownerUi.cardBorder }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: ownerUi.textPrimary, mb: 1 }}>Top Active Organizations (24h)</Typography>
          <Stack spacing={0.5}>
            {stats.database.topActiveOrgs.map((org) => (
              <Stack key={org.organizationId} direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1, py: 0.5, borderRadius: 1, bgcolor: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}>
                <Typography variant="body2" sx={{ color: ownerUi.textPrimary }}>{org.name}</Typography>
                <Chip size="small" label={`${org.messagesLast24h} msgs`} sx={{ bgcolor: ownerUi.accentSoft, color: ownerUi.accentText, fontWeight: 600 }} />
              </Stack>
            ))}
          </Stack>
        </Paper>
      ) : null}

      <Typography variant="caption" sx={{ color: ownerUi.textSecondary }}>Auto-refreshes every 10 seconds • {stats.timestamp ? new Date(stats.timestamp).toLocaleString() : ""}</Typography>
    </Stack>
  );
};

// ─── System Health Panel ─────────────────────────────────────────────────────
const SystemHealthPanel = ({ ownerUi }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const result = await fetchWithAuth(`${API_BASE_URL}/auth/owner/v1/system/socket-stats`);
      const response = result?.response;
      const data = result?.data;
      if (response?.ok) setStats(data?.data || data || {});
    } catch (err) {
      console.error("[SystemHealth] fetch error:", err);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) return <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={32} /></Box>;
  if (!stats) return <Alert severity="info" sx={{ m: 2 }}>No stats available</Alert>;

  const sys = stats.system || {};
  const db = stats.database || {};
  const dark = ownerUi.isDark;

  const InfoRow = ({ label, value }) => (
    <Stack direction="row" justifyContent="space-between" sx={{ px: 1.5, py: 0.8, borderRadius: 1, bgcolor: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}>
      <Typography variant="body2" sx={{ color: ownerUi.textSecondary }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, color: ownerUi.textPrimary }}>{value}</Typography>
    </Stack>
  );

  return (
    <Stack spacing={2}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: ownerUi.textPrimary }}>System Health</Typography>

      <Paper sx={{ p: 2, borderRadius: 2, bgcolor: ownerUi.cardBg, border: "1px solid", borderColor: ownerUi.cardBorder }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: ownerUi.textPrimary, mb: 1 }}>Server</Typography>
        <Stack spacing={0.5}>
          <InfoRow label="Uptime" value={sys.serverUptimeFormatted || "—"} />
          <InfoRow label="Node.js" value={sys.nodeVersion || "—"} />
          <InfoRow label="Platform" value={`${sys.platform || "—"} (${sys.arch || "—"})`} />
          <InfoRow label="Process ID" value={sys.pid || "—"} />
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, borderRadius: 2, bgcolor: ownerUi.cardBg, border: "1px solid", borderColor: ownerUi.cardBorder }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: ownerUi.textPrimary, mb: 1 }}>Memory Usage</Typography>
        <Stack spacing={0.5}>
          <InfoRow label="RSS (Total)" value={sys.memoryUsage?.rss || "—"} />
          <InfoRow label="Heap Used" value={sys.memoryUsage?.heapUsed || "—"} />
          <InfoRow label="Heap Total" value={sys.memoryUsage?.heapTotal || "—"} />
          <InfoRow label="External" value={sys.memoryUsage?.external || "—"} />
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, borderRadius: 2, bgcolor: ownerUi.cardBg, border: "1px solid", borderColor: ownerUi.cardBorder }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: ownerUi.textPrimary, mb: 1 }}>Database Overview</Typography>
        <Stack spacing={0.5}>
          <InfoRow label="Total Users" value={db.users?.total || 0} />
          <InfoRow label="Active Users" value={db.users?.active || 0} />
          <InfoRow label="Organizations" value={`${db.organizations?.active || 0} active / ${db.organizations?.total || 0} total`} />
          <InfoRow label="Registered Devices" value={db.devices?.total || 0} />
          <InfoRow label="Active Sessions" value={db.sessions?.active || 0} />
        </Stack>
      </Paper>

      <Typography variant="caption" sx={{ color: ownerUi.textSecondary }}>Auto-refreshes every 15 seconds • {stats.timestamp ? new Date(stats.timestamp).toLocaleString() : ""}</Typography>
    </Stack>
  );
};

// ─── AI Providers Panel ─────────────────────────────────────────────────────
const AiProvidersPanel = ({ ownerUi }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const cardBg = isDark ? "rgba(15,23,42,0.82)" : "#ffffff";
  const cardBorder = isDark ? "rgba(71,85,105,0.45)" : "rgba(148,163,184,0.3)";

  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [editDialog, setEditDialog] = useState({ open: false, provider: null });
  const [editForm, setEditForm] = useState({ api_key: "", model: "" });

  const loadProviders = useCallback(() => {
    setLoading(true);
    setError("");
    fetchWithAuth(`${API_BASE_URL}/ai-providers`)
      .then(({ response, payload }) => {
        if (!response.ok) { setError(payload?.message || "Failed to load"); return; }
        setProviders(payload?.data?.providers || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadProviders(); }, [loadProviders]);

  const handleActivate = async (providerId) => {
    setSaving(providerId);
    setError("");
    setSuccessMsg("");
    try {
      const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/ai-providers/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      });
      if (!response.ok) throw new Error(payload?.message || "Failed to activate");
      setSuccessMsg(`${payload?.data?.provider?.display_name || "Provider"} activated`);
      loadProviders();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleDeactivate = async (providerId) => {
    setSaving(providerId);
    setError("");
    try {
      const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/ai-providers/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      });
      if (!response.ok) throw new Error(payload?.message || "Failed");
      loadProviders();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const openEditDialog = (provider) => {
    setEditForm({ api_key: "", model: provider.model || "" });
    setEditDialog({ open: true, provider });
  };

  const handleSaveEdit = async () => {
    const p = editDialog.provider;
    if (!p) return;
    setSaving(p.provider_id);
    setError("");
    setSuccessMsg("");
    try {
      const body = { model: editForm.model };
      if (editForm.api_key) body.api_key = editForm.api_key;
      const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/ai-providers/${p.provider_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(payload?.message || "Failed to save");
      setSuccessMsg(`${p.display_name} updated`);
      setEditDialog({ open: false, provider: null });
      loadProviders();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const providerColors = {
    gemini: { bg: "#e8f5e9", color: "#2e7d32", border: "#a5d6a7" },
    openai: { bg: "#e3f2fd", color: "#1565c0", border: "#90caf9" },
    anthropic: { bg: "#fce4ec", color: "#c62828", border: "#ef9a9a" },
  };

  const providerLogos = {
    gemini: "G",
    openai: "O",
    anthropic: "C",
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6" sx={{ fontWeight: 700, color: ownerUi?.textPrimary }}>
          AI Providers
        </Typography>
        <Chip label="Only one provider can be active" size="small" sx={{ bgcolor: ownerUi?.accentSoft, color: ownerUi?.accentText }} />
      </Stack>

      {error ? <Alert severity="error" onClose={() => setError("")}>{error}</Alert> : null}
      {successMsg ? <Alert severity="success" onClose={() => setSuccessMsg("")}>{successMsg}</Alert> : null}

      {loading ? (
        <Stack alignItems="center" py={6}><CircularProgress /></Stack>
      ) : (
        <Stack spacing={2}>
          {providers.map((p) => {
            const colors = providerColors[p.provider_key] || providerColors.gemini;
            const isActive = p.is_active && p.status === "active";
            return (
              <Paper
                key={p.provider_id}
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  bgcolor: cardBg,
                  border: `1.5px solid ${isActive ? colors.border : cardBorder}`,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {isActive ? (
                  <Box sx={{
                    position: "absolute", top: 0, left: 0, right: 0, height: 3,
                    background: `linear-gradient(90deg, ${colors.color}, ${colors.border})`,
                  }} />
                ) : null}

                <Stack direction="row" spacing={2} alignItems="center">
                  {/* Logo */}
                  <Avatar
                    sx={{
                      width: 48, height: 48,
                      bgcolor: isActive ? colors.bg : (isDark ? "rgba(100,116,139,0.2)" : "#f1f5f9"),
                      color: isActive ? colors.color : (isDark ? "#94a3b8" : "#64748b"),
                      fontWeight: 800, fontSize: 20,
                    }}
                  >
                    {providerLogos[p.provider_key] || "?"}
                  </Avatar>

                  {/* Info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: ownerUi?.textPrimary }}>
                        {p.display_name}
                      </Typography>
                      <Chip
                        label={isActive ? "Active" : "Inactive"}
                        size="small"
                        sx={{
                          fontWeight: 600, fontSize: 11,
                          bgcolor: isActive ? colors.bg : (isDark ? "rgba(100,116,139,0.2)" : "#f1f5f9"),
                          color: isActive ? colors.color : (isDark ? "#94a3b8" : "#94a3b8"),
                        }}
                      />
                    </Stack>
                    <Stack direction="row" spacing={3} mt={0.5}>
                      <Typography variant="caption" sx={{ color: isDark ? "#94a3b8" : "#64748b" }}>
                        Model: <b>{p.model || "—"}</b>
                      </Typography>
                      <Typography variant="caption" sx={{ color: isDark ? "#94a3b8" : "#64748b" }}>
                        API Key: <b>{p.api_key_masked || "Not set"}</b>
                      </Typography>
                    </Stack>
                  </Box>

                  {/* Actions */}
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<FiEdit2 size={14} />}
                      onClick={() => openEditDialog(p)}
                      sx={{ textTransform: "none", fontSize: 12 }}
                    >
                      Configure
                    </Button>
                    {isActive ? (
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => handleDeactivate(p.provider_id)}
                        disabled={saving === p.provider_id}
                        sx={{ textTransform: "none", fontSize: 12 }}
                      >
                        {saving === p.provider_id ? "..." : "Deactivate"}
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleActivate(p.provider_id)}
                        disabled={saving === p.provider_id || !p.api_key_masked}
                        sx={{
                          textTransform: "none", fontSize: 12,
                          bgcolor: colors.color,
                          "&:hover": { bgcolor: alpha(colors.color, 0.85) },
                        }}
                      >
                        {saving === p.provider_id ? "..." : "Activate"}
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onClose={() => setEditDialog({ open: false, provider: null })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Configure {editDialog.provider?.display_name}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="API Key"
              type="password"
              value={editForm.api_key}
              onChange={(e) => setEditForm((prev) => ({ ...prev, api_key: e.target.value }))}
              placeholder={editDialog.provider?.api_key_masked ? "Leave empty to keep current key" : "Enter API key"}
              fullWidth
              helperText={editDialog.provider?.api_key_masked ? "Current key is set. Enter new key to replace, or leave empty to keep." : "Required to activate this provider."}
            />
            <TextField
              label="Model"
              value={editForm.model}
              onChange={(e) => setEditForm((prev) => ({ ...prev, model: e.target.value }))}
              fullWidth
              helperText={
                editDialog.provider?.provider_key === "gemini" ? "e.g. gemini-2.0-flash, gemma-3-4b-it" :
                editDialog.provider?.provider_key === "openai" ? "e.g. gpt-4o-mini, gpt-4o, gpt-4-turbo" :
                editDialog.provider?.provider_key === "anthropic" ? "e.g. claude-sonnet-4-6, claude-haiku-4-5-20251001" : ""
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditDialog({ open: false, provider: null })} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={saving !== null} sx={{ textTransform: "none" }}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default OwnerDashboard;

