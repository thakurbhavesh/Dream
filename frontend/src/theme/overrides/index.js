import React from "react";
import Slide from "@mui/material/Slide";
import { alpha } from "@mui/material/styles";

const SnackbarTransition = React.forwardRef(function SnackbarTransition(props, ref) {
  return React.createElement(Slide, { ...props, direction: "up", ref });
});

export default function componentsOverride(theme) {
  const isLight = theme.palette.mode === "light";
  const focusColor = isLight ? theme.palette.primary.main : theme.palette.common.white;

  return {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          textTransform: "uppercase",
          // lineHeight: 0.75,
        },
        outlined: {
          borderColor: isLight
            ? alpha(theme.palette.primary.main, 0.48)
            : alpha(theme.palette.common.white, 0.48),
          color: isLight ? theme.palette.primary.main : theme.palette.common.white,
          "&:hover": {
            borderColor: isLight
              ? theme.palette.primary.main
              : alpha(theme.palette.common.white, 0.8),
            backgroundColor: isLight
              ? alpha(theme.palette.primary.main, 0.08)
              : alpha(theme.palette.common.white, 0.08),
          },
        },
      },
    },
    MuiTabs: {
      defaultProps: {
        textColor: "inherit",
      },
      styleOverrides: {
        indicator: {
          backgroundColor: isLight ? theme.palette.primary.main : theme.palette.common.white,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: isLight ? theme.palette.text.primary : theme.palette.common.white,
          "&.Mui-focused": {
            color: focusColor,
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: isLight ? theme.palette.text.primary : theme.palette.common.white,
          "&.Mui-selected": {
            color: isLight ? theme.palette.text.primary : theme.palette.common.white,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: focusColor,
          },
          "&.Mui-focused .MuiInputBase-input::placeholder": {
            color: focusColor,
            opacity: 1,
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          width: "100%",
          maxWidth: 500,
          margin: 16,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        list: {
          paddingTop: 0,
          paddingBottom: 0,
        },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within, & .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within":
            {
              outline: "none",
            },
        },
        columnHeaders: {
          backgroundColor: isLight ? theme.palette.grey[100] : theme.palette.grey[900],
          color: isLight ? theme.palette.text.primary : theme.palette.common.white,
          borderBottom: `1px solid ${theme.palette.divider}`,
        },
        columnHeaderTitle: {
          fontWeight: 600,
        },
      },
    },
    MuiSnackbar: {
      defaultProps: {
        TransitionComponent: SnackbarTransition,
        anchorOrigin: { vertical: "top", horizontal: "right" },
      },
    },
  };
}

