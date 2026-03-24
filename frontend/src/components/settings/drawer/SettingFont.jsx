import { useState } from "react";
import { FormControlLabel, Radio, RadioGroup, Stack, Typography, Button, useTheme } from "@mui/material";
import useSettings from "../../../hooks/useSettings";

const FONT_OPTIONS = [
  { label: "SF Display (Default)", value: "San Francisco Display" },
  { label: "Poppins", value: "Poppins" },
  { label: "Noto Sans", value: "Noto Sans" },
  { label: "Merriweather", value: "Merriweather" },
  { label: "Karla", value: "Karla" },
];

export default function SettingFont() {
  const { fontType, onChangeFont } = useSettings();
  const [showMore, setShowMore] = useState(false);

  const visibleFonts = showMore ? FONT_OPTIONS : FONT_OPTIONS.slice(0, 3);
  const hasMore = FONT_OPTIONS.length > 3;

  const theme = useTheme();
  return (
    <RadioGroup name="appFontFamily" value={fontType} onChange={onChangeFont}>
      <Stack spacing={0}>
        {visibleFonts.map((font) => (
          <FormControlLabel
            key={font.value}
            value={font.value}
            control={<Radio size="small" />}
            sx={{ alignItems: "flex-center", m: 0 }}
            label={
              <Stack spacing={0.25}>
                <Typography variant="body2" color={theme.palette.text.primary}>{font.label}</Typography>
                
              </Stack>
            }
          />
        ))}
      </Stack>
      {hasMore && (
        <Button
          size="small"
          variant="text"
          onClick={() => setShowMore((prev) => !prev)}
          sx={{ mt: 1 }}
        >
          {showMore ? "Show less" : "More fonts"}
        </Button>
      )}
    </RadioGroup>
  );
}
