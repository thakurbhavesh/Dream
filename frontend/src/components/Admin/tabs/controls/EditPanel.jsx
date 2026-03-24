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
  window: { mode: "custom", hours: 0, minutes: 5, days: 1 },
  roles: { user: true, admin: true },
};

// ── API ↔ UI converters ────────────────────────────────────────────────────
const fromApi = (data) => {
  if (!data) return DEFAULTS;
  const cfg = data.allowed_roles ?? {};
  const mode = cfg.window_mode ?? "custom";
  let hours = cfg.hours ?? 0;
  let minutes = cfg.minutes ?? 5;
  let days = cfg.days ?? 1;
  if (mode === "custom" && data.time_limit_minutes != null) {
    const total = data.time_limit_minutes;
    days = Math.floor(total / 1440);
    hours = Math.floor((total % 1440) / 60);
    minutes = total % 60;
  }
  return {
    enabled: data.enabled ?? true,
    window: { mode, hours, minutes, days },
    roles: { user: cfg.user ?? true, admin: cfg.admin ?? true },
  };
};

const toApi = ({ enabled, window: win, roles }) => ({
  enabled,
  time_limit_minutes:
    win.mode === "custom" ? win.days * 1440 + win.hours * 60 + win.minutes : null,
  allowed_roles: {
    window_mode: win.mode,
    hours: win.hours,
    minutes: win.minutes,
    days: win.days,
    user: roles.user,
    admin: roles.admin,
  },
});

// ── Component ──────────────────────────────────────────────────────────────
const EditPanel = () => {
  const { loadSection, saveSection, isSaving, feedback, resetFeedback } =
    useControlsApi("edit");

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
        EDIT
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
            *Edit within
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
                  includeDays
                  value={value.window}
                  onChange={(win) => setValue((p) => ({ ...p, window: { ...win, mode: "custom" } }))}
                />
              }
            />
            <FormControlLabel value="anyTime" control={<Radio />} label="Any Time" />
          </RadioGroup>
        </Box>

        <Box>
          <Typography fontWeight={600} sx={{ mb: 1 }}>
            *Who can Edit
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

export default EditPanel;
