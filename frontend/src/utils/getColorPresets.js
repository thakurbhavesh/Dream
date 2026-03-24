// theme
import { darken, getContrastRatio, lighten } from "@mui/material/styles";
import palette from "../theme/palette";

const buildPreset = (name, main) => {
  const lighter = lighten(main, 0.52);
  const light = lighten(main, 0.24);
  const dark = darken(main, 0.26);
  const darker = darken(main, 0.4);
  const contrastText =
    getContrastRatio(main, "#fff") >= 4.5 ? "#fff" : "#000";

  return {
    name,
    lighter,
    light,
    main,
    dark,
    darker,
    contrastText,
  };
};

export const colorPresets = [
  {
    name: "default",
    ...palette.light.primary,
  },
  buildPreset("purple", "#7635DC"),
  buildPreset("cyan", "#1CCAFF"),
  buildPreset("teal", "#00A98F"),
  buildPreset("orange", "#F79E1B"),
  buildPreset("red", "#FF3D57"),
  buildPreset("navy", "#0F2965"),
  buildPreset("slate", "#456E7A"),
  buildPreset("pink", "#D64291"),
];

export const defaultPreset = colorPresets[0];
export const purplePreset = colorPresets[1];
export const cyanPreset = colorPresets[2];
export const tealPreset = colorPresets[3];
export const orangePreset = colorPresets[4];
export const redPreset = colorPresets[5];
export const navyPreset = colorPresets[6];
export const slatePreset = colorPresets[7];
export const pinkPreset = colorPresets[8];

const hexPattern = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

const legacyPresets = {
  blue: buildPreset("blue", "#2065D1"),
  chetwodeBlue: buildPreset("chetwodeBlue", "#6680B6"),
  black: buildPreset("black", "#2E3A3A"),
};

export const createPresetFromColor = (mainColor) => {
  const fallback = defaultPreset.main;
  const main = hexPattern.test(mainColor || "") ? mainColor : fallback;

  const lighter = lighten(main, 0.52);
  const light = lighten(main, 0.24);
  const dark = darken(main, 0.26);
  const darker = darken(main, 0.4);
  const contrastText =
    getContrastRatio(main, "#fff") >= 4.5 ? "#fff" : "#000";

  return {
    name: "custom",
    lighter,
    light,
    main,
    dark,
    darker,
    contrastText,
  };
};

export default function getColorPresets(presetsKey, customColor) {
  const presetMap = {
    purple: purplePreset,
    cyan: cyanPreset,
    teal: tealPreset,
    orange: orangePreset,
    red: redPreset,
    navy: navyPreset,
    slate: slatePreset,
    default: defaultPreset,
    pink: pinkPreset,
  };

  if (presetsKey === "custom") {
    return createPresetFromColor(customColor);
  }

  return presetMap[presetsKey] || legacyPresets[presetsKey] || defaultPreset;
}
