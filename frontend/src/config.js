
// routes
import { PATH_DASHBOARD } from "./routes/paths";

export const defaultSettings = {
  themeMode: "light",
  themeDirection: "ltr",
  themeColorPresets: "default",
  customPrimaryColor: "#2065D1",
  fontType: "San Francisco Display",
  fontSize: "100%",
  chatListRightAligned: false,
};

export const NAVBAR = {
  BASE_WIDTH: 280,
  DASHBOARD_WIDTH: 280,
  DASHBOARD_COLLAPSE_WIDTH: 88,
  //
  DASHBOARD_ITEM_ROOT_HEIGHT: 48,
  DASHBOARD_ITEM_SUB_HEIGHT: 40,
  DASHBOARD_ITEM_HORIZONTAL_HEIGHT: 32,
};


// DEFAULT ROOT PATH
export const DEFAULT_PATH = PATH_DASHBOARD.general.app; // as '/app'
