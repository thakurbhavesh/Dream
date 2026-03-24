export const isGroupThread = (thread = {}) => {
  if (!thread) return false;
  const type = (
    thread.type ??
    thread.threadType ??
    thread.category ??
    ""
  )
    .toString()
    .toLowerCase();
  if (type === "group" || type === "channel" || type === "room") return true;
  if (
    thread.isGroup === true ||
    thread.group === true ||
    thread.conversationType === "group"
  ) {
    return true;
  }
  if (Array.isArray(thread.members) && thread.members.length > 1) return true;
  if (
    Array.isArray(thread.participants) &&
    thread.participants.length > 2
  ) {
    return true;
  }
  return false;
};

export default isGroupThread;
