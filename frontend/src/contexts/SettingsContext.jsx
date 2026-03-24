// provider === component
import { createContext, useEffect } from "react";
import { defaultSettings } from "../config";
import useLocalStorage from "../hooks/useLocalStorage";
import getColorPresets, {
  defaultPreset,
  colorPresets,
} from "../utils/getColorPresets";

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

const initialState = {
  ...defaultSettings,

  // Mode
  onToggleMode: () => {},
  // Color
  onChangeColor: () => {},
  setColor: defaultPreset,
  colorOption: [],
  customPrimaryColor: defaultSettings.customPrimaryColor,
  onUpdateCustomPrimary: () => {},

  // Reset
  onResetSetting: () => {},

   // Font Settings
  fontType: "San Francisco Display",
  fontSize: "100%",
  onChangeFont: () => {},
  onChangeFontSize: () => {},
  chatListRightAligned: defaultSettings.chatListRightAligned,
  onToggleChatLayout: () => {},
};

const SettingsContext = createContext(initialState);

const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useLocalStorage("settings", {
    themeMode: initialState.themeMode,
    themeDirection: initialState.themeDirection,
    themeColorPresets: initialState.themeColorPresets,
    customPrimaryColor: initialState.customPrimaryColor,
    fontType: initialState.fontType,
    fontSize: initialState.fontSize,
    chatListRightAligned: initialState.chatListRightAligned,
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--app-font-family", settings.fontType);
    document.documentElement.style.setProperty("--app-font-size", settings.fontSize);
  }, [settings.fontType, settings.fontSize]);

  // Mode

  const onToggleMode = () => {
    // console.log("onchangeMode event : ", settings.themeMode);
    const currentTheme = localStorage.getItem(settings.themeMode);
    void currentTheme;
    setSettings({
      ...settings,
      themeMode: settings.themeMode === "light" ? "dark" : "light",
    });
  };

  // Color

  const onChangeColor = (event) => {
    setSettings({
      ...settings,
      themeColorPresets: event.target.value,
    });
  };

  const onUpdateCustomPrimary = (color) => {
    if (!color) {
      return;
    }

    const formatted =
      typeof color === "string"
        ? color.trim().startsWith("#")
          ? color.trim()
          : `#${color.trim()}`
        : initialState.customPrimaryColor;
    const normalized = HEX_COLOR_PATTERN.test(formatted)
      ? formatted
      : initialState.customPrimaryColor;

    setSettings({
      ...settings,
      customPrimaryColor: normalized,
      themeColorPresets: "custom",
    });
  };

  // Reset

  const onResetSetting = () => {
    setSettings({
      themeMode: initialState.themeMode,
      themeDirection: initialState.themeDirection,
      themeColorPresets: initialState.themeColorPresets,
      customPrimaryColor: initialState.customPrimaryColor,
      fontType: initialState.fontType,
      fontSize: initialState.fontSize,
      chatListRightAligned: initialState.chatListRightAligned,
    });
  };

  const onChangeFont = (event) => {
    const selectedFont = event.target.value;
    setSettings({ ...settings, fontType: selectedFont });
    localStorage.setItem("fontType", selectedFont);
  };

  // ✅ Font Size Change Handler
  const onChangeFontSize = (event) => {
    const selectedFontSize = event.target.value;
    setSettings({ ...settings, fontSize: selectedFontSize });
    localStorage.setItem("fontSize", selectedFontSize);
  };

  const onToggleChatLayout = () => {
    setSettings((prev) => {
      const current =
        typeof prev?.chatListRightAligned === "boolean"
          ? prev.chatListRightAligned
          : initialState.chatListRightAligned;
      return {
        ...prev,
        chatListRightAligned: !current,
      };
    });
  };


  return (
    <SettingsContext.Provider
      value={{
        ...settings, // Mode
        onToggleMode,

        // Color
        onChangeColor,
        onUpdateCustomPrimary,
        customPrimaryColor:
          settings.customPrimaryColor || initialState.customPrimaryColor,
        setColor: getColorPresets(
          settings.themeColorPresets,
          settings.customPrimaryColor
        ),
        colorOption: colorPresets.map((color) => ({
          name: color.name,
          value: color.main,
        })),

        // Reset
        onResetSetting,
        // Font
        onChangeFont, 
        onChangeFontSize,
        chatListRightAligned:
          typeof settings.chatListRightAligned === "boolean"
            ? settings.chatListRightAligned
            : initialState.chatListRightAligned,
        onToggleChatLayout,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export {SettingsContext};

export default SettingsProvider;
