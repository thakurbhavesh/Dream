import { useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { FiClock, FiEdit2, FiUsers } from "react-icons/fi";
import NewGroupDialog from "../dialogs/NewGroupDialog";
import EditGroupDialog from "../dialogs/EditGroupDialog";
import ManageGroupMembersDialog from "../dialogs/ManageGroupMembersDialog";
import GroupTimelineDialog from "../dialogs/GroupTimelineDialog";

const normalize = (value) => String(value || "").trim().toLowerCase();

const prettyStatus = (value) => {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "Unknown";
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const Group = ({ adminData }) => {
  const theme = useTheme();
  const groups = adminData?.groups || [];
  const users = adminData?.users || [];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const mappedGroups = useMemo(
    () =>
      groups.map((group, index) => ({
        id: Number(group?.group_id ?? group?.id ?? index + 1),
        group_id: Number(group?.group_id ?? group?.id ?? index + 1),
        group_name: group?.group_name || group?.name || "Untitled Group",
        group_description: group?.group_description || "",
        group_image: group?.group_image || group?.group_image_url || null,
        status: normalize(group?.status || "active"),
        members: Number(group?.members || 0),
        is_airtime: Boolean(group?.is_airtime),
      })),
    [groups],
  );

  const filteredGroups = useMemo(() => {
    const query = normalize(search);
    return mappedGroups.filter((group) => {
      const statusOk = statusFilter === "all" || normalize(group.status) === statusFilter;
      const searchOk =
        !query ||
        normalize(group.group_name).includes(query) ||
        normalize(group.group_description).includes(query) ||
        String(group.group_id).includes(query);
      return statusOk && searchOk;
    });
  }, [mappedGroups, search, statusFilter]);

  const stats = useMemo(() => {
    const totalGroups = mappedGroups.length;
    const activeGroups = mappedGroups.filter((group) => normalize(group.status) === "active").length;
    const airtimeGroups = mappedGroups.filter((group) => group.is_airtime).length;
    const totalMembers = mappedGroups.reduce((sum, group) => sum + Number(group.members || 0), 0);
    return { totalGroups, activeGroups, airtimeGroups, totalMembers };
  }, [mappedGroups]);

  return (
    <Box sx={{ width: "100%", maxWidth: 1980, mx: "auto" }}>
      <Stack spacing={2}>
      <Paper
        variant="outlined"
        sx={{
          p: 1.6,
          borderRadius: 2.5,
          borderColor: "divider",
          background:
            theme.palette.mode === "light"
              ? "linear-gradient(130deg, #ffffff 0%, #f7fbff 72%)"
              : theme.palette.background.paper,
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
          spacing={1.5}
        >
          <Stack spacing={0.4}>
            <Typography variant="overline" color="text.secondary">
              Team Collaboration Console
            </Typography>
            <Typography variant="h5" fontWeight={800}>
              Group Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create, update, manage members, and audit timeline for all organization groups.
            </Typography>
          </Stack>
          <NewGroupDialog users={users} onCreated={adminData?.refresh} />
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Paper
          variant="outlined"
          sx={{
            p: 1.25,
            borderRadius: 2,
            minWidth: 160,
            flex: 1,
            borderColor: "divider",
            backgroundColor: theme.palette.mode === "light" ? "#fcfdff" : "background.paper",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Total Groups
          </Typography>
          <Typography variant="h6" fontWeight={700}>
            {stats.totalGroups}
          </Typography>
        </Paper>
        <Paper
          variant="outlined"
          sx={{ p: 1.2, borderRadius: 2, minWidth: 160, flex: 1 }}
        >
          <Typography variant="caption" color="text.secondary">
            Active Groups
          </Typography>
          <Typography variant="h6" fontWeight={700}>
            {stats.activeGroups}
          </Typography>
        </Paper>
        <Paper
          variant="outlined"
          sx={{ p: 1.2, borderRadius: 2, minWidth: 160, flex: 1 }}
        >
          <Typography variant="caption" color="text.secondary">
            Airtime Groups
          </Typography>
          <Typography variant="h6" fontWeight={700}>
            {stats.airtimeGroups}
          </Typography>
        </Paper>
        <Paper
          variant="outlined"
          sx={{ p: 1.2, borderRadius: 2, minWidth: 160, flex: 1 }}
        >
          <Typography variant="caption" color="text.secondary">
            Active Members Count
          </Typography>
          <Typography variant="h6" fontWeight={700}>
            {stats.totalMembers}
          </Typography>
        </Paper>
      </Stack>

      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", md: "center" }}
          sx={{ mb: 1.5 }}
        >
          <TextField
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            label="Search group"
            placeholder="Search by id, name, description"
            sx={{ minWidth: { xs: "100%", md: 320 } }}
          />
          <TextField
            select
            size="small"
            value={statusFilter}
            label="Status"
            onChange={(event) => setStatusFilter(event.target.value)}
            sx={{ minWidth: 160 }}
          >
            {["all", "active", "inactive", "archived", "deleted"].map((status) => (
              <MenuItem key={status} value={status}>
                {status === "all"
                  ? "All"
                  : status.charAt(0).toUpperCase() + status.slice(1)}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
            }}
            sx={{ height: 40, fontWeight: 700, borderRadius: 1.5 }}
          >
            Reset
          </Button>
        </Stack>
        <Divider sx={{ mb: 1.4 }} />

        <Box sx={{ height: 520, width: "100%" }}>
          <DataGrid
            rows={filteredGroups}
            disableRowSelectionOnClick
            rowHeight={62}
            columns={[
              {
                field: "group_id",
                headerName: "ID",
                width: 90,
              },
              {
                field: "group_name",
                headerName: "Group",
                flex: 1.3,
                minWidth: 220,
                renderCell: ({ row }) => (
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar
                      src={row.group_image || undefined}
                      sx={{ width: 36, height: 36, bgcolor: "primary.main", fontSize: 14, fontWeight: 700 }}
                    >
                      {!row.group_image ? (row.group_name?.[0]?.toUpperCase() || "G") : null}
                    </Avatar>
                    <Stack spacing={0.15} sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} noWrap>
                        {row.group_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {row.group_description || "No description"}
                      </Typography>
                    </Stack>
                  </Stack>
                ),
              },
              {
                field: "is_airtime",
                headerName: "Airtime",
                width: 120,
                renderCell: ({ row }) => (
                  <Chip
                    size="small"
                    label={row.is_airtime ? "Enabled" : "Disabled"}
                    color={row.is_airtime ? "warning" : "default"}
                    variant="outlined"
                  />
                ),
              },
              {
                field: "members",
                headerName: "Members",
                width: 120,
                renderCell: ({ row }) => (
                  <Chip size="small" label={row.members} color="primary" variant="outlined" />
                ),
              },
              {
                field: "status",
                headerName: "Status",
                width: 130,
                renderCell: ({ row }) => (
                  <Chip
                    size="small"
                    label={prettyStatus(row.status)}
                    color={normalize(row.status) === "active" ? "success" : "default"}
                    variant="outlined"
                  />
                ),
              },
              {
                field: "actions",
                headerName: "Actions",
                width: 390,
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                renderCell: ({ row }) => (
                  <Stack direction="row" spacing={0.6}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<FiEdit2 size={13} />}
                      sx={{ borderRadius: 1.5, fontWeight: 700, textTransform: "none" }}
                      onClick={() => {
                        setSelectedGroup(row);
                        setEditOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      startIcon={<FiUsers size={13} />}
                      sx={{ borderRadius: 1.5, fontWeight: 700, textTransform: "none" }}
                      onClick={() => {
                        setSelectedGroup(row);
                        setMembersOpen(true);
                      }}
                    >
                      Members
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="info"
                      startIcon={<FiClock size={13} />}
                      sx={{ borderRadius: 1.5, fontWeight: 700, textTransform: "none" }}
                      onClick={() => {
                        setSelectedGroup(row);
                        setTimelineOpen(true);
                      }}
                    >
                      Timeline
                    </Button>
                  </Stack>
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
              "& .MuiDataGrid-columnHeaderTitle": {
                fontWeight: 700,
                fontSize: "0.78rem",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              },
              "& .MuiDataGrid-row:hover": {
                backgroundColor: theme.palette.mode === "light" ? "#f8fbff" : "action.hover",
              },
            }}
          />
        </Box>
      </Paper>

        <EditGroupDialog
          open={editOpen}
          group={selectedGroup}
          onClose={() => setEditOpen(false)}
          onSaved={adminData?.refresh}
        />
        <ManageGroupMembersDialog
          open={membersOpen}
          group={selectedGroup}
          users={users}
          onClose={() => setMembersOpen(false)}
          onSaved={adminData?.refresh}
        />
        <GroupTimelineDialog
          open={timelineOpen}
          group={selectedGroup}
          onClose={() => setTimelineOpen(false)}
        />
      </Stack>
    </Box>
  );
};

export default Group;
