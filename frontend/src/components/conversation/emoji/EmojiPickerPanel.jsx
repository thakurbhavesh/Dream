import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  ClickAwayListener,
  CircularProgress,
  IconButton,
  Slide,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { PiSmiley, PiX } from "react-icons/pi";
import {
  getEmojiMartLibraryCache,
  loadEmojiMartLibrary,
} from "./emojiMartLoader.js";
import CustomScrollbars from "../../Scrollbar.jsx";
import {
  PiSmileyBold,
  PiPawPrintBold,
  PiBowlFoodBold,
  PiBasketballBold,
  PiAirplaneTiltBold,
  PiLightbulbBold,
  PiTextTBold,
  PiFlagBold,
} from "react-icons/pi";

const CATEGORY_ICON_MAP = {
  people: PiSmileyBold,
  nature: PiPawPrintBold,
  foods: PiBowlFoodBold,
  activity: PiBasketballBold,
  places: PiAirplaneTiltBold,
  objects: PiLightbulbBold,
  symbols: PiTextTBold,
  flags: PiFlagBold,
};

const TWEMOJI_BASE_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/";
const isFlagEmoji = (emoji) =>
  Boolean(
    emoji?.shortName?.startsWith("flag-") &&
      typeof emoji.unified === "string" &&
      emoji.unified.length
  );
const buildTwemojiUrl = (unified = "") =>
  `${TWEMOJI_BASE_URL}${unified.toLowerCase()}.svg`;

// Kick off emoji data loading as soon as this module is evaluated so the panel
// can animate immediately when opened.
if (typeof window !== "undefined") {
  loadEmojiMartLibrary().catch(() => {
    // Errors are handled later when the component attempts to render.
  });
}

const EmojiGlyph = ({ emoji }) => {
  const [flagImageFailed, setFlagImageFailed] = useState(false);
  const shouldShowFlagImage = isFlagEmoji(emoji) && !flagImageFailed;

  if (shouldShowFlagImage) {
    return (
      <Box
        component="img"
        src={buildTwemojiUrl(emoji.unified)}
        alt={emoji.shortName || emoji.native}
        loading="lazy"
        sx={{ width: 22, height: 22, objectFit: "contain" }}
        onError={() => setFlagImageFailed(true)}
      />
    );
  }

  return (
    <Box component="span" sx={{ fontSize: 22, lineHeight: 1 }}>
      {emoji.native}
    </Box>
  );
};

EmojiGlyph.propTypes = {
  emoji: PropTypes.shape({
    unified: PropTypes.string.isRequired,
    native: PropTypes.string.isRequired,
    shortName: PropTypes.string,
  }).isRequired,
};

const EmojiGrid = ({ emojis, onSelect }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(40px, 0fr))",
      gap: 1,
      height: "100%",
      alignItems: "start",
      
    }}
  >
    {emojis.map((emoji) => (
      <IconButton
        key={emoji.unified}
        size="small"
        onClick={() => onSelect(emoji.native)}
        sx={{
          borderRadius: 99,
          height: 40,
          width: 40,
          overflow: "hidden",
          "&:hover": {
            backgroundColor: "action.hover",
          },
        }}
      >
        <EmojiGlyph emoji={emoji} />
      </IconButton>
    ))}
  </Box>
);

EmojiGrid.propTypes = {
  emojis: PropTypes.arrayOf(
    PropTypes.shape({
      unified: PropTypes.string.isRequired,
      native: PropTypes.string.isRequired,
    })
  ).isRequired,
  onSelect: PropTypes.func.isRequired,
};

