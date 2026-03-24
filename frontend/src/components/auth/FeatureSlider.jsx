// src/components/auth/FeatureSlider.jsx
import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { alpha } from "@mui/material/styles";
import { Box, Stack, Typography } from "@mui/material";
import { AUTH_FEATURE_SLIDES } from "../../data/authHighlights";

const AUTO_INTERVAL = 4500;

const FeatureSlider = ({ slides = AUTH_FEATURE_SLIDES, interval = AUTO_INTERVAL }) => {
  const validSlides = useMemo(
    () => (Array.isArray(slides) && slides.length ? slides : AUTH_FEATURE_SLIDES),
    [slides]
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % validSlides.length);
    }, interval);

    return () => clearInterval(id);
  }, [interval, validSlides.length]);

  const activeSlide = validSlides[index];
  const Icon = activeSlide.icon;
  const meterWidth = Math.min(Math.max(Number(activeSlide.meter ?? 60), 20), 95);

  return (
    <Stack sx={{ width: "100%", maxWidth: 500, mx: "auto" }} spacing={3} alignItems="center">
      <Box
        sx={(theme) => ({
          width: "100%",
          borderRadius: 3,
          p: 3,
          background: alpha(theme.palette.secondary.light, 0.25),
          border: `1px solid ${alpha(theme.palette.common.white, 0.2)}`,
          color: theme.palette.common.white,
          boxShadow: `0 30px 70px ${alpha(theme.palette.common.black, 0.25)}`,
          minHeight: 220,
        })}
      >
        <Stack direction="row" spacing={3} alignItems="center" sx={{ height: "100%" }}>
          <Box
            sx={(theme) => ({
              flexShrink: 0,
              width: 120,
              height: 120,
              borderRadius: "32px",
              background: theme.palette.primary.main,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 20px 45px ${alpha(theme.palette.secondary.darker, 0.45)}`,
            })}
          >
            <Icon size={64} color="white" />
          </Box>

          <Stack spacing={1}>
            <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
              {activeSlide.label}
            </Typography>
            <Typography variant="h3">{activeSlide.title}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.75 }}>
              {activeSlide.description}
            </Typography>


            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {activeSlide.status}
            </Typography>
          </Stack>
        </Stack>
      </Box>

      <Stack direction="row" spacing={1} alignItems="center">
        {validSlides.map((slide, slideIndex) => (
          <Box
            key={slide?.id || `slide-${slideIndex}`}
            sx={(theme) => ({
              width: slideIndex === index ? 28 : 12,
              height: 10,
              borderRadius: 999,
              backgroundColor:
                slideIndex === index
                  ? theme.palette.common.white
                  : alpha(theme.palette.common.white, 0.5),
              transition: "all 240ms ease",
            })}
          />
        ))}
      </Stack>
    </Stack>
  );
};

FeatureSlider.propTypes = {
  slides: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      label: PropTypes.string,
      title: PropTypes.string,
      status: PropTypes.string,
      meter: PropTypes.number,
      description: PropTypes.string,
      icon: PropTypes.elementType,
    })
  ),
  interval: PropTypes.number,
};

export default FeatureSlider;
