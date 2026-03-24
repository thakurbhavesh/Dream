import { alpha, IconButton, Popover, Stack, Tooltip } from "@mui/material";
import EmojiMsg from "./messages/EmojiMsg.jsx";
import { DEFAULT_REACTIONS } from "./messages/reactions.js";

const ReactionTray = ({
  open,
  anchorEl,
  anchorPosition,
  onClose,
  onSelect,
  emojis = DEFAULT_REACTIONS,
  containerRef,
}) => {
  const containerNode = containerRef?.current ?? undefined;
  return (
    <Popover
      open={open}
      onClose={onClose}
      anchorEl={anchorEl}
      anchorReference={anchorPosition ? "anchorPosition" : "anchorEl"}
      anchorPosition={
        anchorPosition
          ? { top: anchorPosition.top, left: anchorPosition.left }
          : undefined
      }
      container={containerNode}
      disablePortal={!containerNode}
      transformOrigin={{ horizontal: "center", vertical: "bottom" }}
      slotProps={{
        paper: {
          elevation: 6,
          sx: {
            borderRadius: 16,
            p: 0.5,
            overflow:"hidden",
            backdropFilter: "blur(8px)",
            backgroundColor: (theme) =>
              theme.palette.mode === "light"
                ? alpha(theme.palette.primary.main, 0.1)
                : alpha(theme.palette.primary.main, 0.2),
          },
        },
      }}
      disableAutoFocus
      disableEnforceFocus
    >
      <Stack direction="row" spacing={0.5} alignItems="center">
        {emojis.map((emoji) => (
          <IconButton
            key={emoji?.id || emoji?.emoji || emoji}
            size="small"
            onClick={() => onSelect?.(emoji)}
            sx={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              fontSize: "44px",
              transition: "transform 120ms ease",
              "&:hover": {
                transform: "scale(1.1)",
              },
            }}
          >
            <EmojiMsg emoji={emoji} size={36} />
          </IconButton>
        ))}
      </Stack>
    </Popover>
  );
};

export default ReactionTray;
