import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { API_BASE_URL } from "../../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../../utils/authApi";

const PERMISSION_OPTIONS = [
  { value: "show", label: "Show" },
  { value: "hide", label: "Hide" },
  { value: "disable", label: "Disable" },
];

const TONE_COLORS = {
  normal: "#1f6feb",
  danger: "#d32f2f",
  warning: "#f57c00",
};

const MessageMenuPanel = () => {
  const [items, setItems] = useState([]);
  const [permMap, setPermMap] = useState({}); // menu_item_id → { permission_id, permission_type }
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(null); // menu_item_id being saved
  const [feedback, setFeedback] = useState(null);

  const load = useCallback(async () => {
    try {
      const [itemsRes, permsRes] = await Promise.all([
        fetchWithAuth(`${API_BASE_URL}/message-menu-items?limit=100`),
        fetchWithAuth(`${API_BASE_URL}/organization-message-menu-permissions?limit=100`),
      ]);

      const menuItems = itemsRes.payload?.data?.rows ?? [];
      const orgPerms = permsRes.payload?.data?.rows ?? [];

      setItems(menuItems);

      const map = {};
      for (const p of orgPerms) {
        if (p.status === "active") {
          map[p.menu_item_id] = { permission_id: p.permission_id, permission_type: p.permission_type };
        }
      }
      setPermMap(map);
    } catch {
      setFeedback({ type: "error", message: "Failed to load menu items." });
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleChange = async (item, newType) => {
    const existing = permMap[item.menu_item_id];
    setSaving(item.menu_item_id);
    try {
      if (existing) {
        const { response } = await fetchWithAuth(
          `${API_BASE_URL}/organization-message-menu-permissions/${existing.permission_id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ permission_type: newType }),
          }
        );
        if (!response.ok) throw new Error("Failed to update");
        setPermMap((prev) => ({
          ...prev,
          [item.menu_item_id]: { ...existing, permission_type: newType },
        }));
      } else {
        const { response, payload } = await fetchWithAuth(
          `${API_BASE_URL}/organization-message-menu-permissions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              menu_item_id: item.menu_item_id,
              permission_type: newType,
              status: "active",
            }),
          }
        );
        if (!response.ok) throw new Error("Failed to create");
        const created = payload?.data;
        setPermMap((prev) => ({
          ...prev,
          [item.menu_item_id]: {
            permission_id: created.permission_id,
            permission_type: newType,
          },
        }));
      }
      setFeedback({ type: "success", message: `"${item.label}" updated.` });
    } catch {
      setFeedback({ type: "error", message: "Failed to save change." });
    } finally {
      setSaving(null);
    }
  };

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
        MESSAGE MENU PERMISSIONS
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Control which message menu options are visible or available to users in your organization.
      </Typography>

      {items.length === 0 ? (
        <Typography color="text.secondary">No menu items configured.</Typography>
      ) : (
        <Stack spacing={0}>
          {items.map((item, index) => {
            const currentType = permMap[item.menu_item_id]?.permission_type ?? item.default_status ?? "show";
            const isSavingThis = saving === item.menu_item_id;
            const accentColor = TONE_COLORS[item.tone] ?? TONE_COLORS.normal;

            return (
              <Stack
                key={item.menu_item_id}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{
                  px: 2,
                  py: 1.5,
                  borderBottom: index < items.length - 1 ? "1px solid" : "none",
                  borderColor: "divider",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 4,
                      height: 28,
                      bgcolor: accentColor,
                      flexShrink: 0,
                      borderRadius: 1,
                    }}
                  />
                  <Stack>
                    <Typography variant="body2" fontWeight={500}>
                      {item.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.menu_key}
                      {item.scope && item.scope !== "any" ? ` · ${item.scope}` : ""}
                    </Typography>
                  </Stack>
                </Stack>

                <Stack direction="row" alignItems="center" spacing={1}>
                  {isSavingThis && <CircularProgress size={16} />}
                  <FormControl size="small" sx={{ minWidth: 110 }}>
                    <Select
                      value={currentType}
                      onChange={(e) => handleChange(item, e.target.value)}
                      disabled={isSavingThis}
                      sx={{ fontSize: 13 }}
                    >
                      {PERMISSION_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 13 }}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </Stack>
            );
          })}
        </Stack>
      )}

      <Snackbar
        open={Boolean(feedback)}
        autoHideDuration={3000}
        onClose={() => setFeedback(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() => setFeedback(null)}
          severity={feedback?.type ?? "success"}
          variant="filled"
        >
          {feedback?.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default MessageMenuPanel;
