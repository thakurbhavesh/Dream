const { app, BrowserWindow, ipcMain, shell, session } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const { setupDownloadManager } = require("./downloadManager");

const isDev = !app.isPackaged;
const APP_USER_MODEL_ID = "com.teamchatx.desktop";
const WIN_NOTIFICATION_REG_PATH = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings\\${APP_USER_MODEL_ID}`;
const isWindows = process.platform === "win32";
// Use fully transparent background so Windows doesn't draw the default white titlebar
const WINDOW_ACCENT_COLOR = "#00000000";

let windowsNotificationPreferenceCache = {
  loaded: false,
  value: null,
};
let rendererPermissions = null;

const updateRendererPermissions = (value) => {
  if (Array.isArray(value)) {
    rendererPermissions = value;
  }
};

const isRendererPermissionEnabled = (permissionId) => {
  if (!Array.isArray(rendererPermissions)) {
    return true;
  }
  const entry = rendererPermissions.find(
    (item) => item?.id === permissionId
  );
  if (!entry) {
    return true;
  }
  return entry.enabled !== false;
};

const readWindowsNotificationPreference = (forceRefresh = false) =>
  new Promise((resolve) => {
    if (!isWindows) {
      resolve(null);
      return;
    }

    if (!forceRefresh && windowsNotificationPreferenceCache.loaded) {
      resolve(windowsNotificationPreferenceCache.value);
      return;
    }

    exec(
      `reg.exe query "${WIN_NOTIFICATION_REG_PATH}" /v Enabled`,
      (error, stdout) => {
        if (error) {
          resolve(windowsNotificationPreferenceCache.value);
          return;
        }
        const match = stdout.match(/Enabled\s+REG_DWORD\s+0x([0-9a-f]+)/i);
        if (!match) {
          resolve(windowsNotificationPreferenceCache.value);
          return;
        }
        const parsedValue = parseInt(match[1], 16) === 1;
        windowsNotificationPreferenceCache = {
          loaded: true,
          value: parsedValue,
        };
        resolve(parsedValue);
      }
    );
  });

const writeWindowsNotificationPreference = (enabled) =>
  new Promise((resolve, reject) => {
    if (!isWindows) {
      resolve(false);
      return;
    }

    exec(
      `reg.exe add "${WIN_NOTIFICATION_REG_PATH}" /v Enabled /t REG_DWORD /d ${
        enabled ? 1 : 0
      } /f`,
      (error) => {
        if (error) {
          console.error("Failed to update notification registry", error);
          reject(error);
          return;
        }
        windowsNotificationPreferenceCache = {
          loaded: true,
          value: Boolean(enabled),
        };
        resolve(true);
      }
    );
  });

function createWindow() {
  const windowOptions = {
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    title: "TeamChatX",
    icon: path.join(__dirname, "icons/icon.ico"),
    autoHideMenuBar: true,
    transparent: true,
    frame: false,
    backgroundColor: WINDOW_ACCENT_COLOR,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false,
      
    },
  };

  if (isWindows) {
    windowOptions.titleBarStyle = "hidden";
    windowOptions.titleBarOverlay = {
      color: WINDOW_ACCENT_COLOR,
      symbolColor: "#ffffff",
      height: 36,
    };
  }

  const win = new BrowserWindow(windowOptions);

  if (isDev) {
    // During dev: load from Vite/React dev server
    win.loadURL("http://localhost:5173/app");
  } else {
    // In production: load built index.html
    const indexPath = path.join(
      __dirname,
      "../chatx-frontend/build/index.html"
    );
    if (fs.existsSync(indexPath)) {
      win.loadFile(indexPath);
    } else {
      console.error("Build not found! Run frontend build first.");
    }
  }
}

app.whenReady().then(() => {
  if (isWindows) {
    app.setAppUserModelId(APP_USER_MODEL_ID);
  }

  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details = {}) => {
      if (permission === "media") {
        const mediaTypes = Array.isArray(details.mediaTypes)
          ? details.mediaTypes
          : [];
        const wantsAudio = mediaTypes.includes("audio");
        const wantsVideo = mediaTypes.includes("video");
        if (
          (wantsAudio && !isRendererPermissionEnabled("microphone")) ||
          (wantsVideo && !isRendererPermissionEnabled("camera"))
        ) {
          callback(false);
          return;
        }
      }
      callback(true);
    }
  );

  createWindow();
  setupDownloadManager();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("notifications:get-context", () => ({
  runtime: "electron",
  platform: process.platform,
  appUserModelId: APP_USER_MODEL_ID,
  isWindows,
}));

ipcMain.handle("notifications:get-system-preference", async () => {
  if (!isWindows) {
    return { supported: false, enabled: null };
  }
  const enabled = await readWindowsNotificationPreference();
  return { supported: true, enabled };
});

ipcMain.handle("notifications:set-system-preference", async (_, enabled) => {
  if (!isWindows) {
    return false;
  }
  try {
    await writeWindowsNotificationPreference(Boolean(enabled));
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("notifications:open-settings", () => {
  if (process.platform === "win32") {
    exec("start ms-settings:notifications");
    return true;
  }

  if (process.platform === "darwin") {
    shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.notifications"
    );
    return true;
  }

  shell.openExternal("chrome://settings/content/notifications");
  return true;
});

ipcMain.on("permissions:update", (_, payload) => {
  updateRendererPermissions(payload);
});
