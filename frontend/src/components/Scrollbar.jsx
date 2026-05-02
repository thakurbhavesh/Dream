import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Scrollbars } from "react-custom-scrollbars-2";
import { useTheme } from "@mui/material/styles";

const CustomScrollbars = forwardRef(
  ({ children, onScroll, onUpdate, style, ...rest }, ref) => {
    const theme = useTheme();
    const scrollbarRef = useRef(null);
    useImperativeHandle(ref, () => ({
      // Accepts optional pixel position. Without an argument this behaves like
      // the library's scrollToTop (goes to 0). With a number, it forwards to
      // scrollTop(n) so callers can anchor the scroll at an exact position —
      // this is what `useStickyScroll` relies on to preserve the user's
      // reading position when older messages are prepended.
      scrollToTop: (top) => {
        const sb = scrollbarRef.current;
        if (!sb) return;
        if (typeof top === "number" && Number.isFinite(top)) {
          sb.scrollTop(top);
        } else {
          sb.scrollToTop();
        }
      },
      scrollToBottom: () => scrollbarRef.current?.scrollToBottom(),
      getScrollTop: () => scrollbarRef.current?.getScrollTop(),
      getScrollHeight: () => scrollbarRef.current?.getScrollHeight(),
      getClientHeight: () => scrollbarRef.current?.getClientHeight(),
      getView: () => scrollbarRef.current?.view ?? null,
    }));

    return (
      <Scrollbars
        ref={scrollbarRef}
        onScrollFrame={(values) => {
          if (onScroll) {
            onScroll(values?.scrollTop ?? 0, values);
          }
        }}
        onUpdate={(values) => {
          if (onUpdate) {
            onUpdate(values);
          }
        }}
        autoHide
        autoHideDuration={1000}
        autoHideTimeout={500}
        style={{ height: "100%", ...style }}
        {...rest}
        renderTrackVertical={({ style: trackStyle, ...props }) => (
          <div
            {...props}
            style={{
              ...trackStyle,
              backgroundColor:
                theme.palette.mode === "light" ? "#f0f0f0" : "#3c3c3c",
              width: "6px",
              right: "0px",
              position: "absolute",
              bottom: "0px",
              top: "0px",
            }}
          />
        )}
        renderThumbVertical={({ style: thumbStyle, ...props }) => (
          <div
            {...props}
            style={{
              ...thumbStyle,
              backgroundColor: theme.palette.primary.main,
              borderRadius: "2px",
              width: "6px",
            }}
          />
        )}
      >
        {children}
      </Scrollbars>
    );
  }
);

export default CustomScrollbars;
