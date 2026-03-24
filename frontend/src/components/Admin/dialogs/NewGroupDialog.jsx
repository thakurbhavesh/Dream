import { useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { PiCameraBold, PiTrashSimpleBold } from "react-icons/pi";
import { API_BASE_URL } from "../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../utils/authApi";

const INITIAL_VALUES = {
  group_name: "",
  group_description: "",
  status: "active",
  is_airtime: false,
  members: [],
};

const normalizeStatusLabel = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Unknown";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const NewGroupDialog = ({ users = [], onCreated }) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [values, setValues] = useState(INITIAL_VALUES);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const memberOptions = useMemo(
    () =>
      users
        .filter((user) => {
          const userStatus = String(user?.user_status || "").toLowerCase();
          const membershipStatus = String(user?.membership_status || "").toLowerCase();
          return userStatus === "active" && membershipStatus === "active";
        })
        .map((user) => ({
          user_id: Number(user?.user_id ?? user?.id),
          name: String(user?.name || "Unknown").trim(),
          email: String(user?.email || "").trim().toLowerCase(),
        }))
        .filter((user) => Number.isFinite(user.user_id) && user.user_id > 0),
    [users],
  );

  const resetState = () => {
    setValues(INITIAL_VALUES);
    setFormError("");
    setSaving(false);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview("");
  };

  const closeDialog = () => {
    if (saving) return;
    setOpen(false);
    resetState();
  };

  const handleSubmit = async () => {
    const groupName = String(values.group_name || "").trim();
    const groupDescription = String(values.group_description || "").trim();

    if (!groupName) {
      setFormError("Group name is required.");
      return;
    }

    setFormError("");
    setSaving(true);

    try {
      const createPayload = {
        group_name: groupName,
        group_description: groupDescription || undefined,
        is_airtime: Boolean(values.is_airtime),
        status: values.status || "active",
      };

      const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPayload),
      });

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to create group");
      }

      const createdGroup = payload?.data || {};
      const groupId = Number(createdGroup?.group_id);

      // Upload group image if selected
      if (imageFile && Number.isFinite(groupId) && groupId > 0) {
        try {
          const formData = new FormData();
          formData.append("avatar", imageFile);
          await fetchWithAuth(`${API_BASE_URL}/upload/group-image/${groupId}`, {
            method: "POST",
            body: formData,
          });
        } catch { /* image upload is best-effort */ }
      }

      const selectedMembers = values.members || [];

      let memberFailureCount = 0;
      if (Number.isFinite(groupId) && groupId > 0 && selectedMembers.length) {
        for (const member of selectedMembers) {
          try {
            const requestResult = await fetchWithAuth(`${API_BASE_URL}/group-members`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                group_id: groupId,
                user_id: Number(member.user_id),
                is_admin: false,
                status: "active",
              }),
            });
            const failed =
              !requestResult?.response?.ok || requestResult?.payload?.status === "error";
            if (failed) {
              memberFailureCount += 1;
            }
          } catch {
            memberFailureCount += 1;
          }
        }
      }

      const baseMessage = `Group "${groupName}" created successfully.`;
      const partialMessage =
        memberFailureCount > 0
          ? ` ${memberFailureCount} member invite(s) failed.`
          : selectedMembers.length
            ? ` ${selectedMembers.length} member(s) added.`
            : "";

      setSnackbar({
        open: true,
        message: `${baseMessage}${partialMessage}`,
        severity: memberFailureCount > 0 ? "warning" : "success",
      });

      if (typeof onCreated === "function") {
        await onCreated();
      }

      setOpen(false);
      resetState();
    } catch (error) {
      setFormError(error?.message || "Unable to create group");
      setSnackbar({
        open: true,
        message: error?.message || "Unable to create group",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="contained" onClick={() => setOpen(true)}>
        New Group
      </Button>
      <Dialog
        open={open}
        onClose={closeDialog}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            width: "min(calc(100vw - 32px), 1440px)",
            maxWidth: "1440px",
          },
        }}
      >
        <DialogTitle>Create Group</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <TextField
              label="Group Name"
              value={values.group_name}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, group_name: event.target.value }))
              }
              autoFocus
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={values.group_description}
              onChange={(event) =>
                setValues((prev) => ({
                  ...prev,
                  group_description: event.target.value,
                }))
              }
              fullWidth
              multiline
              minRows={3}
            />
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ position: "relative" }}>
                <Avatar
                  src={imagePreview || undefined}
                  sx={{ width: 56, height: 56, bgcolor: "primary.main" }}
                >
                  {!imagePreview ? "G" : null}
                </Avatar>
                <IconButton
                  size="small"
                  component="label"
                  sx={{
                    position: "absolute", bottom: -4, right: -4,
                    bgcolor: "background.paper", boxShadow: 1,
                    width: 24, height: 24,
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <PiCameraBold size={12} />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        setFormError("Image must be under 5MB");
                        return;
                      }
                      setImageFile(file);
                      if (imagePreview) URL.revokeObjectURL(imagePreview);
                      setImagePreview(URL.createObjectURL(file));
                    }}
                  />
                </IconButton>
                {imagePreview && (
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (imagePreview) URL.revokeObjectURL(imagePreview);
                      setImageFile(null);
                      setImagePreview("");
                    }}
                    sx={{
                      position: "absolute", top: -4, right: -4,
                      bgcolor: "error.main", color: "#fff",
                      width: 20, height: 20,
                      "&:hover": { bgcolor: "error.dark" },
                    }}
                  >
                    <PiTrashSimpleBold size={10} />
                  </IconButton>
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">
                Group Image (optional, max 5MB)
              </Typography>
            </Stack>
            <TextField
              select
              label="Status"
              value={values.status}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, status: event.target.value }))
              }
              fullWidth
            >
              {["active", "inactive", "archived", "deleted"].map((status) => (
                <MenuItem key={status} value={status}>
                  {normalizeStatusLabel(status)}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(values.is_airtime)}
                  onChange={(event) =>
                    setValues((prev) => ({
                      ...prev,
                      is_airtime: event.target.checked,
                    }))
                  }
                />
              }
              label="Enable airtime mode"
            />
            <Autocomplete
              multiple
              options={memberOptions}
              value={values.members}
              disableCloseOnSelect
              getOptionLabel={(option) => `${option.name} (${option.email})`}
              isOptionEqualToValue={(option, selected) =>
                Number(option.user_id) === Number(selected.user_id)
              }
              onChange={(_, selectedMembers) =>
                setValues((prev) => ({ ...prev, members: selectedMembers }))
              }
              renderOption={(props, option, { selected }) => (
                <li {...props}>
                  <Checkbox checked={selected} sx={{ mr: 1 }} />
                  <Stack>
                    <Typography variant="body2">{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.email}
                    </Typography>
                  </Stack>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Add Members (Optional)"
                  placeholder={memberOptions.length ? "Select active users" : "No active users available"}
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSubmit} disabled={saving}>
            {saving ? "Creating..." : "Create Group"}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3200}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default NewGroupDialog;