const StaticEmojiSection = ({ categories, emojiList, onSelect }) => {
  const [searchValue, setSearchValue] = useState("");
  const [activeCategory, setActiveCategory] = useState(
    categories[0]?.id ?? ""
  );
  const normalizedQuery = searchValue.trim().toLowerCase();

  useEffect(() => {
    if (!categories.length) return;
    setActiveCategory((current) => {
      if (current && categories.some((category) => category.id === current)) {
        return current;
      }
      return categories[0].id;
    });
  }, [categories]);

  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [];
    return emojiList
      .filter((emoji) => {
        const inName = emoji.name?.toLowerCase().includes(normalizedQuery);
        const inShort = emoji.shortName
          ?.toLowerCase()
          .includes(normalizedQuery);
        const inKeywords = emoji.keywords?.some((keyword) =>
          keyword.toLowerCase().includes(normalizedQuery)
        );
        return inName || inShort || inKeywords;
      })
      .slice(0, 200);
  }, [emojiList, normalizedQuery]);

  const categoryEmojis = useMemo(() => {
    if (normalizedQuery) return searchResults;
    return (
      categories.find((category) => category.id === activeCategory)
        ?.emojiItems ?? categories[0]?.emojiItems ?? []
    );
  }, [activeCategory, categories, normalizedQuery, searchResults]);

  return (
    <Stack spacing={1}>
      <TextField
        fullWidth
        variant="outlined"
        size="small"
        value={searchValue}
        onChange={(event) => setSearchValue(event.target.value)}
        placeholder="Search emojis"
      />
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap:1,
          overflowX: "auto",
          pb: 0.75,
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {categories.map((category) => {
          const isActive = category.id === activeCategory;
          const CategoryIcon =
            CATEGORY_ICON_MAP[category.id] || PiSmileyBold;
          return (
            <IconButton
              key={category.id}
              onClick={() => {
                setActiveCategory(category.id);
                setSearchValue("");
              }}
              title={category.name}
              sx={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "1px solid",
                borderColor: isActive ? "primary.main" : "divider",
                color: isActive ? "primary.main" : "text.secondary",
                backgroundColor: (theme) =>
                  isActive
                    ? alpha(theme.palette.primary.main, 0.15)
                    : "transparent",
                fontSize: 18,
                transition: "all 0.15s ease",
                position: "relative",
                "&:hover": {
                  backgroundColor: (theme) =>
                    alpha(theme.palette.primary.main, 0.12),
                  borderColor: "primary.main",
                },
                "&::after": {
                  content: '""',
                  position: "absolute",
                  bottom: -6,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: isActive ? 14 : 0,
                  height: 2,
                  borderRadius: 2,
                  backgroundColor: "primary.main",
                  transition: "width 0.15s ease",
                },
              }}
            >
              <CategoryIcon size={18} />
            </IconButton>
          );
        })}
      </Box>
      <CustomScrollbars
        style={{ height: 180, maxHeight: 200, width: "100%" }}
        renderTrackHorizontal={(props) => (
          <div {...props} style={{ display: "none" }} />
        )}
        renderThumbHorizontal={(props) => (
          <div {...props} style={{ display: "none" }} />
        )}
      >
        {categoryEmojis.length ? (
          <EmojiGrid emojis={categoryEmojis} onSelect={onSelect} />
        ) : (
          <Typography variant="body2" color="text.secondary">
            No emojis match your search.
          </Typography>
        )}
      </CustomScrollbars>
    </Stack>
  );
};

StaticEmojiSection.propTypes = {
  categories: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      emojiItems: PropTypes.arrayOf(
        PropTypes.shape({
          unified: PropTypes.string.isRequired,
          native: PropTypes.string.isRequired,
        })
      ),
    })
  ).isRequired,
  emojiList: PropTypes.arrayOf(
    PropTypes.shape({
      unified: PropTypes.string.isRequired,
      native: PropTypes.string.isRequired,
    })
  ).isRequired,
  onSelect: PropTypes.func.isRequired,
};

const EmojiPickerPanel = ({ open, onClose, onSelectEmoji }) => {
  const theme = useTheme();
  const initialPayload = useMemo(() => getEmojiMartLibraryCache(), []);
  const [emojiPayload, setEmojiPayload] = useState(initialPayload);
  const [loading, setLoading] = useState(!initialPayload);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (emojiPayload) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadEmojiMartLibrary()
      .then((payload) => {
        if (cancelled) return;
        setEmojiPayload(payload);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[EmojiPickerPanel] Failed to load emojis", error);
        setLoadError("Unable to load emojis");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [emojiPayload]);

  const emojiCategories = emojiPayload?.categories ?? [];
  const emojiList = emojiPayload?.emojis ?? [];

  return (
    <Slide
      direction="up"
      in={open}
      timeout={{ enter: 200, exit: 180 }}
      mountOnEnter
      unmountOnExit={false}
    >
      <Box
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "95%",
          width: "100%",
          mx: "auto",
          zIndex: 20,
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <ClickAwayListener
          onClickAway={onClose}
          mouseEvent={open ? "onMouseDown" : false}
          touchEvent={open ? "onTouchStart" : false}
        >
          <Box
            sx={{
              width: "100%",
              borderRadius: 0,
              bgcolor: theme.palette.background.paper,
              borderTop: `1px solid ${theme.palette.divider}`,
              p: 1,
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              mb={1.5}
              justifyContent="space-between"
            >
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 600, display: "flex", alignItems: "center" }}
                color="text.primary"
              >
                <PiSmiley size={16} style={{ marginRight: 8 }} />
                TeamChatx
              </Typography>
              <IconButton size="small" sx={{ ml: "auto" }} onClick={onClose}>
                <PiX size={16} />
              </IconButton>
            </Stack>

            {open ? (
              loading ? (
                <Stack
                  spacing={1}
                  alignItems="center"
                  justifyContent="center"
                  sx={{ py: 4 }}
                >
                  <CircularProgress size={24} />
                  <Typography variant="body2" color="text.secondary">
                    Loading emoji library...
                  </Typography>
                </Stack>
              ) : loadError ? (
                <Typography variant="body2" color="error">
                  {loadError}
                </Typography>
              ) : emojiPayload ? (
                <StaticEmojiSection
                  categories={emojiCategories}
                  emojiList={emojiList}
                  onSelect={(emoji) => {
                    onSelectEmoji?.(emoji);
                  }}
                />
              ) : null
            ) : null}
          </Box>
        </ClickAwayListener>
      </Box>
    </Slide>
  );
};

EmojiPickerPanel.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onSelectEmoji: PropTypes.func,
};

export default EmojiPickerPanel;
