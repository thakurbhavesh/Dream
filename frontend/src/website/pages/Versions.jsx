import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useSiteBranding } from "../../contexts/SiteBrandingContext.jsx";

// ─── Platform icons ──────────────────────────────────────
const PlatformIcon = ({ type, active }) => {
  const color = active ? "#0162c4" : "#cbd5e1";
  const icons = {
    web: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>,
    android: <svg width="18" height="18" viewBox="0 0 24 24" fill={color}><path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z" /></svg>,
    ios: <svg width="18" height="18" viewBox="0 0 24 24" fill={color}><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>,
    desktop: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M20 3H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V5a2 2 0 00-2-2z" /><path d="M8 21h8M12 17v4" /></svg>,
  };
  return icons[type] || null;
};

// ─── Category badge colors ───────────────────────────────
const CAT_COLORS = {
  feature: { bg: "#dcfce7", color: "#15803d", border: "#86efac" },
  improvement: { bg: "#dbeafe", color: "#1d4ed8", border: "#93c5fd" },
  fix: { bg: "#fee2e2", color: "#b91c1c", border: "#fca5a5" },
  security: { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" },
  performance: { bg: "#e0e7ff", color: "#4338ca", border: "#a5b4fc" },
  breaking: { bg: "#fce7f3", color: "#9d174d", border: "#f9a8d4" },
};

// ─── Release data ────────────────────────────────────────
const releases = [
  {
    version: "1.5.3",
    date: "May 10, 2026",
    tag: "Latest",
    platforms: ["web", "android", "desktop"],
    changes: [
      { type: "feature", text: "Image format conversion in chat — convert any image to PNG, JPG, or WebP before sending" },
      { type: "feature", text: "AI background removal for image attachments — one tap to make a transparent PNG" },
      { type: "feature", text: "Desktop auto-update — installed app now updates itself silently via GitHub Releases" },
      { type: "feature", text: "Admin OTP Verifications tab — view the last 25 OTP attempts with status, channel, and IP" },
      { type: "improvement", text: "Meeting details dialog is now mobile-friendly — full-screen on phones with a 2-up stat layout" },
      { type: "fix", text: "Meeting details now show Duration and Started for instant meetings that ended without going live" },
      { type: "fix", text: "Linked Devices QR scanner now requests camera permission upfront on Android and iOS" },
      { type: "fix", text: "Meeting room controls on mobile no longer overlap the home-indicator safe area" },
      { type: "improvement", text: "Cleaner login page — silenced 401/404 console noise on unauthenticated visits" },
      { type: "security", text: "Rate-limited auth REST endpoints — 5 logins / 15 min, 3 password resets / hour" },
    ],
  },
  {
    version: "1.5.2",
    date: "April 12, 2026",
    platforms: ["web", "android", "ios", "desktop"],
    changes: [
      { type: "feature", text: "Incoming call ringtone — plays a ring sound with vibration when someone calls you" },
      { type: "feature", text: "Outgoing call tone — hear a ringback while waiting for the other person to pick up" },
      { type: "feature", text: "15 custom notification tones — choose from Chime, Ping, Bell, Crystal, and more" },
      { type: "improvement", text: "Improved call connectivity and reliability across all platforms" },
      { type: "improvement", text: "Faster app launch — optimized startup and session handling" },
      { type: "improvement", text: "Better offline experience — stay logged in even without internet connection" },
    ],
  },
  {
    version: "1.5.1",
    date: "April 10, 2026",
    platforms: ["web"],
    changes: [
      { type: "feature", text: "11 new website pages — Downloads, Blogs, Versions, Channel Partner, Privacy, GDPR, Refund Policy" },
      { type: "feature", text: "Self-Hosted vs Cloud deployment comparison on the Compare page" },
      { type: "feature", text: "30 new features added to the product comparison across Mobile & Web categories" },
      { type: "feature", text: "Features page now shows a visual comparison chart against competitors" },
      { type: "improvement", text: "Updated website branding, footer, and contact information" },
      { type: "improvement", text: "Refreshed Compare page with cost savings calculator and exclusive feature highlights" },
    ],
  },
  {
    version: "1.5.0",
    date: "April 5, 2026",
    platforms: ["web", "android", "ios"],
    changes: [
      { type: "feature", text: "Mobile app launch — 55+ screens with full feature parity with web" },
      { type: "feature", text: "1-on-1 audio and video calling with high-quality real-time connection" },
      { type: "feature", text: "Screen share receive on mobile — view shared screens during calls" },
      { type: "feature", text: "AI Live Assistant on mobile — get instant answers in English, Hindi, and Hinglish" },
      { type: "feature", text: "QR Code login — scan from your browser to instantly log in on mobile" },
      { type: "feature", text: "Biometric login — use fingerprint or Face ID for fast, secure access" },
      { type: "feature", text: "Offline message queue — messages are saved and sent automatically when you're back online" },
      { type: "feature", text: "Mobile admin panel — manage users, groups, departments, and billing from your phone" },
      { type: "feature", text: "Swipe to reply — swipe right on any message to instantly reply" },
      { type: "feature", text: "Dark mode — complete dark theme across all screens" },
      { type: "feature", text: "Chat wallpaper — set a custom background for each conversation" },
      { type: "feature", text: "Voice message speed control — play at 1x, 1.5x, or 2x" },
      { type: "feature", text: "Draft auto-save — unsent messages are automatically restored" },
      { type: "feature", text: "Pin and archive chats — keep important chats on top, hide old ones" },
      { type: "feature", text: "Profile photo upload — take or choose from your gallery" },
      { type: "security", text: "Device limit — maximum 3 devices logged in at once for security" },
    ],
  },
  {
    version: "1.4.0",
    date: "March 15, 2026",
    platforms: ["web"],
    changes: [
      { type: "feature", text: "Compare page — side-by-side comparison against Slack, Teams, and Troop Messenger" },
      { type: "feature", text: "Cost calculator — estimate savings with adjustable team size and contract length" },
      { type: "feature", text: "190+ features cataloged with descriptions across 11 categories" },
      { type: "feature", text: "Screen annotation — draw and highlight directly on shared screens during meetings" },
      { type: "feature", text: "Remote desktop control — take control of a shared screen for hands-on support" },
      { type: "feature", text: "Broadcast with attachments — send files to multiple contacts at once" },
      { type: "feature", text: "Chat export — save entire chat history as a text file" },
      { type: "security", text: "Password strength meter — visual indicator showing Weak, Fair, Good, or Strong" },
      { type: "security", text: "Terms and Privacy acceptance — required on registration with linked legal pages" },
    ],
  },
  {
    version: "1.3.0",
    date: "February 20, 2026",
    platforms: ["web"],
    changes: [
      { type: "feature", text: "AI Smart Compose — get auto-complete suggestions as you type" },
      { type: "feature", text: "AI Tone Adjuster — rewrite any message in Formal, Friendly, or Diplomatic tone" },
      { type: "feature", text: "Smart Reply — choose from 3 AI-suggested replies in the sender's language" },
      { type: "feature", text: "Auto Translate — instantly translate messages across 14 languages" },
      { type: "feature", text: "Grammar Check — automatic correction before you hit send" },
      { type: "feature", text: "AI Search — find messages by meaning, not just exact words" },
      { type: "feature", text: "AI Help Guide — built-in assistant for feature questions and troubleshooting" },
      { type: "feature", text: "AI Call Notes — auto-generated meeting summaries with key points and action items" },
    ],
  },
  {
    version: "1.2.0",
    date: "January 10, 2026",
    platforms: ["web"],
    changes: [
      { type: "feature", text: "Group video meetings with gallery and speaker view layouts" },
      { type: "feature", text: "Meeting scheduling with RSVP — accept, decline, or mark as tentative" },
      { type: "feature", text: "Reactions and hand raise during meetings" },
      { type: "feature", text: "Pin or spotlight any participant's video" },
      { type: "feature", text: "In-meeting text chat for side discussions" },
      { type: "feature", text: "Meeting duration tracker — see how long each meeting runs" },
      { type: "feature", text: "Professional email invitations with one-click join buttons" },
      { type: "feature", text: "Instant meetings — start with one click, share by meeting ID" },
    ],
  },
  {
    version: "1.1.0",
    date: "December 5, 2025",
    platforms: ["web"],
    changes: [
      { type: "security", text: "End-to-end encryption — all messages encrypted with military-grade AES-256" },
      { type: "feature", text: "Disappearing messages — set messages to auto-delete after 24 hours or 7 days" },
      { type: "feature", text: "Chat lock — protect sensitive conversations with a PIN code" },
      { type: "security", text: "IP and platform restrictions — control who can access your workspace" },
      { type: "security", text: "Input protection — all messages are sanitized to prevent malicious content" },
      { type: "security", text: "File safety — dangerous file types are automatically blocked" },
      { type: "security", text: "Device limit — maximum 3 simultaneous logins with device management" },
      { type: "security", text: "Account deletion — permanently delete your account and all data (GDPR compliant)" },
    ],
  },
  {
    version: "1.0.0",
    date: "November 1, 2025",
    tag: "Initial Release",
    platforms: ["web", "desktop"],
    changes: [
      { type: "feature", text: "Direct messaging and group chat with instant delivery" },
      { type: "feature", text: "File and image sharing — up to 2 GB per upload" },
      { type: "feature", text: "Voice messages with recording and playback" },
      { type: "feature", text: "GIF picker — search and send animated GIFs" },
      { type: "feature", text: "Emoji reactions on any message" },
      { type: "feature", text: "Reply, forward, pin, edit, and delete messages" },
      { type: "feature", text: "Read receipts and typing indicators" },
      { type: "feature", text: "Broadcast messages to multiple contacts at once" },
      { type: "feature", text: "Admin dashboard with role-based permissions" },
      { type: "feature", text: "Department and designation management" },
      { type: "feature", text: "Built-in billing — subscriptions, invoices, and payments" },
      { type: "feature", text: "Self-hosted and cloud deployment options" },
      { type: "feature", text: "Windows desktop app" },
      { type: "feature", text: "Online, offline, and idle status indicators" },
    ],
  },
];

const PLATFORM_LABELS = {
  all: "All Platforms",
  web: "Web",
  android: "Android",
  ios: "iOS",
  desktop: "Desktop",
};

const TYPE_LABELS = {
  all: "All Updates",
  feature: "Features",
  improvement: "Improvements",
  fix: "Bug Fixes",
  security: "Security",
};

export default function Versions() {
  const { brandName } = useSiteBranding();
  const [platformFilter, setPlatformFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = useMemo(() => {
    return releases
      .filter((r) => platformFilter === "all" || r.platforms.includes(platformFilter))
      .map((r) => {
        if (typeFilter === "all") return r;
        const changes = r.changes.filter((c) => c.type === typeFilter);
        return changes.length > 0 ? { ...r, changes } : null;
      })
      .filter(Boolean);
  }, [platformFilter, typeFilter]);

  // Stats
  const totalFeatures = releases.reduce((s, r) => s + r.changes.filter((c) => c.type === "feature").length, 0);
  const totalFixes = releases.reduce((s, r) => s + r.changes.filter((c) => c.type === "fix").length, 0);
  const totalSecurity = releases.reduce((s, r) => s + r.changes.filter((c) => c.type === "security").length, 0);

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <style>{`
        .ver-pill { transition: all 0.2s; cursor: pointer; border: none; }
        .ver-pill:hover { transform: translateY(-1px); }
        .ver-pill.active { box-shadow: 0 4px 12px -4px rgba(1,98,196,0.4); }
        .ver-entry { transition: transform 0.2s, box-shadow 0.2s; }
        .ver-entry:hover { transform: translateX(4px); box-shadow: 0 8px 24px -12px rgba(15,23,42,0.12); }
      `}</style>

      {/* Hero */}
      <section style={{
        background: "linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0f3460 100%)",
        color: "#fff", padding: "80px 0 48px", textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -100, right: -60, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(1,98,196,0.12) 0%, transparent 70%)" }} />
        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <p style={{ display: "inline-block", background: "rgba(1,98,196,0.2)", border: "1px solid rgba(1,98,196,0.4)", borderRadius: 20, padding: "6px 18px", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, marginBottom: 20, color: "#64b5f6", textTransform: "uppercase" }}>
            Changelog
          </p>
          <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, marginBottom: 12, lineHeight: 1.15 }}>
            We Keep Updating
          </h1>
          <p style={{ fontSize: "1.05rem", color: "#94a3b8", maxWidth: 560, margin: "0 auto 32px" }}>
            Every update makes {brandName} faster, more secure, and more powerful. Here's every change we've shipped.
          </p>

          {/* Stats */}
          <div style={{ display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap" }}>
            {[
              { value: releases.length, label: "Releases", color: "#3b82f6" },
              { value: totalFeatures, label: "Features Added", color: "#22c55e" },
              { value: totalFixes, label: "Bugs Fixed", color: "#f59e0b" },
              { value: totalSecurity, label: "Security Updates", color: "#ef4444" },
            ].map((s) => (
              <div key={s.label} style={{ minWidth: 120, padding: "14px 18px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Filters */}
      <section style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "18px 0", position: "sticky", top: 55, zIndex: 100, backdropFilter: "blur(10px)", backgroundColor: "rgba(255,255,255,0.95)" }}>
        <div className="container">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
            {/* Platform pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  className={`ver-pill ${platformFilter === key ? "active" : ""}`}
                  onClick={() => setPlatformFilter(key)}
                  style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: platformFilter === key ? "#0162c4" : "#f1f5f9",
                    color: platformFilter === key ? "#fff" : "#475569",
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  {key !== "all" && <PlatformIcon type={key} active={platformFilter === key} />}
                  {label}
                </button>
              ))}
            </div>

            <div style={{ width: 1, height: 24, background: "#e2e8f0" }} />

            {/* Type pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.entries(TYPE_LABELS).map(([key, label]) => {
                const c = CAT_COLORS[key];
                return (
                  <button
                    key={key}
                    className={`ver-pill ${typeFilter === key ? "active" : ""}`}
                    onClick={() => setTypeFilter(key)}
                    style={{
                      padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: typeFilter === key ? (c?.bg || "#0162c4") : "#f1f5f9",
                      color: typeFilter === key ? (c?.color || "#fff") : "#475569",
                      border: typeFilter === key && c ? `1px solid ${c.border}` : "1px solid transparent",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="container" style={{ padding: "48px 15px", maxWidth: 860 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>📋</div>
            <h4 style={{ fontWeight: 700, color: "#0f172a" }}>No releases match your filters</h4>
            <button onClick={() => { setPlatformFilter("all"); setTypeFilter("all"); }} style={{ marginTop: 12, padding: "8px 20px", borderRadius: 20, border: "none", background: "#0162c4", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
              Clear filters
            </button>
          </div>
        ) : (
          filtered.map((r, i) => {
            const featureCount = r.changes.filter((c) => c.type === "feature").length;
            const fixCount = r.changes.filter((c) => c.type === "fix").length;
            const secCount = r.changes.filter((c) => c.type === "security").length;
            const impCount = r.changes.filter((c) => c.type === "improvement").length;

            return (
              <div key={r.version} style={{ position: "relative", paddingLeft: 40, paddingBottom: i < filtered.length - 1 ? 36 : 0, borderLeft: i < filtered.length - 1 ? "2px solid #e2e8f0" : "2px solid transparent", marginLeft: 14 }}>
                {/* Timeline dot */}
                <div style={{
                  position: "absolute", left: -9, top: 0, width: 18, height: 18, borderRadius: "50%",
                  background: i === 0 ? "#0162c4" : "#cbd5e1", border: "3px solid #f8fafc",
                  boxShadow: i === 0 ? "0 0 0 4px rgba(1,98,196,0.15)" : "none",
                }} />

                <div className="ver-entry" style={{ background: "#fff", borderRadius: 14, padding: "24px 28px", border: i === 0 ? "2px solid #0162c4" : "1px solid #e2e8f0" }}>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                    <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>v{r.version}</h3>
                    <span style={{ color: "#64748b", fontSize: 13, fontWeight: 500 }}>{r.date}</span>
                    {r.tag && (
                      <span style={{
                        background: r.tag === "Latest" ? "linear-gradient(135deg, #0162c4, #0288d1)" : "#f1f5f9",
                        color: r.tag === "Latest" ? "#fff" : "#64748b",
                        padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                      }}>
                        {r.tag}
                      </span>
                    )}
                    {/* Platform icons */}
                    <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                      {r.platforms.map((p) => (
                        <div key={p} title={PLATFORM_LABELS[p]} style={{ width: 28, height: 28, borderRadius: 8, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <PlatformIcon type={p} active />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Category summary */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                    {featureCount > 0 && <span style={{ ...badgeStyle(CAT_COLORS.feature) }}>{featureCount} Feature{featureCount > 1 ? "s" : ""}</span>}
                    {impCount > 0 && <span style={{ ...badgeStyle(CAT_COLORS.improvement) }}>{impCount} Improvement{impCount > 1 ? "s" : ""}</span>}
                    {fixCount > 0 && <span style={{ ...badgeStyle(CAT_COLORS.fix) }}>{fixCount} Fix{fixCount > 1 ? "es" : ""}</span>}
                    {secCount > 0 && <span style={{ ...badgeStyle(CAT_COLORS.security) }}>{secCount} Security</span>}
                  </div>

                  {/* Changes list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {r.changes.map((c, j) => {
                      const cat = CAT_COLORS[c.type] || CAT_COLORS.feature;
                      return (
                        <div key={j} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0" }}>
                          <span style={{
                            flexShrink: 0, marginTop: 2, width: 8, height: 8, borderRadius: "50%",
                            background: cat.color,
                          }} />
                          <span style={{ fontSize: 14, color: "#334155", lineHeight: 1.5 }}>{c.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* CTA */}
      <section style={{ background: "#0f172a", color: "#fff", padding: "48px 0", textAlign: "center" }}>
        <div className="container">
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Want to see what's next?</h3>
          <p style={{ color: "#94a3b8", marginBottom: 24 }}>We ship updates every week. Start using {brandName} today.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/auth/register" style={{ display: "inline-block", background: "#0162c4", color: "#fff", padding: "12px 28px", borderRadius: 8, fontWeight: 600, textDecoration: "none" }}>
              Start Free Trial
            </Link>
            <Link to="/features" style={{ display: "inline-block", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "12px 28px", borderRadius: 8, fontWeight: 600, textDecoration: "none" }}>
              View All Features
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function badgeStyle(cat) {
  return {
    display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
    background: cat.bg, color: cat.color, border: `1px solid ${cat.border}`,
  };
}
