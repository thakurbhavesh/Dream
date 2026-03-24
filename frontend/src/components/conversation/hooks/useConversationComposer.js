import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSecureStorageValue from "../../../hooks/useSecureStorageValue.js";
import { SETTINGS_STORAGE_KEYS } from "../../../pages/dashboard/settings/storageKeys.js";
import {
  parseJsonValue,
  persistJsonValue,
} from "../../../pages/dashboard/settings/utils.js";
import { DEFAULT_PERMISSIONS } from "../../../pages/dashboard/settings/permissionsConfig.js";

const DEFAULT_SNACKBAR_STATE = {
  open: false,
  message: "",
  severity: "info",
  actionLabel: null,
  actionHandler: null,
};

const useConversationComposer = () => {
  const [snackbar, setSnackbar] = useState(DEFAULT_SNACKBAR_STATE);
  const storedPermissionsRaw = useSecureStorageValue(
    SETTINGS_STORAGE_KEYS.permissions,
    JSON.stringify(DEFAULT_PERMISSIONS)
  );

  const showSnackbar = useCallback((message, severity = "info", action = null) => {
    setSnackbar({
      open: true,
      message,
      severity,
      actionLabel: action?.label || null,
      actionHandler: action?.handler || null,
    });
  }, []);

  const handleSnackbarClose = useCallback(() => {
    setSnackbar((prev) => ({
      ...prev,
      open: false,
      actionLabel: null,
      actionHandler: null,
    }));
  }, []);

  const handleSnackbarAction = useCallback(() => {
    const finalize = () =>
      setSnackbar((prev) => ({
        ...prev,
        open: false,
        actionLabel: null,
        actionHandler: null,
      }));
    if (typeof snackbar.actionHandler === "function") {
      try {
        const result = snackbar.actionHandler();
        if (result?.then) {
          result
            .catch((error) =>
              console.warn("Snackbar action promise rejected", error)
            )
            .finally(finalize);
          return;
        }
      } catch (error) {
        console.warn("Snackbar action error", error);
      }
    }
    finalize();
  }, [snackbar]);

  const normalizePermissions = useCallback((rawValue) => {
    const parsed = parseJsonValue(rawValue, null);
    const baseList = Array.isArray(parsed) ? parsed : DEFAULT_PERMISSIONS;
    return DEFAULT_PERMISSIONS.map((perm) => {
      const existing = baseList.find((item) => item.id === perm.id);
      return existing ? { ...perm, ...existing } : perm;
    });
  }, []);

  const [permissionList, setPermissionList] = useState(() =>
    normalizePermissions(storedPermissionsRaw)
  );

  useEffect(() => {
    setPermissionList(normalizePermissions(storedPermissionsRaw));
  }, [normalizePermissions, storedPermissionsRaw]);

  const permissionMap = useMemo(
    () =>
      permissionList.reduce((acc, perm) => {
        acc[perm.id] = perm.enabled !== false;
        return acc;
      }, {}),
    [permissionList]
  );

  const [systemPermissions, setSystemPermissions] = useState({
    microphone: null,
    camera: null,
  });

  const broadcastPermissionSync = useCallback((payload) => {
    if (typeof window === "undefined") return;
    const bridge = window.electron?.ipcRenderer;
    if (!bridge?.send) return;
    try {
      bridge.send("permissions:update", payload);
    } catch (error) {
      console.warn("Failed to broadcast permissions", error);
    }
  }, []);

  const updatePermissionState = useCallback(
    async (permissionId, enabled) => {
      let nextList = null;
      setPermissionList((prev) => {
        nextList = prev.map((perm) =>
          perm.id === permissionId ? { ...perm, enabled } : perm
        );
        return nextList;
      });
      if (!nextList) return;
      try {
        await persistJsonValue(SETTINGS_STORAGE_KEYS.permissions, nextList);
        broadcastPermissionSync(nextList);
      } catch (error) {
        console.warn("Failed to persist permissions", error);
      }
    },
    [broadcastPermissionSync]
  );

  const refreshSystemPermissions = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      return;
    }
    const updateState = (permissionName, state) => {
      setSystemPermissions((prev) => ({
        ...prev,
        [permissionName]: state,
      }));
    };
    try {
      const microphoneStatus = await navigator.permissions.query({
        name: "microphone",
      });
      updateState("microphone", microphoneStatus.state);
    } catch (error) {
      // ignore when browser does not expose microphone permission via API
    }
    try {
      const cameraStatus = await navigator.permissions.query({
        name: "camera",
      });
      updateState("camera", cameraStatus.state);
    } catch (error) {
      // ignore when browser does not expose camera permission via API
    }
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      return undefined;
    }
    let disposed = false;
    const unsubs = [];

    const attachWatcher = async (permissionName) => {
      try {
        const status = await navigator.permissions.query({
          name: permissionName,
        });
        if (disposed) return;
        const handleChange = () => {
          setSystemPermissions((prev) => ({
            ...prev,
            [permissionName]: status.state,
          }));
        };
        handleChange();
        status.addEventListener("change", handleChange);
        unsubs.push(() =>
          status.removeEventListener("change", handleChange)
        );
      } catch (error) {
        // Browser might not support querying this permission.
      }
    };

    attachWatcher("microphone");
    attachWatcher("camera");
    refreshSystemPermissions();

    return () => {
      disposed = true;
      unsubs.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch {
          // ignore
        }
      });
    };
  }, [refreshSystemPermissions]);

  const requestMediaPermission = useCallback(
    async (type) => {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        return false;
      }
      const constraints =
        type === "video"
          ? { audio: true, video: { facingMode: "user" } }
          : { audio: true };
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        stream.getTracks().forEach((track) => track.stop());
        refreshSystemPermissions();
        return true;
      } catch (error) {
        console.warn(`Failed to request ${type} permission`, error);
        refreshSystemPermissions();
        return false;
      }
    },
    [refreshSystemPermissions]
  );

  const promptPermissionEnable = useCallback(
    (permissionId, label, mediaType = null) => {
      showSnackbar(
        `${label} permission is disabled for this workspace.`,
        "warning",
        {
          label: `Enable ${label}`,
          handler: async () => {
            await updatePermissionState(permissionId, true);
            if (mediaType) {
              await requestMediaPermission(mediaType);
            }
            showSnackbar(`${label} permission enabled`, "success");
          },
        }
      );
    },
    [requestMediaPermission, showSnackbar, updatePermissionState]
  );

  const ensurePermissionFlow = useCallback(
    async ({ appAllowed, permissionId, label, mediaType, systemKey }) => {
      if (!appAllowed) {
        promptPermissionEnable(permissionId, label, mediaType);
        return false;
      }
      const systemState = systemPermissions[systemKey];
      if (systemState === "granted" || systemState === null) {
        return true;
      }
      if (systemState === "prompt") {
        const granted = await requestMediaPermission(mediaType);
        return granted;
      }
      showSnackbar(
        `${label} access is blocked by your browser. Allow it from the address bar and try again.`,
        "error",
        {
          label: "Retry",
          handler: () => requestMediaPermission(mediaType),
        }
      );
      return false;
    },
    [
      promptPermissionEnable,
      requestMediaPermission,
      showSnackbar,
      systemPermissions,
    ]
  );

  const isMicrophoneAllowed = permissionMap.microphone !== false;
  const isCameraAllowed = permissionMap.camera !== false;

  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const closeVideoDialog = useCallback(() => setVideoDialogOpen(false), []);

  const handleVideoButton = useCallback(async () => {
    const cameraReady = await ensurePermissionFlow({
      appAllowed: isCameraAllowed,
      permissionId: "camera",
      label: "Camera",
      mediaType: "video",
      systemKey: "camera",
    });
    const microphoneReady = await ensurePermissionFlow({
      appAllowed: isMicrophoneAllowed,
      permissionId: "microphone",
      label: "Microphone",
      mediaType: "audio",
      systemKey: "microphone",
    });
    if (!cameraReady || !microphoneReady) {
      showSnackbar(
        "Opening recorder without full device access. Please check permissions.",
        "warning"
      );
    }
    setVideoDialogOpen(true);
  }, [ensurePermissionFlow, isCameraAllowed, isMicrophoneAllowed, showSnackbar]);

  const sendQueueRef = useRef([]);
  const sendProcessingRef = useRef(false);

  const processSendQueue = useCallback(() => {
    if (sendProcessingRef.current) return;
    const task = sendQueueRef.current.shift();
    if (!task) return;
    sendProcessingRef.current = true;
    Promise.resolve()
      .then(() => task())
      .catch((error) => {
        console.error("Send queue error", error);
        showSnackbar("Failed to process message", "error");
      })
      .finally(() => {
        sendProcessingRef.current = false;
        processSendQueue();
      });
  }, [showSnackbar]);

  const enqueueSendTask = useCallback(
    (task) => {
      sendQueueRef.current.push(task);
      processSendQueue();
    },
    [processSendQueue]
  );

  const dispatchRecordingPayload = useCallback(
    (payload) => {
      if (!payload) return;
      enqueueSendTask(() => {
        console.log(
          `[${payload.type === "audio" ? "Audio" : "Video"} Recording Sent]`,
          payload.file || payload.blob
        );
        showSnackbar(
          `${payload.type === "audio" ? "Audio" : "Video"} recording sent`,
          "success"
        );
      });
    },
    [enqueueSendTask, showSnackbar]
  );

  return {
    snackbar,
    showSnackbar,
    handleSnackbarClose,
    handleSnackbarAction,
    ensurePermissionFlow,
    isMicrophoneAllowed,
    isCameraAllowed,
    handleVideoButton,
    videoDialogOpen,
    closeVideoDialog,
    enqueueSendTask,
    dispatchRecordingPayload,
  };
};

export default useConversationComposer;
