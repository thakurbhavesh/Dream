import { useMemo, useState } from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import {
  FiActivity,
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiDatabase,
  FiGrid,
  FiGlobe,
  FiLayers,
  FiMapPin,
  FiMessageSquare,
  FiShield,
  FiSliders,
  FiUsers,
  FiCpu,
} from "react-icons/fi";

const menuItems = [
  {
    key: "workspace",
    section: "Workspace",
    items: [
      { id: "overview", label: "Overview", icon: <FiGrid size={16} /> },
      { id: "organizations", label: "Organizations", icon: <FiUsers size={16} /> },
    ],
  },
  {
    key: "commercial",
    section: "Commercial",
    items: [
      { id: "payment-gateways", label: "Payment Gateways", icon: <FiLayers size={16} /> },
      { id: "plans", label: "Plans", icon: <FiLayers size={16} /> },
      { id: "plan-features", label: "Plan Features", icon: <FiSliders size={16} /> },
      { id: "coupons", label: "Coupons", icon: <FiLayers size={16} /> },
    ],
  },
  {
    key: "admin-control",
    section: "Admin Control",
    items: [
      { id: "user-details", label: "User Details", icon: <FiUsers size={16} /> },
      { id: "roles", label: "Roles", icon: <FiLayers size={16} /> },
      { id: "site-details", label: "Site Details", icon: <FiLayers size={16} /> },
      { id: "contact-requests", label: "Contact Requests", icon: <FiLayers size={16} /> },
      { id: "smtp-settings", label: "SMTP Settings", icon: <FiSliders size={16} /> },
    ],
  },
  {
    key: "features",
    section: "Categories & Features",
    items: [
      { id: "feature-categories", label: "Feature Categories", icon: <FiLayers size={16} /> },
      { id: "product-features", label: "Product Features", icon: <FiSliders size={16} /> },
      { id: "message-menu-items", label: "Message Menu Items", icon: <FiMessageSquare size={16} /> },
      { id: "platforms", label: "Platforms", icon: <FiLayers size={16} /> },
    ],
  },
  {
    key: "localization-geo",
    section: "Localization & Geo",
    items: [
      { id: "languages", label: "Languages", icon: <FiGlobe size={16} /> },
      { id: "timezones", label: "Timezones", icon: <FiClock size={16} /> },
      { id: "geo-countries", label: "Geo Countries", icon: <FiGlobe size={16} /> },
      { id: "geo-states", label: "Geo States", icon: <FiMapPin size={16} /> },
      { id: "geo-currencies", label: "Geo Currencies", icon: <FiDatabase size={16} /> },
    ],
  },
  {
    key: "system-monitoring",
    section: "System Monitoring",
    items: [
      { id: "socket-dashboard", label: "Socket Dashboard", icon: <FiActivity size={16} /> },
      { id: "system-health", label: "System Health", icon: <FiDatabase size={16} /> },
      { id: "ai-providers", label: "AI Providers", icon: <FiCpu size={16} /> },
    ],
  },
  {
    key: "audit",
    section: "Audit",
    items: [{ id: "activity-logs", label: "Activity Logs", icon: <FiActivity size={16} /> }],
  },
];

