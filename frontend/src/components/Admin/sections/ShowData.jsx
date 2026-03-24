import { DataGrid } from "@mui/x-data-grid";
import FormCard from "../forms/FormCard";

const defaultRows = [
  { id: 1, name: "Anita Sharma", email: "anita@aabhyasa.com", role: "Admin", department: "Product", status: "Active" },
  { id: 2, name: "Ravi Verma", email: "ravi@aabhyasa.com", role: "Member", department: "Engineering", status: "Pending" },
  { id: 3, name: "Nisha Rao", email: "nisha@aabhyasa.com", role: "Manager", department: "HR", status: "Active" },
  { id: 4, name: "Sameer Khan", email: "sameer@aabhyasa.com", role: "Orange Member", department: "Marketing", status: "Inactive" },
];

const defaultColumns = [
  { field: "name", headerName: "Name", flex: 1, minWidth: 160 },
  { field: "email", headerName: "Email", flex: 1.2, minWidth: 220 },
  { field: "department", headerName: "Department", flex: 0.8, minWidth: 140 },
  { field: "role", headerName: "Role", flex: 0.7, minWidth: 120 },
  { field: "status", headerName: "Status", flex: 0.6, minWidth: 120 },
];

const ShowData = ({ rows = defaultRows, columns = defaultColumns, title = "Active Users" }) => (
  <FormCard title={title} contentProps={{ sx: { p: 0 } }}>
    <div style={{ height: 420, width: "100%" }}>
      <DataGrid
        rows={rows}
        columns={columns}
        disableColumnMenu
        disableRowSelectionOnClick
        sx={{ border: "none" }}
      />
    </div>
  </FormCard>
);

export default ShowData;
