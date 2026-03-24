import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PiArrowClockwise,
  PiArrowSquareOut,
  PiDownloadSimple,
  PiFolderSimple,
  PiPauseFill,
  PiPlayFill,
  PiXBold,
} from "react-icons/pi";
import {
  Box,
  Fade,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Typography,
  Tooltip,
} from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import { useTheme } from "@mui/material/styles";
import { resolveFileExtension } from "./conversation/files/filePreviewUtils.js";

const STATE_PRIORITY = {
  progress: 0,
  started: 1,
  paused: 2,
  done: 3,
  error: 4,
  cancelled: 5,
};

const HISTORY_STORAGE_KEY = "chatx.downloadHistory";

const STATE_LABELS = {
  started: "Starting",
  progress: "Downloading",
  paused: "Paused",
  done: "Done",
  error: "Failed",
  cancelled: "Cancelled",
};

const formatBytes = (value) => {
  if (!value || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(value) / Math.log(1024))
  );
  const formatted = value / 1024 ** index;
  const precision = formatted >= 10 || index === 0 ? 0 : 1;
  return `${formatted.toFixed(precision)} ${units[index]}`;
};

const formatProgressLabel = (entry) => {
  if (!entry) return "No downloads";
  const received = formatBytes(entry.received || 0);
  if (entry.total) {
    return `${received} / ${formatBytes(entry.total)}`;
  }
  if (entry.state === "done" && entry.total === null) {
    return received;
  }
  return entry.received ? `${received} downloaded` : "Size unknown";
};

const formatStateLabel = (entry) => {
  if (!entry) return "Idle";
  const label = STATE_LABELS[entry.state] || entry.state;
  return entry.message && entry.state === "error"
    ? `${label}: ${entry.message}`
    : label;
};

