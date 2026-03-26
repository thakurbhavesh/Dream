import { Box } from "@mui/material";

const GifMsg = ({ message }) => {
  const meta = message?.metadata || message?.content || {};
  const gifUrl = meta.gifUrl || meta.fileUrl || meta.file_url || "";
  const previewUrl = meta.previewUrl || gifUrl;

  if (!gifUrl) return null;

  return (
    <Box
      sx={{
        maxWidth: 320,
        borderRadius: 1,
        overflow: "hidden",
        cursor: "pointer",
      }}
    >
      <img
        src={gifUrl}
        alt={meta.title || "GIF"}
        loading="lazy"
        style={{
          width: "100%",
          maxHeight: 280,
          objectFit: "contain",
          display: "block",
        }}
        onError={(e) => {
          if (previewUrl && e.target.src !== previewUrl) {
            e.target.src = previewUrl;
          }
        }}
      />
      <Box
        sx={{
          fontSize: 10,
          color: "text.secondary",
          textAlign: "right",
          px: 0.5,
          py: 0.25,
          opacity: 0.6,
        }}
      >
        via Tenor
      </Box>
    </Box>
  );
};

export default GifMsg;
