import { sanitizeComposerHtml } from "../../../utils/richTextSanitizer.js";
import { formatTimeInTz, formatDayInTz, formatFullDayInTz } from "../../../utils/timezone.js";

const shortTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

// Matches fully-qualified emoji glyphs (including zero-width joiner sequences)
// without catching keycap digits or other ASCII that merely have the Emoji property.
const EMOJI_REGEX =
  /(\p{Extended_Pictographic}(?:\uFE0F|\u200D[\p{Extended_Pictographic}\uFE0F]+)*)/gu;

const INLINE_URL_REGEX =
  /((?:https?:\/\/|www\.)[^\s]+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;
const TRAILING_PUNCT_REGEX = /[),.;!?]+$/;

export const normalizeLinkHref = (value = "") => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  return `https://${value}`;
};

export const tokenizeEmojiText = (text = "") => {
  if (!text) return [];
  const tokens = [];
  let lastIndex = 0;
  text.replace(EMOJI_REGEX, (match, _group, offset) => {
    if (offset > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, offset) });
    }
    tokens.push({ type: "emoji", value: match });
    lastIndex = offset + match.length;
    return match;
  });
  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }
  return tokens.filter((token) => token.value);
};

export const splitTextWithLinks = (value = "") => {
  if (!value) return [];
  const segments = [];
  let lastIndex = 0;
  value.replace(INLINE_URL_REGEX, (match, _group, offset) => {
    if (offset > lastIndex) {
      segments.push({
        type: "text",
        value: value.slice(lastIndex, offset),
      });
    }
    const trimmedMatch = match.replace(TRAILING_PUNCT_REGEX, "");
    if (!trimmedMatch) {
      segments.push({ type: "text", value: match });
      lastIndex = offset + match.length;
      return match;
    }
    const trailing = match.slice(trimmedMatch.length);
    segments.push({ type: "link", value: trimmedMatch });
    if (trailing) {
      segments.push({ type: "text", value: trailing });
    }
    lastIndex = offset + match.length;
    return match;
  });
  if (lastIndex < value.length) {
    segments.push({
      type: "text",
      value: value.slice(lastIndex),
    });
  }
  return segments.filter((segment) => Boolean(segment.value));
};

export const injectLinkTokens = (tokens = []) =>
  tokens.flatMap((token) => {
    if (token.type !== "text") return token.value ? [token] : [];
    return splitTextWithLinks(token.value);
  });

export const linkifyHtmlContent = (html = "") => {
  if (
    !html ||
    typeof window === "undefined" ||
    typeof DOMParser === "undefined"
  ) {
    return html || "";
  }
  let doc;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(html, "text/html");
  } catch {
    return html || "";
  }
  if (!doc?.body) {
    return html || "";
  }
  const walker = doc.createTreeWalker(
    doc.body,
    typeof NodeFilter !== "undefined" ? NodeFilter.SHOW_TEXT : 4
  );
  const textNodes = [];
  while (walker.nextNode()) {
    const currentNode = walker.currentNode;
    if (!currentNode?.nodeValue) continue;
    const parentTag =
      currentNode.parentElement?.tagName?.toUpperCase?.() || "";
    if (parentTag === "A") continue;
    textNodes.push(currentNode);
  }
  textNodes.forEach((node) => {
    const segments = splitTextWithLinks(node.nodeValue || "");
    if (!segments.some((segment) => segment.type === "link")) {
      return;
    }
    const fragment = doc.createDocumentFragment();
    segments.forEach((segment) => {
      if (segment.type === "link") {
        const anchor = doc.createElement("a");
        anchor.textContent = segment.value;
        anchor.setAttribute("href", normalizeLinkHref(segment.value));
        anchor.setAttribute("target", "_blank");
        anchor.setAttribute("rel", "noopener noreferrer");
        fragment.appendChild(anchor);
        return;
      }
      fragment.appendChild(doc.createTextNode(segment.value));
    });
    node.parentNode?.replaceChild(fragment, node);
  });
  // Ensure ALL <a> tags open in new tab (including pasted links)
  doc.body.querySelectorAll("a").forEach((a) => {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  });
  return doc.body.innerHTML.trim();
};

export const buildTextMessageRenderCache = ({
  textValue = "",
  htmlValue = "",
  isEmojiOnly = false,
} = {}) => {
  const emojiTokens = tokenizeEmojiText(textValue);
  const linkTokens = injectLinkTokens(emojiTokens);
  let sanitizedHtml = "";
  let linkifiedHtml = "";
  if (htmlValue && !isEmojiOnly) {
    sanitizedHtml = sanitizeComposerHtml(htmlValue);
    linkifiedHtml = sanitizedHtml ? linkifyHtmlContent(sanitizedHtml) : "";
  }
  return {
    emojiTokens,
    linkTokens,
    sanitizedHtml,
    linkifiedHtml,
    isEmojiOnly,
  };
};

export const ensureRenderableCache = (message) => {
  if (!message) return message;
  const content = message.content || {};
  const textValue = typeof content.text === "string" ? content.text : "";
  const htmlValue = typeof content.html === "string" ? content.html : "";
  const isEmojiOnly = Boolean(content.isEmojiOnly || message.type === "emoji");
  if (!textValue && !htmlValue && !isEmojiOnly) {
    return message;
  }
  const existing = message.__renderCache;
  if (
    existing &&
    existing.textValue === textValue &&
    existing.htmlValue === htmlValue &&
    existing.isEmojiOnly === isEmojiOnly
  ) {
    return message;
  }
  const prepared = buildTextMessageRenderCache({
    textValue,
    htmlValue,
    isEmojiOnly,
  });
  return {
    ...message,
    __renderCache: {
      ...prepared,
      textValue,
      htmlValue,
      isEmojiOnly,
    },
  };
};

const pickString = (...values) => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return undefined;
};

const TYPE_ALIASES = {
  message: "text",
  url: "link",
  media: "file",
  attachment: "file",
  pdf: "file",
  doc: "file",
  document: "file",
  snippet: "code",
  voice: "audio",
  event: "system",
  notice: "system",
};

const SYSTEM_EVENT_TYPES = new Set(["system", "event", "notice"]);

const normaliseEventAction = (action = "") => {
  if (!action) return "";
  return action.toLowerCase().replace(/\s+/g, "_");
};

const formatNameList = (names = []) => {
  const cleaned = names.filter(Boolean);
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
};

const resolveEventTargetNames = (targets) => {
  if (!targets) return [];
  if (Array.isArray(targets)) {
    return targets
      .map((target) => {
        if (typeof target === "string") return target.trim();
        if (typeof target === "object") {
          return pickString(
            target.name,
            target.label,
            target.username,
            target.email
          );
        }
        return "";
      })
      .filter(Boolean);
  }
  if (typeof targets === "string") {
    return targets
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof targets === "object") {
    const name = pickString(
      targets.name,
      targets.label,
      targets.username,
      targets.email
    );
    return name ? [name] : [];
  }
  return [];
};

