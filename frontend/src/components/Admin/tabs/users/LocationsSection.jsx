import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import LocationForm from "../../forms/LocationForm";
import { RefreshButton, SearchInput } from "./shared";
import { PiDotsThreeOutlineFill, PiPencilSimpleLine, PiTrash } from "react-icons/pi";
import { API_BASE_URL } from "../../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../../utils/authApi";

const formatCellValue = (value) => {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : "N/A";
};

const LocationsSection = ({
  locations: sourceLocations = [],
  onLocationsChanged,
}) => {
  const [locations, setLocations] = useState(sourceLocations);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionAnchor, setActionAnchor] = useState(null);
  const [activeLocationId, setActiveLocationId] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editValues, setEditValues] = useState({
    label: "",
    country: "",
    status: "active",
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocations(sourceLocations);
  }, [sourceLocations]);

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return locations;
    return locations.filter(({ label, country }) =>
      [label, country]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(query)),
    );
  }, [searchTerm, locations]);

  const activeLocation = locations.find((location) => location.id === activeLocationId);

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenActions = (event, locationId) => {
    setActionAnchor(event.currentTarget);
    setActiveLocationId(locationId);
  };

  const handleCloseActions = () => {
    setActionAnchor(null);
  };

  const handleEditLocation = () => {
    if (!activeLocation) return;
    setEditValues({
      label: activeLocation.label || "",
      country: activeLocation.country || "",
      status: activeLocation.status || "active",
    });
    setEditDialogOpen(true);
    handleCloseActions();
  };

  const handleDeleteLocation = () => {
    setDeleteDialogOpen(true);
    handleCloseActions();
  };

  const handleEditSave = async () => {
    if (!activeLocation) return;
    setIsSaving(true);
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/locations/${activeLocation.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: editValues.label,
            country: editValues.country || "India",
            status: editValues.status || "active",
          }),
        },
      );

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to update location");
      }

      setEditDialogOpen(false);
      showSnackbar("Location updated successfully.");
      const updated = payload?.data || {};
      setLocations((prev) =>
        prev.map((location) =>
          location.id === activeLocation.id
            ? {
                ...location,
                ...editValues,
                label: updated?.label || editValues.label,
                country: updated?.country || editValues.country || "India",
                status: updated?.status || editValues.status || "active",
              }
            : location,
        ),
      );
      if (typeof onLocationsChanged === "function") {
        Promise.resolve(onLocationsChanged()).catch(() => {});
      }
    } catch (error) {
      showSnackbar(error?.message || "Unable to update location", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!activeLocation) return;
    setIsSaving(true);
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/locations/${activeLocation.id}`,
        { method: "DELETE" },
      );

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to delete location");
      }

      setDeleteDialogOpen(false);
      showSnackbar("Location deleted successfully.");
      setLocations((prev) =>
        prev.filter((location) => location.id !== activeLocation.id),
      );
      if (typeof onLocationsChanged === "function") {
        Promise.resolve(onLocationsChanged()).catch(() => {});
      }
    } catch (error) {
      showSnackbar(error?.message || "Unable to delete location", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddLocation = async (newLocation) => {
    if (!newLocation?.label?.trim()) return;
    setIsSaving(true);
    try {
      const payloadBody = {
        label: newLocation.label.trim(),
        country: newLocation.country || "India",
        status: "active",
      };
      const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody),
      });

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to create location");
      }

      showSnackbar("Location added successfully.");
      const created = payload?.data || {};
      setLocations((prev) => [
        ...prev,
        {
          id: Number(created?.location_id) || prev.length + 1,
          location_id: Number(created?.location_id) || prev.length + 1,
          ...newLocation,
          label: created?.label || newLocation.label,
          country: created?.country || newLocation.country || "India",
          status: created?.status || "active",
        },
      ]);
      if (typeof onLocationsChanged === "function") {
        Promise.resolve(onLocationsChanged()).catch(() => {});
      }
    } catch (error) {
      showSnackbar(error?.message || "Unable to add location", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusUpdate = async (nextStatus) => {
    if (!activeLocation || !nextStatus) return;
    setIsSaving(true);
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/locations/${activeLocation.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        },
      );

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to update status");
      }

      handleCloseActions();
      showSnackbar(`Location ${nextStatus} successfully.`);
      setLocations((prev) =>
        prev.map((location) =>
          location.id === activeLocation.id
            ? { ...location, status: nextStatus }
            : location,
        ),
      );
      if (typeof onLocationsChanged === "function") {
        Promise.resolve(onLocationsChanged()).catch(() => {});
      }
    } catch (error) {
      showSnackbar(error?.message || "Unable to update status", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Grid container spacing={2}>
        <Grid item xs={12} md={8} flex={1}>
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
            >
              <SearchInput
                placeholder="Search location"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <RefreshButton onReset={() => setSearchTerm("")} />
                <Chip
                  label={locations.length}
                  variant="outlined"
                  sx={{ borderRadius: 1, fontWeight: 600, borderColor: "text.secondary" }}
                />
              </Stack>
            </Stack>
            <Box
              sx={{
                mt: 2,
                height: {
                  xs: "calc(100vh - 320px)",
                  md: "calc(100vh - 280px)",
                },
              }}
            >
              <DataGrid
                disableColumnMenu
                disableRowSelectionOnClick
                rows={filteredRows.map((row, index) => ({
                  ...row,
                  serial: index + 1,
                }))}
                columns={[
                  { field: "serial", headerName: "S.No", width: 100, sortable: false },
                  {
                    field: "label",
                    headerName: "Location",
                    flex: 1,
                    renderCell: ({ value }) => (
                      <Typography fontWeight={500} sx={{ display: "flex", alignItems: "center", height: "100%" }}>
                        {formatCellValue(value)}
                      </Typography>
                    ),
                  },
                  {
                    field: "country",
                    headerName: "Country",
                    flex: 0.8,
                    renderCell: ({ value }) => (
                      <Typography color={value ? "text.primary" : "text.secondary"}>
                        {formatCellValue(value)}
                      </Typography>
                    ),
                  },
                  {
                    field: "status",
                    headerName: "Status",
                    width: 120,
                    renderCell: ({ value }) => (
                      <Chip
                        size="small"
                        label={String(value || "active")}
                        color={
                          String(value || "").toLowerCase() === "active"
                            ? "success"
                            : "default"
                        }
                        sx={{ textTransform: "capitalize" }}
                      />
                    ),
                  },
                  {
                    field: "actions",
                    headerName: "Actions",
                    width: 110,
                    sortable: false,
                    filterable: false,
                    align: "center",
                    renderCell: (params) => (
                      <IconButton
                        aria-label="Location actions"
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenActions(event, params.row.id);
                        }}
                      >
                        <PiDotsThreeOutlineFill size={18} />
                      </IconButton>
                    ),
                  },
                ]}
                getRowId={(row) => row.id}
                localeText={{
                  noRowsLabel: "No locations match this search.",
                }}
              />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4} flex={1/3}>
          <LocationForm title="Add New Location" onSubmit={handleAddLocation} />
        </Grid>
      </Grid>

      <Menu
        anchorEl={actionAnchor}
        open={Boolean(actionAnchor)}
        onClose={handleCloseActions}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={handleEditLocation}>
          <PiPencilSimpleLine size={16} style={{ marginRight: 8 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDeleteLocation}>
          <PiTrash size={16} style={{ marginRight: 8 }} />
          Delete
        </MenuItem>
        {String(activeLocation?.status || "active").toLowerCase() === "active" ? (
          <MenuItem onClick={() => handleStatusUpdate("inactive")}>
            Mark Inactive
          </MenuItem>
        ) : (
          <MenuItem onClick={() => handleStatusUpdate("active")}>
            Mark Active
          </MenuItem>
        )}
      </Menu>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Edit Location</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Label"
              value={editValues.label}
              onChange={(event) => setEditValues((prev) => ({ ...prev, label: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Country"
              value={editValues.country}
              onChange={(event) => setEditValues((prev) => ({ ...prev, country: event.target.value }))}
              fullWidth
            />
            <TextField
              select
              label="Status"
              value={editValues.status}
              onChange={(event) =>
                setEditValues((prev) => ({ ...prev, status: event.target.value }))
              }
              fullWidth
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="error" onClick={() => setEditDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleEditSave}
            disabled={!editValues.label.trim() || isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-location-dialog"
      >
        <DialogTitle id="delete-location-dialog">Delete Location</DialogTitle>
        <DialogContent dividers>
          <Typography>
            Are you sure you want to remove <strong>{activeLocation?.label}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm}>
            {isSaving ? "Deleting..." : "Delete"}
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

export default LocationsSection;
