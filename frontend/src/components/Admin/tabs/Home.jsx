import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchWithAuth } from "../../../utils/authApi";
import { API_BASE_URL } from "../../../config/apiBaseUrl";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useTheme,
  alpha,
  Avatar,
  Divider,
  LinearProgress,
  MenuItem,
  TextField,
} from "@mui/material";
import { PieChart } from "@mui/x-charts/PieChart";
import CustomScrollbars from "../../Scrollbar";
import { IoBusiness } from "react-icons/io5";
import {
  FiInfo,
  FiCalendar,
  FiHardDrive,
  FiShield,
  FiMessageSquare,
  FiFile,
  FiImage,
  FiVideo,
  FiUserPlus,
  FiSettings,
  FiGlobe,
  FiActivity,
} from "react-icons/fi";
import {
  PiUserCircleDashedDuotone,
  PiUserMinusLight,
  PiUser,
  PiUsersFourLight,
  PiCrownSimpleBold,
  PiArrowUpRightBold,
} from "react-icons/pi";
import useMascot from "../../../hooks/useMascot";
import {
  resetMascotAsset,
  updateMascotAsset,
} from "../../../data/brandingStore";
import { appBrandingAssets } from "../../../data/CommonData";
import { buildSubscriptionView } from "../../../utils/subscription";

const INFO_CARDS = [
  {
    key: "users",
    title: "Active Users",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    iconBg: "rgba(255,255,255,0.2)",
    icon: PiUser,
    tab: 1,
    usersTab: "Users",
  },
  {
    key: "global",
    title: "Global Members",
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
    iconBg: "rgba(255,255,255,0.2)",
    icon: PiUserCircleDashedDuotone,
    tab: 1,
    usersTab: "Global Members",
  },
  {
    key: "groups",
    title: "Groups",
    gradient: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
    iconBg: "rgba(255,255,255,0.2)",
    icon: PiUsersFourLight,
    tab: 2,
  },
  {
    key: "ex",
    title: "Ex-Members",
    gradient: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
    iconBg: "rgba(255,255,255,0.2)",
    icon: PiUserMinusLight,
    tab: 1,
    usersTab: "Ex-Members",
  },
];

/* ─── Stat Card ─────────────────────────────────────────────────────────────── */
const InfoCard = ({ title, value, gradient, iconBg, icon: Icon, onClick }) => (
  <Paper
    onClick={onClick}
    elevation={0}
    sx={{
      background: gradient,
      position: "relative",
      p: 2.5,
      borderRadius: 3,
      display: "flex",
      alignItems: "center",
      gap: 2,
      cursor: onClick ? "pointer" : "default",
      overflow: "hidden",
      transition: "all 0.25s cubic-bezier(.4,0,.2,1)",
      "&::before": {
        content: '""',
        position: "absolute",
        right: -20,
        top: -20,
        width: 80,
        height: 80,
        borderRadius: "50%",
        backgroundColor: "rgba(255,255,255,0.1)",
      },
      "&::after": {
        content: '""',
        position: "absolute",
        right: 20,
        bottom: -30,
        width: 60,
        height: 60,
        borderRadius: "50%",
        backgroundColor: "rgba(255,255,255,0.06)",
      },
      "&:hover": onClick
        ? {
            transform: "translateY(-4px)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
          }
        : {},
    }}
  >
    <Avatar
      sx={{
        bgcolor: iconBg,
        width: 48,
        height: 48,
        flexShrink: 0,
      }}
    >
      {Icon ? <Icon color="#fff" size={24} /> : null}
    </Avatar>
    <Stack spacing={0.2} sx={{ zIndex: 1 }}>
      <Typography
        variant="body2"
        sx={{ color: "rgba(255,255,255,0.8)", fontWeight: 500, fontSize: 12 }}
      >
        {title}
      </Typography>
      <Typography variant="h4" sx={{ color: "#fff", fontWeight: 800, lineHeight: 1.2 }}>
        {value}
      </Typography>
    </Stack>
    {onClick && (
      <PiArrowUpRightBold
        color="rgba(255,255,255,0.4)"
        size={18}
        style={{ position: "absolute", top: 14, right: 14 }}
      />
    )}
  </Paper>
);

