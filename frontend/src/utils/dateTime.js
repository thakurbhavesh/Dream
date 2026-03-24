export const parseAppDate = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsedLocal = new Date(`${raw}T00:00:00`);
    return Number.isNaN(parsedLocal.getTime()) ? null : parsedLocal;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatAppDate = (value, { includeTime = false, fallback = "--" } = {}) => {
  const parsed = parseAppDate(value);
  if (!parsed) return fallback;

  const datePart = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);

  if (!includeTime) return datePart;

  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
    .format(parsed)
    .toLowerCase();

  return `${datePart}, ${timePart}`;
};

export const formatExpiryDate = (value, fallback = "--") =>
  formatAppDate(value, { includeTime: true, fallback });

export const formatIsoDate = (value, fallback = "--") => {
  const parsed = parseAppDate(value);
  if (!parsed) return fallback;
  return parsed.toISOString().slice(0, 10);
};
