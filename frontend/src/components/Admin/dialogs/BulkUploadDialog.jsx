import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  HiOutlineCloudArrowUp,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineXMark,
} from "react-icons/hi2";
import { API_BASE_URL } from "../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../utils/authApi";
import { isBusinessEmail, isValidEmail } from "../../../utils/businessEmail";

const makeRowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createRow = () => ({
  id: makeRowId(),
  name: "",
  email: "",
  saving: false,
  saved: false,
  error: "",
});

const normalizeDomain = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/^@/, "");

const getEmailDomain = (email) => normalizeDomain(String(email || "").split("@")[1] || "");

const BulkUploadDialog = ({
  triggerSx = {},
  onUsersChanged,
  organizationCustomDomain = "",
  maxUsers = 0,
  activeUsers = 0,
}) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([createRow()]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

  const normalizedOrgDomain = useMemo(
    () => normalizeDomain(organizationCustomDomain),
    [organizationCustomDomain],
  );
  const hasSeatLimit = Number(maxUsers) > 0;
  const seatsRemaining = hasSeatLimit
    ? Math.max(Number(maxUsers) - Number(activeUsers || 0) - Number(createdCount || 0), 0)
    : null;
  const licenseFull = hasSeatLimit && seatsRemaining <= 0;

  const handleOpen = () => setOpen(true);

  const handleClose = () => {
    setOpen(false);
    setRows([createRow()]);
    setBulkSaving(false);
    setCreatedCount(0);
  };

  const showSnackbar = (message, severity = "info") => {
    setSnackbar({ open: true, message, severity });
  };

  const updateRow = (rowId, patch) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
            ...row,
            ...patch,
          }
          : row,
      ),
    );
  };

  const handleAddRow = () => {
    if (licenseFull) {
      showSnackbar(
        `License limit reached (${activeUsers + createdCount}/${maxUsers}). Upgrade licenses to add more users.`,
        "warning",
      );
      return;
    }
    setRows((prev) => [...prev, createRow()]);
  };

  const handleRemoveRow = (rowId) => {
    setRows((prev) => {
      if (prev.length <= 1) {
        return [createRow()];
      }
      return prev.filter((row) => row.id !== rowId);
    });
  };

  const handleFieldChange = (rowId, field) => (event) => {
    const value = field === "email"
      ? String(event.target.value || "").trim().toLowerCase()
      : event.target.value;
    updateRow(rowId, { [field]: value, error: "", saved: false });
  };

  const validateRow = (row) => {
    const name = String(row?.name || "").trim();
    const email = String(row?.email || "").trim().toLowerCase();
    if (!name || !email) return "Name and email are required.";
    if (!isValidEmail(email)) return "Valid email is required.";
    if (!isBusinessEmail(email)) return "Only business email is allowed.";
    return "";
  };

  const saveRow = async (rowId, options = {}) => {
    const { skipRefresh = false, silent = false } = options;
    const currentRow = rows.find((item) => item.id === rowId);
    if (!currentRow) return { ok: false, skipped: true };

    const validationError = validateRow(currentRow);
    if (validationError) {
      updateRow(rowId, { error: validationError });
      if (!silent) showSnackbar(validationError, "warning");
      return { ok: false };
    }

    if (licenseFull) {
      const message = `License limit reached (${activeUsers + createdCount}/${maxUsers}).`;
      updateRow(rowId, { error: message });
      if (!silent) showSnackbar(message, "error");
      return;
    }

    const email = String(currentRow.email || "").trim().toLowerCase();
    const isCrossDomainEmail =
      Boolean(normalizedOrgDomain) &&
      Boolean(getEmailDomain(email)) &&
      getEmailDomain(email) !== normalizedOrgDomain;

    updateRow(rowId, { saving: true, error: "" });
    try {
      const payload = {
        name: String(currentRow.name || "").trim(),
        email,
        role_id: 4,
        is_platform_admin: false,
        is_global_member: Boolean(isCrossDomainEmail),
      };
      const { response, payload: result } = await fetchWithAuth(`${API_BASE_URL}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok || result?.status === "error") {
        throw new Error(result?.message || "Unable to create user");
      }
      updateRow(rowId, { saving: false, saved: true, error: "" });
      setCreatedCount((prev) => prev + 1);
      if (!skipRefresh && typeof onUsersChanged === "function") {
        await onUsersChanged();
      }
      if (!silent) showSnackbar(`Saved: ${payload.name}`, "success");
      return { ok: true };
    } catch (error) {
      const message = String(error?.message || "Unable to create user");
      updateRow(rowId, { saving: false, error: message });
      if (!silent) showSnackbar(message, "error");
      return { ok: false };
    }
  };

  const handleSaveAll = async () => {
    const targetRows = rows.filter((row) => !row.saved);
    if (!targetRows.length) {
      showSnackbar("All rows are already saved.", "info");
      return;
    }
    setBulkSaving(true);
    let successCount = 0;
    let failedCount = 0;
    for (const row of targetRows) {
      const result = await saveRow(row.id, { skipRefresh: true, silent: true });
      if (result?.ok) successCount += 1;
      else if (!result?.skipped) failedCount += 1;
    }
    if (successCount > 0 && typeof onUsersChanged === "function") {
      await onUsersChanged();
    }
    if (successCount > 0 && failedCount === 0) {
      showSnackbar(`Saved all ${successCount} users.`, "success");
    } else if (successCount > 0) {
      showSnackbar(`Saved ${successCount}, failed ${failedCount}.`, "warning");
    } else {
      showSnackbar("No users were saved. Please fix row errors and try again.", "error");
    }
    setBulkSaving(false);
  };

  const handleCloseSnackbar = () => setSnackbar((prev) => ({ ...prev, open: false }));

  return (
    <>
      <Button
        variant="contained"
        onClick={handleOpen}
        startIcon={<HiOutlineCloudArrowUp size={18} />}
        sx={{
          height: 42,
          px: 2.1,
          borderRadius: 1.8,
          fontSize: "0.82rem",
          fontWeight: 800,
          letterSpacing: "0.02em",
          textTransform: "none",
          color: "#fff",
          boxShadow: "none",
          background:
            theme.palette.mode === "light"
              ? "linear-gradient(135deg, #0f766e 0%, #0f8a80 45%, #14b8a6 100%)"
              : "linear-gradient(135deg, #115e59 0%, #0f766e 45%, #14b8a6 100%)",
          "&:hover": {
            boxShadow: "none",
            filter: "brightness(1.03)",
          },
          ...triggerSx,
        }}
      >
        Bulk Upload
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            width: { xs: "calc(100vw - 16px)", md: "calc(100vw - 40px)" },
            maxWidth: "none",
            m: { xs: 1, md: 2.5 },
            borderRadius: 4,
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        <Box
          sx={{
            px: { xs: 2.4, md: 3.2 },
            py: { xs: 2.2, md: 2.8 },
            color: "#fff",
            background:
              theme.palette.mode === "light"
                ? "linear-gradient(135deg, #0f172a 0%, #0f3a68 50%, #0ea5e9 100%)"
                : "linear-gradient(135deg, #020617 0%, #0f172a 45%, #0369a1 100%)",
          }}
        >
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
            <Stack spacing={0.7}>
              <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.78)", letterSpacing: "0.12em" }}>
                Members Import
              </Typography>
              <Typography variant="h5" fontWeight={900}>
                Bulk Upload
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.82)", maxWidth: 520 }}>
                Add members directly in this modal with name and email. Use save per row or save all rows together.
              </Typography>
            </Stack>
            <IconButton onClick={handleClose} sx={{ color: "#fff", mt: -0.5, mr: -0.5 }}>
              <HiOutlineXMark />
            </IconButton>
          </Stack>
        </Box>

        <DialogContent sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={2.2}>
            <Box
              sx={{
                p: 2,
                borderRadius: 3,
                border: "1px solid",
                borderColor: alpha(theme.palette.primary.main, 0.16),
                background: alpha(theme.palette.primary.main, 0.04),
              }}
            >
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
                <Stack spacing={0.6}>
                  <Typography fontWeight={800}>Manual Member Entry</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Enter one member per row with name and business email.
                  </Typography>
                </Stack>
                <Button
                  variant="outlined"
                  onClick={handleAddRow}
                  startIcon={<HiOutlinePlus size={16} />}
                  disabled={licenseFull || bulkSaving}
                  sx={{ borderRadius: 1.8, fontWeight: 700, textTransform: "none" }}
                >
                  Add Row
                </Button>
              </Stack>
            </Box>

            <Box
              sx={{
                p: 2,
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
                backgroundColor: "background.paper",
              }}
            >
              <Stack spacing={1.2}>
                {rows.map((row, index) => (
                  <Box
                    key={row.id}
                    sx={{
                      p: 1.2,
                      borderRadius: 2.2,
                      border: "1px solid",
                      borderColor: row.error
                        ? alpha(theme.palette.error.main, 0.4)
                        : row.saved
                          ? alpha(theme.palette.success.main, 0.35)
                          : "divider",
                      background: row.saved
                        ? alpha(theme.palette.success.main, 0.06)
                        : "background.paper",
                    }}
                  >
                    <Stack spacing={1}>
                      <Typography variant="caption" color="text.secondary">
                        Row {index + 1}
                      </Typography>
                      <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Name"
                          value={row.name}
                          disabled={row.saving || bulkSaving}
                          onChange={handleFieldChange(row.id, "name")}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          label="Email"
                          value={row.email}
                          disabled={row.saving || bulkSaving}
                          onChange={handleFieldChange(row.id, "email")}
                        />
                        <Button
                          variant="contained"
                          onClick={() => void saveRow(row.id)}
                          disabled={row.saving || row.saved || bulkSaving}
                          sx={{ minWidth: 122, textTransform: "none", fontWeight: 700 }}
                        >
                          {row.saving ? "Saving..." : row.saved ? "Saved" : "Save Single"}
                        </Button>
                        <IconButton
                          onClick={() => handleRemoveRow(row.id)}
                          disabled={row.saving || bulkSaving}
                          color="error"
                        >
                          <HiOutlineTrash size={18} />
                        </IconButton>
                      </Stack>
                      {row.error ? (
                        <Alert severity="error" sx={{ py: 0 }}>
                          {row.error}
                        </Alert>
                      ) : null}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>

            <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
              <Box
                sx={{
                  flex: 1,
                  p: 2,
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                  background: theme.palette.mode === "light"
                    ? "#fbfdff"
                    : alpha(theme.palette.common.white, 0.02),
                }}
              >
                <Stack spacing={1.4} alignItems="flex-start">
                  <Typography fontWeight={800}>Quick Notes</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Save Single creates one member from the current row. Save All creates all unsaved rows in a single action.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Required fields: a non-empty name and a valid business email address.
                  </Typography>
                  {hasSeatLimit ? (
                    <Alert severity={licenseFull ? "error" : "info"} sx={{ width: "100%" }}>
                      Seats used: {activeUsers + createdCount}/{maxUsers}
                    </Alert>
                  ) : null}
                </Stack>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1.2} justifyContent="flex-end">
              <Button onClick={handleClose} variant="outlined" sx={{ borderRadius: 1.8, textTransform: "none", fontWeight: 700 }}>
                Close
              </Button>
              <Button
                onClick={() => void handleSaveAll()}
                variant="contained"
                startIcon={<HiOutlineCloudArrowUp size={16} />}
                disabled={bulkSaving || rows.every((row) => row.saved) || licenseFull}
                sx={{ borderRadius: 1.8, textTransform: "none", fontWeight: 800 }}
              >
                {bulkSaving ? "Saving All..." : "Save All"}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={3600}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Dialog>
    </>
  );
};

export default BulkUploadDialog;