/* ─── Circular Gauge ────────────────────────────────────────────────────────── */
const GaugeWidget = ({ value, label, sublabel, icon: GaugeIcon, color, theme }) => (
  <Stack
    alignItems="center"
    spacing={1.2}
    sx={{
      p: 2,
      borderRadius: 3,
      bgcolor: alpha(color, theme.palette.mode === "light" ? 0.04 : 0.08),
      border: "1px solid",
      borderColor: alpha(color, 0.12),
      flex: 1,
      minWidth: 120,
    }}
  >
    {GaugeIcon && <GaugeIcon size={18} color={color} />}
    <Box position="relative" display="inline-flex">
      <CircularProgress
        variant="determinate"
        value={100}
        size={72}
        thickness={3.5}
        sx={{ color: alpha(color, 0.12) }}
      />
      <CircularProgress
        variant="determinate"
        value={Math.min(Math.max(value, 0), 100)}
        size={72}
        thickness={3.5}
        sx={{
          color,
          position: "absolute",
          left: 0,
          "& .MuiCircularProgress-circle": {
            strokeLinecap: "round",
          },
        }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography variant="caption" fontWeight={800} color="text.primary" sx={{ fontSize: 13 }}>
          {Math.round(value)}%
        </Typography>
      </Box>
    </Box>
    <Typography variant="caption" fontWeight={600} color="text.primary" textAlign="center">
      {label}
    </Typography>
    {sublabel && (
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, mt: -0.5 }}>
        {sublabel}
      </Typography>
    )}
  </Stack>
);

/* ─── Meta Row ──────────────────────────────────────────────────────────────── */
const MetaRow = ({ label, value, highlight = false }) => (
  <Stack direction="row" spacing={1.5} alignItems="center">
    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 100, flexShrink: 0 }}>
      {label}
    </Typography>
    <Typography
      variant="body2"
      sx={{
        py: 0.3,
        px: highlight ? 1.2 : 0,
        borderRadius: 1,
        fontWeight: highlight ? 700 : 500,
        backgroundColor: highlight ? alpha("#1976d2", 0.08) : "transparent",
        color: "text.primary",
      }}
    >
      {value || "-"}
    </Typography>
  </Stack>
);

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
const normalizeDomain = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");

const getDomainFromEmail = (email) => {
  const value = String(email || "").trim().toLowerCase();
  if (!value.includes("@")) return "";
  return normalizeDomain(value.split("@")[1] || "");
};

const getUserUniqueKey = (user = {}) => {
  const userId = Number(user?.user_id || user?.id || 0);
  if (Number.isFinite(userId) && userId > 0) return `id:${userId}`;
  const email = String(user?.email || "").trim().toLowerCase();
  if (email) return `email:${email}`;
  return "";
};

const uniqueUsersByIdentity = (rows = []) => {
  const map = new Map();
  for (const row of rows) {
    const key = getUserUniqueKey(row);
    if (!key) continue;
    if (!map.has(key)) map.set(key, row);
  }
  return Array.from(map.values());
};

/* ─── Simple Bar Chart ──────────────────────────────────────────────────────── */
const SimpleBarChart = ({ data, color }) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <Stack spacing={1}>
      {data.map((d) => (
        <Stack key={d.label} direction="row" alignItems="center" spacing={1.5}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              width: 80,
              flexShrink: 0,
              textAlign: "right",
              fontSize: 11,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {d.label}
          </Typography>
          <Box sx={{ flex: 1, position: "relative" }}>
            <LinearProgress
              variant="determinate"
              value={(d.value / max) * 100}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: alpha(color, 0.1),
                "& .MuiLinearProgress-bar": {
                  borderRadius: 4,
                  bgcolor: color,
                },
              }}
            />
          </Box>
          <Typography variant="caption" fontWeight={700} sx={{ width: 28, textAlign: "right", flexShrink: 0 }}>
            {d.value}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
};

