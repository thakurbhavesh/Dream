// src/layouts/auth/AuthSplitLayout.jsx
import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { alpha, useTheme } from "@mui/material/styles";
import { Box, Grid, Paper, Stack, Typography } from "@mui/material";
import FeatureSlider from "../../components/auth/FeatureSlider";
import { appBrandingAssets } from "../../data/CommonData";
import { useSiteBranding } from "../../contexts/SiteBrandingContext.jsx";

const AuthSplitLayout = ({
  title,
  subtitle,
  children,
  footer,
  sliderSlides,
  sliderInterval,
}) => {
  const theme = useTheme();
  const { brandName, mascotUrl, logoUrl } = useSiteBranding();
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setIsElectron(Boolean(window?.electron?.isElectron));
  }, []);

  const mascotSrc = mascotUrl || logoUrl || appBrandingAssets.mascot;
  const displayBrand = brandName || appBrandingAssets.brand;
  return (
    <Box
      sx={{
        minHeight: isElectron && "100vh",
        bgcolor: "background.default",
      }}
    >
      {isElectron && (
        <Box
          sx={{
            height: "36px",
            bgcolor: theme.palette.primary.main,
            color: theme.palette.common.white,
            fontWeight: 500,
            fontSize: "12px",
            letterSpacing: 2,
            display: "flex",
            alignItems: "center",
            px: 2,
            textTransform: "uppercase",
            WebkitAppRegion: "drag",
          }}
        >
          AABHYASA ENTERPRISE BUILD
        </Box>
      )}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 2,
          overflow: "hidden",
          border: (t) => `1px solid ${alpha(t.palette.grey[300], 0.5)}`,
          height: isElectron ?`calc(100vh - 55px)` : `calc(100vh - 16px)`,
          m: 1,
        }}
      >
        <Grid
          container
          height="100%"
          sx={{ overflow: "auto", flexDirection: { md: "column", lg: "row" } }}
        >
          <Grid item xs={12} md={6} flex={1} m={"auto"}>
            <Stack
              spacing={3}
              sx={{
                maxWidth: "600px",
                py: { xs: 5, sm: 6, xl: 8 },
                px: { xs: 5, sm: 6, xl: 8 },
                mx: "auto",
              }}
            >
              <Stack spacing={4}>
                <Stack spacing={1} direction="row" alignItems="center">
                  <Box
                    sx={{
                      height: "60px",
                      minHeight: "60px",
                      width: "60px",
                      borderRadius: "8px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor:
                        theme.palette.mode === "dark"
                          ? "rgba(255, 255, 255, 0.8)"
                          : "",
                      boxShadow:
                        theme.palette.mode === "dark"
                          ? "inset 0 0 0 1px rgba(255, 255, 255, 0.12)"
                          : "",
                      padding: "4px 8px",
                    }}
                  >
                    <img
                      src={mascotSrc}
                      alt={displayBrand}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                    />
                  </Box>
                  <Typography
                    variant="h5"
                    color={
                      theme.palette.mode === "light"
                        ? theme.palette.primary.main
                        : theme.palette.text.primary
                    }
                    fontWeight={600}
                  >
                    {displayBrand}
                  </Typography>
                </Stack>
                <Stack spacing={1}>
                  <Typography
                    variant="h4"
                    color="text.primary"
                    fontWeight={600}
                  >
                    {title}
                  </Typography>
                  {subtitle ? (
                    <Typography variant="body2" color="text.secondary">
                      {subtitle}
                    </Typography>
                  ) : null}
                </Stack>
              </Stack>

              <Box>{children}</Box>

              {footer ? footer : null}
            </Stack>
          </Grid>

          <Grid
            item
            xs={12}
            md={6}
            sx={{
              bgcolor: theme.palette.secondary.main,
              color: theme.palette.common.white,
            }}
            flex={1}
          >
            <Box
              sx={{
                height: "100%",
                background: theme.palette.primary.main,
                px: { xs: 3, sm: 6 },
                py: { xs: 5, sm: 6, md: 8 },
                display: "flex",
                flexDirection: "column",
                gap: 4,
                justifyContent: "center",
              }}
            >
              <FeatureSlider slides={sliderSlides} interval={sliderInterval} />
              <Stack
                spacing={1}
                maxWidth={"420px"}
                mx={"auto"}
                textAlign={"center"}
              >
                <Typography variant="h5" color="inherit">
                  Welcome to {displayBrand}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  Sign in to explore the latest updates and insights we have
                  rolled out for your teams.
                </Typography>
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

AuthSplitLayout.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  children: PropTypes.node.isRequired,
  footer: PropTypes.node,
  highlight: PropTypes.shape({
    label: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
    icon: PropTypes.elementType,
  }),
  sliderSlides: PropTypes.array,
  sliderInterval: PropTypes.number,
};

export default AuthSplitLayout;
