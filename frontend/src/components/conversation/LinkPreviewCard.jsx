import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Link as MuiLink,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { PiLinkSimple, PiX, PiShieldWarning, PiWarning } from "react-icons/pi";
import inspectLink from "../../utils/linkSafety";

const MICROLINK_ENDPOINT =
  "https://api.microlink.io/?audio=false&video=false&iframe=false&palette=false&url=";
const SCREENSHOT_FALLBACK_BASE =
  "https://image.thum.io/get/width/800/crop/450/";
const NOEMBED_ENDPOINT = "https://noembed.com/embed?url=";
const YOUTUBE_FAVICON =
  "https://www.youtube.com/s/desktop/fe2e647f/img/favicon_32.png";
const PREVIEW_CACHE_TTL = 5 * 60 * 1000;
const previewCache = new Map();

const sanitizeUrl = (value) => {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return parsed.toString();
  } catch {
    return "";
  }
};

const buildScreenshotUrl = (url) =>
  `${SCREENSHOT_FALLBACK_BASE}${encodeURIComponent(url)}`;

const parseMicrolinkPayload = (payload, fallbackUrl) => {
  const data = payload?.data ?? {};
  const resolvedUrl = sanitizeUrl(data.url || fallbackUrl) || fallbackUrl;
  const hostname = resolvedUrl
    ? (() => {
        try {
          return new URL(resolvedUrl).hostname.replace(/^www\./i, "");
        } catch {
          return resolvedUrl;
        }
      })()
    : "";
  return {
    url: resolvedUrl,
    title: data.title?.trim() || hostname || resolvedUrl,
    description: data.description?.trim() || "",
    image:
      data.image?.url ||
      data.logo?.url ||
      (resolvedUrl ? buildScreenshotUrl(resolvedUrl) : ""),
    siteName: data.publisher?.trim() || hostname || "",
    favicon: data.logo?.url || null,
  };
};

const isYouTubeUrl = (value) => {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname
      .replace(/^www\./i, "")
      .toLowerCase();
    return hostname === "youtu.be" || hostname.endsWith("youtube.com");
  } catch {
    return false;
  }
};

const fetchMicrolinkPreview = async (url, signal) => {
  const response = await fetch(
    `${MICROLINK_ENDPOINT}${encodeURIComponent(url)}`,
    { signal }
  );
  if (!response.ok) {
    throw new Error("Unable to fetch link details");
  }
  const payload = await response.json();
  return parseMicrolinkPayload(payload, url);
};

const fetchYouTubePreview = async (url, signal) => {
  const response = await fetch(
    `${NOEMBED_ENDPOINT}${encodeURIComponent(url)}`,
    { signal }
  );
  if (!response.ok) {
    throw new Error("Unable to fetch YouTube link details");
  }
  const data = await response.json();
  const resolvedUrl = sanitizeUrl(data.url || url) || url;
  const siteLabel = data.provider_name || "YouTube";
  const siteName = (() => {
    try {
      const parsed = new URL(resolvedUrl);
      return `${parsed.hostname}${parsed.pathname}${parsed.search}`.replace(
        /\/$/,
        ""
      );
    } catch {
      return resolvedUrl;
    }
  })();
  return {
    url: resolvedUrl,
    title: data.title?.trim() || "YouTube Video",
    description: data.author_name
      ? `${data.author_name} • ${siteLabel}`
      : siteLabel,
    image: data.thumbnail_url || buildScreenshotUrl(resolvedUrl),
    siteName,
    favicon: YOUTUBE_FAVICON,
  };
};

const getCachedPreview = (url) => {
  if (!url) return null;
  const entry = previewCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > PREVIEW_CACHE_TTL) {
    previewCache.delete(url);
    return null;
  }
  return entry.data;
};

const cachePreview = (url, data) => {
  if (!url || !data) return;
  previewCache.set(url, { data, timestamp: Date.now() });
  if (previewCache.size > 200) {
    const oldestKey = previewCache.keys().next().value;
    if (oldestKey) {
      previewCache.delete(oldestKey);
    }
  }
};

const invalidatePreviewCache = (url) => {
  if (!url) return;
  previewCache.delete(url);
};

