import { useDeferredValue, useMemo } from "react";
import { groupMessagesByDay } from "../messages/helpers.js";

const safeArray = (value) => (Array.isArray(value) ? value : []);

const flattenGroups = (groups) => {
  if (!groups.length) return [];
  return groups.reduce((acc, group) => {
    if (group?.messages?.length) {
      acc.push(...group.messages);
    }
    return acc;
  }, []);
};

const buildVirtualItems = (groups) => {
  if (!groups.length) return [];
  return groups.flatMap((group, groupIndex) => {
    const header = {
      type: "day-label",
      id: `${group.label}-${groupIndex}`,
      label: group.label,
    };
    const messages = safeArray(group.messages).map((message, messageIndex) => ({
      type: "message",
      id:
        message?.id ??
        message?.clientId ??
        `message-${groupIndex}-${messageIndex}`,
      message,
    }));
    return [header, ...messages];
  });
};

export const useGroupedMessages = (messages = []) => {
  const deferredMessages = useDeferredValue(messages);

  const groups = useMemo(
    () => groupMessagesByDay(safeArray(deferredMessages)),
    [deferredMessages]
  );

  const flatMessages = useMemo(() => flattenGroups(groups), [groups]);
  const groupCounts = useMemo(
    () => groups.map((group) => safeArray(group.messages).length),
    [groups]
  );
  const totalMessages = flatMessages.length;
  const virtualItems = useMemo(() => buildVirtualItems(groups), [groups]);
  const lastMessageIndex = useMemo(() => {
    if (!virtualItems.length) return -1;
    for (let index = virtualItems.length - 1; index >= 0; index -= 1) {
      if (virtualItems[index]?.type === "message") return index;
    }
    return -1;
  }, [virtualItems]);

  return {
    groups,
    groupCounts,
    flatMessages,
    totalMessages,
    virtualItems,
    lastMessageIndex,
  };
};

export default useGroupedMessages;
