import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";

// ─── Competitors ────────────────────────────────────────────────────
const competitors = [
  {
    key: "teamchatx",
    name: "TeamChatX",
    short: "TCX",
    color: "#0162c4",
    gradient: "linear-gradient(135deg, #0162c4, #0288d1)",
    isUs: true,
  },
  {
    key: "slack",
    name: "Slack",
    short: "Slack",
    color: "#4A154B",
    gradient: "linear-gradient(135deg, #4A154B, #611f69)",
  },
  {
    key: "teams",
    name: "MS Teams",
    short: "Teams",
    color: "#4b53bc",
    gradient: "linear-gradient(135deg, #4b53bc, #6264a7)",
  },
  {
    key: "troop",
    name: "Troop Messenger",
    short: "Troop",
    color: "#64748b",
    gradient: "linear-gradient(135deg, #64748b, #475569)",
  },
];

// Support map: true = full, "partial" = limited / paid only, false = none
const features = [
  // ─── Messaging ──────────────────────────────────────────
  { category: "Messaging", feature: "1-on-1 Direct Messaging", desc: "Private direct messages between users", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Messaging", feature: "Group Messaging", desc: "Multi-member group conversations", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Messaging", feature: "Threads / Replies", desc: "Threaded reply conversations", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Messaging", feature: "Broadcast Messages", desc: "Send one message to many contacts at once", support: { teamchatx: true, slack: false, teams: false, troop: true } },
  { category: "Messaging", feature: "Broadcast to Groups", desc: "Broadcast directly to multiple groups in one shot", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Messaging", feature: "Broadcast with File Attachments", desc: "Attach files when broadcasting to contacts & groups", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Messaging", feature: "File & Image Sharing (up to 2 GB)", desc: "Share documents, images, and media files", support: { teamchatx: true, slack: "partial", teams: true, troop: true } },
  { category: "Messaging", feature: "Voice-to-Text Messages", desc: "Convert voice recordings to text automatically", support: { teamchatx: true, slack: false, teams: "partial", troop: false } },
  { category: "Messaging", feature: "GIF Picker (Tenor)", desc: "Search and send animated GIFs in chat", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Messaging", feature: "Emoji Reactions", desc: "React to messages with emojis", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Messaging", feature: "Reply / Forward / Pin", desc: "Reply to, forward, or pin important messages", support: { teamchatx: true, slack: "partial", teams: true, troop: true } },
  { category: "Messaging", feature: "Edit & Delete Messages", desc: "Edit sent messages or delete them for everyone", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Messaging", feature: "Disappearing Messages", desc: "Auto-delete messages after a set timer", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Messaging", feature: "Scheduled Messages", desc: "Schedule a message to send at a future time", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Messaging", feature: "Read Receipts", desc: "See when your message has been read", support: { teamchatx: true, slack: false, teams: true, troop: true } },
  { category: "Messaging", feature: "Typing Indicators", desc: "See when someone is typing", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Messaging", feature: "End-to-End Encryption (AES-256)", desc: "Messages encrypted at rest with AES-256-GCM", support: { teamchatx: true, slack: "partial", teams: "partial", troop: true } },

  // ─── Audio & Video ──────────────────────────────────────
  { category: "Audio & Video", feature: "1-on-1 Audio Call", desc: "Voice calls between two users", support: { teamchatx: true, slack: true, teams: true, troop: true } },
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

  // ─── Meeting & Scheduling ───────────────────────────────
  { category: "Meeting & Scheduling", feature: "Instant Meeting (1-Click)", desc: "Start a meeting instantly with one click", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Meeting & Scheduling", feature: "Schedule Meeting", desc: "Schedule meetings for a future date and time", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Meeting & Scheduling", feature: "Join by Meeting ID", desc: "Join meetings using a unique meeting code", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Meeting & Scheduling", feature: "RSVP System (Accept/Decline)", desc: "Accept, decline, or tentatively respond to invites", support: { teamchatx: true, slack: false, teams: true, troop: true } },
  { category: "Meeting & Scheduling", feature: "Auto Chat Invite + Join Button", desc: "Meeting invite card in chat with one-click join", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Meeting & Scheduling", feature: "Email Invitations (HTML)", desc: "Send meeting invites via professional HTML emails", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Meeting & Scheduling", feature: "Meeting Duration Tracker", desc: "Track how long each meeting lasts", support: { teamchatx: true, slack: false, teams: true, troop: false } },

  // ─── AI & Smart Features ────────────────────────────────
  { category: "AI & Smart Features", feature: "AI Live Assistant", desc: "Built-in AI chatbot for instant answers", support: { teamchatx: true, slack: "partial", teams: "partial", troop: false } },
  { category: "AI & Smart Features", feature: "Smart Compose (Auto-Complete)", desc: "AI-powered auto-complete as you type", support: { teamchatx: true, slack: false, teams: "partial", troop: false } },
  { category: "AI & Smart Features", feature: "Grammar Check", desc: "Automatic grammar correction before sending", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "AI & Smart Features", feature: "Auto Translate (14 Languages)", desc: "Translate messages instantly to any of 14 languages", support: { teamchatx: true, slack: "partial", teams: true, troop: false } },
  { category: "AI & Smart Features", feature: "Smart Reply Suggestions", desc: "AI-generated 3 reply options matching sender language", support: { teamchatx: true, slack: false, teams: "partial", troop: false } },
  { category: "AI & Smart Features", feature: "AI Tone Adjuster", desc: "Rewrite messages in Formal, Friendly, or Diplomatic tone", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "AI & Smart Features", feature: "AI Call Notes", desc: "Auto-generate meeting summary, key points, action items", support: { teamchatx: true, slack: "partial", teams: true, troop: false } },
  { category: "AI & Smart Features", feature: "AI Semantic Search", desc: "Search by meaning, not exact keywords", support: { teamchatx: true, slack: "partial", teams: "partial", troop: false } },

  // ─── Privacy & Security ─────────────────────────────────
  { category: "Privacy & Security", feature: "Chat Lock (PIN)", desc: "Lock individual chats behind a PIN", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Privacy & Security", feature: "Mute / DND per Thread", desc: "Mute notifications for specific conversations", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Privacy & Security", feature: "Custom Notification Sounds", desc: "Set different sounds for different chats", support: { teamchatx: true, slack: true, teams: false, troop: false } },
  { category: "Privacy & Security", feature: "Presence Indicators", desc: "See who's online, offline, or idle", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Privacy & Security", feature: "IP & Platform Restrictions", desc: "Restrict workspace access by network and platform", support: { teamchatx: true, slack: "partial", teams: "partial", troop: false } },
  { category: "Privacy & Security", feature: "Trusted Device Management", desc: "View, manage, and revoke trusted devices", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Privacy & Security", feature: "Dangerous File Blocking", desc: "Block .exe, .bat, macros, and harmful uploads", support: { teamchatx: true, slack: true, teams: true, troop: false } },

  // ─── Admin & Management ─────────────────────────────────
  { category: "Admin & Management", feature: "Admin Dashboard", desc: "Central dashboard for managing users and settings", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Admin & Management", feature: "Bulk User Upload (CSV)", desc: "Import hundreds of users via CSV at once", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Admin & Management", feature: "Role-Based Access (RBAC)", desc: "Owner, Admin, Member, Restricted role permissions", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Admin & Management", feature: "Department & Designation Management", desc: "Organize users by departments, designations, and locations", support: { teamchatx: true, slack: false, teams: "partial", troop: false } },
  { category: "Admin & Management", feature: "Activity Logs (Audit Trail)", desc: "Track user actions and system events", support: { teamchatx: true, slack: "partial", teams: true, troop: true } },
  { category: "Admin & Management", feature: "Self-Hosted Deployment", desc: "Deploy on your own servers / on-prem", support: { teamchatx: true, slack: false, teams: false, troop: true } },

  // ─── Platform & Pricing ─────────────────────────────────
  { category: "Platform", feature: "Web App (Browser)", desc: "Access from any modern browser", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Platform", feature: "Windows Desktop App", desc: "Native Windows application", support: { teamchatx: true, slack: true, teams: true, troop: true } },
  { category: "Platform", feature: "Multi-Organization Support", desc: "Switch between multiple organizations / workspaces", support: { teamchatx: true, slack: true, teams: true, troop: false } },
  { category: "Platform", feature: "S3 Cloud Storage", desc: "AWS S3 integration for file storage", support: { teamchatx: true, slack: false, teams: false, troop: false } },
  { category: "Platform", feature: "Stripe Built-In Billing", desc: "Built-in subscription, invoices, and payment management", support: { teamchatx: true, slack: false, teams: false, troop: false } },
];

// Pricing comparison
const pricing = {
  teamchatx: { starting: "$3", note: "per user / month", highlight: "Self-host free" },
  slack: { starting: "$8.75", note: "per user / month", highlight: "Pro plan" },
  teams: { starting: "$4", note: "per user / month", highlight: "Essentials" },
  troop: { starting: "$2.5", note: "per user / month", highlight: "Premium" },
};

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
  "Platform": "\uD83D\uDE80",
};

// Score (true = 1, partial = 0.5, false = 0)
const scoreFor = (key) =>
  features.reduce((sum, f) => {
    const v = f.support[key];
    if (v === true) return sum + 1;
    if (v === "partial") return sum + 0.5;
    return sum;
  }, 0);

const Compare = () => {
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [exclusiveOnly, setExclusiveOnly] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);

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
            TeamChatX <span style={{ color: "#64b5f6" }}>vs</span> Slack <span style={{ color: "#64b5f6" }}>vs</span> Teams <span style={{ color: "#64b5f6" }}>vs</span> Troop
          </h1>
          <p style={{ fontSize: 18, color: "#94a3b8", maxWidth: 680, margin: "0 auto 40px", lineHeight: 1.6 }}>
            One workspace. {features.length} features. Compare TeamChatX against the biggest names in team chat — feature by feature, no marketing fluff.
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
            <span style={{ color: "#ff9100", fontWeight: 700 }}>{exclusiveCount}</span> features exclusive to TeamChatX • <span style={{ color: "#16a34a", fontWeight: 700 }}>Full</span> · <span style={{ color: "#d97706", fontWeight: 700 }}>Partial</span> · <span style={{ color: "#dc2626", fontWeight: 700 }}>None</span>
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
              return (
                <div
                  key={c.key}
                  style={{
                    background: c.isUs ? "linear-gradient(135deg, #eff6ff, #dbeafe)" : "#f8fafc",
                    border: c.isUs ? "2px solid #0162c4" : "1px solid #e2e8f0",
                    borderRadius: 14,
                    padding: "20px 18px",
                    textAlign: "center",
                    position: "relative",
                  }}
                >
                  {c.isUs && (
                    <div
                      style={{
                        position: "absolute",
                        top: -10,
                        right: 12,
                        background: "#0162c4",
                        color: "#fff",
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 999,
                        letterSpacing: 0.5,
                      }}
                    >
                      BEST VALUE
                    </div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.color, marginBottom: 6 }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
                    {p.starting}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{p.note}</div>
                  <div style={{ fontSize: 11, color: c.isUs ? "#0162c4" : "#94a3b8", marginTop: 6, fontWeight: 600 }}>
                    {p.highlight}
                  </div>
                </div>
              );
            })}
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
              <span>Exclusive to TeamChatX only</span>
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
          <p style={{ fontSize: 17, color: "#94a3b8", maxWidth: 540, margin: "0 auto 36px", lineHeight: 1.6 }}>
            Join thousands of teams who already made the switch. Start free — no credit card required.
          </p>
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
        </div>
      </section>
    </div>
  );
};

export default Compare;
