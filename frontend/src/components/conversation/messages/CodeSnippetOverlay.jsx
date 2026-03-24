import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";
import oneDark from "react-syntax-highlighter/dist/esm/styles/prism/one-dark";
import { RiReplyLine } from "react-icons/ri";
import {
  PiDownloadSimpleBold,
  PiEyeBold,
  PiPencilSimpleLineDuotone,
  PiShareFatBold,
  PiXBold,
} from "react-icons/pi";
import { MdContentCopy } from "react-icons/md";
import {
  getLanguageDisplayName,
  getOverlayLanguageOptions,
} from "./helpers.js";
import CustomScrollbars from "../../Scrollbar.jsx";

const LanguageMenuPaper = forwardRef(function LanguageMenuPaper(props, ref) {
  return (
    <Paper ref={ref} {...props}>
      <CustomScrollbars
        autoHeight
        autoHeightMin={0}
        autoHeightMax={400}
        style={{ maxHeight: 400 }}
      >
        <Box>{props.children}</Box>
      </CustomScrollbars>
    </Paper>
  );
});

const getOverlayHost = () => {
  if (typeof document === "undefined") return null;
  return (
    document.querySelector('[data-conversation-overlay-root="true"]') ||
    document.body
  );
};

const ACTION_CONFIG = [
  { key: "reply", icon: RiReplyLine, label: "Reply" },
  { key: "forward", icon: PiShareFatBold, label: "Forward" },
];

const FONT_FAMILY =
  '"Fira Code", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';

