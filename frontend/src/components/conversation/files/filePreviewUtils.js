import { defaultStyles as fileIconDefaults } from "react-file-icon";

export const CUSTOM_FILE_COLORS = {
  pdf: { color: "#E74C3C", labelColor: "#fff" },
  doc: { color: "#1A73E8", labelColor: "#fff" },
  docx: { color: "#1A73E8", labelColor: "#fff" },
  xls: { color: "#2E7D32", labelColor: "#fff" },
  xlsx: { color: "#2E7D32", labelColor: "#fff" },
  csv: { color: "#26A69A", labelColor: "#fff" },
  ppt: { color: "#EF6C00", labelColor: "#fff" },
  pptx: { color: "#EF6C00", labelColor: "#fff" },
  txt: { color: "#546E7A", labelColor: "#fff" },
  md: { color: "#546E7A", labelColor: "#fff" },
  json: { color: "#6D4C41", labelColor: "#fff" },
  xml: { color: "#8D6E63", labelColor: "#fff" },
  html: { color: "#F4511E", labelColor: "#fff" },
  css: { color: "#3949AB", labelColor: "#fff" },
  js: { color: "#FDD835", labelColor: "#000" },
  jsx: { color: "#0288D1", labelColor: "#fff" },
  ts: { color: "#1976D2", labelColor: "#fff" },
  tsx: { color: "#1565C0", labelColor: "#fff" },
  vue: { color: "#42B883", labelColor: "#fff" },
  php: { color: "#9575CD", labelColor: "#fff" },
  py: { color: "#4DB6AC", labelColor: "#000" },
  rb: { color: "#C62828", labelColor: "#fff" },
  go: { color: "#00ACC1", labelColor: "#fff" },
  java: { color: "#E57373", labelColor: "#fff" },
  kt: { color: "#7E57C2", labelColor: "#fff" },
  swift: { color: "#FF7043", labelColor: "#fff" },
  scala: { color: "#D84315", labelColor: "#fff" },
  cs: { color: "#512DA8", labelColor: "#fff" },
  cpp: { color: "#0277BD", labelColor: "#fff" },
  c: { color: "#039BE5", labelColor: "#fff" },
  sh: { color: "#455A64", labelColor: "#fff" },
  bat: { color: "#37474F", labelColor: "#fff" },
  ps1: { color: "#0D47A1", labelColor: "#fff" },
  sql: { color: "#FF7043", labelColor: "#fff" },
  sqlite: { color: "#6A1B9A", labelColor: "#fff" },
  db: { color: "#5E35B1", labelColor: "#fff" },
  csvdata: { color: "#26A69A", labelColor: "#fff" },
  dmg: { color: "#5C6BC0", labelColor: "#fff" },
  exe: { color: "#EF5350", labelColor: "#fff" },
  apk: { color: "#2E7D32", labelColor: "#fff" },
  ipa: { color: "#1E88E5", labelColor: "#fff" },
  mobileconfig: { color: "#42A5F5", labelColor: "#fff" },
  svg: { color: "#8E24AA", labelColor: "#fff" },
  ai: { color: "#BF360C", labelColor: "#fff" },
  psd: { color: "#0D47A1", labelColor: "#fff" },
  sketch: { color: "#F9A825", labelColor: "#000" },
  fig: { color: "#AB47BC", labelColor: "#fff" },
  xd: { color: "#8E24AA", labelColor: "#fff" },
  png: { color: "#009688", labelColor: "#fff" },
  jpg: { color: "#00897B", labelColor: "#fff" },
  jpeg: { color: "#00897B", labelColor: "#fff" },
  gif: { color: "#26C6DA", labelColor: "#000" },
  bmp: { color: "#5C6BC0", labelColor: "#fff" },
  heic: { color: "#00838F", labelColor: "#fff" },
  raw: { color: "#5D4037", labelColor: "#fff" },
  webp: { color: "#26A69A", labelColor: "#fff" },
  mp3: { color: "#26C6DA", labelColor: "#fff" },
  wav: { color: "#00ACC1", labelColor: "#fff" },
  flac: { color: "#00897B", labelColor: "#fff" },
  mp4: { color: "#7E57C2", labelColor: "#fff" },
  mov: { color: "#3949AB", labelColor: "#fff" },
  avi: { color: "#5E35B1", labelColor: "#fff" },
  mkv: { color: "#6D4C41", labelColor: "#fff" },
  webm: { color: "#00897B", labelColor: "#fff" },
  zip: { color: "#546E7A", labelColor: "#fff" },
  rar: { color: "#455A64", labelColor: "#fff" },
  "7z": { color: "#37474F", labelColor: "#fff" },
  tar: { color: "#795548", labelColor: "#fff" },
  gz: { color: "#6D4C41", labelColor: "#fff" },
  iso: { color: "#455A64", labelColor: "#fff" },
  log: { color: "#78909C", labelColor: "#fff" },
  mobileprovision: { color: "#5E92F3", labelColor: "#fff" },
  config: { color: "#6D4C41", labelColor: "#fff" },
  env: { color: "#4E342E", labelColor: "#fff" },
  yml: { color: "#F9A825", labelColor: "#000" },
  yaml: { color: "#F9A825", labelColor: "#000" },
  rtf: { color: "#607D8B", labelColor: "#fff" },
  epub: { color: "#8BC34A", labelColor: "#000" },
  mobi: { color: "#6D4C41", labelColor: "#fff" },
  msg: { color: "#3949AB", labelColor: "#fff" },
};

