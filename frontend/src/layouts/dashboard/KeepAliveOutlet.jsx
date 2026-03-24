import React, { useEffect, useMemo, useReducer, useRef } from "react";
import PropTypes from "prop-types";
import { Box } from "@mui/material";
import { matchPath, useLocation, useOutlet } from "react-router-dom";

/**
 * Keeps specified route outlets mounted so their React state persists across navigation.
 */
const KeepAliveOutlet = ({ keepAlivePaths = [], containerSx = {}, cacheLimit = 5 }) => {
  const location = useLocation();
  const outlet = useOutlet();
  const cacheRef = useRef(new Map());
  const [, forceRender] = useReducer((count) => count + 1, 0);

  const activeKey = useMemo(() => {
    for (const pattern of keepAlivePaths) {
      if (matchPath({ path: pattern, end: true }, location.pathname)) {
        return pattern;
      }
    }
    return null;
  }, [keepAlivePaths, location.pathname]);

  useEffect(() => {
    if (!activeKey || !outlet) return;
    const locationKey = location.key || location.pathname;
    const cachedEntry = cacheRef.current.get(activeKey);
    if (cachedEntry?.locationKey === locationKey) return;

    cacheRef.current.set(activeKey, { element: outlet, locationKey });
    if (cacheRef.current.size > cacheLimit) {
      const keys = Array.from(cacheRef.current.keys());
      while (cacheRef.current.size > cacheLimit) {
        const oldest = keys.shift();
        if (!oldest || oldest === activeKey) continue;
        cacheRef.current.delete(oldest);
      }
    }
    forceRender();
  }, [activeKey, cacheLimit, location.key, location.pathname, outlet]);

  const shouldRenderLiveOutlet =
    !activeKey || !cacheRef.current.has(activeKey) || !cacheRef.current.get(activeKey)?.element;

  return (
    <>
      {keepAlivePaths.map((path) => {
        const cached = cacheRef.current.get(path);
        if (!cached) return null;
        return (
          <Box
            key={path}
            sx={{
              ...containerSx,
              display: activeKey === path ? containerSx.display ?? "block" : "none",
            }}
          >
            {cached.element}
          </Box>
        );
      })}
      {shouldRenderLiveOutlet && outlet ? (
        <Box
          sx={{
            ...containerSx,
            display: containerSx.display ?? "block",
          }}
        >
          {outlet}
        </Box>
      ) : null}
    </>
  );
};

KeepAliveOutlet.propTypes = {
  keepAlivePaths: PropTypes.arrayOf(PropTypes.string),
  containerSx: PropTypes.object,
  cacheLimit: PropTypes.number,
};

export default KeepAliveOutlet;