const CodeSnippetOverlay = ({
  open,
  onClose,
  code = "",
  filename = "Untitled.txt",
  language = "plaintext",
  message,
  isOutgoing = false,
  onAction,
  onRequestEdit,
  initialMode = "view",
}) => {
  const theme = useTheme();
  const syntaxTheme = theme.palette.mode === "dark" ? oneDark : oneLight;
  const [mode, setMode] = useState(initialMode === "edit" ? "edit" : "view");
  const [viewerVariant, setViewerVariant] = useState("code");
  const languageOptions = useMemo(() => getOverlayLanguageOptions(), []);
  const [formState, setFormState] = useState(() => ({
    filename: filename?.trim() || "",
    code: code || "",
    language:
      typeof language === "string" && language.trim()
        ? language.trim().toLowerCase()
        : "plaintext",
  }));
  const [overlayRoot, setOverlayRoot] = useState(() => getOverlayHost());
  const textareaRef = useRef(null);
  const previewScrollRef = useRef(null);
  const [copyToast, setCopyToast] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode === "edit" ? "edit" : "view");
    setViewerVariant("code");
    setFormState({
      filename: filename?.trim() || "",
      code: code || "",
      language:
        typeof language === "string" && language.trim()
          ? language.trim().toLowerCase()
          : "plaintext",
    });
  }, [open, filename, code, language]);

  useEffect(() => {
    if (overlayRoot) return;
    setOverlayRoot(getOverlayHost());
  }, [overlayRoot]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (mode !== "edit") return;
    requestAnimationFrame(() => {
      syncScrollPosition();
    });
  }, [mode]);

  const normalizedLanguage = useMemo(() => {
    const exists = languageOptions.some(
      (option) => option.id === formState.language
    );
    return exists ? formState.language : "plaintext";
  }, [formState.language, languageOptions]);

  const languageLabel =
    languageOptions.find((option) => option.id === normalizedLanguage)?.label ||
    getLanguageDisplayName(normalizedLanguage);
  const uppercaseLanguageLabel =
    typeof languageLabel === "string"
      ? languageLabel.toUpperCase()
      : languageLabel;
  const resolvedFilename = formState.filename?.trim() || "Untitled.txt";
  const canSubmitEdit = isOutgoing && Boolean(formState.code.trim());

  const closeOverlay = () => {
    if (!open) return;
    onClose?.();
  };

  const handleAction = (key) => {
    if (!onAction || !key) return;
    onAction(key, { source: "code-overlay" });
    closeOverlay();
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([formState.code || ""], {
        type: "text/plain;charset=utf-8",
      });
      const downloadLink = document.createElement("a");
      const sanitizedName = resolvedFilename.replace(/[\\/:"*?<>|]+/g, "_");
      const objectUrl = URL.createObjectURL(blob);
      downloadLink.href = objectUrl;
      downloadLink.download = sanitizedName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch {
      // ignore download failures
    }
  };

  const handleCopyCode = () => {
    if (!formState.code) return;
    navigator.clipboard?.writeText(formState.code).catch(() => {});
    setCopyToast(true);
  };

  const toggleMode = () => {
    if (!isOutgoing) return;
    setMode((prev) => (prev === "view" ? "edit" : "view"));
  };

  const handleSubmitEdit = () => {
    if (!canSubmitEdit) return;
    onRequestEdit?.({
      code: formState.code,
      filename: resolvedFilename,
      language: normalizedLanguage,
      message,
    });
    setMode("view");
    closeOverlay();
  };

  const renderActionButtons = () => {
    const items = [
      ...ACTION_CONFIG,
      {
        key: "download",
        icon: PiDownloadSimpleBold,
        label: "Download",
        onClick: handleDownload,
      },
    ];
    const editItem = isOutgoing
      ? [
          {
            key: "edit-toggle",
            icon: mode === "view" ? PiPencilSimpleLineDuotone : PiEyeBold,
            label: mode === "view" ? "Edit snippet" : "View mode",
            onClick: toggleMode,
          },
        ]
      : [];
    const closeItem = [
      { key: "close", icon: PiXBold, label: "Close", onClick: closeOverlay },
    ];
    return [...items, ...editItem, ...closeItem];
  };

  const syncScrollPosition = () => {
    if (!textareaRef.current || !previewScrollRef.current) return;
    const view = previewScrollRef.current.getView?.();
    if (!view) return;
    view.scrollTop = textareaRef.current.scrollTop;
    view.scrollLeft = textareaRef.current.scrollLeft;
  };

  const viewerSurface =
    mode === "edit" ? (
      <Box
        sx={{
          flexGrow: 1,
          width: "100%",
          position: "relative",
          backgroundColor: theme.palette.background.paper,
          fontFamily: FONT_FAMILY,
        }}
      >
        <CustomScrollbars ref={previewScrollRef} autoHide={true}>
          <Box aria-hidden="true">
            <SyntaxHighlighter
              language={normalizedLanguage}
              style={syntaxTheme}
              showLineNumbers
              wrapLines
              customStyle={{
                margin: 0,
                padding: 2,
                fontSize: 14,
                fontFamily: FONT_FAMILY,
                background: "transparent",
                minHeight: "100%",
              }}
              lineNumberStyle={{
                minWidth: "2.5em",
                paddingRight: "0.75rem",
                textAlign: "right",
                color: theme.palette.text.primary,
              }}
            >
              {formState.code || "// No code provided"}
            </SyntaxHighlighter>
          </Box>
        </CustomScrollbars>
        <Box
          component="textarea"
          ref={textareaRef}
          value={formState.code}
          onChange={(event) =>
            setFormState((prev) => ({ ...prev, code: event.target.value }))
          }
          onScroll={syncScrollPosition}
          spellCheck={false}
          wrap="off"
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
            resize: "none",
            outline: "none",
            backgroundColor: "transparent",
            color: "transparent",
            caretColor: theme.palette.primary.main,
            fontFamily: FONT_FAMILY,
            fontSize: 13,
            lineHeight: 1.5,
            p: 2,
          }}
        />
      </Box>
    ) : viewerVariant === "text" ? (
      <Box
        component="pre"
        sx={{
          flexGrow: 1,
          width: "100%",
          p: 2,
          overflow: "auto",
          whiteSpace: "pre-wrap",
          fontFamily: FONT_FAMILY,
          fontSize: 13,
          bgcolor: theme.palette.background.paper,
          color: theme.palette.text.primary,
        }}
      >
        {formState.code || "// No code provided"}
      </Box>
    ) : (
      <Box
        sx={{
          flexGrow: 1,
          width: "100%",
          overflow: "hidden",
          backgroundColor:
            theme.palette.mode === "dark"
              ? alpha("#0d0d0d", 0.95)
              : alpha(theme.palette.background.paper, 0.95),
          color:
            theme.palette.mode === "dark"
              ? theme.palette.common.white
              : theme.palette.text.primary,
          "& pre": {
            marginBottom: 0,
          },
        }}
      >
        <SyntaxHighlighter
          language={normalizedLanguage}
          style={syntaxTheme}
          showLineNumbers
          wrapLines
          customStyle={{
            margin: 0,
            padding: "16px 20px",
            fontSize: 13,
            fontFamily: FONT_FAMILY,
            background: "transparent",
            height: "100%",
            maxHeight: "100%",
          }}
          lineNumberStyle={{
            minWidth: "2.5em",
            paddingRight: "0.75rem",
            textAlign: "right",
            color: alpha(theme.palette.text.secondary, 0.65),
          }}
        >
          {formState.code || "// No code provided"}
        </SyntaxHighlighter>
      </Box>
    );

  const authorName =
    message?.author?.name ||
    message?.authorName ||
    message?.senderName ||
    message?.metadata?.senderName ||
    "";

  if (!open || !overlayRoot) {
    return null;
  }

  const overlayBackground =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.background.default, 0.82)
      : alpha(theme.palette.common.black, 0.18);

  return createPortal(
    <>
      <Box
        onClick={closeOverlay}
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: (muiTheme) => muiTheme.zIndex.modal,
          backgroundColor: overlayBackground,
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      >
        <Box
          onClick={(event) => event.stopPropagation()}
          sx={{
            width: "100%",
            height: "100%",
            bgcolor: theme.palette.background.paper,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
    >
          <Stack
            spacing={1.5}
            sx={{
              p: 2,
              borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
              backgroundColor:
                theme.palette.mode === "dark"
                  ? alpha("#050505", 0.85)
                  : alpha(theme.palette.common.black, 0.1),
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent={"space-between"}
            >
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                justifyContent={"space-between"}
              >
                {mode === "edit" ? (
                  <TextField
                    label="File name"
                    size="small"
                    fullWidth
                    value={formState.filename}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        filename: event.target.value,
                      }))
                    }
                    placeholder="Untitled.txt"
                  />
                ) : (
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600 }}
                    color="text.primary"
                    noWrap
                  >
                    {resolvedFilename}
                  </Typography>
                )}
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={viewerVariant}
                  onChange={(_, value) => {
                    if (value) setViewerVariant(value);
                  }}
                  gap={0.75}
                  sx={{
                    gap: 1,
                    "& .MuiToggleButton-root": {
                      textTransform: "uppercase",
                      fontSize: 11,
                      px: 1.25,
                      borderRadius: 1,
                    },
                  }}
                >
                  <ToggleButton value="code">Code</ToggleButton>
                  <ToggleButton value="text">Text</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
                justifyContent="flex-end"
              >
                {mode === "edit" ? (
                  <TextField
                    select
                    size="small"
                    label="Language"
                    value={normalizedLanguage}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        language: event.target.value,
                      }))
                    }
                    sx={{ minWidth: 200 }}
                    SelectProps={{
                      MenuProps: {
                        PaperProps: {
                          component: LanguageMenuPaper,
                          sx: { maxHeight: 400, top: 165 },
                        },
                        anchorOrigin: {
                          vertical: "bottom",
                          horizontal: "left",
                        },
                        transformOrigin: {
                          vertical: "top",
                          horizontal: "left",
                        },
                        marginThreshold: 0,
                      },
                    }}
                  >
                    {languageOptions.map((option) => (
                      <MenuItem key={option.id} value={option.id}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        textTransform: "uppercase",
                        fontWeight: 600,
                        px: 1.25,
                        py: 0.5,
                        borderRadius: 1,
                        border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
                      }}
                    >
                      {uppercaseLanguageLabel}
                    </Typography>
                  </Stack>
                )}
                <Stack direction="row" spacing={0.5} alignItems="center">
                  {renderActionButtons().map((action) => {
                    const Icon = action.icon;
                    const clickHandler =
                      action.onClick ||
                      (() => handleAction(action.key ?? null));
                    const disabled =
                      (action.key === "edit-toggle" && !isOutgoing) ||
                      (!action.onClick && !onAction);
                    return (
                      <Tooltip key={action.key} title={action.label}>
                        <IconButton
                          size="small"
                          onClick={clickHandler}
                          disabled={disabled}
                          sx={{
                            width: 34,
                            height: 34,
                            borderRadius: 1,
                            color: theme.palette.text.secondary,
                            border: "none",
                            bgcolor: "transparent",
                            "&:hover": {
                              color: theme.palette.primary.main,
                              bgcolor: alpha(theme.palette.primary.main, 0.08),
                            },
                          }}
                        >
                          <Icon size={18} />
                        </IconButton>
                      </Tooltip>
                    );
                  })}
                </Stack>
              </Stack>
            </Stack>
          </Stack>
          <Box
            sx={{
              flexGrow: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              p: 1,
              gap: 1,
              backgroundColor: alpha(theme.palette.primary.main, 0.05),
            }}
          >
            <Stack
              direction="row"
              spacing={0.5}
              justifyContent="space-between"
              alignItems="center"
            >
              {authorName ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontStyle: "italic" }}
                >
                  from : <strong>{authorName}</strong>
                </Typography>
              ) : null}
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Tooltip title="Copy code">
                  <IconButton
                    size="small"
                    onClick={handleCopyCode}
                    disabled={!formState.code}
                  >
                    <MdContentCopy size={18} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
            {viewerSurface}
            {mode === "edit" ? (
              <Stack
                direction="row"
                justifyContent="flex-end"
                spacing={1}
                pt={1}
              >
                <Button onClick={toggleMode}>Cancel</Button>
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleSubmitEdit}
                  disabled={!canSubmitEdit}
                  sx={{ px: 4, fontWeight: 600 }}
                >
                  Submit
                </Button>
              </Stack>
            ) : (
              <Stack direction="row" justifyContent="flex-end" pt={1}>
                <Button
                  onClick={closeOverlay}
                  variant="contained"
                  color="error"
                >
                  Close
                </Button>
              </Stack>
            )}
          </Box>
        </Box>
      </Box>
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
    </>,
    overlayRoot
  );
};

export default CodeSnippetOverlay;

