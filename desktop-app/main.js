const { app, BrowserWindow, Menu, dialog, ipcMain, shell, session } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const { setupDownloadManager } = require("./downloadManager");
// electron-updater is only useful in packaged builds — fail soft so dev mode
// (where the binary is unsigned and there's no publish config) still works.
let autoUpdater = null;
try {
  autoUpdater = require("electron-updater").autoUpdater;
} catch {
  // Not installed yet — updates skipped at runtime.
}

const isDev = !app.isPackaged;
const DEV_URL = "http://localhost:5173/app";

// Single-instance lock — second launch focuses the existing window instead
// of opening another full process (which would mean two socket sessions).
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}
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
  } else if (process.platform === "darwin") {
    // macOS: show native traffic-light buttons but keep them flush so the
    // chrome blends with the app background. Without this the window is
    // borderless and there's no way to close/min/max with the mouse.
    windowOptions.titleBarStyle = "hiddenInset";
    windowOptions.frame = true;
    windowOptions.transparent = false;
  }

  const win = new BrowserWindow(windowOptions);

  if (isDev) {
    // During dev: load from Vite/React dev server
    win.loadURL(DEV_URL).catch((err) => {
      console.error("[main] dev server load failed (is `npm run dev` running?):", err.message);
    });
  } else {
    // In production: load the Vite build output. electron-builder copies
    // ../frontend/dist into resources/frontend (see extraResources in
    // package.json). For unpackaged dev installs we still fall back to
    // the in-repo frontend/dist so `npm start` from a fresh clone works.
    const candidates = [
      // Packaged (electron-builder extraResources)
      path.join(process.resourcesPath || "", "frontend", "index.html"),
      // Local repo dev / asar mode
      path.join(__dirname, "../frontend/dist/index.html"),
      // Legacy CRA path (back-compat)
      path.join(__dirname, "../chatx-frontend/build/index.html"),
    ];
    const indexPath = candidates.find((p) => p && fs.existsSync(p));
    if (indexPath) {
      win.loadFile(indexPath);
    } else {
      console.error("[main] frontend build not found. Run `npm run build` in /frontend first.");
      // Render a simple HTML so the user sees a clear error instead of a blank window
      win.loadURL(
        "data:text/html;charset=utf-8," +
        encodeURIComponent(
          '<body style="font-family:system-ui;padding:40px;color:#0f172a;background:#f8fafc">' +
          '<h1 style="margin:0 0 12px">TeamChatX desktop</h1>' +
          '<p>Frontend build was not found. Run:</p>' +
          '<pre style="background:#0f172a;color:#fff;padding:12px;border-radius:6px">cd frontend && npm run build</pre>' +
          '<p>Then launch this app again.</p></body>'
        )
      );
    }
  }

  return win;
}

// Permissions we want to allow from the renderer. Anything else (e.g.
// midi-sysex, openExternal that requires user gesture, hid, serial, etc.)
// is denied so a compromised page can't quietly demand sensitive access.
const ALLOWED_PERMISSIONS = new Set([
  "media",                   // mic / camera for calls
  "notifications",
  "clipboard-read",          // paste image into chat
  "clipboard-sanitized-write",
  "fullscreen",              // meeting full-screen
  "display-capture",         // screen share
  "geolocation",             // share location feature
]);

const buildApplicationMenu = () => {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    }] : []),
    {
      label: "File",
      submenu: [
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        ...(isMac
          ? [{ role: "pasteAndMatchStyle" }, { role: "delete" }, { role: "selectAll" }]
          : [{ role: "delete" }, { type: "separator" }, { role: "selectAll" }]),
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        ...(isDev ? [{ role: "toggleDevTools" }] : []),
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac ? [{ type: "separator" }, { role: "front" }] : [{ role: "close" }]),
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
};

app.whenReady().then(() => {
  if (isWindows) {
    app.setAppUserModelId(APP_USER_MODEL_ID);
  }

  Menu.setApplicationMenu(buildApplicationMenu());

  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details = {}) => {
      if (!ALLOWED_PERMISSIONS.has(permission)) {
        // Deny anything not on the allow-list (midi-sysex, hid, serial, etc.)
        callback(false);
        return;
      }
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
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ─── Auto-update wiring ───────────────────────────────────────────────────
// Lifecycle:
//  1. App boots →  autoUpdater.checkForUpdatesAndNotify() runs in background
//     (only in packaged builds).
//  2. If a newer release is found on GitHub, electron-updater downloads the
//     installer in the background. Renderer is notified via IPC events so it
//     can show a banner.
//  3. When the download completes the renderer can call
//     "updates:install-now" (a button on its banner) which restarts into
//     the new version. Otherwise the install runs the next time the user
//     quits the app naturally.
const broadcastUpdateEvent = (event, payload = {}) => {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send("updates:event", { event, data: payload });
    }
  });
};

const setupAutoUpdater = () => {
  if (!autoUpdater || isDev) {
    // Dev mode: no signed binary, nothing to update against. Quietly skip.
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on("checking-for-update", () => broadcastUpdateEvent("checking"));
  autoUpdater.on("update-available", (info) =>
    broadcastUpdateEvent("available", { version: info?.version, releaseNotes: info?.releaseNotes })
  );
  autoUpdater.on("update-not-available", () => broadcastUpdateEvent("up-to-date"));
  autoUpdater.on("error", (err) =>
    broadcastUpdateEvent("error", { message: err?.message || "Update check failed" })
  );
  autoUpdater.on("download-progress", (progress) =>
    broadcastUpdateEvent("progress", {
      percent: Math.round(progress?.percent || 0),
      bytesPerSecond: progress?.bytesPerSecond,
      transferred: progress?.transferred,
      total: progress?.total,
    })
  );
  autoUpdater.on("update-downloaded", (info) =>
    broadcastUpdateEvent("ready", { version: info?.version, releaseDate: info?.releaseDate })
  );

  // Run once on launch — and again every 4 hours while the app is open so
  // long-running sessions still pick up new releases.
  const runCheck = () => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.warn("[auto-update] check failed:", err?.message);
    });
  };
  // Slight delay so the window is ready to show a banner if needed.
  setTimeout(runCheck, 5_000);
  setInterval(runCheck, 4 * 60 * 60 * 1000);
};

// Renderer-triggered actions
ipcMain.handle("updates:check-now", async () => {
  if (!autoUpdater || isDev) return { ok: false, reason: "Updates only run in packaged builds." };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, info: result?.updateInfo || null };
  } catch (err) {
    return { ok: false, reason: err?.message || "Update check failed" };
  }
});

ipcMain.handle("updates:install-now", () => {
  if (!autoUpdater) return false;
  // quitAndInstall(isSilent, isForceRunAfter)
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return true;
});

ipcMain.handle("updates:get-version", () => ({
  current: app.getVersion(),
  packaged: app.isPackaged,
  platform: process.platform,
}));

// When the user launches the app a second time, focus the existing window.
app.on("second-instance", () => {
  const [existing] = BrowserWindow.getAllWindows();
  if (existing) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
  }
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
