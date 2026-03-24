import PropTypes from "prop-types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
} from "react";
import { formatTypingSummary } from "../utils/typingFormatter.js";

// Mock typing seeds disabled — typing is fully realtime via socket now
const mockTypingSeeds = [];

const TypingIndicatorContext = createContext(null);

const initialState = {
  byThreadId: {},
};

const typingReducer = (state, action) => {
  switch (action.type) {
    case "SET_PARTICIPANT": {
      const { threadId, participant } = action.payload;
      const previousEntry = state.byThreadId[threadId] ?? {
        participants: [],
        lastUpdated: 0,
      };
      const participants = [
        participant,
        ...previousEntry.participants.filter(
          (existing) => existing.id !== participant.id
        ),
      ];
      return {
        ...state,
        byThreadId: {
          ...state.byThreadId,
          [threadId]: { participants, lastUpdated: Date.now() },
        },
      };
    }
    case "SET_PARTICIPANTS": {
      const { threadId, participants = [] } = action.payload;
      return {
        ...state,
        byThreadId: {
          ...state.byThreadId,
          [threadId]: {
            participants: participants.slice(),
            lastUpdated: Date.now(),
          },
        },
      };
    }
    case "REMOVE_PARTICIPANT": {
      const { threadId, userId } = action.payload;
      const previousEntry = state.byThreadId[threadId];
      if (!previousEntry) return state;
      const participants = previousEntry.participants.filter(
        (participant) => participant.id !== userId
      );
      if (!participants.length) {
        const nextEntries = { ...state.byThreadId };
        delete nextEntries[threadId];
        return {
          ...state,
          byThreadId: nextEntries,
        };
      }
      return {
        ...state,
        byThreadId: {
          ...state.byThreadId,
          [threadId]: { participants, lastUpdated: Date.now() },
        },
      };
    }
    default:
      return state;
  }
};

