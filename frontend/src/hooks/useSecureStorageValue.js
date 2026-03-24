import { useEffect, useState } from "react";
import secureStorage from "../utils/secureStorage";

const DEFAULT_DELAY = 0;

const readValue = async (key, fallback, storage) => {
  const result = await secureStorage.getItem(key, { storage });
  return result ?? fallback;
};

export const useSecureStorageValue = (key, fallback = "", options = {}) => {
  const [value, setValue] = useState(fallback);
  const { debounceMs = DEFAULT_DELAY, storage = "local" } = options;

  useEffect(() => {
    let mounted = true;
    let timeoutId = null;

    const update = async () => {
      const next = await readValue(key, fallback, storage);
      if (mounted) {
        setValue(next);
      }
    };

    update();

    const unsubscribe = secureStorage.subscribe(
      key,
      (next) => {
        if (!mounted) return;
        if (debounceMs > 0) {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            setValue(next ?? fallback);
          }, debounceMs);
        } else {
          setValue(next ?? fallback);
        }
      },
      { storage }
    );

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [key, fallback, debounceMs, storage]);

  return value;
};

export default useSecureStorageValue;
