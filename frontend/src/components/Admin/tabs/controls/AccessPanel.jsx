import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { API_BASE_URL } from "../../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../../utils/authApi";

// GET /platforms  →  { data: { count, rows: [{ platform_id, platform_name, platform_key, ... }] } }
// GET /organization-restrictions/ip  →  { data: { count, rows: [{ restriction_id, ip_address, status, note }] } }
// GET /organization-restrictions/platform  →  { data: { count, rows: [{ restriction_id, platform_id, restriction_type, status, platform_name }] } }

const AccessPanel = () => {
  // ── IP state ───────────────────────────────────────────────────────────────
  const [restrictByIp, setRestrictByIp] = useState(false);
  const [ipMode, setIpMode] = useState("block"); // stored in `note` field
  const [ipAddress, setIpAddress] = useState("");
  const [ipList, setIpList] = useState([]); // active rows from API

  // ── Platform state ─────────────────────────────────────────────────────────
  const [restrictByPlatform, setRestrictByPlatform] = useState(false);
  const [platforms, setPlatforms] = useState([]);          // from GET /platforms
  const [platformRestrictions, setPlatformRestrictions] = useState([]); // active rows from API

  // ── UI state ───────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [addingIp, setAddingIp] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [togglingKey, setTogglingKey] = useState(null);
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });

  const showToast = (message, severity = "success") =>
    setToast({ open: true, message, severity });

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [plRes, ipRes, prRes] = await Promise.all([
        fetchWithAuth(`${API_BASE_URL}/platforms`),
        fetchWithAuth(`${API_BASE_URL}/organization-restrictions/ip`),
        fetchWithAuth(`${API_BASE_URL}/organization-restrictions/platform`),
      ]);

      // Platforms  →  data.rows
      if (plRes.response.ok) {
        const rows = plRes.payload?.data?.rows ?? [];
        setPlatforms(rows);
      }

      // IP restrictions  →  data.rows, only active
      if (ipRes.response.ok) {
        const rows = (ipRes.payload?.data?.rows ?? []).filter((r) => r.status === "active");
        setIpList(rows);
        if (rows.length > 0) setRestrictByIp(true);
      }

      // Platform restrictions  →  data.rows, only active
      if (prRes.response.ok) {
        const rows = (prRes.payload?.data?.rows ?? []).filter((r) => r.status === "active");
        setPlatformRestrictions(rows);
        if (rows.length > 0) setRestrictByPlatform(true);
      }
    } catch {
      showToast("Failed to load access settings", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── IP handlers ────────────────────────────────────────────────────────────

  const handleAddIp = async () => {
    const trimmed = ipAddress.trim();
    if (!trimmed) return;
    setAddingIp(true);
    try {
      // Body: { ip_address, status: "active", note: "allow"|"block" }
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/organization-restrictions/ip`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ip_address: trimmed, status: "active", note: ipMode }),
        }
      );
      if (response.ok) {
        const created = payload?.data ?? payload;
        setIpList((prev) => [created, ...prev]);
        setIpAddress("");
        showToast("IP address added");
      } else {
        showToast(payload?.message ?? "Failed to add IP address", "error");
      }
    } catch {
      showToast("Failed to add IP address", "error");
    } finally {
      setAddingIp(false);
    }
  };

  const handleRemoveIp = async (restrictionId) => {
    setRemovingId(restrictionId);
    try {
      // PATCH  →  { status: "inactive" }
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/organization-restrictions/ip/${restrictionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "inactive" }),
        }
      );
      if (response.ok) {
        setIpList((prev) => prev.filter((e) => e.restriction_id !== restrictionId));
        showToast("IP address removed");
      } else {
        showToast(payload?.message ?? "Failed to remove IP address", "error");
      }
    } catch {
      showToast("Failed to remove IP address", "error");
    } finally {
      setRemovingId(null);
    }
  };

  // ── Platform handlers ──────────────────────────────────────────────────────

  const getRestriction = (platformId, restrictionType) =>
    platformRestrictions.find(
      (r) => r.platform_id === platformId && r.restriction_type === restrictionType
    );

  const handlePlatformToggle = async (platformId, restrictionType, checked) => {
    const key = `${platformId}-${restrictionType}`;
    setTogglingKey(key);
    const existing = getRestriction(platformId, restrictionType);

    try {
      if (checked && !existing) {
        // POST  →  { platform_id, restriction_type, status: "active" }
        const { response, payload } = await fetchWithAuth(
          `${API_BASE_URL}/organization-restrictions/platform`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform_id: platformId, restriction_type: restrictionType, status: "active" }),
          }
        );
        if (response.ok) {
          const created = payload?.data ?? payload;
          setPlatformRestrictions((prev) => [created, ...prev]);
        } else {
          showToast(payload?.message ?? "Failed to update platform restriction", "error");
        }
      } else if (!checked && existing) {
        // PATCH  →  { status: "inactive" }
        const { response, payload } = await fetchWithAuth(
          `${API_BASE_URL}/organization-restrictions/platform/${existing.restriction_id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "inactive" }),
          }
        );
        if (response.ok) {
          setPlatformRestrictions((prev) =>
            prev.filter((r) => r.restriction_id !== existing.restriction_id)
          );
        } else {
          showToast(payload?.message ?? "Failed to update platform restriction", "error");
        }
      }
    } catch {
      showToast("Failed to update platform restriction", "error");
    } finally {
      setTogglingKey(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
        ACCESS
      </Typography>

      <Stack spacing={3}>
        {/* ── Restrict by IP ── */}
        <Box sx={{ border: "1px solid", borderColor: "divider", p: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={restrictByIp}
                onChange={(e) => setRestrictByIp(e.target.checked)}
              />
            }
            label="Restrict by IP"
          />

          {restrictByIp && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              {/* Allow / Block mode for new entries (stored in note) */}
              <RadioGroup row value={ipMode} onChange={(e) => setIpMode(e.target.value)}>
                <FormControlLabel value="allow" control={<Radio />} label="Allow" />
                <FormControlLabel value="block" control={<Radio />} label="Block" />
              </RadioGroup>

              {/* IP input row */}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Enter IP address"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddIp()}
                  size="small"
                  fullWidth
                />
                <Button
                  variant="contained"
                  onClick={handleAddIp}
                  disabled={addingIp || !ipAddress.trim()}
                  sx={{ minWidth: 80 }}
                >
                  {addingIp ? <CircularProgress size={18} color="inherit" /> : "ADD"}
                </Button>
              </Stack>

              {/* IP list */}
              <Box sx={{ border: "1px dashed", borderColor: "divider", minHeight: 64, p: 2 }}>
                {ipList.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No IP addresses added
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {ipList.map((entry) => (
                      <Stack
                        key={entry.restriction_id}
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography variant="body2">
                          {entry.ip_address}
                          {entry.note && (
                            <Typography
                              component="span"
                              variant="caption"
                              sx={{ ml: 1, color: "text.secondary" }}
                            >
                              ({entry.note})
                            </Typography>
                          )}
                        </Typography>
                        <Button
                          size="small"
                          color="error"
                          disabled={removingId === entry.restriction_id}
                          onClick={() => handleRemoveIp(entry.restriction_id)}
                        >
                          {removingId === entry.restriction_id ? (
                            <CircularProgress size={14} color="inherit" />
                          ) : (
                            "Remove"
                          )}
                        </Button>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          )}
        </Box>

        {/* ── Restrict by Platform ── */}
        <Box sx={{ border: "1px solid", borderColor: "divider", p: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={restrictByPlatform}
                onChange={(e) => setRestrictByPlatform(e.target.checked)}
              />
            }
            label="Restrict by Platform"
          />

          {restrictByPlatform && (
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 2 }}>
              {/* Allow column */}
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={600} sx={{ mb: 1 }}>
                  Allow
                </Typography>
                <Stack sx={{ border: "1px solid", borderColor: "divider", minHeight: 200 }}>
                  {platforms.map((platform) => {
                    const key = `${platform.platform_id}-allow`;
                    return (
                      <FormControlLabel
                        key={platform.platform_id}
                        sx={{ m: 0, px: 1.5 }}
                        control={
                          <Checkbox
                            checked={!!getRestriction(platform.platform_id, "allow")}
                            disabled={togglingKey === key}
                            onChange={(e) =>
                              handlePlatformToggle(platform.platform_id, "allow", e.target.checked)
                            }
                          />
                        }
                        label={platform.platform_name}
                      />
                    );
                  })}
                </Stack>
              </Box>

              {/* Block column */}
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={600} sx={{ mb: 1 }}>
                  Block
                </Typography>
                <Stack sx={{ border: "1px solid", borderColor: "divider", minHeight: 200 }}>
                  {platforms.map((platform) => {
                    const key = `${platform.platform_id}-block`;
                    return (
                      <FormControlLabel
                        key={platform.platform_id}
                        sx={{ m: 0, px: 1.5 }}
                        control={
                          <Checkbox
                            checked={!!getRestriction(platform.platform_id, "block")}
                            disabled={togglingKey === key}
                            onChange={(e) =>
                              handlePlatformToggle(platform.platform_id, "block", e.target.checked)
                            }
                          />
                        }
                        label={platform.platform_name}
                      />
                    );
                  })}
                </Stack>
              </Box>
            </Stack>
          )}
        </Box>
      </Stack>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default AccessPanel;
