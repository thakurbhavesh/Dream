import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { API_BASE_URL } from "../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../utils/authApi";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const prettyType = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const eventChipColor = (eventType) => {
  const type = String(eventType || "").toLowerCase();
  if (type.includes("created")) return "success";
  if (type.includes("removed") || type.includes("deleted")) return "error";
  if (type.includes("updated") || type.includes("patched")) return "warning";
  return "primary";
};

const statusChipColor = (status) => {
  const value = String(status || "").toLowerCase();
  if (value === "visible" || value === "active") return "success";
  if (value === "hidden" || value === "inactive") return "default";
  return "primary";
};

const resolveDescription = (row, groupName) => {
  const raw = String(row?.event_description || "").trim();
  if (!raw) return "-";

  const normalized = String(row?.event_type || "").trim().toLowerCase();
  const resolvedUser = String(row?.target || "").trim();
  const resolvedGroup = String(groupName || "").trim();

  if (["member_added", "member_updated", "member_patched", "member_removed"].includes(normalized)) {
    if (resolvedUser && resolvedGroup) {
      if (normalized === "member_added") {
        return `${resolvedUser} added to group "${resolvedGroup}"`;
      }
      if (normalized === "member_removed") {
        return `${resolvedUser} removed from group "${resolvedGroup}"`;
      }
      return `${resolvedUser} updated in group "${resolvedGroup}"`;
    }
  }

  const legacyMemberActionMatch = raw.match(/^user\s+\d+\s+(added to|removed from|updated in)\s+group\s+\d+$/i);
  if (legacyMemberActionMatch && resolvedUser && resolvedGroup) {
    const action = legacyMemberActionMatch[1].toLowerCase();
    return `${resolvedUser} ${action} group "${resolvedGroup}"`;
  }

  return raw;
};

const GroupTimelineDialog = ({ open, group, onClose }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const latestEvent = rows[0]?.event_at ? formatDateTime(rows[0].event_at) : "-";

  useEffect(() => {
    if (!open) return;
    const groupId = Number(group?.group_id || group?.id);
    if (!Number.isFinite(groupId) || groupId <= 0) {
      setRows([]);
      setError("Invalid group selected");
      return;
    }

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const { response, payload } = await fetchWithAuth(
          `${API_BASE_URL}/group-timeline?group_id=${groupId}&limit=200&offset=0`,
          { method: "GET" },
        );
        if (!response.ok || payload?.status === "error") {
          throw new Error(payload?.message || "Failed to fetch timeline");
        }
        const timelineRows = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
        setRows(
          timelineRows.map((item, index) => ({
            id: Number(item?.timeline_id) || `timeline-${index + 1}`,
            event_type: item?.event_type || "",
            event_description: item?.event_description || "",
            actor: item?.actor_name || item?.actor_email || "-",
            target: item?.target_name || item?.target_email || "-",
            status: item?.status || "-",
            event_at: item?.event_at || item?.created_at || null,
          })),
        );
      } catch (requestError) {
        setError(requestError?.message || "Unable to fetch timeline");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [group, open]);

  return (
    <Dialog
      open={Boolean(open)}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: {
          width: "min(calc(100vw - 32px), 1440px)",
          maxWidth: "1440px",
        },
      }}
    >
      <DialogTitle sx={{ pb: 0.5 }}>
        <Stack spacing={0.35}>
          <Typography variant="h5" fontWeight={800}>
            Group Timeline
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Audit trail for group actions, members, and updates.
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            sx={{
              p: 1.2,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              backgroundColor: theme.palette.mode === "light" ? "#f8fbff" : "background.paper",
            }}
          >
            <Chip
              variant="outlined"
              color="primary"
              label={`Total Events: ${rows.length}`}
              sx={{ fontWeight: 700, borderRadius: 1.5 }}
            />
            <Chip
              variant="outlined"
              color="info"
              label={`Latest Activity: ${latestEvent}`}
              sx={{ fontWeight: 700, borderRadius: 1.5 }}
            />
            <Chip
              variant="outlined"
              color="secondary"
              label={`Group: ${group?.group_name || group?.name || "-"}`}
              sx={{ fontWeight: 700, borderRadius: 1.5 }}
            />
          </Stack>
          <Box sx={{ height: 460, width: "100%" }}>
            <DataGrid
              rows={rows}
              loading={loading}
              disableRowSelectionOnClick
              rowHeight={54}
              columns={[
                {
                  field: "event_type",
                  headerName: "Event",
                  width: 170,
                  renderCell: ({ row }) => (
                    <Chip
                      size="small"
                      label={prettyType(row.event_type)}
                      variant="outlined"
                      color={eventChipColor(row.event_type)}
                      sx={{ fontWeight: 700, borderRadius: 1.5 }}
                    />
                  ),
                },
                {
                  field: "event_description",
                  headerName: "Description",
                  flex: 2,
                  minWidth: 320,
                  renderCell: ({ row }) => (
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        width: "100%",
                        fontWeight: 500,
                      }}
                    >
                      {resolveDescription(row, group?.group_name || group?.name)}
                    </Typography>
                  ),
                },
                {
                  field: "actor",
                  headerName: "Actor",
                  flex: 0.9,
                  minWidth: 150,
                },
                {
                  field: "target",
                  headerName: "Target",
                  flex: 0.9,
                  minWidth: 150,
                },
                {
                  field: "status",
                  headerName: "Status",
                  width: 120,
                  renderCell: ({ row }) => (
                    <Chip
                      size="small"
                      label={row.status}
                      variant="outlined"
                      color={statusChipColor(row.status)}
                      sx={{ textTransform: "capitalize", fontWeight: 700, borderRadius: 1.5 }}
                    />
                  ),
                },
                {
                  field: "event_at",
                  headerName: "Time",
                  width: 170,
                  renderCell: ({ row }) => (
                    <Typography variant="caption" fontWeight={700} color="text.secondary">
                      {formatDateTime(row.event_at)}
                    </Typography>
                  ),
                },
              ]}
              initialState={{
                sorting: {
                  sortModel: [{ field: "event_at", sort: "desc" }],
                },
                pagination: {
                  paginationModel: { pageSize: 25, page: 0 },
                },
              }}
              pageSizeOptions={[25, 50, 100]}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                backgroundColor: "background.paper",
                "& .MuiDataGrid-cell": {
                  py: 0.8,
                  borderColor: "divider",
                },
                "& .MuiDataGrid-columnHeaders": {
                  backgroundColor: theme.palette.mode === "light" ? "#f1f6ff" : "action.hover",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                },
                "& .MuiDataGrid-columnHeaderTitle": {
                  fontWeight: 700,
                  fontSize: "0.76rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                },
                "& .MuiDataGrid-row:nth-of-type(even)": {
                  backgroundColor: theme.palette.mode === "light" ? "#fcfdff" : "transparent",
                },
                "& .MuiDataGrid-row:hover": {
                  backgroundColor: theme.palette.mode === "light" ? "#eef5ff" : "action.hover",
                },
                "& .MuiDataGrid-overlayWrapperInner": {
                  minHeight: 150,
                },
                "& .MuiDataGrid-footerContainer": {
                  borderTop: "1px solid",
                  borderColor: "divider",
                },
              }}
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button variant="outlined" onClick={onClose} sx={{ borderRadius: 1.5, fontWeight: 700 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GroupTimelineDialog;
