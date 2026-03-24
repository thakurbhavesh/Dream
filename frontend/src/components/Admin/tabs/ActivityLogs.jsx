import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Chip,
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
  FiSearch,
  FiRefreshCw,
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiUser,
  FiClock,
  FiGlobe,
} from "react-icons/fi";
import { API_BASE_URL } from "../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../utils/authApi";

const PAGE_SIZE = 25;

// Noisy internal events that aren't useful in the admin dashboard
const EXCLUDED_ACTIONS = [
  "auth.refresh",
  "auth.login_otp_sent",
  "auth.verify_otp",
  "auth.resend_otp",
  "organization.details.view",
  "auth.forgot_password_otp",
  "auth.forgot_verify",
].join(",");

const STATUS_CONFIG = {
  success: { label: "Success", color: "#22c55e", icon: FiCheckCircle },
  failed: { label: "Failed", color: "#ef4444", icon: FiXCircle },
  denied: { label: "Denied", color: "#f59e0b", icon: FiAlertTriangle },
};

const ACTION_CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "user_management", label: "User Management" },
  { value: "security", label: "Security" },
  { value: "group_management", label: "Group Management" },
  { value: "organization", label: "Organization" },
  { value: "billing", label: "Billing" },
];

const formatDate = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const formatAction = (action) => {
  if (!action) return "-";
  return action
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const ActivityLogs = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
        exclude_actions: EXCLUDED_ACTIONS,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);
      if (categoryFilter) params.set("action_category", categoryFilter);

      const res = await fetchWithAuth(
        `${API_BASE_URL}/activity-logs?${params.toString()}`
      );
      const data = res?.payload?.data || res?.data || {};
      const rows = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
      setLogs(rows);
      setTotal(Number(data?.count || data?.total || rows.length));
    } catch (err) {
      console.error("[ActivityLogs] fetch error:", err?.message);
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter, categoryFilter]);

  const columns = useMemo(
    () => [
      {
        field: "occurred_at",
        headerName: "Time",
        width: 175,
        renderCell: ({ value }) => (
          <Stack direction="row" alignItems="center" spacing={0.8}>
            <FiClock size={13} color={theme.palette.text.secondary} />
            <Typography variant="caption" sx={{ fontSize: 12 }}>
              {formatDate(value)}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "actor",
        headerName: "User",
        width: 180,
        valueGetter: (params) => params?.name || params?.email || "-",
        renderCell: ({ row }) => {
          const actor = row?.actor || row?.user || {};
          const name = actor?.name || actor?.email || "-";
          const initials = name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
          return (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Avatar
                sx={{
                  width: 28,
                  height: 28,
                  fontSize: 11,
                  fontWeight: 700,
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                  color: theme.palette.primary.main,
                }}
              >
                {initials || <FiUser size={14} />}
              </Avatar>
              <Stack spacing={0}>
                <Typography variant="caption" fontWeight={600} noWrap sx={{ maxWidth: 120 }}>
                  {name}
                </Typography>
                {actor?.role_key && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                    {actor.role_key}
                  </Typography>
                )}
              </Stack>
            </Stack>
          );
        },
      },
      {
        field: "action",
        headerName: "Action",
        flex: 1,
        minWidth: 160,
        renderCell: ({ row }) => (
          <Stack spacing={0.2}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 12 }}>
              {formatAction(row?.action)}
            </Typography>
            {row?.action_category && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                {formatAction(row.action_category)}
              </Typography>
            )}
          </Stack>
        ),
      },
      {
        field: "description",
        headerName: "Description",
        flex: 2,
        minWidth: 240,
        renderCell: ({ value }) => (
          <Tooltip title={value || ""} arrow placement="top-start">
            <Typography
              variant="caption"
              noWrap
              sx={{ maxWidth: "100%", display: "block", fontSize: 12 }}
            >
              {value || "-"}
            </Typography>
          </Tooltip>
        ),
      },
      {
        field: "target",
        headerName: "Target",
        width: 140,
        valueGetter: (params) => params?.type || "-",
        renderCell: ({ row }) => {
          const target = row?.target || {};
          return (
            <Stack spacing={0}>
              <Typography variant="caption" fontWeight={600} sx={{ fontSize: 11 }}>
                {target?.type ? formatAction(target.type) : "-"}
              </Typography>
              {target?.name && (
                <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 10, maxWidth: 120 }}>
                  {target.name}
                </Typography>
              )}
            </Stack>
          );
        },
      },
      {
        field: "request_meta",
        headerName: "IP",
        width: 130,
        valueGetter: (params) => params?.ip_address || "-",
        renderCell: ({ row }) => {
          const ip = row?.request_meta?.ip_address || "-";
          return (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <FiGlobe size={12} color={theme.palette.text.secondary} />
              <Typography variant="caption" sx={{ fontSize: 11 }}>
                {ip}
              </Typography>
            </Stack>
          );
        },
      },
      {
        field: "status",
        headerName: "Status",
        width: 100,
        renderCell: ({ value }) => {
          const cfg = STATUS_CONFIG[value] || STATUS_CONFIG.success;
          const StatusIcon = cfg.icon;
          return (
            <Chip
              size="small"
              icon={<StatusIcon size={12} />}
              label={cfg.label}
              sx={{
                bgcolor: alpha(cfg.color, 0.1),
                color: cfg.color,
                fontWeight: 700,
                fontSize: 11,
                border: "1px solid",
                borderColor: alpha(cfg.color, 0.2),
                "& .MuiChip-icon": { color: cfg.color },
              }}
            />
          );
        },
      },
    ],
    [theme]
  );

  return (
    <Stack spacing={2.5} sx={{ height: "100%", p: { xs: 1, md: 2 } }}>
      {/* Header */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        spacing={1.5}
      >
        <Stack spacing={0.3}>
          <Typography variant="h6" fontWeight={800}>
            Activity Logs
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {total.toLocaleString()} total events
          </Typography>
        </Stack>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchLogs} size="small">
            <FiRefreshCw size={16} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Filters */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField
          size="small"
          placeholder="Search logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 220 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FiSearch size={16} color={theme.palette.text.secondary} />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          size="small"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ minWidth: 140 }}
          label="Status"
        >
          <MenuItem value="">All Status</MenuItem>
          <MenuItem value="success">Success</MenuItem>
          <MenuItem value="failed">Failed</MenuItem>
          <MenuItem value="denied">Denied</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          sx={{ minWidth: 170 }}
          label="Category"
        >
          {ACTION_CATEGORIES.map((cat) => (
            <MenuItem key={cat.value} value={cat.value}>
              {cat.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {/* Data Grid */}
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
          overflow: "hidden",
          bgcolor: theme.palette.background.paper,
        }}
      >
        <DataGrid
          rows={logs}
          columns={columns}
          getRowId={(row) => row.log_id || row.id || Math.random()}
          loading={loading}
          paginationMode="server"
          rowCount={total}
          pageSizeOptions={[PAGE_SIZE]}
          paginationModel={{ page, pageSize: PAGE_SIZE }}
          onPaginationModelChange={(model) => setPage(model.page)}
          disableRowSelectionOnClick
          disableColumnMenu
          rowHeight={52}
          sx={{
            border: "none",
            "& .MuiDataGrid-columnHeaders": {
              bgcolor: isDark ? alpha("#fff", 0.03) : "#f8fafc",
              borderBottom: "1px solid",
              borderColor: "divider",
            },
            "& .MuiDataGrid-columnHeaderTitle": {
              fontWeight: 700,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: theme.palette.text.secondary,
            },
            "& .MuiDataGrid-cell": {
              borderBottom: "1px solid",
              borderColor: alpha(theme.palette.divider, 0.5),
              py: 0.5,
            },
            "& .MuiDataGrid-row:hover": {
              bgcolor: isDark ? alpha("#fff", 0.02) : alpha("#3b82f6", 0.02),
            },
            "& .MuiDataGrid-footerContainer": {
              borderTop: "1px solid",
              borderColor: "divider",
            },
          }}
        />
      </Paper>
    </Stack>
  );
};

export default ActivityLogs;
