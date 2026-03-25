import {
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import {
  PiTrashSimpleBold,
  PiArrowCounterClockwiseBold,
  PiPencilSimpleLineDuotone,
  PiSmileyBold,
  PiCopySimpleBold,
  PiTranslateBold,
  PiMagicWandBold,
  PiInfoBold,
  PiShareFatBold,
  PiPushPinBold,
  PiCheckSquareOffsetBold,
  PiPenNibBold,
} from "react-icons/pi";
import { RiReplyLine } from "react-icons/ri";
import { getMenuOptions } from "./helpers.js";

const iconRegistry = {
  delete: PiTrashSimpleBold,
  unsend: PiArrowCounterClockwiseBold,
  edit: PiPencilSimpleLineDuotone,
  "quick-react": PiSmileyBold,
  copy: PiCopySimpleBold,
  translate: PiTranslateBold,
  summarize: PiMagicWandBold,
  "tone-adjust": PiPenNibBold,
  info: PiInfoBold,
  reply: RiReplyLine,
  forward: PiShareFatBold,
  pin: PiPushPinBold,
  select: PiCheckSquareOffsetBold,
};

const MessageMenu = ({ open, anchorEl, anchorPosition, onClose, message, currentUserId, onAction }) => {
  const options = getMenuOptions(message, currentUserId);

  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorEl={anchorEl}
      anchorReference={anchorPosition ? "anchorPosition" : "anchorEl"}
      anchorPosition={anchorPosition ? { top: anchorPosition.top, left: anchorPosition.left } : undefined}
      transitionDuration={0}
      TransitionProps={{ timeout: 0 }}
      slotProps={{
        paper: {
          sx: {
            borderRadius: 1,
            p: 0.5,
            minWidth: 220,
          },
        },
      }}
    >
      {options.map((option) => {
        const Icon = iconRegistry[option.key] ?? PiInfoBold;
        return (
            <MenuItem
              key={option.key}
              disabled={option.disabled}
              onClick={() => {
                onAction?.(option.key, message, { option });
                onClose?.();
              }}
              sx={{
                borderRadius: 1,
              "&.Mui-disabled": {
                opacity: 0.4,
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 32,
                color: (theme) =>
                  option.tone === "danger"
                    ? theme.palette.error.main
                    : theme.palette.text.primary,
              }}
            >
              <Icon
                size={18}
                style={{ color: "inherit" }}
              />
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: option.tone === "danger" ? 600 : 500,
                    color: (theme) =>
                      option.tone === "danger"
                        ? theme.palette.error.main
                        : theme.palette.text.primary,
                  }}
                >
                  {option.label}
                </Typography>
              }
              secondary={
                option.helper ? (
                  <Typography variant="caption" color="text.secondary">
                    {option.helper}
                  </Typography>
                ) : undefined
              }
            />
          </MenuItem>
        );
      })}
    </Menu>
  );
};

export default MessageMenu;
