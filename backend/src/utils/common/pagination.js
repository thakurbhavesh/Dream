const normalizeText = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const parsePagination = (query = {}, options = {}) => {
  const maxLimit = options.maxLimit ?? 100;
  const defaultLimit = options.defaultLimit ?? 50;

  const rawLimit = Number.parseInt(query.limit, 10);
  const rawOffset = Number.parseInt(query.offset, 10);

  const limit = Number.isNaN(rawLimit)
    ? defaultLimit
    : Math.min(Math.max(rawLimit, 1), maxLimit);
  const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

  return { limit, offset };
};

const parseSearch = (query = {}, options = {}) => {
  const maxLength = options.maxLength ?? 100;
  const search = normalizeText(query.search);
  if (!search) return undefined;
  return search.length > maxLength ? search.slice(0, maxLength) : search;
};

module.exports = {
  parsePagination,
  parseSearch,
};
