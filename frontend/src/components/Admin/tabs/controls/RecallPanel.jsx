import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { TimeWindowInputs } from "./sharedComponents";
import useControlsApi from "../../../../hooks/useControlsApi";

// ── Defaults ───────────────────────────────────────────────────────────────
const DEFAULTS = {
  enabled: true,
  window: { mode: "custom", hours: 0, minutes: 10 },
  roles: { user: false, admin: true },
  groupAdminCanRecall: true,
};

// ── API ↔ UI converters ────────────────────────────────────────────────────
const fromApi = (data) => {
  if (!data) return DEFAULTS;
  const cfg = data.allowed_roles ?? {};
  const mode = cfg.window_mode ?? "custom";
  let hours = cfg.hours ?? 0;
  let minutes = cfg.minutes ?? 10;
  if (mode === "custom" && data.time_limit_minutes != null) {
    hours = Math.floor(data.time_limit_minutes / 60);
    minutes = data.time_limit_minutes % 60;
  }
  return {
    enabled: data.enabled ?? true,
    window: { mode, hours, minutes },
    roles: { user: cfg.user ?? false, admin: cfg.admin ?? true },
    groupAdminCanRecall: cfg.group_admin_can_recall ?? true,
  };
};

const toApi = ({ enabled, window: win, roles, groupAdminCanRecall }) => ({
  enabled,
  time_limit_minutes:
    win.mode === "custom" ? win.hours * 60 + win.minutes : win.mode === "oneDay" ? 1440 : null,
  allowed_roles: {
    window_mode: win.mode,
    hours: win.hours,
    minutes: win.minutes,
    user: roles.user,
    admin: roles.admin,
    group_admin_can_recall: groupAdminCanRecall,
  },
});

// ── Component ──────────────────────────────────────────────────────────────
const RecallPanel = () => {
  const { loadSection, saveSection, isSaving, feedback, resetFeedback } =
    useControlsApi("recall");

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
        RECALL
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

      <Stack spacing={3}>
        <Box>
          <Typography fontWeight={600} sx={{ mb: 1 }}>
            *Recall within
          </Typography>
          <RadioGroup
            value={value.window.mode}
            onChange={(e) =>
              setValue((p) => ({ ...p, window: { ...p.window, mode: e.target.value } }))
            }
          >
            <FormControlLabel
              value="custom"
              control={<Radio />}
              label={
                <TimeWindowInputs
                  value={value.window}
                  onChange={(win) => setValue((p) => ({ ...p, window: { ...win, mode: "custom" } }))}
                />
              }
            />
            <FormControlLabel value="oneDay" control={<Radio />} label="1 day" />
            <FormControlLabel value="anyTime" control={<Radio />} label="Any Time" />
          </RadioGroup>
        </Box>

        <Box>
          <Typography fontWeight={600} sx={{ mb: 1 }}>
            *Who can Recall
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={value.roles.user}
                  onChange={(e) =>
                    setValue((p) => ({ ...p, roles: { ...p.roles, user: e.target.checked } }))
                  }
                />
              }
              label="User"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={value.roles.admin}
                  onChange={(e) =>
                    setValue((p) => ({ ...p, roles: { ...p.roles, admin: e.target.checked } }))
                  }
                />
              }
              label="Admin"
            />
          </FormGroup>
        </Box>

        <Box>
          <Typography fontWeight={600} sx={{ mb: 1 }}>
            Can group admin recall message
          </Typography>
          <RadioGroup
            row
            value={value.groupAdminCanRecall ? "yes" : "no"}
            onChange={(e) =>
              setValue((p) => ({ ...p, groupAdminCanRecall: e.target.value === "yes" }))
            }
          >
            <FormControlLabel value="yes" control={<Radio />} label="Yes" />
            <FormControlLabel value="no" control={<Radio />} label="No" />
          </RadioGroup>
        </Box>
      </Stack>

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

export default RecallPanel;
