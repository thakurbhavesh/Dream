import {
  DEFAULT_PROFILE as BASE_PROFILE,
  normalizeProfilePayload as baseNormalizeProfilePayload,
} from "../../../data/userProfile";

export const DEFAULT_PROFILE = BASE_PROFILE;
export const normalizeProfilePayload = baseNormalizeProfilePayload;

export const WALLPAPER_PRESETS = [
  {
    id: "default-pattern",
    label: "Default Pattern",
    preview: "/src/assets/Images/chat-bg-pattern.png",
  },
  {
    id: "texture1",
    label: "Texture 1",
    preview: "/texture/texture1.jpg",
  },
  {
    id: "texture2",
    label: "Texture 2",
    preview: "/texture/texture2.jpg",
  },
  {
    id: "texture3",
    label: "Texture 3",
    preview: "/texture/texture3.jpg",
  },
  {
    id: "texture4",
    label: "Texture 4",
    preview: "/texture/texture4.jpg",
  },
  {
    id: "texture5",
    label: "Texture 5",
    preview: "/texture/texture5.jpg",
  },
  {
    id: "texture6",
    label: "Texture 6",
    preview: "/texture/texture6.jpg",
  },
  {
    id: "texture7",
    label: "Texture 7",
    preview: "/texture/texture7.jpg",
  },
  {
    id: "samoyed-cute-dog",
    label: "Samoyed",
    preview: "/texture/samoyed-cute-dog.jpg",
  },
  {
    id: "maltese-dog",
    label: "Maltese",
    preview: "/texture/maltese-dog-cute.jpg",
  },
];

export const DEFAULT_WALLPAPER_SELECTION = {
  id: WALLPAPER_PRESETS[0].id,
  url: WALLPAPER_PRESETS[0].preview,
  type: "preset",
};
