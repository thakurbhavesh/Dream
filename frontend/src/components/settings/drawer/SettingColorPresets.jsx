// @mui
import { useState } from 'react';
import { alpha, styled } from '@mui/material/styles';
import { Box, Grid, RadioGroup, CardActionArea, Button } from '@mui/material';
// hooks
import useSettings from '../../../hooks/useSettings';
//
import BoxMask from './BoxMask';

// ----------------------------------------------------------------------

const BoxStyle = styled(CardActionArea)(({ theme }) => ({
  height: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.text.disabled,
  border: `solid 1px ${theme.palette.grey[500_12]}`,
  borderRadius: Number(theme.shape.borderRadius) * 1.25,
  position: 'relative',
  
}));


// ----------------------------------------------------------------------

export default function SettingColorPresets() {
  const { themeColorPresets, onChangeColor, colorOption } = useSettings();
  const [showMore, setShowMore] = useState(false);
  const chunkPresets = (presets, size) => {
    const chunks = [];
    for (let i = 0; i < presets.length; i += size) {
      chunks.push(presets.slice(i, i + size));
    }
    return chunks;
  };
  const allowedValues = colorOption.map((color) => color.name);
  const radioValue = allowedValues.includes(themeColorPresets)
    ? themeColorPresets
    : "";
  const visiblePresets = showMore
    ? chunkPresets(colorOption, 3)
    : [colorOption.slice(0, 3)];
  const hasMore = colorOption.length > 3;

  return (
    <RadioGroup
      name="themeColorPresets"
      value={radioValue}
      onChange={onChangeColor}
    >
      {visiblePresets.map((row, rowIndex) => (
        <Grid key={`row-${rowIndex}`} dir="ltr" container spacing={1.5} sx={{ mb: rowIndex === visiblePresets.length - 1 ? 0 : 1 }}>
          {row.map((color) => {
            const colorName = color.name;
            const colorValue = color.value;
            const isSelected = radioValue === colorName;

            return (
              <Grid key={colorName} item xs={4} sx={{flex: 1,}}>
                <BoxStyle
                  sx={{
                    ...(isSelected && {
                      bgcolor: alpha(colorValue, 0.08),
                      border: `solid 2px ${colorValue}`,
                      boxShadow: `inset 0 4px 8px 0 ${alpha(colorValue, 0.24)}`,
                      
                    }),
                  }}
                >
                  <Box
                    sx={{
                      width: 24,
                      height: 14,
                      borderRadius: '50%',
                      bgcolor: colorValue,
                      transform: 'rotate(-45deg)',
                      transition: (theme) =>
                        theme.transitions.create('all', {
                          easing: theme.transitions.easing.easeInOut,
                          duration: theme.transitions.duration.shorter,
                        }),
                      ...(isSelected && { transform: 'none' }),
                    }}
                  />
                  <BoxMask value={colorName} />
                </BoxStyle>
              </Grid>
            );
          })}
        </Grid>
      ))}
      {hasMore && (
        <Button
          variant="text"
          size="small"
          onClick={() => setShowMore((prev) => !prev)}
          sx={{ mt: 1 }}
        >
          {showMore ? 'Show less' : 'More colors'}
        </Button>
      )}
    </RadioGroup>
  );
}
