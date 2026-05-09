// Lightweight client-side phishing heuristics for link previews.
// Goal: warn the user before they click on something risky. Does not block —
// only surfaces a banner the user can dismiss.

const SUSPICIOUS_TLDS = new Set([
  "tk", "ml", "ga", "cf", "gq", // freenom-era tlds heavily used for phishing
  "zip", "mov", // recent google tlds that look like file extensions
]);

// Common url shorteners — destination is unknown, so we warn.
const URL_SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd",
  "buff.ly", "rebrand.ly", "shorturl.at", "rb.gy", "lnkd.in",
  "tiny.cc", "cutt.ly", "shrtco.de", "v.gd",
]);

// Brand names that phishers commonly impersonate. Detection: brand appears
// in the *subdomain* of an unrelated apex domain.
const HIGH_VALUE_BRANDS = [
  "google", "gmail", "youtube", "facebook", "instagram", "whatsapp",
  "apple", "icloud", "amazon", "netflix", "microsoft", "outlook",
  "office365", "paypal", "stripe", "github", "linkedin", "twitter",
  "x.com", "discord", "slack", "zoom", "telegram", "snapchat",
  "tiktok", "binance", "coinbase", "crypto", "bank", "hdfc", "sbi",
  "icici", "axis", "kotak", "irctc", "income", "tax", "uidai", "aadhaar",
];

export const stripWww = (host = "") => host.replace(/^www\./i, "");

export const isIpHost = (host = "") => /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
  || /^\[[0-9a-fA-F:]+\]$/.test(host);

const looksLikeBrandSubdomain = (host) => {
  const apex = stripWww(host).split(".").slice(-2).join(".");
  for (const brand of HIGH_VALUE_BRANDS) {
    if (host.toLowerCase().includes(brand) && !apex.toLowerCase().startsWith(brand)) {
      return brand;
    }
  }
  return null;
};

/**
 * Inspect a URL for phishing red flags. Returns `null` if the link looks
 * normal, otherwise an object with `level` ('warn' | 'danger'), `title`,
 * and `detail` strings ready to render in a banner.
 */
export const inspectLink = (url) => {
  if (!url || typeof url !== "string") return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  const protocol = parsed.protocol.toLowerCase();

  if (protocol === "data:" || protocol === "javascript:" || protocol === "vbscript:") {
    return {
      level: "danger",
      title: "Possibly unsafe link",
      detail: "This link uses a non-standard protocol that can run code in your browser.",
    };
  }

  if (protocol !== "https:" && protocol !== "http:") {
    return {
      level: "warn",
      title: "Unusual link protocol",
      detail: `This link starts with “${protocol}” — make sure you trust the sender.`,
    };
  }

  if (protocol === "http:") {
    return {
      level: "warn",
      title: "Not a secure connection",
      detail: "This site does not use HTTPS — anything you type there can be intercepted on shared networks.",
    };
  }

  if (isIpHost(host)) {
    return {
      level: "danger",
      title: "Link points at a raw IP",
      detail: `Phishing pages often hide behind ${host} instead of a real domain. Treat with care.`,
    };
  }

  if (host.startsWith("xn--") || host.includes(".xn--")) {
    return {
      level: "danger",
      title: "Punycode (lookalike) domain",
      detail: "This domain is encoded in a way that can disguise letters from another alphabet — common in phishing.",
    };
  }

  const tld = host.split(".").pop();
  if (SUSPICIOUS_TLDS.has(tld)) {
    return {
      level: "warn",
      title: `Suspicious .${tld} domain`,
      detail: "Free / unusual top-level domain — be sure you trust the sender before signing in or paying.",
    };
  }

  if (URL_SHORTENERS.has(stripWww(host))) {
    return {
      level: "warn",
      title: "Shortened link — destination hidden",
      detail: `${host} hides the real URL. Hover or expand the link to verify where it actually leads.`,
    };
  }

  const brandHit = looksLikeBrandSubdomain(host);
  if (brandHit) {
    return {
      level: "danger",
      title: `Possible ${brandHit} impersonation`,
      detail: `“${host}” mentions ${brandHit} but doesn’t belong to its main domain. Verify the spelling carefully.`,
    };
  }

  // Many subdomains chained together (e.g. login.paypal.com.evil.example)
  const dots = host.split(".").length - 1;
  if (dots >= 4) {
    return {
      level: "warn",
      title: "Unusually long domain",
      detail: "This URL has many sub-parts. Brands rarely use this structure for real login pages.",
    };
  }

  return null;
};

export default inspectLink;
