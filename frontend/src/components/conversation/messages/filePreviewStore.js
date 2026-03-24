import { useEffect, useState } from "react";

const entries = new Map();
const listeners = new Set();

const getTimestamp = (value) => {
  if (!value) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : 0;
  }
  return 0;
};

const getOrderedEntries = () => {
  return Array.from(entries.values()).sort((a, b) => {
    const timeA = getTimestamp(a.createdAt);
    const timeB = getTimestamp(b.createdAt);
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    const idA = a.id ?? "";
    const idB = b.id ?? "";
    return idA.localeCompare(idB);
  });
};

const emit = () => {
  const snapshot = getOrderedEntries();
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // ignore listener errors
    }
  });
};

export const registerFilePreviewEntry = (entry) => {
  if (!entry || !entry.id) {
    return () => {};
  }
  entries.set(entry.id, { ...entry });
  emit();
  return () => {
    if (!entry?.id) return;
    entries.delete(entry.id);
    emit();
  };
};

export const useFilePreviewEntries = () => {
  const [state, setState] = useState(() => getOrderedEntries());
  useEffect(() => {
    const listener = (next) => setState(next);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);
  return state;
};
