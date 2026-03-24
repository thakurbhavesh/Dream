export const createBlobFromDataUrl = (value) => {
  if (typeof value !== "string" || !value.startsWith("data:")) return null;
  const commaIndex = value.indexOf(",");
  if (commaIndex === -1) return null;
  const meta = value.slice(5, commaIndex);
  const mime = meta.split(";")[0] || "application/octet-stream";
  try {
    const base64 = value.slice(commaIndex + 1);
    const decoder =
      typeof window !== "undefined" && typeof window.atob === "function"
        ? window.atob
        : typeof atob === "function"
          ? atob
          : null;
    if (!decoder) return null;
    const binary = decoder(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes.buffer], { type: mime });
  } catch {
    return null;
  }
};

const drawImageToCanvasBlob = (source, mimeType = "image/png") =>
  new Promise((resolve, reject) => {
    if (!source || typeof document === "undefined") {
      reject(new Error("No source"));
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width || 0;
        canvas.height = img.naturalHeight || img.height || 0;
        const ctx = canvas.getContext("2d");
        if (!ctx || !canvas.width || !canvas.height) {
          reject(new Error("Canvas unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Unable to create blob"));
          },
          mimeType,
          0.95
        );
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = (event) => reject(event?.error || new Error("Image load failed"));
    img.src = source;
  });

const convertImageBlobWithCanvas = async (blob, source, mimeType = "image/png") => {
  if (!blob) return null;
  let objectUrl = null;
  let conversionSource = source;
  if (!conversionSource && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    try {
      objectUrl = URL.createObjectURL(blob);
      conversionSource = objectUrl;
    } catch {
      objectUrl = null;
    }
  }
  if (!conversionSource) return null;
  try {
    return await drawImageToCanvasBlob(conversionSource, mimeType);
  } catch {
    return null;
  } finally {
    if (objectUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // ignore revoke errors
      }
    }
  }
};

const isExternalUrl = (url) =>
  typeof url === "string" &&
  url.startsWith("http") &&
  !url.includes(window.location.host);

export const resolveImageBlob = async (source, { fallbackToCanvas = true } = {}) => {
  if (!source) return null;
  if (typeof source === "string" && source.startsWith("data:")) {
    return createBlobFromDataUrl(source);
  }
  try {
    // S3 presigned URLs are external — don't send credentials (breaks CORS with wildcard origin)
    const fetchOptions = isExternalUrl(source)
      ? { mode: "cors" }
      : { credentials: "include", mode: "cors" };
    const response = await fetch(source, fetchOptions);
    if (response.ok) {
      const blob = await response.blob();
      if (blob && blob.type?.startsWith("image/")) {
        return blob;
      }
    }
  } catch {
    // ignore fetch errors, fallback to canvas if allowed
  }
  if (!fallbackToCanvas) return null;
  try {
    return await drawImageToCanvasBlob(source);
  } catch {
    return null;
  }
};

const legacyCopyImageFromSource = async (source) =>
  new Promise((resolve, reject) => {
    if (!source || typeof document === "undefined" || typeof window === "undefined") {
      reject(new Error("Unavailable"));
      return;
    }
    const container = document.createElement("div");
    container.contentEditable = "true";
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.width = "1px";
    container.style.height = "1px";
    container.style.opacity = "0";
    const image = document.createElement("img");
    image.style.maxWidth = "1px";
    image.style.maxHeight = "1px";
    container.appendChild(image);
    const cleanup = () => {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      if (container.parentNode) {
        document.body.removeChild(container);
      }
    };
    const attemptCopy = () => {
      document.body.appendChild(container);
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(container);
      selection?.removeAllRanges();
      selection?.addRange(range);
      const succeeded = document.execCommand("copy");
      cleanup();
      if (succeeded) {
        resolve(true);
      } else {
        reject(new Error("copy failed"));
      }
    };
    image.onload = attemptCopy;
    image.onerror = (event) => {
      cleanup();
      reject(event?.error || new Error("image load failed"));
    };
    image.src = source;
    if (image.complete) {
      attemptCopy();
    }
  });

export const copyImageSourceToClipboard = async (source) => {
  if (!source) return;
  const clipboardSupported =
    typeof navigator?.clipboard?.write === "function" &&
    typeof window?.ClipboardItem === "function";
  const blob = await resolveImageBlob(source, { fallbackToCanvas: true });
  const writeBlobToClipboard = async (imageBlob) => {
    if (!imageBlob || !clipboardSupported) return false;
    try {
      const mimeType =
        imageBlob.type && imageBlob.type.startsWith("image/")
          ? imageBlob.type
          : "image/png";
      const clipboardItem = new window.ClipboardItem({
        [mimeType]: imageBlob,
      });
      await navigator.clipboard.write([clipboardItem]);
      return true;
    } catch {
      return false;
    }
  };
  if (blob && clipboardSupported) {
    const wroteOriginal = await writeBlobToClipboard(blob);
    if (wroteOriginal) {
      return;
    }
    const pngBlob =
      blob.type === "image/png"
        ? blob
        : await convertImageBlobWithCanvas(blob, source, "image/png");
    if (pngBlob && (await writeBlobToClipboard(pngBlob))) {
      return;
    }
  }
  if (blob) {
    const url = URL.createObjectURL(blob);
    try {
      await legacyCopyImageFromSource(url);
      return;
    } catch {
      // fallthrough
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  try {
    await legacyCopyImageFromSource(source);
    return;
  } catch {
    // ignore
  }
  await navigator?.clipboard?.writeText?.(source);
};
