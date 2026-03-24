import {
  Avatar,
  Box,
  ButtonBase,
  Dialog,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
  Chip,
  Checkbox,
  Slide,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { PiMagnifyingGlass, PiPaperPlaneRight, PiXBold } from "react-icons/pi";
import { getInitials } from "../../../utils/initials.js";
import { isGroupThread } from "../../../utils/threadUtils.js";
import CustomScrollbars from "../../Scrollbar.jsx";

const emptySelection = () => new Set();

const resolveDepartmentLabel = (thread) => {
  const candidates = [
    thread?.department,
    thread?.departmentLabel,
    thread?.department_name,
    thread?.departmentName,
    thread?.contact?.department,
    thread?.company,
  ];
  for (const value of candidates) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return "General";
};

const normaliseTimestamp = (value) => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
};

const resolveThreadActivity = (thread) => {
  if (!thread) return 0;
  const candidates = [
    thread.lastMessageAt,
    thread.lastActivityAt,
    thread.updatedAt,
    thread.createdAt,
    thread.time,
    thread.timestamp,
  ];
  let latest = 0;
  candidates.forEach((candidate) => {
    const parsed = normaliseTimestamp(candidate);
    if (parsed > latest) latest = parsed;
  });
  const lastMessageTs = normaliseTimestamp(thread?.lastMessage?.createdAt);
  latest = Math.max(latest, lastMessageTs);
  if (Array.isArray(thread?.threads)) {
    thread.threads.forEach((nested) => {
      latest = Math.max(latest, resolveThreadActivity(nested));
    });
  }
  return latest;
};

const deriveThreadLabel = (thread) =>
  thread?.label ||
  thread?.fullName ||
  thread?.username ||
  thread?.contact?.name ||
  "Unknown";

