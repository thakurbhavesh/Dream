// imageProcessor.js
// Pre-upload image processing — smart format pick, auto-resize, optional
// background removal. Pure browser APIs for the silent path; the
// background-removal model is lazy-imported so the 6 MB ONNX bundle only
// ships when the user actually toggles it.

const MAX_DIMENSION = 1920;          // largest side after auto-resize
const DEFAULT_QUALITY = 0.85;        // JPEG / WebP quality
const SKIP_OPTIMIZE_BELOW = 200 * 1024; // 200 KB — too small to bother with

const isImageMime = (mime = "") => /^image\/(jpeg|png|webp|heic|heif|gif|bmp|tiff)$/i.test(mime);

/** Detect whether a PNG actually uses transparency. */
const hasTransparency = (canvas, ctx) => {
  try {
    const { width, height } = canvas;
    // Sample a small grid so big images don't lock the main thread.
    const step = Math.max(1, Math.floor(Math.min(width, height) / 20));
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        if (pixel[3] < 250) return true;
      }
    }
    return false;
  } catch {
    // CORS / cross-origin images can throw on getImageData — assume opaque.
    return false;
  }
};

/**
 * Resize a source bitmap onto a canvas, preserving aspect ratio.
 * Skips upscaling — only shrinks if either side > MAX_DIMENSION.
 */
const drawResized = (bitmap, max = MAX_DIMENSION) => {
  const { width: sw, height: sh } = bitmap;
  const scale = Math.min(1, max / Math.max(sw, sh));
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  return { canvas, ctx, scaled: scale < 1 };
};

const canvasToFile = (canvas, mime, quality, originalName) =>
  new Promise((resolve, reject) => {
    const target = mime.split("/")[1];
    const newName = (originalName || "image").replace(/\.[^.]+$/, "") + "." + target;
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("Failed to encode image"));
        resolve(new File([blob], newName, { type: mime }));
      },
      mime,
      quality
    );
  });

/**
 * Smart format picker. Honours transparency for PNG, prefers WebP for
 * photo-like images, and forces conversion for HEIC / HEIF (no native
 * browser support).
 */
const pickTargetFormat = ({ originalMime, transparent }) => {
  const mime = (originalMime || "").toLowerCase();
  if (mime === "image/heic" || mime === "image/heif") {
    // Browsers can't display HEIC inline — must convert. Use JPEG (universal).
    return { mime: "image/jpeg", quality: DEFAULT_QUALITY };
  }
  if (mime === "image/gif") {
    // Animated gifs would lose animation if re-encoded — leave them alone.
    return null;
  }
  if (mime === "image/png" && transparent) {
    // Keep transparency. Try WebP (lossless transparent) which is much smaller.
    return { mime: "image/webp", quality: 1.0 };
  }
  // Photos / JPEG / opaque PNG → WebP at high quality (typical 30-60% saving).
  return { mime: "image/webp", quality: DEFAULT_QUALITY };
};

/**
 * Run the optimisation pipeline. Returns the optimised File, or the
 * original File if nothing was worth changing.
 *
 * Silent: caller doesn't show progress UI. Failures (e.g. corrupt image,
 * unsupported codec) fall back to the original file.
 */
export const optimizeImageForUpload = async (file) => {
  if (!file || !isImageMime(file.type)) return file;
  // Tiny images aren't worth the round-trip
  if (Number.isFinite(file.size) && file.size < SKIP_OPTIMIZE_BELOW) {
    if (!/^image\/(heic|heif)$/i.test(file.type)) return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const { canvas, ctx, scaled } = drawResized(bitmap);
    const transparent = (file.type || "").toLowerCase() === "image/png" && hasTransparency(canvas, ctx);
    const target = pickTargetFormat({ originalMime: file.type, transparent });
    if (!target) return file;
    const out = await canvasToFile(canvas, target.mime, target.quality, file.name);
    // If the "optimised" output is unexpectedly bigger (rare, e.g. tiny
    // already-compressed JPEGs), keep the original. Always swap when we
    // had to convert HEIC or actually shrunk dimensions.
    const mustConvert = scaled || /^image\/(heic|heif)$/i.test(file.type);
    if (!mustConvert && out.size >= file.size) return file;
    return out;
  } catch (err) {
    console.warn("[imageProcessor] optimisation skipped:", err?.message);
    return file;
  }
};

/**
 * Remove the background from an image using the @imgly/background-removal
 * model. Lazy-imports the ~6 MB lib so it only ships when the user
 * actually requests this feature. Returns a transparent PNG File.
 */
export const removeImageBackground = async (file) => {
  if (!file || !isImageMime(file.type)) return file;
  // Dynamic import keeps the model out of the initial bundle.
  const mod = await import("@imgly/background-removal").catch((err) => {
    throw new Error("Background removal isn't available: " + (err?.message || "import failed"));
  });
  const remove = mod?.removeBackground || mod?.default?.removeBackground || mod?.default;
  if (typeof remove !== "function") {
    throw new Error("Background removal library returned no entry function");
  }
  const blob = await remove(file);
  const baseName = (file.name || "image").replace(/\.[^.]+$/, "") + "-no-bg.png";
  return new File([blob], baseName, { type: "image/png" });
};

/**
 * Convert an image File to a specific output format. Used by the per-image
 * "Convert to PNG / JPEG / WebP" menu in the composer attachment tray.
 * Quality applies to lossy formats only (jpeg / webp); png is lossless.
 */
export const convertImageFormat = async (file, targetMime, quality = DEFAULT_QUALITY) => {
  if (!file || !isImageMime(file.type)) return file;
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(targetMime)) {
    throw new Error("Unsupported target format");
  }
  // No-op when already in the requested format.
  if ((file.type || "").toLowerCase() === targetMime) return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  // JPEG has no transparency — paint a white background under the image
  // so transparent PNGs don't end up with black corners.
  if (targetMime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  return canvasToFile(canvas, targetMime, targetMime === "image/png" ? 1 : quality, file.name);
};

/**
 * Friendly size-saving label for the UI ("82% smaller").
 */
export const formatSavings = (originalSize, newSize) => {
  if (!Number.isFinite(originalSize) || !Number.isFinite(newSize) || originalSize <= 0) {
    return "";
  }
  if (newSize >= originalSize) return "";
  const pct = Math.round(((originalSize - newSize) / originalSize) * 100);
  if (pct < 5) return "";
  return `${pct}% smaller`;
};

export default optimizeImageForUpload;