/* ─── Chart Card Wrapper ────────────────────────────────────────────────────── */
const ChartCard = ({ title, children, theme }) => (
  <Paper
    elevation={0}
    sx={{
      p: { xs: 2.5, md: 3 },
      bgcolor: theme.palette.background.paper,
      border: "1px solid",
      borderColor: "divider",
      borderRadius: 3,
      flex: 1,
      minWidth: 0,
    }}
  >
    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2.5 }} color="text.secondary">
      {title}
    </Typography>
    {children}
  </Paper>
);

/* ─── Analytics Section ─────────────────────────────────────────────────────── */
const AnalyticsSection = ({ summaryCounts, users, groups, theme }) => {
  const memberStatusData = useMemo(() => {
    const active = Number(summaryCounts?.active_members || 0);
    const invited = Number(summaryCounts?.invited_members || 0);
    const suspended = Number(summaryCounts?.suspended_members || 0);
    const left = Number(summaryCounts?.left_members || 0);
    const global = Number(summaryCounts?.global_members || 0);
    return [
      { id: 0, value: active, label: "Active", color: "#3b82f6" },
      { id: 1, value: invited, label: "Invited", color: "#06b6d4" },
      { id: 2, value: global, label: "Global", color: "#8b5cf6" },
      { id: 3, value: suspended, label: "Suspended", color: "#f59e0b" },
      { id: 4, value: left, label: "Left", color: "#94a3b8" },
    ].filter((d) => d.value > 0);
  }, [summaryCounts]);

  const deptData = useMemo(() => {
    const counts = {};
    for (const user of users) {
      const dept = user?.department_name || user?.department || "No Dept";
      counts[dept] = (counts[dept] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }));
  }, [users]);

  const groupSizeData = useMemo(() => {
    const buckets = { "1-5": 0, "6-20": 0, "21-50": 0, "51-100": 0, "100+": 0 };
    for (const g of groups) {
      const cnt = Number(g.member_count || g.members_count || 0);
      if (cnt <= 5) buckets["1-5"]++;
      else if (cnt <= 20) buckets["6-20"]++;
      else if (cnt <= 50) buckets["21-50"]++;
      else if (cnt <= 100) buckets["51-100"]++;
      else buckets["100+"]++;
    }
    return Object.entries(buckets)
      .filter(([, v]) => v > 0)
      .map(([label, value]) => ({ label, value }));
  }, [groups]);

  const hasDeptData = deptData.length > 0;
  const hasGroupData = groupSizeData.length > 0;
  const hasMemberData = memberStatusData.length > 0;

  if (!hasDeptData && !hasGroupData && !hasMemberData) return null;

  return (
    <Stack spacing={2.5}>
      <Typography variant="overline" color="text.secondary" fontWeight={700} letterSpacing={1.2}>
        Analytics
      </Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        {hasMemberData && (
          <ChartCard title="Member Status" theme={theme}>
            <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" spacing={3}>
              <PieChart
                series={[{
                  data: memberStatusData,
                  innerRadius: 40,
                  outerRadius: 68,
                  paddingAngle: 3,
                  cornerRadius: 5,
                  cx: 68,
                }]}
                width={145}
                height={145}
                slotProps={{ legend: { hidden: true } }}
              />
              <Stack spacing={1}>
                {memberStatusData.map((d) => (
                  <Stack key={d.id} direction="row" alignItems="center" spacing={1.2}>
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: d.color, flexShrink: 0 }} />
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 64 }}>
                      {d.label}
                    </Typography>
                    <Typography variant="caption" fontWeight={800}>
                      {d.value}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </ChartCard>
        )}

        {hasDeptData && (
          <ChartCard title="Users by Department" theme={theme}>
            <SimpleBarChart data={deptData} color="#3b82f6" />
          </ChartCard>
        )}
      </Stack>

      {hasGroupData && (
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <ChartCard title="Groups by Size" theme={theme}>
            <SimpleBarChart data={groupSizeData} color="#14b8a6" />
          </ChartCard>

          <ChartCard title="Workspace Summary" theme={theme}>
            <Stack spacing={2}>
              {[
                { label: "Departments", value: summaryCounts?.departments },
                { label: "Designations", value: summaryCounts?.designations },
                { label: "Locations", value: summaryCounts?.locations },
                { label: "Total Members", value: summaryCounts?.total_members },
              ]
                .filter((row) => Number(row.value) > 0)
                .map(({ label, value }) => (
                  <Stack key={label} direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      {label}
                    </Typography>
                    <Chip label={value} size="small" sx={{ fontWeight: 700, minWidth: 40 }} />
                  </Stack>
                ))}
            </Stack>
          </ChartCard>
        </Stack>
      )}
    </Stack>
  );
};

