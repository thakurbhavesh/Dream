const asArray = (list) => {
  if (!list) return [];
  try {
    return Array.from(list);
  } catch {
    const result = [];
    if (typeof list.length === "number") {
      for (let index = 0; index < list.length; index += 1) {
        result.push(list[index]);
      }
    }
    return result;
  }
};

export const hasFilesInDataTransfer = (dataTransfer) => {
  if (!dataTransfer) return false;
  if (dataTransfer.files?.length) return true;
  if (dataTransfer.items?.length) {
    return asArray(dataTransfer.items).some(
      (item) => item && item.kind === "file"
    );
  }
  const types = dataTransfer.types;
  if (!types) return false;
  return asArray(types).some(
    (type) => typeof type === "string" && type.toLowerCase() === "files"
  );
};

export const isFileDropEvent = (event) =>
  hasFilesInDataTransfer(event?.dataTransfer);

export const extractFilesFromDataTransfer = (dataTransfer) => {
  if (!dataTransfer) return [];
  if (dataTransfer.files?.length) {
    return asArray(dataTransfer.files);
  }
  if (dataTransfer.items?.length) {
    return asArray(dataTransfer.items)
      .filter((item) => item?.kind === "file")
      .map((item) => {
        try {
          return item.getAsFile?.() || null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }
  return [];
};

export default {
  hasFilesInDataTransfer,
  isFileDropEvent,
  extractFilesFromDataTransfer,
};
