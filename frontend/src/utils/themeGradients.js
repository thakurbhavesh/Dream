import { alpha, darken, lighten } from "@mui/material/styles";

/**
 * Build a surface gradient that harmonises with the current primary palette.
 * Generates lighter tints in light mode and richer tones in dark mode.
 */
export const buildSurfaceGradient = (theme) => {
  const primary = theme.palette.primary.main;

  if (theme.palette.mode === "light") {
    const start = alpha(lighten(primary, 0.72), 0.35);
    const end = alpha(lighten(primary, 0.45), 0.5);
    return `linear-gradient(120deg, ${start} 0%, ${end} 100%)`;
  }

  const start = alpha(darken(primary, 0.2), 0.2);
  const mid = alpha(darken(primary, 0.2), 0.2);
  const end = alpha(primary, 0.45);
  return `linear-gradient(140deg, ${start} 0%, ${mid} 55%, ${end} 100%)`;
};

export default {
  buildSurfaceGradient,
};
