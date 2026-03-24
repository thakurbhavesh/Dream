import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";
import oneDark from "react-syntax-highlighter/dist/esm/styles/prism/one-dark";
import { MdContentCopy } from "react-icons/md";
import CodeSnippetOverlay from "./CodeSnippetOverlay.jsx";

const CodeMsg = ({ message, onAction, hideInlineActions = false }) => {
  const { code = "", language, filename } = message?.content ?? {};
  const theme = useTheme();
  const isOutgoing = message?.direction === "outgoing";
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerMode, setViewerMode] = useState("view");
  const [copyToast, setCopyToast] = useState(false);
  const initialLanguage =
    typeof language === "string" && language.trim()
      ? language.trim().toLowerCase()
      : "text";
  const initialFilename = filename?.trim() || "Untitled.txt";
  const [snippetState, setSnippetState] = useState(() => ({
    code,
    language: initialLanguage,
    filename: initialFilename,
  }));

  useEffect(() => {
    setSnippetState({
      code,
      language: initialLanguage,
      filename: initialFilename,
    });
  }, [code, initialLanguage, initialFilename]);
  const resolvedFilename = snippetState.filename;
  const normalizedLanguage = snippetState.language;
  const previewLimitExceeded = useMemo(() => {
    const lineCount = (snippetState.code || "").split("\n").length;
    return lineCount > 12 || (snippetState.code || "").length > 600;
  }, [snippetState.code]);
  const syntaxTheme = theme.palette.mode === "dark" ? oneDark : oneLight;
  const lineNumberStyle = {
    minWidth: "2.5em",
    paddingRight: "0.75rem",
    textAlign: "right",
    color: alpha(theme.palette.text.secondary, 0.65),
  };
  const handleViewerOpen = (mode = "view") => {
    setViewerMode(mode === "edit" ? "edit" : "view");
    setViewerOpen(true);
  };
  const handleViewerClose = () => {
    setViewerOpen(false);
  };
  const handleShowFullClick = () => {
    handleViewerOpen("view");
  };
  const handleEdit = (overrides = {}) => {
    const nextCode =
      typeof overrides.code === "string" ? overrides.code : snippetState.code;
    if (!nextCode) return;
    const nextFilename =
      typeof overrides.filename === "string" && overrides.filename.trim()
        ? overrides.filename.trim()
        : resolvedFilename;
    const nextLanguage =
      typeof overrides.language === "string" && overrides.language.trim()
        ? overrides.language.trim().toLowerCase()
        : normalizedLanguage;
    try {
      navigator.clipboard?.writeText(nextCode);
    } catch {
      // ignore clipboard failures
    }
    try {
      window.dispatchEvent(
        new CustomEvent("chatx:edit-code-snippet", {
          detail: {
            code: nextCode,
            language: nextLanguage,
            filename: nextFilename,
            message,
          },
        })
      );
    } catch {
      // ignore if dispatch fails
    }
  };
  const handleOverlayEdit = (payload = {}) => {
    const nextCode =
      typeof payload.code === "string" ? payload.code : snippetState.code;
    const nextLanguage =
      typeof payload.language === "string" && payload.language.trim()
        ? payload.language.trim().toLowerCase()
        : snippetState.language;
    const nextFilename =
      typeof payload.filename === "string" && payload.filename.trim()
        ? payload.filename.trim()
        : snippetState.filename;
    setSnippetState({
      code: nextCode,
      language: nextLanguage,
      filename: nextFilename,
    });
    handleEdit(payload);
  };

  const handleEditButton = () => {
    handleViewerOpen("edit");
    handleEdit();
  };

  const buttonColorStyles = {
    color:
      theme.palette.mode === "light"
        ? theme.palette.primary.main
        : theme.palette.text.secondary,
  };

  return (
    <Stack
      spacing={1}
      sx={{ maxWidth: 400,minWidth: 300 }}
      bgcolor={theme.palette.background.neutral}
      borderRadius={1}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        spacing={1}
        px={1}
        pt={1}
      >
        <Typography
          variant="subtitle2"
          color="text.primary"
        >
          {resolvedFilename}
        </Typography>

        {!hideInlineActions ? (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Tooltip title="Copy code">
              <span>
                <IconButton
                  size="small"
                  onClick={() => {
                    if (!snippetState.code) return;
                    navigator.clipboard
                      ?.writeText(snippetState.code)
                      .then(() => setCopyToast(true))
                      .catch(() => setCopyToast(true));
                  }}
                >
                  <MdContentCopy size={14} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ) : (
          <Box sx={{ width: 24, height: 24 }} />
        )}
      </Stack>
        <Box
          sx={{
            backgroundColor: theme.palette.background.paper,
            overflow: "hidden",
            mt: 0,
          }}
        >
        <Box
          role="button"
          tabIndex={0}
          onClick={() => handleViewerOpen("view")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleViewerOpen("view");
            }
          }}
          sx={{
            cursor: "pointer",
            outline: "none",
            "&:focus-visible": {
              boxShadow: `0 0 0 2px ${alpha(
                theme.palette.primary.main,
                0.4
              )}`,
            },
          }}
        >
          <SyntaxHighlighter
            language={normalizedLanguage}
            style={syntaxTheme}
            showLineNumbers
            wrapLines
            wrapLongLines
            customStyle={{
              margin: 0,
              padding: 1,
              fontSize: 13,
              fontFamily:
                '"Fira Code", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
              background: "transparent",
              maxHeight: previewLimitExceeded ? 200 : "none",
              overflow: previewLimitExceeded ? "hidden" : "visible",
            }}
            lineNumberStyle={lineNumberStyle}
          >
            {snippetState.code || "// No code provided"}
          </SyntaxHighlighter>
        </Box>
        {previewLimitExceeded ? (
          <Box
            sx={{
              position: "relative",
              mt: -4,
              height: 40,
              backgroundImage: `linear-gradient(180deg, ${alpha(
                theme.palette.background.paper,
                0
              )} 0%, ${theme.palette.background.paper} 80%)`,
              pointerEvents: "none",
            }}
          />
        ) : null}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            pl: 1,
          }}
          >
            {previewLimitExceeded ? (
              <Button
                size="small"
                onClick={handleShowFullClick}
                color="inherit"
                sx={{ fontWeight: 600, ...buttonColorStyles }}
              >
                View full code
              </Button>
            ) : (
              <Box />
            )}
          {isOutgoing ? (
            <Button
              size="small"
              variant="text"
              onClick={handleEditButton}
              disabled={!snippetState.code}
              color="inherit"
              sx={{
                fontWeight: 600,
                textTransform: "capitalize",
                justifyContent: "center",
                ...buttonColorStyles,
              }}
            >
              Edit
            </Button>
          ) : null}
        </Stack>
      </Box>
      <CodeSnippetOverlay
        open={viewerOpen}
        onClose={handleViewerClose}
        code={snippetState.code}
        filename={resolvedFilename}
        language={normalizedLanguage}
        message={message}
        isOutgoing={isOutgoing}
        onAction={onAction}
        onRequestEdit={handleOverlayEdit}
        initialMode={viewerMode}
      />
      <Snackbar
        open={copyToast}
        autoHideDuration={2000}
        onClose={() => setCopyToast(false)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() => setCopyToast(false)}
          severity="success"
          sx={{ width: "100%" }}
        >
          Code copied
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export default CodeMsg;

