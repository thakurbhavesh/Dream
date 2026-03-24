const path = require("path");
const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  Notification,
  Tray,
  nativeImage,
  shell,
  dialog,
} = require("electron");

let downloadManagerReady = false;
const activeDownloads = new Map(); // id -> { item, meta }
let trayInstance = null;

const classify = (input = "") => {
  const s = (input || "").toLowerCase();
  if (s.includes("pdf") || s.endsWith(".pdf")) return "PDF";
  if (
    s.includes("image/") ||
    /\.(png|jpe?g|gif|webp|svg|bmp|tiff|heic|avif)$/i.test(s)
  )
    return "Image";
  if (s.includes("zip") || /\.(zip|rar|7z|tar|gz|bz2|xz|tgz)$/i.test(s))
    return "Archive";
  if (s.includes("audio/") || /\.(mp3|wav|flac|aac|ogg|m4a|wma|aiff)$/i.test(s))
    return "Audio";
  if (s.includes("video/") || /\.(mp4|mkv|mov|avi|wmv|webm|m4v|flv)$/i.test(s))
    return "Video";
  if (/\.(docx?|odt|rtf|txt|md)$/i.test(s)) return "Document";
  if (/\.(xlsx?|csv|ods)$/i.test(s)) return "Spreadsheet";
  if (/\.(pptx?|key)$/i.test(s)) return "Presentation";
  if (/\.(exe|msi|dmg|pkg|appimage|apk)$/i.test(s)) return "Installer";
  if (
    /\.(js|ts|tsx|jsx|css|scss|json|xml|yml|yaml|sql|py|rb|php|java|kt|go|rs|cpp|c|cs)$/i.test(
      s
    )
  )
    return "Code";
  return "File";
};

const broadcast = (event, data) => {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send("downloads:event", { event, data });
    }
  });
};

const getTrayImage = () => {
  const iconName = process.platform === "win32" ? "icon.ico" : "256x256.ico";
  const trayPath = path.join(__dirname, "icons", iconName);
  const image = nativeImage.createFromPath(trayPath);
  return image.isEmpty() ? null : image;
};

const ensureTray = () => {
  if (trayInstance) return trayInstance;
  const trayImage = getTrayImage();
  if (!trayImage) return null;
  try {
    trayInstance = new Tray(trayImage);
    trayInstance.setToolTip("TeamChatX");
    trayInstance.on("click", () => {
      const [win] = BrowserWindow.getAllWindows();
      if (win) {
        if (win.isMinimized()) {
          win.restore();
        }
        win.show();
        win.focus();
      }
    });
  } catch (error) {
    console.warn("Failed to initialize tray", error);
    trayInstance = null;
  }
  return trayInstance;
};

const destroyTray = () => {
  if (trayInstance) {
    trayInstance.destroy();
    trayInstance = null;
  }
};

const resetProgressIndicators = () => {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.setProgressBar(-1);
    }
  });
  if (process.platform === "darwin" && app?.dock) {
    app.dock.setBadge("");
  } else if (typeof app.setBadgeCount === "function") {
    app.setBadgeCount(0);
  }
  destroyTray();
};

const updateGlobalProgress = () => {
  const inFlight = Array.from(activeDownloads.values()).filter(({ meta }) =>
    ["started", "progress"].includes(meta.state)
  );

  if (!inFlight.length) {
    resetProgressIndicators();
    return;
  }

  const totals = inFlight.reduce(
    (acc, { meta }) => {
      if (typeof meta.received === "number") {
        acc.received += meta.received;
      }
      if (typeof meta.total === "number" && meta.total > 0) {
        acc.total += meta.total;
      }
      return acc;
    },
    { received: 0, total: 0 }
  );

  const ratio =
    totals.total > 0
      ? Math.min(1, Math.max(0, totals.received / totals.total))
      : null;

  BrowserWindow.getAllWindows().forEach((win) => {
    if (win.isDestroyed()) return;
    if (ratio == null) {
      win.setProgressBar(2, { mode: "indeterminate" });
    } else {
      win.setProgressBar(ratio);
    }
  });

  const percentLabel =
    ratio == null ? "..." : `${Math.max(0, Math.round(ratio * 100))}%`;

  if (process.platform === "darwin" && app?.dock) {
    app.dock.setBadge(percentLabel);
  } else if (typeof app.setBadgeCount === "function" && ratio != null) {
    app.setBadgeCount(Math.max(1, Math.round(ratio * 100)));
  }

  const tray = ensureTray();
  if (tray) {
    tray.setToolTip(`Downloads ${percentLabel}`);
    if (typeof tray.setTitle === "function") {
      tray.setTitle(percentLabel);
    }
  }
};