const ForwardMessageDialog = ({
  open,
  threads = [],
  pendingMessageCount = 1,
  onClose,
  onSubmit,
}) => {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => emptySelection());
  const [departmentFilter, setDepartmentFilter] = useState("__ALL__");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected(emptySelection());
      setDepartmentFilter("__ALL__");
    }
  }, [open]);

  const threadMap = useMemo(() => {
    const map = new Map();
    threads.forEach((thread) => {
      if (thread?.id) {
        map.set(thread.id, thread);
      }
    });
    return map;
  }, [threads]);

  const sortedThreads = useMemo(() => {
    return [...threads]
      .map((thread, index) => ({
        thread,
        index,
        isPinned: Boolean(thread?.isPinned),
        activity: resolveThreadActivity(thread),
      }))
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        if (a.activity !== b.activity) {
          return b.activity - a.activity;
        }
        return a.index - b.index;
      })
      .map((entry) => entry.thread);
  }, [threads]);

  const departmentOptions = useMemo(() => {
    const set = new Set();
    sortedThreads.forEach((thread) => {
      set.add(resolveDepartmentLabel(thread));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sortedThreads]);

  const filteredThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sortedThreads.filter((thread) => {
      const matchesDepartment =
        departmentFilter === "__ALL__" ||
        resolveDepartmentLabel(thread) === departmentFilter;
      if (!matchesDepartment) return false;
      const haystack = [
        deriveThreadLabel(thread),
        thread?.username,
        thread?.company,
        thread?.department,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return !normalizedQuery || haystack.includes(normalizedQuery);
    });
  }, [sortedThreads, query, departmentFilter]);

  const selectedCount = selected.size;
  const { userCount, groupCount } = useMemo(() => {
    let users = 0;
    let groups = 0;
    selected.forEach((threadId) => {
      const target = threadMap.get(threadId);
      if (!target) return;
      if (isGroupThread(target)) {
        groups += 1;
      } else {
        users += 1;
      }
    });
    return { userCount: users, groupCount: groups };
  }, [selected, threadMap]);

  const handleToggle = (threadId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (!selected.size) return;
    onSubmit?.(Array.from(selected));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      TransitionComponent={Slide}
      TransitionProps={{
        direction: "up",
        mountOnEnter: true,
        unmountOnExit: true,
      }}
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: "hidden",
          backgroundColor: theme.palette.background.paper,
        },
      }}
    >
      <Box sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Box sx={{ flexGrow: 1, pr: 2 }}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              justifyContent="start"
            >
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Forward To
              </Typography>
              {(userCount != 0 || groupCount != 0) && (
                <Chip
                  label={`${userCount} users · ${groupCount} groups`}
                  size="small"
                  sx={{ borderRadius: 999 }}
                />
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Forwarding {pendingMessageCount}{" "}
              {pendingMessageCount === 1 ? "message" : "messages"}
            </Typography>
          </Box>
          <Stack spacing={1} alignItems="flex-end">
            <IconButton onClick={onClose} size="small">
              <PiXBold size={16} />
            </IconButton>
            <TextField
              select
              size="small"
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              sx={{ minWidth: 200 }}
              SelectProps={{
                MenuProps: {
                  PaperProps: {
                    sx: {
                      maxHeight: 280,
                    },
                  },
                  MenuListProps: {
                    sx: {
                      maxHeight: 280,
                      overflowY: "auto",
                    },
                  },
                },
              }}
            >
              <MenuItem value="__ALL__">All departments</MenuItem>
              {departmentOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Stack>

        <TextField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search users or groups"
          fullWidth
          sx={{
            mb: 1,
            "& .MuiOutlinedInput-root": {
              borderRadius: 0.5,
              "& .MuiOutlinedInput-input": {
                paddingTop: 1.5,
                paddingBottom: 1.5,
              },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PiMagnifyingGlass size={18} />
              </InputAdornment>
            ),
            endAdornment: query ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setQuery("")}
                  edge="end"
                >
                  <PiXBold size={14} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />

        <Box
          sx={{
            border: `1px solid ${theme.palette.divider}`,
            maxHeight: 360,
            overflow: "hidden",
          }}
        >
          <CustomScrollbars
            autoHeight
            autoHeightMax={360}
            autoHeightMin={360}
            style={{ maxHeight: 360 }}
          >
            <Box sx={{ pr: 0.5 }}>
              {filteredThreads.length === 0 ? (
                <Stack
                  spacing={1}
                  alignItems="center"
                  justifyContent="center"
                  sx={{ py: 6 }}
                >
                  <Typography variant="subtitle2">
                    No conversations found
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Try searching for another teammate or group.
                  </Typography>
                </Stack>
              ) : (
                filteredThreads.map((thread) => {
                  const threadId = thread?.id;
                  if (!threadId) return null;
                  const label = deriveThreadLabel(thread);
                  const subtitle =
                    thread?.status ||
                    thread?.department ||
                    thread?.company ||
                    "";
                  const avatarSource =
                    thread?.profilePicture ||
                    thread?.avatar ||
                    thread?.contact?.avatar ||
                    null;
                  const initials = getInitials(label || "Member");
                  const checked = selected.has(threadId);
                  const groupTag = isGroupThread(thread);
                  return (
                    <ButtonBase
                      key={threadId}
                      onClick={() => handleToggle(threadId)}
                      sx={{
                        width: "100%",
                        px: 1.5,
                        py: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        "&:last-of-type": {
                          borderBottom: "none",
                        },
                        "&:hover": {
                          backgroundColor: theme.palette.action.hover,
                        },
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box sx={{ position: "relative" }}>
                          <Avatar
                            src={avatarSource || undefined}
                            sx={{
                              width: 40,
                              height: 40,
                              bgcolor: avatarSource
                                ? "transparent"
                                : theme.palette.primary.light,
                              color: avatarSource
                                ? "inherit"
                                : theme.palette.primary.contrastText,
                              fontSize: 14,
                            }}
                          >
                            {!avatarSource ? initials : null}
                          </Avatar>
                          {(thread?.isGlobalMember || thread?.isGlobal || thread?.is_global) && (
                            <Box sx={{ position: "absolute", bottom: -1, right: 1, width: 10, height: 10, borderRadius: "50%", bgcolor: "#FFB020", border: `2px solid ${theme.palette.background.paper}` }} />
                          )}
                        </Box>
                        <Box sx={{ textAlign: "left" }}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, lineHeight: 1.2 }}
                          >
                            {label}
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={0.75}
                            alignItems="center"
                          >
                            {groupTag ? (
                              <Chip
                                size="small"
                                label="Group"
                                sx={{
                                  height: 20,
                                  fontSize: 10,
                                  borderRadius: 999,
                                }}
                              />
                            ) : null}
                            {subtitle ? (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {subtitle}
                              </Typography>
                            ) : null}
                          </Stack>
                        </Box>
                      </Stack>
                      <Checkbox
                        checked={checked}
                        onChange={(event) => {
                          event.stopPropagation();
                          handleToggle(threadId);
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                        sx={{ mr: 0.5 }}
                      />
                    </ButtonBase>
                  );
                })
              )}
            </Box>
          </CustomScrollbars>
        </Box>

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mt: 1.5 }}
        >
          {/* select all at once checkbox */}
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Checkbox
              size="small"
              checked={
                filteredThreads.length > 0 &&
                filteredThreads.every((thread) => selected.has(thread?.id))
              }
              indeterminate={
                filteredThreads.some((thread) => selected.has(thread?.id)) &&
                !filteredThreads.every((thread) => selected.has(thread?.id))
              }
              onChange={(event) => {
                const { checked } = event.target;
                setSelected((prev) => {
                  const next = new Set(prev);
                  filteredThreads.forEach((thread) => {
                    const threadId = thread?.id;
                    if (!threadId) return;
                    if (checked) {
                      next.add(threadId);
                    } else {
                      next.delete(threadId);
                    }
                  });
                  return next;
                });
              }}
            />
            <Typography variant="caption" color="text.secondary">
              Select all
            </Typography>
          </Stack>

          <Tooltip
            title={
              selectedCount ? "Forward messages" : "Select at least one chat"
            }
          >
            <span>
              <IconButton
                onClick={handleSubmit}
                disabled={!selectedCount}
                sx={{
                  display: "flex",
                  backgroundColor: selectedCount
                    ? theme.palette.primary.main
                    : theme.palette.action.disabledBackground,
                  color: selectedCount
                    ? theme.palette.primary.contrastText
                    : theme.palette.text.disabled,
                  "&:hover": selectedCount
                    ? { backgroundColor: theme.palette.primary.dark }
                    : undefined,
                }}
              >
                <PiPaperPlaneRight size={18} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>
    </Dialog>
  );
};

export default ForwardMessageDialog;
