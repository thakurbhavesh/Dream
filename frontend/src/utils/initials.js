const DEFAULT_FALLBACK = "TCX";

/**
 * Builds a two-character uppercase string using the first letters of each word.
 * Falls back to DEFAULT_FALLBACK when the input is empty.
 */
export const getInitials = (label = "", fallback = DEFAULT_FALLBACK) => {
  if (typeof label !== "string") return fallback;

  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return initials || fallback;
};

export default getInitials;
