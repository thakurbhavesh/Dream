// src/data/authHighlights.js
import { MdSpaceDashboard, MdInsights, MdSecurity } from "react-icons/md";
import { RiTeamFill } from "react-icons/ri";
import { PiChatsCircleFill } from "react-icons/pi";

export const AUTH_FEATURE_SLIDES = [
  {
    id: "admin-console",
    label: "Admin dashboard",
    title: "Total control in one view",
    status: "Live now",
    meter: 95,
    description: "Monitor rooms, manage roles, and drop in/out of conversations without leaving the panel.",
    icon: PiChatsCircleFill,
  },
  {
    id: "dynamic-theme",
    label: "Dynamic theming",
    title: "Match your brand palette",
    status: "Trending feature",
    meter: 88,
    description: "Switch between preset and custom themes so the chat feels native to your org.",
    icon: MdSpaceDashboard,
  },
  {
    id: "brand-logo",
    label: "Custom logo",
    title: "Drop in your identity",
    status: "Beta rollout",
    meter: 82,
    description: "Upload a logo so the experience looks exactly like your in-house chat stack.",
    icon: RiTeamFill,
  },
  {
    id: "translate",
    label: "Inline translation",
    title: "Understand every message",
    status: "Always on",
    meter: 86,
    description: "Translate chats into your preferred language instantly—no context switching.",
    icon: MdSecurity,
  },
  {
    id: "quick-react",
    label: "Emoji reactions",
    title: "Respond in a tap",
    status: "New",
    meter: 79,
    description: "Drop lightweight emoji responses to keep conversations fast and expressive.",
    icon: MdInsights,
  },
];

export const AUTH_LEFT_FEATURES = {
  login: {
    label: "Highlighted",
    title: "Unified alerts hub",
    description: "All escalations arrive in one stream so your teams react faster.",
    icon: PiChatsCircleFill,
  },
  register: {
    label: "Setup tip",
    title: "One form for your org",
    description: "Invite admins, link domains, and map teams in the same flow.",
    icon: RiTeamFill,
  },
  reset: {
    label: "Secure",
    title: "Zero-trust recovery",
    description: "Encrypted links expire in minutes to keep accounts safe.",
    icon: MdSecurity,
  },
  newPassword: {
    label: "Step 2",
    title: "Finish resetting",
    description: "Choose a strong passphrase to protect your workspace.",
    icon: MdSecurity,
  },
};
