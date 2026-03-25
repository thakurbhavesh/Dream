import React, { useCallback, useEffect, useRef } from "react";
import { Box } from "@mui/material";

/**
 * Transparent layer that captures mouse/keyboard events
 * and relays them via DataChannel when remote control is granted.
 *
 * Note: Browser-based remote control is limited to visual pointer relay.
 * Full OS-level input simulation is only available in Electron via robotjs.
 */
const RemoteControlLayer = ({
  active,
  videoRef,
  sendDataChannelMessage,
}) => {
  const layerRef = useRef(null);

  const getNormalizedPos = useCallback(
    (e) => {
      const video = videoRef?.current;
      if (!video) return null;
      const rect = video.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    },
    [videoRef]
  );

  const send = useCallback(
    (payload) => {
      sendDataChannelMessage?.({ type: "remote-control", payload });
    },
    [sendDataChannelMessage]
  );

  useEffect(() => {
    if (!active) return;
    const layer = layerRef.current;
    if (!layer) return;

    const onMouseMove = (e) => {
      const pos = getNormalizedPos(e);
      if (pos) send({ type: "mousemove", ...pos });
    };

    const onMouseDown = (e) => {
      const pos = getNormalizedPos(e);
      if (pos) send({ type: "mousedown", button: e.button, ...pos });
    };

    const onMouseUp = (e) => {
      const pos = getNormalizedPos(e);
      if (pos) send({ type: "mouseup", button: e.button, ...pos });
    };

    const onClick = (e) => {
      const pos = getNormalizedPos(e);
      if (pos) send({ type: "click", ...pos });
    };

    const onDblClick = (e) => {
      const pos = getNormalizedPos(e);
      if (pos) send({ type: "dblclick", ...pos });
    };

    const onKeyDown = (e) => {
      e.preventDefault();
      send({
        type: "keydown",
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      });
    };

    const onKeyUp = (e) => {
      e.preventDefault();
      send({ type: "keyup", key: e.key, code: e.code });
    };

    const onWheel = (e) => {
      send({ type: "scroll", deltaX: e.deltaX, deltaY: e.deltaY });
    };

    layer.addEventListener("mousemove", onMouseMove);
    layer.addEventListener("mousedown", onMouseDown);
    layer.addEventListener("mouseup", onMouseUp);
    layer.addEventListener("click", onClick);
    layer.addEventListener("dblclick", onDblClick);
    layer.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Focus the layer so keyboard events work
    layer.focus();

    return () => {
      layer.removeEventListener("mousemove", onMouseMove);
      layer.removeEventListener("mousedown", onMouseDown);
      layer.removeEventListener("mouseup", onMouseUp);
      layer.removeEventListener("click", onClick);
      layer.removeEventListener("dblclick", onDblClick);
      layer.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [active, getNormalizedPos, send]);

  if (!active) return null;

  return (
    <Box
      ref={layerRef}
      tabIndex={0}
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2,
        cursor: "default",
        outline: "none",
        // Visual indicator that remote control is active
        border: "2px solid",
        borderColor: "success.main",
        borderRadius: 0,
        pointerEvents: "auto",
      }}
    />
  );
};

export default React.memo(RemoteControlLayer);
