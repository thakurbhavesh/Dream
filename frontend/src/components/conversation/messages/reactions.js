export const DEFAULT_REACTIONS = Object.freeze([
  "👍",
  "❤️",
  "😂",
  "🙄",
  "🥰",
  "🔥",
  "😭",
]);

const normalizeUsers = (users = []) => {
  if (!Array.isArray(users)) return [];
  return users
    .map((user) => {
      if (!user) return null;
      const id = user.id ?? user.user_id ?? null;
      const name =
        typeof user.name === "string" && user.name.trim()
          ? user.name.trim()
          : user.displayName?.trim?.() ||
            user.fullName?.trim?.() ||
            user.email?.trim?.() ||
            id ||
            "";
      if (!id && !name) return null;
      return { id: id || name, name };
    })
    .filter(Boolean);
};

const cloneReactions = (reactions = []) =>
  Array.isArray(reactions)
    ? reactions.map((reaction) => ({
        emoji: reaction?.emoji,
        users: normalizeUsers(reaction?.users),
      }))
    : [];

const formatTooltip = (names, viewerReacted) => {
  if (!names.length) return "";
  const others = viewerReacted ? names.slice(1) : names;
  if (viewerReacted && !others.length) return "You";
  if (viewerReacted) {
    if (others.length === 1) return `You, ${others[0]}`;
    return `You and ${others.length} others`;
  }
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]} + ${names.length - 1} others`;
};

export const summariseReactions = (message, currentUserId) => {
  const base = cloneReactions(message?.metadata?.reactions);
  return base
    .map((entry) => {
      const users = entry.users ?? [];
      if (!entry.emoji || users.length === 0) return null;
      const viewerReacted = Boolean(
        currentUserId &&
          users.some((user) => user.id === currentUserId)
      );
      const sortedNames = [
        ...(viewerReacted ? ["You"] : []),
        ...users
          .filter((user) => !currentUserId || user.id !== currentUserId)
          .map((user) => user.name || user.id),
      ];
      return {
        emoji: entry.emoji,
        count: users.length,
        users,
        viewerReacted,
        tooltip: formatTooltip(sortedNames, viewerReacted),
      };
    })
    .filter(Boolean);
};

export const toggleReactionOnMessage = (
  message,
  { emoji, userId, userName }
) => {
  if (!message || !emoji || !userId) return message;
  const safeName =
    (typeof userName === "string" && userName.trim()) || "You";
  const metadata = { ...(message.metadata || {}) };
  const reactionList = cloneReactions(metadata.reactions);
  const target = reactionList.find((reaction) => reaction.emoji === emoji);

  const removeUserFromAll = () => {
    reactionList.forEach((reaction) => {
      reaction.users = reaction.users.filter((user) => user.id !== userId);
    });
  };

  if (target) {
    const existingIndex = target.users.findIndex((user) => user.id === userId);
    if (existingIndex >= 0) {
      target.users.splice(existingIndex, 1);
    } else {
      removeUserFromAll();
      target.users.push({ id: userId, name: safeName });
    }
  } else {
    removeUserFromAll();
    reactionList.push({
      emoji,
      users: [{ id: userId, name: safeName }],
    });
  }

  metadata.reactions = reactionList.filter(
    (reaction) => reaction.users.length > 0
  );

  return {
    ...message,
    metadata,
  };
};
