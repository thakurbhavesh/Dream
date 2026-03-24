import { useCallback, useEffect, useRef, useState } from "react";
import {
  Avatar,
  Box,
  CircularProgress,
  IconButton,
  InputAdornment,
  OutlinedInput,
  Paper,
  Slide,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import {
  PiRobotDuotone,
  PiXBold,
  PiPaperPlaneTiltFill,
  PiArrowClockwiseBold,
  PiArrowsOutBold,
  PiArrowsInBold,
  PiClockCounterClockwiseBold,
  PiTrashBold,
} from "react-icons/pi";
import {
  askAssistant,
  buildWorkspaceContext,
  fetchWorkspaceState,
  buildRoleAwarePrompt,
  submitFeedback,
  saveConversation as apiSaveConv,
  updateConversation as apiUpdateConv,
  listConversations as apiListConv,
  getConversation as apiGetConv,
  deleteConversation as apiDeleteConv,
} from "./liveAssistantApi";
import useCurrentUser from "../../hooks/useCurrentUser";

// ─── constants ───────────────────────────────────────────────────────────────

// #15 Multi-language welcome
const getWelcomeMessage = () => {
  const lang = (navigator.language || "en").toLowerCase();
  const isHindi = lang.startsWith("hi");
  if (isHindi) {
    return {
      role: "assistant",
      content:
        "Namaste! Main **TeamChatX AI Assistant** hoon 🤖\n\nMain aapki madad kar sakta hoon:\n• **Chat** — Message bhejein, reply, edit, delete, forward, pin\n• **Search** — Normal & AI Smart Search\n• **Files** — Share, preview, summarize\n• **AI Features** — Smart Reply, Translate, Grammar\n• **Settings** — Profile, timezone, wallpapers\n\nKuch bhi poochiye! Jaise:\n*\"Message kaise edit karte hain?\"*\n*\"Search kaise karein?\"*",
      suggestions: ["Message kaise edit karein?", "Smart Search kya hai?", "Keyboard shortcuts dikhao"],
    };
  }
  return {
    role: "assistant",
    content:
      "Hello! I'm **TeamChatX AI Assistant** 🤖\n\nI can help you with:\n• **Chat** — Send, reply, edit, delete, forward, pin messages\n• **Search** — Normal & AI Smart Search\n• **Files** — Share, preview, summarize documents\n• **AI Features** — Smart Reply, Translate, Summarize, Grammar\n• **Settings** — Profile, timezone, wallpapers, notifications\n\nAsk me anything! For example:\n*\"How to edit a message?\"*\n*\"How to use Smart Search?\"*",
    suggestions: ["How to edit a message?", "What are keyboard shortcuts?", "How to search old messages?"],
  };
};

const WELCOME_MESSAGE = getWelcomeMessage();

const MAX_HISTORY = 20; // keep last N message pairs in context

// ─── helpers ─────────────────────────────────────────────────────────────────

const renderMarkdown = (text = "") => {
  let html = text;
  // Code blocks with language: ```js\ncode\n```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const escaped = code.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
    return `<div class="ai-code-block" data-lang="${lang || "code"}"><div class="ai-code-header"><span>${lang || "code"}</span><button class="ai-code-copy" onclick="navigator.clipboard.writeText(this.closest('.ai-code-block').querySelector('pre').textContent)">Copy</button></div><pre>${escaped}</pre></div>`;
  });
  // Inline code
  html = html.replace(/`(.*?)`/g, '<code class="ai-inline-code">$1</code>');
  // Bold, italic
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  // Line breaks
  html = html.replace(/\n/g, "<br/>");
  return html;
};

