import { useCallback, useEffect, useRef, useState } from "react";

const toPositiveInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const useOtpResendCooldown = (initialSeconds = 0) => {
  const [secondsLeft, setSecondsLeft] = useState(toPositiveInt(initialSeconds, 0));
  const timerRef = useRef(null);

  const stop = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback((seconds) => {
    const safeSeconds = toPositiveInt(seconds, 0);
    setSecondsLeft(safeSeconds);
  }, []);

  useEffect(() => {
    stop();
    if (secondsLeft <= 0) return undefined;
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => stop();
  }, [secondsLeft, stop]);

  useEffect(() => () => stop(), [stop]);

  return {
    secondsLeft,
    start,
    reset: () => setSecondsLeft(0),
  };
};

export default useOtpResendCooldown;
