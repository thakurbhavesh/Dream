import { useEffect } from "react";
// @mui
import { alpha, styled, useTheme } from "@mui/material/styles";
import {
  Stack,
  Divider,
  Backdrop,
  Typography,
  IconButton,
  Tooltip,
  Box,
  Switch,
  Button,
} from "@mui/material";
// hooks
import useSettings from "../../../hooks/useSettings";
// utils
import cssStyles from "../../../utils/cssStyles";
// config
import { NAVBAR } from "../../../config";
//
import { MdClose, MdRefresh, MdInfoOutline } from "react-icons/md";
import Scrollbar from "../../Scrollbar.jsx";
//
import SettingColorPresets from "./SettingColorPresets.jsx";
import SettingFont from "./SettingFont.jsx";
import SettingFontSize from "./SettingFontSize.jsx";
import SettingBrandColorPicker from "./SettingBrandColorPicker.jsx";

// ----------------------------------------------------------------------

const RootStyle = styled("div")(({ theme }) => ({
  ...cssStyles(theme).bgBlur({
    color: theme.palette.background.paper,
    opacity: 0.92,
  }),
  top: 28,
  right: 16,
  bottom: 0,
  display: "flex",
  position: "fixed",
  overflow: "hidden",
  width: NAVBAR.BASE_WIDTH,
  height: "calc(100vh - 60px)",
  flexDirection: "column",
  margin: theme.spacing(2),
  zIndex: theme.zIndex.drawer + 999,
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  boxShadow: `-12px 12px 32px -4px ${alpha(
    theme.palette.mode === 'light' ? theme.palette.grey[600] : theme.palette.common.black,
    0.36
  )}`,
  
}));

// ----------------------------------------------------------------------

export default function SettingsDrawer({
  open,
  setOpen,
  hideChatLayout = false,
  dialogSize = null,
  onDialogSizeChange = null,
}) {
  const { onResetSetting, chatListRightAligned, onToggleChatLayout } = useSettings();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [open]);

  const handleClose = () => {
    setOpen(false);
  };
  const theme = useTheme();

  return (
    <>
      <Backdrop
        open={open}
        onClick={handleClose}
        sx={{
          background: "transparent",
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      />

      {open && (
        <RootStyle>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ py: 2, pr: 1, pl: 2.5 }}
          >
            <Typography
              variant="body"
              sx={{ flexGrow: 1 }}
              color={theme.palette.mode === "light" ? "inherit" : "#ddd"}
            >
              Settings
            </Typography>

            <IconButton onClick={onResetSetting} title="Reset Palette">
              <MdRefresh size={20} />
            </IconButton>

            <IconButton onClick={handleClose} title="Close">
              <MdClose size={20} />
            </IconButton>
          </Stack>

          <Divider sx={{ borderStyle: "dashed" }} />

          <Scrollbar sx={{ flexGrow: 1 }}>
            <Stack spacing={3} sx={{ p: 3 }}>

              {!hideChatLayout ? (
                <Stack spacing={1.5}>
                  <Typography
                    variant="subtitle2"
                    color={theme.palette.mode === "light" ? "inherit" : "#ddd"}
                  >
                    Chat Layout
                  </Typography>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{
                      px: 1.5,
                      borderRadius: 1,
                      border: (t) => `1px solid ${t.palette.divider}`,
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mr: 2 }}
                    >
                      {chatListRightAligned ? "Chat list on right" : "Chat list on left"}
                    </Typography>
                    <Switch
                      edge="end"
                      checked={chatListRightAligned}
                      onChange={onToggleChatLayout}
                      inputProps={{ "aria-label": "Toggle chat layout" }}
                    />
                  </Stack>
                </Stack>
              ) : null}

              <Stack spacing={1.5}>
                <Typography
                  variant="subtitle2"
                  color={theme.palette.mode === "light" ? "inherit" : "#ddd"}
                >
                  Presets
                </Typography>
                <SettingColorPresets />
              </Stack>

              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography
                    variant="subtitle2"
                    color={theme.palette.mode === "light" ? "inherit" : "#ddd"}
                  >
                    Brand Color
                  </Typography>
                  <Tooltip
                    placement="top"
                    title="Enter a HEX code (e.g. #123ABC) or pick from the color wheel, then press Apply to preview the brand theme."
                  >
                    <Box
                      component="span"
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        color:
                          theme.palette.mode === "light"
                            ? theme.palette.text.secondary
                            : "#bbb",
                        cursor: "help",
                      }}
                    >
                      <MdInfoOutline size={16} />
                    </Box>
                  </Tooltip>
                </Stack>
                <SettingBrandColorPicker />
              </Stack>

              <Stack spacing={1.5}>
                <Typography
                  variant="subtitle2"
                  color={theme.palette.mode === "light" ? "inherit" : "#ddd"}
                >
                  Font
                </Typography>
                <SettingFont />
              </Stack>

              <Stack spacing={1.5}>
                <Typography
                  variant="subtitle2"
                  color={theme.palette.mode === "light" ? "inherit" : "#ddd"}
                >
                  Font Size
                </Typography>
                <SettingFontSize />
              </Stack>

              {typeof onDialogSizeChange === "function" ? (
                <Stack spacing={1.5}>
                  <Typography
                    variant="subtitle2"
                    color={theme.palette.mode === "light" ? "inherit" : "#ddd"}
                  >
                    Dialog Size
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {["small", "medium", "large"].map((sizeKey) => {
                      const selected = String(dialogSize || "medium").toLowerCase() === sizeKey;
                      return (
                        <Button
                          key={sizeKey}
                          size="small"
                          variant={selected ? "contained" : "outlined"}
                          onClick={() => onDialogSizeChange(sizeKey)}
                          sx={{ minWidth: 90, textTransform: "none" }}
                        >
                          {sizeKey.charAt(0).toUpperCase() + sizeKey.slice(1)}
                        </Button>
                      );
                    })}
                  </Stack>
                </Stack>
              ) : null}
            </Stack>
          </Scrollbar>
        </RootStyle>
      )}
    </>
  );
}