const LinkPreviewCard = ({
  url,
  onRemove,
  onMetadata,
  initialMetadata = null,
}) => {
  const theme = useTheme();
  const [preview, setPreview] = useState(initialMetadata);
  const [status, setStatus] = useState(initialMetadata ? "ready" : "idle");
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const normalizedUrl = useMemo(() => sanitizeUrl(url), [url]);

  const handleRetry = useCallback(() => {
    invalidatePreviewCache(normalizedUrl);
    setReloadKey((value) => value + 1);
  }, [normalizedUrl]);

  useEffect(() => {
    if (!normalizedUrl) return;
    if (initialMetadata) {
      cachePreview(normalizedUrl, initialMetadata);
      setPreview(initialMetadata);
      setStatus("ready");
      setError(null);
      return;
    }
    const cached = getCachedPreview(normalizedUrl);
    if (cached) {
      setPreview(cached);
      setStatus("ready");
      setError(null);
      onMetadata?.(cached);
      return;
    }
    let isMounted = true;
    const controller = new AbortController();
    const fetchPreview = async () => {
      try {
        setStatus("loading");
        setError(null);

        let parsed = null;
        if (isYouTubeUrl(normalizedUrl)) {
          try {
            parsed = await fetchYouTubePreview(
              normalizedUrl,
              controller.signal
            );
          } catch (youtubeError) {
            if (youtubeError.name === "AbortError") {
              throw youtubeError;
            }
            parsed = null;
          }
        }

        if (!parsed) {
          parsed = await fetchMicrolinkPreview(
            normalizedUrl,
            controller.signal
          );
        }

        if (!isMounted) return;
        setPreview(parsed);
        setStatus("ready");
        cachePreview(normalizedUrl, parsed);
        onMetadata?.(parsed);
      } catch (fetchError) {
        if (!isMounted) return;
        setPreview(null);
        setStatus("error");
        setError(fetchError.message || "Unable to fetch link details");
        onMetadata?.(null);
      }
    };
    fetchPreview();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [normalizedUrl, reloadKey, initialMetadata, onMetadata]);

  if (!normalizedUrl) {
    return null;
  }

  const showSkeleton = status === "loading" && !preview;
  const showError = status === "error";
  const activePreview = preview || initialMetadata || null;
  const safetyWarning = useMemo(() => inspectLink(activePreview?.url || normalizedUrl), [activePreview?.url, normalizedUrl]);

  return (
    <Box
      sx={{
        background: theme.palette.background.default,
        marginBottom: "-4px",
        borderRadius: "8px 8px 0 0",
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      {safetyWarning && (
        <Stack
          direction="row"
          spacing={1}
          alignItems="flex-start"
          sx={{
            px: 1.25,
            py: 0.75,
            borderBottom: `1px solid ${theme.palette.divider}`,
            bgcolor:
              safetyWarning.level === "danger"
                ? "rgba(220, 38, 38, 0.08)"
                : "rgba(245, 158, 11, 0.10)",
            color:
              safetyWarning.level === "danger" ? "#dc2626" : "#b45309",
          }}
        >
          {safetyWarning.level === "danger" ? (
            <PiShieldWarning size={16} style={{ marginTop: 2, flexShrink: 0 }} />
          ) : (
            <PiWarning size={16} style={{ marginTop: 2, flexShrink: 0 }} />
          )}
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "inherit", lineHeight: 1.3 }}>
              {safetyWarning.title}
            </Typography>
            <Typography variant="caption" sx={{ color: "inherit", opacity: 0.85, lineHeight: 1.4 }}>
              {safetyWarning.detail}
            </Typography>
          </Stack>
        </Stack>
      )}
      <Box
        sx={{
          position: "relative",
          p: 1,
          borderRadius: 1,
          backgroundColor: theme.palette.background.default,
          overflow: "hidden",
        }}
      >
        <Stack direction="row" spacing={2}>
          <Box
            sx={{
              width: 112,
              height: 90,
              flexShrink: 0,
              backgroundColor: theme.palette.action.hover,
              position: "relative",
              overflow:"hidden",
              borderRadius: 1
            }}
          >
            {showSkeleton ? (
              <Skeleton variant="rectangular" width="100%" height="100%" />
            ) : activePreview?.image ? (
              <Box
                component="img"
                src={activePreview.image}
                alt={activePreview.title}
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <Stack
                alignItems="center"
                justifyContent="center"
                sx={{ width: "100%", height: "100%", color: "text.secondary" }}
              >
                <PiLinkSimple size={28} />
              </Stack>
            )}
          </Box>
          <Stack
            spacing={0.5}
            sx={{ py: 1.5, pr: 3, flex: 1 }}
            justifyContent="center"
          >
            {showSkeleton ? (
              <>
                <Skeleton variant="text" width="70%" height={20} />
                <Skeleton variant="text" width="90%" height={16} />
                <Skeleton variant="text" width="50%" height={16} />
              </>
            ) : showError ? (
              <>
                <Typography variant="subtitle2" color="error">
                  Failed to load preview
                </Typography>
                <Typography variant="caption" color="error">
                  {error}
                </Typography>
                <Button
                  variant="text"
                  size="small"
                  onClick={handleRetry}
                  sx={{ alignSelf: "flex-start", mt: 0.5 }}
                >
                  Retry
                </Button>
              </>
            ) : (
              <>
                {activePreview?.title ? (
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 600, color: "text.primary" }}
                  >
                    {activePreview.title}
                  </Typography>
                ) : null}
                {activePreview?.description ? (
                  <Typography
                    variant="body2"
                    sx={{
                      color: theme.palette.text.secondary,
                      display: "-webkit-box",
                      overflow: "hidden",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {activePreview.description}
                  </Typography>
                ) : null}
                <MuiLink
                  href={activePreview?.url || normalizedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                  sx={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: theme.palette.primary.main,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    alignSelf: "flex-start",
                    width: "fit-content",
                  }}
                >
                  <PiLinkSimple size={14} />
                  {activePreview?.siteName || normalizedUrl}
                </MuiLink>
              </>
            )}
          </Stack>
          <IconButton
            size="small"
            onClick={() => onRemove?.()}
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.secondary,
            }}
          >
            <PiX size={12} />
          </IconButton>
        </Stack>
      </Box>
    </Box>
  );
};

export default LinkPreviewCard;
