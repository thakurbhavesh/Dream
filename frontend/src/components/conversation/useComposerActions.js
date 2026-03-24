import { useCallback, useEffect, useMemo, useState } from "react";

const FORMAT_COMMANDS = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
};

// Normalize autocorrect suggestions so they can be safely injected.
const sanitizeAutocorrect = (value = "") => {
  if (!value) return "";
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const useComposerActions = ({
  editorRef,
  setMessageHtml,
  setPlainText,
  setSuggestedText,
}) => {
  const [formatStates, setFormatStates] = useState({
    bold: false,
    italic: false,
    underline: false,
    code: false,
  });

  const setCodeFormatActive = useCallback((nextValue) => {
    setFormatStates((prev) => {
      const resolved =
        typeof nextValue === "function"
          ? Boolean(nextValue(prev.code))
          : Boolean(nextValue);
      if (resolved === prev.code) {
        return prev;
      }
      return {
        ...prev,
        code: resolved,
      };
    });
  }, []);

  // Focus helper so commands apply to the correct contentEditable surface.
  const ensureEditor = useCallback(() => {
    const editor = editorRef?.current;
    if (editor) {
      editor.focus();
    }
    return editor;
  }, [editorRef]);

  // Keep React state in sync with the DOM-backed editor.
  const syncContent = useCallback(() => {
    const editor = editorRef?.current;
    if (!editor) return;
    setMessageHtml(editor.innerHTML);
    setPlainText?.(editor.innerText);
  }, [editorRef, setMessageHtml, setPlainText]);

  const updateFormatStates = useCallback(() => {
    const editor = editorRef?.current;
    const selection = document.getSelection();
    if (!editor || !selection || !selection.anchorNode) {
      setFormatStates({ bold: false, italic: false, underline: false, code: false });
      return;
    }
    const isInside = editor.contains(selection.anchorNode);
    if (!isInside) {
      setFormatStates({ bold: false, italic: false, underline: false, code: false });
      return;
    }
    setFormatStates((prev) => {
      const nextBold = document.queryCommandState("bold") || false;
      const nextItalic = document.queryCommandState("italic") || false;
      const nextUnderline = document.queryCommandState("underline") || false;
      if (
        nextBold === prev.bold &&
        nextItalic === prev.italic &&
        nextUnderline === prev.underline
      ) {
        return prev;
      }
      return {
        ...prev,
        bold: nextBold,
        italic: nextItalic,
        underline: nextUnderline,
      };
    });
  }, [editorRef]);

  const toggleFormat = useCallback(
    (format) => {
      const command = FORMAT_COMMANDS[format];
      const editor = ensureEditor();
      if (!editor || !command) return;
      document.execCommand(command, false, null);
      syncContent();
      updateFormatStates();
    },
    [ensureEditor, syncContent, updateFormatStates]
  );

  const applyCodeBlock = useCallback(() => {
    const editor = ensureEditor();
    if (!editor) return;
    setCodeFormatActive((prev) => !prev);
  }, [ensureEditor, setCodeFormatActive]);

  // Offer a trimmed, sentence-cased suggestion without mutating the editor yet.
  const applyAutocorrect = useCallback(() => {
    const editor = editorRef?.current;
    if (!editor) return;
    const suggestion = sanitizeAutocorrect(editor.innerText);
    if (!suggestion || suggestion === editor.innerText.trim()) return;
    setSuggestedText(suggestion);
  }, [editorRef, setSuggestedText]);

  // Apply the sanitized suggestion directly to the editor surface.
  const acceptAutocorrect = useCallback(() => {
    const editor = ensureEditor();
    if (!editor) return;
    const sanitized = sanitizeAutocorrect(editor.innerText);
    editor.innerText = sanitized;
    syncContent();
    setSuggestedText("");
  }, [ensureEditor, setSuggestedText, syncContent]);

  const rejectAutocorrect = useCallback(() => {
    setSuggestedText("");
  }, [setSuggestedText]);

  useEffect(() => {
    document.addEventListener("selectionchange", updateFormatStates);
    return () =>
      document.removeEventListener("selectionchange", updateFormatStates);
  }, [editorRef, updateFormatStates]);

  return useMemo(
    () => ({
      toggleFormat,
      applyCodeBlock,
      applyAutocorrect,
      acceptAutocorrect,
      rejectAutocorrect,
      formatStates,
      setCodeFormatActive,
    }),
    [
      toggleFormat,
      applyCodeBlock,
      applyAutocorrect,
      acceptAutocorrect,
      rejectAutocorrect,
      formatStates,
      setCodeFormatActive,
    ]
  );
};

export default useComposerActions;
