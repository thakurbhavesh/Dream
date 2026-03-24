import PropTypes from 'prop-types';
// @mui
import { alpha, styled, useTheme } from '@mui/material/styles';
import { Tooltip, IconButton } from '@mui/material';
// utils
import cssStyles from '../../../utils/cssStyles';
//
import { HiColorSwatch } from "react-icons/hi";

// ----------------------------------------------------------------------

const RootStyle = styled('span')(({ theme }) => ({
  ...cssStyles(theme).bgBlur({ opacity: 0.64 }),

  position: 'relative',
  marginTop: theme.spacing(-3),
  // padding: theme.spacing(0.5),
  zIndex: theme.zIndex.drawer + 2,
  borderRadius: '24px 0 20px 24px',
  
}));

// ----------------------------------------------------------------------

ToggleButton.propTypes = {
  notDefault: PropTypes.bool,
  onToggle: PropTypes.func,
  open: PropTypes.bool,
};

export default function ToggleButton({ notDefault, open, onToggle }) {
  const theme = useTheme()
  return (
    <RootStyle>
      {/* {notDefault && !open && <DotStyle />} */}

      <Tooltip title="Theme Presets" placement="left">
        <IconButton
          color="inherit"
          onClick={onToggle}
          sx={{
            p: 0.8,
            transition: (theme) => theme.transitions.create('all'),
            border:
                  theme.palette.mode === "light"
                    ? "1px solid #bbb"
                    : "1px solid #ddd",
            '&:hover': {
              color: 'primary.main',
              bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.action.hoverOpacity),
            },
          }}
        >
          <HiColorSwatch  size={24} color={theme.palette.mode === "light" ? theme.palette.primary.main : "#fff"} />
        </IconButton>
      </Tooltip>
    </RootStyle>
  );
}


