import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";

/**
 * Transparent canvas overlay on top of the screen share video.
 * Handles local drawing and renders remote annotations + pointer.
 */
const AnnotationCanvas = ({
  active,
  tool = "pen",
  color = "#FF0000",
  width = 3,
  onSendAnnotation,
  onSendPointer,
  remoteAnnotations = [],
  remotePointer,
  videoRef,
}) => {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef([]);
  const allStrokesRef = useRef([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Sync canvas size with video element
  useEffect(() => {
    const video = videoRef?.current;
    if (!video) return;

    const syncSize = () => {
      const rect = video.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(video);

    return () => observer.disconnect();
  }, [videoRef]);

  // Apply canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.width === 0) return;
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    redraw();
  }, [canvasSize]);

  // Redraw all strokes (local + remote)
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const allStrokes = [...allStrokesRef.current, ...remoteAnnotations];

    for (const stroke of allStrokes) {
      if (!stroke.points || stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color || "#FF0000";
      ctx.lineWidth = stroke.width || 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (stroke.type === "highlight") {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = (stroke.width || 3) * 4;
      } else {
        ctx.globalAlpha = 1;
      }

      const points = stroke.points;
      ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * canvas.width, points[i].y * canvas.height);
      }

      if (stroke.type === "rect" && points.length >= 2) {
        const x1 = points[0].x * canvas.width;
        const y1 = points[0].y * canvas.height;
        const x2 = points[points.length - 1].x * canvas.width;
        const y2 = points[points.length - 1].y * canvas.height;
        ctx.clearRect(0, 0, 0, 0); // reset path
        ctx.beginPath();
        ctx.rect(x1, y1, x2 - x1, y2 - y1);
      }

      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Draw current in-progress stroke
    if (isDrawingRef.current && currentStrokeRef.current.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = tool === "highlight" ? width * 4 : width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = tool === "highlight" ? 0.35 : 1;

      const pts = currentStrokeRef.current;
      ctx.moveTo(pts[0].x * canvas.width, pts[0].y * canvas.height);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * canvas.width, pts[i].y * canvas.height);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Draw remote pointer
    if (remotePointer && remotePointer.x != null) {
      const px = remotePointer.x * canvas.width;
      const py = remotePointer.y * canvas.height;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(59, 130, 246, 0.7)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#3B82F6";
      ctx.fill();

      if (remotePointer.name) {
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#3B82F6";
        ctx.fillText(remotePointer.name, px + 12, py + 4);
      }
    }
  }, [remoteAnnotations, remotePointer, color, width, tool]);

  // Redraw whenever remote data changes
  useEffect(() => {
    redraw();
  }, [redraw]);

  // Get normalized coordinates from mouse event
  const getNormalizedPos = useCallback(
    (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    },
    []
  );

  const handleMouseDown = useCallback(
    (e) => {
      if (!active || tool === "pointer") return;
      e.preventDefault();
      isDrawingRef.current = true;
      const pos = getNormalizedPos(e);
      if (pos) {
        currentStrokeRef.current = [pos];
      }
    },
    [active, tool, getNormalizedPos]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!active) return;

      // Pointer tool — send position
      if (tool === "pointer") {
        const pos = getNormalizedPos(e);
        if (pos) onSendPointer?.(pos);
        return;
      }

      if (!isDrawingRef.current) return;
      const pos = getNormalizedPos(e);
      if (pos) {
        currentStrokeRef.current.push(pos);
        redraw();
      }
    },
    [active, tool, getNormalizedPos, onSendPointer, redraw]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (currentStrokeRef.current.length >= 2) {
      const stroke = {
        type: tool,
        points: [...currentStrokeRef.current],
        color,
        width,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
      allStrokesRef.current.push(stroke);
      onSendAnnotation?.(stroke);
    }
    currentStrokeRef.current = [];
    redraw();
  }, [tool, color, width, onSendAnnotation, redraw]);

  const handleMouseLeave = useCallback(() => {
    if (isDrawingRef.current) {
      handleMouseUp();
    }
    if (tool === "pointer") {
      onSendPointer?.(null);
    }
  }, [handleMouseUp, tool, onSendPointer]);

  return (
    <Box
      ref={overlayRef}
      sx={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: canvasSize.width || "100%",
        height: canvasSize.height || "100%",
        pointerEvents: active ? "auto" : "none",
        cursor: active
          ? tool === "pointer"
            ? "crosshair"
            : "crosshair"
          : "default",
        zIndex: 1,
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
    </Box>
  );
};

export default React.memo(AnnotationCanvas);
