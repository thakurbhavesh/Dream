import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  FiRefreshCw,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiAlertTriangle,
  FiMail,
  FiPhone,
  FiEye,
  FiEyeOff,
  FiCopy,
  FiSearch,
  FiShield,
  FiActivity,
} from "react-icons/fi";
import { API_BASE_URL } from "../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../utils/authApi";

const STATUS_CONFIG = {
  verified: { label: "Verified", color: "#16a34a", icon: FiCheckCircle },
  pending: { label: "Pending", color: "#2563eb", icon: FiClock },
  expired: { label: "Expired", color: "#94a3b8", icon: FiAlertTriangle },
  failed: { label: "Failed", color: "#dc2626", icon: FiXCircle },
};

const PURPOSE_LABELS = {
  verification: "Account Verification",
  login: "Login",
  password_reset: "Password Reset",
  forgot_password: "Forgot Password",
  email_change: "Email Change",
  phone_change: "Phone Change",
};

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "verified", label: "Verified" },
  { value: "pending", label: "Pending" },
  { value: "expired", label: "Expired" },
  { value: "failed", label: "Failed" },
];

const formatDateAbs = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const formatRelative = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const initialsOf = (name, identifier) => {
  const source = String(name || identifier || "?").trim();
  if (!source) return "?";
  const parts = source.split(/[\s@]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const StatCard = ({ icon: Icon, label, value, color, isDark }) => (
  <Paper
    variant="outlined"
    sx={{
      flex: 1,
      minWidth: 120,
      p: 1.75,
      borderRadius: 2,
      borderColor: alpha(color, 0.2),
      bgcolor: alpha(color, isDark ? 0.08 : 0.04),
      display: "flex",
      alignItems: "center",
      gap: 1.5,
    }}
  >
    <Box
      sx={{
        width: 36,
        height: 36,
        borderRadius: 1.5,
        bgcolor: alpha(color, 0.15),
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon size={18} />
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.1 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
    </Box>
  </Paper>
);

const OtpVerifications = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canViewOtp, setCanViewOtp] = useState(false);
  const [hidden, setHidden] = useState(() => new Set()); // otp_ids the super-admin chose to hide
  const [copiedId, setCopiedId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/auth/otp-logs`);
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load OTP verifications");
      }
      const data = payload?.data ?? payload;
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setCanViewOtp(Boolean(data?.canViewOtp));
    } catch (err) {
      setError(err.message || "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleHide = useCallback((id) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const copyCode = useCallback((id, code) => {
    if (!code || code === "••••••") return;
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1500);
  }, []);

  const stats = useMemo(() => {
    const acc = { total: rows.length, verified: 0, pending: 0, failed: 0, expired: 0 };
    for (const r of rows) {
      const s = String(r.status || "").toLowerCase();
      if (acc[s] !== undefined) acc[s]++;
    }
    return acc;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter && String(r.status).toLowerCase() !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        r.name,
        r.email,
        r.identifier,
        r.purpose,
        r.ip_address,
        r.otp_code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search, statusFilter]);

  const columns = useMemo(() => [
    {
      field: "user",
      headerName: "User",
      flex: 1.3,
      minWidth: 240,
      sortable: false,
      renderCell: (params) => {
        const r = params.row;
        return (
          <Stack direction="row" spacing={1.4} alignItems="center" sx={{ width: "100%", py: 0.5 }}>
            <Avatar
              src={r.profile_url || undefined}
              sx={{
                width: 36,
                height: 36,
                bgcolor: alpha(theme.palette.primary.main, 0.18),
                color: theme.palette.primary.main,
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initialsOf(r.name, r.identifier)}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="body2"
                fontWeight={600}
                noWrap
                sx={{ lineHeight: 1.3, mb: 0.25 }}
              >
                {r.name || (r.user_id ? `User #${r.user_id}` : "Pre-registration")}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ display: "block", lineHeight: 1.3 }}
              >
                {r.identifier || r.email || "—"}
              </Typography>
            </Box>
          </Stack>
        );
      },
    },
    {
      field: "type",
      headerName: "Channel",
      width: 110,
      sortable: false,
      renderCell: (params) => {
        const isEmail = String(params.value).toLowerCase() === "email";
        const Icon = isEmail ? FiMail : FiPhone;
        const color = isEmail ? "#2563eb" : "#10b981";
        return (
          <Chip
            size="small"
            icon={<Icon size={11} />}
            label={isEmail ? "Email" : "SMS"}
            sx={{
              fontSize: 11,
              fontWeight: 700,
              height: 22,
              borderRadius: 1,
              bgcolor: alpha(color, 0.12),
              color,
              "& .MuiChip-icon": { color: "inherit", marginLeft: "6px" },
            }}
          />
        );
      },
    },
    {
      field: "purpose",
      headerName: "Purpose",
      width: 170,
      sortable: false,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
          {PURPOSE_LABELS[params.value] || String(params.value || "—").replace(/_/g, " ")}
        </Typography>
      ),
    },
    {
      field: "otp_code",
      headerName: "OTP Code",
      width: 170,
      sortable: false,
      renderCell: (params) => {
        const id = params.row.otp_id;
        const masked = String(params.value || "");
        const isMaskedByServer = masked === "••••••";
        const isHidden = hidden.has(id);
        const showCode = canViewOtp && !isMaskedByServer && !isHidden;
        const display = showCode ? masked : "••••••";
        return (
          <Stack direction="row" spacing={0.25} alignItems="center" sx={{ width: "100%" }}>
            <Box
              sx={{
                px: 1.25,
                py: 0.4,
                borderRadius: 1,
                bgcolor: isDark ? alpha("#0f172a", 0.6) : alpha("#f8fafc", 0.8),
                border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                fontFamily: "monospace",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: showCode ? 2 : 1,
                color: isMaskedByServer ? "text.disabled" : (showCode ? theme.palette.primary.main : "text.secondary"),
              }}
            >
              {display}
            </Box>
            {!isMaskedByServer && canViewOtp && (
              <Tooltip title={isHidden ? "Reveal" : "Hide"}>
                <IconButton size="small" onClick={() => toggleHide(id)} sx={{ p: 0.4 }}>
                  {isHidden ? <FiEye size={13} /> : <FiEyeOff size={13} />}
                </IconButton>
              </Tooltip>
            )}
            {showCode && (
              <Tooltip title={copiedId === id ? "Copied!" : "Copy"}>
                <IconButton size="small" onClick={() => copyCode(id, masked)} sx={{ p: 0.4 }}>
                  <FiCopy size={13} color={copiedId === id ? "#16a34a" : undefined} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        );
      },
    },
    {
      field: "status",
      headerName: "Status",
      width: 130,
      sortable: false,
      renderCell: (params) => {
        const config = STATUS_CONFIG[params.value] || STATUS_CONFIG.pending;
        const Icon = config.icon;
        return (
          <Chip
            size="small"
            icon={<Icon size={11} />}
            label={config.label}
            sx={{
              fontSize: 11,
              fontWeight: 700,
              height: 22,
              borderRadius: 1,
              bgcolor: alpha(config.color, 0.12),
              color: config.color,
              "& .MuiChip-icon": { color: "inherit", marginLeft: "6px" },
            }}
          />
        );
      },
    },
    {
      field: "attempt_count",
      headerName: "Attempts",
      width: 110,
      sortable: false,
      renderCell: (params) => {
        const used = Number(params.row.attempt_count) || 0;
        const max = Number(params.row.max_attempts) || 5;
        const overLimit = used >= max;
        const ratio = max > 0 ? Math.min(1, used / max) : 0;
        return (
          <Stack spacing={0.4} sx={{ width: "100%" }}>
            <Typography
              variant="caption"
              sx={{
                fontFamily: "monospace",
                fontWeight: 700,
                color: overLimit ? "#dc2626" : (used > 0 ? "#f59e0b" : "text.secondary"),
              }}
            >
              {used} / {max}
            </Typography>
            <Box sx={{ height: 3, borderRadius: 2, bgcolor: alpha(theme.palette.divider, 0.4), overflow: "hidden" }}>
              <Box
                sx={{
                  width: `${ratio * 100}%`,
                  height: "100%",
                  bgcolor: overLimit ? "#dc2626" : (used > 0 ? "#f59e0b" : "#94a3b8"),
                  transition: "width 240ms ease",
                }}
              />
            </Box>
          </Stack>
        );
      },
    },
    {
      field: "ip_address",
      headerName: "IP",
      width: 140,
      sortable: false,
      renderCell: (params) => (
        <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.secondary" }}>
          {params.value || "—"}
        </Typography>
      ),
    },
    {
      field: "created_at",
      headerName: "Sent",
      width: 130,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title={formatDateAbs(params.value)} arrow placement="top">
          <Typography variant="caption" color="text.secondary" sx={{ cursor: "help" }}>
            {formatRelative(params.value)}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: "verified_at",
      headerName: "Verified",
      width: 130,
      sortable: false,
      renderCell: (params) =>
        params.value ? (
          <Tooltip title={formatDateAbs(params.value)} arrow placement="top">
            <Typography variant="caption" sx={{ cursor: "help", color: "#16a34a", fontWeight: 600 }}>
              {formatRelative(params.value)}
            </Typography>
          </Tooltip>
        ) : (
          <Typography variant="caption" color="text.disabled">
            —
          </Typography>
        ),
    },
  ], [theme.palette.primary.main, theme.palette.divider, isDark, hidden, canViewOtp, copiedId, toggleHide, copyCode]);

  return (
    <Stack spacing={2.5} sx={{ p: 3, height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.5,
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                color: theme.palette.primary.main,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FiShield size={16} />
            </Box>
            <Typography variant="h6" fontWeight={800}>
              OTP Verifications
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            Last 25 OTP codes sent for login, registration, and password reset
            {canViewOtp ? "" : " · codes hidden for non-Super Admin"}
          </Typography>
        </Stack>
        <Tooltip title="Refresh">
          <span>
            <IconButton
              onClick={load}
              disabled={loading}
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.14) },
              }}
            >
              {loading ? <CircularProgress size={16} /> : <FiRefreshCw size={16} />}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {/* Stat cards */}
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
        <StatCard
          icon={FiActivity}
          label="Total"
          value={stats.total}
          color={theme.palette.primary.main}
          isDark={isDark}
        />
        <StatCard
          icon={FiCheckCircle}
          label="Verified"
          value={stats.verified}
          color={STATUS_CONFIG.verified.color}
          isDark={isDark}
        />
        <StatCard
          icon={FiClock}
          label="Pending"
          value={stats.pending}
          color={STATUS_CONFIG.pending.color}
          isDark={isDark}
        />
        <StatCard
          icon={FiAlertTriangle}
          label="Expired"
          value={stats.expired}
          color={STATUS_CONFIG.expired.color}
          isDark={isDark}
        />
        <StatCard
          icon={FiXCircle}
          label="Failed"
          value={stats.failed}
          color={STATUS_CONFIG.failed.color}
          isDark={isDark}
        />
      </Stack>

      {/* Filters */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField
          size="small"
          placeholder="Search by name, email, IP, code, purpose"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FiSearch size={16} />
              </InputAdornment>
            ),
          }}
          sx={{
            maxWidth: { sm: 360 },
            "& .MuiOutlinedInput-root": { borderRadius: 2 },
          }}
        />
        <TextField
          size="small"
          select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{
            minWidth: 160,
            "& .MuiOutlinedInput-root": { borderRadius: 2 },
          }}
        >
          {STATUS_FILTERS.map((opt) => (
            <MenuItem key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {/* Table */}
      <Paper
        variant="outlined"
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          borderRadius: 2,
          bgcolor: isDark ? "#0f172a" : "#ffffff",
        }}
      >
        <DataGrid
          rows={filteredRows}
          columns={columns}
          getRowId={(row) => row.otp_id}
          loading={loading}
          rowHeight={68}
          columnHeaderHeight={44}
          disableRowSelectionOnClick
          disableColumnMenu
          hideFooterSelectedRowCount
          hideFooter
          sx={{
            border: 0,
            "& .MuiDataGrid-cell": {
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
              display: "flex",
              alignItems: "center",
              outline: "none !important",
              px: 1.5,
            },
            "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within": {
              outline: "none",
            },
            "& .MuiDataGrid-columnHeaders": {
              bgcolor: isDark ? alpha("#1e293b", 0.6) : alpha("#f1f5f9", 0.6),
              borderBottom: `1px solid ${theme.palette.divider}`,
            },
            "& .MuiDataGrid-columnHeader": {
              outline: "none !important",
              px: 1.5,
            },
            "& .MuiDataGrid-columnHeaderTitle": {
              fontWeight: 700,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              color: theme.palette.text.secondary,
            },
            "& .MuiDataGrid-row": {
              transition: "background-color 120ms ease",
            },
            "& .MuiDataGrid-row:hover": {
              bgcolor: alpha(theme.palette.primary.main, 0.04),
            },
            "& .MuiDataGrid-virtualScroller": {
              overflowY: "auto !important",
            },
          }}
          slots={{
            noRowsOverlay: () => (
              <Stack
                alignItems="center"
                justifyContent="center"
                sx={{ height: "100%", color: "text.secondary" }}
                spacing={1.5}
              >
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    color: alpha(theme.palette.primary.main, 0.6),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FiClock size={26} />
                </Box>
                <Typography variant="body2" fontWeight={600}>
                  {rows.length === 0
                    ? "No OTP verifications yet"
                    : "No results match your filters"}
                </Typography>
                {rows.length > 0 && (search || statusFilter) && (
                  <Typography variant="caption" color="text.secondary">
                    Try clearing the search or status filter.
                  </Typography>
                )}
              </Stack>
            ),
          }}
        />
      </Paper>
    </Stack>
  );
};

export default OtpVerifications;
