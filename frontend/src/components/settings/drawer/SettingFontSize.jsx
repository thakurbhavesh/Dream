import { FormControlLabel, Radio, RadioGroup, Stack, Typography, useTheme } from "@mui/material";
import useSettings from "../../../hooks/useSettings";

const FONT_SIZE_OPTIONS = [
  { label: "Small", value: "90%" },
  { label: "Normal", value: "100%" },
  { label: "Large", value: "110%" },
];

export default function SettingFontSize() {
  const { fontSize, onChangeFontSize } = useSettings();
  const theme = useTheme();

  return (
    <RadioGroup name="appFontSize" value={fontSize} onChange={onChangeFontSize}>
      <Stack spacing={0}>
        {FONT_SIZE_OPTIONS.map((size) => (
          <FormControlLabel
            key={size.value}
            value={size.value}
            control={<Radio size="small" />}
            sx={{ alignItems: "flex-center", m: 0 }}
            label={
              <Typography
                variant="body2"
                color={theme.palette.text.primary}
                sx={{ fontSize: size.value }}
              >
                {size.label}
              </Typography>
            }
          />
        ))}
      </Stack>
    </RadioGroup>
  );
}
