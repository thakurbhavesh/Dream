import PropTypes from "prop-types";
import { useMemo, useState } from "react";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { LuMonitorSmartphone } from "react-icons/lu";

const formatTimestamp = (value) => {
  if (!value) return "Unknown";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const formatDataSize = (sizeInMb = 0) => {
  const safeSize = Number(sizeInMb) || 0;
  if (safeSize >= 1024) {
    return `${(safeSize / 1024).toFixed(2)} GB`;
  }
  return `${safeSize.toFixed(2)} MB`;
};

const formatCount = (count = 0) =>
  new Intl.NumberFormat(undefined).format(Number(count) || 0);

const normalizeUsage = (usage = {}) => {
  const toMetric = (target = {}) => ({
    count: Number(target.count ?? target.total ?? 0) || 0,
    sizeMB: Number(target.sizeMB ?? target.size ?? 0) || 0,
  });

  const metrics = {
    messages: toMetric(
      usage.messages ?? {
        count: usage.messagesCount,
        sizeMB: usage.messagesSizeMB ?? usage.messagesSize,
      }
    ),
    media: toMetric(
      usage.media ?? {
        count: usage.mediaCount ?? usage.imagesVideosCount,
        sizeMB: usage.mediaSizeMB ?? usage.imagesVideosSize,
      }
    ),
    files: toMetric(
      usage.files ?? {
        count: usage.fileCount,
        sizeMB: usage.filesSizeMB ?? usage.filesSize,
      }
    ),
  };

  const totalSize =
    Number(usage.totalSizeMB ?? usage.total ?? 0) ||
    metrics.messages.sizeMB + metrics.media.sizeMB + metrics.files.sizeMB;

  return { ...metrics, totalSizeMB: totalSize };
};

const ActivityTab = ({ devices, timeline, onLogoutAll, onLogoutDevice, onRevokeTrust }) => {
  const [showUsageSummary, setShowUsageSummary] = useState(false);

  const devicesWithUsage = useMemo(
    () =>
      devices
        .filter((device) => String(device?.status || "").toLowerCase() !== "logged_out")
        .map((device) => ({
          ...device,
          usage: normalizeUsage(device.usage),
        })),
    [devices]
  );

  const totalUsage = useMemo(() => {
    return devicesWithUsage.reduce(
      (acc, device) => {
        const usage = normalizeUsage(device.usage);
        acc.messages.count += usage.messages.count;
        acc.messages.sizeMB += usage.messages.sizeMB;
        acc.media.count += usage.media.count;
        acc.media.sizeMB += usage.media.sizeMB;
        acc.files.count += usage.files.count;
        acc.files.sizeMB += usage.files.sizeMB;
        acc.totalSizeMB += usage.totalSizeMB;
        return acc;
      },
      {
        messages: { count: 0, sizeMB: 0 },
        media: { count: 0, sizeMB: 0 },
        files: { count: 0, sizeMB: 0 },
        totalSizeMB: 0,
      }
    );
  }, [devicesWithUsage]);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Active Devices
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage signed-in browsers and desktop apps.
          </Typography>
        </Box>

        <Button
          color="error"
          variant="contained"
          onClick={onLogoutAll}
        >
          Logout from all devices
        </Button>
      </Stack>

      <Stack direction="row" justifyContent="flex-end">
        <Button
          size="small"
          color="primary"
          variant="outlined"
          onClick={() => setShowUsageSummary((prev) => !prev)}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          {showUsageSummary ? "Hide Usage" : "Usage (All Devices)"}
        </Button>
      </Stack>

      {showUsageSummary ? (
        <Paper
          elevation={0}
          sx={{
            borderRadius: 1,
            border: (t) => `1px solid ${t.palette.divider}`,
            p: 3,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Usage (All Devices)
          </Typography>
          <Stack spacing={1.5}>
            {[
              { label: "Messages", data: totalUsage.messages },
              { label: "Images & Videos", data: totalUsage.media },
              { label: "Files", data: totalUsage.files },
            ].map(({ label, data }) => (
              <Stack key={label} direction="row" justifyContent="space-between" alignItems="center">
                <Typography color="text.secondary">{label}</Typography>
                <Box>
                  <Typography component="span">{formatCount(data.count)}</Typography>
                  <Typography component="span" sx={{ color: "warning.main", ml: 1 }}>
                    / {formatDataSize(data.sizeMB)}
                  </Typography>
                </Box>
              </Stack>
            ))}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 1 }}>
              <Typography color="text.secondary" sx={{ fontWeight: 600 }}>
                Total File Size
              </Typography>
              <Typography sx={{ color: "warning.main", fontWeight: 700 }}>
                {formatDataSize(totalUsage.totalSizeMB)}
              </Typography>
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      {devicesWithUsage.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            borderRadius: 1,
            border: (t) => `1px dashed ${t.palette.divider}`,
            p: 4,
            textAlign: "center",
            color: "text.secondary",
          }}
        >
          No active sessions yet. Sign in from another device to see them listed here.
        </Paper>
      ) : (
        devicesWithUsage.map((device) => {
          return (
            <Paper
              key={device.id}
              elevation={0}
              sx={{
                borderRadius: 1,
                border: (t) => `1px solid ${t.palette.divider}`,
                p: 3,
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: "16px",
                      bgcolor: "primary.lighter",
                      color: "primary.main",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                    }}
                  >
                    <LuMonitorSmartphone />
                  </Box>
                  <Stack spacing={0.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography fontWeight={600}>{device.name}</Typography>
                      {device.isTrusted ? (
                        <Typography variant="caption" color="success.main" sx={{ fontWeight: 700 }}>
                          TRUSTED
                        </Typography>
                      ) : null}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {device.platform} &bull; {device.location}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Last active: {formatTimestamp(device.lastActive)}
                    </Typography>
                  </Stack>
                </Stack>

                <Stack
                  spacing={1}
                  direction={{ xs: "row", sm: "column" }}
                  alignItems={{ xs: "flex-start", sm: "flex-end" }}
                >
                  {device.isTrusted ? (
                    <Button
                      size="small"
                      variant="text"
                      color="error"
                      sx={{ fontWeight: 600 }}
                      onClick={() => onRevokeTrust(device.id)}
                    >
                      Revoke trust
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => onLogoutDevice(device.id)}
                  >
                    Logout
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          );
        })
      )}

      <Paper
        elevation={0}
        sx={{
          borderRadius: 1,
          border: (t) => `1px solid ${t.palette.divider}`,
          p: 3,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Login Workflow Timeline
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Other signed-in devices and their login time.
        </Typography>

        {timeline.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No auth activity found yet.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {timeline.map((item) => (
              <Box
                key={item.id}
                sx={{
                  border: (t) => `1px solid ${t.palette.divider}`,
                  borderRadius: 1,
                  px: 1.5,
                  py: 1,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {item.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.timeLabel}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
};

ActivityTab.propTypes = {
  devices: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      platform: PropTypes.string,
      location: PropTypes.string,
      lastActive: PropTypes.string,
      usage: PropTypes.shape({
        messages: PropTypes.shape({
          count: PropTypes.number,
          sizeMB: PropTypes.number,
        }),
        media: PropTypes.shape({
          count: PropTypes.number,
          sizeMB: PropTypes.number,
        }),
        files: PropTypes.shape({
          count: PropTypes.number,
          sizeMB: PropTypes.number,
        }),
        totalSizeMB: PropTypes.number,
      }),
      isTrusted: PropTypes.bool,
    })
  ).isRequired,
  timeline: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      title: PropTypes.string,
      timeLabel: PropTypes.string,
      ip: PropTypes.string,
      status: PropTypes.string,
    })
  ),
  onLogoutAll: PropTypes.func,
  onLogoutDevice: PropTypes.func,
  onRevokeTrust: PropTypes.func,
};

ActivityTab.defaultProps = {
  timeline: [],
  onLogoutAll: () => {},
  onLogoutDevice: () => {},
  onRevokeTrust: () => {},
};

export default ActivityTab;
