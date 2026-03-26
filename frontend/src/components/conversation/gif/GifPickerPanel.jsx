import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  CircularProgress,
  ClickAwayListener,
  IconButton,
  InputAdornment,
  Slide,
  TextField,
  Typography,
} from "@mui/material";
import { PiMagnifyingGlassBold, PiXBold } from "react-icons/pi";
import { searchGifs, fetchTrendingGifs } from "../../../services/chatApi.js";

const GifPickerPanel = ({ open, onClose, onSelect, anchorEl }) => {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  // Load trending on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchTrendingGifs({ limit: 30 })
      .then((data) => setGifs(data.gifs || []))
      .catch(() => setGifs([]))
      .finally(() => setLoading(false));
  }, [open]);

  const handleSearch = useCallback((q) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      fetchTrendingGifs({ limit: 30 })
        .then((data) => setGifs(data.gifs || []))
        .catch(() => setGifs([]));
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchGifs(q.trim(), { limit: 30 });
        setGifs(data.gifs || []);
      } catch {
        setGifs([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  const handleSelect = (gif) => {
    onSelect?.({
      gifUrl: gif.gifUrl,
      previewUrl: gif.previewUrl,
      width: gif.width,
      height: gif.height,
      title: gif.title,
      source: "tenor",
    });
    onClose?.();
  };

  if (!open) return null;

  return (
    <ClickAwayListener onClickAway={onClose}>
      <Slide direction="up" in={open} mountOnEnter unmountOnExit>
        <Box
          sx={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            right: 0,
            zIndex: 1300,
            bgcolor: "background.paper",
            borderRadius: "12px 12px 0 0",
            boxShadow: 8,
            maxHeight: 380,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <Box sx={{ px: 1.5, pt: 1, pb: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 600 }}>
              GIFs
            </Typography>
            <IconButton size="small" onClick={onClose}>
              <PiXBold size={16} />
            </IconButton>
          </Box>

          {/* Search */}
          <Box sx={{ px: 1.5, pb: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search GIFs..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PiMagnifyingGlassBold size={16} />
                  </InputAdornment>
                ),
              }}
              sx={{ "& .MuiInputBase-root": { borderRadius: 2 } }}
            />
          </Box>

          {/* Grid */}
          <Box
            sx={{
              flex: 1,
              overflow: "auto",
              px: 1,
              pb: 1,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 0.5,
              alignContent: "start",
            }}
          >
            {loading && (
              <Box sx={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            )}
            {!loading && gifs.length === 0 && (
              <Box sx={{ gridColumn: "1 / -1", textAlign: "center", py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  {query ? "No GIFs found" : "No trending GIFs"}
                </Typography>
              </Box>
            )}
            {!loading &&
              gifs.map((gif) => (
                <Box
                  key={gif.id}
                  onClick={() => handleSelect(gif)}
                  sx={{
                    cursor: "pointer",
                    borderRadius: 1,
                    overflow: "hidden",
                    "&:hover": { opacity: 0.8 },
                    height: 100,
                  }}
                >
                  <img
                    src={gif.previewUrl || gif.gifUrl}
                    alt={gif.title || "GIF"}
                    loading="lazy"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </Box>
              ))}
          </Box>

          {/* Tenor attribution */}
          <Box sx={{ textAlign: "center", py: 0.5, fontSize: 10, color: "text.secondary" }}>
            Powered by Tenor
          </Box>
        </Box>
      </Slide>
    </ClickAwayListener>
  );
};

export default GifPickerPanel;