export const TypingIndicatorProvider = ({
  children,
  idleTimeout = 5500,
  enableSimulation = false,
}) => {
  const [state, dispatch] = useReducer(typingReducer, initialState);
  const expiryTimersRef = useRef(new Map());
  const simulationTimerRef = useRef(null);
  const listenersRef = useRef(new Map());
  const stateRef = useRef(initialState.byThreadId);

  const clearTimer = useCallback((key) => {
    const timer = expiryTimersRef.current.get(key);
    if (timer) {
      clearTimeout(timer);
      expiryTimersRef.current.delete(key);
    }
  }, []);

  const notifyThread = useCallback((threadId) => {
    if (!threadId) return;
    const listeners = listenersRef.current.get(threadId);
    if (!listeners || listeners.size === 0) return;
    listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // ignore subscriber errors
      }
    });
  }, []);

  const subscribeToThread = useCallback((threadId, listener) => {
    if (!threadId || typeof listener !== "function") {
      return () => {};
    }
    let listeners = listenersRef.current.get(threadId);
    if (!listeners) {
      listeners = new Set();
      listenersRef.current.set(threadId, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        listenersRef.current.delete(threadId);
      }
    };
  }, []);

  useEffect(() => {
    const previous = stateRef.current;
    const next = state.byThreadId;
    if (previous === next) return;
    const seen = new Set([
      ...Object.keys(previous || {}),
      ...Object.keys(next || {}),
    ]);
    seen.forEach((threadId) => {
      if ((previous?.[threadId] ?? null) !== (next?.[threadId] ?? null)) {
        notifyThread(threadId);
      }
    });
    stateRef.current = next;
  }, [notifyThread, state.byThreadId]);

  const scheduleExpiry = useCallback(
    (threadId, userId, duration) => {
      const key = `${threadId}:${userId}`;
      clearTimer(key);
      const timer = setTimeout(() => {
        expiryTimersRef.current.delete(key);
        dispatch({ type: "REMOVE_PARTICIPANT", payload: { threadId, userId } });
      }, duration);
      expiryTimersRef.current.set(key, timer);
    },
    [clearTimer]
  );

  const startTyping = useCallback(
    (threadId, participant, options = {}) => {
      if (!threadId || !participant?.id) return;
      const normalizedParticipant = {
        id: participant.id,
        name: participant.name ?? "Someone",
        avatar: participant.avatar ?? null,
        isSelf: Boolean(participant.isSelf),
        source: participant.source ?? "remote",
      };
      dispatch({
        type: "SET_PARTICIPANT",
        payload: { threadId, participant: normalizedParticipant },
      });
      scheduleExpiry(
        threadId,
        normalizedParticipant.id,
        options.duration ?? idleTimeout
      );
    },
    [idleTimeout, scheduleExpiry]
  );

  const stopTyping = useCallback((threadId, userId) => {
    if (!threadId || !userId) return;
    const key = `${threadId}:${userId}`;
    clearTimer(key);
    dispatch({ type: "REMOVE_PARTICIPANT", payload: { threadId, userId } });
  }, [clearTimer]);

  const setParticipants = useCallback((threadId, participants = []) => {
    if (!threadId) return;
    dispatch({
      type: "SET_PARTICIPANTS",
      payload: { threadId, participants },
    });
    participants.forEach((participant) => {
      if (participant?.id) {
        scheduleExpiry(threadId, participant.id, idleTimeout);
      }
    });
  }, [idleTimeout, scheduleExpiry]);

  useEffect(() => {
    const timers = expiryTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      if (simulationTimerRef.current) {
        clearTimeout(simulationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!enableSimulation || !mockTypingSeeds.length) return undefined;
    let index = 0;
    let cancelled = false;

    const schedule = (delay = 6200) => {
      simulationTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        const seed = mockTypingSeeds[index % mockTypingSeeds.length];
        if (seed?.threadId && Array.isArray(seed.participants)) {
          seed.participants.forEach((participant, offset) =>
            startTyping(
              seed.threadId,
              participant,
              { duration: idleTimeout + offset * 350 }
            )
          );
        }
        index += 1;
        schedule(5400 + Math.random() * 1800);
      }, delay);
    };

    schedule(2500);

    return () => {
      cancelled = true;
      if (simulationTimerRef.current) {
        clearTimeout(simulationTimerRef.current);
      }
    };
  }, [enableSimulation, idleTimeout, startTyping]);

  const contextValue = useMemo(
    () => ({
      state,
      startTyping,
      stopTyping,
      setParticipants,
      subscribeToThread,
      getThreadEntry: (threadId) => stateRef.current[threadId],
    }),
    [setParticipants, startTyping, state, stopTyping, subscribeToThread]
  );

  return (
    <TypingIndicatorContext.Provider value={contextValue}>
      {children}
    </TypingIndicatorContext.Provider>
  );
};

TypingIndicatorProvider.propTypes = {
  children: PropTypes.node,
  idleTimeout: PropTypes.number,
  enableSimulation: PropTypes.bool,
};

export const useTypingIndicator = (threadId) => {
  const context = useContext(TypingIndicatorContext);
  if (!context) {
    throw new Error(
      "useTypingIndicator must be used within TypingIndicatorProvider"
    );
  }
  if (!threadId) {
    return {
      participants: [],
      isActive: false,
      summary: "",
    };
  }
  const entry = useSyncExternalStore(
    (listener) => context.subscribeToThread(threadId, listener),
    () => context.getThreadEntry(threadId) ?? null,
    () => null
  );
  const participants = entry?.participants ?? [];
  const visibleParticipants = participants.filter(
    (participant) => !participant.isSelf
  );
  return {
    participants: visibleParticipants,
    isActive: visibleParticipants.length > 0,
    summary: formatTypingSummary(visibleParticipants),
    rawParticipants: participants,
  };
};

export const useTypingActions = () => {
  const context = useContext(TypingIndicatorContext);
  if (!context) {
    throw new Error(
      "useTypingActions must be used within TypingIndicatorProvider"
    );
  }
  return {
    startTyping: context.startTyping,
    stopTyping: context.stopTyping,
    setParticipants: context.setParticipants,
  };
};

export default TypingIndicatorContext;
