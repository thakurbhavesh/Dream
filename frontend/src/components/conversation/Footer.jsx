import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  Typography,
  Tooltip,
  useTheme,
} from "@mui/material";
import {
  PiCode,
  PiGlobeSimpleBold,
  PiMagicWand,
  PiMicrophone,
  PiPaperPlaneRight,
  PiPaperclip,
  PiChartPieSlice,
  PiSmiley,
  PiTextB,
  PiTextItalic,
  PiTextUnderline,
  PiVideoCamera,
  PiLightningBold,
  PiGifBold,
  PiMicrophoneBold,
  PiClockBold,
} from "react-icons/pi";
import { TbDragDrop } from "react-icons/tb";
import useComposerActions from "./useComposerActions.js";
import useMediaRecorder from "./useMediaRecorder.js";
import AudioRecorderPanel from "./AudioRecorderPanel.jsx";
import VideoRecorderModal from "./VideoRecorderModal.jsx";
import AttachmentTray from "./AttachmentTray.jsx";
import {
  extractFilesFromDataTransfer,
  isFileDropEvent,
} from "../../utils/fileDropUtils.js";
import useAttachmentManager, {
  createAttachmentId,
} from "./hooks/useAttachmentManager.js";
import useConversationComposer from "./hooks/useConversationComposer.js";
import useComposerKeyboardShortcuts from "./hooks/useComposerKeyboardShortcuts.js";
import EmojiPickerPanel from "./emoji/EmojiPickerPanel.jsx";
import useEmojiPickerLogic from "./emoji/useEmojiPickerLogic.js";
import LinkPreviewCard from "./LinkPreviewCard.jsx";
import ReplyComposerPreview from "./ReplyComposerPreview.jsx";
import EditComposerPreview from "./EditComposerPreview.jsx";
import PollComposerDialog from "./PollComposerDialog.jsx";
import { agentSelfId } from "../../data/CommonData.js";
import { getInitials } from "../../utils/initials.js";
import { detectDeviceLabel } from "../../utils/deviceDetect.js";
import {
  formatFileSize,
  isEmojiOnlyText,
  resolveCodeContent,
} from "./messages/helpers.js";
import { threadService } from "../../services/threadService.js";
import { sanitizeComposerHtml } from "../../utils/richTextSanitizer.js";
import GifPickerPanel from "./gif/GifPickerPanel.jsx";
import ScheduleMessagePicker from "./ScheduleMessagePicker.jsx";
import useSpeechToText from "../../hooks/useSpeechToText.js";

const MemoizedAttachmentTray = React.memo(AttachmentTray);
const MemoizedEmojiPickerPanel = React.memo(EmojiPickerPanel);
const MemoizedReplyComposerPreview = React.memo(ReplyComposerPreview);
const MemoizedEditComposerPreview = React.memo(EditComposerPreview);
const MemoizedLinkPreviewCard = React.memo(LinkPreviewCard);
const MemoizedAudioRecorderPanel = React.memo(AudioRecorderPanel);
const MemoizedVideoRecorderModal = React.memo(VideoRecorderModal);

const DRAFT_FALLBACK_KEY = "thread:__default__";
const DRAFT_STORE_LIMIT = 8;
const createDraftKey = (threadId) =>
  threadId ? `thread:${threadId}` : DRAFT_FALLBACK_KEY;
const clonePendingRecording = (payload) => (payload ? { ...payload } : null);

// Strip unsafe markup from pasted content while preserving allowed formatting.
const sanitizePastedHtml = (html) => sanitizeComposerHtml(html || "");

const LINK_CANDIDATE_REGEX = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const MENTION_MAX_RESULTS = 6;
const MENTION_QUERY_LIMIT = 32;

const extractLinksFromText = (text = "") => {
  if (!text) return [];
  const matches = [];
  const regex = new RegExp(
    LINK_CANDIDATE_REGEX.source,
    LINK_CANDIDATE_REGEX.flags
  );
  let match;
  while ((match = regex.exec(text))) {
    if (match?.[0]) {
      matches.push(match[0]);
    }
  }
  return matches;
};

const normalizeLinkCandidate = (value = "") => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const prefixed = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const normalized = new URL(prefixed);
    return normalized.toString();
  } catch {
    return "";
  }
};

const extractLinkFromText = (text = "") => {
  const matches = extractLinksFromText(text);
  if (matches.length !== 1) return "";
  return normalizeLinkCandidate(matches[0]);
};

const createMessageId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const fileToDataUrl = (file) =>
  new Promise((resolve) => {
    if (!file || typeof FileReader === "undefined") {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });

const ensureObjectUrl = (file) => {
  if (
    !file ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return "";
  }
  if (typeof file.__tcxObjectUrl === "string" && file.__tcxObjectUrl) {
    return file.__tcxObjectUrl;
  }
  try {
    const objectUrl = URL.createObjectURL(file);
    file.__tcxObjectUrl = objectUrl;
    return objectUrl;
  } catch {
    return "";
  }
};

const EMOJI_COUNT_REGEX =
  /(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/gu;

const POLL_CREATION_POLICY = "any";

const getCaretCharacterOffsetWithin = (element) => {
  if (
    typeof window === "undefined" ||
    !element ||
    typeof window.getSelection !== "function"
  ) {
    return null;
  }
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.endContainer)) return null;
  const preRange = range.cloneRange();
  preRange.selectNodeContents(element);
  preRange.setEnd(range.endContainer, range.endOffset);
  return preRange.toString().length;
};

const createRangeFromOffsets = (root, start, end) => {
  if (
    typeof document === "undefined" ||
    !root ||
    typeof start !== "number" ||
    typeof end !== "number"
  ) {
    return null;
  }
  if (start > end) return null;
  const range = document.createRange();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let node = walker.nextNode();
  let startNode = null;
  let startOffset = 0;
  let endNode = null;
  let endOffset = 0;

  while (node) {
    const nodeLength = node.textContent?.length ?? 0;
    const nodeRange = document.createRange();
    nodeRange.selectNodeContents(root);
    nodeRange.setEnd(node, 0);
    const nodeStart = nodeRange.toString().length;
    const nodeEnd = nodeStart + nodeLength;

    if (!startNode && start >= nodeStart && start <= nodeEnd) {
      startNode = node;
      startOffset = start - nodeStart;
    }
    if (!endNode && end >= nodeStart && end <= nodeEnd) {
      endNode = node;
      endOffset = end - nodeStart;
    }
    if (startNode && endNode) break;
    node = walker.nextNode();
  }

  if (!startNode || !endNode) return null;
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
};

const extractMentionQuery = (text = "", caretIndex = 0) => {
  if (!text || typeof caretIndex !== "number" || caretIndex < 0) return null;
  const uptoCaret = text.slice(0, caretIndex);
  const atIndex = uptoCaret.lastIndexOf("@");
  if (atIndex < 0) return null;
  if (atIndex > 0 && !/\s/.test(uptoCaret[atIndex - 1])) {
    return null;
  }
  const query = uptoCaret.slice(atIndex + 1);
  if (!query && caretIndex !== atIndex + 1) return null;
  if (/\s/.test(query)) return null;
  if (query.length > MENTION_QUERY_LIMIT) return null;
  return {
    start: atIndex,
    end: caretIndex,
    query,
  };
};

