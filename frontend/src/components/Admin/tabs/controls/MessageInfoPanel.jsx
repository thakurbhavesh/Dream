import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import useControlsApi from "../../../../hooks/useControlsApi";

// ── Defaults ───────────────────────────────────────────────────────────────
const DEFAULTS = {
  enabled: true,
  permissions: { readTime: false, deliveredTime: false, deviceInfo: false, location: true },
  otherControls: { groupVisibility: true, directVisibility: true },
};

const PERMISSION_LABELS = {
  readTime: "Read Time",
  deliveredTime: "Delivered Time",
  deviceInfo: "Device Info",
  location: "Location",
};

// ── API ↔ UI converters ────────────────────────────────────────────────────
const fromApi = (data) => {
  if (!data) return DEFAULTS;
  const cfg = data.allowed_roles ?? {};
  return {
    enabled: data.enabled ?? true,
    permissions: {
      readTime: cfg.read_time ?? false,
      deliveredTime: cfg.delivered_time ?? false,
      deviceInfo: cfg.device_info ?? false,
      location: cfg.location ?? true,
    },
    otherControls: {
      groupVisibility: cfg.group_visibility ?? true,
      directVisibility: cfg.direct_visibility ?? true,
    },
  };
};

const toApi = ({ enabled, permissions, otherControls }) => ({
  enabled,
  time_limit_minutes: null,
  allowed_roles: {
    read_time: permissions.readTime,
    delivered_time: permissions.deliveredTime,
    device_info: permissions.deviceInfo,
    location: permissions.location,
    group_visibility: otherControls.groupVisibility,
    direct_visibility: otherControls.directVisibility,
  },
});

// ── Component ──────────────────────────────────────────────────────────────
const MessageInfoPanel = () => {
  const { loadSection, saveSection, isSaving, feedback, resetFeedback } =
    useControlsApi("message_info");

  const [value, setValue] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSection().then((data) => {
      if (data) setValue(fromApi(data));
      setLoaded(true);
    });
  }, [loadSection]);

  if (!loaded) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
        MESSAGE INFO
      </Typography>
      <RadioGroup
        row
        value={value.enabled ? "enable" : "disable"}
        onChange={(e) => setValue((p) => ({ ...p, enabled: e.target.value === "enable" }))}
        sx={{ mb: 3 }}
      >
        <FormControlLabel value="enable" control={<Radio />} label="Enable" />
        <FormControlLabel value="disable" control={<Radio />} label="Disable" />
      </RadioGroup>

      {/* Permissions */}
      <Box sx={{ border: "1px solid", borderColor: "divider", p: 2, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography fontWeight={600}>Permissions</Typography>
          <Button
            size="small"
            onClick={() => {
              const allOn = Object.values(value.permissions).every(Boolean);
              setValue((p) => ({
                ...p,
                permissions: Object.fromEntries(
                  Object.keys(p.permissions).map((k) => [k, !allOn])
                ),
              }));
            }}
          >
            Hide / Show
          </Button>
        </Stack>
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {Object.entries(value.permissions).map(([field, enabled]) => (
            <Stack
              key={field}
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ border: "1px solid", borderColor: "divider", p: 1.5 }}
            >
              <Typography>{PERMISSION_LABELS[field]}</Typography>
              <Switch
                checked={enabled}
                onChange={(e) =>
                  setValue((p) => ({
                    ...p,
                    permissions: { ...p.permissions, [field]: e.target.checked },
                  }))
                }
              />
            </Stack>
          ))}
        </Stack>
      </Box>

      {/* Other Info Controls */}
      <Box sx={{ border: "1px solid", borderColor: "divider", p: 2 }}>
        <Typography fontWeight={600} sx={{ mb: 2 }}>
          Other Info Controls
        </Typography>
        <Stack spacing={1.5}>
          <FormControlLabel
            control={
              <Checkbox
                checked={value.otherControls.groupVisibility}
                onChange={(e) =>
                  setValue((p) => ({
                    ...p,
                    otherControls: { ...p.otherControls, groupVisibility: e.target.checked },
                  }))
                }
              />
            }
            label="Can see message info of other users in Group chat"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={value.otherControls.directVisibility}
                onChange={(e) =>
                  setValue((p) => ({
                    ...p,
                    otherControls: { ...p.otherControls, directVisibility: e.target.checked },
                  }))
                }
              />
            }
            label="Can see message info of other users in One-to-One chat"
          />
        </Stack>
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
        <Button variant="contained" color="error" onClick={() => saveSection(toApi(value))} disabled={isSaving}>
          {isSaving ? <CircularProgress size={20} color="inherit" /> : "Save"}
        </Button>
      </Box>

      <Snackbar
        open={Boolean(feedback)}
        autoHideDuration={3000}
        onClose={resetFeedback}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert onClose={resetFeedback} severity={feedback?.type ?? "success"} variant="filled">
          {feedback?.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default MessageInfoPanel;
