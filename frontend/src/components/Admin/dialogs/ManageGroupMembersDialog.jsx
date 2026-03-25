import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { FiRefreshCw, FiTrash2, FiUserPlus } from "react-icons/fi";
import { API_BASE_URL } from "../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../utils/authApi";

const normalize = (value) => String(value || "").trim().toLowerCase();

const toInitial = (name = "") => String(name || "?").trim().charAt(0).toUpperCase() || "?";

const ManageGroupMembersDialog = ({ open, group, users = [], onClose, onSaved }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const groupId = Number(group?.group_id || group?.id);

  const activeUserOptions = useMemo(
    () =>
      users
        .filter((user) => normalize(user?.user_status) === "active" && normalize(user?.membership_status) === "active")
        .map((user) => ({
          user_id: Number(user?.user_id ?? user?.id),
          name: String(user?.name || "Unknown").trim(),
          email: String(user?.email || "").trim(),
          is_global_member: Boolean(user?.is_global_member),
        }))
        .filter((user) => Number.isFinite(user.user_id) && user.user_id > 0),
    [users],
  );

  const userById = useMemo(() => {
    const map = new Map();
    for (const option of activeUserOptions) {
      map.set(Number(option.user_id), option);
    }
    return map;
  }, [activeUserOptions]);

  const refreshMembers = async () => {
    if (!Number.isFinite(groupId) || groupId <= 0) return;
    setLoading(true);
    setError("");
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/group-members?group_id=${groupId}&limit=500&offset=0`,
        { method: "GET" },
      );
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to fetch group members");
      }
      const members = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
      setRows(
        members.map((member, index) => ({
          id: Number(member?.group_member_id) || `member-${index + 1}`,
          group_member_id: Number(member?.group_member_id) || 0,
          user_id: Number(member?.user_id) || 0,
          user_name: member?.user_name || member?.name || "Unknown",
          user_email: member?.user_email || member?.email || "",
          is_admin: Boolean(member?.is_admin),
          is_global_member:
            Boolean(member?.is_global_member) ||
            Boolean(userById.get(Number(member?.user_id))?.is_global_member),
          status: String(member?.status || member?.member_status || "active").toLowerCase(),
        })),
      );
    } catch (requestError) {
      setError(requestError?.message || "Unable to fetch group members");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    refreshMembers();
  }, [open, groupId]);

  const notify = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const setMemberPatch = async (groupMemberId, patchPayload, successMessage) => {
    if (!Number.isFinite(groupMemberId) || groupMemberId <= 0) return false;
    setSaving(true);
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/group-members/${groupMemberId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchPayload),
        },
      );
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to update group member");
      }
      notify(successMessage, "success");
      await refreshMembers();
      await onSaved?.();
      return true;
    } catch (requestError) {
      notify(requestError?.message || "Unable to update member", "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUser || !Number.isFinite(groupId) || groupId <= 0) {
      notify("Please select a user first.", "warning");
      return;
    }
    const existing = rows.find((row) => Number(row.user_id) === Number(selectedUser.user_id));
    if (existing && normalize(existing.status) === "active") {
      notify("User is already an active member of this group.", "warning");
      return;
    }

    if (existing && Number.isFinite(existing.group_member_id) && existing.group_member_id > 0) {
      const restored = await setMemberPatch(
        existing.group_member_id,
        { status: "active" },
        "Member added back to the group.",
      );
      if (restored) {
        setSelectedUser(null);
      }
      return;
    }

    setSaving(true);
    try {
      const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/group-members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: groupId,
          user_id: Number(selectedUser.user_id),
          is_admin: false,
          status: "active",
        }),
      });
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to add member");
      }
      notify("Member added successfully.", "success");
      setSelectedUser(null);
      await refreshMembers();
      await onSaved?.();
    } catch (requestError) {
      notify(requestError?.message || "Unable to add member", "error");
    } finally {
      setSaving(false);
    }
  };

  const activeMembers = rows.filter((row) => normalize(row.status) === "active");

  return (
    <>
      <Dialog
        open={Boolean(open)}
        onClose={saving ? undefined : onClose}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            width: "min(calc(100vw - 32px), 1440px)",
            maxWidth: "1440px",
          },
        }}
      >
        <DialogTitle sx={{ pb: 0.5, fontWeight: 800 }}>Manage Group Members</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              alignItems={{ xs: "stretch", md: "center" }}
            >
              <Autocomplete
                fullWidth
                options={activeUserOptions}
                value={selectedUser}
                onChange={(_, value) => setSelectedUser(value)}
                getOptionLabel={(option) => `${option.name} (${option.email})`}
                isOptionEqualToValue={(option, value) =>
                  Number(option.user_id) === Number(value.user_id)
                }
                renderInput={(params) => (
                  <TextField {...params} label="Add User To Group" placeholder="Select active user" />
                )}
              />
              <Button
                variant="contained"
                startIcon={<FiUserPlus />}
                onClick={handleAddMember}
                disabled={saving || loading}
                sx={{ minWidth: 96, fontWeight: 700, borderRadius: 1.5 }}
              >
                Add
              </Button>
              <Tooltip title="Refresh members" arrow>
                <IconButton onClick={refreshMembers} disabled={loading || saving}>
                  <FiRefreshCw />
                </IconButton>
              </Tooltip>
            </Stack>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <Box sx={{ height: 420, width: "100%" }}>
              <DataGrid
                rows={rows}
                loading={loading}
                disableRowSelectionOnClick
                columns={[
                  {
                    field: "member",
                    headerName: "Member",
                    flex: 1.4,
                    minWidth: 240,
                    sortable: false,
                    renderCell: ({ row }) => (
                      <Stack direction="row" spacing={1.2} alignItems="center">
                        <Box sx={{ position: "relative", display: "inline-flex" }}>
                          <Avatar sx={{ width: 32, height: 32 }}>{toInitial(row.user_name)}</Avatar>
                          {row?.is_global_member ? (
                            <Tooltip title="Global Member" arrow>
                              <Box
                                sx={{
                                  position: "absolute",
                                  right: -1,
                                  bottom: -1,
                                  width: 10,
                                  height: 10,
                                  borderRadius: "50%",
                                  bgcolor: "#ff8a00",
                                  border: "2px solid",
                                  borderColor: "background.paper",
                                }}
                              />
                            </Tooltip>
                          ) : null}
                        </Box>
                        <Stack>
                          <Typography variant="body2" fontWeight={600}>
                            {row.user_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {row.user_email}
                          </Typography>
                        </Stack>
                      </Stack>
                    ),
                  },
                  {
                    field: "status",
                    headerName: "Status",
                    minWidth: 130,
                    flex: 0.45,
                    renderCell: ({ row }) => {
                      const statusLabel =
                        normalize(row.status) === "kicked"
                          ? "Removed"
                          : normalize(row.status) === "left"
                            ? "Left"
                            : row.status;
                      return (
                        <Chip
                          label={statusLabel}
                          size="small"
                          color={normalize(row.status) === "active" ? "success" : "default"}
                          variant="outlined"
                          sx={{ textTransform: "capitalize" }}
                        />
                      );
                    },
                  },
                  {
                    field: "admin",
                    headerName: "Admin",
                    minWidth: 130,
                    flex: 0.45,
                    sortable: false,
                    renderCell: ({ row }) => (
                      <Switch
                        size="small"
                        checked={Boolean(row.is_admin)}
                        disabled={saving || normalize(row.status) !== "active"}
                        onChange={(event) =>
                          setMemberPatch(
                            row.group_member_id,
                            { is_admin: event.target.checked },
                            event.target.checked ? "Member promoted as admin." : "Admin rights removed.",
                          )
                        }
                      />
                    ),
                  },
                  {
                    field: "remove",
                    headerName: "Actions",
                    minWidth: 170,
                    flex: 0.6,
                    sortable: false,
                    renderCell: ({ row }) => (
                      <Tooltip
                        title={
                          normalize(row.status) === "active"
                            ? "Remove from active members"
                            : "Add back to active members"
                        }
                        arrow
                      >
                        <span>
                          <Button
                            size="small"
                            color={normalize(row.status) === "active" ? "error" : "success"}
                            variant="outlined"
                            startIcon={<FiTrash2 size={14} />}
                            disabled={saving}
                            onClick={() =>
                              setMemberPatch(
                                row.group_member_id,
                                { status: normalize(row.status) === "active" ? "kicked" : "active" },
                                normalize(row.status) === "active"
                                  ? "Member removed from active group list."
                                  : "Member added back to active group list.",
                              )
                            }
                          >
                            {normalize(row.status) === "active" ? "Remove" : "Restore"}
                          </Button>
                        </span>
                      </Tooltip>
                    ),
                  },
                ]}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  backgroundColor: "background.paper",
                  "& .MuiDataGrid-columnHeaders": {
                    backgroundColor: theme.palette.mode === "light" ? "#f8fafc" : "action.hover",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  },
                  "& .MuiDataGrid-row:hover": {
                    backgroundColor: theme.palette.mode === "light" ? "#f8fbff" : "action.hover",
                  },
                  "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 700 },
                }}
              />
            </Box>

            <Typography variant="caption" color="text.secondary">
              Active members: {activeMembers.length} / Total records: {rows.length}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Close
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

export default ManageGroupMembersDialog;