const OwnerSidebar = ({
  active = "organizations",
  onSelect = () => {},
  onNavigate,
  mode = "dark",
  hiddenItemIds = null,
  brandName = "",
}) => {
  const theme = useTheme();
  const isDark = mode === "dark";
  const primaryMain = theme.palette.primary.main;
  const primaryLight = theme.palette.primary.light || theme.palette.primary.main;
  const resolvedBrandName = String(brandName || "").trim() || "Owner Console";
  const sidebarBg = isDark
    ? "linear-gradient(180deg, #0f172a 0%, #111827 100%)"
    : "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)";
  const sidebarBorder = isDark ? "rgba(71,85,105,0.55)" : "rgba(148,163,184,0.35)";
  const textPrimary = isDark ? "#e6edf8" : "#0f172a";
  const textSecondary = isDark ? "rgba(191,219,254,0.88)" : "#64748b";
  const hoverBg = isDark ? "rgba(148,163,184,0.14)" : "rgba(148,163,184,0.16)";

  const hiddenSet = useMemo(
    () => (Array.isArray(hiddenItemIds) ? new Set(hiddenItemIds) : null),
    [hiddenItemIds],
  );

  const visibleGroups = useMemo(() => {
    if (!hiddenSet) return menuItems;
    return menuItems
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !hiddenSet.has(item.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [hiddenSet]);

  const [expandedSections, setExpandedSections] = useState(() =>
    menuItems.reduce((acc, group) => {
      const hasActive = group.items.some((item) => item.id === active);
      return { ...acc, [group.key]: hasActive || group.key === "workspace" };
    }, {}),
  );

  const handleSelect = (id, groupKey) => {
    onSelect(id);
    setExpandedSections((prev) => ({ ...prev, [groupKey]: true }));
    if (typeof onNavigate === "function") onNavigate();
  };

  const toggleGroup = (groupKey) => {
    setExpandedSections((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  return (
    <Box
      sx={{
        width: { xs: "100%", md: 260 },
        minHeight: { xs: "auto", md: "100dvh" },
        borderRight: { xs: "none", md: "1px solid" },
        borderColor: sidebarBorder,
        background: sidebarBg,
        color: textPrimary,
        p: 2,
        maxHeight: { xs: "calc(100dvh - 12px)", md: "100dvh" },
        overflowY: "auto",
        overflowX: "hidden",
        scrollbarWidth: "thin",
        "&::-webkit-scrollbar": { width: 8 },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: isDark ? "rgba(100,116,139,0.55)" : "rgba(148,163,184,0.62)",
          borderRadius: 8,
        },
      }}
    >
      <Stack spacing={2.2}>
        <Box
          sx={{
            p: 1.4,
            borderRadius: 2.2,
            border: `1px solid ${isDark ? "rgba(71,85,105,0.5)" : "rgba(148,163,184,0.35)"}`,
            background: isDark
              ? `linear-gradient(135deg, rgba(30,41,59,0.92), rgba(15,23,42,0.92))`
              : "linear-gradient(135deg, #ffffff, #f8fafc)",
            boxShadow: isDark ? "0 10px 24px rgba(2,6,23,0.28)" : "0 8px 18px rgba(15,23,42,0.08)",
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: 1.8,
                bgcolor: isDark ? "rgba(15,23,42,0.45)" : alpha(primaryMain, 0.1),
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${isDark ? alpha(primaryLight, 0.32) : alpha(primaryMain, 0.2)}`,
              }}
            >
              <FiShield size={16} />
            </Box>
            <Stack spacing={0.2}>
              <Typography fontWeight={800} letterSpacing={0.25} fontSize={13.5} sx={{ textTransform: "uppercase" }}>
                {resolvedBrandName}
              </Typography>
              <Typography variant="caption" sx={{ color: isDark ? "#a5b4fc" : "#64748b" }}>
                Owner Control Center
              </Typography>
            </Stack>
          </Stack>
        </Box>

        <Stack spacing={1.3}>
          {visibleGroups.map((group) => (
            <Stack key={group.key} spacing={0.8}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                onClick={() => toggleGroup(group.key)}
                sx={{
                  px: 0.6,
                  py: 0.4,
                  cursor: "pointer",
                  borderRadius: 1,
                  "&:hover": {
                    backgroundColor: hoverBg,
                  },
                }}
              >
                <Stack direction="row" spacing={0.8} alignItems="center">
                  <Typography
                    variant="caption"
                    sx={{
                      color: textSecondary,
                      textTransform: "uppercase",
                      letterSpacing: 0.7,
                    }}
                  >
                    {group.section}
                  </Typography>
                  <Chip
                    size="small"
                    label={group.items.length}
                    sx={{
                      height: 18,
                      fontSize: 10,
                      backgroundColor: alpha(primaryMain, isDark ? 0.24 : 0.14),
                      color: isDark ? "#e2e8f0" : "#1e3a8a",
                    }}
                  />
                </Stack>
                <Box sx={{ color: textSecondary }}>
                  {expandedSections[group.key] ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                </Box>
              </Stack>
              {expandedSections[group.key] ? (
                <Stack spacing={0.5}>
                  {group.items.map((item) => {
                    const selected = item.id === active;
                    return (
                      <Stack
                        key={item.id}
                        direction="row"
                        spacing={1.1}
                        alignItems="center"
                        onClick={() => handleSelect(item.id, group.key)}
                        sx={{
                          position: "relative",
                          px: 1.1,
                          py: 0.95,
                          borderRadius: 1.4,
                          backgroundColor: selected
                            ? isDark
                              ? alpha(primaryMain, 0.24)
                              : alpha(primaryMain, 0.12)
                            : "transparent",
                          border: selected
                            ? isDark
                              ? `1px solid ${alpha(primaryLight, 0.45)}`
                              : `1px solid ${alpha(primaryMain, 0.35)}`
                            : "1px solid transparent",
                          cursor: "pointer",
                          transition: "all .18s ease",
                          "&:hover": {
                            backgroundColor: selected
                              ? alpha(primaryMain, 0.3)
                              : hoverBg,
                          },
                        }}
                      >
                        {selected ? (
                          <Box
                            sx={{
                              position: "absolute",
                              left: 0,
                              top: 6,
                              bottom: 6,
                              width: 3,
                              borderRadius: 999,
                              bgcolor: isDark ? primaryLight : primaryMain,
                            }}
                          />
                        ) : null}
                        <Box
                          sx={{
                            display: "inline-flex",
                            color: selected
                              ? isDark
                                ? alpha(primaryLight, 0.95)
                                : primaryMain
                              : isDark
                                ? "rgba(230,237,248,0.86)"
                                : "#64748b",
                          }}
                        >
                          {item.icon}
                        </Box>
                        <Typography
                          variant="body2"
                          fontWeight={selected ? 700 : 500}
                          sx={{ color: selected ? (isDark ? "#f8fafc" : "#0f172a") : textPrimary }}
                        >
                          {item.label}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              ) : null}
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
};

export default OwnerSidebar;