const clampPercent = (value) => {
  if (typeof value !== "number") return null;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const useOutsideClick = (ref, handler, active = true) => {
  useEffect(() => {
    if (!active) return undefined;
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler();
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, handler, active]);
};

const addTimer = (timers, id, fn, delay) => {
  if (!id) return;
  if (timers.current[id]) clearTimeout(timers.current[id]);
  timers.current[id] = setTimeout(fn, delay);
};

const loadHistoryFromStorage = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(Boolean)
      .map((entry) => ({
        ...entry,
        state: entry.state || "done",
        completedAt:
          entry.completedAt || entry.storedAt || entry.startedAt || Date.now(),
        startedAt: entry.startedAt || entry.completedAt || Date.now(),
      }))
      .slice(0, 5);
  } catch {
    return [];
  }
};

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  const seconds = Math.max(0, Math.floor(diff / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const getFileTypeLabel = (entry) => {
  if (!entry) return null;
  const extension = resolveFileExtension({
    fileName: entry.name,
    mimeType: entry.mime,
    type: entry.mime,
  });
  return (extension || "file").toUpperCase();
};

const buildStateAccent = (theme, state) => {
  switch (state) {
    case "progress":
    case "started":
      return theme.palette.info.light;
    case "paused":
      return theme.palette.warning.light;
    case "done":
      return theme.palette.success.light;
    case "error":
      return theme.palette.error.light;
    case "cancelled":
      return theme.palette.text.disabled;
    default:
      return theme.palette.grey[100];
  }
};

export default function DownloadToasts() {
  const [items, setItems] = useState({});
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState(() => loadHistoryFromStorage());
  const timers = useRef({});
  const containerRef = useRef(null);
  const theme = useTheme();
  const hasBridge =
    typeof window !== "undefined" && Boolean(window.downloads?.on);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let cancelled = false;
    const persist = async () => {
      if (cancelled) return;
      if (navigator?.storage?.persisted) {
        try {
          const persisted = await navigator.storage.persisted();
          if (!persisted && navigator.storage?.persist) {
            await navigator.storage.persist();
          }
        } catch {
          // ignore
        }
      }
      if (cancelled) return;
      try {
        window.localStorage.setItem(
          HISTORY_STORAGE_KEY,
          JSON.stringify(history.slice(0, 5))
        );
      } catch {
        // ignore persistence errors
      }
    };
    const scheduleHandle =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(persist, { timeout: 1500 })
        : setTimeout(persist, 150);
    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(scheduleHandle);
      } else {
        clearTimeout(scheduleHandle);
      }
    };
  }, [history]);

  const iconButtonSx = useCallback(
    (variant) => ({
      width: 30,
      height: 30,
      borderRadius: 1,
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      color:
        variant === "danger"
          ? theme.palette.error.light
          : theme.palette.text.secondary,
      "&:hover": {
        backgroundColor: "rgba(255, 255, 255, 0.18)",
      },
    }),
    [theme]
  );

  const entryButtonSx = useCallback(
    (variant) => ({
      width: 30,
      height: 30,
      borderRadius: 1.5,
      color:
        variant === "danger"
          ? theme.palette.error.light
          : theme.palette.text.secondary,
      "&:hover": {
        backgroundColor: theme.palette.action.hover,
      },
    }),
    [theme]
  );

  useOutsideClick(
    containerRef,
    useCallback(() => setOpen(false), []),
    open
  );

  const removeItem = useCallback((id) => {
    setItems((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const upsertItem = useCallback((id, patch) => {
    if (!id) return;
    setItems((prev) => ({
      ...prev,
      [id]: {
        id,
        ...prev[id],
        ...patch,
        startedAt: prev[id]?.startedAt || Date.now(),
      },
    }));
  }, []);

  const scheduleCleanup = useCallback(
    (id, delay = 12000) => {
      if (!id) return;
      addTimer(timers, id, () => removeItem(id), delay);
    },
    [removeItem]
  );

  const persistHistoryEntry = useCallback((entry) => {
    if (!entry?.id) return;
    setHistory((prev) => {
      const filtered = prev.filter((item) => item?.id !== entry.id);
      const completedAt = entry.completedAt || Date.now();
      return [
        { ...entry, storedAt: Date.now(), completedAt },
        ...filtered,
      ].slice(0, 5);
    });
  }, []);

  useEffect(() => {
    if (!hasBridge) return undefined;

    const handleStarted = (payload = {}) => {
      const { id, total, name, mime, sourceUrl } = payload;
      upsertItem(id, {
        state: "started",
        percent: typeof total === "number" ? 0 : null,
        total: typeof total === "number" ? total : null,
        received: 0,
        name,
        mime,
        sourceUrl,
      });
    };

    const handleProgress = (payload = {}) => {
      const { id, percent, total, received, name, mime, canResume } = payload;
      upsertItem(id, {
        state: payload.state === "paused" ? "paused" : "progress",
        percent: clampPercent(percent),
        total: typeof total === "number" ? total : null,
        received: typeof received === "number" ? received : null,
        name,
        mime,
        canResume: Boolean(canResume),
      });
    };

    const handlePaused = (payload = {}) => {
      const { id } = payload;
      upsertItem(id, { state: "paused" });
    };

    const handleResumed = (payload = {}) => {
      const { id } = payload;
      upsertItem(id, { state: "progress" });
    };

    const handleDone = (payload = {}) => {
      const { id, path, name, mime, total } = payload;
      const completedAt = Date.now();
      upsertItem(id, {
        state: "done",
        percent: 100,
        path,
        name,
        mime,
        total: typeof total === "number" ? total : null,
        completedAt,
        received: typeof total === "number" ? total : null,
      });
      persistHistoryEntry({
        id,
        state: "done",
        percent: 100,
        path,
        name,
        mime,
        total: typeof total === "number" ? total : null,
        received: typeof total === "number" ? total : null,
        startedAt: Date.now(),
        completedAt,
        canResume: false,
        sourceUrl: payload.sourceUrl ?? null,
      });
      scheduleCleanup(id, 15000);
    };

    const handleError = (payload = {}) => {
      const { id, message } = payload;
      upsertItem(id, { state: "error", message });
      scheduleCleanup(id, 15000);
    };

    const handleCancelled = ({ id }) => {
      upsertItem(id, { state: "cancelled" });
      scheduleCleanup(id, 8000);
    };

    const subscriptions = [
      window.downloads.on("started", handleStarted),
      window.downloads.on("progress", handleProgress),
      window.downloads.on("paused", handlePaused),
      window.downloads.on("resumed", handleResumed),
      window.downloads.on("done", handleDone),
      window.downloads.on("error", handleError),
      window.downloads.on("cancelled", handleCancelled),
    ].filter(Boolean);

    if (typeof window.downloads.snapshot === "function") {
      window.downloads
        .snapshot()
        .then((snapshot) => {
          if (!Array.isArray(snapshot)) return;
          setItems((prev) => {
            const next = { ...prev };
            snapshot.forEach((entry) => {
              if (!entry?.id) return;
              next[entry.id] = {
                ...entry,
                startedAt: entry.startedAt || Date.now(),
              };
            });
            return next;
          });
        })
        .catch(() => {});
    }

    return () => {
      subscriptions.forEach((fn) => fn && fn());
      Object.values(timers.current).forEach(clearTimeout);
      timers.current = {};
    };
  }, [hasBridge, persistHistoryEntry, scheduleCleanup, upsertItem]);

  const activeEntries = useMemo(() => {
    return Object.values(items)
      .map((entry) => ({ ...entry }))
      .sort((a, b) => {
        const stateDiff =
          (STATE_PRIORITY[a.state] ?? 99) - (STATE_PRIORITY[b.state] ?? 99);
        if (stateDiff !== 0) return stateDiff;
        return (b.startedAt ?? 0) - (a.startedAt ?? 0);
      });
  }, [items]);

  const displayEntries = useMemo(() => {
    const activeIds = new Set(activeEntries.map((entry) => entry.id));
    const trimmedHistory = history
      .filter(Boolean)
      .map((entry) => ({
        ...entry,
        state: entry.state || "done",
        completedAt:
          entry.completedAt || entry.storedAt || entry.startedAt || Date.now(),
      }))
      .filter((entry) => !activeIds.has(entry.id));
    return [...activeEntries, ...trimmedHistory];
  }, [activeEntries, history]);

  useEffect(() => {
    if (!displayEntries.length) {
      setOpen(false);
    }
  }, [displayEntries.length]);

  const summary = displayEntries[0];
  const summaryPercent =
    summary?.state === "done"
      ? 100
      : (clampPercent(summary?.percent ?? null) ?? (summary ? 0 : null));
  const summaryName = summary?.name || "Downloads";
  const indicatorTitle = summary ? `${summaryName}` : "No downloads";
  const hasActiveDownload = activeEntries.some((entry) =>
    ["started", "progress", "paused", "done"].includes(entry.state)
  );

  const handleToggle = useCallback(() => {
    if (!displayEntries.length) return;
    setOpen((prev) => !prev);
  }, [displayEntries.length]);

  const handlePause = useCallback((id) => {
    window.downloads?.pause?.(id);
  }, []);

  const handleResume = useCallback((id) => {
    window.downloads?.resume?.(id);
  }, []);

  const handleCancel = useCallback((id) => {
    window.downloads?.cancel?.(id);
  }, []);

  const handleOpen = useCallback((path) => {
    if (path) {
      window.downloads?.openFile?.(path);
    }
  }, []);

  const handleReveal = useCallback((path) => {
    if (path) {
      window.downloads?.showInFolder?.(path);
    }
  }, []);

  const handleRetry = useCallback((url) => {
    if (url) {
      window.downloads?.openSource?.(url);
    }
  }, []);

  const handleDismissEntry = useCallback((entry) => {
    if (!entry?.id) return;
    setItems((prev) => {
      if (!prev[entry.id]) return prev;
      const next = { ...prev };
      delete next[entry.id];
      return next;
    });
    setHistory((prev) => prev.filter((item) => item?.id !== entry.id));
  }, []);

  if (!hasBridge) {
    return null;
  }
  if (!displayEntries.length) {
    return null;
  }
  if (!displayEntries.length) {
    return null;
  }

  const renderRowActions = (entry) => {
    if (entry.state === "progress" || entry.state === "started") {
      return (
        <>
          {entry.canResume && (
            <IconButton
              size="small"
              aria-label="Pause download"
              sx={entryButtonSx()}
              onClick={(event) => {
                event.stopPropagation();
                handlePause(entry.id);
              }}
            >
              <PiPauseFill size={16} />
            </IconButton>
          )}
          <IconButton
            size="small"
            aria-label="Cancel download"
            sx={entryButtonSx("danger")}
            onClick={(event) => {
              event.stopPropagation();
              handleCancel(entry.id);
            }}
          >
            <PiXBold size={16} />
          </IconButton>
        </>
      );
    }
    if (entry.state === "paused") {
      return (
        <>
          <IconButton
            size="small"
            aria-label="Resume download"
            sx={entryButtonSx()}
            onClick={(event) => {
              event.stopPropagation();
              handleResume(entry.id);
            }}
          >
            <PiPlayFill size={16} />
          </IconButton>
          <IconButton
            size="small"
            aria-label="Cancel download"
            sx={entryButtonSx("danger")}
            onClick={(event) => {
              event.stopPropagation();
              handleCancel(entry.id);
            }}
          >
            <PiXBold size={16} />
          </IconButton>
        </>
      );
    }
    if (entry.state === "done") {
      return (
        <>
          <IconButton
            size="small"
            aria-label="Open file"
            sx={entryButtonSx()}
            onClick={(event) => {
              event.stopPropagation();
              handleOpen(entry.path);
            }}
          >
            <PiArrowSquareOut size={16} />
          </IconButton>
          <IconButton
            size="small"
            aria-label="Show in folder"
            sx={entryButtonSx()}
            onClick={(event) => {
              event.stopPropagation();
              handleReveal(entry.path);
            }}
          >
            <PiFolderSimple size={16} />
          </IconButton>
        </>
      );
    }
    if (entry.state === "error") {
      return (
        <IconButton
          size="small"
          aria-label="Retry download"
          sx={entryButtonSx()}
          onClick={(event) => {
            event.stopPropagation();
            handleRetry(entry.sourceUrl);
          }}
        >
          <PiArrowClockwise size={16} />
        </IconButton>
      );
    }
    return null;
  };

  const summaryAccent = buildStateAccent(theme, summary?.state);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "relative",
        display: "inline-flex",
        fontFamily: "inherit",
        color: theme.palette.common.white,
        cursor: "pointer",
      }}
    >
      <Tooltip title={indicatorTitle} placement="bottom" arrow>
        <span>
          <IconButton
            onClick={handleToggle}
            disabled={!displayEntries.length}
            aria-label="Show downloads"
            sx={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              boxShadow: "0 2px 8px rgba(5, 6, 15, 0.3)",
              border: "1px solid rgba(255,255,255,0.5)",
              "&:hover": { backgroundColor: "rgba(18, 21, 38, 0.95)" },
              "&.Mui-disabled": { opacity: 1 },
              padding: "4px",
            }}
          >
            <Box
              aria-hidden="true"
              sx={{ position: "relative", width: 26, height: 26 }}
            >
              {hasActiveDownload ?
              <CircularProgress
                variant={
                  summaryPercent != null ? "determinate" : "indeterminate"
                }
                value={summaryPercent ?? undefined}
                size={26}
                thickness={4}
                sx={{
                  position: "absolute",
                  inset: "0 auto 0 -5px",
                  color: summaryAccent,
                }}
              />
              : null
              }
              
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: summaryAccent,
                }}
              >
                <PiDownloadSimple />
              </Box>
            </Box>
          </IconButton>
        </span>
      </Tooltip>

      <Fade in={open} timeout={200} unmountOnExit>
        <Paper
          elevation={8}
          role="menu"
          aria-label="Recent downloads"
          sx={{
            position: "absolute",
            top: "calc(100% + 12px)",
            right: 0,
            width: 360,
            maxHeight: 480,
            borderRadius: 2,
            p: 1,
            backgroundColor: theme.palette.background.paper,
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow:
              "0 18px 34px rgba(5, 6, 15, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.04)",
            color: theme.palette.text.primary,
            zIndex: 40,
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1 }}
          >
            <Typography variant="subtitle2">Recent downloads</Typography>
            <IconButton
              size="small"
              sx={iconButtonSx()}
              onClick={() => setOpen(false)}
            >
              <PiXBold size={14} />
            </IconButton>
          </Stack>
          <Divider
            sx={{ borderColor: theme.palette.divider, mb: 1, opacity: 0.8 }}
          />
          {displayEntries.length ? (
            <Stack
              spacing={1}
              sx={{
                maxHeight: 300,
                overflowY: "auto",
                pr: 0.5,
              }}
            >
              {displayEntries.map((entry) => {
                const percent =
                  entry.state === "done"
                    ? 100
                    : (clampPercent(entry.percent) ?? 0);
                const typeLabel = getFileTypeLabel(entry);
                const entryAccent = buildStateAccent(theme, entry.state);
                const isCompleted = entry.state === "done";
                const sizeValue =
                  typeof entry.total === "number" && entry.total > 0
                    ? entry.total
                    : typeof entry.received === "number"
                      ? entry.received
                      : null;
                const sizeLabel = sizeValue
                  ? formatBytes(sizeValue)
                  : formatProgressLabel(entry);
                const timeLabel = isCompleted
                  ? formatRelativeTime(entry.completedAt || entry.storedAt)
                  : "";
                const metaLabel = isCompleted
                  ? [sizeLabel, timeLabel].filter(Boolean).join(" • ")
                  : formatProgressLabel(entry);
                return (
                  <Stack
                    key={entry.id}
                    direction="row"
                    spacing={1.5}
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      backgroundColor: theme.palette.background.default,
                    }}
                  >
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: 1,
                        backgroundColor: theme.palette.primary.light,
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 500,
                        letterSpacing: 1.5,
                      }}
                    >
                      <Typography variant="caption">{typeLabel}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Typography
                          variant="body2"
                          title={entry.name || "Untitled file"}
                          sx={{
                            fontWeight: 500,
                            color: theme.palette.text.primary,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {entry.name || "Untitled file"}
                        </Typography>
                        {isCompleted ? (
                          <IconButton
                            size="small"
                            aria-label="Dismiss download"
                            sx={{
                              width: 24,
                              height: 24,
                              color: theme.palette.text.secondary,
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDismissEntry(entry);
                            }}
                          >
                            <PiXBold size={14} />
                          </IconButton>
                        ) : (
                          <Typography
                            variant="caption"
                            sx={{ color: entryAccent }}
                          >
                            {formatStateLabel(entry)}
                          </Typography>
                        )}
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} flexWrap="nowrap">
                        <Typography
                          variant="caption"
                          sx={{ color: theme.palette.text.secondary }}
                        >
                          {metaLabel}
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="nowrap">
                          {renderRowActions(entry)}
                        </Stack>
                      </Stack>
                      {!isCompleted && (
                        <LinearProgress
                          variant="determinate"
                          value={percent}
                          sx={{
                            mt: 0.5,
                            mb: 0.5,
                            height: 5,
                            borderRadius: 5,
                            backgroundColor: "rgba(255,255,255,0.08)",
                            "& .MuiLinearProgress-bar": {
                              borderRadius: 5,
                              backgroundImage:
                                "linear-gradient(90deg, #56dfff, #88ffb5)",
                            },
                          }}
                        />
                      )}
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          ) : (
            <Box sx={{ py: 3, textAlign: "center" }}>
              <Typography variant="body2" component="p">
                No downloads yet.
              </Typography>
            </Box>
          )}
        </Paper>
      </Fade>
    </Box>
  );
}
