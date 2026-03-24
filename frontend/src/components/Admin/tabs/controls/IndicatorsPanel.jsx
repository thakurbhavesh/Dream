import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import useControlsApi from "../../../../hooks/useControlsApi";

const FIELDS = [
  { id: "forward", label: "Forward" },
  { id: "forkout", label: "Forkout" },
  { id: "typing", label: "Typing" },
  { id: "lastSeen", label: "Last Seen" },
  { id: "platform", label: "Platform" },
  { id: "employeeLabel", label: "Employee Label" },
  { id: "onCallLabel", label: "On Call Label" },
];

const DEFAULTS = Object.fromEntries(FIELDS.map((f) => [f.id, "enable"]));

// camelCase ↔ snake_case
const toSnake = (key) => key.replace(/([A-Z])/g, "_$1").toLowerCase();
const toCamel = (key) => key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

const fromApi = (data) => {
  if (!data) return DEFAULTS;
  const cfg = data.allowed_roles ?? {};
  return Object.fromEntries(
    FIELDS.map((f) => [f.id, cfg[toSnake(f.id)] ?? "enable"])
  );
};

const toApi = (state) => ({
  enabled: true,
  time_limit_minutes: null,
  allowed_roles: Object.fromEntries(
    FIELDS.map((f) => [toSnake(f.id), state[f.id]])
  ),
});

// ── Component ──────────────────────────────────────────────────────────────
const IndicatorsPanel = () => {
  const { loadSection, saveSection, isSaving, feedback, resetFeedback } =
    useControlsApi("indicators");

  const [value, setValue] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSection().then((data) => {
      if (data) setValue(fromApi(data));
      setLoaded(true);
    });
  }, [loadSection]);

  const allDisabled = Object.values(value).every((v) => v !== "enable");

  if (!loaded) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Typography variant="h6" color="primary" sx={{ mb: 3 }}>
        INDICATORS & MARKERS
      </Typography>
      <Stack spacing={1}>
        {FIELDS.map((field) => (
          <Stack
            key={field.id}
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            gap={8}
            sx={{ px: 1 }}
          >
            <Typography fontWeight={500}>{field.label}</Typography>
            <RadioGroup
              row
              value={value[field.id]}
              onChange={(e) => setValue((p) => ({ ...p, [field.id]: e.target.value }))}
            >
              <FormControlLabel value="enable" control={<Radio />} label="Enable" />
              <FormControlLabel value="disable" control={<Radio />} label="Disable" />
            </RadioGroup>
          </Stack>
        ))}
      </Stack>

      {allDisabled && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          All indicators are currently disabled. Members will not see typing, forwarded, or
          delivered markers.
        </Alert>
      )}

      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
        <Button
          variant="contained"
          color="error"
          disabled={isSaving}
          onClick={async () => {
            if (allDisabled) {
              const proceed = window.confirm(
                "All indicators are disabled. Users will not see typing, forwarded, or delivered markers. Continue?"
              );
              if (!proceed) return;
            }
            saveSection(toApi(value));
          }}
        >
          {isSaving ? <CircularProgress size={20} color="inherit" /> : "Apply"}
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

export default IndicatorsPanel;
