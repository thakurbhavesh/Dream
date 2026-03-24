import { useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import BulkUploadDialog from "../../dialogs/BulkUploadDialog";
import {
  RefreshButton,
  SearchInput,
  UserActionsMenu,
  getInitials,
} from "./shared";

const UsersListSection = ({
  onAddUser,
  onUsersChanged,
  users = [],
  departments = [],
  designations = [],
  locations = [],
  roles = [],
  organizationCustomDomain = "",
  maxUsers = 0,
  activeUsers = 0,
}) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const [gridRefreshKey, setGridRefreshKey] = useState(0);
  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return users;
    return users.filter(
      ({ name, email, designation, department, location, membership_status }) =>
        [name, email, designation, department, location, membership_status]
          .filter(Boolean)
          .some((field) =>
            String(field).toLowerCase().includes(query),
          ),
    );
  }, [searchTerm, users]);

  const gridRows = useMemo(
    () =>
      filteredUsers.map((row, index) => ({
        ...row,
        serial: index + 1,
      })),
    [filteredUsers],
  );
  const hasSeatLimit = Number(maxUsers) > 0;
  const seatsRemaining = hasSeatLimit
    ? Math.max(Number(maxUsers) - Number(activeUsers || 0), 0)
    : null;
  const licenseFull = hasSeatLimit && seatsRemaining <= 0;

  const renderValue = (value) => {
    const normalized = String(value ?? "").trim();
    if (!normalized) {
      return (
        <Typography variant="body2" color="text.disabled" fontStyle="italic">
          N/A
        </Typography>
      );
    }
    return (
      <Typography variant="body2" color="text.primary">
        {normalized}
      </Typography>
    );
  };

  const renderStatusChip = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) {
      return <Chip size="small" variant="outlined" label="N/A" />;
    }
    const label = normalized.replace(/_/g, " ");
    if (normalized === "active") {
      return (
        <Chip
          size="small"
          label={label}
          sx={{
            textTransform: "capitalize",
            backgroundColor: "rgba(46, 125, 50, 0.14)",
            border: "1px solid rgba(46, 125, 50, 0.45)",
            color: "#1b5e20",
            fontWeight: 600,
          }}
        />
      );
    }
    if (normalized === "invited") {
      return (
        <Chip
          size="small"
          label={label}
          sx={{
            textTransform: "capitalize",
            backgroundColor: "rgba(2, 136, 209, 0.14)",
            border: "1px solid rgba(2, 136, 209, 0.42)",
            color: "#01579b",
            fontWeight: 600,
          }}
        />
      );
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
            fontWeight: 600,
          }}
        />
      );
    }
    if (["left", "archived", "inactive"].includes(normalized)) {
      return (
        <Chip
          size="small"
          label={label}
          sx={{
            textTransform: "capitalize",
            backgroundColor: "rgba(71, 85, 105, 0.12)",
            border: "1px solid rgba(71, 85, 105, 0.4)",
            color: "#334155",
            fontWeight: 600,
          }}
        />
      );
    }
    return <Chip size="small" variant="outlined" label={label} sx={{ textTransform: "capitalize" }} />;
  };

  return (
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
        alignItems={{ xs: "stretch", md: "center" }}
      >
        <SearchInput
          placeholder="Search members"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          sx={{ minHeight: 42 }}
        />
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
          {hasSeatLimit ? (
            <Typography variant="caption" color="text.secondary">
              Seats: {activeUsers}/{maxUsers}
            </Typography>
          ) : null}
          <RefreshButton
            onReset={() => {
              setSearchTerm("");
              setGridRefreshKey((prev) => prev + 1);
            }}
          />
          <Box component="span">
            <BulkUploadDialog
              triggerSx={{ minWidth: 130 }}
              onUsersChanged={onUsersChanged}
              organizationCustomDomain={organizationCustomDomain}
              maxUsers={maxUsers}
              activeUsers={activeUsers}
            />
          </Box>
          <Tooltip title="Add a new user" arrow>
            <Button
              variant="contained"
              onClick={onAddUser}
              disabled={licenseFull}
              sx={{
                height: 42,
                px: 2.4,
                borderRadius: 1.5,
                fontSize: "0.82rem",
                fontWeight: 700,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                boxShadow: "none",
                "&:hover": { boxShadow: "none" },
              }}
            >
              {licenseFull ? "Limit Reached" : "Add User"}
            </Button>
          </Tooltip>
        </Stack>
      </Stack>
      <Box sx={{ height: "calc(100vh - 290px)", mt: 2 }}>
        <DataGrid
          key={gridRefreshKey}
          disableRowSelectionOnClick
          rows={gridRows}
          getRowId={(row) => row?.user_id ?? row?.id}
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
            "& .MuiDataGrid-row": {
              borderBottom: "1px solid",
              borderColor: "divider",
            },
            "& .MuiDataGrid-row:hover": {
              backgroundColor: theme.palette.mode === "light" ? "#f8fafc" : "action.hover",
            },
            "& .MuiDataGrid-cell": {
              display: "flex",
              alignItems: "center",
            },
            "& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus": {
              outline: "none",
            },
          }}
          columns={[
            { field: "serial", headerName: "S.No", width: 90, sortable: false },
            {
              field: "name",
              headerName: "User",
              flex: 1.3,
              renderCell: ({ row }) => (
                <Stack direction="row" spacing={1.5} alignItems="center" height="100%">
                  <Box sx={{ position: "relative", display: "inline-flex" }}>
                    <Avatar
                      src={row.profilePicture || undefined}
                      sx={{ width: 36, height: 36, fontSize: 16, background: theme.palette.primary.light }}
                    >
                      {getInitials(row.name || "N/A")}
                    </Avatar>
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
                  <Box>
                    <Typography
                      variant="body2"
                      fontWeight={500}
                      color="text.primary"
                    >
                      {row.name || "N/A"}
                    </Typography>
                  </Box>
                </Stack>
              ),
            },
            {
              field: "email",
              headerName: "Email",
              flex: 1.2,
              renderCell: ({ value }) => renderValue(value),
            },
            {
              field: "designation",
              headerName: "Designation",
              flex: 1,
              renderCell: ({ value }) => renderValue(value),
            },
            {
              field: "department",
              headerName: "Department",
              flex: 1,
              renderCell: ({ value }) => renderValue(value),
            },
            {
              field: "location",
              headerName: "Location",
              flex: 0.8,
              renderCell: ({ value }) => renderValue(value),
            },
            {
              field: "membership_status",
              headerName: "Status",
              width: 140,
              align: "center",
              headerAlign: "center",
              renderCell: ({ row }) => renderStatusChip(row?.membership_status || "n/a"),
            },
            {
              field: "actions",
              headerName: "Actions",
              sortable: false,
              filterable: false,
              disableColumnMenu: true,
              width: 280,
              align: "center",
              headerAlign: "center",
              renderCell: (params) => (
                <Stack sx={{ width: "100%" }} alignItems="center" justifyContent="center">
                  <UserActionsMenu
                    row={params.row}
                    onUpdated={onUsersChanged}
                    departments={departments}
                    designations={designations}
                    locations={locations}
                    roles={roles}
                    showInlineActions
                  />
                </Stack>
              ),
            },
          ]}
          slots={{ toolbar: GridToolbar }}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 300 },
            },
          }}
        />
      </Box>
    </Paper>
  );
};

export default UsersListSection;
