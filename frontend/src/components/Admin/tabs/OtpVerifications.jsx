import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
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
} from "react-icons/fi";
import { API_BASE_URL } from "../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../utils/authApi";

const STATUS_CONFIG = {
  verified: { label: "Verified", color: "#22c55e", icon: FiCheckCircle },
  pending: { label: "Pending", color: "#3b82f6", icon: FiClock },
  expired: { label: "Expired", color: "#9ca3af", icon: FiAlertTriangle },
  failed: { label: "Failed", color: "#ef4444", icon: FiXCircle },
};

const PURPOSE_LABELS = {
  verification: "Account Verification",
  login: "Login",
  password_reset: "Password Reset",
  forgot_password: "Forgot Password",
  email_change: "Email Change",
  phone_change: "Phone Change",
};

const formatDate = (value) => {
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

const initialsOf = (name, identifier) => {
  const source = String(name || identifier || "?").trim();
  if (!source) return "?";
  const parts = source.split(/[\s@]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const OtpVerifications = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canViewOtp, setCanViewOtp] = useState(false);
  const [revealed, setRevealed] = useState(() => new Set()); // otp_ids whose code is shown
  const [copiedId, setCopiedId] = useState(null);

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

  const toggleReveal = useCallback((id) => {
    setRevealed((prev) => {
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

  const columns = useMemo(() => [
    {
      field: "user",
      headerName: "User",
      flex: 1.2,
      minWidth: 240,
      sortable: false,
      renderCell: (params) => {
        const r = params.row;
        return (
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ width: "100%" }}>
            <Avatar
              src={r.profile_url || undefined}
              sx={{
                width: 32,
                height: 32,
                bgcolor: alpha(theme.palette.primary.main, 0.18),
                color: theme.palette.primary.main,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {initialsOf(r.name, r.identifier)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {r.name || (r.user_id ? `User #${r.user_id}` : "Pre-registration")}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
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
        return (
          <Chip
            size="small"
            icon={<Icon size={12} />}
            label={isEmail ? "Email" : "SMS"}
            sx={{
              fontSize: 11,
              fontWeight: 600,
              bgcolor: alpha(isEmail ? "#3b82f6" : "#10b981", 0.12),
              color: isEmail ? "#3b82f6" : "#10b981",
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
        <Typography variant="body2" sx={{ textTransform: "capitalize" }} noWrap>
          {PURPOSE_LABELS[params.value] || String(params.value || "—").replace(/_/g, " ")}
        </Typography>
      ),
    },
    {
      field: "otp_code",
      headerName: "OTP Code",
      width: 150,
      sortable: false,
      renderCell: (params) => {
        const id = params.row.otp_id;
        const masked = String(params.value || "");
        const isMaskedByServer = masked === "••••••";
        const showing = revealed.has(id);
        const display = isMaskedByServer || !showing ? "••••••" : masked;
        return (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography
              variant="body2"
              sx={{
                fontFamily: "monospace",
                fontWeight: 700,
                letterSpacing: 1.5,
                color: isMaskedByServer ? "text.disabled" : "text.primary",
              }}
            >
              {display}
            </Typography>
            {!isMaskedByServer && canViewOtp && (
              <Tooltip title={showing ? "Hide" : "Show"}>
                <IconButton size="small" onClick={() => toggleReveal(id)} sx={{ p: 0.25 }}>
                  {showing ? <FiEyeOff size={13} /> : <FiEye size={13} />}
                </IconButton>
              </Tooltip>
            )}
            {!isMaskedByServer && canViewOtp && showing && (
              <Tooltip title={copiedId === id ? "Copied!" : "Copy"}>
                <IconButton size="small" onClick={() => copyCode(id, masked)} sx={{ p: 0.25 }}>
                  <FiCopy size={13} color={copiedId === id ? "#22c55e" : undefined} />
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
            icon={<Icon size={12} />}
            label={config.label}
            sx={{
              fontSize: 11,
              fontWeight: 600,
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
      width: 100,
      sortable: false,
      renderCell: (params) => {
        const used = Number(params.row.attempt_count) || 0;
        const max = Number(params.row.max_attempts) || 5;
        const overLimit = used >= max;
        return (
          <Typography
            variant="caption"
            sx={{
              fontFamily: "monospace",
              fontWeight: 700,
              color: overLimit ? "#ef4444" : "text.secondary",
            }}
          >
            {used} / {max}
          </Typography>
        );
      },
    },
    {
      field: "ip_address",
      headerName: "IP",
      width: 130,
      sortable: false,
      renderCell: (params) => (
        <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.secondary" }}>
          {params.value || "—"}
        </Typography>
      ),
    },
    {
      field: "created_at",
      headerName: "Sent at",
      width: 180,
      sortable: false,
      renderCell: (params) => (
        <Typography variant="caption" color="text.secondary">
          {formatDate(params.value)}
        </Typography>
      ),
    },
    {
      field: "verified_at",
      headerName: "Verified at",
      width: 180,
      sortable: false,
      renderCell: (params) => (
        <Typography variant="caption" color="text.secondary">
          {params.value ? formatDate(params.value) : "—"}
        </Typography>
      ),
    },
  ], [theme.palette.primary.main, revealed, canViewOtp, copiedId, toggleReveal, copyCode]);

  return (
    <Stack spacing={2} sx={{ p: 3, height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack>
          <Typography variant="h6" fontWeight={700}>
            OTP Verifications
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Last 25 OTP codes sent for login, registration, and password reset
            {canViewOtp ? "" : " · codes hidden for non-Super Admin"}
          </Typography>
        </Stack>
        <Tooltip title="Refresh">
          <span>
            <IconButton onClick={load} disabled={loading}>
              {loading ? <CircularProgress size={16} /> : <FiRefreshCw size={16} />}
            </IconButton>
          </span>
        </Tooltip>
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
          rows={rows}
          columns={columns}
          getRowId={(row) => row.otp_id}
          loading={loading}
          disableRowSelectionOnClick
          disableColumnMenu
          hideFooterSelectedRowCount
          pageSizeOptions={[25]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25, page: 0 } },
          }}
          sx={{
            border: 0,
            "& .MuiDataGrid-cell": {
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
              display: "flex",
              alignItems: "center",
            },
            "& .MuiDataGrid-columnHeaders": {
              bgcolor: isDark ? alpha("#1e293b", 0.6) : alpha("#f8fafc", 0.8),
              borderBottom: `1px solid ${theme.palette.divider}`,
            },
            "& .MuiDataGrid-columnHeaderTitle": {
              fontWeight: 700,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            },
            "& .MuiDataGrid-row:hover": {
              bgcolor: alpha(theme.palette.primary.main, 0.04),
            },
          }}
          slots={{
            noRowsOverlay: () => (
              <Stack
                alignItems="center"
                justifyContent="center"
                sx={{ height: "100%", color: "text.secondary" }}
                spacing={1}
              >
                <FiClock size={28} />
                <Typography variant="body2">No OTP verifications yet</Typography>
              </Stack>
            ),
          }}
        />
      </Paper>
    </Stack>
  );
};

export default OtpVerifications;
