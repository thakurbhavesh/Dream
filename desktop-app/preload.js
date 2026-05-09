const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("versions", {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
});

contextBridge.exposeInMainWorld("electron", {
  isElectron: true,
  notificationBridge: {
    getContext: () => ipcRenderer.invoke("notifications:get-context"),
    getSystemPreference: () =>
      ipcRenderer.invoke("notifications:get-system-preference"),
    setSystemPreference: (enabled) =>
      ipcRenderer.invoke("notifications:set-system-preference", enabled),
    openSystemSettings: () =>
      ipcRenderer.invoke("notifications:open-settings"),
  },
  ipcRenderer: {
    send: (...args) => ipcRenderer.send(...args),
  },
});

contextBridge.exposeInMainWorld("downloads", {
  on: (eventName, handler) => {
    if (typeof handler !== "function") return () => {};
    const listener = (_event, payload) => {
      if (!payload || payload.event !== eventName) return;
      handler(payload.data);
    };
    ipcRenderer.on("downloads:event", listener);
    return () => ipcRenderer.removeListener("downloads:event", listener);
  },
  cancel: (id) => ipcRenderer.invoke("downloads:cancel", id),
  snapshot: () => ipcRenderer.invoke("downloads:snapshot"),
  pause: (id) => ipcRenderer.invoke("downloads:pause", id),
  resume: (id) => ipcRenderer.invoke("downloads:resume", id),
  openFile: (filePath) => ipcRenderer.invoke("downloads:open-path", filePath),
  showInFolder: (filePath) =>
    ipcRenderer.invoke("downloads:show-in-folder", filePath),
  openSource: (url) => ipcRenderer.invoke("downloads:open-source", url),
});

// Auto-update bridge — renderer subscribes to events, can trigger an
// immediate check, and can request "install now" once an update is ready.
contextBridge.exposeInMainWorld("updates", {
  on: (eventName, handler) => {
    if (typeof handler !== "function") return () => {};
    const listener = (_event, payload) => {
      if (!payload || (eventName && payload.event !== eventName)) return;
      handler(payload.event, payload.data);
    };
    ipcRenderer.on("updates:event", listener);
    return () => ipcRenderer.removeListener("updates:event", listener);
  },
  checkNow: () => ipcRenderer.invoke("updates:check-now"),
  installNow: () => ipcRenderer.invoke("updates:install-now"),
  getVersion: () => ipcRenderer.invoke("updates:get-version"),
});
