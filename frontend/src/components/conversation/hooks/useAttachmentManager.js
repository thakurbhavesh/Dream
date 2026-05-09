import { useCallback, useEffect, useRef, useState } from "react";
import { optimizeImageForUpload } from "../../../utils/imageProcessor";

export const createAttachmentId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `att-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const isImageFile = (file) => {
  if (!file) return false;
  const mime = String(file.type || "").toLowerCase();
  return /^image\/(jpeg|png|webp|heic|heif|gif|bmp|tiff)$/.test(mime);
};

const getFileSignature = (file) => {
  if (!file) return null;
  return [
    file.name || "",
    Number.isFinite(file.size) ? file.size : 0,
    file.type || "",
    Number.isFinite(file.lastModified) ? file.lastModified : 0,
  ].join("::");
};

// Must match backend multerChat.js BLOCKED_EXTENSIONS
const BLOCKED_EXTENSIONS = new Set([
  ".exe",".msi",".com",".scr",".pif",
  ".bat",".cmd",".sh",".bash",".ps1",".psm1",".vbs",".vbe",".js",".jse",".wsf",".wsh",
  ".dll",".sys",".drv",".ocx",".cpl",
  ".deb",".rpm",".dmg",".app",".appimage",
  ".lnk",".url",".scf",
  ".reg",".inf",
  ".jar",".class",
  ".docm",".xlsm",".pptm",".dotm",".xltm",
  ".hta",".crt",".ins",".isp",".msp",".mst",".sct",".ws",
]);

const isDangerousFile = (file) => {
  if (!file?.name) return false;
  const ext = (file.name.lastIndexOf(".") >= 0 ? file.name.slice(file.name.lastIndexOf(".")) : "").toLowerCase();
  return BLOCKED_EXTENSIONS.has(ext);
};

const useAttachmentManager = ({ showSnackbar }) => {
  const [attachments, setAttachments] = useState([]);
  const attachmentsRef = useRef([]);
  const attachmentFileStoreRef = useRef(new Map());
  const attachmentSignatureRef = useRef(new Map());

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const addAttachments = useCallback(
    (files, typeLabelResolver) => {
      if (!Array.isArray(files) || files.length === 0) return;
      // Block dangerous file types at selection time (matches backend multerChat.js)
      const safeFiles = files.filter((f) => {
        if (isDangerousFile(f)) {
          const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
          showSnackbar?.(`File type "${ext}" is not allowed`, "error");
          return false;
        }
        return true;
      });
      if (!safeFiles.length) return;
      const descriptors = [];
      safeFiles.forEach((file) => {
        if (!file) return;
        const signature = getFileSignature(file);
        const duplicate = signature
          ? attachmentSignatureRef.current.has(signature)
          : false;
        if (duplicate) {
          showSnackbar?.("File already attached", "info");
          return;
        }
        const id = createAttachmentId();
        const descriptor = {
          id,
          name: file.name,
          typeLabel:
            typeof typeLabelResolver === "function"
              ? typeLabelResolver(file)
              : typeLabelResolver || "File",
          size: file.size,
          mime: file.type || "application/octet-stream",
          lastModified: file.lastModified,
        };
        attachmentFileStoreRef.current.set(id, file);
        if (signature) {
          attachmentSignatureRef.current.set(signature, id);
        }
        descriptors.push(descriptor);
      });
      if (descriptors.length) {
        setAttachments((prev) => [...prev, ...descriptors]);
      }

      // Silent image optimisation — auto-resize huge photos and pick a
      // smarter format (HEIC → JPEG, PNG-photo → WebP, etc.). Failures
      // fall back to the original file inside optimizeImageForUpload, so
      // the worst case is "no saving" and never a failed send.
      descriptors.forEach((descriptor) => {
        const stored = attachmentFileStoreRef.current.get(descriptor.id);
        if (!isImageFile(stored)) return;
        Promise.resolve()
          .then(() => optimizeImageForUpload(stored))
          .then((optimised) => {
            if (!optimised || optimised === stored) return;
            const stillThere = attachmentFileStoreRef.current.get(descriptor.id);
            if (!stillThere) return; // user removed the chip mid-process
            // Swap the underlying File so the upload uses the smaller version.
            attachmentFileStoreRef.current.set(descriptor.id, optimised);
            // Refresh the signature index so duplicate-detection stays sane.
            const oldSig = getFileSignature(stillThere);
            if (oldSig) attachmentSignatureRef.current.delete(oldSig);
            const newSig = getFileSignature(optimised);
            if (newSig) attachmentSignatureRef.current.set(newSig, descriptor.id);
            // Reflect new size / mime / name in the visible chip.
            setAttachments((prev) =>
              prev.map((item) =>
                item.id === descriptor.id
                  ? {
                      ...item,
                      name: optimised.name,
                      size: optimised.size,
                      mime: optimised.type || item.mime,
                      lastModified: optimised.lastModified,
                    }
                  : item
              )
            );
          })
          .catch((err) => {
            // Optimisation is best-effort; don't bother the user.
            console.warn("[attachments] image optimise failed:", err?.message);
          });
      });
    },
    [showSnackbar]
  );

  /**
   * Replace the underlying File for an existing attachment (e.g. after
   * background removal). Updates descriptor metadata and signature index
   * so dedup + chip rendering stay in sync.
   */
  const replaceAttachmentFile = useCallback((id, nextFile) => {
    if (!id || !nextFile) return;
    const current = attachmentFileStoreRef.current.get(id);
    if (!current) return;
    const oldSig = getFileSignature(current);
    if (oldSig) attachmentSignatureRef.current.delete(oldSig);
    attachmentFileStoreRef.current.set(id, nextFile);
    const newSig = getFileSignature(nextFile);
    if (newSig) attachmentSignatureRef.current.set(newSig, id);
    setAttachments((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              name: nextFile.name || item.name,
              size: nextFile.size,
              mime: nextFile.type || item.mime,
              lastModified: nextFile.lastModified,
            }
          : item
      )
    );
  }, []);

  const addAttachment = useCallback(
    (file, typeLabel) => {
      if (!file) return;
      addAttachments([file], () => typeLabel);
    },
    [addAttachments]
  );

  const removeAttachmentById = useCallback((id) => {
    const storedFile = attachmentFileStoreRef.current.get(id);
    if (storedFile) {
      const signature = getFileSignature(storedFile);
      if (signature) {
        attachmentSignatureRef.current.delete(signature);
      }
    }
    attachmentFileStoreRef.current.delete(id);
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const resetAttachmentStore = useCallback(() => {
    attachmentFileStoreRef.current.clear();
    attachmentSignatureRef.current.clear();
    setAttachments([]);
  }, []);

  const getAttachmentFile = useCallback(
    (id) => attachmentFileStoreRef.current.get(id) || null,
    []
  );

  const replaceAttachments = useCallback((nextList) => {
    const normalized = Array.isArray(nextList) ? nextList : [];
    setAttachments(normalized);
    attachmentSignatureRef.current.clear();
    normalized.forEach((descriptor) => {
      const file = descriptor?.id
        ? attachmentFileStoreRef.current.get(descriptor.id)
        : null;
      const signature = getFileSignature(file);
      if (signature) {
        attachmentSignatureRef.current.set(signature, descriptor.id);
      }
    });
  }, []);

  return {
    attachments,
    attachmentsRef,
    attachmentFileStoreRef,
    attachmentSignatureRef,
    addAttachment,
    addAttachments,
    removeAttachmentById,
    resetAttachmentStore,
    replaceAttachments,
    replaceAttachmentFile,
    getAttachmentFile,
  };
};

export default useAttachmentManager;