export const formatFileSize = (size) => {
  if (typeof size !== "number" || Number.isNaN(size)) {
    return "";
  }
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(2)} ${units[unit]}`;
};

export const buildIconStyleMap = (theme) => {
  const overrides = { ...fileIconDefaults };
  Object.entries(CUSTOM_FILE_COLORS).forEach(([ext, colors]) => {
    overrides[ext] = {
      ...overrides[ext],
      ...colors,
    };
  });
  return overrides;
};

export const buildFileIconProps = (extension, theme, styleMap = null) => {
  const normalized = extension?.toLowerCase();
  const map = styleMap ?? buildIconStyleMap(theme);
  const applyContrast = (config, fallback) => {
    const labelBg = config.labelColor || fallback;
    return {
      ...config,
      labelTextColor:
        config.labelTextColor ||
        theme.palette.getContrastText(labelBg || fallback),
    };
  };
  const preset = normalized ? map[normalized] : null;
  if (preset) {
    return applyContrast(preset, preset.color);
  }
  const fallbackColor =
    theme.palette.mode === "dark"
      ? theme.palette.primary.light
      : theme.palette.primary.main;
  return applyContrast(
    {
      color: fallbackColor,
      labelColor: theme.palette.background.paper,
      cornerColor: fallbackColor,
      foldColor: theme.palette.background.paper,
      glyphColor: theme.palette.background.paper,
    },
    fallbackColor
  );
};

export const resolveFileExtension = (file = {}) => {
  if (!file) return "file";
  const name =
    file.fileName ||
    file.name ||
    file.originalName ||
    file.original_name ||
    "";
  if (name.includes(".")) {
    return name.split(".").pop();
  }
  const urlSource =
    (typeof file.url === "string" && file.url) ||
    file.previewUrl ||
    file.downloadUrl ||
    file.downloadSource ||
    "";
  if (urlSource) {
    if (urlSource.startsWith("data:")) {
      const header = urlSource.slice(5, urlSource.indexOf(";"));
      if (header?.includes("/")) {
        return header.split("/").pop();
      }
    } else if (urlSource.includes(".")) {
      const parsed = urlSource.split("?")[0];
      const segment = parsed.split("/").pop();
      if (segment && segment.includes(".")) {
        return segment.split(".").pop();
      }
    }
  }
  const mime =
    file.mimeType || file.mime || file.type || file.contentType || "";
  if (mime.includes("/")) {
    return mime.split("/").pop();
  }
  return file.typeLabel || "file";
};

export const getFileDetailLabel = (file = {}) => {
  const extension = resolveFileExtension(file);
  const sizeLabel =
    (typeof file.fileSize === "number" ? formatFileSize(file.fileSize) : "") ||
    (typeof file.fileSize === "string" && file.fileSize) ||
    file.sizeLabel ||
    (typeof file.size === "number" ? formatFileSize(file.size) : "") ||
    (typeof file.rawSize === "number" ? formatFileSize(file.rawSize) : "");
  const typeLabel = extension ? extension.toUpperCase() : "FILE";
  return sizeLabel ? `${typeLabel} · ${sizeLabel}` : typeLabel;
};
