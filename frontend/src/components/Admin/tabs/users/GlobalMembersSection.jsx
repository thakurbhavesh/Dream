import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
  alpha,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { API_BASE_URL } from "../../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../../utils/authApi";
import { SearchInput, UserActionsMenu, getInitials } from "./shared";

const GlobalMembersSection = ({
  users = [],
  globalMembers = [],
  onUsersChanged,
  departments = [],
  designations = [],
  locations = [],
  roles = [],
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [dialogSize, setDialogSize] = useState("large");
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [permissionSaving, setPermissionSaving] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [selectedGlobalUser, setSelectedGlobalUser] = useState(null);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [permissionRows, setPermissionRows] = useState([]);
  const [selectedAllowedIds, setSelectedAllowedIds] = useState([]);
  const [checkedAvailableIds, setCheckedAvailableIds] = useState([]);
  const [checkedSelectedIds, setCheckedSelectedIds] = useState([]);
  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const selectedGlobalUserName = String(selectedGlobalUser?.name || "").trim();
  const selectedGlobalUserEmail = String(selectedGlobalUser?.email || "").trim();
  const activePermissionIds = useMemo(
    () =>
      permissionRows
        .filter((item) => String(item?.status || "").toLowerCase() === "active")
        .map((item) => toNumber(item?.allow_user_id))
        .filter((id) => id > 0),
    [permissionRows],
  );
  const pendingAdds = useMemo(
    () => selectedAllowedIds.filter((id) => !activePermissionIds.includes(id)).length,
    [selectedAllowedIds, activePermissionIds],
  );
  const pendingRemovals = useMemo(
    () => activePermissionIds.filter((id) => !selectedAllowedIds.includes(id)).length,
    [selectedAllowedIds, activePermissionIds],
  );

  const rows = useMemo(
    () =>
      globalMembers.map((member, index) => ({
        ...member,
        serial: index + 1,
      })),
    [globalMembers],
  );

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row?.name, row?.email, row?.department, row?.designation, row?.location]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [rows, searchTerm]);

  const renderStatusChip = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    const label = normalized || "n/a";
    if (normalized === "active") {
      return <Chip size="small" color="success" label={label} sx={{ textTransform: "capitalize" }} />;
    }
    if (normalized === "invited") {
      return <Chip size="small" color="info" label={label} sx={{ textTransform: "capitalize" }} />;
    }
    if (normalized === "suspended") {
      return (
        <Chip
          size="small"
          label={label}
          sx={{
            textTransform: "capitalize",
            backgroundColor: "rgba(237, 108, 2, 0.15)",
            border: "1px solid rgba(237, 108, 2, 0.4)",
            color: "#b26a00",
          }}
        />
      );
    }
    if (["left", "archived", "inactive"].includes(normalized)) {
      return (
        <Chip
          size="small"
          variant="outlined"
          color="default"
          label={label}
          sx={{ textTransform: "capitalize" }}
        />
      );
    }
    return <Chip size="small" variant="outlined" label={label} sx={{ textTransform: "capitalize" }} />;
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const getOrgId = useCallback((row) => {
    const rowOrgId = toNumber(row?.organization_id);
    if (rowOrgId > 0) return rowOrgId;
    const localOrgId = toNumber(
      window.localStorage.getItem("organization_id") ||
        window.localStorage.getItem("organization") ||
        window.localStorage.getItem("organizationId"),
    );
    return localOrgId > 0 ? localOrgId : 0;
  }, []);

  const getUserId = useCallback((row) => toNumber(row?.user_id || row?.id), []);

  const eligibleUsers = useMemo(() => {
    const globalUserId = getUserId(selectedGlobalUser);
    const query = permissionSearch.trim().toLowerCase();
    return users
      .filter((user) => {
        const userId = getUserId(user);
        if (!userId || userId === globalUserId) return false;
        if (
          String(user?.membership_status || "").trim().toLowerCase() !== "active"
        ) {
          return false;
        }
        if (!query) return true;
        return [user?.name, user?.email]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .map((user) => ({
        id: getUserId(user),
        name: String(user?.name || "").trim() || "N/A",
        email: String(user?.email || "").trim() || "N/A",
      }));
  }, [users, selectedGlobalUser, permissionSearch, getUserId]);

  const availableUsers = useMemo(
    () =>
      eligibleUsers.filter((user) => !selectedAllowedIds.includes(user.id)),
    [eligibleUsers, selectedAllowedIds],
  );

  const selectedUsers = useMemo(
    () => eligibleUsers.filter((user) => selectedAllowedIds.includes(user.id)),
    [eligibleUsers, selectedAllowedIds],
  );

  const loadGlobalAccessData = async (memberRow) => {
    const orgId = getOrgId(memberRow);
    const userId = getUserId(memberRow);
    if (!orgId || !userId) {
      throw new Error("Organization/User id missing for global access");
    }

    const { response, payload } = await fetchWithAuth(
      `${API_BASE_URL}/global-access?org_id=${orgId}&user_id=${userId}&all=true`,
      { method: "GET" },
    );

    if (!response.ok || payload?.status === "error") {
      throw new Error(payload?.message || "Failed to load global access");
    }

    const rowsData = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
    setPermissionRows(rowsData);
    setSelectedAllowedIds(
      rowsData
        .filter((item) => String(item?.status || "").toLowerCase() === "active")
        .map((item) => toNumber(item?.allow_user_id))
        .filter((id) => id > 0),
    );
  };

  const handleOpenPermission = async (memberRow) => {
    setPermissionOpen(true);
    setPermissionLoading(true);
    setPermissionError("");
    setPermissionSearch("");
    setCheckedAvailableIds([]);
    setCheckedSelectedIds([]);
    setSelectedGlobalUser(memberRow);
    try {
      await loadGlobalAccessData(memberRow);
    } catch (error) {
      setPermissionError(error?.message || "Unable to load permissions");
    } finally {
      setPermissionLoading(false);
    }
  };

  const handleAddChecked = () => {
    if (!checkedAvailableIds.length) return;
    setSelectedAllowedIds((prev) =>
      Array.from(new Set([...prev, ...checkedAvailableIds])),
    );
    setCheckedAvailableIds([]);
  };

  const handleRemoveChecked = () => {
    if (!checkedSelectedIds.length) return;
    setSelectedAllowedIds((prev) =>
      prev.filter((id) => !checkedSelectedIds.includes(id)),
    );
    setCheckedSelectedIds([]);
  };

  const toggleAvailableChecked = (userId, checked) => {
    setCheckedAvailableIds((prev) =>
      checked ? Array.from(new Set([...prev, userId])) : prev.filter((id) => id !== userId),
    );
  };

  const toggleSelectedChecked = (userId, checked) => {
    setCheckedSelectedIds((prev) =>
      checked ? Array.from(new Set([...prev, userId])) : prev.filter((id) => id !== userId),
    );
  };

  const handleToggleAllAvailable = (checked) => {
    setCheckedAvailableIds(checked ? availableUsers.map((user) => user.id) : []);
  };

  const handleToggleAllSelected = (checked) => {
    setCheckedSelectedIds(checked ? selectedUsers.map((user) => user.id) : []);
  };

  const handleSelectAllVisible = () => {
    setSelectedAllowedIds((prev) => {
      const visibleIds = eligibleUsers.map((user) => user.id);
      return Array.from(new Set([...prev, ...visibleIds]));
    });
    setCheckedAvailableIds([]);
    setCheckedSelectedIds([]);
  };

  const handleClearAllSelected = () => {
    setSelectedAllowedIds([]);
    setCheckedAvailableIds([]);
    setCheckedSelectedIds([]);
  };

  const handlePermissionSave = async () => {
    const orgId = getOrgId(selectedGlobalUser);
    const userId = getUserId(selectedGlobalUser);
    if (!orgId || !userId) {
      setPermissionError("Organization/User id missing for save");
      return;
    }

    setPermissionSaving(true);
    setPermissionError("");
    try {
      const desired = new Set(selectedAllowedIds.map((id) => toNumber(id)).filter((id) => id > 0));
      const existingByAllowUser = new Map(
        permissionRows.map((row) => [toNumber(row?.allow_user_id), row]),
      );

      for (const [allowUserId, row] of existingByAllowUser.entries()) {
        const currentStatus = String(row?.status || "").toLowerCase();
        const globalAccessId = toNumber(row?.global_access_id);
        if (!globalAccessId) continue;

        if (desired.has(allowUserId)) {
          if (currentStatus !== "active") {
            const { response, payload } = await fetchWithAuth(
              `${API_BASE_URL}/global-access/${globalAccessId}?org_id=${orgId}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "active" }),
              },
            );
            if (!response.ok || payload?.status === "error") {
              throw new Error(payload?.message || "Failed to activate permission");
            }
          }
        } else if (currentStatus === "active") {
          const { response, payload } = await fetchWithAuth(
            `${API_BASE_URL}/global-access/${globalAccessId}?org_id=${orgId}`,
            { method: "DELETE" },
          );
          if (!response.ok || payload?.status === "error") {
            throw new Error(payload?.message || "Failed to remove permission");
          }
        }
      }

      for (const allowUserId of desired) {
        if (!existingByAllowUser.has(allowUserId)) {
          const { response, payload } = await fetchWithAuth(
            `${API_BASE_URL}/global-access`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                org_id: orgId,
                user_id: userId,
                allow_user_id: allowUserId,
                status: "active",
              }),
            },
          );
          if (!response.ok || payload?.status === "error") {
            throw new Error(payload?.message || "Failed to add permission");
          }
        }
      }

      await loadGlobalAccessData(selectedGlobalUser);
      showSnackbar("Default permission updated successfully.");
      if (typeof onUsersChanged === "function") {
        await onUsersChanged();
      }
      setPermissionOpen(false);
    } catch (error) {
      setPermissionError(error?.message || "Unable to update permissions");
      showSnackbar(error?.message || "Unable to update permissions", "error");
    } finally {
      setPermissionSaving(false);
    }
  };

  const handleGlobalToggle = async (row, checked) => {
    const userId = row?.user_id || row?.id;
    if (!userId) return;
    setUpdatingId(userId);
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/users/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_global_member: checked }),
        },
      );

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to update global member");
      }

      showSnackbar("Global member updated successfully.");
      if (typeof onUsersChanged === "function") {
        await onUsersChanged();
      }
    } catch (error) {
      showSnackbar(error?.message || "Unable to update global member", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          spacing={2}
          sx={{ mb: 2 }}
        >
          <SearchInput
            placeholder="Search global members"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <Typography variant="body2" color="text.secondary">
            {users.length} total users, {globalMembers.length} global members
          </Typography>
        </Stack>
        <Box sx={{ height: "calc(100vh - 280px)" }}>
          <DataGrid
            disableRowSelectionOnClick
            rows={filteredRows}
            getRowId={(row) => row.id}
            columns={[
              {
                field: "serial",
                headerName: "S.No",
                width: 90,
                sortable: false,
              },
              {
                field: "name",
                headerName: "User",
                flex: 1,
                renderCell: ({ row }) => row?.name || "N/A",
              },
              {
                field: "email",
                headerName: "Email",
                flex: 1.2,
                renderCell: ({ row }) => row?.email || "N/A",
              },
              {
                field: "department",
                headerName: "Department",
                flex: 0.9,
                renderCell: ({ row }) => row?.department || "N/A",
              },
              {
                field: "designation",
                headerName: "Designation",
                flex: 0.9,
                renderCell: ({ row }) => row?.designation || "N/A",
              },
              {
                field: "location",
                headerName: "Location",
                flex: 0.8,
                renderCell: ({ row }) => row?.location || "N/A",
              },
              {
                field: "is_global_member",
                headerName: "Global",
                width: 110,
                align: "center",
                headerAlign: "center",
                sortable: false,
                renderCell: ({ row }) => (
                  <Switch
                    checked={Boolean(row?.is_global_member)}
                    disabled={updatingId === (row?.user_id || row?.id)}
                    onChange={(event) =>
                      handleGlobalToggle(row, event.target.checked)
                    }
                  />
                ),
              },
              {
                field: "membership_status",
                headerName: "Status",
                width: 130,
                align: "center",
                headerAlign: "center",
                renderCell: ({ row }) => renderStatusChip(row?.membership_status || "n/a"),
              },
              {
                field: "actions",
                headerName: "",
                width: 70,
                sortable: false,
                filterable: false,
                renderCell: ({ row }) => (
                  <UserActionsMenu
                    row={row}
                    onUpdated={onUsersChanged}
                    departments={departments}
                    designations={designations}
                    locations={locations}
                    roles={roles}
                  />
                ),
              },
              {
                field: "permissions",
                headerName: "Default Permission",
                width: 170,
                sortable: false,
                filterable: false,
                renderCell: ({ row }) => (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleOpenPermission(row)}
                  >
                    Manage
                  </Button>
                ),
              },
            ]}
            localeText={{ noRowsLabel: "No global members found." }}
          />
        </Box>
      </Paper>
      <Dialog
        open={permissionOpen}
        onClose={() => !permissionSaving && setPermissionOpen(false)}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            width: dialogSize === "small" ? "min(640px, 94vw)" : dialogSize === "medium" ? "min(960px, 96vw)" : "min(1980px, 98vw)",
            maxWidth: "98vw",
            minHeight: dialogSize === "small" ? { md: "50vh" } : dialogSize === "medium" ? { md: "65vh" } : { md: "78vh" },
            transition: "width 0.3s ease, min-height 0.3s ease",
          },
        }}
      >
        <DialogTitle
          sx={{
            pb: 1.25,
            borderBottom: "1px solid",
            borderColor: "divider",
            background: (theme) =>
              `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(
                theme.palette.primary.main,
                0.01,
              )} 100%)`,
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Default Permission Users can chat with</Typography>
            <Stack direction="row" spacing={0.5}>
              {["small", "medium", "large"].map((size) => (
                <IconButton
                  key={size}
                  size="small"
                  onClick={() => setDialogSize(size)}
                  sx={{
                    width: 28, height: 28, borderRadius: 1,
                    bgcolor: dialogSize === size ? "primary.main" : "action.hover",
                    color: dialogSize === size ? "primary.contrastText" : "text.secondary",
                    fontSize: 11, fontWeight: 700,
                    "&:hover": { bgcolor: dialogSize === size ? "primary.dark" : "action.selected" },
                  }}
                >
                  {size[0].toUpperCase()}
                </IconButton>
              ))}
            </Stack>
          </Stack>
          {selectedGlobalUserName ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Configure visibility for: <strong>{selectedGlobalUserName}</strong>
            </Typography>
          ) : null}
        </DialogTitle>
        <DialogContent dividers>
          {permissionLoading ? (
            <Typography variant="body2" color="text.secondary">
              Loading permissions...
            </Typography>
          ) : (
            <Stack spacing={2}>
              {permissionError ? <Alert severity="error">{permissionError}</Alert> : null}
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: "background.default",
                }}
              >
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", md: "center" }}
                >
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Box sx={{ position: "relative", display: "inline-flex" }}>
                      <Avatar sx={{ width: 34, height: 34, fontSize: 14 }}>
                        {getInitials(selectedGlobalUserName || "N/A")}
                      </Avatar>
                      {selectedGlobalUser?.is_global_member ? (
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
                      ) : null}
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={700}>
                        {selectedGlobalUserName || "Global Member"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {selectedGlobalUserEmail || "No email available"}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip size="small" color="primary" label={`Selected ${selectedUsers.length}`} />
                    <Chip size="small" variant="outlined" label={`Pending add ${pendingAdds}`} />
                    <Chip size="small" variant="outlined" label={`Pending remove ${pendingRemovals}`} />
                  </Stack>
                </Stack>
              </Paper>
              <TextField
                size="small"
                label="Search users"
                placeholder="Search by name or email"
                value={permissionSearch}
                onChange={(event) => setPermissionSearch(event.target.value)}
              />
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems={{ xs: "stretch", sm: "center" }}
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip
                    size="small"
                    color="info"
                    variant="outlined"
                    label={`Visible ${eligibleUsers.length}`}
                  />
                  <Chip
                    size="small"
                    color="success"
                    variant="outlined"
                    label={`Can Chat ${selectedUsers.length}`}
                  />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleSelectAllVisible}
                    disabled={!eligibleUsers.length || permissionSaving || permissionLoading}
                  >
                    Select All Visible
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={handleClearAllSelected}
                    disabled={!selectedAllowedIds.length || permissionSaving || permissionLoading}
                  >
                    Clear All
                  </Button>
                </Stack>
              </Stack>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                alignItems="stretch"
              >
                <Paper
                  variant="outlined"
                  sx={{
                    flex: 1,
                    flexBasis: 0,
                    minWidth: 0,
                    p: 1.5,
                    borderRadius: 1,
                    minHeight: 340,
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 1 }}
                  >
                    <Typography variant="subtitle2">Available Members</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label={availableUsers.length} color="primary" variant="outlined" />
                      <Checkbox
                        size="small"
                        checked={availableUsers.length > 0 && checkedAvailableIds.length === availableUsers.length}
                        indeterminate={checkedAvailableIds.length > 0 && checkedAvailableIds.length < availableUsers.length}
                        onChange={(event) => handleToggleAllAvailable(event.target.checked)}
                      />
                    </Stack>
                  </Stack>
                  {selectedGlobalUserName ? (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
                      <Box sx={{ position: "relative", display: "inline-flex" }}>
                        <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                          {getInitials(selectedGlobalUserName)}
                        </Avatar>
                        {selectedGlobalUser?.is_global_member ? (
                          <Box
                            sx={{
                              position: "absolute",
                              right: -1,
                              bottom: -1,
                              width: 9,
                              height: 9,
                              borderRadius: "50%",
                              bgcolor: "#ff8a00",
                              border: "2px solid",
                              borderColor: "background.paper",
                            }}
                          />
                        ) : null}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Global Member: {selectedGlobalUserName}
                      </Typography>
                    </Stack>
                  ) : null}
                  <Divider />
                  <List dense sx={{ maxHeight: 280, overflowY: "auto", mt: 0.5 }}>
                    {!availableUsers.length ? (
                      <Box sx={{ p: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          {permissionSearch.trim()
                            ? "No users match this search."
                            : "No users available to add."}
                        </Typography>
                      </Box>
                    ) : null}
                    {availableUsers.map((user) => (
                      <ListItemButton
                        key={user.id}
                        onClick={() =>
                          toggleAvailableChecked(
                            user.id,
                            !checkedAvailableIds.includes(user.id),
                          )
                        }
                        sx={{ borderRadius: 1, mb: 0.5 }}
                      >
                        <Checkbox
                          checked={checkedAvailableIds.includes(user.id)}
                          onChange={(event) =>
                            toggleAvailableChecked(user.id, event.target.checked)
                          }
                        />
                        <Box sx={{ position: "relative", display: "inline-flex", mr: 1.25 }}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>
                            {getInitials(user.name)}
                          </Avatar>
                          {user?.is_global_member ? (
                            <Box
                              sx={{
                                position: "absolute",
                                right: -1,
                                bottom: -1,
                                width: 9,
                                height: 9,
                                borderRadius: "50%",
                                bgcolor: "#ff8a00",
                                border: "2px solid",
                                borderColor: "background.paper",
                              }}
                            />
                          ) : null}
                        </Box>
                        <ListItemText
                          primary={user.name}
                          secondary={user.email}
                          primaryTypographyProps={{ variant: "body2" }}
                          secondaryTypographyProps={{ variant: "caption" }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Paper>
                <Stack
                  spacing={1.2}
                  justifyContent="center"
                  alignItems="center"
                  sx={{ minWidth: 120 }}
                >
                  <Button
                    variant="contained"
                    onClick={handleAddChecked}
                    disabled={!checkedAvailableIds.length}
                    sx={{ minWidth: 104 }}
                  >
                    Add
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleRemoveChecked}
                    disabled={!checkedSelectedIds.length}
                    sx={{ minWidth: 104 }}
                  >
                    Remove
                  </Button>
                </Stack>
                <Paper
                  variant="outlined"
                  sx={{
                    flex: 1,
                    flexBasis: 0,
                    minWidth: 0,
                    p: 1.5,
                    borderRadius: 1,
                    minHeight: 340,
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 1 }}
                  >
                    <Typography variant="subtitle2">Users Can Chat With</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label={selectedUsers.length} color="success" variant="outlined" />
                      <Checkbox
                        size="small"
                        checked={selectedUsers.length > 0 && checkedSelectedIds.length === selectedUsers.length}
                        indeterminate={checkedSelectedIds.length > 0 && checkedSelectedIds.length < selectedUsers.length}
                        onChange={(event) => handleToggleAllSelected(event.target.checked)}
                      />
                    </Stack>
                  </Stack>
                  {selectedGlobalUserName ? (
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1.25 }}>
                      Default permission for {selectedGlobalUserName}
                      {selectedGlobalUserEmail ? ` (${selectedGlobalUserEmail})` : ""}
                    </Typography>
                  ) : null}
                  <Divider />
                  <List dense sx={{ maxHeight: 280, overflowY: "auto", mt: 0.5 }}>
                    {!selectedUsers.length ? (
                      <Box sx={{ p: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          No default users selected.
                        </Typography>
                      </Box>
                    ) : null}
                    {selectedUsers.map((user) => (
                      <ListItemButton
                        key={user.id}
                        onClick={() =>
                          toggleSelectedChecked(
                            user.id,
                            !checkedSelectedIds.includes(user.id),
                          )
                        }
                        sx={{ borderRadius: 1, mb: 0.5 }}
                      >
                        <Checkbox
                          checked={checkedSelectedIds.includes(user.id)}
                          onChange={(event) =>
                            toggleSelectedChecked(user.id, event.target.checked)
                          }
                        />
                        <Box sx={{ position: "relative", display: "inline-flex", mr: 1.25 }}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>
                            {getInitials(user.name)}
                          </Avatar>
                          {user?.is_global_member ? (
                            <Box
                              sx={{
                                position: "absolute",
                                right: -1,
                                bottom: -1,
                                width: 9,
                                height: 9,
                                borderRadius: "50%",
                                bgcolor: "#ff8a00",
                                border: "2px solid",
                                borderColor: "background.paper",
                              }}
                            />
                          ) : null}
                        </Box>
                        <ListItemText
                          primary={user.name}
                          secondary={user.email}
                          primaryTypographyProps={{ variant: "body2" }}
                          secondaryTypographyProps={{ variant: "caption" }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Paper>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Select members from left panel, move to right panel, then click Save.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.25 }}>
          <Button
            variant="text"
            onClick={() => {
              setSelectedAllowedIds(activePermissionIds);
              setCheckedAvailableIds([]);
              setCheckedSelectedIds([]);
            }}
            disabled={permissionSaving || permissionLoading}
          >
            Reset
          </Button>
          <Button onClick={() => setPermissionOpen(false)} disabled={permissionSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handlePermissionSave}
            disabled={permissionSaving || permissionLoading}
          >
            {permissionSaving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={2500}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default GlobalMembersSection;
