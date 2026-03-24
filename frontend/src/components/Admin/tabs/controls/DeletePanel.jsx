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
  Typography,
} from "@mui/material";
import useControlsApi from "../../../../hooks/useControlsApi";

// ── Defaults ───────────────────────────────────────────────────────────────
const DEFAULTS = {
  enabled: true,
  roles: { user: true, globalMember: true, tcxAdmin: true },
};

const ROLE_LABELS = {
  user: "User",
  globalMember: "Global Member",
  tcxAdmin: "TCX Admin",
};

// ── API ↔ UI converters ────────────────────────────────────────────────────
const fromApi = (data) => {
  if (!data) return DEFAULTS;
  const cfg = data.allowed_roles ?? {};
  return {
    enabled: data.enabled ?? true,
    roles: {
      user: cfg.user ?? true,
      globalMember: cfg.global_member ?? true,
      tcxAdmin: cfg.tcx_admin ?? true,
    },
  };
};

const toApi = ({ enabled, roles }) => ({
  enabled,
  time_limit_minutes: null,
  allowed_roles: {
    user: roles.user,
    global_member: roles.globalMember,
    tcx_admin: roles.tcxAdmin,
  },
});

// ── Component ──────────────────────────────────────────────────────────────
const DeletePanel = () => {
  const { loadSection, saveSection, isSaving, feedback, resetFeedback } =
    useControlsApi("delete");

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
        DELETE
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

      <Box sx={{ border: "1px solid", borderColor: "divider", p: 2 }}>
        <Typography fontWeight={600} sx={{ mb: 1 }}>
          *Who can Delete
        </Typography>
        <FormGroup>
          {Object.entries(ROLE_LABELS).map(([key, label]) => (
            <FormControlLabel
              key={key}
              control={
                <Checkbox
                  checked={Boolean(value.roles[key])}
                  onChange={(e) =>
                    setValue((p) => ({ ...p, roles: { ...p.roles, [key]: e.target.checked } }))
                  }
                />
              }
              label={label}
            />
          ))}
        </FormGroup>
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

export default DeletePanel;
