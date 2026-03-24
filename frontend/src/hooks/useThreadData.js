import { useMemo, useCallback } from "react";
import { useSyncExternalStore } from "react";
import { threadService } from "../services/threadService";

const subscribe = (listener) => threadService.subscribe(listener);
const getSnapshot = () => threadService.getSnapshot();

export const useThreadData = () => {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const getThreadsForOrg = useCallback(
    (orgId, options) => threadService.getThreadsForOrg(orgId, options),
    []
  );
  const getMessagesForThread = useCallback(
    (threadId, options) => threadService.getMessagesForThread(threadId, options),
    []
  );
  const getMessagesWindow = useCallback(
    (threadId, options) => threadService.getMessagesWindow(threadId, options),
    []
  );
  const refreshOrg = useCallback(
    (orgId, fetcher) => threadService.refreshOrg(orgId, fetcher),
    []
  );
  const upsertThread = useCallback(
    (orgId, thread) => threadService.upsertThread(orgId, thread),
    []
  );
  const appendMessages = useCallback(
    (threadId, messages) => threadService.appendMessages(threadId, messages),
    []
  );
  const patchMessage = useCallback(
    (threadId, message) => threadService.patchMessage(threadId, message),
    []
  );
  const removeMessage = useCallback(
    (threadId, messageId) => threadService.removeMessage(threadId, messageId),
    []
  );
  const removeThread = useCallback(
    (orgId, threadId, options) =>
      threadService.removeThread(orgId, threadId, options),
    []
  );
  const markThreadMessagesRead = useCallback(
    (threadId) => threadService.markThreadMessagesRead(threadId),
    []
  );

  return useMemo(
    () => ({
      organizations: snapshot.organizations,
      threadsByOrg: snapshot.threadsByOrg,
      messagesByThread: snapshot.messagesByThread,
      loadingStates: snapshot.loadingStates,
      lastSyncError: snapshot.lastSyncError,
      getThreadsForOrg,
      getMessagesForThread,
      getMessagesWindow,
      refreshOrg,
      upsertThread,
      appendMessages,
      patchMessage,
      removeMessage,
      removeThread,
      markThreadMessagesRead,
    }),
    [
      snapshot,
      getThreadsForOrg,
      getMessagesForThread,
      getMessagesWindow,
      refreshOrg,
      upsertThread,
      appendMessages,
      patchMessage,
      removeMessage,
      removeThread,
      markThreadMessagesRead,
    ]
  );
};

export default useThreadData;
