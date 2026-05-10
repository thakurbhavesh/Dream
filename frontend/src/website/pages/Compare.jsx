import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { useSiteBranding } from "../../contexts/SiteBrandingContext.jsx";

// ─── Competitors ────────────────────────────────────────────────────
// `color` = brand color used in pricing/table/cards
// `radarColor` = high-contrast color used ONLY in the radar chart so all 4
// polygons stay visually distinguishable when overlaid
const competitors = [
  {
    key: "teamchatx",
    name: "TeamChatX",
    short: "TCX",
    color: "#0162c4",
    radarColor: "#0162c4",
    gradient: "linear-gradient(135deg, #0162c4, #0288d1)",
    isUs: true,
  },
  {
    key: "slack",
    name: "Slack",
    short: "Slack",
    color: "#4A154B",
    radarColor: "#e11d48", // rose
    gradient: "linear-gradient(135deg, #4A154B, #611f69)",
  },
  {
    key: "teams",
    name: "MS Teams",
    short: "Teams",
    color: "#4b53bc",
    radarColor: "#f59e0b", // amber
    gradient: "linear-gradient(135deg, #4b53bc, #6264a7)",
  },
  {
    key: "troop",
    name: "Troop Messenger",
    short: "Troop",
    color: "#64748b",
    radarColor: "#10b981", // emerald
    gradient: "linear-gradient(135deg, #64748b, #475569)",
  },
];

// Short labels used inside the radar chart so they don't overflow
const CATEGORY_SHORT_LABELS = {
  "Messaging": "Messaging",
  "Audio & Video": "Audio/Video",
  "Meeting & Scheduling": "Meetings",
  "AI & Smart Features": "AI",
  "Privacy & Security": "Privacy",
  "Admin & Management": "Admin",
  "Mobile": "Mobile",
  "Web & Desktop": "Web/Desktop",
};

