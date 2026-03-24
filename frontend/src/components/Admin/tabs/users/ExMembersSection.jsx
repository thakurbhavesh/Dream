import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { API_BASE_URL } from "../../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../../utils/authApi";

const normalize = (value) => String(value || "").trim().toLowerCase();

const resolveExStatus = (user) => {
  const membershipStatus = normalize(user?.membership_status || user?.user_status);

  if (["left", "archived", "inactive"].includes(membershipStatus)) {
    return membershipStatus || "left";
  }
  return membershipStatus || "unknown";
};

const ExMembersSection = ({ users = [], onUsersChanged }) => {
  const [loadingId, setLoadingId] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const rows = useMemo(
    () =>
      users.map((user, index) => ({
        ...user,
        serial: index + 1,
        membership_status_label: resolveExStatus(user),
      })),
    [users],
  );

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const renderStatusChip = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    const label = normalized || "n/a";
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

  const handleActivate = async (row) => {
    const userId = row?.user_id || row?.id;
    if (!userId) return;
    setLoadingId(userId);
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/users/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_status: "active",
            membership_status: "active",
          }),
        },
      );

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to activate user");
      }

      showSnackbar("User activated successfully.");
      if (typeof onUsersChanged === "function") {
        await onUsersChanged();
      }
    } catch (error) {
      showSnackbar(error?.message || "Unable to activate user", "error");
    } finally {
      setLoadingId(null);
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
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={1}
          sx={{ mb: 2 }}
        >
          <Typography variant="subtitle1" fontWeight={700}>
            Ex-Members
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {rows.length} records
          </Typography>
        </Stack>
        <Box sx={{ height: "calc(100vh - 280px)" }}>
          <DataGrid
            disableRowSelectionOnClick
            rows={rows}
            getRowId={(row) => row?.user_id ?? row?.id}
            rowHeight={58}
            columnHeaderHeight={50}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              "& .MuiDataGrid-cell": {
                display: "flex",
                alignItems: "center",
              },
            }}
            columns={[
              {
                field: "serial",
                headerName: "S.No",
                width: 90,
                sortable: false,
                align: "center",
                headerAlign: "center",
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
                field: "membership_status_label",
                headerName: "Status",
                width: 150,
                align: "center",
                headerAlign: "center",
                renderCell: ({ row }) => renderStatusChip(row?.membership_status_label || "n/a"),
              },
              {
                field: "actions",
                headerName: "Actions",
                width: 170,
                sortable: false,
                filterable: false,
                align: "center",
                headerAlign: "center",
                renderCell: ({ row }) => (
                  <Stack sx={{ width: "100%" }} alignItems="center" justifyContent="center">
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleActivate(row)}
                      disabled={loadingId === (row?.user_id || row?.id)}
                      sx={{ minWidth: 106 }}
                    >
                      {loadingId === (row?.user_id || row?.id)
                        ? "Activating..."
                        : "Activate"}
                    </Button>
                  </Stack>
                ),
              },
            ]}
            localeText={{ noRowsLabel: "No ex-members found." }}
          />
        </Box>
      </Paper>
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

export default ExMembersSection;