const MentionSuggestions = React.memo(
  ({ open, suggestions, activeIndex, onSelect, onHover }) => {
    if (!suggestions.length) return null;
    return (
      <Collapse in={open} timeout={220} appear unmountOnExit>
        <Box
          sx={{
            position: "absolute",
            left: 0,
            bottom: "100%",
            width: "min(400px, 100%)",
            maxHeight: 240,
            overflowY: "auto",
            bgcolor: "background.paper",
            border: (theme) => `1px solid ${theme.palette.divider}`,
            boxShadow: (theme) =>
              theme.customShadows?.z12 || theme.shadows[12],
            borderRadius: 1,
            zIndex: 99,
          }}
        >
          {suggestions.map((member, index) => {
            const isActive = index === activeIndex;
            const key = member.id || member.email || member.name || `member-${index}`;
            return (
              <Box
                key={key}
                component="button"
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(member);
                }}
                onMouseEnter={() => onHover(index)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1,
                  py: 0.75,
                  cursor: "pointer",
                  backgroundColor: isActive ? "action.hover" : "transparent",
                  border: "none",
                  width: "100%",
                  "&:hover": {
                    backgroundColor: "action.hover",
                  },
                }}
              >
                <Avatar
                  src={member.avatar || undefined}
                  sx={{ width: 36, height: 36, fontSize: 12 }}
                >
                  {!member.avatar ? getInitials(member.name || "Member") : null}
                </Avatar>
                <Box sx={{ minWidth: 0, textAlign: "Start", lineHeight: 1 }}>
                  <Typography
                    variant="body2"
                    noWrap
                    color="text.primary"
                  >
                    {member.name}
                  </Typography>
                  {member.meta ? (
                    <Typography
                      variant="caption"
                      noWrap
                      color="text.secondary"
                    >
                      {member.meta}
                    </Typography>
                  ) : null}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Collapse>
    );
  }
);

// ConversationFooter renders the composer along with attachments and media controls.
const ConversationFooter = ({
  threadId,
  thread = null,
  externalAttachments = [],
  onExternalAttachmentsHandled,
  onSendMessages,
  replyReference = null,
  onCancelReply,
  editingReference = null,
  onCancelEdit,
  onSubmitEdit,
  pollEditingReference = null,
  onCancelPollEdit,
  onSubmitPollEdit,
  onTypingStart,
  onTypingStop,
  smartReplies = [],
  onSmartRepliesDismiss,
  placeholderOverride = null,
  inputReadOnly = false,
}) => {
  const theme = useTheme();
  const [localSmartReplies, setLocalSmartReplies] = useState([]);
  useEffect(() => { setLocalSmartReplies(smartReplies || []); }, [smartReplies]);
  const [suggestedText, setSuggestedText] = useState("");
  const [grammarEnabled, setGrammarEnabled] = useState(false);
  const [grammarCorrected, setGrammarCorrected] = useState("");
  const [grammarOriginal, setGrammarOriginal] = useState("");
  const grammarTimerRef = useRef(null);
  const [smartComposeEnabled, setSmartComposeEnabled] = useState(false);
  const [composeSuggestions, setComposeSuggestions] = useState([]);
  const composeTimerRef = useRef(null);
  // Translate before send
  const [autoTranslateLang, setAutoTranslateLang] = useState(() => {
    try { return localStorage.getItem("tc_auto_translate_lang") || ""; } catch { return ""; }
  });
  const [langMenuAnchor, setLangMenuAnchor] = useState(null);
  const [translatingNow, setTranslatingNow] = useState(false);
  const [originalBeforeTranslate, setOriginalBeforeTranslate] = useState(null);
  const AUTO_TRANSLATE_LANGUAGES = [
    "English", "Hindi", "Spanish", "French", "German", "Arabic", "Chinese",
    "Japanese", "Korean", "Portuguese", "Russian", "Italian", "Turkish", "Urdu",
  ];
  const [isMessageEmpty, setIsMessageEmpty] = useState(true);
  const [isComposerDragActive, setIsComposerDragActive] = useState(false);
  // GIF picker
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
  const [gifAvailable, setGifAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { fetchWithAuth } = await import("../../utils/authApi.js");
        const { API_BASE_URL } = await import("../../config/apiBaseUrl.js");
        const { payload } = await fetchWithAuth(`${API_BASE_URL}/gifs/status`);
        if (!cancelled) setGifAvailable(!!payload?.available);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);
  // Schedule send
  const [scheduleAnchor, setScheduleAnchor] = useState(null);
  // Voice-to-text
  const editorRefForSpeech = useRef(null);
  const speechToText = useSpeechToText({
    onResult: (text) => {
      const editor = editorRefForSpeech.current;
      if (editor && text) {
        const current = editor.innerText || "";
        editor.focus();
        document.execCommand("insertText", false, (current ? " " : "") + text);
      }
    },
  });
  const {
    isOpen: isEmojiPickerOpen,
    closePicker,
    togglePicker,
  } = useEmojiPickerLogic();
  const [linkPreviewDraftValue, setLinkPreviewDraftState] = useState(null);
  const linkPreviewDraftRef = useRef(linkPreviewDraftValue);
  const dismissedLinkPreviewUrlsRef = useRef(new Set());
  const codeComposerRef = useRef(false);
  const mentionCacheRef = useRef(new Map());
  const mentionCacheKeyRef = useRef("");
  const setLinkPreviewDraft = useCallback((updater) => {
    setLinkPreviewDraftState((prev) => {
      const nextValue =
        typeof updater === "function" ? updater(prev) : (updater ?? null);
      linkPreviewDraftRef.current = nextValue;
      return nextValue;
    });
  }, []);
  const linkPreviewDraft = linkPreviewDraftValue;
  const [isPollComposerOpen, setIsPollComposerOpen] = useState(false);
  const [mentionState, setMentionState] = useState({
    open: false,
    query: "",
    start: 0,
    end: 0,
  });
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionStateRef = useRef(mentionState);

  const replyPreview = replyReference?.context ?? null;
  const editingContext = useMemo(
    () =>
      editingReference && editingReference.threadId === threadId
        ? editingReference
        : null,
    [editingReference, threadId]
  );
  const editingPreview = editingContext?.context ?? null;
  const editingSessionId = editingContext?.sessionId ?? null;
  const editingInitialValue = editingContext?.initialValue ?? "";
  const isEditingActive = Boolean(editingContext);
  const currentUser = useMemo(() => ({ id: agentSelfId, name: "You" }), []);
  const pollEditContext = useMemo(
    () =>
      pollEditingReference && pollEditingReference.threadId === threadId
        ? pollEditingReference
        : null,
    [pollEditingReference, threadId]
  );
  const handleLinkPreviewDetection = useCallback(
    (textValue = "") => {
      if (codeComposerRef.current) {
        if (linkPreviewDraftRef.current) {
          setLinkPreviewDraft(null);
        }
        dismissedLinkPreviewUrlsRef.current.clear();
        return;
      }
      const candidate = extractLinkFromText(textValue);
      if (!candidate) {
        if (linkPreviewDraftRef.current) {
          setLinkPreviewDraft(null);
        }
        dismissedLinkPreviewUrlsRef.current.clear();
        return;
      }
      if (dismissedLinkPreviewUrlsRef.current.has(candidate)) {
        return;
      }
      if (linkPreviewDraftRef.current?.url === candidate) {
        return;
      }
      setLinkPreviewDraft({
        url: candidate,
        metadata: null,
      });
    },
    [setLinkPreviewDraft]
  );
  const resetLinkPreviewState = useCallback(() => {
    dismissedLinkPreviewUrlsRef.current.clear();
    setLinkPreviewDraft(null);
  }, [setLinkPreviewDraft]);
  const handleLinkPreviewRemove = useCallback(() => {
    const currentUrl = linkPreviewDraftRef.current?.url;
    if (currentUrl) {
      dismissedLinkPreviewUrlsRef.current.add(currentUrl);
    }
    setLinkPreviewDraft(null);
  }, [setLinkPreviewDraft]);
  const handleLinkPreviewMetadata = useCallback(
    (metadata) => {
      setLinkPreviewDraft((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          metadata: metadata
            ? {
                ...metadata,
              }
            : null,
        };
      });
    },
    [setLinkPreviewDraft]
  );

  const editorRef = useRef(null);
  // Keep speech-to-text in sync with editorRef
  editorRefForSpeech.current = editorRef.current;
  const editorSyncRafRef = useRef(null);
  const fileInputRef = useRef(null);
  const handleAddMoreAttachments = useCallback(() => {
    fileInputRef.current?.click();
  }, [fileInputRef]);
  const messageHtmlRef = useRef("");
  const plainTextRef = useRef("");
  const pendingRecordingRef = useRef(null);
  const draftStoreRef = useRef(new Map());
  const currentDraftKeyRef = useRef(createDraftKey(threadId));
  // Helper to read whichever draft key is currently active.
  const getActiveDraftKey = useCallback(() => currentDraftKeyRef.current, []);

  const focusComposerEditor = useCallback(() => {
    if (inputReadOnly) return;
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const editor = editorRef.current;
    if (!editor || typeof editor.focus !== "function") return;
    editor.focus();
    const selection = window.getSelection?.();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }, [inputReadOnly]);

  const {
    snackbar,
    showSnackbar,
    handleSnackbarClose,
    handleSnackbarAction,
    ensurePermissionFlow,
    isMicrophoneAllowed,
    handleVideoButton,
    videoDialogOpen,
    closeVideoDialog,
    enqueueSendTask,
  } = useConversationComposer();

  const iconButtonStyles = {
    color: theme.palette.text.secondary,
    p: 0.5,
  };

  const getFormatButtonStyles = (active) => ({
    ...iconButtonStyles,
    color: active ? "#fff" : iconButtonStyles.color,
    backgroundColor: active
      ? theme.palette.primary.main
      : (iconButtonStyles.backgroundColor ?? "transparent"),
  });

  const verticalDivider = (
    <Box
      component="span"
      sx={{
        width: "1px",
        height: 22,
        backgroundColor: theme.palette.divider,
      }}
    />
  );

  const isAdmin =
    thread?.isAdmin === true ||
    thread?.currentUserRole === "admin" ||
    thread?.metadata?.currentUserRole === "admin";
  const isGroupThread =
    thread?.type === "group" ||
    thread?.threadType === "group" ||
    thread?.conversationType === "group";
  const canCreatePoll =
    isGroupThread &&
    (POLL_CREATION_POLICY === "any" ||
      (POLL_CREATION_POLICY === "admin" && isAdmin) ||
      (POLL_CREATION_POLICY === "creator" &&
        thread?.createdBy === agentSelfId));

  const mentionMembers = useMemo(() => {
    const normalized = [];
    const pushMember = (member) => {
      if (!member) return;
      const name =
        member.name ||
        member.username ||
        member.label ||
        member.fullName ||
        member.email ||
        "Member";
      const id =
        member.id ||
        member.user_id ||
        member.userId ||
        member.uid ||
        member.email ||
        name;
      if (!name) return;
      if (id === agentSelfId || member.isSelf) return;
      normalized.push({
        id,
        name,
        avatar: member.avatar || member.profilePicture || member.photo || "",
        meta:
          member.email ||
          member.role ||
          member.designation ||
          member.department ||
          "",
      });
    };

    if (isGroupThread) {
      const members = Array.isArray(thread?.members) ? thread.members : [];
      if (members.length) {
        members.forEach(pushMember);
      } else {
        const participants = Array.isArray(thread?.participants)
          ? thread.participants
          : [];
        participants.forEach((entry) => {
          if (typeof entry === "string") {
            pushMember({ id: entry, name: entry, email: entry });
          } else {
            pushMember(entry);
          }
        });
      }
    } else if (thread) {
      pushMember(thread);
    }

    return normalized;
  }, [isGroupThread, thread]);

  useEffect(() => {
    mentionStateRef.current = mentionState;
  }, [mentionState]);

  useEffect(() => {
    const key = mentionMembers
      .map((member) => member.id || member.email || member.name)
      .join("|");
    if (key !== mentionCacheKeyRef.current) {
      mentionCacheKeyRef.current = key;
      mentionCacheRef.current.clear();
    }
  }, [mentionMembers]);

  const mentionSuggestions = useMemo(() => {
    if (!mentionState.open) return [];
    const rawQuery = mentionState.query.trim().toLowerCase();
    const cacheKey = rawQuery || "__all__";
    const cached = mentionCacheRef.current.get(cacheKey);
    if (cached) return cached;
    let results = mentionMembers;
    if (rawQuery) {
      results = mentionMembers.filter((member) => {
        const name = member.name?.toLowerCase() || "";
        const meta = member.meta?.toLowerCase() || "";
        return name.includes(rawQuery) || meta.includes(rawQuery);
      });
    }
    const sliced = results.slice(0, MENTION_MAX_RESULTS);
    mentionCacheRef.current.set(cacheKey, sliced);
    return sliced;
  }, [mentionMembers, mentionState.open, mentionState.query]);

  const extractMentionsFromText = useCallback(
    (textValue = "") => {
      if (!textValue || mentionMembers.length === 0) return [];
      const lowerText = textValue.toLowerCase();
      const normalizedMembers = [...mentionMembers]
        .map((member) => ({
          ...member,
          name: member.name?.trim() || "",
        }))
        .filter((member) => member.name)
        .sort((a, b) => b.name.length - a.name.length);
      const seen = new Set();
      normalizedMembers.forEach((member) => {
        const token = `@${member.name}`;
        const lowerToken = token.toLowerCase();
        let index = lowerText.indexOf(lowerToken);
        while (index !== -1) {
          const before = index > 0 ? textValue[index - 1] : "";
          if (!before || /\s/.test(before)) {
            const key = member.id || member.name;
            if (!seen.has(key)) {
              seen.add(key);
            }
            break;
          }
          index = lowerText.indexOf(lowerToken, index + lowerToken.length);
        }
      });
      if (!seen.size) return [];
      return normalizedMembers
        .filter((member) => seen.has(member.id || member.name))
        .map((member) => ({
          id: member.id,
          name: member.name,
          avatar: member.avatar || "",
          meta: member.meta || "",
        }));
    },
    [mentionMembers]
  );

  const {
    attachments,
    attachmentsRef,
    attachmentFileStoreRef,
    addAttachment,
    addAttachments,
    removeAttachmentById,
    resetAttachmentStore,
    replaceAttachments,
    replaceAttachmentFile,
    getAttachmentFile,
  } = useAttachmentManager({ showSnackbar });

  const {
    recordingType,
    recordingState,
    recordingDuration,
    pendingRecording,
    formatRecordingTime,
    handleAudioTrigger,
    handlePauseResumeRecording,
    handleStopRecording,
    handleCancelRecording,
    discardPendingRecording,
    consumePendingRecording,
    setPendingRecordingExternal,
  } = useMediaRecorder({ notify: showSnackbar });

  const handleAudioButton = useCallback(async () => {
    const ready = await ensurePermissionFlow({
      appAllowed: isMicrophoneAllowed,
      permissionId: "microphone",
      label: "Microphone",
      mediaType: "audio",
      systemKey: "microphone",
    });
    if (!ready) return;
    handleAudioTrigger();
  }, [ensurePermissionFlow, handleAudioTrigger, isMicrophoneAllowed]);

  const handleVideoRecordingSubmit = useCallback(
    (payload) => {
      if (!payload) return;
      let file = payload.file;
      if (!(file instanceof File) && payload.blob) {
        try {
          file = new File(
            [payload.blob],
            `video-recording-${Date.now()}.webm`,
            {
              type: payload.mimeType || payload.blob.type || "video/webm",
            }
          );
        } catch (error) {
          file = null;
        }
      }
      if (!(file instanceof File)) {
        showSnackbar("Unable to attach video recording", "error");
        return;
      }
      if (
        typeof payload.duration === "number" &&
        Number.isFinite(payload.duration)
      ) {
        file.__tcxRecordingDuration = payload.duration;
      }
      addAttachment(file, "Video");
      showSnackbar("Video recording attached. Press send to share.", "success");
    },
    [addAttachment, showSnackbar]
  );

  useEffect(() => {
    pendingRecordingRef.current = clonePendingRecording(pendingRecording);
  }, [pendingRecording]);

  useEffect(() => {
    if (!mentionState.open) {
      setMentionIndex(0);
      return;
    }
    setMentionIndex((prev) =>
      Math.min(prev, Math.max(mentionSuggestions.length - 1, 0))
    );
  }, [mentionState.open, mentionSuggestions.length]);

  useEffect(() => {
    if (mentionState.open) {
      setMentionIndex(0);
    }
  }, [mentionState.query, mentionState.open]);

  useEffect(() => {
    if (replyPreview) {
      focusComposerEditor();
    }
  }, [replyPreview, focusComposerEditor]);

  // Mirror the contentEditable DOM into refs/state for sending & drafts.
  const performEditorSync = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    messageHtmlRef.current = editor.innerHTML;
    const text = editor.innerText || "";
    plainTextRef.current = text;
    setIsMessageEmpty(!text.trim());
    handleLinkPreviewDetection(text);
  }, [handleLinkPreviewDetection]);
  // Debounce editor sync to the next animation frame for smoother typing.
  const scheduleEditorSync = useCallback(() => {
    if (
      typeof window === "undefined" ||
      typeof window.requestAnimationFrame !== "function"
    ) {
      performEditorSync();
      return;
    }
    if (editorSyncRafRef.current !== null) {
      return;
    }
    editorSyncRafRef.current = window.requestAnimationFrame(() => {
      editorSyncRafRef.current = null;
      performEditorSync();
    });
  }, [performEditorSync]);
  // Force any pending sync work to finish immediately (e.g., before send).
  const flushEditorSync = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      typeof window.cancelAnimationFrame === "function" &&
      editorSyncRafRef.current !== null
    ) {
      window.cancelAnimationFrame(editorSyncRafRef.current);
      editorSyncRafRef.current = null;
    }
    performEditorSync();
  }, [performEditorSync]);
  useEffect(
    () => () => {
      if (
        typeof window !== "undefined" &&
        typeof window.cancelAnimationFrame === "function" &&
        editorSyncRafRef.current !== null
      ) {
        window.cancelAnimationFrame(editorSyncRafRef.current);
        editorSyncRafRef.current = null;
      }
    },
    []
  );

  const updateMentionState = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const caretIndex = getCaretCharacterOffsetWithin(editor);
    if (caretIndex === null) {
      if (mentionStateRef.current.open) {
        setMentionState({ open: false, query: "", start: 0, end: 0 });
      }
      return;
    }
    const text = editor.innerText || "";
    const match = extractMentionQuery(text, caretIndex);
    if (!match) {
      if (mentionStateRef.current.open) {
        setMentionState({ open: false, query: "", start: 0, end: 0 });
      }
      return;
    }
    setMentionState((prev) => {
      if (
        prev.open &&
        prev.query === match.query &&
        prev.start === match.start &&
        prev.end === match.end
      ) {
        return prev;
      }
      return { open: true, query: match.query, start: match.start, end: match.end };
    });
  }, []);

  const handleMentionSelect = useCallback(
    (member) => {
      if (!member) return;
      const editor = editorRef.current;
      if (
        typeof window === "undefined" ||
        typeof document === "undefined" ||
        !editor
      ) {
        return;
      }
      const { start, end } = mentionStateRef.current;
      if (typeof start !== "number" || typeof end !== "number") return;
      const insertText = `@${member.name} `;
      const range = createRangeFromOffsets(editor, start, end);
      if (!range) return;
      const selection = window.getSelection?.();
      selection?.removeAllRanges();
      selection?.addRange(range);
      const execSupported = typeof document.execCommand === "function";
      let inserted = false;
      if (execSupported) {
        inserted = document.execCommand("insertText", false, insertText);
      }
      if (!inserted) {
        range.deleteContents();
        const textNode = document.createTextNode(insertText);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      editor.focus();
      scheduleEditorSync();
      setMentionState({ open: false, query: "", start: 0, end: 0 });
      setMentionIndex(0);
    },
    [scheduleEditorSync]
  );

  const handleMentionHover = useCallback((index) => {
    setMentionIndex(index);
  }, []);

  // Insert raw text into the editor while preserving selection.
  const insertPlainText = useCallback(
    (value = "") => {
      if (!value) return;
      if (typeof window === "undefined" || typeof document === "undefined") {
        return;
      }
      const editor = editorRef.current;
      if (!editor) return;

      const execSupported = typeof document.execCommand === "function";
      if (execSupported) {
        editor.focus();
        const inserted = document.execCommand("insertText", false, value);
        if (inserted) {
          scheduleEditorSync();
          return;
        }
      }

      const selection = window.getSelection?.();
      if (!selection) return;
      if (!editor.contains(selection.anchorNode)) {
        editor.focus();
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(value);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      scheduleEditorSync();
    },
    [scheduleEditorSync]
  );

  const handleEmojiInsert = useCallback(
    (value) => {
      if (!value) return;
      insertPlainText(value);
    },
    [insertPlainText]
  );

  // Keep the HTML ref in sync when formatting helpers change content.
  const handleComposerHtmlUpdate = useCallback((value) => {
    messageHtmlRef.current =
      typeof value === "string" ? value : (editorRef.current?.innerHTML ?? "");
  }, []);

  // Keep the plain text ref updated for validation like "empty message".
  const handleComposerPlainUpdate = useCallback(
    (value) => {
      const textValue =
        typeof value === "string"
          ? value
          : (editorRef.current?.innerText ?? "");
      plainTextRef.current = textValue;
      setIsMessageEmpty(!textValue.trim());
      handleLinkPreviewDetection(textValue);
    },
    [handleLinkPreviewDetection]
  );

  const {
    toggleFormat,
    applyCodeBlock,
    applyAutocorrect,
    acceptAutocorrect,
    rejectAutocorrect,
    formatStates,
    setCodeFormatActive,
  } = useComposerActions({
    editorRef,
    setMessageHtml: handleComposerHtmlUpdate,
    setPlainText: handleComposerPlainUpdate,
    setSuggestedText,
  });

  useEffect(() => {
    codeComposerRef.current = formatStates.code;
    if (formatStates.code) {
      resetLinkPreviewState();
    }
  }, [formatStates.code, resetLinkPreviewState]);

  // Typing indicator: debounce start/stop
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);

  const emitTypingStart = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTypingStart?.(threadId);
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onTypingStop?.(threadId);
    }, 3000);
  }, [threadId, onTypingStart, onTypingStop]);

  // When the user types, sync the editor and clear AI suggestions.
  const handleEditorInput = useCallback(() => {
    scheduleEditorSync();
    setSuggestedText("");
    setGrammarCorrected("");
    updateMentionState();
    emitTypingStart();

    // Debounced grammar check when enabled
    if (grammarEnabled) {
      if (grammarTimerRef.current) clearTimeout(grammarTimerRef.current);
      grammarTimerRef.current = setTimeout(async () => {
        const text = editorRef.current?.innerText?.trim() || '';
        if (text.length < 5) return;
        try {
          const { fetchWithAuth } = await import("../../utils/authApi.js");
          const { API_BASE_URL } = await import("../../config/apiBaseUrl.js");
          const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/translate/grammar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          });
          if (response.ok && payload?.data?.changed) {
            setGrammarCorrected(payload.data.corrected);
            setGrammarOriginal(payload.data.original);
          }
        } catch { /* ignore */ }
      }, 1500);
    }

    // Debounced smart compose when enabled
    if (smartComposeEnabled) {
      if (composeTimerRef.current) clearTimeout(composeTimerRef.current);
      composeTimerRef.current = setTimeout(async () => {
        const text = editorRef.current?.innerText?.trim() || '';
        if (text.length < 10) { setComposeSuggestions([]); return; }
        try {
          const { fetchSmartCompose } = await import("../../services/chatApi.js");
          const completions = await fetchSmartCompose(text, {});
          if (Array.isArray(completions) && completions.length) {
            setComposeSuggestions(completions);
          } else {
            setComposeSuggestions([]);
          }
        } catch { setComposeSuggestions([]); }
      }, 2000);
    }
  }, [scheduleEditorSync, updateMentionState, emitTypingStart, grammarEnabled, smartComposeEnabled]);

  // Pick a short label for attachments (mime subtype or extension).
  const deriveFileLabel = useCallback((file, fallbackLabel = "File") => {
    if (!file) return fallbackLabel;
    if (file.type) {
      const segments = file.type.split("/");
      const mimeLabel = segments[segments.length - 1];
      if (mimeLabel) {
        return mimeLabel.toUpperCase();
      }
    }
    if (file.name?.includes(".")) {
      const extension = file.name.split(".").pop();
      if (extension) {
        return extension.toUpperCase();
      }
    }
    return fallbackLabel;
  }, []);

  // Handle pasted text/html/images inside the composer.
  const handlePaste = useCallback(
    (event) => {
      const clipboard = event.clipboardData;

      // Check HTML first — preserves formatting (bold, italic, underline, links)
      const html = clipboard?.getData("text/html");
      if (html) {
        // Detect spreadsheet/table paste (Excel, Google Sheets, CSV)
        // These contain <table>, mso- styles, or urn:schemas-microsoft — use plain text instead
        const isSpreadsheet = /<table[\s>]/i.test(html) ||
          /mso-|urn:schemas-microsoft|xmlns:x="urn:/i.test(html) ||
          /class="xl\d|<td[\s>]/i.test(html);
        if (isSpreadsheet) {
          const plainText = clipboard?.getData("text/plain") || "";
          if (plainText) {
            event.preventDefault();
            insertPlainText(plainText);
            flushEditorSync();
            return;
          }
        }
        event.preventDefault();
        if (typeof document !== "undefined") {
          const sanitizedHtml = sanitizePastedHtml(html);
          document.execCommand("insertHTML", false, sanitizedHtml);
        }
        flushEditorSync();
        return;
      }

      // Fallback to plain text if no HTML available
      const plainText =
        clipboard?.getData("text/plain") ??
        (typeof window !== "undefined"
          ? window.clipboardData?.getData("Text")
          : "") ??
        "";
      if (plainText) {
        event.preventDefault();
        insertPlainText(plainText);
        return;
      }

      const pastedImages =
        clipboard?.items && clipboard.items.length
          ? Array.from(clipboard.items)
              .filter(
                (item) =>
                  item.kind === "file" &&
                  typeof item.type === "string" &&
                  item.type.startsWith("image/")
              )
              .map((item) => item.getAsFile())
              .filter(Boolean)
          : [];
      if (pastedImages.length) {
        event.preventDefault();
        const normalizedImages = pastedImages
          .map((file, index) => {
            if (!file) return null;
            if (file.name) {
              return file;
            }
            const extension =
              file.type && file.type.includes("png")
                ? "png"
                : file.type && file.type.includes("jpeg")
                  ? "jpg"
                  : "png";
            try {
              return new File(
                [file],
                `pasted-image-${Date.now()}-${index}.${extension}`,
                {
                  type: file.type || "image/png",
                  lastModified: Date.now(),
                }
              );
            } catch {
              return file;
            }
          })
          .filter(Boolean);
        addAttachments(normalizedImages, () => "Image");
      }
    },
    [addAttachments, flushEditorSync, insertPlainText]
  );

  const emojiButtonMouseDownRef = useRef(false);

  const handleEmojiButtonMouseDown = useCallback(
    (event) => {
      event?.stopPropagation();
      emojiButtonMouseDownRef.current = isEmojiPickerOpen;
    },
    [isEmojiPickerOpen]
  );

  const handleEmojiButtonToggle = useCallback(
    (event) => {
      event?.stopPropagation();
      const shouldClose = isEmojiPickerOpen || emojiButtonMouseDownRef.current;
      emojiButtonMouseDownRef.current = false;
      if (shouldClose) {
        closePicker();
        return;
      }
      togglePicker();
    },
    [isEmojiPickerOpen, closePicker, togglePicker]
  );

  // Highlight the composer when users drag files over it.
  const handleComposerDragOver = useCallback((event) => {
    if (!isFileDropEvent(event)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsComposerDragActive(true);
  }, []);

  // Remove drag highlight when leaving the composer bounds.
  const handleComposerDragLeave = useCallback((event) => {
    if (
      event.currentTarget &&
      event.relatedTarget &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    setIsComposerDragActive(false);
  }, []);

  // Attach dropped files to the message composer.
  const handleComposerDrop = useCallback(
    (event) => {
      if (!isFileDropEvent(event)) {
        return;
      }
      event.preventDefault();
      setIsComposerDragActive(false);
      const files = extractFilesFromDataTransfer(event.dataTransfer);
      addAttachments(files, deriveFileLabel);
    },
    [addAttachments, deriveFileLabel]
  );

  // Handle manual file selection via the hidden input.
  const handleFileInputChange = useCallback(
    (event, typeLabel) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      if (!files.length) return;
      const resolver = typeLabel ? () => typeLabel : deriveFileLabel;
      addAttachments(files, resolver);
      focusComposerEditor();
      event.target.value = "";
    },
    [addAttachments, deriveFileLabel, focusComposerEditor]
  );

  // Capture editor content, attachments, and pending recordings for storage.
  const createDraftSnapshot = useCallback(() => {
    const sanitizedHtml = sanitizeComposerHtml(messageHtmlRef.current || "");
    const attachmentsSnapshot = attachmentsRef.current.map((item) => ({
      ...item,
    }));
    const attachmentFiles = new Map();
    attachmentsSnapshot.forEach((item) => {
      const storedFile = attachmentFileStoreRef.current.get(item.id);
      if (storedFile) {
        attachmentFiles.set(item.id, storedFile);
      }
    });
    const pendingSnapshot =
      pendingRecordingRef.current?.type === "audio"
        ? { ...pendingRecordingRef.current }
        : null;
    const linkPreviewSnapshot = linkPreviewDraftRef.current
      ? {
          ...linkPreviewDraftRef.current,
          metadata: linkPreviewDraftRef.current.metadata
            ? { ...linkPreviewDraftRef.current.metadata }
            : null,
        }
      : null;
    return {
      messageHtml: sanitizedHtml,
      plainText: plainTextRef.current,
      attachments: attachmentsSnapshot,
      pendingRecording: pendingSnapshot,
      attachmentFiles,
      linkPreview: linkPreviewSnapshot,
      isCodeMessage: formatStates.code,
    };
  }, [formatStates.code]);

  // Clean up blob URLs or Maps held by an old draft snapshot.
  const releaseDraftResources = useCallback(
    (draft, { skipPending = false } = {}) => {
      if (!skipPending && draft?.pendingRecording?.url) {
        try {
          URL.revokeObjectURL(draft.pendingRecording.url);
        } catch {
          // ignore
        }
      }
      if (draft?.attachmentFiles instanceof Map) {
        draft.attachmentFiles.clear();
      }
    },
    []
  );

  // Save or remove a draft entry, trimming the cache if it grows too large.
  const setDraftEntry = useCallback(
    (key, draft) => {
      if (!key) return;
      const store = draftStoreRef.current;
      if (!draft) {
        const previous = store.get(key);
        if (previous) {
          releaseDraftResources(previous);
          store.delete(key);
        }
        return;
      }
      if (store.has(key)) {
        const existing = store.get(key);
        if (existing) {
          const prevUrl = existing.pendingRecording?.url;
          const nextUrl = draft.pendingRecording?.url;
          releaseDraftResources(existing, {
            skipPending: prevUrl && prevUrl === nextUrl,
          });
        }
        store.delete(key);
      }
      const clonedAttachments =
        draft.attachments?.map((item) => ({ ...item })) ?? [];
      const clonedPending =
        draft.pendingRecording?.type === "audio"
          ? { ...draft.pendingRecording }
          : null;
      const clonedAttachmentFiles =
        draft.attachmentFiles instanceof Map
          ? new Map(draft.attachmentFiles)
          : new Map();
      const clonedLinkPreview = draft.linkPreview
        ? {
            ...draft.linkPreview,
            metadata: draft.linkPreview.metadata
              ? { ...draft.linkPreview.metadata }
              : null,
          }
        : null;
      store.set(key, {
        ...draft,
        attachments: clonedAttachments,
        pendingRecording: clonedPending,
        attachmentFiles: clonedAttachmentFiles,
        linkPreview: clonedLinkPreview,
      });
      if (store.size > DRAFT_STORE_LIMIT) {
        const activeKey = getActiveDraftKey();
        for (const draftKey of store.keys()) {
          if (store.size <= DRAFT_STORE_LIMIT) break;
          if (draftKey === key || draftKey === activeKey) continue;
          const removed = store.get(draftKey);
          if (removed) {
            releaseDraftResources(removed);
          }
          store.delete(draftKey);
        }
      }
    },
    [getActiveDraftKey, releaseDraftResources]
  );

  // Convenience wrapper to store the current draft for a key.
  const persistDraftForKey = useCallback(
    (key) => {
      if (!key) return;
      setDraftEntry(key, createDraftSnapshot());
    },
    [createDraftSnapshot, setDraftEntry]
  );

  // Reset editor text and UI to a blank state.
  const resetComposerSurface = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.innerHTML = "";
    }
    messageHtmlRef.current = "";
    plainTextRef.current = "";
    setIsMessageEmpty(true);
    setSuggestedText("");
    resetLinkPreviewState();
    setCodeFormatActive(false);
  }, [resetLinkPreviewState, setCodeFormatActive]);

  // Load a stored draft back into the editor, including attachments/audio.
  const restoreDraftForKey = useCallback(
    (key) => {
      const stored = key ? draftStoreRef.current.get(key) : null;
      const html = stored?.messageHtml || "";
      const text = stored?.plainText || "";
      const editor = editorRef.current;
      if (editor) {
        editor.innerHTML = html;
        if (typeof window !== "undefined" && typeof document !== "undefined") {
          const selection = window.getSelection?.();
          if (selection) {
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }
      messageHtmlRef.current = html;
      plainTextRef.current = text;
      setIsMessageEmpty(!text.trim());
      const attachmentFiles =
        stored?.attachmentFiles instanceof Map
          ? new Map(stored.attachmentFiles)
          : new Map();
      const restoredAttachments =
        stored?.attachments?.map((item) => {
          const ensuredId = item.id || createAttachmentId();
          if (item.id !== ensuredId && attachmentFiles.has(item.id)) {
            const file = attachmentFiles.get(item.id);
            attachmentFiles.delete(item.id);
            attachmentFiles.set(ensuredId, file);
          }
          return {
            ...item,
            id: ensuredId,
          };
        }) ?? [];
      attachmentFileStoreRef.current = attachmentFiles;
      replaceAttachments(restoredAttachments);
      const pendingPayload =
        stored?.pendingRecording?.type === "audio"
          ? { ...stored.pendingRecording }
          : null;
      setPendingRecordingExternal(pendingPayload, {
        preservePreviousUrl: true,
      });
      const restoredLinkPreview = stored?.linkPreview
        ? {
            ...stored.linkPreview,
            metadata: stored.linkPreview.metadata
              ? { ...stored.linkPreview.metadata }
              : null,
          }
        : null;
      dismissedLinkPreviewUrlsRef.current.clear();
      setLinkPreviewDraft(restoredLinkPreview);
      setCodeFormatActive(Boolean(stored?.isCodeMessage));
      setSuggestedText("");
    },
    [setPendingRecordingExternal, setLinkPreviewDraft, setCodeFormatActive]
  );

  // Replace a draft entry with an empty payload after sending.
  const clearDraftForKey = useCallback(
    (key) => {
      setDraftEntry(key, {
        messageHtml: "",
        plainText: "",
        attachments: [],
        pendingRecording: null,
        attachmentFiles: new Map(),
        linkPreview: null,
        isCodeMessage: false,
      });
    },
    [setDraftEntry]
  );

  useEffect(() => {
    restoreDraftForKey(getActiveDraftKey());
  }, [getActiveDraftKey, restoreDraftForKey]);

  useEffect(() => {
    const nextKey = createDraftKey(threadId);
    const prevKey = getActiveDraftKey();
    if (prevKey !== nextKey) {
      persistDraftForKey(prevKey);
      currentDraftKeyRef.current = nextKey;
      restoreDraftForKey(nextKey);
    }
  }, [threadId, getActiveDraftKey, persistDraftForKey, restoreDraftForKey]);

  useEffect(() => {
    return () => {
      persistDraftForKey(getActiveDraftKey());
      draftStoreRef.current.forEach((draft) => {
        releaseDraftResources(draft);
      });
      draftStoreRef.current.clear();
    };
  }, [getActiveDraftKey, persistDraftForKey, releaseDraftResources]);

  useEffect(() => {
    if (!externalAttachments || externalAttachments.length === 0) return;

    const normalized = Array.isArray(externalAttachments)
      ? externalAttachments.filter(Boolean)
      : Array.from(externalAttachments ?? []).filter(Boolean);
    if (!normalized.length) return;
    addAttachments(normalized, deriveFileLabel);
    onExternalAttachmentsHandled?.(threadId ?? getActiveDraftKey());
  }, [
    addAttachments,
    deriveFileLabel,
    externalAttachments,
    getActiveDraftKey,
    onExternalAttachmentsHandled,
    threadId,
  ]);

  useEffect(() => {
    if (!isEditingActive) return;
    const editor = editorRef.current;
    if (editor) {
      editor.innerText = editingInitialValue || "";
      if (typeof window !== "undefined" && typeof document !== "undefined") {
        const selection = window.getSelection?.();
        const range = document.createRange?.();
        if (selection && range) {
          range.selectNodeContents(editor);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
    messageHtmlRef.current = editor?.innerHTML ?? "";
    plainTextRef.current = editingInitialValue || "";
    setIsMessageEmpty(!(editingInitialValue || "").trim());
    resetAttachmentStore();
    resetLinkPreviewState();
    setCodeFormatActive(false);
  }, [
    isEditingActive,
    editingInitialValue,
    editingSessionId,
    resetAttachmentStore,
    resetLinkPreviewState,
    setCodeFormatActive,
  ]);

  // Send the current message or recording, then reset composer/drafts.
  const sendingRef = useRef(false);
  const handleSendMessage = useCallback(() => {
    // Prevent double-send from rapid Enter/click/key-repeat
    if (sendingRef.current) return;
    sendingRef.current = true;
    setTimeout(() => { sendingRef.current = false; }, 500);

    flushEditorSync();
    const currentEditing = editingContext;
    if (currentEditing) {
      const nextValue = plainTextRef.current.trim();
      if (!nextValue) {
        showSnackbar("Nothing to update", "info");
        return;
      }
      onSubmitEdit?.({
        threadId,
        messageId: currentEditing.messageId,
        fieldPath: currentEditing.fieldPath,
        value: nextValue,
        message: currentEditing.message,
      });
      resetComposerSurface();
      onCancelEdit?.();
      return;
    }
    const agentProfileSnapshot = threadService.agentProfile ?? {};
    const deviceLabel = detectDeviceLabel();
    const receiverId =
      thread?.user_id ??
      thread?.id ??
      thread?.threadId ??
      thread?.channelId ??
      threadId ??
      null;
    const receiverName =
      thread?.label ??
      thread?.fullName ??
      thread?.username ??
      thread?.contact?.name ??
      "";

    const buildBaseMessage = (type) => ({
      id: createMessageId(),
      type,
      message_type: type,
      direction: "outgoing",
      author: {
        id: agentProfileSnapshot.id ?? agentSelfId,
        name:
          agentProfileSnapshot.displayName ??
          agentProfileSnapshot.fullName ??
          agentProfileSnapshot.username ??
          "You",
        avatar: agentProfileSnapshot.avatar ?? null,
      },
      sender_id: agentProfileSnapshot.id ?? agentSelfId,
      sender_name:
        agentProfileSnapshot.displayName ??
        agentProfileSnapshot.fullName ??
        agentProfileSnapshot.username ??
        "You",
      receiver_id: receiverId,
      receiver_name: receiverName,
      device_sender: deviceLabel,
      createdAt: new Date().toISOString(),
      status: "sent",
      metadata: {
        deviceSender: deviceLabel,
        receiverId,
        receiverName,
        senderName:
          agentProfileSnapshot.displayName ??
          agentProfileSnapshot.fullName ??
          "You",
      },
    });

    const buildTextMessage = (text, htmlValue = "") => {
      const emojiOnly = isEmojiOnlyText(text);
      const emojiCount = (text.match(EMOJI_COUNT_REGEX) || []).length;
      const mentions = extractMentionsFromText(text);
      const base = buildBaseMessage(emojiOnly ? "emoji" : "text");
      return {
        ...base,
        message: text,
        content: {
          text,
          html: htmlValue || null,
          isEmojiOnly: emojiOnly,
          emojiCount,
        },
        metadata: mentions.length
          ? {
              ...(base.metadata || {}),
              mentions,
            }
          : base.metadata,
      };
    };

    const buildCodeMessage = (text) => {
      const resolvedContent = resolveCodeContent({ code: text });
      return {
        ...buildBaseMessage("code"),
        message: text,
        content: resolvedContent,
      };
    };

    const buildLinkMessage = (draft, captionText = "") => {
      const base = buildBaseMessage("link");
      const metadata = draft.metadata ?? {};
      let displayHost = "";
      try {
        displayHost = new URL(draft.url).hostname.replace(/^www\./i, "");
      } catch {
        displayHost = draft.url;
      }
      return {
        ...base,
        message: draft.url,
        content: {
          url: draft.url,
          title: metadata.title || draft.url,
          description: metadata.description || "",
          caption: captionText,
          thumbnail: metadata.image || draft.thumbnail || "",
          displayHost,
        },
      };
    };

    const buildAttachmentMessages = async (
      captionText = "",
      captionHtml = ""
    ) => {
      const prepared = [];
      let pendingCaption =
        typeof captionText === "string" && captionText.trim()
          ? captionText.trim()
          : "";
      let pendingCaptionHtml =
        typeof captionHtml === "string" && captionHtml.trim()
          ? captionHtml.trim()
          : "";
      for (const descriptor of attachmentsSnapshot) {
        if (!descriptor?.file) continue;
        const mime =
          descriptor.mime ||
          descriptor.file.type ||
          descriptor.typeLabel ||
          "application/octet-stream";
        const resolvedType = mime.startsWith("image/")
          ? "image"
          : mime.startsWith("video/")
            ? "video"
            : "file";
        let caption = descriptor?.caption;
        let captionHtmlValue = descriptor?.captionHtml;
        if (!caption && pendingCaption) {
          caption = pendingCaption;
          pendingCaption = "";
          captionHtmlValue = captionHtmlValue || pendingCaptionHtml || "";
          pendingCaptionHtml = "";
        }
        prepared.push({
          descriptor,
          mime,
          resolvedType,
          base: buildBaseMessage(resolvedType),
          caption,
          captionHtml: captionHtmlValue,
        });
      }
      if (!prepared.length) {
        return [];
      }
      const payloads = await Promise.all(
        prepared.map(
          async ({
            descriptor,
            mime,
            resolvedType,
            base,
            caption,
            captionHtml: localCaptionHtml,
          }) => {
            // Videos: skip base64 conversion (crashes browser on large files), use object URL directly
            const dataUrl = resolvedType === "video"
              ? ensureObjectUrl(descriptor.file) || ""
              : await fileToDataUrl(descriptor.file);
            const playbackUrl = resolvedType === "video"
              ? dataUrl || ensureObjectUrl(descriptor.file) || ""
              : dataUrl;
            if (!playbackUrl) {
              return null;
            }
            const durationHint =
              resolvedType === "video" &&
              typeof descriptor.file.__tcxRecordingDuration === "number" &&
              Number.isFinite(descriptor.file.__tcxRecordingDuration)
                ? descriptor.file.__tcxRecordingDuration
                : undefined;
            const fileEntry = {
              fileName: descriptor.name || "attachment",
              fileSize: formatFileSize(descriptor.file.size),
              mimeType: mime,
              url: playbackUrl,
              ...(caption ? { caption } : {}),
              ...(localCaptionHtml ? { captionHtml: localCaptionHtml } : {}),
              ...(durationHint ? { duration: durationHint } : {}),
            };
            const metadata = {
              ...(base.metadata ?? {}),
            };
            if (resolvedType === "file") {
              return {
                ...base,
                metadata,
                message: "",
                __file: descriptor.file, // raw File for upload
                files: JSON.stringify([
                  {
                    name: descriptor.name,
                    type: mime,
                    size: descriptor.file.size,
                    file_url: dataUrl,
                  },
                ]),
                content: {
                  files: [fileEntry],
                },
              };
            }
            return {
              ...base,
              metadata,
              message: "",
              __file: descriptor.file, // raw File for upload
              content: fileEntry,
            };
          }
        )
      );
      return payloads.filter(Boolean);
    };

    const buildAudioRecordingMessage = async (recording) => {
      const sourceBlob = recording.file || recording.blob || null;
      const dataUrl = sourceBlob
        ? await fileToDataUrl(sourceBlob)
        : recording.url || "";
      const mimeType = recording.mimeType || sourceBlob?.type || "audio/webm";
      const extension = mimeType.split("/").pop() || "webm";
      const fileName =
        recording.file?.name ||
        `audio-recording-${new Date()
          .toISOString()
          .replace(/[:.]/g, "-")}.${extension}`;
      const rawSize =
        typeof sourceBlob?.size === "number" ? sourceBlob.size : 0;
      const sizeLabel = rawSize ? formatFileSize(rawSize) : "";
      const fileEntry = {
        fileName,
        fileSize: sizeLabel,
        rawSize,
        mimeType,
        url: dataUrl,
        duration: recording.duration ?? 0,
      };
      return {
        ...buildBaseMessage("audio"),
        message: "",
        files: JSON.stringify([
          {
            name: fileName,
            type: mimeType,
            size: rawSize,
            file_url: dataUrl,
            duration: recording.duration ?? 0,
          },
        ]),
        content: fileEntry,
      };
    };

    const replyContext = replyPreview ? { ...replyPreview } : null;
    const htmlSnapshot = sanitizeComposerHtml(messageHtmlRef.current || "");
    const plainTextSnapshot = plainTextRef.current;
    if (pendingRecording) {
      const payload = consumePendingRecording();
      if (!payload) return;
      enqueueSendTask(async () => {
        const audioMessage = await buildAudioRecordingMessage(payload);
        if (replyContext) {
          audioMessage.metadata = {
            ...(audioMessage.metadata ?? {}),
            replyTo: replyContext,
          };
        }
        console.log("[ConversationFooter] sending audio message", audioMessage);
        onSendMessages?.(threadId, [audioMessage]);
        showSnackbar("Audio recording sent", "success");
      });
      setDraftEntry(getActiveDraftKey(), {
        messageHtml: htmlSnapshot,
        plainText: plainTextSnapshot,
        attachments: attachmentsRef.current.map((item) => ({ ...item })),
        pendingRecording: null,
        attachmentFiles: new Map(attachmentFileStoreRef.current),
        linkPreview: linkPreviewDraftRef.current
          ? {
              ...linkPreviewDraftRef.current,
              metadata: linkPreviewDraftRef.current.metadata
                ? { ...linkPreviewDraftRef.current.metadata }
                : null,
            }
          : null,
        isCodeMessage: formatStates.code,
      });
      resetComposerSurface();
      resetAttachmentStore();
      clearDraftForKey(getActiveDraftKey());
      onCancelReply?.();
      return;
    }

    const attachmentsSnapshot =
      attachmentsRef.current?.map((item) => ({
        ...item,
        file: attachmentFileStoreRef.current.get(item.id) ?? null,
      })) ?? [];
    const isCodeMessage = formatStates.code;
    const linkSnapshot =
      !isCodeMessage && linkPreviewDraftRef.current
        ? {
            ...linkPreviewDraftRef.current,
            metadata: linkPreviewDraftRef.current.metadata
              ? { ...linkPreviewDraftRef.current.metadata }
              : null,
          }
        : null;
    const textValue = plainTextSnapshot.trim();
    const hasAttachments = attachmentsSnapshot.some((item) => item.file);
    const hasLinkPreview = Boolean(linkSnapshot?.url);
    if (!textValue && !hasAttachments && !hasLinkPreview) {
      showSnackbar("Nothing to send", "info");
      return;
    }

    enqueueSendTask(async () => {
      const outgoingMessages = [];
      let pendingText = textValue;
      let attachmentCaption = "";
      let attachmentCaptionHtml = "";

      // Clear translate original state on send
      setOriginalBeforeTranslate(null);

      if (linkSnapshot?.url) {
        const matches = Array.from(
          pendingText.matchAll(LINK_CANDIDATE_REGEX) || []
        );
        if (matches.length > 1) {
          const key = getActiveDraftKey();
          setDraftEntry(key, {
            messageHtml: htmlSnapshot,
            plainText: plainTextSnapshot,
            attachments: attachmentsRef.current.map((item) => ({ ...item })),
            pendingRecording: clonePendingRecording(
              pendingRecordingRef.current
            ),
            attachmentFiles: new Map(attachmentFileStoreRef.current),
            linkPreview: null,
            isCodeMessage: formatStates.code,
          });
          setLinkPreviewDraft(null);
          outgoingMessages.push(buildTextMessage(pendingText, htmlSnapshot));
        } else {
          const firstMatch = matches[0];
          let captionText = pendingText;
          if (firstMatch?.[0]) {
            const startIndex =
              typeof firstMatch.index === "number"
                ? firstMatch.index
                : pendingText.indexOf(firstMatch[0]);
            if (startIndex > -1) {
              captionText = (
                pendingText.slice(0, startIndex) +
                pendingText.slice(startIndex + firstMatch[0].length)
              ).trim();
            }
          }
          captionText = captionText.trim();
          outgoingMessages.push(buildLinkMessage(linkSnapshot, captionText));
        }
        pendingText = "";
      }

      if (attachmentsSnapshot.length && pendingText && !isCodeMessage) {
        attachmentCaption = pendingText;
        attachmentCaptionHtml = htmlSnapshot;
        pendingText = "";
      }

      if (isCodeMessage && pendingText) {
        outgoingMessages.push(buildCodeMessage(pendingText));
      } else if (pendingText) {
        outgoingMessages.push(buildTextMessage(pendingText, htmlSnapshot));
      }

      if (attachmentsSnapshot.length) {
        const attachmentMessages = await buildAttachmentMessages(
          attachmentCaption,
          attachmentCaptionHtml
        );
        outgoingMessages.push(...attachmentMessages);
      }

      if (replyContext && outgoingMessages.length) {
        outgoingMessages[0] = {
          ...outgoingMessages[0],
          metadata: {
            ...(outgoingMessages[0].metadata ?? {}),
            replyTo: replyContext,
          },
        };
      }

      if (!outgoingMessages.length) {
        showSnackbar("Nothing to send", "info");
        return;
      }

      console.log("[ConversationFooter] sending messages", outgoingMessages);
      onSendMessages?.(threadId, outgoingMessages);
    });

    // Stop typing indicator immediately on send (outside async task)
    clearTimeout(typingTimerRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop?.(threadId);
    }

    resetComposerSurface();
    resetAttachmentStore();
    clearDraftForKey(getActiveDraftKey());
    onCancelReply?.();
  }, [
    attachmentsRef,
    attachmentFileStoreRef,
    clearDraftForKey,
    consumePendingRecording,
    extractMentionsFromText,
    editingContext,
    enqueueSendTask,
    getActiveDraftKey,
    flushEditorSync,
    onCancelEdit,
    onSendMessages,
    onSubmitEdit,
    pendingRecording,
    formatStates.code,
    resetAttachmentStore,
    setDraftEntry,
    resetComposerSurface,
    showSnackbar,
    thread,
    threadId,
    replyPreview,
    onCancelReply,
  ]);

  const handlePollComposerOpen = () => {
    if (!canCreatePoll) {
      showSnackbar("You do not have permission to create polls", "warning");
      return;
    }
    setIsPollComposerOpen(true);
  };

  const handlePollComposerClose = () => {
    setIsPollComposerOpen(false);
  };

  const handlePollSubmit = (pollPayload) => {
    if (!pollPayload) return;
    const pollMessage = {
      id: createMessageId(),
      type: "poll",
      direction: "outgoing",
      author: currentUser,
      content: pollPayload,
      createdAt: new Date().toISOString(),
      status: "sent",
      metadata: {
        viewerRole: isAdmin ? "admin" : "member",
      },
    };
    enqueueSendTask(async () => {
      onSendMessages?.(threadId, [pollMessage]);
      showSnackbar("Poll created", "success");
    });
    setIsPollComposerOpen(false);
  };

  const handlePollEditSubmit = (pollPayload) => {
    if (!pollEditContext || !pollPayload) return;
    onSubmitPollEdit?.({
      threadId,
      messageId: pollEditContext.messageId,
      poll: pollPayload,
      message: pollEditContext.message,
    });
    onCancelPollEdit?.();
  };

  const handlePollEditClose = () => {
    onCancelPollEdit?.();
  };

  const { handleEditorKeyDown: handleComposerKeyDown } =
    useComposerKeyboardShortcuts({
    onSend: handleSendMessage,
  });

  const handleEditorKeyDown = useCallback(
    (event) => {
      if (mentionState.open && mentionSuggestions.length) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setMentionIndex((prev) =>
            (prev + 1) % mentionSuggestions.length
          );
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setMentionIndex((prev) =>
            (prev - 1 + mentionSuggestions.length) %
            mentionSuggestions.length
          );
          return;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          handleMentionSelect(mentionSuggestions[mentionIndex]);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setMentionState({ open: false, query: "", start: 0, end: 0 });
          setMentionIndex(0);
          return;
        }
      }
      handleComposerKeyDown(event);
    },
    [
      handleComposerKeyDown,
      handleMentionSelect,
      mentionIndex,
      mentionState.open,
      mentionSuggestions,
    ]
  );

  const handleEditorCaretChange = useCallback(() => {
    updateMentionState();
  }, [updateMentionState]);

  const isAudioRecording = recordingType === "audio";

  return (
    <Box
      sx={{
        p: 1,
        backgroundColor: theme.palette.background.paper,
        zIndex: 30,
      }}
      position="relative"
    >
      <MemoizedEmojiPickerPanel
        open={isEmojiPickerOpen}
        onClose={closePicker}
        onSelectEmoji={handleEmojiInsert}
      />
      <GifPickerPanel
        open={isGifPickerOpen}
        onClose={() => setIsGifPickerOpen(false)}
        onSelect={(gif) => {
          onSendMessages?.(threadId, [{
            message: gif.gifUrl,
            type: "gif",
            metadata: gif,
          }]);
          setIsGifPickerOpen(false);
        }}
      />
      <ScheduleMessagePicker
        anchorEl={scheduleAnchor}
        open={Boolean(scheduleAnchor)}
        onClose={() => setScheduleAnchor(null)}
        onSchedule={(sendAt) => {
          const editor = editorRef.current;
          const text = editor?.innerText?.trim() || "";
          if (!text) {
            showSnackbar?.("Type a message first", "warning");
            return;
          }
          // Send as special scheduled message — GeneralApp will intercept metadata.sendAt
          onSendMessages?.(threadId, [{
            id: `sched-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            message: text,
            content: { text },
            type: "text",
            direction: "outgoing",
            status: "queued",
            metadata: { scheduled: true, sendAt },
          }]);
          if (editor) { editor.innerHTML = ""; editor.dispatchEvent(new Event("input", { bubbles: true })); }
          showSnackbar?.("Message scheduled!", "success");
        }}
      />
      <MemoizedAttachmentTray
        attachments={attachments}
        onAddMore={handleAddMoreAttachments}
        onRemove={removeAttachmentById}
        onReplaceFile={replaceAttachmentFile}
        getAttachmentFile={getAttachmentFile}
        showSnackbar={showSnackbar}
      />
      {editingPreview ? (
        <MemoizedEditComposerPreview
          data={editingPreview}
          onCancel={onCancelEdit}
        />
      ) : null}
      {!editingPreview && replyPreview ? (
        <MemoizedReplyComposerPreview
          data={replyPreview}
          onCancel={onCancelReply}
        />
      ) : null}
      {linkPreviewDraft?.url ? (
        <MemoizedLinkPreviewCard
          url={linkPreviewDraft.url}
          onRemove={handleLinkPreviewRemove}
          onMetadata={handleLinkPreviewMetadata}
          initialMetadata={linkPreviewDraft.metadata}
        />
      ) : null}

      <Box
        sx={{
          position: "relative",
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.default,
          boxShadow: theme.customShadows?.z8 || theme.shadows[6],
          overflow: mentionState.open ? "visible" : "hidden",
          pt: isAudioRecording ? 9 : 0,
          ...(isComposerDragActive && {
            borderColor: theme.palette.primary.main,
            boxShadow: theme.shadows[10],
          }),
        }}
        onDragEnter={handleComposerDragOver}
        onDragOver={handleComposerDragOver}
        onDragLeave={handleComposerDragLeave}
        onDrop={handleComposerDrop}
      >
        {/* Show drag target overlay while files hover over composer */}
        {isComposerDragActive ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 5,
              backdropFilter: "blur(1px)",
              border: `1px dashed ${theme.palette.divider}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "text.secondary",
              letterSpacing: 0.5,
              gap: 1,
              textTransform: "capitalize",
              pointerEvents: "none",
              paddingBottom: 4,
            }}
          >
            <TbDragDrop size={24} />
            Drop files to attach
          </Box>
        ) : null}
        <MemoizedAudioRecorderPanel
          isRecording={isAudioRecording}
          recordingState={recordingState}
          recordingDuration={recordingDuration}
          formatRecordingTime={formatRecordingTime}
          onStop={handleStopRecording}
          onPauseResume={handlePauseResumeRecording}
          onCancel={handleCancelRecording}
          pendingRecording={pendingRecording}
          discardPendingRecording={discardPendingRecording}
        />

        {/* AI Grammar correction suggestion */}
        {grammarCorrected ? (
          <Stack direction="column" spacing={0.75} sx={{ px: 1.5, pt: 1 }}>
            <Typography
              variant="body2"
              sx={{
                color: theme.palette.text.primary,
                bgcolor: theme.palette.action.hover,
                borderRadius: 1,
                px: 1.5,
                py: 1,
                borderLeft: `3px solid ${theme.palette.primary.main}`,
              }}
            >
              {grammarCorrected}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                size="small"
                icon={<PiMagicWand size={12} />}
                label="AI Corrected"
                sx={{ bgcolor: theme.palette.action.hover, fontSize: 11 }}
              />
              <Chip
                size="small"
                label="Accept"
                color="primary"
                onClick={() => {
                  if (editorRef.current) {
                    editorRef.current.innerText = grammarCorrected;
                    handleComposerPlainUpdate(grammarCorrected);
                    handleComposerHtmlUpdate(grammarCorrected);
                  }
                  setGrammarCorrected("");
                  setGrammarOriginal("");
                }}
                sx={{ fontSize: 11 }}
              />
              <Chip
                size="small"
                label="Dismiss"
                variant="outlined"
                onClick={() => { setGrammarCorrected(""); setGrammarOriginal(""); }}
                sx={{ fontSize: 11 }}
              />
            </Stack>
          </Stack>
        ) : null}
        {localSmartReplies.length > 0 ? (
          <Stack
            direction="row"
            spacing={1}
            sx={{
              px: 1.5,
              py: 0.75,
              overflowX: "auto",
              "&::-webkit-scrollbar": { display: "none" },
            }}
          >
            <PiMagicWand size={16} style={{ flexShrink: 0, marginTop: 4, color: theme.palette.primary.main }} />
            {localSmartReplies.map((reply, idx) => (
              <Chip
                key={`smart-${idx}`}
                label={reply}
                onClick={() => {
                  if (editorRef.current) {
                    editorRef.current.focus();
                    editorRef.current.innerText = '';
                  }
                  insertPlainText(reply);
                  setLocalSmartReplies([]);
                  onSmartRepliesDismiss?.();
                }}
                size="small"
                variant="outlined"
                sx={{
                  cursor: "pointer",
                  flexShrink: 0,
                  borderColor: theme.palette.primary.main,
                  color: theme.palette.primary.main,
                  fontWeight: 500,
                  fontSize: 12,
                  "&:hover": {
                    bgcolor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                  },
                }}
              />
            ))}
            <Chip
              label="✕"
              size="small"
              onClick={() => { setLocalSmartReplies([]); onSmartRepliesDismiss?.(); }}
              sx={{
                flexShrink: 0,
                fontSize: 11,
                cursor: "pointer",
                color: theme.palette.text.secondary,
              }}
            />
          </Stack>
        ) : null}
        {composeSuggestions.length > 0 ? (
          <Stack
            direction="row"
            spacing={1}
            sx={{
              px: 1.5,
              py: 0.75,
              overflowX: "auto",
              "&::-webkit-scrollbar": { display: "none" },
            }}
          >
            <PiLightningBold size={16} style={{ flexShrink: 0, marginTop: 4, color: "#ed6c02" }} />
            {composeSuggestions.map((suggestion, idx) => (
              <Chip
                key={`compose-${idx}`}
                label={suggestion}
                onClick={() => {
                  if (editorRef.current) {
                    editorRef.current.focus();
                    editorRef.current.innerText = '';
                  }
                  insertPlainText(suggestion);
                  setComposeSuggestions([]);
                }}
                size="small"
                variant="outlined"
                sx={{
                  cursor: "pointer",
                  flexShrink: 0,
                  borderColor: "#ed6c02",
                  color: "#ed6c02",
                  fontWeight: 500,
                  fontSize: 12,
                  maxWidth: 250,
                  "&:hover": {
                    bgcolor: "#ed6c02",
                    color: "#fff",
                  },
                }}
              />
            ))}
            <Chip
              label="✕"
              size="small"
              onClick={() => setComposeSuggestions([])}
              sx={{
                flexShrink: 0,
                fontSize: 11,
                cursor: "pointer",
                color: theme.palette.text.secondary,
              }}
            />
          </Stack>
        ) : null}
        {autoTranslateLang ? (
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{ px: 1.5, py: 0.5 }}
          >
            <PiGlobeSimpleBold size={14} style={{ color: "#2e7d32" }} />
            <Typography variant="caption" sx={{ color: "#2e7d32", fontWeight: 600 }}>
              {autoTranslateLang}
            </Typography>
            <Chip
              label="Change"
              size="small"
              onClick={(e) => setLangMenuAnchor(e.currentTarget)}
              sx={{ fontSize: 10, height: 20, cursor: "pointer", color: "#2e7d32", borderColor: "#2e7d32" }}
              variant="outlined"
            />
            {translatingNow ? (
              <Chip
                label="Translating..."
                size="small"
                icon={<CircularProgress size={10} sx={{ color: "#2e7d32" }} />}
                sx={{ fontSize: 10, height: 20, color: "#2e7d32", borderColor: "#2e7d32" }}
                variant="outlined"
              />
            ) : originalBeforeTranslate ? (
              <Chip
                label="Original"
                size="small"
                onClick={() => {
                  if (editorRef.current) {
                    editorRef.current.innerText = originalBeforeTranslate;
                    handleComposerPlainUpdate(originalBeforeTranslate);
                    handleComposerHtmlUpdate(originalBeforeTranslate);
                  }
                  setOriginalBeforeTranslate(null);
                }}
                sx={{ fontSize: 10, height: 20, cursor: "pointer", color: theme.palette.warning.main, borderColor: theme.palette.warning.main }}
                variant="outlined"
              />
            ) : (
              <Chip
                label="Convert"
                size="small"
                onClick={async () => {
                  const text = editorRef.current?.innerText?.trim() || "";
                  if (!text || text.length < 2) return;
                  setTranslatingNow(true);
                  try {
                    const { translateText } = await import("../../services/chatApi.js");
                    const result = await translateText(text, autoTranslateLang);
                    if (result && result !== text) {
                      setOriginalBeforeTranslate(text);
                      editorRef.current.innerText = result;
                      handleComposerPlainUpdate(result);
                      handleComposerHtmlUpdate(result);
                    }
                  } catch { /* ignore */ }
                  setTranslatingNow(false);
                }}
                sx={{ fontSize: 10, height: 20, cursor: "pointer", color: "#2e7d32", borderColor: "#2e7d32", fontWeight: 600 }}
                variant="outlined"
              />
            )}
            <Chip
              label="OFF"
              size="small"
              onClick={() => {
                setAutoTranslateLang("");
                setOriginalBeforeTranslate(null);
                try { localStorage.setItem("tc_auto_translate_lang", ""); } catch {}
              }}
              sx={{ fontSize: 10, height: 20, cursor: "pointer", color: theme.palette.text.secondary }}
            />
          </Stack>
        ) : null}
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 2,
            margin: 1,
          }}
        >
          <Box sx={{ flex: 1, position: "relative" }}>
            <Box
              ref={editorRef}
              contentEditable={!inputReadOnly}
              suppressContentEditableWarning
              tabIndex={inputReadOnly ? -1 : 0}
              onInput={inputReadOnly ? undefined : handleEditorInput}
              onKeyDown={inputReadOnly ? (e) => e.preventDefault() : handleEditorKeyDown}
              onKeyUp={inputReadOnly ? undefined : handleEditorCaretChange}
              onMouseUp={inputReadOnly ? undefined : handleEditorCaretChange}
              onPaste={inputReadOnly ? (e) => e.preventDefault() : handlePaste}
              sx={{
                width: "100%",
                maxHeight: 250,
                overflowY: "auto",
                p: 1,
                fontSize: 16,
                color: theme.palette.text.primary,
                outline: "none",
                borderRadius: 1,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
            />
            <MentionSuggestions
              open={mentionState.open}
              suggestions={mentionSuggestions}
              activeIndex={mentionIndex}
              onSelect={handleMentionSelect}
              onHover={handleMentionHover}
            />
            {/* Placeholder text only shows when editor has no content */}
            {isMessageEmpty ? (
              <Box
                sx={{
                  position: "absolute",
                  top: 8,
                  left: 12,
                  right: 12,
                  color: theme.palette.text.secondary,
                  opacity: theme.palette.mode === "dark" ? 0.7 : 0.8,
                  pointerEvents: "none",
                  fontStyle: placeholderOverride ? "italic" : "normal",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {placeholderOverride || "Type your message.."}
              </Box>
            ) : null}
          </Box>

          <Stack direction="row" spacing={0} alignItems="flex-start">
            <IconButton
              disableRipple
              disabled={inputReadOnly}
              sx={{
                alignSelf: "flex-start",
                width: 45,
                height: 45,
                borderRadius: "6px",
                backgroundColor: "primary.main",
                color: "#fff",
                "&:hover": {
                  backgroundColor: "primary.dark",
                },
                "&.Mui-disabled": {
                  backgroundColor: "primary.main",
                  color: "#fff",
                  opacity: 0.5,
                  cursor: "not-allowed",
                },
              }}
              onClick={inputReadOnly ? undefined : handleSendMessage}
            >
              <PiPaperPlaneRight size={20} />
            </IconButton>
            {/* Schedule send button hidden */}
          </Stack>
        </Box>
        <Divider sx={{ borderColor: theme.palette.grey[500_56] }} />

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            px: 2,
            py: 1,
            ...(inputReadOnly && {
              pointerEvents: "none",
              opacity: 0.5,
              userSelect: "none",
            }),
          }}
          aria-disabled={inputReadOnly || undefined}
        >
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Tooltip title="Attach file">
              <IconButton
                disableRipple
                sx={iconButtonStyles}
                onClick={handleAddMoreAttachments}
              >
                <PiPaperclip size={20} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Emoji picker">
              <IconButton
                disableRipple
                sx={getFormatButtonStyles(isEmojiPickerOpen)}
                onMouseDown={handleEmojiButtonMouseDown}
                onClick={handleEmojiButtonToggle}
              >
                <PiSmiley size={20} />
              </IconButton>
            </Tooltip>

            {gifAvailable && (
            <Tooltip title="GIF">
              <IconButton
                disableRipple
                sx={getFormatButtonStyles(isGifPickerOpen)}
                onClick={() => setIsGifPickerOpen((v) => !v)}
              >
                <PiGifBold size={20} />
              </IconButton>
            </Tooltip>
            )}

            {speechToText.isSupported && (
              <Tooltip title={speechToText.isListening ? "Stop voice input" : "Voice to text"}>
                <IconButton
                  disableRipple
                  sx={{
                    ...iconButtonStyles,
                    ...(speechToText.isListening && {
                      color: theme.palette.error.main,
                      animation: "pulse 1.5s infinite",
                      "@keyframes pulse": {
                        "0%": { opacity: 1 },
                        "50%": { opacity: 0.5 },
                        "100%": { opacity: 1 },
                      },
                    }),
                  }}
                  onClick={() => speechToText.isListening ? speechToText.stopListening() : speechToText.startListening()}
                >
                  <PiMicrophoneBold size={20} />
                </IconButton>
              </Tooltip>
            )}
            {verticalDivider}
            <Tooltip title="Bold">
              <IconButton
                disableRipple
                sx={getFormatButtonStyles(formatStates.bold)}
                onClick={() => toggleFormat("bold")}
              >
                <PiTextB size={20} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Italic">
              <IconButton
                disableRipple
                sx={getFormatButtonStyles(formatStates.italic)}
                onClick={() => toggleFormat("italic")}
              >
                <PiTextItalic size={20} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Underline">
              <IconButton
                disableRipple
                sx={getFormatButtonStyles(formatStates.underline)}
                onClick={() => toggleFormat("underline")}
              >
                <PiTextUnderline size={20} />
              </IconButton>
            </Tooltip>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1.25}>
            {canCreatePoll ? (
              <Tooltip title="Create poll">
                <IconButton
                  disableRipple
                  sx={iconButtonStyles}
                  onClick={handlePollComposerOpen}
                >
                  <PiChartPieSlice size={20} />
                </IconButton>
              </Tooltip>
            ) : null}
            <Tooltip title="Insert code block">
              <IconButton
                disableRipple
                sx={getFormatButtonStyles(formatStates.code)}
                onClick={applyCodeBlock}
              >
                <PiCode size={20} />
              </IconButton>
            </Tooltip>

            <Tooltip title={grammarEnabled ? "AI Grammar: ON" : "AI Grammar: OFF"}>
              <IconButton
                disableRipple
                sx={grammarEnabled
                  ? { ...iconButtonStyles, color: theme.palette.primary.main, bgcolor: theme.palette.action.hover }
                  : iconButtonStyles
                }
                onClick={() => {
                  setGrammarEnabled((prev) => !prev);
                  setGrammarCorrected("");
                  setGrammarOriginal("");
                }}
              >
                <PiMagicWand size={20} />
              </IconButton>
            </Tooltip>

            <Tooltip title={smartComposeEnabled ? "AI Smart Compose: ON" : "AI Smart Compose: OFF"}>
              <IconButton
                disableRipple
                sx={smartComposeEnabled
                  ? { ...iconButtonStyles, color: "#ed6c02", bgcolor: theme.palette.action.hover }
                  : iconButtonStyles
                }
                onClick={() => {
                  setSmartComposeEnabled((prev) => !prev);
                  setComposeSuggestions([]);
                }}
              >
                <PiLightningBold size={20} />
              </IconButton>
            </Tooltip>
            <Tooltip title={autoTranslateLang ? `Translate: ${autoTranslateLang}` : "Translate"}>
              <IconButton
                disableRipple
                sx={autoTranslateLang
                  ? { ...iconButtonStyles, color: "#2e7d32", bgcolor: theme.palette.action.hover }
                  : iconButtonStyles
                }
                onClick={(e) => setLangMenuAnchor(e.currentTarget)}
              >
                <PiGlobeSimpleBold size={20} />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={langMenuAnchor}
              open={Boolean(langMenuAnchor)}
              onClose={() => setLangMenuAnchor(null)}
              anchorOrigin={{ vertical: "top", horizontal: "center" }}
              transformOrigin={{ vertical: "bottom", horizontal: "center" }}
              slotProps={{ paper: { sx: { maxHeight: 300, minWidth: 160 } } }}
            >
              {AUTO_TRANSLATE_LANGUAGES.map((lang) => (
                <MenuItem
                  key={lang}
                  selected={autoTranslateLang === lang}
                  onClick={() => {
                    setAutoTranslateLang(lang);
                    setOriginalBeforeTranslate(null);
                    setLangMenuAnchor(null);
                    try {
                      localStorage.setItem("tc_auto_translate_lang", lang);
                    } catch {}
                  }}
                  sx={{ fontSize: 14 }}
                >
                  {lang}
                </MenuItem>
              ))}
            </Menu>
            <Tooltip title="Record video">
              <IconButton
                disableRipple
                sx={getFormatButtonStyles(recordingType === "video")}
                onClick={handleVideoButton}
              >
                <PiVideoCamera size={20} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Record audio">
              <IconButton
                disableRipple
                sx={getFormatButtonStyles(recordingType === "audio")}
                onClick={handleAudioButton}
              >
                <PiMicrophone size={20} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp,.zip,.rar,.7z,.gz,.tar,.svg,.webp,.gif,.bmp,.ico,.mp3,.mp4,.wav,.ogg,.webm,.mov,.avi,.mkv,.flv,.wmv,.m4a,.flac,.aac,.wma,.json,.xml,.yaml,.yml,.md,.html,.htm,.css,.ts,.tsx,.jsx,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.hpp,.cs,.swift,.kt,.sql,.graphql,.env,.toml,.ini,.cfg,.log,.ttf,.otf,.woff,.woff2,.eot,.epub,.mobi,.psd,.ai,.fig,.sketch"
        onChange={(event) => handleFileInputChange(event, "File")}
      />
      <MemoizedVideoRecorderModal
        open={videoDialogOpen}
        onClose={closeVideoDialog}
        onSubmit={handleVideoRecordingSubmit}
        showSnackbar={showSnackbar}
      />
      <PollComposerDialog
        open={isPollComposerOpen}
        onClose={handlePollComposerClose}
        onSubmit={handlePollSubmit}
        currentUser={currentUser}
      />
      <PollComposerDialog
        open={Boolean(pollEditContext)}
        onClose={handlePollEditClose}
        onSubmit={handlePollEditSubmit}
        currentUser={currentUser}
        initialPoll={pollEditContext?.message?.content ?? null}
        title="Edit poll"
        submitLabel="Save changes"
      />
      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.actionLabel ? null : 3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        sx={{ maxWidth: 600 }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{
            width: "100%",
            alignItems: "center",
            boxShadow: theme.shadows[6],
            px: 2,
            py: 1,

            "& .MuiAlert-message": {
              display: "flex",
              alignItems: "center",
              fontWeight: 500,
            },
            "& .MuiAlert-action": {
              alignItems: "center",
              ml: 1,
              pl: 1,
              borderLeft:
                snackbar.actionLabel && `1px solid ${theme.palette.divider}`,
            },
          }}
          action={
            snackbar.actionLabel ? (
              <Button
                variant="contained"
                color={
                  snackbar.severity === "warning"
                    ? "warning"
                    : snackbar.severity === "error"
                      ? "error"
                      : "primary"
                }
                size="small"
                onClick={handleSnackbarAction}
                sx={{ fontWeight: 600 }}
              >
                {snackbar.actionLabel}
              </Button>
            ) : null
          }
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ConversationFooter;

