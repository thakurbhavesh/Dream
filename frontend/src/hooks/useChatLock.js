import { useCallback, useEffect, useMemo, useState } from "react";

export const PIN_HASH_KEY = "chatx.pinHash";
export const PIN_SALT_KEY = "chatx.pinSalt";
export const LOCK_STATE_KEY = "chatx.lockState";
export const LOCK_EVENT = "chat-lock:toggle";
export const STATE_EVENT = "chat-lock:state-changed";
const PIN_ATTEMPTS_KEY = "chatx.pinAttempts";
const PIN_LOCKOUT_KEY = "chatx.pinLockoutUntil";
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000;

export const LockMode = {
  SET: "set",
  UNLOCK: "unlock",
};

const hexFromBuffer = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const hashPinWithSalt = async (pin, saltHex) => {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return btoa(`${pin}:${saltHex}`);
  }

  const encoder = new TextEncoder();
  const saltBytes = new Uint8Array(
    saltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? []
  );
  const pinBytes = encoder.encode(pin);
  const merged = new Uint8Array(pinBytes.length + saltBytes.length);
  merged.set(pinBytes);
  merged.set(saltBytes, pinBytes.length);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", merged);
  return hexFromBuffer(hashBuffer);
};

const generateSaltHex = () => {
  if (typeof window === "undefined" || !window.crypto?.getRandomValues) {
    return Math.random().toString(16).slice(2, 34).padEnd(32, "0");
  }
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return hexFromBuffer(bytes.buffer);
};

const broadcastState = (locked, hasPin) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: { locked, hasPin } }));
};

const readPinHash = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PIN_HASH_KEY);
};

const readNumericItem = (key) => {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(key);
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
};

const writeNumericItem = (key, value) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, String(value));
};

const resetAttemptState = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PIN_ATTEMPTS_KEY);
  window.localStorage.removeItem(PIN_LOCKOUT_KEY);
};

const incrementAttempts = () => {
  if (typeof window === "undefined") return 0;
  const current = readNumericItem(PIN_ATTEMPTS_KEY);
  const next = current + 1;
  writeNumericItem(PIN_ATTEMPTS_KEY, next);
  return next;
};

const beginLockout = () => {
  if (typeof window === "undefined") return 0;
  const until = Date.now() + LOCKOUT_DURATION_MS;
  writeNumericItem(PIN_LOCKOUT_KEY, until);
  writeNumericItem(PIN_ATTEMPTS_KEY, 0);
  return until;
};

const getLockoutRemainingMs = () => {
  if (typeof window === "undefined") return 0;
  const deadline = readNumericItem(PIN_LOCKOUT_KEY);
  if (!deadline) return 0;
  return Math.max(deadline - Date.now(), 0);
};

export const useChatLock = () => {
  const [isLocked, setIsLocked] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [dialogMode, setDialogMode] = useState(LockMode.UNLOCK);
  const [pinValue, setPinValue] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", error: false });

  const lockStateLabel = useMemo(() => {
    if (!hasPin) return "Set PIN";
    return isLocked ? "Unlock" : "Lock";
  }, [hasPin, isLocked]);

  const updateLockedState = useCallback(
    (locked, pinPresent = hasPin) => {
      setIsLocked(locked);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCK_STATE_KEY, locked ? "locked" : "unlocked");
      }
      broadcastState(locked, pinPresent);
    },
    [hasPin]
  );

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setPinValue("");
  }, []);

  const openSetDialog = useCallback(() => {
    setDialogMode(LockMode.SET);
    setDialogOpen(true);
  }, []);

  const openUnlockDialog = useCallback(() => {
    setDialogMode(LockMode.UNLOCK);
    setDialogOpen(true);
  }, []);

  const showSnackbar = useCallback((message, error = false) => {
    setSnackbar({ open: true, message, error });
  }, []);

  const handleSnackbarClose = useCallback((_, reason) => {
    if (reason === "clickaway") return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  const handleToggleRequest = useCallback(() => {
    const storedHash = readPinHash();
    if (!storedHash) {
      openSetDialog();
      return;
    }

    if (isLocked) {
      openUnlockDialog();
    } else {
      updateLockedState(true, true);
      showSnackbar("Chat locked.");
    }
  }, [isLocked, openSetDialog, openUnlockDialog, showSnackbar, updateLockedState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const listener = () => handleToggleRequest();
    window.addEventListener(LOCK_EVENT, listener);
    return () => window.removeEventListener(LOCK_EVENT, listener);
  }, [handleToggleRequest]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedHash = window.localStorage.getItem(PIN_HASH_KEY);
    const storedState = window.localStorage.getItem(LOCK_STATE_KEY);
    const pinExists = Boolean(storedHash);

    setHasPin(pinExists);
    const locked = pinExists ? storedState !== "unlocked" : false;
    setIsLocked(locked);
    broadcastState(locked, pinExists);
  }, []);

  const handlePinSubmit = useCallback(async () => {
    if (!/^[0-9]{4}$/.test(pinValue)) {
      showSnackbar("PIN must be a 4-digit number.", true);
      return;
    }

    try {
      if (dialogMode === LockMode.SET) {
        const salt = generateSaltHex();
        const hash = await hashPinWithSalt(pinValue, salt);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(PIN_HASH_KEY, hash);
          window.localStorage.setItem(PIN_SALT_KEY, salt);
        }
        setHasPin(true);
        updateLockedState(false, true);
        resetAttemptState();
        closeDialog();
        showSnackbar("PIN set successfully.");
      } else {
        if (typeof window === "undefined") return;
        const lockoutRemaining = getLockoutRemainingMs();
        if (lockoutRemaining > 0) {
          const seconds = Math.ceil(lockoutRemaining / 1000);
          showSnackbar(
            `Too many incorrect attempts. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`,
            true
          );
          return;
        }
        const storedHash = window.localStorage.getItem(PIN_HASH_KEY);
        const salt = window.localStorage.getItem(PIN_SALT_KEY) ?? "";
        if (!storedHash) {
          showSnackbar("No PIN found. Set a new PIN.", true);
          openSetDialog();
          return;
        }
        const hash = await hashPinWithSalt(pinValue, salt);
        if (hash === storedHash) {
          updateLockedState(false, true);
          resetAttemptState();
          closeDialog();
          showSnackbar("Chat unlocked.");
        } else {
          const attempts = incrementAttempts();
          if (attempts >= MAX_PIN_ATTEMPTS) {
            beginLockout();
            const seconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);
            showSnackbar(
              `Too many incorrect attempts. Locked for ${seconds} second${seconds === 1 ? "" : "s"}.`,
              true
            );
          } else {
            const remaining = MAX_PIN_ATTEMPTS - attempts;
            showSnackbar(
              `Incorrect PIN. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`,
              true
            );
          }
        }
      }
    } catch (error) {
      showSnackbar("Something went wrong. Please try again.", true);
      console.error("PIN handling error:", error);
    }
  }, [closeDialog, dialogMode, openSetDialog, pinValue, showSnackbar, updateLockedState]);

  const handlePinChange = useCallback((value) => {
    setPinValue(value.replace(/\D/g, "").slice(0, 4));
  }, []);

  return {
    isLocked,
    hasPin,
    lockStateLabel,
    dialogMode,
    dialogOpen,
    pinValue,
    snackbar,
    openSetDialog,
    openUnlockDialog,
    closeDialog,
    handlePinSubmit,
    handlePinChange,
    handleSnackbarClose,
    toggleLock: handleToggleRequest,
  };
};

export default useChatLock;
