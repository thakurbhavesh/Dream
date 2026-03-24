import { Box, IconButton, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import {
  PiPaperclipBold,
  PiXBold,
  PiLinkSimpleBold,
  PiImageSquareBold,
  PiCode,
} from "react-icons/pi";
import { RiReplyLine } from "react-icons/ri";
import FileAttachmentTile from "./files/FileAttachmentTile.jsx";

const ATTACHMENT_TYPES = new Set(["file", "image", "video", "audio"]);

const LinkPreview = ({ theme, url }) => (
  <Box
    sx={{
      mt: 0.75,
    }}
  >
    <Stack direction="row" spacing={0.75} alignItems="flex-start">
      <PiLinkSimpleBold
        size={16}
        color={alpha(theme.palette.text.primary, 0.8)}
        style={{ flexShrink: 0 }}
      />
      <Stack spacing={0.3} sx={{ minWidth: 0 }}>
        {url ? (
          <Typography
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            variant="caption"
            sx={{
              color: theme.palette.text.primary,
              textDecoration: "none",
              wordBreak: "break-all",
            }}
          >
            {url}
          </Typography>
        ) : null}
      </Stack>
    </Stack>
  </Box>
);

const ImagePreview = ({ theme, file }) => {
  const previewSrc = file.thumbnail || file.preview || file.url || "";
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{
        mt: 0.75,
      }}
    >
      <Box
        sx={{
          width: 54,
          height: 44,
          borderRadius: 0.75,
          overflow: "hidden",
          border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {previewSrc ? (
          <Box
            component="img"
            src={previewSrc}
            alt={file.fileName || "preview"}
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <PiImageSquareBold
            size={28}
            color={alpha(theme.palette.text.primary, 0.5)}
          />
        )}
      </Box>
      <Stack spacing={0.3} sx={{ minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.primary,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {file.fileName || "Image"}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: alpha(theme.palette.text.primary, 0.7) }}
        >
          {file.fileSize || file.mimeType || "size / type"}
        </Typography>
      </Stack>
    </Stack>
  );
};

const CodePreview = ({ theme, fileName }) => (
  <Box
    sx={{
      mt: 0.75,
    }}
  >
    <Stack direction="row" spacing={0.65} alignItems="flex-start">
      <PiCode size={16} color={theme.palette.primary.main} />
      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.primary,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {fileName || "Code snippet"}
        </Typography>
       
      </Stack>
    </Stack>
  </Box>
);

const ReplyComposerPreview = ({ data, onCancel }) => {
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
    fileUrl,
    preview,
    thumbnail,
    linkTitle,
    linkDescription,
  } = data;
  const label = isSelf ? "Me" : authorName || "Member";
  const body = type === "file" && fileName ? fileName : snippet || "Attachment";
  const previewText =
    type === "poll" ? `Poll - ${snippet || "Poll"}` : body;

  const theme = useTheme();
  const isAttachmentType = ATTACHMENT_TYPES.has(type);
  const attachmentPayload = isAttachmentType
    ? {
        fileName: fileName || body,
        fileSize,
        mimeType,
        url: url || fileUrl,
        preview,
        thumbnail,
        type,
      }
    : null;

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="flex-start"
      sx={(theme) => ({
        px: 1.5,
        py: 1,
        borderRadius: 1,
        backgroundColor: alpha(theme.palette.primary.main, 0.05),
        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        mb: 1,
      })}
    >
      <Box sx={{ flexGrow: 1 }}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Typography
            variant="caption"
            sx={{
              fontWeight: 500,
              color:
                theme.palette.mode === "light"
                  ? theme.palette.primary.main
                  : theme.palette.text.primary,
            }}
          >
            Replying to {label}
          </Typography>
          <RiReplyLine size={16} color={theme.palette.text.secondary} />
        </Stack>
        {attachmentPayload ? (
          type === "image" ? (
            <ImagePreview theme={theme} file={attachmentPayload} />
          ) : (
            <Box sx={{ mt: 0.75 }}>
              <FileAttachmentTile
                file={attachmentPayload}
                variant="compact"
                fullWidth
                sx={{
                  backgroundColor: theme.palette.background.paper,
                  boxShadow: "none",
                }}
              />
            </Box>
          )
        ) : type === "link" ? (
          <LinkPreview
            theme={theme}
            title={linkTitle || snippet || body}
            url={url}
            description={linkDescription}
          />
        ) : type === "code" ? (
          <CodePreview
            theme={theme}
            fileName={fileName || "Code Snippet"}
            snippet={snippet}
          />
        ) : (
          <Stack direction="row" spacing={0.5} alignItems="center" mt={0.5}>
            {type === "file" ? (
              <PiPaperclipBold size={16} color="text.secondary" />
            ) : null}
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {previewText || type}
            </Typography>
          </Stack>
        )}
      </Box>
      <IconButton
        size="small"
        onClick={onCancel}
        sx={{
          mt: -0.5,
          color: "text.secondary",
          "&:hover": { color: "primary.main" },
        }}
      >
        <PiXBold size={14} />
      </IconButton>
    </Stack>
  );
};

export default ReplyComposerPreview;
