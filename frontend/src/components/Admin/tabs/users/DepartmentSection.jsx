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
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { RefreshButton, SearchInput } from "./shared";
import { API_BASE_URL } from "../../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../../utils/authApi";
import {
  PiPencilSimpleLine,
  PiTrash,
} from "react-icons/pi";

const DepartmentSection = ({
  departments: sourceDepartments = [],
  onDepartmentsChanged,
}) => {
  const theme = useTheme();
  const [departments, setDepartments] = useState(sourceDepartments);
  const [searchTerm, setSearchTerm] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [activeDeptId, setActiveDeptId] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDepartments(sourceDepartments);
  }, [sourceDepartments]);

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return departments;
    return departments.filter(({ name }) => name.toLowerCase().includes(query));
  }, [searchTerm, departments]);

  const tableRows = useMemo(
    () =>
      filteredRows.map((dept, index) => ({
        ...dept,
        serial: index + 1,
      })),
    [filteredRows],
  );

  const handleAddDepartment = async (event) => {
    event.preventDefault();
    const trimmed = newDepartment.trim();
    if (!trimmed) return;
    setIsSaving(true);
    try {
      const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/departments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          status: "active",
        }),
      });

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to create department");
      }

      setNewDepartment("");
      showSnackbar("Department added successfully.");
      const created = payload?.data || {};
      setDepartments((prev) => [
        ...prev,
        {
          id: Number(created?.department_id) || prev.length + 1,
          department_id: Number(created?.department_id) || prev.length + 1,
          name: created?.name || trimmed,
          status: created?.status || "active",
        },
      ]);
      if (typeof onDepartmentsChanged === "function") {
        Promise.resolve(onDepartmentsChanged()).catch(() => {});
      }
    } catch (error) {
      showSnackbar(error?.message || "Unable to add department", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenEdit = (deptId) => {
    setActiveDeptId(deptId);
    const selected = departments.find((dept) => dept.id === deptId);
    if (!selected) return;
    setEditValue(selected.name);
    setEditDialogOpen(true);
  };

  const handleOpenDelete = (deptId) => {
    setActiveDeptId(deptId);
    setDeleteDialogOpen(true);
  };

  const activeDepartment = departments.find((dept) => dept.id === activeDeptId);

  const handleEditSave = async () => {
    const trimmed = editValue.trim();
    if (!trimmed || !activeDepartment) return;
    setIsSaving(true);
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/departments/${activeDepartment.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmed,
            status: activeDepartment?.status || "active",
          }),
        },
      );

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to update department");
      }

      setEditDialogOpen(false);
      showSnackbar("Department updated successfully.");
      const updated = payload?.data || {};
      setDepartments((prev) =>
        prev.map((dept) =>
          dept.id === activeDepartment.id
            ? {
                ...dept,
                name: updated?.name || trimmed,
                status: updated?.status || dept.status || "active",
              }
            : dept,
        ),
      );
      if (typeof onDepartmentsChanged === "function") {
        Promise.resolve(onDepartmentsChanged()).catch(() => {});
      }
    } catch (error) {
      showSnackbar(error?.message || "Unable to update department", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!activeDepartment) return;
    setIsSaving(true);
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/departments/${activeDepartment.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Failed to delete department");
      }

      setDeleteDialogOpen(false);
      showSnackbar("Department deleted successfully.");
      setDepartments((prev) =>
        prev.filter((dept) => dept.id !== activeDepartment.id),
      );
      if (typeof onDepartmentsChanged === "function") {
        Promise.resolve(onDepartmentsChanged()).catch(() => {});
      }
    } catch (error) {
      showSnackbar(error?.message || "Unable to delete department", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Grid container spacing={3}>
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
                placeholder="Search department"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <RefreshButton
                  onReset={() => {
                    setSearchTerm("");
                  }}
                />
                <Chip
                  label={departments.length}
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
                  field: "name",
                  headerName: "Department",
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
                noRowsLabel: "No departments match this search.",
              }}
            />
          </Box>
        </Paper>
      </Grid>
        <Grid item xs={12} md={4}>
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
              Add New Department
            </Typography>
            <Box component="form" onSubmit={handleAddDepartment} sx={{ mt: 2 }}>
              <TextField
                placeholder="Department Name"
                value={newDepartment}
                onChange={(event) => setNewDepartment(event.target.value)}
                fullWidth
                size="small"
                sx={{ mb: 2 }}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={isSaving || !newDepartment.trim()}
                sx={{
                  borderRadius: 0.5,
                  fontWeight: 600,
                  letterSpacing: 0.6,
                }}
              >
                Add
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Edit Department</DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Department Name"
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button color="error" onClick={() => setEditDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleEditSave}
            disabled={!editValue.trim() || isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-department-dialog"
      >
        <DialogTitle id="delete-department-dialog" fontSize={16} color={theme.palette.text.secondary}>
          Delete Department
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" >
            Are you sure you want to remove{" "}
            <strong>{activeDepartment?.name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteConfirm}
            disabled={isSaving}
          >
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

export default DepartmentSection;
