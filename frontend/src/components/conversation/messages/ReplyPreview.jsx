import { Box, IconButton, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import {
  PiPaperclipBold,
  PiDownloadSimple,
  PiCode ,
  PiLinkSimpleBold,
  PiImageSquareBold,
} from "react-icons/pi";
import FileAttachmentTile from "../files/FileAttachmentTile.jsx";
import { resolveFileExtension } from "../files/filePreviewUtils.js";

const ATTACHMENT_TYPES = new Set(["file", "image", "video", "audio"]);

const downloadButton = ({ href, fileName, onClick, size = 24 }) => {
  if (!href) return null;
  return (
    <IconButton
      size="small"
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={fileName || undefined}
      sx={{ width: size, height: size,color: "primary.contrastText" }}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
    >
      <PiDownloadSimple size={size - 10} />
    </IconButton>
  );
};

const CodeReplyPreview = ({ theme, fileName }) => (
  <Box
    sx={{
      mt: 0.5,
      p: 0.75,
      borderRadius: 1,
      backgroundColor: alpha(theme.palette.common.black, 0.2),
    }}
  >
    <Stack direction="row" spacing={0.5} alignItems="center">
      <PiCode  size={14} color={theme.palette.common.white} />
      <Typography
        variant="body2"
        sx={{ fontWeight: 500, color: theme.palette.common.white }}
      >
        {fileName || "Code snippet"}
      </Typography>
    </Stack>
  </Box>
);

const LinkReplyPreview = ({ theme, title, url, description }) => (
  <Box
    sx={{
      mt: 0.5,
      p: 0.75,
      borderRadius: 0.5,
      backgroundColor: alpha(theme.palette.common.black, 0.1),
    }}
  >
    <Stack direction="row" spacing={0.75} alignItems="center">
      <PiLinkSimpleBold size={16} color={theme.palette.common.white} />
      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
        {title && 
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.common.white,
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </Typography>
        }
        {description ? (
          <Typography
            variant="caption"
            sx={{
              color: alpha(theme.palette.common.white, 0.85),
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {description}
          </Typography>
        ) : null}
        {url ? (
          <Typography
            variant="caption"
            component="a"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: alpha(theme.palette.common.white, 0.95),
              textDecoration: "underline",
              wordBreak: "break-all",
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {url}
          </Typography>
        ) : null}
      </Stack>
    </Stack>
  </Box>
);

const ImageReplyPreview = ({ theme, file }) => {
  const extension = resolveFileExtension(file) || "IMG";
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{
        mt: 0.5,
        p: 0.5,
        borderRadius: 0.5,
        backgroundColor: alpha(theme.palette.common.black, 0.05),
      }}
    >
      <Box
        component="img"
        src={file.thumbnail || file.preview || file.url}
        alt={file.fileName || "preview"}
        sx={{
          width: 64,
          height: 54,
          objectFit: "cover",
          borderRadius: 0.5,
          border: `1px solid ${alpha(theme.palette.common.white, 0.25)}`,
        }}
      />
      <Stack spacing={0.35} sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Typography
            variant="body2"
            sx={{
              color: theme.palette.primary.contrastText,
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {file.fileName || "Image"}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">

        <Typography
          variant="caption"
          sx={{ color: alpha(theme.palette.primary.contrastText, 0.8) }}
        >
          {`${file.fileSize || "--"} / ${extension.toUpperCase()}`}
        </Typography>
        </Stack>
      </Stack>
    </Stack>
  );
};

const ReplyPreview = ({ data, onClick, variant = "bubble" }) => {
  if (!data) return null;
  const {
    authorName,
    isSelf,
    snippet,
    type,
    fileName,
    fileSize,
    mimeType,
    url,
    fileUrl: legacyFileUrl,
    preview,
    thumbnail,
    linkTitle,
  } = data;
  const label = isSelf ? "You" : authorName || "Recipient";
  const body = snippet || fileName || "attachment";
  const previewText = type === "poll" ? `Poll - ${snippet || "Poll"}` : body;
  const isAttachmentType = ATTACHMENT_TYPES.has(type);
  const attachmentPayload = isAttachmentType
      ? {
          fileName: fileName || body,
          mimeType,
          fileSize,
          url: url || legacyFileUrl,
          preview,
          thumbnail,
          type,
        }
      : null;

  const theme = useTheme();
  const downloadAction = attachmentPayload
    ? downloadButton({
        href: attachmentPayload.url,
        fileName: attachmentPayload.fileName,
      })
    : null;

  return (
    <Box
      onClick={(event) => {
        if (onClick) {
          event.stopPropagation();
          onClick();
        }
      }}
      sx={(theme) => ({
        mb: 1,
        p: 0.5,
        borderRadius: 1,
        border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
        backgroundColor:
          variant === "composer"
            ? alpha(theme.palette.primary.main, 0.05)
            : alpha(theme.palette.primary.main, 0.8),
        cursor: onClick ? "pointer" : "default",
        minWidth: 250
      })}
    >
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography
          variant="caption"
          sx={{ fontWeight: 600, color: "primary.contrastText",fontSize: 12 }}
        >
          {label}
        </Typography>
      </Stack>
      {attachmentPayload ? (
        type === "image" ? (
          <ImageReplyPreview
            theme={theme}
            file={attachmentPayload}
          />
        ) : (
          <Box sx={{ mt: 0.5 }}>
            <FileAttachmentTile
              file={attachmentPayload}
              variant="compact"
              fullWidth
              inlineAction={downloadAction}
              sx={{
                backgroundColor: theme.palette.background.default,
                boxShadow: "none",
              }}
            />
          </Box>
        )
      ) : type === "code" ? (
        <CodeReplyPreview
          theme={theme}
          fileName={fileName}
        />
      ) : type === "link" ? (
        <LinkReplyPreview
          theme={theme}
          title={linkTitle}
          url={url}
        />
      ) : (
        <Stack direction="row" spacing={0.5} alignItems="center">
          {type === "file" ? (
            <PiPaperclipBold size={12} color="currentColor" />
          ) : null}
          <Typography
            variant="body2"
            color="primary.contrastText"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
              mt: 0.25,
            }}
          >
            {previewText}
          </Typography>
        </Stack>
      )}
    </Box>
  );
};

export default ReplyPreview;
