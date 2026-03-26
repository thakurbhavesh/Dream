import PropTypes from "prop-types";
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Typography,
  useTheme,
} from "@mui/material";
import { LuBellRing } from "react-icons/lu";

const NotificationTab = ({
  runtimeLabel,
  browserPermission,
  systemPreference,
  onTest,
  onOpenSettings,
  permissions,
  onTogglePermission,
  deviceCapabilities,
  soundOptions,
  selectedSound,
  onSoundChange,
  onSoundPreview,
  dndEnabled,
  onDNDToggle,
  dndSchedule,
  onDNDScheduleToggle,
  onDNDScheduleChange,
}) => {
  const theme = useTheme();
  const normalizedBrowser = (browserPermission || "unknown").toLowerCase();
  const browserChipColor =
    normalizedBrowser === "granted"
      ? theme.palette.success.main
      : normalizedBrowser === "blocked" || normalizedBrowser === "denied"
        ? theme.palette.error.main
        : theme.palette.warning.main;

  const systemLabel = systemPreference?.supported
    ? systemPreference.enabled === true
      ? "Allowed in OS"
      : systemPreference.enabled === false
        ? "Blocked by OS"
        : "Use OS default"
    : "Managed by browser";
  const systemNormalized = systemLabel.toLowerCase();
  const systemColor = systemNormalized.includes("blocked")
    ? theme.palette.error.main
    : systemNormalized.includes("allowed")
      ? theme.palette.success.main
      : "#556080";
  const runtimeChipColor =
    theme.palette.mode === "light"
      ? theme.palette.primary.main
      : theme.palette.grey[700];

  const statusChip = (label, color, helper) => (
    <Stack spacing={0.5} alignItems="center">
      <Chip
        label={label}
        size="small"
        sx={{ borderRadius: 0.5, bgcolor: color, color: "#fff" }}
      />
      {helper ? (
        <Typography variant="caption" color="text.secondary">
          {helper}
        </Typography>
      ) : null}
    </Stack>
  );

  return (
    <Stack spacing={3}>
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          borderRadius: 1,
          bgcolor:
            theme.palette.mode === "light"
              ? theme.palette.background.paper
              : theme.palette.background.default,
          border: `1px solid ${theme.palette.divider}`,
          p: 2,
        }}
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={3}
          alignItems={{ xs: "start", lg: "end" }}
        >
          <Stack
            spacing={2}
            alignItems={{ xs: "center", md: "flex-start" }}
            flex={1}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor:
                  theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
              }}
            >
              <LuBellRing />
            </Box>
            <Typography variant="h6" fontWeight={600}>
              Notification
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Choose how TeamChatX alerts you about updates.
            </Typography>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              justifyContent="center"
            >
              {statusChip(runtimeLabel, runtimeChipColor, "Runtime")}
              {statusChip(browserPermission, browserChipColor, "Permission")}
              {statusChip(systemLabel, systemColor, "System")}
            </Stack>
          </Stack>

          <Stack spacing={2} flex={1} height={"100%"}>
            {Array.isArray(soundOptions) && soundOptions.length > 0 && (
              <Stack spacing={1} justifyContent={"end"}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  textAlign={"end"}
                >
                  Notification tone
                </Typography>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  justifyContent={"end"}
                >
                  <FormControl size="small" sx={{ minWidth: 240 }}>
                    <InputLabel id="notification-sound-select">
                      Select sound
                    </InputLabel>
                    <Select
                      labelId="notification-sound-select"
                      label="Select sound"
                      value={selectedSound}
                      onChange={(event) => onSoundChange?.(event.target.value)}
                    >
                      {soundOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                  size="small"
                    variant="outlined"
                    onClick={onSoundPreview}
                  >
                    Play sound
                  </Button>
                </Stack>
              </Stack>
            )}

            <Stack spacing={2} flex={1} direction={"row"} justifyContent={"end"}>
              <Button
                variant="contained"
                size="small"
                color="primary"
                onClick={onTest}
              >
                Check notification
              </Button>
              <Button
              size="small"
                variant="outlined"
                onClick={onOpenSettings}
              >
                Open system settings
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          borderRadius: 1,
          p: 2,
          bgcolor:
            theme.palette.mode === "light"
              ? "#f8faff"
              : theme.palette.background.paper,
          color: "text.primary",
        }}
      >
        <Typography
          variant="h6"
          fontWeight={600}
          sx={{ mb: 3, display: "flex", alignItems: "center", gap: 1 }}
        >
          Permissions Management
        </Typography>
        <Stack spacing={2}>
          {permissions.map((permission) => {
            const capability = permission.requiresDevice
              ? deviceCapabilities?.[permission.requiresDevice]
              : null;
            const disabled = permission.requiresDevice && capability === false;
            const helperText = disabled
              ? `${permission.description} (device not detected)`
              : permission.requiresDevice && capability
                ? `${permission.description} (device ready)`
                : permission.description;
            return (
              <Stack
                key={permission.id}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  pb: 1.5,
                }}
              >
                <Stack spacing={0.3}>
                  <Typography fontWeight={600}>
                    {permission.label}:{" "}
                    <Typography
                      component="span"
                      color={
                        permission.enabled ? "success.light" : "error.light"
                      }
                    >
                      {permission.enabled ? "Granted" : "Blocked"}
                    </Typography>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {helperText}
                  </Typography>
                </Stack>
                <Switch
                  checked={permission.enabled}
                  onChange={() => onTogglePermission(permission.id)}
                  color="primary"
                  disabled={disabled}
                  inputProps={{ "aria-label": permission.label }}
                />
              </Stack>
            );
          })}
        </Stack>
      </Paper>

      {/* ─── Do Not Disturb ─────────────────────────────────────────── */}
      <Paper sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack spacing={2}>
          <Typography variant="subtitle1" fontWeight={700}>
            Do Not Disturb
          </Typography>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack>
              <Typography fontWeight={600}>DND Mode</Typography>
              <Typography variant="body2" color="text.secondary">
                Silence all notification sounds and popups
              </Typography>
            </Stack>
            <Switch
              checked={!!dndEnabled}
              onChange={() => onDNDToggle?.(!dndEnabled)}
              color="error"
              inputProps={{ "aria-label": "Do Not Disturb" }}
            />
          </Stack>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack>
              <Typography fontWeight={600}>Scheduled DND</Typography>
              <Typography variant="body2" color="text.secondary">
                Automatically enable DND during set hours
              </Typography>
            </Stack>
            <Switch
              checked={!!dndSchedule?.active}
              onChange={() => onDNDScheduleToggle?.(!dndSchedule?.active)}
              color="primary"
              inputProps={{ "aria-label": "Scheduled DND" }}
            />
          </Stack>

          {dndSchedule?.active && (
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 110 }}>
                <InputLabel>Start</InputLabel>
                <Select
                  value={dndSchedule?.startTime || "22:00"}
                  label="Start"
                  onChange={(e) => onDNDScheduleChange?.({ ...dndSchedule, startTime: e.target.value })}
                >
                  {Array.from({ length: 24 }, (_, h) => [`${String(h).padStart(2, "0")}:00`, `${String(h).padStart(2, "0")}:30`]).flat().map((t) => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="body2">to</Typography>
              <FormControl size="small" sx={{ minWidth: 110 }}>
                <InputLabel>End</InputLabel>
                <Select
                  value={dndSchedule?.endTime || "07:00"}
                  label="End"
                  onChange={(e) => onDNDScheduleChange?.({ ...dndSchedule, endTime: e.target.value })}
                >
                  {Array.from({ length: 24 }, (_, h) => [`${String(h).padStart(2, "0")}:00`, `${String(h).padStart(2, "0")}:30`]).flat().map((t) => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
};

NotificationTab.propTypes = {
  runtimeLabel: PropTypes.string,
  browserPermission: PropTypes.string,
  systemPreference: PropTypes.shape({
    supported: PropTypes.bool,
    enabled: PropTypes.oneOfType([PropTypes.bool, PropTypes.oneOf([null])]),
  }),
  onTest: PropTypes.func,
  onOpenSettings: PropTypes.func,
  permissions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      label: PropTypes.string,
      description: PropTypes.string,
      enabled: PropTypes.bool,
      requiresDevice: PropTypes.string,
    })
  ),
  onTogglePermission: PropTypes.func,
  deviceCapabilities: PropTypes.shape({
    microphone: PropTypes.bool,
    camera: PropTypes.bool,
  }),
  soundOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string,
      label: PropTypes.string,
    })
  ),
  selectedSound: PropTypes.string,
  onSoundChange: PropTypes.func,
  onSoundPreview: PropTypes.func,
};

NotificationTab.defaultProps = {
  runtimeLabel: "Web",
  browserPermission: "default",
  systemPreference: {
    supported: false,
    enabled: null,
  },
  onTest: () => {},
  onOpenSettings: () => {},
  permissions: [],
  onTogglePermission: () => {},
  deviceCapabilities: {},
  soundOptions: [],
  selectedSound: "",
  onSoundChange: () => {},
  onSoundPreview: () => {},
};

export default NotificationTab;