const resolveSystemEventPayload = (message) => {
  const event =
    message?.metadata?.event ??
    message?.event ??
    message?.systemEvent ??
    message?.metadata?.systemEvent ??
    {};
  const action = pickString(
    event.action,
    event.type,
    event.eventType,
    message?.action,
    message?.eventType,
    message?.metadata?.action,
    message?.metadata?.eventType
  );
  const actorName =
    pickString(
      event.actor?.name,
      event.actorName,
      event.by,
      message?.actor?.name,
      message?.actorName,
      message?.metadata?.actor?.name,
      message?.metadata?.actorName
    ) || "Someone";
  const targets = resolveEventTargetNames(
    event.targets ?? event.target ?? message?.targets ?? message?.target
  );
  const groupName = pickString(
    event.groupName,
    message?.groupName,
    message?.metadata?.groupName,
    message?.metadata?.threadName
  );
  const explicitText = pickString(
    event.text,
    event.message,
    message?.content?.text,
    message?.text,
    message?.message,
    message?.body
  );
  return {
    action: normaliseEventAction(action),
    actorName,
    targets,
    groupName,
    explicitText,
  };
};

export const isSystemEventMessage = (message) => {
  if (!message) return false;
  const type = message?.type?.toLowerCase?.();
  if (type && SYSTEM_EVENT_TYPES.has(type)) return true;
  return Boolean(
    message?.event ||
      message?.systemEvent ||
      message?.metadata?.event ||
      message?.metadata?.systemEvent
  );
};

export const formatSystemEventLabel = (message) => {
  if (!message) return "";
  const payload = resolveSystemEventPayload(message);
  if (payload.explicitText) {
    return payload.explicitText.replace(/\bMyself\b/g, "You");
  }
  const actor = payload.actorName || "Someone";
  const actorLabel = actor.replace(/\bMyself\b/g, "You");
  const targetsLabel = formatNameList(payload.targets) || "someone";
  const action = payload.action;

  switch (action) {
    case "member_added":
    case "add_member":
    case "member_add":
      return `${actorLabel} added ${targetsLabel}`;
    case "member_removed":
    case "remove_member":
    case "member_remove":
      return `${actorLabel} removed ${targetsLabel}`;
    case "member_joined":
    case "join":
    case "member_join":
      return `${actorLabel} joined the group`;
    case "member_left":
    case "leave":
    case "member_leave":
      return `${actorLabel} left the group`;
    case "admin_promoted":
    case "promote_admin":
    case "admin_add":
      return `${actorLabel} made ${targetsLabel} an admin`;
    case "admin_removed":
    case "demote_admin":
    case "admin_remove":
      return `${actorLabel} removed admin rights from ${targetsLabel}`;
    case "group_renamed":
    case "group_name_changed":
      return payload.groupName
        ? `${actorLabel} changed the group name to ${payload.groupName}`
        : `${actorLabel} changed the group name`;
    case "group_photo_updated":
    case "group_avatar_updated":
      return `${actorLabel} updated the group photo`;
    case "group_description_updated":
    case "group_topic_updated":
      return `${actorLabel} updated the group description`;
    case "group_created":
    case "group_create":
      return payload.groupName
        ? `${actorLabel} created ${payload.groupName}`
        : `${actorLabel} created the group`;
    case "link_regenerated":
    case "invite_link_regenerated":
      return `${actorLabel} reset the invite link`;
    case "permissions_changed":
    case "group_permissions_updated":
      return `${actorLabel} updated group permissions`;
    case "message_pinned":
    case "pinned":
      return `${actorLabel} pinned a message`;
    case "message_unpinned":
    case "unpinned":
      return `${actorLabel} unpinned a message`;
    default:
      return "System update";
  }
};

export const formatFileSize = (bytes) => {
  const numeric = Number(bytes);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  let value = numeric;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

export const isEmojiOnlyText = (value = "") => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const matches = trimmed.match(EMOJI_REGEX);
  if (!matches || matches.length === 0) return false;
  const stripped = trimmed
    .replace(EMOJI_REGEX, "")
    .replace(/\u200D|\uFE0F|\s/g, "");
  return stripped.length === 0;
};

const normaliseDateInput = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
};

