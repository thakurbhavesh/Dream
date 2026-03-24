const ALLOWED_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "BR",
  "SPAN",
  "DIV",
  "P",
  "A",
  "UL",
  "OL",
  "LI",
]);

const SAFE_PROTOCOL_REGEX = /^(https?:|mailto:)/i;

const sanitizeStyle = (styleValue = "") => {
  if (!styleValue) return "";
  const declarations = styleValue
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const allowed = [];
  declarations.forEach((declaration) => {
    const [rawProp, ...rawValueParts] = declaration.split(":");
    if (!rawProp || !rawValueParts.length) return;
    const prop = rawProp.trim().toLowerCase();
    const value = rawValueParts.join(":").trim().toLowerCase();
    if (!value) return;
    if (
      prop === "font-weight" &&
      (value.includes("bold") || parseInt(value, 10) >= 600)
    ) {
      allowed.push("font-weight:bold");
      return;
    }
    if (prop === "font-style" && value.includes("italic")) {
      allowed.push("font-style:italic");
      return;
    }
    if (
      prop === "text-decoration" ||
      prop === "text-decoration-line" ||
      prop === "text-decoration-style"
    ) {
      if (value.includes("underline")) {
        allowed.push("text-decoration:underline");
      }
    }
  });
  return allowed.join("; ");
};

export const sanitizeComposerHtml = (html = "") => {
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
  // Direct user HTML parse karo, extra wrapper div mat daalo
   doc = parser.parseFromString(html, "text/html");
  } catch {
    return html || "";
  }
  if (!doc?.body) {
    return html || "";
  }
  const walker = doc.createTreeWalker(
    doc.body,
    typeof NodeFilter !== "undefined" ? NodeFilter.SHOW_ELEMENT : 1
  );
  const nodesToProcess = [];
  while (walker.nextNode()) {
    nodesToProcess.push(walker.currentNode);
  }
  nodesToProcess.forEach((node) => {
    const tag = node.tagName?.toUpperCase?.() || "";
    if (!ALLOWED_TAGS.has(tag)) {
      const fragment = doc.createDocumentFragment();
      while (node.firstChild) {
        fragment.appendChild(node.firstChild);
      }
      node.replaceWith(fragment);
      return;
    }
    const attributes = Array.from(node.attributes || []);
    attributes.forEach((attr) => {
      const attrName = attr.name.toLowerCase();
      if (attrName === "style") {
        const sanitizedStyle = sanitizeStyle(attr.value);
        if (sanitizedStyle) {
          node.setAttribute("style", sanitizedStyle);
        } else {
          node.removeAttribute("style");
        }
        return;
      }
      if (tag === "A" && attrName === "href") {
        const value = attr.value?.trim() || "";
        if (SAFE_PROTOCOL_REGEX.test(value)) {
          node.setAttribute("href", value);
        } else {
          node.removeAttribute(attr.name);
        }
        return;
      }
      node.removeAttribute(attr.name);
    });
    if (
      tag === "SPAN" &&
      node.attributes.length === 0 &&
      node.childNodes.length
    ) {
      const fragment = doc.createDocumentFragment();
      while (node.firstChild) {
        fragment.appendChild(node.firstChild);
      }
      node.replaceWith(fragment);
    }
  });
  return doc.body.innerHTML.trim();
};

export default sanitizeComposerHtml;
