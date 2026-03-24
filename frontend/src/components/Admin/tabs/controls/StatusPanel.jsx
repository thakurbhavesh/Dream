import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  InputBase,
  MenuItem,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { MdCheck, MdClose, MdEdit } from "react-icons/md";
import useControlsApi from "../../../../hooks/useControlsApi";

// ── Defaults ───────────────────────────────────────────────────────────────
const DEFAULTS = {
  general: { available: true, doNotDisturb: true, away: true, idle: true },
  limits: { autoAwayMinutes: 10, idleMinutes: 5 },
  optional: {
    enabled: false,
    options: [
      { id: "cantChat", label: "Can't Chat", active: false },
      { id: "inMeeting", label: "In Meeting", active: false },
      { id: "awayOptional", label: "Away", active: false },
    ],
  },
};

const GENERAL_LABELS = {
  available: "Available",
  doNotDisturb: "Do Not Disturb",
  away: "Away",
  idle: "Idle",
};

// ── API ↔ UI converters ────────────────────────────────────────────────────
const fromApi = (data) => {
  if (!data) return DEFAULTS;
  const cfg = data.allowed_roles ?? {};
  return {
    general: {
      available: cfg.available ?? true,
      doNotDisturb: cfg.do_not_disturb ?? true,
      away: cfg.away ?? true,
      idle: cfg.idle ?? true,
    },
    limits: {
      autoAwayMinutes: cfg.auto_away_minutes ?? 10,
      idleMinutes: cfg.idle_minutes ?? 5,
    },
    optional: {
      enabled: cfg.optional_enabled ?? false,
      options: Array.isArray(cfg.optional_items) && cfg.optional_items.length
        ? cfg.optional_items
        : DEFAULTS.optional.options,
    },
  };
};

const toApi = ({ general, limits, optional }) => ({
  enabled: true,
  time_limit_minutes: null,
  allowed_roles: {
    available: general.available,
    do_not_disturb: general.doNotDisturb,
    away: general.away,
    idle: general.idle,
    auto_away_minutes: limits.autoAwayMinutes,
    idle_minutes: limits.idleMinutes,
    optional_enabled: optional.enabled,
    optional_items: optional.options,
  },
});

// ── Component ──────────────────────────────────────────────────────────────
const StatusPanel = () => {
  const { loadSection, saveSection, isSaving, feedback, resetFeedback } =
    useControlsApi("status");

  const [value, setValue] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [editingOption, setEditingOption] = useState(null);
  const [editingValue, setEditingValue] = useState("");

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
        STATUS
      </Typography>
      <Stack spacing={2}>
        {/* General */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            General
          </Typography>
          <Stack spacing={1.5} sx={{ border: "1px solid", borderColor: "divider", p: 2 }}>
            {Object.entries(value.general).map(([key, checked]) => (
              <FormControlLabel
                key={key}
                control={
                  <Checkbox
                    checked={checked}
                    onChange={(e) =>
                      setValue((p) => ({
                        ...p,
                        general: { ...p.general, [key]: e.target.checked },
                      }))
                    }
                  />
                }
                label={GENERAL_LABELS[key]}
              />
            ))}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="flex-end">
              <TextField
                select
                fullWidth
                label="Auto away (mins)"
                value={value.limits.autoAwayMinutes}
                onChange={(e) =>
                  setValue((p) => ({
                    ...p,
                    limits: { ...p.limits, autoAwayMinutes: Number(e.target.value) },
                  }))
                }
                size="medium"
              >
                {[5, 10, 15, 30, 60].map((opt) => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                label="Idle (mins)"
                value={value.limits.idleMinutes}
                onChange={(e) =>
                  setValue((p) => ({
                    ...p,
                    limits: { ...p.limits, idleMinutes: Number(e.target.value) },
                  }))
                }
                size="medium"
              >
                {[5, 10, 30, 60].map((opt) => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </TextField>
            </Stack>
          </Stack>
        </Box>

        <Divider />

        {/* Optional */}
        <Box>
          <Stack spacing={1}>
            <Typography variant="subtitle2">Optional</Typography>
            <RadioGroup
              row
              value={value.optional.enabled ? "enabled" : "disabled"}
              onChange={(e) =>
                setValue((p) => ({
                  ...p,
                  optional: { ...p.optional, enabled: e.target.value === "enabled" },
                }))
              }
            >
              <FormControlLabel value="enabled" control={<Radio />} label="Enable" />
              <FormControlLabel value="disabled" control={<Radio />} label="Disable" />
            </RadioGroup>
          </Stack>
          <Stack
            spacing={1}
            sx={{ width: "50%", border: "1px solid", borderColor: "divider", mt: 2, p: 1 }}
          >
            {value.optional.options.map((option, index) => {
              const isEditing = editingOption === option.id;
              const accentColor = ["#F57C00", "#0288D1", "#7B1FA2"][index % 3];
              return (
                <Stack key={option.id} direction="row" alignItems="center" spacing={1.5}>
                  <Checkbox
                    checked={option.active}
                    disabled={!value.optional.enabled}
                    onChange={(e) =>
                      setValue((p) => ({
                        ...p,
                        optional: {
                          ...p.optional,
                          options: p.optional.options.map((o) =>
                            o.id === option.id ? { ...o, active: e.target.checked } : o
                          ),
                        },
                      }))
                    }
                  />
                  <Box sx={{ width: 8, height: 28, bgcolor: accentColor, flexShrink: 0 }} />
                  {isEditing ? (
                    <InputBase
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      autoFocus
                      sx={{ flex: 1, px: 1, py: 0.5, border: "1px solid", borderColor: "divider", bgcolor: "#fff" }}
                    />
                  ) : (
                    <Typography sx={{ flex: 1 }}>{option.label}</Typography>
                  )}
                  {isEditing ? (
                    <Stack direction="row" spacing={0.5}>
                      <IconButton
                        color="primary"
                        size="small"
                        onClick={() => {
                          if (!editingValue.trim()) return;
                          setValue((p) => ({
                            ...p,
                            optional: {
                              ...p.optional,
                              options: p.optional.options.map((o) =>
                                o.id === option.id ? { ...o, label: editingValue.trim() } : o
                              ),
                            },
                          }));
                          setEditingOption(null);
                        }}
                      >
                        <MdCheck size={18} />
                      </IconButton>
                      <IconButton
                        color="inherit"
                        size="small"
                        onClick={() => { setEditingOption(null); setEditingValue(""); }}
                      >
                        <MdClose size={18} />
                      </IconButton>
                    </Stack>
                  ) : (
                    <IconButton
                      size="small"
                      color="primary"
                      disabled={!value.optional.enabled}
                      onClick={() => { setEditingOption(option.id); setEditingValue(option.label); }}
                    >
                      <MdEdit size={18} />
                    </IconButton>
                  )}
                </Stack>
              );
            })}
          </Stack>
        </Box>
      </Stack>

      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
        <Button variant="contained" color="error" onClick={() => saveSection(toApi(value))} disabled={isSaving}>
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

export default StatusPanel;