const CODE_LANGUAGE_DEFINITIONS = {
  typescript: {
    label: "TypeScript",
    extension: "ts",
    patterns: [/\binterface\b/, /\benum\b/, /\bimplements\b/, /:\s*(string|number|boolean|any|unknown)/],
  },
  javascript: {
    label: "JavaScript",
    extension: "js",
    patterns: [/\bconst\b/, /\blet\b/, /\bfunction\b/, /=>/, /\bimport\s+.*from\b/, /\brequire\(/],
  },
  python: {
    label: "Python",
    extension: "py",
    patterns: [/\bdef\b/, /\bself\b/, /\bprint\(/],
  },
  java: {
    label: "Java",
    extension: "java",
    patterns: [/\bpublic\s+class\b/, /\bSystem\.out\.println\b/],
  },
  csharp: {
    label: "C#",
    extension: "cs",
    patterns: [/\busing\s+System\b/, /\bConsole\.WriteLine\b/, /\bnamespace\b/],
  },
  cpp: {
    label: "C++",
    extension: "cpp",
    patterns: [/#include\s+</, /\bstd::/, /\bcout\b/],
  },
  ruby: {
    label: "Ruby",
    extension: "rb",
    patterns: [/\bend\b/, /\bputs\b/, /\bdef\b/],
  },
  php: {
    label: "PHP",
    extension: "php",
    patterns: [/<\?php/, /\becho\b/, /\$\w+/],
  },
  go: {
    label: "Go",
    extension: "go",
    patterns: [/\bpackage\s+main\b/, /\bfunc\b/, /\bfmt\./],
  },
  swift: {
    label: "Swift",
    extension: "swift",
    patterns: [/\bimport\s+Swift/i, /\blet\s+\w+:/, /\bfunc\b/],
  },
  kotlin: {
    label: "Kotlin",
    extension: "kt",
    patterns: [/\bfun\s+main\b/, /\bval\b/, /\bdata\s+class\b/],
  },
  dart: {
    label: "Dart",
    extension: "dart",
    patterns: [/\bvoid\s+main\b/, /import\s+['"]dart/],
  },
  sql: {
    label: "SQL",
    extension: "sql",
    patterns: [/\bSELECT\b/i, /\bINSERT\b/i, /\bUPDATE\b/i, /\bCREATE\s+TABLE\b/i],
  },
  css: {
    label: "CSS",
    extension: "css",
    patterns: [/[.#]?[a-zA-Z0-9_-]+\s*\{[^}]+\}/],
  },
  shell: {
    label: "Shell",
    extension: "sh",
    patterns: [/^#!/, /\becho\b/, /\bfi\b/],
  },
  html: {
    label: "HTML",
    extension: "html",
    patterns: [/<!DOCTYPE\s+html/i, /<html/i, /<\/[a-z]+>/i],
  },
  json: {
    label: "JSON",
    extension: "json",
    patterns: [],
  },
  plaintext: {
    label: "Plain Text",
    extension: "txt",
    patterns: [],
  },
};

const CODE_LANGUAGE_ORDER = [
  "typescript",
  "javascript",
  "python",
  "java",
  "csharp",
  "cpp",
  "ruby",
  "php",
  "go",
  "swift",
  "kotlin",
  "dart",
  "sql",
  "css",
  "shell",
  "html",
];

const CODE_DEFAULT_LANGUAGE = "plaintext";
const CODE_LANGUAGE_OPTION_IDS = Array.from(
  new Set([
    ...CODE_LANGUAGE_ORDER,
    "json",
    CODE_DEFAULT_LANGUAGE,
    ...Object.keys(CODE_LANGUAGE_DEFINITIONS),
  ])
);
const CODE_LANGUAGE_OPTIONS = CODE_LANGUAGE_OPTION_IDS.map((id) => ({
  id,
  label:
    CODE_LANGUAGE_DEFINITIONS[id]?.label ||
    CODE_LANGUAGE_DEFINITIONS[CODE_DEFAULT_LANGUAGE].label,
}));

const OVERLAY_LANGUAGE_LABELS = [
  "APL",
  "PGP",
  "ASN.1",
  "Asterisk",
  "C",
  "C++",
  "Cobol",
  "C#",
  "Clojure",
  "ClojureScript",
  "Closure Stylesheets (GSS)",
  "CMake",
  "CoffeeScript",
  "Common Lisp",
  "Cypher",
  "Cython",
  "Crystal",
  "CSS",
  "CQL",
  "D",
  "Dart",
  "diff",
  "Django",
  "Dockerfile",
  "DTD",
  "Dylan",
  "EBNF",
  "ECL",
  "edn",
  "Eiffel",
  "Elm",
  "Embedded Javascript",
  "Embedded Ruby",
  "Erlang",
  "Esper",
  "Factor",
  "FCL",
  "Forth",
  "Fortran",
  "F#",
  "Gas",
  "Gherkin",
  "GitHub Flavored Markdown",
  "Go",
  "Groovy",
  "HAML",
  "Haskell",
  "Haskell (Literate)",
  "Haxe",
  "HXML",
  "ASP.NET",
  "HTML",
  "HTTP",
  "IDL",
  "Pug",
  "Java",
  "Java Server Pages",
  "JavaScript",
  "JSON",
  "JSON-LD",
  "JSX",
  "Jinja2",
  "Julia",
  "Kotlin",
  "LESS",
  "LiveScript",
  "Lua",
  "Markdown",
  "mIRC",
  "MariaDB SQL",
  "Mathematica",
  "Modelica",
  "MUMPS",
  "MS SQL",
  "mbox",
  "MySQL",
  "Nginx",
  "NSIS",
  "NTriples",
  "Objective-C",
  "Objective-C++",
  "OCaml",
  "Octave",
  "Oz",
  "Pascal",
  "PEG.js",
  "Perl",
  "PHP",
  "Pig",
  "Plain Text",
  "PLSQL",
  "PostgreSQL",
  "PowerShell",
  "Properties files",
  "ProtoBuf",
  "Python",
  "Puppet",
  "Q",
  "R",
  "reStructuredText",
  "RPM Changes",
  "RPM Spec",
  "Ruby",
  "Rust",
  "SAS",
  "Sass",
  "Scala",
  "Scheme",
  "SCSS",
  "Shell",
  "Sieve",
  "Slim",
  "Smalltalk",
  "Smarty",
  "Solr",
  "SML",
  "Soy",
  "SPARQL",
  "Spreadsheet",
  "SQL",
  "SQLite",
  "Squirrel",
  "Stylus",
  "Swift",
  "sTeX",
  "LaTeX",
  "SystemVerilog",
  "Tcl",
  "Textile",
  "TiddlyWiki",
  "Tiki wiki",
  "TOML",
  "Tornado",
  "troff",
  "TTCN",
  "TTCN_CFG",
  "Turtle",
  "TypeScript",
  "TypeScript-JSX",
  "Twig",
  "Web IDL",
  "VB.NET",
  "VBScript",
  "Velocity",
  "Verilog",
  "VHDL",
  "Vue.js Component",
  "XML",
  "XQuery",
  "Yacas",
  "YAML",
  "Z80",
  "mscgen",
  "xu",
  "msgenny",
  "WebAssembly",
];

const slugifyLanguageId = (label) =>
  label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9+-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const OVERLAY_LANGUAGE_OPTIONS = OVERLAY_LANGUAGE_LABELS.map((label) => ({
  id: slugifyLanguageId(label) || label.toLowerCase(),
  label,
}));
const CODE_DETECTION_CACHE_LIMIT = 400;
const CODE_CACHE_SNIPPET_LIMIT = 4000;
const codeDetectionCache = new Map();

const getCodeCacheKey = (code, hint) => {
  if (!code && !hint) return null;
  const normalizedSnippet =
    typeof code === "string"
      ? code.slice(0, CODE_CACHE_SNIPPET_LIMIT)
      : "";
  return `${hint || ""}::${normalizedSnippet}`;
};

const getCachedLanguageDetection = (key) => {
  if (!key) return null;
  return codeDetectionCache.get(key) || null;
};

const cacheLanguageDetection = (key, value) => {
  if (!key || !value) return;
  codeDetectionCache.set(key, value);
  if (codeDetectionCache.size > CODE_DETECTION_CACHE_LIMIT) {
    const oldestKey = codeDetectionCache.keys().next().value;
    if (oldestKey) {
      codeDetectionCache.delete(oldestKey);
    }
  }
};

export const getLanguageDisplayName = (languageId) =>
  CODE_LANGUAGE_DEFINITIONS[languageId]?.label ||
  CODE_LANGUAGE_DEFINITIONS[CODE_DEFAULT_LANGUAGE].label;

export const getCodeLanguageOptions = () => CODE_LANGUAGE_OPTIONS;
export const getOverlayLanguageOptions = () => OVERLAY_LANGUAGE_OPTIONS;

export const detectCodeLanguage = (code = "", hint = "") => {
  const normalizedHint = hint?.toLowerCase?.();
  const trimmed = code?.trim?.() ?? "";
  const cacheKey = getCodeCacheKey(trimmed, normalizedHint);
  const cached = getCachedLanguageDetection(cacheKey);
  if (cached) {
    return cached;
  }
  if (normalizedHint && CODE_LANGUAGE_DEFINITIONS[normalizedHint]) {
    const hinted = CODE_LANGUAGE_DEFINITIONS[normalizedHint];
    const result = {
      id: normalizedHint,
      label: hinted.label,
      extension: hinted.extension,
    };
    cacheLanguageDetection(cacheKey, result);
    return result;
  }
  if (!trimmed) {
    const fallback = CODE_LANGUAGE_DEFINITIONS[CODE_DEFAULT_LANGUAGE];
    const result = {
      id: CODE_DEFAULT_LANGUAGE,
      label: fallback.label,
      extension: fallback.extension,
    };
    cacheLanguageDetection(cacheKey, result);
    return result;
  }
  if (/^<\?php/i.test(trimmed)) {
    const def = CODE_LANGUAGE_DEFINITIONS.php;
    const result = { id: "php", label: def.label, extension: def.extension };
    cacheLanguageDetection(cacheKey, result);
    return result;
  }
  if (/^[{\[]/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      const jsonDef = CODE_LANGUAGE_DEFINITIONS.json;
      const result = {
        id: "json",
        label: jsonDef.label,
        extension: jsonDef.extension,
      };
      cacheLanguageDetection(cacheKey, result);
      return result;
    } catch {
      // not json
    }
  }
  for (const id of CODE_LANGUAGE_ORDER) {
    const def = CODE_LANGUAGE_DEFINITIONS[id];
    if (def.patterns.some((pattern) => pattern.test(trimmed))) {
      const result = { id, label: def.label, extension: def.extension };
      cacheLanguageDetection(cacheKey, result);
      return result;
    }
  }
  const fallback = CODE_LANGUAGE_DEFINITIONS[CODE_DEFAULT_LANGUAGE];
  const result = {
    id: CODE_DEFAULT_LANGUAGE,
    label: fallback.label,
    extension: fallback.extension,
  };
  cacheLanguageDetection(cacheKey, result);
  return result;
};

export const resolveCodeContent = ({
  code = "",
  language,
  filename,
} = {}) => {
  const detected = detectCodeLanguage(code, language);
  const resolvedFilename =
    pickString(filename) || `Untitled.${detected.extension || "txt"}`;
  return {
    code,
    language: detected.id,
    filename: resolvedFilename,
  };
};

const parseFileList = (files) => {
  if (!files) return [];
  if (Array.isArray(files)) {
    return files.filter(Boolean);
  }
  if (typeof files === "string") {
    try {
      const parsed = JSON.parse(files);
      return parseFileList(parsed);
    } catch {
      return [];
    }
  }
  if (typeof files === "object") {
    return Object.values(files).filter(Boolean);
  }
  return [];
};

const buildFileEntry = (file) => {
  if (!file) return null;
  const mimeType =
    pickString(
      file.mimeType,
      file.mimetype,
      file.mime_type,
      file.type,
      file.contentType
    ) || "application/octet-stream";
  const fileName =
    pickString(file.fileName, file.name, file.originalName, file.original_name) ||
    "attachment";
  const inferredSize = Number(
    file.rawSize ??
      file.size ??
      file.file_size ??
      file.length ??
      file.byteLength ??
      0
  );
  const sizeLabel =
    pickString(file.fileSize, file.sizeLabel) ||
    (Number.isFinite(inferredSize) ? formatFileSize(inferredSize) : "0 B");
  const fileUrl =
    pickString(
      file.url,
      file.fileUrl,
      file.file_url,
      file.previewUrl,
      file.preview_url,
      file.path
    ) || "";
  const downloadUrl =
    pickString(
      file.downloadUrl,
      file.download_url,
      file.fileUrl,
      file.file_download_url,
      file.downloadSource,
      file.file_url,
      file.url
    ) || "";
  return {
    fileName,
    fileSize: sizeLabel,
    rawSize: Number.isFinite(inferredSize) ? inferredSize : 0,
    mimeType,
    url: fileUrl,
    downloadUrl,
    preview: pickString(file.preview, file.caption, file.description),
    thumbnail:
      pickString(
        file.thumbnail,
        file.thumb,
        file.thumbUrl,
        file.thumb_url,
        file.thumbnailUrl,
        file.thumbnail_url
      ) || (mimeType.startsWith("image/") ? fileUrl : ""),
    width: file.width,
    height: file.height,
    caption: pickString(file.caption, file.description),
  };
};

const looksLikeFileDescriptor = (value) => {
  if (!value || typeof value !== "object") return false;
  return Boolean(
    value.url ||
      value.file_url ||
      value.previewUrl ||
      value.preview_url ||
      value.fileName ||
      value.name ||
      value.originalName ||
      value.original_name ||
      value.mimeType ||
      value.type ||
      value.mime ||
      value.downloadUrl ||
      value.download_url
  );
};

const normaliseAuthor = (message) => {
  const source =
    message?.author ?? message?.sender ?? message?.fromUser ?? message?.user ?? null;
  if (message?.author) {
    const authorAvatar = pickString(
      message.author?.avatar,
      message.author?.profilePicture,
      message.author?.photo,
      message.author?.photoUrl,
      message.author?.photoURL,
      message.author?.image,
      message.author?.picture,
      message.author?.avatarUrl,
      message.author?.avatarURL
    );
    return authorAvatar
      ? { ...message.author, avatar: message.author.avatar ?? authorAvatar }
      : message.author;
  }
  const id =
    pickString(
      source?.id,
      source?._id,
      source?.userId,
      source?.uid,
      message?.sender_id,
      message?.senderId,
      message?.from,
      message?.user_id
    ) ?? message?.authorId;
  const name =
    pickString(
      source?.name,
      source?.fullName,
      source?.displayName,
      source?.username,
      message?.sender_name,
      message?.senderName,
      message?.authorName,
      message?.name
    ) ?? "";
  const avatar =
    pickString(
      source?.avatar,
      source?.profilePicture,
      source?.profile_picture,
      source?.photo,
      source?.photoUrl,
      source?.photoURL,
      source?.image,
      source?.picture,
      source?.avatarUrl,
      source?.avatarURL,
      source?.avatar_url,
      message?.sender_avatar,
      message?.avatar,
      message?.profilePicture,
      message?.photo,
      message?.photoUrl,
      message?.photoURL
    ) ?? undefined;
  if (!id && !name && !avatar) return null;
  return { id, name, avatar };
};

const deriveTypeFromFiles = (baseType, files) => {
  if (!files.length) return baseType;
  if (baseType === "file" && files.length === 1) {
    const mime = files[0]?.mimeType ?? "";
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
  }
  return baseType;
};

const normaliseUrl = (value) => {
  if (!value) return "";
  try {
    const parsed = new URL(value.startsWith("http") ? value : `https://${value}`);
    return parsed.toString();
  } catch {
    return value;
  }
};

const URL_FINDER_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;
const URLish_REGEX = /^(https?:\/\/|www\.)/i;
const DOMAIN_REGEX = /\.[a-z]{2,}([/?#].*)?$/i;

const extractUrlDetails = (...candidates) => {
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const match = value.match(URL_FINDER_REGEX);
    if (!match) continue;
    const [raw] = match;
    const before = value.slice(0, match.index).trim();
    const after = value.slice(match.index + raw.length).trim();
    const remainder = [before, after].filter(Boolean).join(" ").trim();
    return {
      url: normaliseUrl(raw),
      remainder,
    };
  }
  return null;
};

const looksLikeUrl = (value = "") => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  return URLish_REGEX.test(trimmed) || DOMAIN_REGEX.test(trimmed);
};

const normalizePollOptions = (options = []) => {
  if (!Array.isArray(options)) return [];
  return options
    .map((option, index) => {
      if (!option) return null;
      if (typeof option === "string") {
        const label = option.trim();
        if (!label) return null;
        return {
          id: `opt-${index + 1}`,
          label,
          votes: 0,
        };
      }
      const label =
        pickString(option.label, option.title, option.text) || "Option";
      const id = pickString(option.id, option.key) || `opt-${index + 1}`;
      const voters = Array.isArray(option.voters) ? option.voters : [];
      const votes = Array.isArray(option.votes)
        ? option.votes.length
        : Number(option.votes ?? voters.length ?? 0);
      return {
        id,
        label,
        emoji: pickString(option.emoji, option.icon),
        votes: Number.isFinite(votes) ? votes : 0,
        voters,
      };
    })
    .filter(Boolean);
};

const buildContentForType = (type, message, rawFiles) => {
  if (type === "poll") {
    const raw =
      message?.content?.poll ??
      message?.poll ??
      (message?.content && typeof message.content === "object"
        ? message.content
        : {}) ??
      {};
    const options = normalizePollOptions(raw.options ?? raw.choices ?? []);
    const totalVotes = Number.isFinite(raw.totalVotes)
      ? raw.totalVotes
      : options.reduce((sum, option) => sum + (option.votes || 0), 0);
    return {
      question: pickString(raw.question, raw.title) || "",
      type: pickString(raw.type, raw.pollType) || "single",
      options,
      allowMultiple: Boolean(raw.allowMultiple ?? raw.multiple),
      ratingMax: Number(raw.ratingMax ?? raw.scaleMax) || 5,
      endAt: normaliseDateInput(raw.endAt ?? raw.endsAt ?? raw.expiresAt),
      endedAt: normaliseDateInput(raw.endedAt),
      createdBy: raw.createdBy ?? message?.author ?? null,
      endAccess: pickString(raw.endAccess, raw.endPolicy) || "creator-or-admin",
      showResultsBeforeVote: Boolean(raw.showResultsBeforeVote),
      totalVotes,
      viewerVotes: Array.isArray(raw.viewerVotes) ? raw.viewerVotes : [],
    };
  }
  if (type === "link") {
    let resolvedUrl =
      pickString(
        message?.content?.url,
        message?.url,
        message?.link,
        message?.link_url
      ) || "";
    let derivedCaption;
    const inlineDetails = extractUrlDetails(
      message?.content?.text,
      message?.text,
      message?.message,
      message?.body
    );
    if (!resolvedUrl && inlineDetails?.url) {
      resolvedUrl = inlineDetails.url;
      derivedCaption = inlineDetails.remainder;
    } else if (!derivedCaption && inlineDetails?.remainder) {
      derivedCaption = inlineDetails.remainder;
    }
    const url = normaliseUrl(resolvedUrl) || "";
    return {
      url,
      title:
        pickString(
          message?.content?.title,
          message?.link_title,
          message?.link_caption,
          message?.title
        ) || url,
      description:
        pickString(
          message?.content?.description,
          message?.link_description,
          message?.description
        ) || "",
      caption: (() => {
        const rawCaption =
          pickString(
            message?.content?.caption,
            message?.caption,
            message?.link_caption,
            derivedCaption
          ) || "";
        return looksLikeUrl(rawCaption) ? "" : rawCaption;
      })(),
      thumbnail:
        pickString(
          message?.content?.thumbnail,
          message?.thumbnail,
          message?.link_thumbnail
        ) || "",
      displayHost: (() => {
        if (!url) return "";
        try {
          return new URL(url).hostname.replace(/^www\./i, "");
        } catch {
          return url;
        }
      })(),
    };
  }
  if (type === "image" || type === "video") {
    const inlineContent =
      message?.content && typeof message.content === "object"
        ? message.content
        : {};
    const file = rawFiles[0] ?? inlineContent;
    const resolvedRawSize =
      typeof file.rawSize === "number" && file.rawSize > 0
        ? file.rawSize
        : typeof inlineContent.rawSize === "number" &&
            inlineContent.rawSize > 0
          ? inlineContent.rawSize
          : typeof inlineContent.size === "number" && inlineContent.size > 0
            ? inlineContent.size
            : typeof inlineContent.file_size === "number" &&
                inlineContent.file_size > 0
              ? inlineContent.file_size
              : typeof message?.metadata?.size === "number" &&
                  message.metadata.size > 0
                ? message.metadata.size
                : undefined;
    const resolvedMimeType =
      pickString(
        file.mimeType,
        message?.content?.mimeType,
        message?.mimeType,
        message?.metadata?.mimeType
      ) || (type === "video" ? "video/mp4" : "image/png");
      return {
        url:
          pickString(
            file.url,
            file.fileUrl,
            file.file_url,
            file.path,
            message?.content?.url,
            message?.content?.fileUrl,
            message?.url
          ) || "",
        downloadUrl:
          pickString(
            file.downloadUrl,
            file.fileUrl,
            file.file_url,
            message?.content?.downloadUrl,
            message?.content?.fileUrl,
            message?.downloadUrl
        ) || "",
      fileName:
        pickString(
          file.fileName,
          file.name,
          message?.content?.fileName,
          message?.fileName
        ) ||
          (type === "video" ? "video.mp4" : "image.png"),
      fileSize:
        pickString(file.fileSize, message?.content?.fileSize, message?.fileSize) ||
        formatFileSize(file.rawSize),
      caption:
        pickString(
          file.caption,
          file.preview,
          message?.content?.caption,
          message?.caption
        ) || "",
      thumbnail:
        pickString(
          file.thumbnail,
          file.preview,
          message?.content?.thumbnail,
          message?.thumbnail
        ) || "",
      duration:
        file.duration ??
        message?.content?.duration ??
        message?.metadata?.duration ??
        null,
      width: file.width ?? inlineContent.width,
      height: file.height ?? inlineContent.height,
      mimeType: resolvedMimeType,
      rawSize: resolvedRawSize,
    };
  }
  if (type === "audio") {
    const inlineContent =
      message?.content && typeof message.content === "object"
        ? message.content
        : {};
    const file = rawFiles[0] ?? inlineContent;
    return {
      url:
        pickString(
          file.url,
          file.fileUrl,
          file.file_url,
          file.path,
          message?.content?.url,
          message?.content?.fileUrl,
          message?.url,
          message?.content?.audioUrl,
        ) || "",
      fileName:
        pickString(
          file.fileName,
          file.name,
          message?.content?.fileName,
          message?.fileName
        ) || "audio.mp3",
      fileSize:
        pickString(
          file.fileSize,
          message?.content?.fileSize,
          message?.fileSize
        ) ||
        formatFileSize(file.rawSize),
      duration:
        file.duration ||
        message?.content?.duration ||
        message?.metadata?.duration ||
        message?.content?.length ||
        message?.metadata?.length ||
        null,
      mimeType:
        pickString(file.mimeType, message?.content?.mimeType) ||
        "audio/mpeg",
      caption:
        pickString(
          file.caption,
          message?.content?.caption,
          message?.caption
        ) || "",
    };
  }
  if (type === "code") {
    const codeValue =
      pickString(
        message?.content?.code,
        message?.content?.text,
        message?.text,
        message?.message
      ) || "";
    return resolveCodeContent({
      code: codeValue,
      language:
        pickString(message?.content?.language, message?.metadata?.language) ||
        undefined,
      filename:
        pickString(message?.content?.filename, message?.metadata?.filename) ||
        undefined,
    });
  }
  if (type === "file") {
    const files = rawFiles
      .map((item) => buildFileEntry(item))
      .filter(Boolean);
    if (!files.length && looksLikeFileDescriptor(message?.content)) {
      const inlineFile = buildFileEntry(message.content);
      if (inlineFile) {
        return {
          ...inlineFile,
          files: [inlineFile],
        };
      }
    }
    const first = files[0] ?? {};
    return {
      ...first,
      files,
    };
  }

 // ✅ default/text/emoji messages
  const textValue =
    pickString(
      message?.content?.text,
      message?.text,
      message?.message,
      message?.body,
      message?.preview
    ) || "";

  const htmlValue =
    typeof message?.content?.html === "string"
      ? message.content.html
      : undefined;

  return {
    text: textValue,
    ...(htmlValue ? { html: htmlValue } : {}),
    isEmojiOnly: isEmojiOnlyText(textValue),
    emojiCount: (textValue.match(EMOJI_REGEX) || []).length,
 };
};

export const normalizeMessage = (message) => {
  if (!message) return message;
  if (message.__normalized) {
    return ensureRenderableCache(message);
  }
  const hasSystemEventPayload = Boolean(
    message?.event ||
      message?.systemEvent ||
      message?.metadata?.event ||
      message?.metadata?.systemEvent
  );
  const parsedFiles = parseFileList(
    message?.content?.files ?? message?.files ?? message?.attachments
  )
    .map((item) => buildFileEntry(item))
    .filter(Boolean);
  const inlineFile =
    !parsedFiles.length && looksLikeFileDescriptor(message?.content)
      ? buildFileEntry(message.content)
      : null;
  const files = inlineFile ? [inlineFile] : parsedFiles;
  const pickedType = pickString(
    message?.type,
    message?.message_type,
    message?.content?.type,
    hasSystemEventPayload ? "system" : null,
    files.length ? "file" : null
  );
  const normalizedRawType = pickedType ? pickedType.toLowerCase() : "text";
  const canonicalType =
    TYPE_ALIASES[normalizedRawType] ?? normalizedRawType ?? "text";
  const type = deriveTypeFromFiles(canonicalType, files);
  const createdAt =
    normaliseDateInput(
      message?.createdAt ??
        message?.created_at ??
        message?.timestamp ??
        message?.sentAt
    ) ?? new Date().toISOString();
  const author = normaliseAuthor(message);
  const content = buildContentForType(type, message, files);
  const normalized = {
    ...message,
    __normalized: true,
    id:
      message?.id ??
      message?.message_id ??
      `msg-${createdAt}-${Math.random().toString(16).slice(2)}`,
    type,
    message_type: message?.message_type ?? type,
    author,
    content,
    createdAt,
    metadata: {
      ...(message?.metadata || {}),
    },
  };
  return ensureRenderableCache(normalized);
};

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const fullDayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (value) => {
  const date = toDate(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const differenceInCalendarDays = (a, b) => {
  const startA = startOfDay(a);
  const startB = startOfDay(b);
  if (!startA || !startB) return 0;
  const msInDay = 24 * 60 * 60 * 1000;
  return Math.round((startA - startB) / msInDay);
};

export const formatTime = (value) => {
  const date = toDate(value);
  if (!date) return "";
  // Use user's timezone preference
  const tzFormatted = formatTimeInTz(date);
  return tzFormatted || shortTimeFormatter.format(date);
};

export const formatDayLabel = (value, reference = new Date()) => {
  const date = toDate(value);
  if (!date) return "";
  const diff = differenceInCalendarDays(reference, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return formatDayInTz(date) || dayFormatter.format(date);
  return formatFullDayInTz(date) || fullDayFormatter.format(date);
};

export const groupMessagesByDay = (messages = []) => {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  let sorted = messages;
  let previousTimestamp = -Infinity;
  for (let index = 0; index < messages.length; index += 1) {
    const timestamp = new Date(messages[index]?.createdAt).getTime();
    if (!Number.isFinite(timestamp) || timestamp < previousTimestamp) {
      sorted = [...messages].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      break;
    }
    previousTimestamp = timestamp;
  }

  const groups = [];
  sorted.forEach((message) => {
    const day = formatDayLabel(message.createdAt);
    const last = groups[groups.length - 1];
    if (!last || last.label !== day) {
      groups.push({
        label: day,
        messages: [message],
      });
    } else {
      last.messages.push(message);
    }
  });
  return groups;
};

export const isOwnMessage = (message, currentUserId) => {
  if (!message) return false;
  if (message.direction) {
    return message.direction.toLowerCase() === "outgoing";
  }
  return message.author?.id === currentUserId;
};

const FIVE_MINUTES_MS = 5 * 60 * 1000;

// ─── Dynamic org controls cache (edit / recall / status time limits) ────────
let _cachedOrgControls = null;
let _orgControlsFetchPromise = null;

export const fetchOrgControls = async () => {
  if (_cachedOrgControls) return _cachedOrgControls;
  if (_orgControlsFetchPromise) return _orgControlsFetchPromise;
  _orgControlsFetchPromise = (async () => {
    try {
      const { fetchWithAuth } = await import("../../../utils/authApi.js");
      const { API_BASE_URL } = await import("../../../config/apiBaseUrl.js");
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/organization-controls`
      );
      if (response?.ok) {
        const rows = payload?.data?.rows || (Array.isArray(payload?.data) ? payload.data : []);
        const map = {};
        for (const row of rows) {
          if (row.feature_key) map[row.feature_key] = row;
        }
        _cachedOrgControls = map;
        return _cachedOrgControls;
      }
    } catch {}
    _orgControlsFetchPromise = null;
    return null;
  })();
  return _orgControlsFetchPromise;
};

// Preload org controls on import — skip when unauthenticated (login /
// register pages import this transitively and the eager call would 401).
try {
  if (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined" &&
    window.localStorage.getItem("accessToken")
  ) {
    fetchOrgControls().catch(() => {});
  }
} catch {
  // ignore — best-effort preload only.
}

export const getOrgControlsCache = () => _cachedOrgControls;

const getRecallTimeLimitMs = () => {
  const recall = _cachedOrgControls?.recall;
  if (!recall) return FIVE_MINUTES_MS;
  if (!recall.enabled) return 0; // recall disabled
  if (recall.time_limit_minutes == null) return Infinity; // anyTime
  return recall.time_limit_minutes * 60 * 1000;
};

const getEditTimeLimitMs = () => {
  const edit = _cachedOrgControls?.edit;
  if (!edit) return FIVE_MINUTES_MS;
  if (!edit.enabled) return 0; // edit disabled
  if (edit.time_limit_minutes == null) return Infinity; // anyTime
  return edit.time_limit_minutes * 60 * 1000;
};

const isBeforeNow = (value) => {
  const date = toDate(value);
  if (!date) return false;
  return date.getTime() > Date.now();
};

export const isUnsendAvailable = (message) => {
  const limitMs = getRecallTimeLimitMs();
  if (limitMs <= 0) return false; // recall disabled by org control

  const explicitDeadline = message?.metadata?.unsendAvailableUntil;
  if (explicitDeadline) {
    return isBeforeNow(explicitDeadline);
  }
  if (!message?.createdAt) return false;
  const createdAt = toDate(message.createdAt);
  if (!createdAt) return false;
  if (!Number.isFinite(limitMs)) return true; // anyTime mode
  const deadline = createdAt.getTime() + limitMs;
  return deadline > Date.now();
};

export const getMessagePlainText = (message) => {
  if (!message) return "";
  const candidates = [
    message.content?.text,
    message.message,
    message.content?.caption,
  ];
  for (const value of candidates) {
    if (value && typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

export const getEditableField = (message) => {
  if (!message) return null;
  const getCaption = (source) => {
    const raw =
      typeof source?.content?.caption === "string"
        ? source.content.caption.trim()
        : "";
    return raw;
  };

  let captionValue = getCaption(message);
  if (!captionValue) {
    const normalized = message.__normalized ? message : normalizeMessage(message);
    if (normalized !== message) {
      captionValue = getCaption(normalized);
    }
  }

  const textValue =
    typeof message.content?.text === "string"
      ? message.content.text.trim()
      : "";
  const messageValue =
    typeof message.message === "string" ? message.message.trim() : "";

  if (captionValue) {
    return {
      path: "content.caption",
      value: captionValue,
    };
  }

  if (textValue) {
    return {
      path: "content.text",
      value: textValue,
    };
  }
  if (messageValue) {
    return {
      path: "message",
      value: messageValue,
    };
  }

  return null;
};

export const canEditMessage = (message) => {
  if (!message) return false;
  if (message.direction?.toLowerCase?.() !== "outgoing") return false;

  const limitMs = getEditTimeLimitMs();
  if (limitMs <= 0) return false; // edit disabled by org control

  const editable = getEditableField(message);
  if (!editable) return false;
  const createdAt = toDate(message.createdAt);
  if (!createdAt) return false;
  if (!Number.isFinite(limitMs)) return true; // anyTime mode
  return createdAt.getTime() + limitMs > Date.now();
};

const canEditPollMessage = (message, currentUserId) => {
  if (!message || message.type !== "poll") return false;
  const poll = message.content ?? {};
  const createdById = poll.createdBy?.id ?? message.author?.id ?? null;
  const editAccess = poll.editAccess || poll.endAccess || "creator-or-admin";
  const viewerIsAdmin =
    message?.metadata?.viewerRole === "admin" ||
    message?.metadata?.viewerIsAdmin === true;
  const endedAt = poll.endedAt ? new Date(poll.endedAt) : null;
  const endAt = poll.endAt ? new Date(poll.endAt) : null;
  const isEnded =
    (endedAt && !Number.isNaN(endedAt.getTime())) ||
    (endAt && !Number.isNaN(endAt.getTime()) && endAt.getTime() <= Date.now());
  if (isEnded) return false;
  if (editAccess === "creator") {
    return Boolean(createdById && createdById === currentUserId);
  }
  return Boolean(
    (createdById && createdById === currentUserId) || viewerIsAdmin
  );
};

const pickFirstAttachment = (message) => {
  const candidateLists = [
    message?.content?.files,
    message?.content?.attachments,
    message?.files,
    message?.attachments,
  ];
  for (const list of candidateLists) {
    if (Array.isArray(list) && list.length) {
      const first = list.find(Boolean);
      if (first) return first;
    }
  }
  return null;
};

export const canCopyMessage = (message) => {
  return Boolean(getMessagePlainText(message));
};

export const getImageCopySource = (message) => {
  if (!message || message.type !== "image") return "";
  const inlineContent =
    message?.content && typeof message.content === "object"
      ? message.content
      : {};
  const attachment = pickFirstAttachment(message);
  return (
    pickString(
      inlineContent.fileUrl,
      inlineContent.file_url,
      inlineContent.downloadUrl,
      inlineContent.download_url,
      inlineContent.url,
      inlineContent.thumbnail,
      message?.metadata?.fileUrl,
      message?.metadata?.file_url,
      message?.metadata?.downloadUrl,
      message?.metadata?.download_url,
      message?.metadata?.url,
      attachment?.fileUrl,
      attachment?.file_url,
      attachment?.downloadUrl,
      attachment?.download_url,
      attachment?.url
    ) || ""
  );
};

export const canCopyImageMessage = (message) => {
  return Boolean(getImageCopySource(message));
};

export const updateEditableMessageValue = (
  message,
  nextValue,
  fieldPathOverride
) => {
  if (!message) return null;
  const editable = getEditableField(message);
  const path = fieldPathOverride || editable?.path;
  if (!path) return null;
  const value = typeof nextValue === "string" ? nextValue : "";
  const next = {
    ...message,
    metadata: {
      ...(message.metadata || {}),
      editedAt: new Date().toISOString(),
    },
    content: {
      ...(message.content || {}),
    },
  };
  const emojiCount = (value.match(EMOJI_REGEX) || []).length;
  const emojiOnly = isEmojiOnlyText(value);
  if (path === "content.text") {
    next.content = {
      ...(next.content || {}),
      text: value,
      isEmojiOnly: emojiOnly,
      emojiCount,
    };
    next.message = value;
    if (next.content?.html) {
      delete next.content.html;
    }
  } else if (path === "message") {
    next.message = value;
    next.content = {
      ...(next.content || {}),
      text: value,
      isEmojiOnly: emojiOnly,
      emojiCount,
    };
    if (next.content?.html) {
      delete next.content.html;
    }
  } else if (path === "content.caption") {
    next.content = {
      ...(next.content || {}),
      caption: value,
    };
  } else {
    return null;
  }
  return next;
};

// ─── Dynamic menu items from DB (cached) ───────────────────────────────────
let _cachedMenuItems = null;
let _menuItemsFetchPromise = null;

export const fetchMenuItems = async () => {
  if (_cachedMenuItems) return _cachedMenuItems;
  if (_menuItemsFetchPromise) return _menuItemsFetchPromise;
  _menuItemsFetchPromise = (async () => {
    try {
      const { fetchWithAuth } = await import("../../../utils/authApi.js");
      const { API_BASE_URL } = await import("../../../config/apiBaseUrl.js");
      // Fetch menu items + org permissions in parallel
      const [itemsRes, permsRes] = await Promise.all([
        fetchWithAuth(`${API_BASE_URL}/message-menu-items?limit=100`),
        fetchWithAuth(`${API_BASE_URL}/organization-message-menu-permissions?limit=100`).catch(() => ({ response: { ok: false } })),
      ]);
      if (itemsRes.response?.ok) {
        const itemsData = itemsRes.payload?.data || itemsRes.payload;
        const items = itemsData?.rows || (Array.isArray(itemsData) ? itemsData : []);
        // Build hidden set from org permissions
        const permsData = permsRes.payload?.data || permsRes.payload;
        const perms = permsData?.rows || (Array.isArray(permsData) ? permsData : []);
        const hiddenIds = new Set(
          perms.filter((p) => p.permission_type === "hide" && p.status === "active")
               .map((p) => Number(p.menu_item_id))
        );
        if (items.length) {
          _cachedMenuItems = items
            .filter((i) => i.default_status === "show" && !hiddenIds.has(Number(i.menu_item_id)))
            .map((i) => ({
              key: i.menu_key,
              label: i.label,
              scope: i.scope || "any",
              tone: i.tone || "normal",
              order: i.display_order || i.menu_item_id || 0,
            }))
            .sort((a, b) => a.order - b.order);
          return _cachedMenuItems;
        }
      }
    } catch {}
    _menuItemsFetchPromise = null;
    return null;
  })();
  return _menuItemsFetchPromise;
};

// Preload on import — but ONLY when there's already an access token in
// storage. On the /auth/login or /register pages this module gets pulled
// in transitively (LinkPreviewCard → reactions → etc.) and the eager fetch
// to /message-menu-items + /organization-message-menu-permissions used to
// fire even before the user signed in, polluting the console with 401s.
// Skipping the preload pre-login is safe: the first message render on the
// dashboard triggers fetchMenuItems() again and resolves the cache then.
try {
  if (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined" &&
    window.localStorage.getItem("accessToken")
  ) {
    fetchMenuItems().catch(() => {});
  }
} catch {
  // localStorage access can throw in some embedded contexts — never break
  // the import for a console-noise optimisation.
}

export const getMenuOptions = (message, currentUserId) => {
  const own = isOwnMessage(message, currentUserId);
  const unsendAvailable = own && isUnsendAvailable(message);
  const pollEditable = canEditPollMessage(message, currentUserId);
  const editable = (own && canEditMessage(message)) || pollEditable;
  const copyable = canCopyMessage(message);
  const imageCopyable = canCopyImageMessage(message);
  const forwardDisabled = message?.type === "poll";
  const viewerPinned =
    message?.metadata?.pinned &&
    message?.metadata?.pinnedBy === currentUserId;

  // Runtime overrides per menu_key
  const runtimeOverrides = {
    unsend: { disabled: !unsendAvailable },
    edit: { disabled: !editable },
    copy: { disabled: !(copyable || imageCopyable) },
    forward: { disabled: forwardDisabled },
    pin: { label: viewerPinned ? "Unpin" : "Pin" },
  };

  // Use DB items if cached, else fallback
  const baseItems = _cachedMenuItems || [
    { key: "delete", label: "Delete", scope: "any", tone: "danger" },
    { key: "unsend", label: "Unsend", scope: "self", tone: "danger" },
    { key: "edit", label: "Edit", scope: "self" },
    { key: "quick-react", label: "Quick React", scope: "any" },
    { key: "select", label: "Select", scope: "any" },
    { key: "copy", label: "Copy", scope: "any" },
    { key: "translate", label: "Translate", scope: "any" },
    { key: "summarize", label: "Summarize", scope: "any" },
    { key: "tone-adjust", label: "Adjust Tone", scope: "any" },
    { key: "info", label: "Info", scope: "any" },
    { key: "reply", label: "Reply", scope: "any" },
    { key: "forward", label: "Forward", scope: "any" },
    { key: "pin", label: "Pin", scope: "any" },
  ];

  const options = baseItems.map((item) => ({
    ...item,
    ...(runtimeOverrides[item.key] || {}),
  }));

  return options.filter((option) => {
    if (option.scope !== "self") return true;
    if (option.key === "edit") return own || pollEditable;
    return own;
  });
};

const truncateText = (value = "", length = 90) => {
  const text = value?.toString?.() ?? "";
  if (text.length <= length) return text;
  const safeLength = Math.max(0, length - 3);
  return `${text.slice(0, safeLength)}...`;
};

const getAuthorName = (message) =>
  message?.author?.name ||
  message?.authorName ||
  message?.sender_name ||
  message?.senderName ||
  message?.metadata?.senderName ||
  "Member";

const parseFilesValue = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const buildAttachmentDescriptor = (file = {}, fallbackType = "file") => {
  if (!file) return null;
  const name =
    file.fileName || file.name || file.originalName || file.original_name;
  const mimeType =
    file.mimeType || file.mimetype || file.mime_type || file.type || "";
  const rawSize =
    typeof file.size === "number" ? file.size : Number(file.rawSize ?? 0);
  const formattedSize =
    file.fileSize ||
    file.sizeLabel ||
    (Number.isFinite(rawSize) ? formatFileSize(rawSize) : undefined);
  const url =
    file.url ||
    file.file_url ||
    file.previewUrl ||
    file.preview_url ||
    file.path ||
    null;
  const thumbnail =
    file.thumbnail ||
    file.thumb ||
    file.thumbUrl ||
    file.thumb_url ||
    file.thumbnailUrl ||
    file.thumbnail_url ||
    (mimeType?.startsWith?.("image/") ? url : undefined);
  return {
    fileName: name,
    mimeType,
    type: file.type || fallbackType,
    fileSize: formattedSize,
    url,
    preview: file.preview || file.caption || file.description,
    thumbnail,
  };
};

const getAttachmentMeta = (message) => {
  if (!message) return null;
  if (Array.isArray(message.content?.files) && message.content.files.length) {
    return buildAttachmentDescriptor(message.content.files[0], "file");
  }
  if (message.content?.fileName || message.content?.url) {
    return buildAttachmentDescriptor(
      {
        fileName: message.content.fileName || message.content.file_name,
        mimeType: message.content.mimeType,
        fileSize: message.content.fileSize,
        url: message.content.url,
        preview: message.content.preview,
        thumbnail: message.content.thumbnail,
      },
      message.type || "file"
    );
  }
  if (message.files) {
    const parsed = parseFilesValue(message.files);
    if (parsed.length) {
      return buildAttachmentDescriptor(parsed[0], "file");
    }
  }
  return null;
};

export const buildReplyContextPayload = (message, currentUserId) => {
  if (!message) return null;
  const own = isOwnMessage(message, currentUserId);
  const attachment = getAttachmentMeta(message);
  const base = {
    messageId: message.id,
    authorId: message.author?.id ?? message.sender_id ?? null,
    authorName: own ? "Me" : getAuthorName(message),
    isSelf: own,
    snippet: "",
    type: message.type || "text",
    fileName: attachment?.fileName ?? null,
    mimeType: attachment?.mimeType ?? null,
    fileSize: attachment?.fileSize ?? null,
    url: attachment?.url ?? null,
    preview: attachment?.preview ?? null,
    thumbnail: attachment?.thumbnail ?? null,
  };

  if (attachment) {
    base.type = attachment.type || "file";
    base.snippet = attachment.fileName || attachment.mimeType || "Attachment";
    return base;
  }

  if (message.type === "code") {
    base.type = "code";
    base.fileName =
      message.content?.filename ||
      message.metadata?.filename ||
      base.fileName ||
      "Code snippet";
    const codeText =
      message.content?.code || message.content?.text || message.content?.body;
    base.snippet = truncateText(codeText || "Snippet");
    return base;
  }

  if (message.type === "link") {
    base.type = "link";
    base.url = message.content?.url || base.url;
    base.linkTitle =
      message.content?.title ||
      message.content?.displayHost ||
      base.snippet ||
      base.url;
    base.linkDescription = message.content?.description || message.content?.caption || "";
    base.thumbnail = message.content?.thumbnail || base.thumbnail;
    base.snippet = base.url || "Link";
    return base;
  }

  if (message.type === "poll") {
    base.type = "poll";
    base.snippet = truncateText(message.content?.question || "Poll");
    return base;
    
  }

  const contentText =
    message.content?.text ||
    message.content?.caption ||
    message.message ||
    message.preview ||
    "";
  if (contentText) {
    base.snippet = truncateText(contentText);
    return base;
  }

  if (message.content?.code) {
    base.type = "code";
    base.snippet = truncateText(message.content.code);
    return base;
  }

  base.snippet = "Media";
  return base;
};
