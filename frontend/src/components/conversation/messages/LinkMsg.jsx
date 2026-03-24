import { Box, Link, Stack, Typography, useTheme } from "@mui/material";


const getYouTubeVideoId = (value = "") => {
  if (!value) return null;
  try {
    const normalized = value.startsWith("http") ? value : `https://${value}`;
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (hostname === "youtu.be") {
      return parsed.pathname.slice(1) || null;
    }
    if (hostname.endsWith("youtube.com")) {
      if (parsed.searchParams.get("v")) {
        return parsed.searchParams.get("v");
      }
      if (parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/")[2] || null;
      }
      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.split("/")[2] || null;
      }
    }
  } catch {
    return null;
  }
  return null;
};

const buildYouTubeEmbedUrl = (videoId) =>
  `https://www.youtube.com/embed/${videoId}`;


const LinkMsg = ({ message }) => {
  const { url, title, description, thumbnail } =
    message?.content ?? {};
  const theme = useTheme();

  const youTubeId = getYouTubeVideoId(url);
  const isYouTubeLink = Boolean(youTubeId);
  const youTubeEmbedUrl = isYouTubeLink ? buildYouTubeEmbedUrl(youTubeId) : "";
  const resolvedThumbnail =
    thumbnail ||
    (youTubeId ? `https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg` : "");

  return (
    <Stack spacing={1.25} sx={{ maxWidth: !isYouTubeLink ? 400 : null }}>
      <Box
        sx={{
          borderRadius: 0,
          overflow: "hidden",
          background: theme.palette.background.default,
        }}
      >
        {isYouTubeLink ? (
          <Box
            component="iframe"
            title={title || `YouTube video ${youTubeId}`}
            src={youTubeEmbedUrl}
            width="100%"
            minWidth={"550px"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            sx={{
              border: 0,
              display: "block",
              width: "100%",
              aspectRatio: "16 / 9",
              backgroundColor: theme.palette.background.default,
            }}
          />
        ) : resolvedThumbnail ? (
          <Box
            component="img"
            src={resolvedThumbnail}
            alt={title || url}
            sx={{
              width: "100%",
              display: "block",
              objectFit: "cover",
              aspectRatio: "16 / 9",
            }}
          />
        ) : null}
        {!isYouTubeLink ? (
          <Box sx={{ padding: !isYouTubeLink && 1 }}>
            {title ? (
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  color: theme.palette.text.primary,
                  wordBreak: "break-word",
                  my: 0.5,
                }}
              >
                {title}
              </Typography>
            ) : null}
            {description ? (
              <Typography
                variant="caption"
                sx={{
                  color: theme.palette.text.secondary,
                  display: "-webkit-box",
                  overflow: "hidden",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {description}
              </Typography>
            ) : null}
            
          </Box>
        ) : null}
      </Box>
    
      {url ? (
        <Link
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          sx={{
            wordBreak: "break-all",
            color: theme.palette.text.primary,
            display: "inline-block",
            fontSize: "14px",
            maxWidth: "98%",
            "&:hover": {
              color: theme.palette.text.primary,
            },
          }}
        >
          {url}
        </Link>
      ) : null}
      {/* Intentionally showing only a single footer link to avoid duplicates */}
    </Stack>
  );
};

export default LinkMsg;
