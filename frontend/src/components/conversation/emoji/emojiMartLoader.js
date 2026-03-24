let emojiMartCache = null;
let emojiMartPromise = null;

const unifiedToNative = (unified = "") =>
  unified
    .split("-")
    .map((code) => {
      const parsed = Number.parseInt(code, 16);
      return Number.isNaN(parsed) ? "" : String.fromCodePoint(parsed);
    })
    .join("");

const normalizeEmojiPayload = (emojiList = [], categories = []) => {
  const normalizedEmojis = emojiList.map((emoji) => ({
    ...emoji,
    native: unifiedToNative(emoji.unified),
  }));
  const emojiMap = new Map(
    normalizedEmojis.map((emoji) => [emoji.unified, emoji])
  );
  const normalizedCategories = categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      emojiItems:
        category.emojis
          ?.map((code) => emojiMap.get(code))
          .filter(Boolean) ?? [],
    }))
    .filter((category) => category.emojiItems.length);
  return {
    emojis: normalizedEmojis,
    categories: normalizedCategories,
  };
};

export const getEmojiMartLibraryCache = () => emojiMartCache;

export const loadEmojiMartLibrary = () => {
  if (emojiMartCache) {
    return Promise.resolve(emojiMartCache);
  }
  if (!emojiMartPromise) {
    emojiMartPromise = import("./emojiMartStaticData.js")
      .then(({ EMOJI_MART_CATEGORIES, EMOJI_MART_EMOJIS }) => {
        const payload = normalizeEmojiPayload(
          EMOJI_MART_EMOJIS || [],
          EMOJI_MART_CATEGORIES || []
        );
        emojiMartCache = payload;
        return payload;
      })
      .catch((error) => {
        emojiMartPromise = null;
        throw error;
      });
  }
  return emojiMartPromise;
};