const fireNativeNotification = (meta) => {
  if (!Notification || !Notification.isSupported()) return;
  const friendlyType = classify(`${meta.mime || ""} ${meta.name || ""}`);
  const downloadPath = meta.path || "";
  let folderLabel = "Downloads";
  if (downloadPath) {
    try {
      const folderPath = path.dirname(downloadPath);
      const folderName = folderPath.split(path.sep).pop();
      folderLabel = folderName || "Folder";
    } catch {
      folderLabel = "Folder";
    }
  }
  const title = `Download complete • ${friendlyType}`;
  const bodyParts = [
    `File: ${meta.name || "Unnamed file"}`,
    `Saved to: ${folderLabel}`,
  ];
  try {
    const notification = new Notification({
      title,
      body: bodyParts.join("\n"),
      silent: false,
    });
    notification.show();
  } catch (error) {
    console.warn("Failed to present notification", error);
  }
};

const serializeMeta = (meta) => ({
  id: meta.id,
  name: meta.name,
  mime: meta.mime,
  total: meta.total ?? null,
  received: meta.received ?? null,
  percent:
    typeof meta.percent === "number"
      ? Math.max(0, Math.min(100, Math.round(meta.percent)))
      : null,
  state: meta.state,
  path: meta.path ?? null,
  message: meta.message ?? null,
  startedAt: meta.startedAt,
  canResume: Boolean(meta.canResume),
  sourceUrl: meta.sourceUrl ?? null,
});

const makeDownloadId = (() => {
  let index = 0;
  return () => {
    index = (index + 1) % 100000;
    return `dl-${Date.now()}-${index}`;
  };
})();

const readSavePath = (item) => {
  if (!item) return null;
  if (typeof item.getSavePath === "function") {
    const value = item.getSavePath();
    if (value) return value;
  }
  if (typeof item.getFilename === "function") {
    const defaultDir = app.getPath("downloads");
    return path.join(defaultDir, item.getFilename());
  }
  return null;
};