// #13 Code block styles injected once
if (typeof document !== "undefined" && !document.getElementById("ai-code-styles")) {
  const style = document.createElement("style");
  style.id = "ai-code-styles";
  style.textContent = `
    .ai-code-block { border-radius: 8px; overflow: hidden; margin: 6px 0; font-size: 12px; }
    .ai-code-header { display: flex; justify-content: space-between; align-items: center; padding: 4px 10px; background: rgba(0,0,0,0.15); font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .ai-code-copy { background: none; border: 1px solid rgba(255,255,255,0.3); color: inherit; padding: 1px 8px; border-radius: 4px; cursor: pointer; font-size: 10px; }
    .ai-code-copy:hover { background: rgba(255,255,255,0.1); }
    .ai-code-block pre { margin: 0; padding: 8px 10px; overflow-x: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.5; background: rgba(0,0,0,0.08); }
    .ai-inline-code { background: rgba(0,0,0,0.08); padding: 1px 5px; border-radius: 3px; font-family: monospace; font-size: 0.85em; }
  `;
  document.head.appendChild(style);
}

// ─── sub-components ──────────────────────────────────────────────────────────

const MessageBubble = ({ msg, theme, onFeedback, onSuggestedClick }) => {
  const isUser = msg.role === "user";
  const isDark = theme.palette.mode === "dark";
  return (
    <Stack spacing={0.5} sx={{ px: 1.5 }}>
      <Stack
        direction="row"
        justifyContent={isUser ? "flex-end" : "flex-start"}
        alignItems="flex-end"
        spacing={1}
      >
        {!isUser && (
          <Avatar
            sx={{
              width: 26,
              height: 26,
              bgcolor: theme.palette.primary.main,
              flexShrink: 0,
              mb: 0.5,
            }}
          >
            <PiRobotDuotone size={14} />
          </Avatar>
        )}

        <Box
          sx={{
            maxWidth: "82%",
            px: 1.5,
            py: 0.9,
            borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
            bgcolor: isUser
              ? theme.palette.primary.main
              : isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)",
            color: isUser ? "#fff" : theme.palette.text.primary,
            boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
          }}
        >
          {msg.loading ? (
            <Stack direction="row" spacing={0.6} alignItems="center" sx={{ py: 0.3 }}>
              {[0, 1, 2].map((i) => (
                <Box
                  key={i}
                  sx={{
                    width: 6, height: 6, borderRadius: "50%",
                    bgcolor: "currentColor", opacity: 0.5,
                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    "@keyframes pulse": {
                      "0%, 100%": { transform: "scale(1)", opacity: 0.4 },
                      "50%": { transform: "scale(1.4)", opacity: 1 },
                    },
                  }}
                />
              ))}
            </Stack>
          ) : (
            <Typography
              variant="body2"
              sx={{ lineHeight: 1.55, fontSize: "0.8rem", whiteSpace: "pre-wrap", "& strong": { fontWeight: 700 } }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
            />
          )}
        </Box>
      </Stack>

      {/* #12 Feedback buttons for assistant messages */}
      {!isUser && !msg.loading && msg.content && (
        <Stack direction="row" spacing={0.5} sx={{ pl: 4.5 }}>
          {msg.feedback ? (
            <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10 }}>
              {msg.feedback === "up" ? "👍 Thanks!" : "👎 Noted"}
            </Typography>
          ) : (
            <>
              <IconButton size="small" onClick={() => onFeedback?.(msg, "up")} sx={{ p: 0.3, opacity: 0.5, "&:hover": { opacity: 1 } }}>
                <Typography sx={{ fontSize: 12 }}>👍</Typography>
              </IconButton>
              <IconButton size="small" onClick={() => onFeedback?.(msg, "down")} sx={{ p: 0.3, opacity: 0.5, "&:hover": { opacity: 1 } }}>
                <Typography sx={{ fontSize: 12 }}>👎</Typography>
              </IconButton>
            </>
          )}
        </Stack>
      )}

      {/* #11 Suggested questions */}
      {!isUser && msg.suggestions?.length > 0 && (
        <Stack direction="row" spacing={0.5} sx={{ pl: 4.5, flexWrap: "wrap", gap: 0.5 }}>
          {msg.suggestions.map((q, i) => (
            <Box
              key={i}
              onClick={() => onSuggestedClick?.(q)}
              sx={{
                px: 1, py: 0.4, borderRadius: 2, cursor: "pointer",
                fontSize: 11, fontWeight: 500,
                border: `1px solid ${theme.palette.primary.main}`,
                color: theme.palette.primary.main,
                "&:hover": { bgcolor: theme.palette.primary.main, color: "#fff" },
                transition: "all 0.15s",
              }}
            >
              {q}
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

// ─── main component ──────────────────────────────────────────────────────────

const LiveAssistant = () => {
  const theme = useTheme();
  const currentUser = useCurrentUser();
  const userRoleId = Number(currentUser?.role || currentUser?.role_id || 4);
  const [open, setOpen] = useState(false);
  const [panelSize, setPanelSize] = useState("medium"); // small, medium, large
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [wsState, setWsState] = useState(null);
  const [wsLoading, setWsLoading] = useState(false);
  const [wsError, setWsError] = useState("");
  const bottomRef = useRef(null);

  // ── listen for sidebar toggle event ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const shouldOpen = e.detail?.open;
      setOpen(shouldOpen ?? ((prev) => !prev));
    };
    window.addEventListener("teamchatx:assistant", handler);
    return () => window.removeEventListener("teamchatx:assistant", handler);
  }, []);

  // ── fetch workspace state when chat is opened ──────────────────────────────
  const loadWorkspace = useCallback(async () => {
    setWsLoading(true);
    setWsError("");
    try {
      const data = await fetchWorkspaceState();
      setWsState(data);
    } catch {
      setWsError("Could not load workspace data. Responses may be limited.");
    } finally {
      setWsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !wsState) loadWorkspace();
  }, [open, wsState, loadWorkspace]);

  // ── auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const [convId, setConvId] = useState(null); // current conversation DB id
  const [convList, setConvList] = useState([]); // past conversations
  const [showHistory, setShowHistory] = useState(false);

  // ── #12 feedback handler ──────────────────────────────────────────────────
  const handleFeedback = useCallback((msg, rating) => {
    setMessages((prev) => {
      const idx = prev.indexOf(msg);
      const userMsg = idx > 0 ? prev[idx - 1] : null;
      // Save to DB (non-blocking)
      submitFeedback({
        messageText: userMsg?.content || '',
        responseText: msg.content || '',
        rating,
      }).catch(() => {});
      return prev.map((m) => m === msg ? { ...m, feedback: rating } : m);
    });
  }, []);

  // ── #11 suggested question click ──────────────────────────────────────────
  const handleSuggestedClick = useCallback((question) => {
    setInput(question);
    // Auto-send after a tick
    setTimeout(() => {
      const syntheticEvent = new Event("assistant:autosend");
      syntheticEvent.text = question;
      window.dispatchEvent(syntheticEvent);
    }, 50);
  }, []);

  // ── parse suggestions from AI response ────────────────────────────────────
  const parseSuggestions = (reply) => {
    const match = reply.match(/\[SUGGESTIONS?\]:\s*(.+)/i);
    if (!match) return { content: reply, suggestions: [] };
    const content = reply.replace(/\[SUGGESTIONS?\]:\s*.+/i, "").trim();
    const suggestions = match[1].split("|").map((s) => s.trim()).filter(Boolean).slice(0, 3);
    return { content, suggestions };
  };

  // ── send message ───────────────────────────────────────────────────────────
  const doSend = useCallback(async (text) => {
    if (!text || sending) return;

    const userMsg = { role: "user", content: text };
    const loadingMsg = { role: "assistant", content: "", loading: true };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    setSending(true);

    try {
      const history = messages
        .filter((m) => !m.loading && m.content !== WELCOME_MESSAGE.content)
        .slice(-MAX_HISTORY)
        .map(({ role, content }) => ({ role, content }));

      history.push({ role: "user", content: text });

      const workspaceContext = buildWorkspaceContext(wsState);
      const rolePrompt = buildRoleAwarePrompt(userRoleId);
      const reply = await askAssistant(history, workspaceContext, rolePrompt);

      const { content, suggestions } = parseSuggestions(reply);

      const newMessages = [
        ...messages.filter((m) => !m.loading),
        { role: "user", content: text },
        { role: "assistant", content, suggestions },
      ];
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content, suggestions },
      ]);

      // Auto-save conversation to DB
      const title = text.slice(0, 60) || "Conversation";
      const saveable = newMessages
        .filter((m) => m.content && m.content !== WELCOME_MESSAGE.content)
        .map(({ role, content }) => ({ role, content }));
      if (convId) {
        apiUpdateConv(convId, { messages: saveable }).catch(() => {});
      } else {
        apiSaveConv({ title, messages: saveable })
          .then((c) => { if (c?.conversation_id) setConvId(c.conversation_id); })
          .catch(() => {});
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content:
            err?.message ||
            "Sorry, I'm unable to respond right now. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [sending, messages, wsState, userRoleId, convId]);

  const handleSend = useCallback(() => {
    doSend(input.trim());
  }, [input, doSend]);

  // Listen for auto-send from suggested question clicks
  useEffect(() => {
    const handler = (e) => { if (e.text) doSend(e.text); };
    window.addEventListener("assistant:autosend", handler);
    return () => window.removeEventListener("assistant:autosend", handler);
  }, [doSend]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([WELCOME_MESSAGE]);
    setInput("");
    setWsState(null);
    setConvId(null);
  };

  // Load conversation history list
  const loadHistory = useCallback(() => {
    apiListConv().then(setConvList).catch(() => setConvList([]));
  }, []);

  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory, loadHistory]);

  const handleLoadConversation = useCallback(async (id) => {
    try {
      const conv = await apiGetConv(id);
      if (conv?.messages) {
        const loaded = (typeof conv.messages === 'string' ? JSON.parse(conv.messages) : conv.messages) || [];
        setMessages([WELCOME_MESSAGE, ...loaded]);
        setConvId(conv.conversation_id);
        setShowHistory(false);
      }
    } catch { /* ignore */ }
  }, []);

  const handleDeleteConversation = useCallback(async (id) => {
    try {
      await apiDeleteConv(id);
      setConvList((prev) => prev.filter((c) => c.conversation_id !== id));
      if (convId === id) handleReset();
    } catch { /* ignore */ }
  }, [convId]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── chat window ── */}
      <Slide direction="up" in={open} mountOnEnter unmountOnExit>
        <Paper
          elevation={8}
          sx={{
            position: "fixed",
            bottom: panelSize === "large" ? 16 : panelSize === "small" ? 80 : 40,
            right: 28,
            zIndex: 1299,
            width: panelSize === "large" ? 480 : panelSize === "small" ? 320 : 380,
            height: panelSize === "large" ? "calc(100vh - 80px)" : panelSize === "small" ? 420 : 540,
            borderRadius: 3,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            border: `1px solid ${theme.palette.divider}`,
            transition: "width 0.25s ease, height 0.25s ease, bottom 0.25s ease",
          }}
        >
          {/* header */}
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{
              px: 1.5,
              py: 1.2,
              background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            <Avatar sx={{ width: 30, height: 30, bgcolor: "rgba(255,255,255,0.2)" }}>
              <PiRobotDuotone size={17} />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" fontWeight={700} lineHeight={1.2} fontSize={13}>
                AI Assistant
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85, fontSize: 10 }}>
                {wsLoading
                  ? "Loading…"
                  : wsError
                    ? "Ready to help"
                    : "TeamChatX Support"}
              </Typography>
            </Box>
            <Tooltip title="History">
              <IconButton size="small" onClick={() => setShowHistory((p) => !p)} sx={{ color: "#fff", p: 0.5 }}>
                <PiClockCounterClockwiseBold size={15} />
              </IconButton>
            </Tooltip>
            <Tooltip title="New chat">
              <IconButton size="small" onClick={handleReset} sx={{ color: "#fff", p: 0.5 }}>
                <PiArrowClockwiseBold size={15} />
              </IconButton>
            </Tooltip>
            <Tooltip title={panelSize === "large" ? "Shrink" : "Expand"}>
              <IconButton
                size="small"
                onClick={() => setPanelSize((prev) => prev === "small" ? "medium" : prev === "medium" ? "large" : "small")}
                sx={{ color: "#fff", p: 0.5 }}
              >
                {panelSize === "large" ? <PiArrowsInBold size={15} /> : <PiArrowsOutBold size={15} />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Close">
              <IconButton
                size="small"
                onClick={() => {
                  setOpen(false);
                  window.dispatchEvent(new CustomEvent("teamchatx:assistant", { detail: { open: false } }));
                }}
                sx={{ color: "#fff", p: 0.5 }}
              >
                <PiXBold size={15} />
              </IconButton>
            </Tooltip>
          </Stack>

          {/* workspace warning */}
          {wsError && (
            <Box
              sx={{
                px: 2,
                py: 0.7,
                bgcolor: "warning.lighter",
                borderBottom: `1px solid ${theme.palette.warning.light}`,
                flexShrink: 0,
              }}
            >
              <Typography variant="caption" color="warning.dark">
                ⚠ {wsError}
              </Typography>
            </Box>
          )}

          {/* History panel */}
          {showHistory ? (
            <Box sx={{ flex: 1, overflowY: "auto", "&::-webkit-scrollbar": { width: 4 }, "&::-webkit-scrollbar-thumb": { bgcolor: theme.palette.divider, borderRadius: 4 } }}>
              <Stack spacing={0} sx={{ py: 1 }}>
                <Stack direction="row" alignItems="center" sx={{ px: 2, pb: 1 }}>
                  <IconButton size="small" onClick={() => setShowHistory(false)} sx={{ mr: 1, p: 0.25 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </IconButton>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Past Conversations
                  </Typography>
                </Stack>
                {convList.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 3, textAlign: "center" }}>
                    No past conversations yet
                  </Typography>
                ) : (
                  convList.map((c) => (
                    <Stack
                      key={c.conversation_id}
                      direction="row"
                      alignItems="center"
                      sx={{
                        px: 2, py: 1, cursor: "pointer",
                        "&:hover": { bgcolor: theme.palette.action.hover },
                        borderBottom: `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }} onClick={() => handleLoadConversation(c.conversation_id)}>
                        <Typography variant="body2" noWrap sx={{ fontWeight: 600, fontSize: 12 }}>
                          {c.title || "Conversation"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                          {c.message_count || 0} messages · {new Date(c.updated_at || c.created_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDeleteConversation(c.conversation_id)} sx={{ p: 0.3, opacity: 0.4, "&:hover": { opacity: 1, color: "error.main" } }}>
                          <PiTrashBold size={13} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ))
                )}
              </Stack>
            </Box>
          ) : (
          <>
          {/* messages */}
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              py: 1.5,
              display: "flex",
              flexDirection: "column",
              gap: 1.2,
              "&::-webkit-scrollbar": { width: 4 },
              "&::-webkit-scrollbar-thumb": {
                bgcolor: theme.palette.divider,
                borderRadius: 4,
              },
            }}
          >
            {wsLoading && (
              <Stack alignItems="center" sx={{ py: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary" mt={0.5}>
                  Loading workspace data…
                </Typography>
              </Stack>
            )}

            {messages.map((msg, idx) => (
              <MessageBubble key={idx} msg={msg} theme={theme} onFeedback={handleFeedback} onSuggestedClick={handleSuggestedClick} />
            ))}
            <div ref={bottomRef} />
          </Box>

          {/* input */}
          <Box
            sx={{
              px: 1.5,
              py: 1.2,
              borderTop: `1px solid ${theme.palette.divider}`,
              flexShrink: 0,
              bgcolor: theme.palette.background.paper,
            }}
          >
            <OutlinedInput
              fullWidth
              multiline
              maxRows={3}
              placeholder="Ask anything about TeamChatX…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              size="small"
              sx={{
                borderRadius: 3,
                fontSize: "0.82rem",
                pr: 0.5,
                "& fieldset": { borderColor: theme.palette.divider },
              }}
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                  >
                    {sending ? (
                      <CircularProgress size={16} />
                    ) : (
                      <PiPaperPlaneTiltFill size={18} />
                    )}
                  </IconButton>
                </InputAdornment>
              }
            />
          </Box>
          </>
          )}
        </Paper>
      </Slide>
    </>
  );
};

export default LiveAssistant;
