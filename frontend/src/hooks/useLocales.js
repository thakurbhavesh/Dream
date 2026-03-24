import { useCallback, useMemo, useState } from "react";
import { enUS } from "@mui/material/locale";

const STORAGE_KEY = "app-language";

const LANGS = [
  {
    label: "English",
    value: "en",
    systemValue: enUS,
  },
];

const getInitialLang = () => {
  if (typeof window === "undefined") {
    return LANGS[0];
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return LANGS.find((lang) => lang.value === stored) || LANGS[0];
};

export default function useLocales() {
  const [currentLang, setCurrentLang] = useState(getInitialLang);

  const onChangeLang = useCallback((value) => {
    const selected = LANGS.find((lang) => lang.value === value) || LANGS[0];
    setCurrentLang(selected);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, selected.value);
    }
  }, []);

  const memoizedLangs = useMemo(() => LANGS, []);

  return {
    allLangs: memoizedLangs,
    currentLang,
    onChangeLang,
  };
}
