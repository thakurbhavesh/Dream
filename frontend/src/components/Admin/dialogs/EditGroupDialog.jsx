import { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
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

const toText = (value) => String(value || "").trim();

const EditGroupDialog = ({ open, group, onClose, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState({
    group_name: "",
    group_description: "",
    status: "active",
    is_airtime: false,
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  useEffect(() => {
    if (!open || !group) return;
    setValues({
      group_name: toText(group.group_name || group.name),
      group_description: toText(group.group_description),
      status: toText(group.status || "active").toLowerCase() || "active",
      is_airtime: Boolean(group.is_airtime),
    });
    setError("");
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(group.group_image_url || group.group_image || "");
  }, [group, open]);

  const closeDialog = () => {
    if (saving) return;
    onClose?.();
  };

  const handleSave = async () => {
    const groupId = Number(group?.group_id || group?.id);
    const groupName = toText(values.group_name);
    if (!Number.isFinite(groupId) || groupId <= 0) {
      setError("Invalid group selected");
      return;
    }
    if (!groupName) {
      setError("Group name is required");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const payload = {
        group_name: groupName,
        group_description: toText(values.group_description) || undefined,
        status: toText(values.status || "active").toLowerCase(),
        is_airtime: Boolean(values.is_airtime),
      };

      const { response, payload: result } = await fetchWithAuth(
        `${API_BASE_URL}/groups/${groupId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok || result?.status === "error") {
        throw new Error(result?.message || "Failed to update group");
      }

      // Upload group image if changed
      if (imageFile) {
        try {
          const formData = new FormData();
          formData.append("avatar", imageFile);
          await fetchWithAuth(`${API_BASE_URL}/upload/group-image/${groupId}`, {
            method: "POST",
            body: formData,
          });
        } catch { /* best-effort */ }
      }

      setSnackbar({
        open: true,
        message: "Group updated successfully.",
        severity: "success",
      });
      await onSaved?.();
      onClose?.();
    } catch (requestError) {
      const message = requestError?.message || "Unable to update group";
      setError(message);
      setSnackbar({
        open: true,
        message,
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={Boolean(open)} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Group</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ position: "relative" }}>
                <Avatar
                  src={imagePreview || undefined}
                  sx={{ width: 56, height: 56, bgcolor: "primary.main" }}
                >
                  {!imagePreview ? (values.group_name?.[0]?.toUpperCase() || "G") : null}
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
                        setError("Image must be under 5MB");
                        return;
                      }
                      setImageFile(file);
                      if (imagePreview && imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
                      setImagePreview(URL.createObjectURL(file));
                    }}
                  />
                </IconButton>
                {imagePreview && (
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (imagePreview && imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
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
                Group Image (max 5MB)
              </Typography>
            </Stack>
            <TextField
              label="Group Name"
              value={values.group_name}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, group_name: event.target.value }))
              }
              required
              fullWidth
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
              multiline
              minRows={3}
              fullWidth
            />
            <TextField
              select
              label="Status"
              value={values.status}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, status: event.target.value }))
              }
            >
              {["active", "inactive", "archived", "deleted"].map((status) => (
                <MenuItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
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
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default EditGroupDialog;
