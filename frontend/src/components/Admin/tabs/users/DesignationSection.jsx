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
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { RefreshButton, SearchInput } from "./shared";
import {
  PiPencilSimpleLine,
  PiTrash,
} from "react-icons/pi";
import { API_BASE_URL } from "../../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../../utils/authApi";

const normalizeDepartments = (rows = []) =>
  rows
    .map((department, index) => ({
      id: Number(department?.department_id ?? department?.id ?? index + 1),
      name: String(department?.name ?? "").trim(),
    }))
    .filter((department) => department.id > 0 && department.name);

const normalizeDesignations = (rows = []) =>
  rows
    .map((designation, index) => ({
      id: Number(designation?.designation_id ?? designation?.id ?? index + 1),
      title: String(designation?.name ?? designation?.title ?? "").trim(),
      departmentId: Number(
        designation?.department_id ?? designation?.departmentId ?? 0,
      ),
      status: String(designation?.status ?? "active").toLowerCase(),
    }))
    .filter((designation) => designation.id > 0 && designation.title);

const DesignationSection = ({
  designations: sourceDesignations = [],
  departments: sourceDepartments = [],
  onDesignationsChanged,
}) => {
  const normalizedDepartments = useMemo(
    () => normalizeDepartments(sourceDepartments),
    [sourceDepartments],
  );
  const [designations, setDesignations] = useState(
    normalizeDesignations(sourceDesignations),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [newDesignation, setNewDesignation] = useState("");
  const [newDept, setNewDept] = useState("");
  const [activeDesignationId, setActiveDesignationId] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editValues, setEditValues] = useState({
    title: "",
    departmentId: "",
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDesignations(normalizeDesignations(sourceDesignations));
  }, [sourceDesignations]);

  const departmentMap = useMemo(
    () =>
      normalizedDepartments.reduce((acc, dept) => {
        acc[Number(dept.id)] = dept.name;
        return acc;
      }, {}),
    [normalizedDepartments],
  );

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return designations;
    return designations.filter(({ title, departmentId }) => {
      const departmentName = departmentMap[departmentId] || "";
      return (
        String(title || "").toLowerCase().includes(query) ||
        departmentName.toLowerCase().includes(query)
      );
    });
  }, [searchTerm, designations, departmentMap]);

  const tableRows = useMemo(
    () =>
      filteredRows.map((row, index) => ({
        ...row,
        serial: index + 1,
        departmentName: departmentMap[row.departmentId] || "-",
      })),
    [filteredRows, departmentMap],
  );

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenEdit = (designationId) => {
    setActiveDesignationId(designationId);
    const selected = designations.find((item) => item.id === designationId);
    if (!selected) return;
    setEditValues({
      title: selected.title,
      departmentId: String(selected.departmentId ?? ""),
    });
    setEditDialogOpen(true);
  };

  const activeDesignation = designations.find(
    (item) => item.id === activeDesignationId,
  );

  const handleOpenDelete = (designationId) => {
    setActiveDesignationId(designationId);
    setDeleteDialogOpen(true);
  };

  const handleEditSave = async () => {
    const trimmedTitle = editValues.title.trim();
    const selectedDeptId = Number(editValues.departmentId);
    if (!trimmedTitle || !selectedDeptId || !activeDesignation) return;
    setIsSaving(true);
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/designations/${activeDesignation.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedTitle,
            department_id: selectedDeptId,
            status: activeDesignation?.status || "active",
          }),
        },
      );

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to update designation");
      }

      setEditDialogOpen(false);
      showSnackbar("Designation updated successfully.");
      const updated = payload?.data || {};
      setDesignations((prev) =>
        prev.map((item) =>
          item.id === activeDesignation.id
            ? {
                ...item,
                title: updated?.name || trimmedTitle,
                name: updated?.name || trimmedTitle,
                departmentId:
                  Number(updated?.department_id) || selectedDeptId,
                department_id:
                  Number(updated?.department_id) || selectedDeptId,
                status: updated?.status || item?.status || "active",
              }
            : item,
        ),
      );
      if (typeof onDesignationsChanged === "function") {
        Promise.resolve(onDesignationsChanged()).catch(() => {});
      }
    } catch (error) {
      showSnackbar(error?.message || "Unable to update designation", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!activeDesignation) return;
    setIsSaving(true);
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/designations/${activeDesignation.id}`,
        { method: "DELETE" },
      );

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to delete designation");
      }

      setDeleteDialogOpen(false);
      showSnackbar("Designation deleted successfully.");
      setDesignations((prev) =>
        prev.filter((item) => item.id !== activeDesignation.id),
      );
      if (typeof onDesignationsChanged === "function") {
        Promise.resolve(onDesignationsChanged()).catch(() => {});
      }
    } catch (error) {
      showSnackbar(error?.message || "Unable to delete designation", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDesignation = async (event) => {
    event.preventDefault();
    const trimmedTitle = newDesignation.trim();
    if (!trimmedTitle || !newDept) return;
    setIsSaving(true);
    try {
      const selectedDeptId = Number(newDept);
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/designations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedTitle,
            department_id: selectedDeptId,
            status: "active",
          }),
        },
      );

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to create designation");
      }

      setNewDesignation("");
      setNewDept("");
      showSnackbar("Designation added successfully.");
      const created = payload?.data || {};
      setDesignations((prev) => [
        ...prev,
        {
          id: Number(created?.designation_id) || prev.length + 1,
          designation_id: Number(created?.designation_id) || prev.length + 1,
          title: created?.name || trimmedTitle,
          name: created?.name || trimmedTitle,
          departmentId: Number(created?.department_id) || selectedDeptId,
          department_id: Number(created?.department_id) || selectedDeptId,
          status: created?.status || "active",
        },
      ]);
      if (typeof onDesignationsChanged === "function") {
        Promise.resolve(onDesignationsChanged()).catch(() => {});
      }
    } catch (error) {
      showSnackbar(error?.message || "Unable to add designation", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const departmentOptions = useMemo(
    () =>
      normalizedDepartments.map((department) => ({
        label: department.name,
        value: department.id,
      })),
    [normalizedDepartments],
  );

  return (
    <>
      <Grid container spacing={2}>
        <Grid item xs={12} md={8} flex={1}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
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
                placeholder="Search by designation or department"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <RefreshButton onReset={() => setSearchTerm("")} />
                <Chip
                  label={designations.length}
                  variant="outlined"
                  sx={{
                    borderRadius: 1,
                    fontWeight: 600,
                    borderColor: "text.secondary",
                  }}
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
                rows={tableRows}
                columns={[
                  {
                    field: "serial",
                    headerName: "S.No",
                    width: 100,
                    sortable: false,
                    align: "center",
                    headerAlign: "center",
                  },
                  {
                    field: "title",
                    headerName: "Designation",
                    flex: 1,
                    renderCell: ({ value }) => (
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        sx={{ display: "flex", alignItems: "center", height: "100%" }}
                      >
                        {value}
                      </Typography>
                    ),
                  },
                  {
                    field: "departmentName",
                    headerName: "Department",
                    flex: 1,
                    renderCell: ({ value }) => (
                      <Typography
                        variant="body2"
                        sx={{ display: "flex", alignItems: "center", height: "100%" }}
                      >
                        {value}
                      </Typography>
                    ),
                  },
                  {
                    field: "status",
                    headerName: "Status",
                    width: 130,
                    align: "center",
                    headerAlign: "center",
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
                    width: 220,
                    sortable: false,
                    filterable: false,
                    align: "center",
                    headerAlign: "center",
                    renderCell: (params) => (
                      <Stack
                        direction="row"
                        spacing={0.8}
                        sx={{ width: "100%", justifyContent: "center" }}
                      >
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<PiPencilSimpleLine size={14} />}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenEdit(params.row.id);
                          }}
                          sx={{ textTransform: "none", borderRadius: 1.2 }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<PiTrash size={14} />}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenDelete(params.row.id);
                          }}
                          sx={{ textTransform: "none", borderRadius: 1.2 }}
                        >
                          Delete
                        </Button>
                      </Stack>
                    ),
                  },
                ]}
                getRowId={(row) => row.id}
                rowHeight={54}
                columnHeaderHeight={48}
                sx={{
                  "& .MuiDataGrid-columnHeaders": {
                    backgroundColor: "background.default",
                  },
                  "& .MuiDataGrid-cell": {
                    alignItems: "center",
                  },
                }}
                localeText={{
                  noRowsLabel: "No designations match this search.",
                }}
              />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4} >
          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: "1px solid",
              borderColor: "divider",
              height: "100%",
            }}
          >
            <Typography
              variant="subtitle1"
              fontWeight={700}
              gutterBottom
              sx={{ textTransform: "uppercase" }}
            >
              Add New Designation
            </Typography>
            <Box component="form" onSubmit={handleAddDesignation} sx={{ mt: 2 }}>
              <TextField
                select
                label="Department"
                value={newDept}
                onChange={(event) => setNewDept(event.target.value)}
                fullWidth
                size="small"
                sx={{ mb: 2 }}
                SelectProps={{
                  displayEmpty: true,
                  renderValue: (value) =>
                    (value && departmentMap[Number(value)]) || (
                      <Typography color="text.secondary">
                        Select department
                      </Typography>
                    ),
                }}
              >
                <MenuItem value="" disabled>
                  Select department
                </MenuItem>
                {departmentOptions.map(({ label, value }) => (
                  <MenuItem key={value} value={String(value)}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Designation Name"
                placeholder={newDept ? "Enter designation name" : "Select department first"}
                value={newDesignation}
                onChange={(event) => setNewDesignation(event.target.value)}
                fullWidth
                size="small"
                disabled={!newDept || isSaving || !departmentOptions.length}
                sx={{ mb: 2 }}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={
                  !newDesignation.trim() ||
                  !newDept ||
                  isSaving ||
                  !departmentOptions.length
                }
                sx={{
                  borderRadius: 0.5,
                  fontWeight: 600,
                  letterSpacing: 0.6,
                }}
              >
                {isSaving ? "Adding..." : "Add"}
              </Button>
              {!departmentOptions.length ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Add at least one department first to create designations.
                </Alert>
              ) : null}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Edit Designation</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Department"
              value={editValues.departmentId}
              onChange={(event) =>
                setEditValues((prev) => ({
                  ...prev,
                  departmentId: event.target.value,
                }))
              }
              fullWidth
              SelectProps={{
                displayEmpty: true,
              }}
            >
              <MenuItem value="" disabled>
                Select department
              </MenuItem>
              {departmentOptions.map(({ label, value }) => (
                <MenuItem key={value} value={String(value)}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Designation Name"
              value={editValues.title}
              onChange={(event) =>
                setEditValues((prev) => ({ ...prev, title: event.target.value }))
              }
              fullWidth
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="error" onClick={() => setEditDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleEditSave}
            disabled={!editValues.title.trim() || !editValues.departmentId || isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-designation-dialog"
      >
        <DialogTitle id="delete-designation-dialog">
          Delete Designation
        </DialogTitle>
        <DialogContent dividers>
          <Typography>
            Are you sure you want to remove{" "}
            <strong>{activeDesignation?.title}</strong>?
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

export default DesignationSection;
