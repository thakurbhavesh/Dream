import { useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { FiBriefcase, FiEdit2, FiShield, FiUser } from "react-icons/fi";
import { API_BASE_URL } from "../../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../../utils/authApi";

const normalize = (value) => String(value || "").trim().toLowerCase();

const getInitials = (value) => {
  const text = String(value || "").trim();
  if (!text) return "NA";
  return text
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
};

const getRoleMeta = (roleName, roleKey) => {
  const name = normalize(roleName);
  const key = normalize(roleKey);
  if (["admin", "super admin"].includes(name) || ["admin", "super_admin"].includes(key)) {
    return { label: roleName || "Admin", color: "error", icon: <FiShield size={12} /> };
  }
  if (["users", "user", "member"].includes(name) || ["users", "user", "member"].includes(key)) {
    return { label: roleName || "User", color: "primary", icon: <FiUser size={12} /> };
  }
  return { label: roleName || roleKey || "Role", color: "info", icon: <FiBriefcase size={12} /> };
};

const renderStatusChip = (value) => {
  const normalized = normalize(value);
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

const RolesSection = ({ users = [], roles = [], onUsersChanged }) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("asc");
  const [editingRow, setEditingRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const activeRoles = useMemo(
    () =>
      roles.filter(
        (role) =>
          String(role?.status || "active").toLowerCase() === "active" &&
          Number(role?.role_id) !== 1 &&
          String(role?.role_key || "").toLowerCase() !== "owner" &&
          String(role?.role_name || "").toLowerCase() !== "owner",
      ),
    [roles],
  );

  const rows = useMemo(
    () =>
      users
        .filter(
          (user) =>
            Number(user?.role_id) !== 1 &&
            String(user?.role_key || "").toLowerCase() !== "owner" &&
            String(user?.role_name || "").toLowerCase() !== "owner",
        )
        .filter((user) => {
          if (roleFilter === "all") return true;
          return String(user?.role_id || "") === String(roleFilter);
        })
        .filter((user) => {
          const query = String(searchTerm || "").trim().toLowerCase();
          if (!query) return true;
          return [user?.name, user?.email, user?.role_name, user?.role_key]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
        })
        .sort((a, b) => {
          const roleA = String(a?.role_name || a?.role_key || "").toLowerCase();
          const roleB = String(b?.role_name || b?.role_key || "").toLowerCase();
          const nameA = String(a?.name || "").toLowerCase();
          const nameB = String(b?.name || "").toLowerCase();
          const roleCompare = roleA.localeCompare(roleB);
          const nameCompare = nameA.localeCompare(nameB);
          if (sortOrder === "desc") {
            return roleCompare !== 0 ? -roleCompare : -nameCompare;
          }
          return roleCompare !== 0 ? roleCompare : nameCompare;
        })
        .map((user, index) => ({
          ...user,
          serial: index + 1,
        })),
    [users, roleFilter, searchTerm, sortOrder],
  );

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSave = async () => {
    if (!editingRow?.id || !editingRow?.role_id) return;
    setSaving(true);
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/users/${editingRow.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role_id: Number(editingRow.role_id) }),
        },
      );

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to update role");
      }

      setEditingRow(null);
      showSnackbar("Role updated successfully.");
      if (typeof onUsersChanged === "function") {
        await onUsersChanged();
      }
    } catch (error) {
      showSnackbar(error?.message || "Unable to update role", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          sx={{ mb: 1.5 }}
        >
          <Stack spacing={0.2}>
            <Typography variant="overline" color="text.secondary">
              Access Control
            </Typography>
            <Typography variant="subtitle1" fontWeight={800}>
              Roles Directory
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.8} flexWrap="wrap">
            <Chip size="small" color="primary" label={`Users: ${rows.length}`} />
            <Chip size="small" variant="outlined" label={`Roles: ${activeRoles.length}`} />
          </Stack>
        </Stack>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", md: "center" }}
          sx={{ mb: 1.5 }}
        >
          <TextField
            size="small"
            placeholder="Search by name, email, role"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            sx={{ minWidth: { xs: "100%", md: 260 } }}
          />
          <TextField
            size="small"
            select
            label="Role Filter"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            sx={{ minWidth: { xs: "100%", md: 200 } }}
          >
            <MenuItem value="all">All Roles</MenuItem>
            {activeRoles.map((role) => (
              <MenuItem key={role.role_id} value={String(role.role_id)}>
                {role.role_name || role.role_key}
              </MenuItem>
            ))}
          </TextField>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={sortOrder}
            onChange={(_, value) => {
              if (value) setSortOrder(value);
            }}
            sx={{ ml: { xs: 0, md: "auto" } }}
          >
            <ToggleButton value="asc">Role A-Z</ToggleButton>
            <ToggleButton value="desc">Role Z-A</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <Box sx={{ height: "calc(100vh - 260px)" }}>
          <DataGrid
            disableRowSelectionOnClick
            rows={rows}
            getRowId={(row) => row.id}
            rowHeight={62}
            columnHeaderHeight={52}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              backgroundColor: "background.paper",
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor: theme.palette.mode === "light" ? "#f8fafc" : "grey.900",
                borderBottom: "1px solid",
                borderColor: "divider",
              },
              "& .MuiDataGrid-columnHeaderTitle": {
                fontWeight: 700,
                fontSize: "0.8rem",
                color: "text.secondary",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              },
              "& .MuiDataGrid-row:hover": {
                backgroundColor: theme.palette.mode === "light" ? "#f8fbff" : "action.hover",
              },
            }}
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
                renderCell: ({ row }) => (
                  <Stack direction="row" spacing={1.2} alignItems="center" height="100%">
                    <Box sx={{ position: "relative", display: "inline-flex" }}>
                      <Avatar sx={{ width: 34, height: 34, fontSize: 13 }}>
                        {getInitials(row?.name)}
                      </Avatar>
                      {row?.is_global_member ? (
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
                    <Typography variant="body2" fontWeight={600}>
                      {row?.name || "N/A"}
                    </Typography>
                  </Stack>
                ),
              },
              {
                field: "email",
                headerName: "Email",
                flex: 1,
                renderCell: ({ row }) => row?.email || "N/A",
              },
              {
                field: "role_name",
                headerName: "Role",
                flex: 0.8,
                renderCell: ({ row }) => {
                  const roleMeta = getRoleMeta(row?.role_name, row?.role_key);
                  return (
                    <Chip
                      size="small"
                      icon={roleMeta.icon}
                      label={roleMeta.label}
                      color={roleMeta.color}
                      variant="outlined"
                    />
                  );
                },
              },
              {
                field: "membership_status",
                headerName: "Status",
                width: 140,
                renderCell: ({ row }) => renderStatusChip(row?.membership_status || "n/a"),
              },
              {
                field: "actions",
                headerName: "Actions",
                width: 130,
                sortable: false,
                filterable: false,
                renderCell: ({ row }) => (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FiEdit2 size={13} />}
                    sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5 }}
                    onClick={() =>
                      setEditingRow({
                        id: row?.user_id || row?.id,
                        name: row?.name || "",
                        email: row?.email || "",
                        role_id: String(row?.role_id || ""),
                      })
                    }
                  >
                    Edit
                  </Button>
                ),
              },
            ]}
          />
        </Box>
      </Paper>
      <Dialog
        open={Boolean(editingRow)}
        onClose={() => !saving && setEditingRow(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Edit User Role</DialogTitle>
        <DialogContent dividers>
          {editingRow ? (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {editingRow.name} ({editingRow.email})
              </Typography>
              <TextField
                select
                label="Role"
                value={editingRow.role_id}
                onChange={(event) =>
                  setEditingRow((prev) =>
                    prev ? { ...prev, role_id: event.target.value } : prev,
                  )
                }
                fullWidth
              >
                <MenuItem value="">Select role</MenuItem>
                {activeRoles.map((role) => (
                  <MenuItem key={role.role_id} value={String(role.role_id)}>
                    {role.role_name || role.role_key}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingRow(null)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !editingRow?.role_id}
          >
            {saving ? "Saving..." : "Save"}
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

export default RolesSection;