// Support map: true = full, "partial" = limited / paid only, false = none
const features = [
  // ═══ MESSAGING ═══════════════════════════════════════════
  { category: "Messaging", feature: "1-on-1 Direct Messaging", desc: "Private direct messages between users", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Messaging", feature: "Group Messaging", desc: "Multi-member group conversations", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Messaging", feature: "Threads / Replies", desc: "Threaded reply conversations", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Messaging", feature: "Broadcast Messages", desc: "Send one message to many contacts at once", support: { teamchatx: true, slack: false, teams: false, troop: true } },
  { category: "Messaging", feature: "Broadcast to Groups", desc: "Broadcast directly to multiple groups in one shot", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Messaging", feature: "Broadcast with File Attachments", desc: "Attach files when broadcasting to contacts & groups", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Messaging", feature: "File & Image Sharing (up to 2 GB)", desc: "Share documents, images, and media files", support: { teamchatx: true, slack: "partial", teams: true, troop: true } },
  { category: "Messaging", feature: "Voice Messages", desc: "Record and send voice messages", support: { teamchatx: true, slack: false, teams: false, troop: true } },
  { category: "Messaging", feature: "Voice-to-Text Transcription", desc: "Convert voice recordings to text automatically", support: { teamchatx: true, slack: false, teams: "partial", troop: false } },
  { category: "Messaging", feature: "GIF Picker (Tenor)", desc: "Search and send animated GIFs in chat", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Messaging", feature: "Emoji Reactions", desc: "React to messages with emojis", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Messaging", feature: "Reply / Forward / Pin", desc: "Reply to, forward, or pin important messages", support: { teamchatx: true, slack: "partial", teams: true, troop: true } },
  { category: "Messaging", feature: "Forward to Multiple Contacts", desc: "Forward a message to multiple contacts simultaneously", support: { teamchatx: true, slack: false, teams: false, troop: true } },
  { category: "Messaging", feature: "Edit & Delete Messages", desc: "Edit sent messages or delete them for everyone", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Messaging", feature: "Disappearing Messages", desc: "Auto-delete messages after a set timer", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Messaging", feature: "Scheduled Messages", desc: "Schedule a message to send at a future time", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Messaging", feature: "Starred / Bookmarked Messages", desc: "Star important messages for quick access in a dedicated screen", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Messaging", feature: "Pin / Archive Chats", desc: "Pin important chats to top, archive old ones to hide", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Messaging", feature: "Read Receipts", desc: "See when your message has been read", support: { teamchatx: true, slack: false, teams: true, troop: true } },
  { category: "Messaging", feature: "Typing Indicators", desc: "See when someone is typing", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Messaging", feature: "Offline Message Queue", desc: "Messages queued when offline, auto-sent on reconnect with retry", support: { teamchatx: true, slack: "partial", teams: "partial", troop: false } },
  { category: "Messaging", feature: "Chat Export", desc: "Export entire chat history as shareable text file", support: { teamchatx: true, slack: true, teams: "partial", troop: false } },
  { category: "Messaging", feature: "End-to-End Encryption (AES-256)", desc: "Messages encrypted at rest with AES-256-GCM", support: { teamchatx: true, slack: "partial", teams: "partial", troop: true } },

  // ═══ AUDIO & VIDEO ═══════════════════════════════════════
  { category: "Audio & Video", feature: "1-on-1 Audio Call", desc: "Voice calls between two users via WebRTC", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Audio & Video", feature: "1-on-1 Video Call", desc: "Video calls between two users", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Audio & Video", feature: "Group Video Meetings", desc: "Multi-participant video conferences", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Audio & Video", feature: "In-Meeting Chat", desc: "Send text messages during a live meeting", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Audio & Video", feature: "Meeting Reactions & Hand Raise", desc: "Emoji reactions and raise-hand during meetings", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Audio & Video", feature: "Gallery / Speaker View Toggle", desc: "Switch between grid and speaker focus layouts", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Audio & Video", feature: "Pin / Spotlight Participant", desc: "Pin a participant's video to focus on them", support: { teamchatx: true, slack: false, teams: true, troop: false } },
  { category: "Audio & Video", feature: "Privacy-First Camera/Mic (On-Demand)", desc: "Camera & mic only activate when you choose", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Audio & Video", feature: "Screen Sharing", desc: "Share your screen during calls or meetings", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Audio & Video", feature: "Screen Annotation", desc: "Draw and annotate on shared screens in real-time", support: { teamchatx: true, slack: false, teams: true, troop: false } },
  { category: "Audio & Video", feature: "Remote Desktop Control", desc: "Take control of a shared screen remotely", support: { teamchatx: true, slack: false, teams: true, troop: false } },
  { category: "Audio & Video", feature: "Voice Playback Speed (1x/1.5x/2x)", desc: "Play voice messages at adjustable speed", support: { teamchatx: true, slack: false, teams: false, troop: false } },

  // ═══ MEETING & SCHEDULING ════════════════════════════════
  { category: "Meeting & Scheduling", feature: "Instant Meeting (1-Click)", desc: "Start a meeting instantly with one click", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Meeting & Scheduling", feature: "Schedule Meeting", desc: "Schedule meetings for a future date and time", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Meeting & Scheduling", feature: "Join by Meeting ID", desc: "Join meetings using a unique meeting code", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Meeting & Scheduling", feature: "RSVP System (Accept/Decline)", desc: "Accept, decline, or tentatively respond to invites", support: { teamchatx: true, slack: false, teams: true, troop: true } },
  { category: "Meeting & Scheduling", feature: "Auto Chat Invite + Join Button", desc: "Meeting invite card in chat with one-click join", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Meeting & Scheduling", feature: "Email Invitations (HTML)", desc: "Send meeting invites via professional HTML emails", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Meeting & Scheduling", feature: "Meeting Duration Tracker", desc: "Track how long each meeting lasts", support: { teamchatx: true, slack: false, teams: true, troop: false } },

  // ═══ AI & SMART FEATURES ═════════════════════════════════
  { category: "AI & Smart Features", feature: "AI Live Assistant", desc: "Built-in AI chatbot for instant answers and troubleshooting", support: { teamchatx: true, slack: "partial", teams: "partial", troop: false } },
  { category: "AI & Smart Features", feature: "AI App Guide", desc: "In-app AI chatbot for help, how-to guides in English/Hindi/Hinglish", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "AI & Smart Features", feature: "Smart Compose (Auto-Complete)", desc: "AI-powered auto-complete as you type", support: { teamchatx: true, slack: false, teams: "partial", troop: false } },
  { category: "AI & Smart Features", feature: "Grammar Check", desc: "Automatic grammar correction before sending", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "AI & Smart Features", feature: "Auto Translate (14 Languages)", desc: "Translate messages instantly to any of 14 languages", support: { teamchatx: true, slack: "partial", teams: true, troop: false } },
  { category: "AI & Smart Features", feature: "Smart Reply Suggestions", desc: "AI-generated 3 reply options matching sender language", support: { teamchatx: true, slack: false, teams: "partial", troop: false } },
  { category: "AI & Smart Features", feature: "AI Tone Adjuster", desc: "Rewrite messages in Formal, Friendly, or Diplomatic tone", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "AI & Smart Features", feature: "AI Call Notes", desc: "Auto-generate meeting summary, key points, action items", support: { teamchatx: true, slack: "partial", teams: true, troop: false } },
  { category: "AI & Smart Features", feature: "AI Semantic Search", desc: "Search by meaning, not exact keywords", support: { teamchatx: true, slack: "partial", teams: "partial", troop: false } },

  // ═══ PRIVACY & SECURITY ══════════════════════════════════
  { category: "Privacy & Security", feature: "Chat Lock (PIN)", desc: "Lock individual chats behind a PIN", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Privacy & Security", feature: "Mute / DND per Thread", desc: "Mute notifications for specific conversations", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Privacy & Security", feature: "Custom Notification Sounds", desc: "Set different sounds for different chats", support: { teamchatx: true, slack: true, teams: false, troop: false } },
  { category: "Privacy & Security", feature: "Presence Indicators", desc: "See who's online, offline, or idle", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Privacy & Security", feature: "IP & Platform Restrictions", desc: "Restrict workspace access by IP range and platform type", support: { teamchatx: true, slack: "partial", teams: "partial", troop: false } },
  { category: "Privacy & Security", feature: "Trusted Device Management", desc: "View, manage, and revoke trusted devices", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Privacy & Security", feature: "Dangerous File Blocking", desc: "Block .exe, .bat, .sh, macros, and harmful uploads server-side", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Privacy & Security", feature: "XSS & Input Sanitization", desc: "Server-side sanitization of all user input to prevent XSS attacks", support: { teamchatx: true, slack: true, teams: true, troop: "partial" } },
  { category: "Privacy & Security", feature: "Device Limit (Max 3)", desc: "Maximum 3 simultaneous logins with device management", support: { teamchatx: true, slack: false, teams: false, troop: true } },
  { category: "Privacy & Security", feature: "Password Strength Meter", desc: "Visual 4-level strength indicator on registration", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Privacy & Security", feature: "Account Deletion (GDPR)", desc: "Self-service account deletion with complete data removal", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Privacy & Security", feature: "Terms & Privacy Acceptance", desc: "Mandatory acceptance on registration with linked legal documents", support: { teamchatx: true, slack: true, teams: true, troop: true } },

  // ═══ ADMIN & MANAGEMENT ══════════════════════════════════
  { category: "Admin & Management", feature: "Admin Dashboard", desc: "Central dashboard for managing users, groups, and settings", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Admin & Management", feature: "Role-Based Access (RBAC)", desc: "Owner, Admin, Super Admin, Member role permissions", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Admin & Management", feature: "Department & Designation Management", desc: "Organize users by departments, designations, and locations", support: { teamchatx: true, slack: false, teams: "partial", troop: false } },
  { category: "Admin & Management", feature: "Bulk User Upload (CSV)", desc: "Import users via CSV with auto role and department assignment", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Admin & Management", feature: "Email Invitations", desc: "Send branded HTML email invitations with one-click join", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Admin & Management", feature: "Activity Logs (Audit Trail)", desc: "Track user actions and system events with timestamps", support: { teamchatx: true, slack: "partial", teams: true, troop: true } },
  { category: "Admin & Management", feature: "OTP Verification Logs", desc: "View all OTP verifications with codes (Super Admin), attempts, IP", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Admin & Management", feature: "Payment History & Invoices", desc: "Complete payment history with invoice details and billing info", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Admin & Management", feature: "Self-Hosted Deployment", desc: "Deploy on your own servers / private cloud / air-gapped", support: { teamchatx: true, slack: false, teams: false, troop: true } },

  // ═══ MOBILE (App-Specific Features) ══════════════════════
  { category: "Mobile", feature: "Native Mobile App (iOS & Android)", desc: "Full-featured native mobile app with 55+ screens", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Mobile", feature: "Mobile Admin Panel", desc: "Full admin panel on mobile — users, groups, departments, billing, OTP logs", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Mobile", feature: "Swipe to Reply", desc: "Swipe right on any message to instantly reply with haptic feedback", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Mobile", feature: "Chat Wallpaper", desc: "Set custom background image per chat from photo library", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Mobile", feature: "Biometric Login", desc: "Fingerprint / Face ID login with OTP skip for trusted devices", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Mobile", feature: "QR Code Login (Linked Devices)", desc: "Scan QR from web browser to login — WhatsApp-style linked devices", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Mobile", feature: "Screen Share Receive", desc: "View web user's shared screen on mobile during calls", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Mobile", feature: "Offline Queue with Auto-Retry", desc: "Messages queued in AsyncStorage when offline, auto-sent on reconnect", support: { teamchatx: true, slack: "partial", teams: "partial", troop: false } },
  { category: "Mobile", feature: "Dark Mode (Full Theme)", desc: "Complete dark mode with WhatsApp-style colors across all screens", support: { teamchatx: true, slack: true, teams: true, troop: "partial" } },
  { category: "Mobile", feature: "Push Notifications", desc: "Real-time push notifications for messages, calls, and mentions", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Mobile", feature: "Haptic Feedback", desc: "Tactile feedback on message actions, reactions, and navigation", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Mobile", feature: "Photo Viewer / Gallery", desc: "Full-screen image viewer with zoom, swipe, and share actions", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Mobile", feature: "Profile Photo Upload", desc: "Take or choose profile photo from camera/gallery with crop", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Mobile", feature: "Contact Photo Viewer", desc: "Tap any avatar to view full-size profile photo", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Mobile", feature: "Draft Auto-Save", desc: "Unsent messages saved as drafts, restored on chat reopen", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Mobile", feature: "Cache with TTL", desc: "Intelligent caching for contacts, threads, messages with 24hr TTL", support: { teamchatx: true, slack: true, teams: true, troop: false } },

  // ═══ WEB & DESKTOP (Web-Specific Features) ═══════════════
  { category: "Web & Desktop", feature: "Web App (Browser)", desc: "Full-featured app accessible from any modern browser", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Web & Desktop", feature: "Windows Desktop App", desc: "Native Windows desktop application", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Web & Desktop", feature: "QR Code Generator (Login)", desc: "Generate QR code on web for mobile scan login", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Web & Desktop", feature: "Screen Sharing (Presenter)", desc: "Share your entire screen or specific window from web", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Web & Desktop", feature: "Multi-Organization Support", desc: "Switch between multiple organizations / workspaces", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Web & Desktop", feature: "S3 Cloud Storage Integration", desc: "AWS S3 integration for scalable file storage", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Web & Desktop", feature: "Stripe Built-In Billing", desc: "Built-in subscription management, invoices, and payment processing", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Web & Desktop", feature: "Web Admin Dashboard", desc: "Full admin panel with users, groups, departments, billing, logs", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Web & Desktop", feature: "Owner Dashboard", desc: "Dedicated owner view with org-wide analytics and controls", support: { teamchatx: true, slack: "partial", teams: "partial", troop: false } },
  { category: "Web & Desktop", feature: "Desktop Notifications", desc: "Native browser/OS notifications for new messages and calls", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Web & Desktop", feature: "Keyboard Shortcuts", desc: "Keyboard shortcuts for common actions and navigation", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Web & Desktop", feature: "Link Preview Cards", desc: "Auto-generated rich link previews with title, image, and description", support: { teamchatx: true, slack: true, teams: true, troop: "partial" } },
  { category: "Web & Desktop", feature: "Code Block Formatting", desc: "Syntax-highlighted code blocks in messages", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Web & Desktop", feature: "Polls (Single/Multi Choice)", desc: "Create and vote on polls within any chat", support: { teamchatx: true, slack: "partial", teams: "partial", troop: false } },
];

// Pricing comparison
const pricing = {
  teamchatx: { starting: "$1.99", note: "per user / month", highlight: "Self-host free", subtle: "billed annually" },
  slack: { starting: "$8.75", note: "per user / month", highlight: "Pro plan" },
  teams: { starting: "$4", note: "per user / month", highlight: "Essentials" },
  troop: { starting: "$2.50", note: "per user / month", highlight: "Premium" },
};

// ─── Deployment Plans ──────────────────────────────────────────────
const deploymentPlans = [
  {
    type: "Self-Hosted",
    tagline: "Complete data ownership",
    price: "Free",
    priceSub: "open-source core",
    desc: "Deploy on your own servers. Your data never leaves your infrastructure.",
    features: [
      { label: "Unlimited users", included: true },
      { label: "Full source code access", included: true },
      { label: "On-premise / private cloud", included: true },
      { label: "AES-256 encryption at rest", included: true },
      { label: "Air-gapped deployment", included: true },
      { label: "Community support", included: true },
      { label: "Priority support", included: false, note: "Add-on" },
      { label: "Managed updates", included: false },
    ],
    cta: "Deploy Now",
    ctaLink: "/contact",
    accent: "#0162c4",
  },
  {
    type: "Cloud-Based",
    tagline: "Zero infrastructure hassle",
    price: "$1.99",
    priceSub: "per user / month · billed annually",
    desc: "We host everything. Start chatting in minutes with zero setup.",
    features: [
      { label: "Unlimited users", included: true },
      { label: "99.9% uptime SLA", included: true },
      { label: "AWS-hosted infrastructure", included: true },
      { label: "AES-256 encryption at rest", included: true },
      { label: "Automatic backups", included: true },
      { label: "Priority email & chat support", included: true },
      { label: "Managed updates & patches", included: true },
      { label: "Custom domain (SSL)", included: true },
    ],
    cta: "Start Free Trial",
    ctaLink: "/auth/register",
    accent: "#16a34a",
    popular: true,
  },
];

// ─── Icons ──────────────────────────────────────────────────────────
const Check = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.5" />
    <path d="M7 12.5l3 3 7-7" stroke="#16a34a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Cross = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" fill="#fee2e2" stroke="#dc2626" strokeWidth="1.5" />
    <path d="M8 8l8 8M16 8l-8 8" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const Partial = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" fill="#fef3c7" stroke="#d97706" strokeWidth="1.5" />
    <path d="M8 12h8" stroke="#d97706" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

const SupportCell = ({ value }) => {
  if (value === true) return <Check />;
  if (value === "partial") return <Partial />;
  return <Cross />;
};

// ─── Animated counter ──────────────────────────────────────────────
const AnimatedNumber = ({ target, duration = 1500 }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = Date.now();
          const tick = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{count}</span>;
};

const categories = [...new Set(features.map((f) => f.category))];

const categoryIcons = {
  "Messaging": "\uD83D\uDCAC",
  "Audio & Video": "\uD83C\uDFA5",
  "Meeting & Scheduling": "\uD83D\uDCC5",
  "AI & Smart Features": "\u2728",
  "Privacy & Security": "\uD83D\uDD12",
  "Admin & Management": "\u2699\uFE0F",
  "Mobile": "\uD83D\uDCF1",
  "Web & Desktop": "\uD83D\uDCBB",
};

// Score (true = 1, partial = 0.5, false = 0)
const scoreFor = (key) =>
  features.reduce((sum, f) => {
    const v = f.support[key];
    if (v === true) return sum + 1;
    if (v === "partial") return sum + 0.5;
    return sum;
  }, 0);

// Per-category score for a competitor
const categoryScoreFor = (cat, key) => {
  const catFeatures = features.filter((f) => f.category === cat);
  return catFeatures.reduce((sum, f) => {
    const v = f.support[key];
    if (v === true) return sum + 1;
    if (v === "partial") return sum + 0.5;
    return sum;
  }, 0);
};

const categoryMax = (cat) => features.filter((f) => f.category === cat).length;

// ─── Radar Chart (SVG) ─────────────────────────────────────────────
const RadarChart = ({ size = 420 }) => {
  // Padded viewBox so axis labels never get clipped
  const PAD = 70;
  const vb = size + PAD * 2;
  const cx = vb / 2;
  const cy = vb / 2;
  const radius = size * 0.40;
  const numAxes = categories.length;

  // Convert (axisIdx, valueRatio) to (x, y)
  const point = (axisIdx, ratio) => {
    const angle = (Math.PI * 2 * axisIdx) / numAxes - Math.PI / 2;
    return [cx + Math.cos(angle) * radius * ratio, cy + Math.sin(angle) * radius * ratio];
  };

  // Polygon points string for a competitor
  const polygonFor = (key) =>
    categories
      .map((cat, i) => {
        const score = categoryScoreFor(cat, key);
        const max = categoryMax(cat);
        const ratio = max > 0 ? score / max : 0;
        const [x, y] = point(i, ratio);
        return `${x},${y}`;
      })
      .join(" ");

  // Background grid rings
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox={`0 0 ${vb} ${vb}`}
      style={{ width: "100%", maxWidth: vb, height: "auto", display: "block" }}
    >
      {/* Concentric grid rings */}
      {rings.map((r) => (
        <polygon
          key={r}
          points={categories
            .map((_, i) => {
              const [x, y] = point(i, r);
              return `${x},${y}`;
            })
            .join(" ")}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="1"
        />
      ))}
      {/* Axis lines */}
      {categories.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
      })}

      {/* Competitor polygons (paint smallest first so leader sits on top) */}
      {[...competitors]
        .sort((a, b) => scoreFor(a.key) - scoreFor(b.key))
        .map((c) => (
          <polygon
            key={c.key}
            points={polygonFor(c.key)}
            fill={c.radarColor}
            fillOpacity={c.isUs ? 0.32 : 0.16}
            stroke={c.radarColor}
            strokeWidth={c.isUs ? 3 : 2}
            strokeLinejoin="round"
          />
        ))}

      {/* Vertex dots for TCX (highlight peaks) */}
      {categories.map((cat, i) => {
        const score = categoryScoreFor(cat, "teamchatx");
        const max = categoryMax(cat);
        const ratio = max > 0 ? score / max : 0;
        const [x, y] = point(i, ratio);
        return <circle key={`dot-${i}`} cx={x} cy={y} r={4} fill="#0162c4" stroke="#fff" strokeWidth="2" />;
      })}

      {/* Axis labels */}
      {categories.map((cat, i) => {
        const [x, y] = point(i, 1.22);
        const isTop = y < cy - 10;
        const isBottom = y > cy + 10;
        const anchor = Math.abs(x - cx) < 5 ? "middle" : x < cx ? "end" : "start";
        const labelText = CATEGORY_SHORT_LABELS[cat] || cat;
        return (
          <g key={cat}>
            <text
              x={x}
              y={y + (isTop ? -6 : isBottom ? 6 : 0)}
              fontSize="14"
              fontWeight="700"
              fill="#475569"
              textAnchor={anchor}
            >
              {categoryIcons[cat]}
            </text>
            <text
              x={x}
              y={y + (isTop ? 10 : isBottom ? 22 : 16)}
              fontSize="11"
              fontWeight="700"
              fill="#334155"
              textAnchor={anchor}
            >
              {labelText}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const Compare = () => {
  const { brandName } = useSiteBranding();
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [exclusiveOnly, setExclusiveOnly] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [teamSize, setTeamSize] = useState(20);
  const [contractMonths, setContractMonths] = useState(12);

  // Cost calculator math (uses pricing.starting parsed as float)
  const monthlyPrices = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(pricing).map(([k, v]) => [
          k,
          parseFloat(String(v.starting).replace(/[^0-9.]/g, "")) || 0,
        ])
      ),
    []
  );

  const costBreakdown = useMemo(() => {
    return competitors.map((c) => {
      const total = monthlyPrices[c.key] * teamSize * contractMonths;
      return { ...c, monthly: monthlyPrices[c.key], total };
    });
  }, [teamSize, contractMonths, monthlyPrices]);

  const tcxTotal = costBreakdown.find((c) => c.isUs)?.total || 0;
  const maxCompetitorTotal = Math.max(
    ...costBreakdown.filter((c) => !c.isUs).map((c) => c.total)
  );
  const savingsVsMax = Math.max(0, maxCompetitorTotal - tcxTotal);

  // Per-category verdicts
  const categoryVerdicts = useMemo(
    () =>
      categories.map((cat) => {
        const scoresByComp = competitors.map((c) => ({
          key: c.key,
          name: c.name,
          short: c.short,
          color: c.color,
          isUs: c.isUs,
          score: categoryScoreFor(cat, c.key),
        }));
        scoresByComp.sort((a, b) => b.score - a.score);
        const winner = scoresByComp[0];
        const runnerUp = scoresByComp[1];
        const max = categoryMax(cat);
        return { cat, max, winner, runnerUp, all: scoresByComp };
      }),
    []
  );

  const scores = useMemo(
    () => Object.fromEntries(competitors.map((c) => [c.key, scoreFor(c.key)])),
    []
  );

  const exclusiveCount = useMemo(
    () =>
      features.filter(
        (f) =>
          f.support.teamchatx === true &&
          competitors
            .filter((c) => !c.isUs)
            .every((c) => f.support[c.key] !== true)
      ).length,
    []
  );

  const filteredFeatures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return features.filter((f) => {
      if (activeCategory && f.category !== activeCategory) return false;
      if (
        exclusiveOnly &&
        !(
          f.support.teamchatx === true &&
          competitors
            .filter((c) => !c.isUs)
            .every((c) => f.support[c.key] !== true)
        )
      )
        return false;
      if (q && !f.feature.toLowerCase().includes(q) && !f.desc.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [activeCategory, exclusiveOnly, searchQuery]);

  return (
    <div style={{ fontFamily: "'Manrope', sans-serif" }}>
      <style>{`
        @keyframes compareFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tcx-compare-row { animation: compareFadeIn 0.3s ease both; }
        .tcx-search:focus { outline: none; border-color: #0162c4 !important; box-shadow: 0 0 0 4px rgba(1,98,196,0.12); }
        .tcx-toggle {
          position: relative;
          width: 40px;
          height: 22px;
          background: #cbd5e1;
          border-radius: 999px;
          transition: background 0.2s;
          cursor: pointer;
          flex-shrink: 0;
        }
        .tcx-toggle.on { background: #0162c4; }
        .tcx-toggle::after {
          content: "";
          position: absolute;
          top: 2px; left: 2px;
          width: 18px; height: 18px;
          background: #fff;
          border-radius: 50%;
          transition: transform 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .tcx-toggle.on::after { transform: translateX(18px); }
        .tcx-mobile-card {
          display: none;
        }
        @media (max-width: 768px) {
          .tcx-desktop-table { display: none; }
          .tcx-mobile-card { display: block; }
        }
      `}</style>

      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section
        style={{
          background: "linear-gradient(135deg, #0a1628 0%, #0d2137 40%, #0f3460 100%)",
          color: "#fff",
          padding: "90px 0 60px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: -120, right: -80, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(1,98,196,0.12) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: -150, left: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,109,0,0.08) 0%, transparent 70%)" }} />

        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <p style={{ display: "inline-block", background: "rgba(1,98,196,0.2)", border: "1px solid rgba(1,98,196,0.4)", borderRadius: 20, padding: "6px 20px", fontSize: 13, fontWeight: 600, letterSpacing: 1.5, marginBottom: 24, color: "#64b5f6", textTransform: "uppercase" }}>
            Side-by-Side Comparison
          </p>
          <h1 style={{ fontSize: "clamp(28px, 5vw, 52px)", fontWeight: 800, marginBottom: 16, lineHeight: 1.15 }}>
            {brandName} <span style={{ color: "#64b5f6" }}>vs</span> Slack <span style={{ color: "#64b5f6" }}>vs</span> Teams <span style={{ color: "#64b5f6" }}>vs</span> Troop
          </h1>
          <p style={{ fontSize: 18, color: "#94a3b8", maxWidth: 680, margin: "0 auto 40px", lineHeight: 1.6 }}>
            One workspace. {features.length} features. Compare {brandName} against the biggest names in team chat — feature by feature, no marketing fluff.
          </p>

          {/* Score grid — 4 competitors */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 16,
              maxWidth: 880,
              margin: "0 auto 32px",
            }}
          >
            {competitors.map((c) => {
              const score = scores[c.key];
              const pct = Math.round((score / features.length) * 100);
              const isLeader = c.isUs;
              return (
                <div
                  key={c.key}
                  style={{
                    background: isLeader ? c.gradient : "rgba(255,255,255,0.06)",
                    border: isLeader ? "none" : "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 16,
                    padding: "24px 18px",
                    boxShadow: isLeader ? "0 12px 32px rgba(1,98,196,0.35)" : "none",
                    transform: isLeader ? "translateY(-6px)" : "none",
                    position: "relative",
                  }}
                >
                  {isLeader && (
                    <div
                      style={{
                        position: "absolute",
                        top: -10,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "linear-gradient(135deg, #ff6d00, #ff9100)",
                        color: "#fff",
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: 1,
                        padding: "3px 10px",
                        borderRadius: 999,
                        whiteSpace: "nowrap",
                      }}
                    >
                      WINNER
                    </div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 700, opacity: isLeader ? 0.95 : 0.6, marginBottom: 6 }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1, color: isLeader ? "#fff" : "#cbd5e1" }}>
                    <AnimatedNumber target={Math.round(score)} />
                    <span style={{ fontSize: 16, opacity: 0.7 }}>/{features.length}</span>
                  </div>
                  <div style={{ marginTop: 10, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: isLeader ? "#fff" : "#94a3b8",
                        borderRadius: 3,
                        transition: "width 1.5s ease",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 11, marginTop: 6, opacity: 0.75 }}>{pct}% coverage</div>
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 14, color: "#94a3b8" }}>
            <span style={{ color: "#ff9100", fontWeight: 700 }}>{exclusiveCount}</span> features exclusive to {brandName} • <span style={{ color: "#16a34a", fontWeight: 700 }}>Full</span> · <span style={{ color: "#d97706", fontWeight: 700 }}>Partial</span> · <span style={{ color: "#dc2626", fontWeight: 700 }}>None</span>
          </div>
        </div>
      </section>

      {/* ─── Pricing Strip ───────────────────────────────────── */}
      <section style={{ padding: "40px 0", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div className="container">
          <h3 style={{ textAlign: "center", fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 28 }}>
            Pricing at a glance
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              maxWidth: 900,
              margin: "0 auto",
            }}
          >
            {competitors.map((c) => {
              const p = pricing[c.key];
              const tcxPrice = parseFloat(String(pricing.teamchatx.starting).replace(/[^0-9.]/g, "")) || 0;
              const cPrice = parseFloat(String(p.starting).replace(/[^0-9.]/g, "")) || 0;
              // Show savings only on competitor cards where we're cheaper
              const showSavings = !c.isUs && cPrice > tcxPrice;
              const savingsPct = showSavings
                ? Math.round(((cPrice - tcxPrice) / cPrice) * 100)
                : 0;
              return (
                <div
                  key={c.key}
                  style={{
                    background: c.isUs ? "linear-gradient(135deg, #eff6ff, #dbeafe)" : "#f8fafc",
                    border: c.isUs ? "2px solid #0162c4" : "1px solid #e2e8f0",
                    borderRadius: 14,
                    padding: "22px 18px 20px",
                    textAlign: "center",
                    position: "relative",
                    boxShadow: c.isUs ? "0 14px 40px -18px rgba(2, 88, 196, 0.45)" : "none",
                    transform: c.isUs ? "translateY(-4px)" : "none",
                    transition: "transform 220ms ease",
                  }}
                >
                  {c.isUs && (
                    <div
                      style={{
                        position: "absolute",
                        top: -12,
                        right: 12,
                        background: "linear-gradient(135deg, #0162c4, #2563eb)",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "4px 10px",
                        borderRadius: 999,
                        letterSpacing: 0.6,
                        boxShadow: "0 4px 14px rgba(2, 88, 196, 0.35)",
                      }}
                    >
                      ★ CHEAPEST
                    </div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.color, marginBottom: 6 }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
                    {p.starting}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{p.note}</div>
                  {p.subtle && (
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2, fontStyle: "italic" }}>
                      {p.subtle}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: c.isUs ? "#0162c4" : "#94a3b8", marginTop: 8, fontWeight: 700 }}>
                    {p.highlight}
                  </div>
                  {showSavings && (
                    <div
                      style={{
                        marginTop: 10,
                        display: "inline-block",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#16a34a",
                        background: "#dcfce7",
                        borderRadius: 6,
                        padding: "3px 8px",
                      }}
                    >
                      {savingsPct}% pricier than {brandName}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── What You're Missing (Loss Aversion) ───────────── */}
      <section style={{ padding: "56px 0", background: "linear-gradient(180deg, #fff5f5 0%, #fff 100%)", borderBottom: "1px solid #fecaca" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <p style={{ display: "inline-block", background: "#fee2e2", color: "#dc2626", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, marginBottom: 14, textTransform: "uppercase" }}>
              Don't settle for less
            </p>
            <h2 style={{ fontSize: "clamp(22px, 3.5vw, 34px)", fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>
              Features your current tool <span style={{ color: "#dc2626" }}>doesn't have</span>
            </h2>
            <p style={{ fontSize: 15, color: "#64748b", maxWidth: 560, margin: "0 auto" }}>
              These {exclusiveCount} features are exclusive to {brandName}. No other platform offers them.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, maxWidth: 900, margin: "0 auto" }}>
            {features.filter(f => f.support.teamchatx === true && competitors.filter(c => !c.isUs).every(c => f.support[c.key] !== true)).slice(0, 8).map((f) => (
              <div key={f.feature} style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: 12, padding: "14px 16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #ff6d00, #ff9100)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>{f.feature}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.3 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
          {exclusiveCount > 8 && (
            <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
              + {exclusiveCount - 8} more exclusive features. <span style={{ textDecoration: "underline", cursor: "pointer" }} onClick={() => setExclusiveOnly(true)}>See all →</span>
            </p>
          )}
        </div>
      </section>

      {/* ─── Social Proof & Trust ──────────────────────────── */}
      <section style={{ padding: "48px 0", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
            {[
              { value: "192+", label: "Total Features", sub: "Most in the industry" },
              { value: "AES-256", label: "Encryption Standard", sub: "Military-grade security" },
              { value: "$3/mo", label: "Starting Price", sub: "65% less than Slack" },
              { value: "99.9%", label: "Uptime SLA", sub: "Enterprise reliability" },
            ].map((s) => (
              <div key={s.label} style={{ padding: "20px 16px" }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#0162c4", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginTop: 6 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Visual Radar + Category Verdicts ────────────────── */}
      <section style={{ padding: "70px 0", background: "#fafbff" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 50 }}>
            <p
              style={{
                display: "inline-block",
                background: "#eef2ff",
                color: "#4f46e5",
                borderRadius: 999,
                padding: "5px 14px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.2,
                marginBottom: 14,
                textTransform: "uppercase",
              }}
            >
              Visual Breakdown
            </p>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>
              Where each platform shines
            </h2>
            <p style={{ fontSize: 15, color: "#64748b", maxWidth: 560, margin: "0 auto" }}>
              See category-by-category coverage at a glance. The wider the shape, the more complete the platform.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)",
              gap: 40,
              alignItems: "center",
              maxWidth: 1100,
              margin: "0 auto",
            }}
          >
            {/* Radar */}
            <div
              style={{
                background: "#fff",
                borderRadius: 20,
                padding: 30,
                border: "1.5px solid #e2e8f0",
                boxShadow: "0 8px 24px -16px rgba(15,23,42,0.12)",
              }}
            >
              <RadarChart size={380} />
              {/* Legend */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: 16,
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: "1px solid #f1f5f9",
                }}
              >
                {competitors.map((c) => (
                  <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600 }}>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        background: c.radarColor,
                        opacity: c.isUs ? 1 : 0.85,
                        border: c.isUs ? `2px solid ${c.radarColor}` : `1px solid ${c.radarColor}`,
                        boxShadow: c.isUs ? `0 0 0 2px rgba(1,98,196,0.18)` : "none",
                      }}
                    />
                    <span style={{ color: c.isUs ? c.radarColor : "#475569", fontWeight: c.isUs ? 800 : 600 }}>
                      {c.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category verdict list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {categoryVerdicts.map((v) => {
                const usEntry = v.all.find((x) => x.isUs);
                const tcxWins = v.winner.isUs;
                const margin = usEntry.score - v.runnerUp.score;
                return (
                  <div
                    key={v.cat}
                    style={{
                      background: "#fff",
                      border: "1.5px solid #e2e8f0",
                      borderLeft: tcxWins ? "4px solid #0162c4" : `4px solid ${v.winner.color}`,
                      borderRadius: 12,
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateX(4px)";
                      e.currentTarget.style.boxShadow = "0 8px 20px -10px rgba(15,23,42,0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateX(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div style={{ fontSize: 22 }}>{categoryIcons[v.cat]}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>
                        {v.cat}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        {tcxWins ? (
                          <>
                            <span style={{ color: "#16a34a", fontWeight: 700 }}>{brandName} wins</span>
                            {margin > 0 && (
                              <span> by {margin === 0.5 ? "½" : margin} feature{margin === 1 || margin === 0.5 ? "" : "s"}</span>
                            )}
                          </>
                        ) : (
                          <>
                            <span style={{ color: v.winner.color, fontWeight: 700 }}>{v.winner.name} leads</span>
                            <span> · TCX scores {usEntry.score}/{v.max}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        background: tcxWins ? "linear-gradient(135deg, #dcfce7, #bbf7d0)" : "#f1f5f9",
                        color: tcxWins ? "#15803d" : "#475569",
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "6px 12px",
                        borderRadius: 999,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {usEntry.score}/{v.max}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Cost Calculator ────────────────────────────────── */}
      <section
        style={{
          padding: "70px 0",
          background: "linear-gradient(180deg, #f8fafc, #eef2ff)",
          borderTop: "1px solid #e2e8f0",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p
              style={{
                display: "inline-block",
                background: "#dcfce7",
                color: "#16a34a",
                borderRadius: 999,
                padding: "5px 14px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.2,
                marginBottom: 14,
                textTransform: "uppercase",
              }}
            >
              Cost Calculator
            </p>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>
              See how much you save
            </h2>
            <p style={{ fontSize: 15, color: "#64748b", maxWidth: 560, margin: "0 auto" }}>
              Drag the sliders to your team size and contract length. We'll do the math.
            </p>
          </div>

          <div
            style={{
              maxWidth: 880,
              margin: "0 auto",
              background: "#fff",
              border: "1.5px solid #e2e8f0",
              borderRadius: 20,
              padding: "32px 36px",
              boxShadow: "0 12px 32px -16px rgba(15,23,42,0.12)",
            }}
          >
            {/* Sliders */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 28, marginBottom: 32 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>Team size</label>
                  <span style={{ fontSize: 22, fontWeight: 800, color: "#0162c4" }}>
                    {teamSize}
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}> users</span>
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="500"
                  step="1"
                  value={teamSize}
                  onChange={(e) => setTeamSize(Number(e.target.value))}
                  style={{
                    width: "100%",
                    accentColor: "#0162c4",
                    cursor: "pointer",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
                  <span>1</span>
                  <span>500</span>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>Contract length</label>
                  <span style={{ fontSize: 22, fontWeight: 800, color: "#0162c4" }}>
                    {contractMonths}
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}> month{contractMonths === 1 ? "" : "s"}</span>
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="36"
                  step="1"
                  value={contractMonths}
                  onChange={(e) => setContractMonths(Number(e.target.value))}
                  style={{
                    width: "100%",
                    accentColor: "#0162c4",
                    cursor: "pointer",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
                  <span>1 mo</span>
                  <span>36 mo</span>
                </div>
              </div>
            </div>

            {/* Bars */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[...costBreakdown]
                .sort((a, b) => a.total - b.total)
                .map((c) => {
                  const max = Math.max(...costBreakdown.map((x) => x.total));
                  const widthPct = max > 0 ? (c.total / max) * 100 : 0;
                  return (
                    <div key={c.key}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: c.isUs ? "#0162c4" : "#475569" }}>
                          {c.isUs && "★ "}{c.name}
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: c.isUs ? "#0162c4" : "#0f172a" }}>
                          ${c.total.toLocaleString()}
                        </span>
                      </div>
                      <div style={{ height: 10, borderRadius: 999, background: "#f1f5f9", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${widthPct}%`,
                            background: c.isUs ? c.gradient : c.color,
                            opacity: c.isUs ? 1 : 0.7,
                            borderRadius: 999,
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Savings callout */}
            {savingsVsMax > 0 && (
              <div
                style={{
                  marginTop: 28,
                  padding: "20px 24px",
                  background: "linear-gradient(135deg, #dcfce7, #bbf7d0)",
                  border: "1.5px solid #86efac",
                  borderRadius: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 36 }}>{"\uD83D\uDCB0"}</div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                    Your savings
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#14532d", lineHeight: 1.2 }}>
                    Save up to <span style={{ color: "#16a34a" }}>${savingsVsMax.toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#15803d", marginTop: 4 }}>
                    over {contractMonths} month{contractMonths === 1 ? "" : "s"} for {teamSize} user{teamSize === 1 ? "" : "s"} vs the most expensive option
                  </div>
                </div>
                <Link
                  to="/auth/register"
                  style={{
                    background: "linear-gradient(135deg, #16a34a, #15803d)",
                    color: "#fff",
                    padding: "12px 24px",
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 14,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                    boxShadow: "0 8px 20px -6px rgba(22,163,74,0.45)",
                  }}
                >
                  Claim savings →
                </Link>
              </div>
            )}

            <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 18, marginBottom: 0 }}>
              Estimates based on each vendor's published starting price as of 2026. Actual enterprise pricing may vary.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Self-Hosted vs Cloud ─────────────────────────────── */}
      <section style={{ padding: "70px 0", background: "#fff" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p style={{ display: "inline-block", background: "#e0e7ff", color: "#4338ca", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, marginBottom: 14, textTransform: "uppercase" }}>
              Deployment Options
            </p>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>
              Self-Hosted or Cloud — your choice
            </h2>
            <p style={{ fontSize: 15, color: "#64748b", maxWidth: 560, margin: "0 auto" }}>
              Unlike Slack and Microsoft Teams, {brandName} gives you the freedom to deploy on your own infrastructure or let us handle everything.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24, maxWidth: 900, margin: "0 auto" }}>
            {deploymentPlans.map((plan) => (
              <div
                key={plan.type}
                style={{
                  background: plan.popular ? "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)" : "#fafbff",
                  border: plan.popular ? "2px solid #16a34a" : "1.5px solid #e2e8f0",
                  borderRadius: 20,
                  padding: "32px 28px",
                  position: "relative",
                  boxShadow: plan.popular ? "0 12px 32px -12px rgba(22,163,74,0.18)" : "none",
                }}
              >
                {plan.popular && (
                  <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#16a34a", color: "#fff", fontSize: 10, fontWeight: 700, padding: "4px 14px", borderRadius: 999, letterSpacing: 1, textTransform: "uppercase" }}>
                    Most Popular
                  </div>
                )}
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>{plan.type}</h3>
                <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>{plan.tagline}</p>
                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: plan.accent }}>{plan.price}</span>
                  <span style={{ fontSize: 14, color: "#64748b", marginLeft: 6 }}>{plan.priceSub}</span>
                </div>
                <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.5, marginBottom: 20 }}>{plan.desc}</p>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px" }}>
                  {plan.features.map((f, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", fontSize: 14, color: f.included ? "#334155" : "#94a3b8" }}>
                      {f.included ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.5" /><path d="M7 12.5l3 3 7-7" stroke="#16a34a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" /><path d="M8 12h8" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" /></svg>
                      )}
                      <span>{f.label}</span>
                      {f.note && <span style={{ fontSize: 11, color: "#d97706", fontWeight: 600, marginLeft: "auto" }}>{f.note}</span>}
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.ctaLink}
                  style={{
                    display: "block",
                    textAlign: "center",
                    background: plan.popular ? plan.accent : "transparent",
                    color: plan.popular ? "#fff" : plan.accent,
                    border: plan.popular ? "none" : `2px solid ${plan.accent}`,
                    padding: "12px 24px",
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 14,
                    textDecoration: "none",
                  }}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Sticky Filter Bar ───────────────────────────────── */}
      <section
        style={{
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid #e2e8f0",
          padding: "16px 0",
          position: "sticky",
          top: 55,
          zIndex: 100,
        }}
      >
        <div className="container">
          {/* Search + Exclusive toggle */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 420 }}>
              <input
                type="text"
                className="tcx-search"
                placeholder="Search features..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px 10px 38px",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 999,
                  fontSize: 14,
                  background: "#fff",
                  transition: "all 0.2s",
                }}
              />
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14 }}>
                {"\uD83D\uDD0D"}
              </span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "#f1f5f9",
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    cursor: "pointer",
                    color: "#64748b",
                  }}
                >
                  ×
                </button>
              )}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, color: "#475569", cursor: "pointer", userSelect: "none" }}>
              <span
                className={`tcx-toggle ${exclusiveOnly ? "on" : ""}`}
                onClick={() => setExclusiveOnly((v) => !v)}
              />
              <span>Exclusive to {brandName} only</span>
            </label>
          </div>

          {/* Category pills */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={() => setActiveCategory(null)}
              style={{
                padding: "7px 16px",
                borderRadius: 20,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                background: !activeCategory ? "#0162c4" : "#f1f5f9",
                color: !activeCategory ? "#fff" : "#475569",
                transition: "all 0.2s",
              }}
            >
              All ({features.length})
            </button>
            {categories.map((cat) => {
              const count = features.filter((f) => f.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 20,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    background: activeCategory === cat ? "#0162c4" : "#f1f5f9",
                    color: activeCategory === cat ? "#fff" : "#475569",
                    transition: "all 0.2s",
                  }}
                >
                  {categoryIcons[cat]} {cat} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Comparison Table (Desktop) ──────────────────────── */}
      <section style={{ padding: "40px 0 60px", background: "#fff" }}>
        <div className="container">
          {filteredFeatures.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>{"\uD83D\uDD0E"}</div>
              <h4 style={{ fontWeight: 700, color: "#0f172a" }}>No features match your filters</h4>
              <button
                onClick={() => { setSearchQuery(""); setActiveCategory(null); setExclusiveOnly(false); }}
                style={{ marginTop: 16, padding: "10px 24px", borderRadius: 999, border: "none", background: "#0162c4", color: "#fff", fontWeight: 600, cursor: "pointer" }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className="tcx-desktop-table" style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 14, minWidth: 760 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "16px 18px", background: "#f1f5f9", borderRadius: "12px 0 0 0", fontWeight: 700, color: "#334155", width: "40%", position: "sticky", left: 0 }}>
                        Feature
                      </th>
                      {competitors.map((c, idx) => (
                        <th
                          key={c.key}
                          style={{
                            textAlign: "center",
                            padding: "16px 12px",
                            background: c.isUs ? "#e8f0fe" : "#f1f5f9",
                            borderRadius: idx === competitors.length - 1 ? "0 12px 0 0" : 0,
                            fontWeight: 700,
                            color: c.isUs ? c.color : "#64748b",
                            width: "15%",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
                            {c.isUs && (
                              <span style={{ background: c.color, color: "#fff", borderRadius: 6, padding: "2px 6px", fontSize: 9, fontWeight: 700 }}>
                                ★
                              </span>
                            )}
                            <span>{c.short}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFeatures.map((f, i) => {
                      const isFirstInCategory =
                        i === 0 || filteredFeatures[i - 1]?.category !== f.category;
                      const isExclusive =
                        f.support.teamchatx === true &&
                        competitors.filter((c) => !c.isUs).every((c) => f.support[c.key] !== true);
                      const rowKey = `${f.category}-${f.feature}`;
                      const isHovered = hoveredRow === rowKey;
                      return (
                        <React.Fragment key={rowKey}>
                          {isFirstInCategory && !activeCategory && !searchQuery && !exclusiveOnly && (
                            <tr>
                              <td colSpan={competitors.length + 1} style={{ padding: "20px 18px 10px", fontWeight: 800, fontSize: 12, letterSpacing: 1.5, color: "#0162c4", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>
                                {categoryIcons[f.category]} {f.category}
                              </td>
                            </tr>
                          )}
                          <tr
                            className="tcx-compare-row"
                            onMouseEnter={() => setHoveredRow(rowKey)}
                            onMouseLeave={() => setHoveredRow(null)}
                            style={{
                              background: isHovered
                                ? isExclusive ? "#fff8e1" : "#f0f7ff"
                                : isExclusive
                                ? "linear-gradient(90deg, #fffde7 0%, #fff 50%)"
                                : i % 2 === 0 ? "#fff" : "#fafbfc",
                              transition: "background 0.15s",
                            }}
                          >
                            <td style={{ padding: "12px 18px", borderBottom: "1px solid #f1f5f9", color: "#334155" }}>
                              <div style={{ fontWeight: 600 }}>
                                {f.feature}
                                {isExclusive && (
                                  <span style={{ display: "inline-block", marginLeft: 8, background: "linear-gradient(135deg, #ff6d00, #ff9100)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10, verticalAlign: "middle", letterSpacing: 0.5 }}>
                                    EXCLUSIVE
                                  </span>
                                )}
                              </div>
                              {isHovered && f.desc && (
                                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, lineHeight: 1.4 }}>{f.desc}</div>
                              )}
                            </td>
                            {competitors.map((c) => (
                              <td
                                key={c.key}
                                style={{
                                  textAlign: "center",
                                  padding: "12px",
                                  borderBottom: "1px solid #f1f5f9",
                                  background: c.isUs ? "rgba(1,98,196,0.03)" : "transparent",
                                }}
                              >
                                <SupportCell value={f.support[c.key]} />
                              </td>
                            ))}
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ─── Mobile Card View ─────────────────────────────── */}
              <div className="tcx-mobile-card">
                {filteredFeatures.map((f, i) => {
                  const isExclusive =
                    f.support.teamchatx === true &&
                    competitors.filter((c) => !c.isUs).every((c) => f.support[c.key] !== true);
                  const isFirstInCategory =
                    i === 0 || filteredFeatures[i - 1]?.category !== f.category;
                  return (
                    <React.Fragment key={`m-${f.category}-${f.feature}`}>
                      {isFirstInCategory && !activeCategory && !searchQuery && !exclusiveOnly && (
                        <div style={{ padding: "20px 4px 8px", fontWeight: 800, fontSize: 11, letterSpacing: 1.5, color: "#0162c4", textTransform: "uppercase" }}>
                          {categoryIcons[f.category]} {f.category}
                        </div>
                      )}
                      <div
                        className="tcx-compare-row"
                        style={{
                          background: isExclusive ? "#fffde7" : "#fff",
                          border: isExclusive ? "1.5px solid #ffc107" : "1px solid #e2e8f0",
                          borderRadius: 12,
                          padding: 14,
                          marginBottom: 10,
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 4 }}>
                          {f.feature}
                          {isExclusive && (
                            <span style={{ display: "inline-block", marginLeft: 6, background: "linear-gradient(135deg, #ff6d00, #ff9100)", color: "#fff", fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 10, verticalAlign: "middle" }}>
                              EXCLUSIVE
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, lineHeight: 1.4 }}>
                          {f.desc}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                          {competitors.map((c) => (
                            <div
                              key={c.key}
                              style={{
                                background: c.isUs ? "#e8f0fe" : "#f8fafc",
                                border: c.isUs ? `1px solid ${c.color}` : "1px solid #e2e8f0",
                                borderRadius: 8,
                                padding: "8px 4px",
                                textAlign: "center",
                              }}
                            >
                              <div style={{ fontSize: 9, fontWeight: 700, color: c.isUs ? c.color : "#94a3b8", marginBottom: 4, textTransform: "uppercase" }}>
                                {c.short}
                              </div>
                              <div style={{ display: "flex", justifyContent: "center" }}>
                                <SupportCell value={f.support[c.key]} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ─── The Cost of NOT Switching (Loss Aversion) ─────── */}
      <section style={{ padding: "56px 0", background: "#fffbeb", borderTop: "1px solid #fde68a", borderBottom: "1px solid #fde68a" }}>
        <div className="container" style={{ maxWidth: 800 }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h2 style={{ fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
              Every month you wait, you're overpaying
            </h2>
            <p style={{ color: "#64748b", fontSize: 14 }}>Here's what staying with your current tool costs you:</p>
          </div>
          <div className="row g-3">
            {[
              { icon: "💸", title: `$${((8.75 - 3) * teamSize).toLocaleString()}/month wasted`, desc: `That's $${((8.75 - 3) * teamSize * 12).toLocaleString()}/year for ${teamSize} users vs Slack Pro` },
              { icon: "🚫", title: `${exclusiveCount} features you can't use`, desc: "Biometric login, AI compose, chat wallpaper, screen annotation, and more" },
              { icon: "🔓", title: "No self-hosted option", desc: "Your messages live on someone else's servers. With TeamChatX, you own your data." },
              { icon: "📱", title: "No mobile admin panel", desc: "Manage users, billing, and departments from your phone — only on TeamChatX" },
            ].map((item) => (
              <div key={item.title} className="col-md-6">
                <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", border: "1px solid #fde68a", display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 24 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e", marginBottom: 2 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "#78716c", lineHeight: 1.4 }}>{item.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────── */}
      <section style={{ background: "linear-gradient(135deg, #0a1628, #0f3460)", padding: "80px 0", textAlign: "center", color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(1,98,196,0.1) 0%, transparent 60%)" }} />
        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <p style={{ display: "inline-block", background: "rgba(255,109,0,0.2)", border: "1px solid rgba(255,109,0,0.4)", borderRadius: 20, padding: "6px 20px", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, marginBottom: 24, color: "#ffab40", textTransform: "uppercase" }}>
            Make the switch today
          </p>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 42px)", fontWeight: 800, marginBottom: 16, lineHeight: 1.2 }}>
            {exclusiveCount} features they don't have.<br />Zero reasons to wait.
          </h2>
          <p style={{ fontSize: 17, color: "#94a3b8", maxWidth: 540, margin: "0 auto 24px", lineHeight: 1.6 }}>
            Start free — no credit card required. Deploy in 5 minutes.
          </p>
          {/* Trust badges */}
          <div style={{ display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap", marginBottom: 28 }}>
            {["🔒 AES-256 Encrypted", "☁️ Self-Host or Cloud", "📱 Mobile + Web + Desktop", "🤖 9 AI Features Built-in"].map((t) => (
              <span key={t} style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>{t}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              to="/auth/register"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #ff4842, #ff6d00)", color: "#fff", padding: "16px 36px", borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: "none", boxShadow: "0 8px 28px rgba(255,72,66,0.35)" }}
            >
              Start Free Trial
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
            <Link
              to="/pricing"
              style={{ display: "inline-block", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "16px 36px", borderRadius: 10, fontWeight: 600, fontSize: 16, textDecoration: "none" }}
            >
              View Pricing
            </Link>
          </div>
          <p style={{ fontSize: 12, color: "#475569", marginTop: 16 }}>30-day money-back guarantee • No long-term contracts</p>
        </div>
      </section>
    </div>
  );
};

export default Compare;
