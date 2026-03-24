import { useCallback } from "react";

const useComposerKeyboardShortcuts = ({ onSend }) => {
  const handleEditorKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.repeat) {
        event.preventDefault();
        onSend?.();
      }
    },
    [onSend]
  );

  return { handleEditorKeyDown };
};

export default useComposerKeyboardShortcuts;