const registerDownloadEvents = () => {
  session.defaultSession.on("will-download", (event, item) => {
    const guid =
      typeof item.getGUID === "function" ? item.getGUID() : makeDownloadId();
    const id = guid || makeDownloadId();
    const suggestedPath = path.join(
      app.getPath("downloads"),
      item.getFilename()
    );

    let finalSavePath = suggestedPath;
    if (dialog && typeof dialog.showSaveDialogSync === "function") {
      try {
        const chosenPath = dialog.showSaveDialogSync({
          title: "Save download as",
          defaultPath: suggestedPath,
          buttonLabel: "Save",
        });
        if (chosenPath) {
          finalSavePath = chosenPath;
        } else {
          item.cancel();
          return;
        }
      } catch (error) {
        console.warn("Save dialog failed, falling back to default path", error);
      }
    }

    try {
      if (typeof item.setSavePath === "function") {
        item.setSavePath(finalSavePath);
      }
    } catch {
      // ignore save path failures
    }

    const meta = {
      id,
      name: item.getFilename(),
      mime: item.getMimeType(),
      total: item.getTotalBytes() > 0 ? item.getTotalBytes() : null,
      received: 0,
      percent: null,
      state: "started",
      path: finalSavePath,
      startedAt: Date.now(),
      canResume: typeof item.canResume === "function" ? item.canResume() : false,
      sourceUrl: item.getURL ? item.getURL() : null,
    };
    activeDownloads.set(id, { item, meta });
    broadcast("started", serializeMeta(meta));
    updateGlobalProgress();

    item.on("updated", (_evt, state) => {
      const entry = activeDownloads.get(id);
      if (!entry) return;
      const paused = typeof item.isPaused === "function" && item.isPaused();
      entry.meta.state =
        state === "interrupted" ? "error" : paused ? "paused" : "progress";
      entry.meta.received = item.getReceivedBytes();
      const totalBytes = item.getTotalBytes();
      if (totalBytes > 0) {
        entry.meta.total = totalBytes;
        entry.meta.percent =
          totalBytes > 0 ? (entry.meta.received / totalBytes) * 100 : null;
      }
      entry.meta.canResume =
        typeof item.canResume === "function" ? item.canResume() : false;
      broadcast("progress", serializeMeta(entry.meta));
      updateGlobalProgress();
    });

    item.once("done", (_evt, state) => {
      const entry = activeDownloads.get(id);
      if (!entry) return;
      entry.meta.path = readSavePath(item);
      entry.meta.received = item.getReceivedBytes();
      entry.meta.total =
        item.getTotalBytes() > 0 ? item.getTotalBytes() : entry.meta.total;

      if (state === "completed") {
        entry.meta.state = "done";
        entry.meta.percent = 100;
        entry.meta.canResume = false;
        broadcast("done", serializeMeta(entry.meta));
        fireNativeNotification(entry.meta);
      } else if (state === "cancelled") {
        entry.meta.state = "cancelled";
        entry.meta.canResume = false;
        broadcast("cancelled", { id });
      } else {
        entry.meta.state = "error";
        entry.meta.message = "Download interrupted";
        entry.meta.canResume = false;
        broadcast("error", { id, message: entry.meta.message });
      }

      activeDownloads.delete(id);
      updateGlobalProgress();
    });
  });

  ipcMain.handle("downloads:cancel", (_event, id) => {
    const entry = activeDownloads.get(id);
    if (!entry) return false;
    try {
      entry.item.cancel();
      return true;
    } catch (error) {
      console.warn("Failed to cancel download", error);
      return false;
    }
  });

  ipcMain.handle("downloads:pause", (_event, id) => {
    const entry = activeDownloads.get(id);
    if (!entry) return false;
    try {
      if (
        typeof entry.item.pause === "function" &&
        !entry.item.isPaused?.() &&
        entry.item.canResume?.()
      ) {
        entry.item.pause();
        entry.meta.state = "paused";
        broadcast("paused", serializeMeta(entry.meta));
        updateGlobalProgress();
        return true;
      }
    } catch (error) {
      console.warn("Failed to pause download", error);
    }
    return false;
  });

  ipcMain.handle("downloads:resume", (_event, id) => {
    const entry = activeDownloads.get(id);
    if (!entry) return false;
    try {
      if (typeof entry.item.resume === "function" && entry.item.isPaused?.()) {
        entry.item.resume();
        entry.meta.state = "progress";
        broadcast("resumed", serializeMeta(entry.meta));
        updateGlobalProgress();
        return true;
      }
    } catch (error) {
      console.warn("Failed to resume download", error);
    }
    return false;
  });

  ipcMain.handle("downloads:open-path", (_event, filePath) => {
    if (!filePath) return false;
    try {
      const result = shell.openPath(filePath);
      if (result && typeof result.then === "function") {
        result.catch(() => {});
      }
      return true;
    } catch (error) {
      console.warn("Failed to open file", error);
      return false;
    }
  });

  ipcMain.handle("downloads:show-in-folder", (_event, filePath) => {
    if (!filePath) return false;
    try {
      shell.showItemInFolder(filePath);
      return true;
    } catch (error) {
      console.warn("Failed to reveal file", error);
      return false;
    }
  });

  ipcMain.handle("downloads:open-source", (_event, url) => {
    if (!url) return false;
    try {
      shell.openExternal(url);
      return true;
    } catch (error) {
      console.warn("Failed to open source url", error);
      return false;
    }
  });

  ipcMain.handle("downloads:snapshot", () => {
    return Array.from(activeDownloads.values()).map(({ meta }) =>
      serializeMeta(meta)
    );
  });
};

const setupDownloadManager = () => {
  if (downloadManagerReady) return;
  if (!session?.defaultSession) return;
  registerDownloadEvents();
  downloadManagerReady = true;
};

module.exports = { setupDownloadManager };
