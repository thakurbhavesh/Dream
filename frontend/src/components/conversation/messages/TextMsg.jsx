import React, { useCallback, useMemo, useState } from "react";
import { Box, Button, Link, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { PiVideoCameraBold, PiCopyBold } from "react-icons/pi";
import EmojiMsg from "./EmojiMsg.jsx";
import {
  buildTextMessageRenderCache,
  normalizeLinkHref,
} from "./helpers.js";

const buildMentionMatches = (text, mentions) => {
  if (!text || !mentions?.length) return [];
  const lowerText = text.toLowerCase();
  const normalized = mentions
    .map((mention) => ({
      ...mention,
      name: mention?.name?.trim() || "",
    }))
    .filter((mention) => mention.name)
    .sort((a, b) => b.name.length - a.name.length);
  const matches = [];
  normalized.forEach((mention) => {
    const token = `@${mention.name}`;
    const lowerToken = token.toLowerCase();
    let index = lowerText.indexOf(lowerToken);
    while (index !== -1) {
      const before = index > 0 ? text[index - 1] : "";
      if (!before || /\s/.test(before)) {
        const end = index + lowerToken.length;
        const overlapping = matches.some(
          (entry) => index < entry.end && end > entry.start
        );
        if (!overlapping) {
          matches.push({
            start: index,
            end,
            value: text.slice(index, end),
            mention,
          });
        }
      }
      index = lowerText.indexOf(lowerToken, index + lowerToken.length);
    }
  });
  return matches.sort((a, b) => a.start - b.start);
};

const splitTextByMentions = (text, matches) => {
  if (!matches.length) return [{ type: "text", value: text }];
  const segments = [];
  let cursor = 0;
  matches.forEach((match) => {
    if (match.start > cursor) {
      segments.push({
        type: "text",
        value: text.slice(cursor, match.start),
      });
    }
    segments.push({
      type: "mention",
      value: match.value,
      mention: match.mention,
    });
    cursor = match.end;
  });
  if (cursor < text.length) {
    segments.push({
      type: "text",
      value: text.slice(cursor),
    });
  }
  return segments.filter((segment) => segment.value !== "");
};

const injectMentionsIntoHtml = (html, mentions) => {
  if (
    !html ||
    !mentions?.length ||
    typeof DOMParser === "undefined" ||
    typeof document === "undefined"
  ) {
    return html || "";
  }
  let doc;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return html || "";
  }
  if (!doc?.body) return html || "";
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node?.nodeValue) continue;
    const parentTag = node.parentElement?.tagName?.toUpperCase?.() || "";
    if (parentTag === "A") continue;
    textNodes.push(node);
  }
  textNodes.forEach((node) => {
    const rawText = node.nodeValue || "";
    const matches = buildMentionMatches(rawText, mentions);
    if (!matches.length) return;
    const fragment = doc.createDocumentFragment();
    let cursor = 0;
    matches.forEach((match) => {
      if (match.start > cursor) {
        fragment.appendChild(
          doc.createTextNode(rawText.slice(cursor, match.start))
        );
      }
      const span = doc.createElement("span");
      span.textContent = match.value;
      span.className = "mention-token";
      span.setAttribute(
        "data-mention-name",
        match.mention?.name || match.value.replace(/^@/, "")
      );
      fragment.appendChild(span);
      cursor = match.end;
    });
    if (cursor < rawText.length) {
      fragment.appendChild(doc.createTextNode(rawText.slice(cursor)));
    }
    node.parentNode?.replaceChild(fragment, node);
  });
  return doc.body.innerHTML;
};

