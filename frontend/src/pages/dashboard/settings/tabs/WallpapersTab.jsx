import PropTypes from "prop-types";
import { useCallback, useEffect, useState } from "react";
import { Box, Button, Grid, Stack, Typography, useTheme } from "@mui/material";

const WallpapersTab = ({
  wallpapers,
  selectedWallpaper,
  onSelect,
  onUpload,
  onReset,
}) => {
  const fallback = wallpapers[0];
  const selectedId = selectedWallpaper?.id;
  const fallbackId = fallback?.id || null;
  const [pendingId, setPendingId] = useState(
    selectedId || fallbackId
  );
  const candidate =
    wallpapers.find((wallpaper) => wallpaper.id === pendingId) || null;
  const previewUrl =
    candidate?.preview || selectedWallpaper?.url || fallback?.preview;
  const theme = useTheme();

  const handleCustomWallpaperUpload = useCallback(async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await onUpload(file);
    } finally {
      input.value = "";
    }
  }, [onUpload]);

  useEffect(() => {
    if (!selectedId) return;
    setPendingId(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (pendingId || !fallbackId) return;
    setPendingId(fallbackId);
  }, [fallbackId, pendingId]);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Wallpaper
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Preview how your conversations look with different textures.
        </Typography>
      </Box>

      <Stack spacing={3}>
        <Box
          sx={{
            borderRadius: 1,
            height: "calc(100vh - 400px)",
            maxWidth: "80%",
            border: (t) => `1px solid ${t.palette.divider}`,
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
            overflow: "hidden",
            bgcolor: "#fff",
          }}
        >
          <Stack sx={{ height: "100%" }}>
            <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
              {/* Sidebar */}
              <Box
                sx={{
                  width: "30%",
                  bgcolor: "background.paper",
                  borderRight: (t) => `1px solid ${t.palette.divider}`,
                  p: 3,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <Stack spacing={1} mb={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box sx={{ width: 48, height: 24, borderRadius: 0, bgcolor: theme.palette.mode === "light" ? theme.palette.mode === "light" ? "#e3e7f0" : "background.default" : "background.default" }} />
                    <Stack direction="row" spacing={1}>
                      <Box sx={{ width: 42, height: 24, borderRadius: 0, bgcolor: theme.palette.mode === "light" ? theme.palette.mode === "light" ? "#e3e7f0" : "background.default" : "background.default" }} />
                      <Box sx={{ width: 42, height: 24, borderRadius: 0, bgcolor: theme.palette.mode === "light" ? theme.palette.mode === "light" ? "#e3e7f0" : "background.default" : "background.default"}} />
                    </Stack>
                  </Stack>
                  <Box sx={{ height: 30, borderRadius: 0, bgcolor:theme.palette.mode === "light" ? theme.palette.mode === "light" ? "#e3e7f0" : "background.default" : "background.default" }} />
                </Stack>

                {Array.from({ length: 4 }).map((_, index) => (
                  <Stack
                    key={`sidebar-item-${index}`}
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                  >
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        bgcolor: theme.palette.mode === "light" ? theme.palette.mode === "light" ? "#e3e7f0" : "background.default" : "background.default",
                      }}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Box
                        sx={{
                          height: 10,
                          borderRadius: 999,
                          bgcolor: theme.palette.mode === "light" ? "#e3e7f0" : "background.default",
                          mb: 0.6,
                        }}
                      />
                      <Box
                        sx={{
                          height: 8,
                          width: "70%",
                          borderRadius: 999,
                          bgcolor: theme.palette.mode === "light" ? "#eef0f5" : "background.default",
                        }}
                      />
                    </Box>
                  </Stack>
                ))}
              </Box>

              {/* Chat preview */}
              <Box
                sx={{
                  flex: 1,
                  position: "relative",
                  backgroundImage: `url(${previewUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                {/* Top bar */}
                <Box
                  sx={{
                    height: 56,
                    px: 3,
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    borderBottom: (t) => `1px solid ${t.palette.divider}`,
                    bgcolor: "background.paper",
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      bgcolor: "#e4e7ed",
                    }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Box
                      sx={{
                        width: 120,
                        height: 10,
                        borderRadius: 999,
                        bgcolor: "#e0e3eb",
                        mb: 0.8,
                      }}
                    />
                    <Box
                      sx={{
                        width: 80,
                        height: 8,
                        borderRadius: 999,
                        bgcolor: theme.palette.mode === "light" ? "#eef0f5" : "background.default",
                      }}
                    />
                  </Box>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        bgcolor: "#e0e5f2",
                      }}
                    />
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        bgcolor: "#e0e5f2",
                      }}
                    />
                  </Box>
                </Box>

                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    bgcolor: "rgba(255,255,255,0.1)",
                  }}
                />

                <Stack
                  spacing={4}
                  sx={{
                    position: "relative",
                    height: "82%",
                    p: 2,
                    background: "background.paper"
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        bgcolor: "#f3cfc6",
                      }}
                    />
                    <Box
                      sx={{
                        bgcolor: "#f5f9d7",
                        borderRadius: 1,
                        px: 3,
                        py: 1.5,
                        boxShadow: "0 10px 22px rgba(0,0,0,0.06)",
                      }}
                    >
                      <Typography variant="body2" color="#000">
                        Did you ever hang pictures on your wall?
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack
                    direction="row"
                    spacing={1.5}
                    justifyContent="flex-end"
                    alignItems="center"
                  >
                    <Box
                      sx={{
                        bgcolor: "#d6ebff",
                        borderRadius: 1,
                        px: 3,
                        py: 1.5,
                        boxShadow: "0 10px 22px rgba(0,0,0,0.05)",
                        maxWidth: "60%",
                      }}
                    >
                      <Typography variant="body2" color="#000">
                        Ok, I will check and update.
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        bgcolor: "#cde4f7",
                      }}
                    />
                  </Stack>
                </Stack>
                <Box
                  sx={{
                    height: 40,
                    borderTop: (t) => `1px solid ${t.palette.divider}`,
                    bgcolor: "background.paper",
                  }}
                />
              </Box>
            </Box>
          </Stack>
        </Box>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Button variant="contained" component="label">
            Upload custom wallpaper
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={handleCustomWallpaperUpload}
            />
          </Button>
          <Button variant="outlined" onClick={onReset}>
            Remove texture
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        {wallpapers.map((wallpaper) => (
          <Grid
            item
            sm={4}
            md={2}
            key={wallpaper.id}
            flex={1}
            sx={{
                flexBasis: "20%",
                maxWidth: "20%",
            }}
          >
            <Box
              sx={{
                position: "relative",
                "&:hover .apply-control": {
                  opacity: 1,
                  transform: "translate(50%,0)",
                  pointerEvents: "auto",
                },
              }}
            >
              <Box
                onClick={() => setPendingId(wallpaper.id)}
                
                sx={{
                  borderRadius: 1,
                  height: 150,
                  backgroundImage: `url(${wallpaper.preview})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  cursor: "pointer",
                  overflow: "hidden",
                  position: "relative",
                  border: (t) =>
                    wallpaper.id === pendingId
                      ? `2px solid ${t.palette.primary.main}`
                      : `1px solid ${t.palette.divider}`,
                }}
              />
              <Button
                size="small"
                variant="contained"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(wallpaper);
                }}
                className="apply-control"
                sx={{
                  position: "absolute",
                  bottom: 8,
                  right: "50%",
                  opacity: 0,
                  pointerEvents: "none",
                  transform: "translate(50%,6px)",
                  transition: "all 0.2s ease",
                  fontSize: "0.65rem",
                  px: 1.5,
                  py: 0.3,
                }}
                disabled={selectedId === wallpaper.id}
              >
                Apply
              </Button>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
};

WallpapersTab.propTypes = {
  wallpapers: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      preview: PropTypes.string,
    })
  ).isRequired,
  selectedWallpaper: PropTypes.shape({
    id: PropTypes.string,
    url: PropTypes.string,
    type: PropTypes.string,
  }),
  onSelect: PropTypes.func,
  onUpload: PropTypes.func,
  onReset: PropTypes.func,
};

WallpapersTab.defaultProps = {
  selectedWallpaper: undefined,
  onSelect: () => {},
  onUpload: () => {},
  onReset: () => {},
};

export default WallpapersTab;
