import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  Button,
  TextField,
  useTheme,
} from "@mui/material";
import useSettings from "../../../hooks/useSettings";

const colorInputStyles = {
  width: 42,
  height: 42,
  border: "none",
  padding: 0,
  cursor: "pointer",
  borderRadius: "10%",
  backgroundColor: "transparent",
  appearance: "none",
};

const helperTextStyles = {
  fontSize: 11,
  lineHeight: 1.4,
};

const HEX_FULL_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export default function SettingBrandColorPicker() {
  const theme = useTheme();
  const { customPrimaryColor, onUpdateCustomPrimary } = useSettings();
  const fallbackColor = theme.palette.primary.main.toUpperCase();
  const currentColor = (customPrimaryColor || fallbackColor)
    .toString()
    .toUpperCase();

  const [draftColor, setDraftColor] = useState(currentColor);
  const [hexInput, setHexInput] = useState(currentColor);

  useEffect(() => {
    setDraftColor(currentColor);
    setHexInput(currentColor);
  }, [currentColor]);

  const handleColorChange = (event) => {
    const next = (event.target.value || "").toUpperCase();
    setDraftColor(next);
    setHexInput(next);
  };

  const handleHexInputChange = (event) => {
    const raw = event.target.value ?? "";
    let sanitized = raw.replace(/[^0-9a-fA-F#]/g, "");

    if (!sanitized.startsWith("#")) {
      sanitized = `#${sanitized}`;
    }

    sanitized = sanitized.slice(0, 7);
    const upper = sanitized.toUpperCase();

    setHexInput(upper);

    if (HEX_FULL_PATTERN.test(upper)) {
      setDraftColor(upper);
    }
  };

  const handleApply = () => {
    if (!draftColor || !HEX_FULL_PATTERN.test(draftColor)) {
      return;
    }

    onUpdateCustomPrimary(draftColor);
  };

  const pending =
    draftColor &&
    currentColor &&
    draftColor.toLowerCase() !== currentColor.toLowerCase();
  const isApplyDisabled = !pending || !HEX_FULL_PATTERN.test(draftColor);
  const displayHex = useMemo(
    () => (HEX_FULL_PATTERN.test(hexInput) ? hexInput : draftColor),
    [hexInput, draftColor]
  );

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          component="input"
          type="color"
          value={displayHex}
          onChange={handleColorChange}
          sx={colorInputStyles}
          aria-label="Select custom brand color"
        />
        <TextField
          label="HEX value"
          size="small"
          value={hexInput}
          onChange={handleHexInputChange}
          inputProps={{ maxLength: 7 }}
          sx={{ maxWidth: "100%", width: 160 }}
        />
      </Stack>

        <Button
          variant="contained"
          size="small"
          onClick={handleApply}
          disabled={isApplyDisabled}
          sx={{ alignSelf: "flex-center" }}
        >
          Apply
        </Button>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={helperTextStyles}
      >
        Pick a color or enter a HEX code, then press Apply to preview the brand
        theme safely.
      </Typography>
    </Stack>
  );
}