/* ─── Exchange Info Section ──────────────────────────────────────────────────── */
const EXCHANGE_ITEMS = [
  { key: "messages", label: "Messages", icon: FiMessageSquare, color: "#3b82f6", gradient: "linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)", darkGradient: "linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)" },
  { key: "files", label: "Files", icon: FiFile, color: "#f59e0b", gradient: "linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)", darkGradient: "linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)" },
  { key: "images", label: "Images", icon: FiImage, color: "#14b8a6", gradient: "linear-gradient(135deg, #ccfbf1 0%, #f0fdfa 100%)", darkGradient: "linear-gradient(135deg, rgba(20,184,166,0.15) 0%, rgba(20,184,166,0.05) 100%)" },
  { key: "videos", label: "Videos", icon: FiVideo, color: "#8b5cf6", gradient: "linear-gradient(135deg, #ede9fe 0%, #f5f3ff 100%)", darkGradient: "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(139,92,246,0.05) 100%)" },
];

const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
];

const ExchangeInfoSection = ({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  const [period, setPeriod] = useState("all");
  const [data, setData] = useState({ messages: 0, files: 0, images: 0, videos: 0, total_file_size_label: "" });

  const fetchExchange = useCallback(async (p) => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/chat/exchange-info?period=${p}`);
      const d = res?.payload?.data || res?.data || {};
      setData({
        messages: Number(d.messages || 0),
        files: Number(d.files || 0),
        images: Number(d.images || 0),
        videos: Number(d.videos || 0),
        total_file_size_label: d.total_file_size_label || "",
      });
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchExchange(period); }, [period, fetchExchange]);

  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label || "All Time";

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography variant="overline" color="text.secondary" fontWeight={700} letterSpacing={1.2}>
            Exchange Info
          </Typography>
          {data.total_file_size_label && (
            <Chip label={data.total_file_size_label} size="small" variant="outlined" sx={{ fontSize: 10, fontWeight: 600 }} />
          )}
        </Stack>
        <TextField
          select
          size="small"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          sx={{ minWidth: 130, "& .MuiInputBase-input": { fontSize: 13, py: 0.6 } }}
        >
          {PERIOD_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </TextField>
      </Stack>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
        }}
      >
        {EXCHANGE_ITEMS.map(({ key, label, icon: ExIcon, color, gradient, darkGradient }) => (
          <Paper
            key={key}
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              background: isDark ? darkGradient : gradient,
              border: "1px solid",
              borderColor: alpha(color, 0.15),
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Avatar sx={{ bgcolor: alpha(color, 0.15), color, width: 44, height: 44 }}>
              <ExIcon size={20} />
            </Avatar>
            <Stack spacing={0.2}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, fontWeight: 500 }}>
                {label}
              </Typography>
              <Typography variant="h5" fontWeight={800} color="text.primary">
                {(data[key] || 0).toLocaleString()}
              </Typography>
            </Stack>
          </Paper>
        ))}
      </Box>
    </Stack>
  );
};

/* ─── Quick Actions Section ─────────────────────────────────────────────────── */
const QUICK_ACTIONS = [
  { label: "Add User", icon: FiUserPlus, color: "#3b82f6", tab: 1, usersTab: "Users" },
  { label: "Manage Groups", icon: PiUsersFourLight, color: "#14b8a6", tab: 2 },
  { label: "Global Access", icon: FiGlobe, color: "#8b5cf6", tab: 1, usersTab: "Global Members" },
  { label: "Controls", icon: FiSettings, color: "#64748b", tab: 3 },
  { label: "Activity Logs", icon: FiActivity, color: "#f59e0b", tab: 5 },
  { label: "Subscription", icon: PiCrownSimpleBold, color: "#ef4444", tab: 4 },
];

const QuickActionsSection = ({ setValue, setUsersTab, theme }) => (
  <Stack spacing={2}>
    <Typography variant="overline" color="text.secondary" fontWeight={700} letterSpacing={1.2}>
      Quick Actions
    </Typography>
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: { xs: "repeat(3, 1fr)", sm: "repeat(6, 1fr)" },
      }}
    >
      {QUICK_ACTIONS.map(({ label, icon: QIcon, color, tab, usersTab }) => (
        <Paper
          key={label}
          elevation={0}
          onClick={() => {
            if (tab === 1 && usersTab) setUsersTab?.(usersTab);
            setValue?.(tab);
          }}
          sx={{
            p: 2,
            borderRadius: 3,
            bgcolor: theme.palette.background.paper,
            border: "1px solid",
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
            cursor: "pointer",
            transition: "all 0.2s ease",
            "&:hover": {
              borderColor: alpha(color, 0.4),
              bgcolor: alpha(color, 0.04),
              transform: "translateY(-2px)",
              boxShadow: `0 8px 24px ${alpha(color, 0.12)}`,
            },
          }}
        >
          <Avatar
            sx={{
              bgcolor: alpha(color, 0.1),
              color,
              width: 40,
              height: 40,
            }}
          >
            <QIcon size={18} />
          </Avatar>
          <Typography variant="caption" fontWeight={600} color="text.secondary" textAlign="center" sx={{ fontSize: 11, lineHeight: 1.2 }}>
            {label}
          </Typography>
        </Paper>
      ))}
    </Box>
  </Stack>
);

/* ═══════════════════════════════════════════════════════════════════════════════
   HOME COMPONENT
   ═══════════════════════════════════════════════════════════════════════════════ */
const Home = ({ setValue, setUsersTab, adminData }) => {
  const theme = useTheme();
  const mascotSrc = useMascot();
  const mascotInputRef = useRef(null);
  const summary = adminData?.organizationSummary || {};
  const users = useMemo(() => adminData?.users || [], [adminData?.users]);
  const groups = useMemo(() => adminData?.groups || [], [adminData?.groups]);
  const globalMembers = useMemo(() => adminData?.globalMembers || [], [adminData?.globalMembers]);
  const exMembers = useMemo(() => adminData?.exMembers || [], [adminData?.exMembers]);
  const uniqueUsers = useMemo(() => uniqueUsersByIdentity(users), [users]);
  const uniqueGlobalMembers = useMemo(() => uniqueUsersByIdentity(globalMembers), [globalMembers]);
  const uniqueExMembers = useMemo(() => uniqueUsersByIdentity(exMembers), [exMembers]);

  const currentPlan = summary?.current_plan || {};
  const planName = currentPlan?.plan_name || "-";
  const customDomain = summary?.organization?.custom_domain || "";
  const companyLabel =
    summary?.organization?.name || localStorage.getItem("company") || "Your Organisation";
  const usagePercent = Number(summary?.usage?.storage_usage_percent || 0);
  const storageLimitMb = Number(summary?.usage?.storage_limit_mb || 0);
  const storageUsedMb = Number(summary?.usage?.storage_used_mb || 0);
  const storageLabel =
    storageLimitMb > 0
      ? `${Math.round(storageUsedMb / 1024)}GB / ${Math.round(storageLimitMb / 1024)}GB`
      : `${Math.round(storageUsedMb / 1024)}GB used`;

  const summaryCounts = useMemo(() => summary?.counts || {}, [summary?.counts]);
  const userCountFromRows = uniqueUsers.filter(
    (user) => String(user?.membership_status || "").toLowerCase() === "active",
  ).length;
  const userCount =
    userCountFromRows > 0
      ? userCountFromRows
      : Number(summaryCounts?.active_members || summaryCounts?.total_members || 0);
  const exUserCount =
    uniqueExMembers.length > 0
      ? uniqueExMembers.length
      : Number(summaryCounts?.left_members || summaryCounts?.suspended_members || 0);
  const globalMemberCount =
    uniqueGlobalMembers.length > 0
      ? uniqueGlobalMembers.length
      : Number(summaryCounts?.global_members || 0);
  const groupCount = groups.length;
  const hasCustomMascot = !!mascotSrc && mascotSrc !== appBrandingAssets.mascot;
  const subscriptionView = useMemo(
    () => buildSubscriptionView(currentPlan, { activeUsers: userCount, fallbackName: "-" }),
    [currentPlan, userCount],
  );
  const licence = subscriptionView.maxUsers;
  const planRemainingDays = subscriptionView.remainingDays;
  const planTotalDays = subscriptionView.totalDays;
  const planUsedPercent = subscriptionView.usedPercent;
  const licenseUsagePercent = subscriptionView.licenseUsagePercent;

  const homeDomain = useMemo(() => {
    const custom = normalizeDomain(customDomain);
    if (custom) return custom;
    const myEmailDomain = getDomainFromEmail(localStorage.getItem("email"));
    return myEmailDomain || "-";
  }, [customDomain]);

  const globalDomains = useMemo(() => {
    const domains = new Set();
    for (const member of uniqueGlobalMembers) {
      const emailDomain = getDomainFromEmail(member?.email);
      const mappedDomain = normalizeDomain(member?.domain_name || member?.domainName || "");
      const resolved = emailDomain || mappedDomain;
      if (!resolved || resolved === homeDomain) continue;
      domains.add(resolved);
    }
    return Array.from(domains).sort((a, b) => a.localeCompare(b));
  }, [uniqueGlobalMembers, homeDomain]);

  const handleMascotFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === "string") updateMascotAsset(result);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const cardValues = useMemo(
    () => ({
      users: userCount,
      global: globalMemberCount,
      groups: groupCount || 0,
      ex: exUserCount,
    }),
    [userCount, globalMemberCount, groupCount, exUserCount],
  );

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [],
  );

  const handleInfoCardClick = (card) => {
    if (!card?.tab) return;
    if (card.tab === 1 && card.usersTab) setUsersTab?.(card.usersTab);
    setValue?.(card.tab);
  };

  const isDark = theme.palette.mode === "dark";

  return (
    <CustomScrollbars>
      <Stack
        spacing={3}
        height="100%"
        sx={{
          px: { xs: 1.5, md: 2 },
          py: 2,
          background: isDark
            ? theme.palette.background.default
            : "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          spacing={1}
        >
          <Stack spacing={0.3}>
            <Typography variant="h5" fontWeight={800} color="text.primary">
              Admin Overview
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {todayLabel}
            </Typography>
          </Stack>
          <Chip
            icon={<PiCrownSimpleBold size={14} />}
            label={planName}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 700, textTransform: "uppercase" }}
          />
        </Stack>

        {/* ── Stat Cards ──────────────────────────────────────────────── */}
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr 1fr",
              md: "repeat(4, 1fr)",
            },
          }}
        >
          {INFO_CARDS.map((card) => (
            <InfoCard
              key={card.key}
              title={card.title}
              value={cardValues[card.key]}
              gradient={card.gradient}
              iconBg={card.iconBg}
              icon={card.icon}
              onClick={card.tab ? () => handleInfoCardClick(card) : undefined}
            />
          ))}
        </Box>

        {/* ── Organization + Gauges ───────────────────────────────────── */}
        <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
          {/* Organization Card */}
          <Paper
            elevation={0}
            sx={{
              flex: 5,
              p: { xs: 2.5, md: 3 },
              bgcolor: theme.palette.background.paper,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
            }}
          >
            <Stack spacing={2.5}>
              <Stack direction="row" alignItems="center" spacing={2}>
                {hasCustomMascot ? (
                  <Avatar
                    src={mascotSrc}
                    variant="rounded"
                    sx={{
                      width: 48,
                      height: 48,
                      bgcolor: isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9",
                    }}
                  />
                ) : (
                  <Avatar
                    variant="rounded"
                    sx={{
                      width: 48,
                      height: 48,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                    }}
                  >
                    <IoBusiness size={22} />
                  </Avatar>
                )}
                <Stack spacing={0.2} flex={1}>
                  <Typography variant="h6" fontWeight={800} noWrap>
                    {companyLabel}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Organization Workspace
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => mascotInputRef.current?.click()}
                    sx={{ fontSize: 11, borderRadius: 2, textTransform: "none" }}
                  >
                    {hasCustomMascot ? "Change" : "Set"} Logo
                  </Button>
                  {hasCustomMascot && (
                    <Button
                      size="small"
                      color="error"
                      variant="text"
                      onClick={() => resetMascotAsset()}
                      sx={{ fontSize: 11, borderRadius: 2, textTransform: "none", minWidth: 0 }}
                    >
                      Remove
                    </Button>
                  )}
                  <Tooltip title="PNG with transparent background (max 1MB)" arrow>
                    <IconButton size="small">
                      <FiInfo size={14} />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <input
                  ref={mascotInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleMascotFileChange}
                />
              </Stack>

              <Divider />

              <Stack spacing={1.5}>
                <MetaRow label="Home Domain" value={homeDomain} highlight />
                {globalDomains.length > 0 && (
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 100 }}>
                      Global Domains
                    </Typography>
                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                      {globalDomains.map((domain) => (
                        <Chip
                          key={domain}
                          size="small"
                          label={domain}
                          sx={{
                            bgcolor: alpha("#f59e0b", 0.1),
                            border: "1px solid",
                            borderColor: alpha("#f59e0b", 0.3),
                            color: isDark ? "#fbbf24" : "#b45309",
                            fontWeight: 600,
                            fontSize: 11,
                          }}
                        />
                      ))}
                    </Stack>
                  </Stack>
                )}
              </Stack>
            </Stack>
          </Paper>

          {/* Gauges Card */}
          <Paper
            elevation={0}
            sx={{
              flex: 3,
              p: { xs: 2.5, md: 3 },
              bgcolor: theme.palette.background.paper,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
            }}
          >
            <Typography variant="overline" color="text.secondary" fontWeight={700} letterSpacing={1}>
              Health
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
              <GaugeWidget
                value={planUsedPercent}
                label={`${planRemainingDays}d left`}
                sublabel={`${planTotalDays} days total`}
                icon={FiCalendar}
                color="#3b82f6"
                theme={theme}
              />
              <GaugeWidget
                value={licenseUsagePercent}
                label={`${subscriptionView.unusedLicenses} free`}
                sublabel={`${licence} licenses`}
                icon={FiShield}
                color="#ef4444"
                theme={theme}
              />
              <GaugeWidget
                value={Math.min(Math.max(usagePercent, 0), 100)}
                label={storageLabel}
                icon={FiHardDrive}
                color="#14b8a6"
                theme={theme}
              />
            </Stack>
            <Button
              variant="contained"
              size="small"
              fullWidth
              onClick={() => setValue?.(4)}
              sx={{
                mt: 2.5,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 600,
              }}
            >
              Manage Subscription
            </Button>
          </Paper>
        </Stack>

        {/* ── Exchange Info ─────────────────────────────────────────────── */}
        <ExchangeInfoSection theme={theme} />

        {/* ── Quick Actions ───────────────────────────────────────────── */}
        <QuickActionsSection setValue={setValue} setUsersTab={setUsersTab} theme={theme} />

        {/* ── Analytics ───────────────────────────────────────────────── */}
        <AnalyticsSection
          summaryCounts={summaryCounts}
          users={uniqueUsers}
          groups={groups}
          theme={theme}
        />
      </Stack>
    </CustomScrollbars>
  );
};

export default Home;
