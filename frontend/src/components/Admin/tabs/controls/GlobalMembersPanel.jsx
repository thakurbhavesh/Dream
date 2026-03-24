import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import useControlsApi from "../../../../hooks/useControlsApi";

const TOGGLES = [
  { id: "cantBeAdded", apiKey: "cant_be_added", label: "Can't be added into groups" },
  { id: "cantSeeMessageInfo", apiKey: "cant_see_message_info", label: "Can't see message info of other users" },
  { id: "cantSeeProfileInfo", apiKey: "cant_see_profile_info", label: "Can't see Profile info of other users" },
  { id: "cantMakeOneToOne", apiKey: "cant_make_one_to_one", label: "Can't Make 1:1 calls" },
  { id: "cantMakeGroupCalls", apiKey: "cant_make_group_calls", label: "Can't Make Group calls" },
  { id: "replaceDotShade", apiKey: "replace_dot_shade", label: "Replace Global Dot with Light Global" },
];

const DEFAULTS = Object.fromEntries(TOGGLES.map((t) => [t.id, false]));

// ── API ↔ UI converters ────────────────────────────────────────────────────
const fromApi = (data) => {
  if (!data) return DEFAULTS;
  const cfg = data.allowed_roles ?? {};
  return Object.fromEntries(TOGGLES.map((t) => [t.id, cfg[t.apiKey] ?? false]));
};

const toApi = (state) => ({
  enabled: true,
  time_limit_minutes: null,
  allowed_roles: Object.fromEntries(TOGGLES.map((t) => [t.apiKey, state[t.id]])),
});

// ── Component ──────────────────────────────────────────────────────────────
const GlobalMembersPanel = () => {
  const { loadSection, saveSection, isSaving, feedback, resetFeedback } =
    useControlsApi("global_members");

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
        GLOBAL MEMBERS
      </Typography>
      <Stack spacing={1.5}>
        {TOGGLES.map((toggle) => (
          <FormControlLabel
            key={toggle.id}
            control={
              <Checkbox
                checked={Boolean(value[toggle.id])}
                onChange={(e) =>
                  setValue((p) => ({ ...p, [toggle.id]: e.target.checked }))
                }
              />
            }
            label={toggle.label}
          />
        ))}
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

export default GlobalMembersPanel;