// ─── Meeting Invite Card ──────────────────────────────────────────────────
const MeetingInviteCard = ({ metadata }) => {
  const { meetingId, meetingTitle, scheduledAt } = metadata || {};
  const [copied, setCopied] = useState(false);

  const handleJoin = () => {
    window.dispatchEvent(
      new CustomEvent("meeting:join-from-invite", {
        detail: { meeting_id: meetingId, title: meetingTitle },
      })
    );
  };

  const handleCopy = () => {
    if (meetingId) {
      navigator.clipboard.writeText(meetingId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Box
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        maxWidth: 320,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #1565c0, #1976d2)",
          px: 2,
          py: 1.25,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <PiVideoCameraBold size={18} color="#fff" />
        <Typography variant="subtitle2" sx={{ color: "#fff", fontWeight: 600 }}>
          Meeting Invite
        </Typography>
      </Box>

      {/* Body */}
      <Stack sx={{ px: 2, py: 1.5 }} spacing={1}>
        <Typography variant="subtitle2" fontWeight={700} noWrap>
          {meetingTitle || "Meeting"}
        </Typography>

        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="caption" color="text.secondary">
            ID:
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontFamily: "monospace",
              fontWeight: 700,
              color: "primary.main",
              letterSpacing: 1,
            }}
          >
            {meetingId}
          </Typography>
          <Box
            component="span"
            onClick={handleCopy}
            sx={{ cursor: "pointer", display: "inline-flex", ml: 0.5 }}
          >
            <PiCopyBold size={13} color={copied ? "#4caf50" : "#999"} />
          </Box>
        </Stack>

        {scheduledAt && (
          <Typography variant="caption" color="text.secondary">
            {new Date(scheduledAt).toLocaleString([], {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </Typography>
        )}

        <Button
          variant="contained"
          size="small"
          startIcon={<PiVideoCameraBold size={16} />}
          onClick={handleJoin}
          sx={{
            mt: 0.5,
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 1.5,
            py: 0.75,
          }}
        >
          Join Meeting
        </Button>
      </Stack>
    </Box>
  );
};

const TextMsg = ({ message }) => {
  // console.log("[TextMsg] message --->", message);
  const isMeetingInvite = message?.metadata?.meetingInvite === true;
  const textValue = message?.content?.text ?? "";
  const htmlValue = message?.content?.html ?? "";
  const mentionEntries = message?.metadata?.mentions ?? [];
  const fallbackEmojiOnly = useMemo(
    () => Boolean(message?.content?.isEmojiOnly || message?.type === "emoji"),
    [message]
  );
  const renderPayload = useMemo(() => {
    if (message?.__renderCache) return message.__renderCache;
    return buildTextMessageRenderCache({
      textValue,
      htmlValue,
      isEmojiOnly: fallbackEmojiOnly,
    });
  }, [message, textValue, htmlValue, fallbackEmojiOnly]);
  const emojiTokens = renderPayload?.emojiTokens ?? [];
  const tokens = renderPayload?.linkTokens ?? [];
  const isEmojiOnly = renderPayload?.isEmojiOnly ?? fallbackEmojiOnly;
  const linkifiedHtml = renderPayload?.linkifiedHtml ?? "";
  const textMentionMatches = useMemo(
    () => buildMentionMatches(textValue, mentionEntries),
    [mentionEntries, textValue]
  );
  const mentionMap = useMemo(() => {
    const map = new Map();
    mentionEntries.forEach((mention) => {
      const key = mention?.name?.trim()?.toLowerCase();
      if (key) {
        map.set(key, mention);
      }
    });
    return map;
  }, [mentionEntries]);
  const mentionifiedHtml = useMemo(
    () => injectMentionsIntoHtml(linkifiedHtml, mentionEntries),
    [linkifiedHtml, mentionEntries]
  );
  const handleMentionClick = useCallback(
    (mention) => {
      if (!mention) return;
      console.log("[Mention] clicked", {
        ...mention,
        messageId: message?.id || "",
        messageText: textValue,
      });
    },
    [message?.id, textValue]
  );
  const handleMentionTokenClick = useCallback(
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const token = target.closest("[data-mention-name]");
      if (!token) return;
      const name = token.getAttribute("data-mention-name") || "";
      if (!name) return;
      const mention =
        mentionMap.get(name.trim().toLowerCase()) || { name };
      handleMentionClick(mention);
    },
    [handleMentionClick, mentionMap]
  );

  // Meeting invite → render card with Join button
  if (isMeetingInvite && message?.metadata?.meetingId) {
    return <MeetingInviteCard metadata={message.metadata} />;
  }

  if (isEmojiOnly) {
    // Emoji-only payloads get elevated into a grid so large reactions do not
    // overflow the bubble and continue to feel playful.
    const emojiOnlyTokens = emojiTokens.filter((token) => token.type === "emoji");
    if (emojiOnlyTokens.length === 0) {
      return (
        <Typography
          variant="body2"
          sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {textValue}
        </Typography>
      );
    }
    const singleEmoji = emojiOnlyTokens.length === 1;
    const size = singleEmoji ? 78 : 44;
    if (singleEmoji) {
      return (
        <Stack
          direction="row"
          spacing={1}
          justifyContent="center"
          alignItems="center"
        >
          <EmojiMsg
            key={`emoji-only-${emojiOnlyTokens[0].value}`}
            emoji={emojiOnlyTokens[0].value}
            size={size}
          />
        </Stack>
      );
    }
    const itemsPerRow = 6;
    const rows = [];
    for (let i = 0; i < emojiOnlyTokens.length; i += itemsPerRow) {
      rows.push(emojiOnlyTokens.slice(i, i + itemsPerRow));
    }
    return (
      <Stack spacing={0.5} sx={{ px: 1 }}>
        {rows.map((row, rowIndex) => (
          <Stack
            key={`emoji-row-${rowIndex}`}
            direction="row"
            spacing={1}
            justifyContent="center"
            flexWrap="wrap"
            alignItems="center"
          >
            {row.map((token, index) => (
              <EmojiMsg
                key={`emoji-only-${rowIndex}-${index}-${token.value}`}
                emoji={token.value}
                size={size}
              />
            ))}
          </Stack>
        ))}
      </Stack>
    );
  }

  if (linkifiedHtml) {
    return (
      <CollapsibleText textValue={textValue}>
        <Typography
          component="div"
          variant="body2"
          onClick={mentionEntries.length ? handleMentionTokenClick : undefined}
          sx={(theme) => ({
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            "& a": {
              color: theme.palette.primary.light,
              textDecoration: "underline",
              fontWeight: 600,
            },
            "& .mention-token": {
              fontWeight: 700,
              color: theme.palette.primary.main,
              backgroundColor: alpha(theme.palette.primary.main, 0.12),
              borderRadius: 6,
              padding: "0 4px",
              cursor: "pointer",
            },
          })}
          dangerouslySetInnerHTML={{ __html: mentionifiedHtml }}
        />
      </CollapsibleText>
    );
  }

  return (
    <CollapsibleText textValue={textValue}>
    <Typography
      variant="body2"
      sx={(theme) => ({
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        "& a": {
          color: theme.palette.primary.light,
          textDecoration: "underline",
          fontWeight: 600,
        },
        "& .mention-token": {
          fontWeight: 700,
          color: theme.palette.primary.main,
          backgroundColor: alpha(theme.palette.primary.main, 0.12),
          borderRadius: 6,
          padding: "0 4px",
          cursor: "pointer",
        },
      })}
    >
      {tokens.length === 0
        ? splitTextByMentions(textValue, textMentionMatches).map(
            (segment, index) =>
            segment.type === "mention" ? (
              <span
                key={`mention-${index}-${segment.value}`}
                className="mention-token"
                role="button"
                tabIndex={0}
                onClick={() => handleMentionClick(segment.mention)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleMentionClick(segment.mention);
                  }
                }}
              >
                {segment.value}
              </span>
            ) : (
              <React.Fragment key={`text-${index}`}>
                {segment.value}
              </React.Fragment>
            )
          )
        : tokens.map((token, index) => {
            if (token.type === "emoji") {
              return (
                <EmojiMsg
                  key={`emoji-${index}-${token.value}`}
                  emoji={token.value}
                />
              );
            }
            if (token.type === "link") {
              const href = normalizeLinkHref(token.value);
              return (
                <Link
                  key={`link-${index}-${token.value}`}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="always"
                  sx={(theme) => ({
                    wordBreak: "break-all",
                    color: theme.palette.primary.light,
                    fontWeight: 600,
                  })}
                >
                  {token.value}
                </Link>
              );
            }
            if (token.type === "text") {
              const segments = splitTextByMentions(
                token.value,
                buildMentionMatches(token.value, mentionEntries)
              );
              return segments.map((segment, segmentIndex) =>
                segment.type === "mention" ? (
                  <span
                    key={`mention-${index}-${segmentIndex}-${segment.value}`}
                    className="mention-token"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleMentionClick(segment.mention)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleMentionClick(segment.mention);
                      }
                    }}
                  >
                    {segment.value}
                  </span>
                ) : (
                  <React.Fragment key={`text-${index}-${segmentIndex}`}>
                    {segment.value}
                  </React.Fragment>
                )
              );
            }
            return (
              <React.Fragment key={`text-${index}`}>
                {token.value}
              </React.Fragment>
            );
          })}
    </Typography>
    </CollapsibleText>
  );
};

// Show more / Show less for messages > 4 lines
const LINE_CLAMP = 4;
const CollapsibleText = ({ children, textValue = "" }) => {
  const [expanded, setExpanded] = useState(false);
  const lineCount = useMemo(() => (textValue || "").split("\n").length, [textValue]);
  const charCount = (textValue || "").length;
  // Show toggle if > 4 lines or > 300 characters
  const needsCollapse = lineCount > LINE_CLAMP || charCount > 300;

  if (!needsCollapse) return children;

  return (
    <Box>
      <Box
        sx={{
          ...(expanded
            ? {}
            : {
                display: "-webkit-box",
                WebkitLineClamp: LINE_CLAMP,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }),
        }}
      >
        {children}
      </Box>
      <Typography
        component="span"
        variant="caption"
        onClick={() => setExpanded((prev) => !prev)}
        sx={(theme) => ({
          color: theme.palette.primary.main,
          cursor: "pointer",
          fontWeight: 600,
          mt: 0.5,
          display: "inline-block",
          "&:hover": { textDecoration: "underline" },
        })}
      >
        {expanded ? "Show less" : "Show more"}
      </Typography>
    </Box>
  );
};

export default TextMsg;
