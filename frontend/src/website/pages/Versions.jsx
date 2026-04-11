import React from "react";

const releases = [
  {
    version: "1.5.0",
    date: "April 2026",
    tag: "Latest",
    highlights: [
      "Mobile app with 55+ screens — full feature parity with web",
      "1-on-1 audio & video calling with WebRTC",
      "Screen share receive on mobile",
      "AI Live Assistant on mobile",
      "QR Code login (WhatsApp-style linked devices)",
      "Biometric login — fingerprint & Face ID with OTP skip",
      "Offline message queue with auto-retry on reconnect",
      "Admin panel on mobile — users, groups, departments, billing, OTP logs",
    ],
  },
  {
    version: "1.4.0",
    date: "March 2026",
    highlights: [
      "Compare page — 4-way feature comparison with radar chart & cost calculator",
      "162 product features synced to database",
      "Screen annotation and remote desktop control in meetings",
      "Broadcast with file attachments",
      "Chat export as shareable text file",
      "Password strength meter on registration",
    ],
  },
  {
    version: "1.3.0",
    date: "February 2026",
    highlights: [
      "AI Smart Compose with auto-complete",
      "AI Tone Adjuster — formal, friendly, diplomatic",
      "Smart Reply suggestions matching sender language",
      "Auto Translate supporting 14 languages",
      "Grammar check before send",
      "AI Semantic Search",
    ],
  },
  {
    version: "1.2.0",
    date: "January 2026",
    highlights: [
      "Group video meetings with gallery & speaker view",
      "Meeting scheduling with RSVP (accept/decline)",
      "Meeting reactions & hand raise",
      "Pin / spotlight participant",
      "In-meeting chat",
      "Meeting duration tracker",
      "Email invitations with HTML templates",
    ],
  },
  {
    version: "1.1.0",
    date: "December 2025",
    highlights: [
      "End-to-end encryption (AES-256-GCM)",
      "Disappearing messages with configurable timer",
      "Chat lock with PIN",
      "IP & platform restrictions for enterprise security",
      "XSS & input sanitization on all messages",
      "Dangerous file blocking (.exe, .bat, .sh)",
      "Device limit — max 3 simultaneous logins",
    ],
  },
  {
    version: "1.0.0",
    date: "November 2025",
    highlights: [
      "Initial release of TeamChatX",
      "Direct messaging & group chat",
      "File & image sharing (up to 2 GB)",
      "Voice messages with playback speed",
      "GIF picker (Tenor integration)",
      "Emoji reactions",
      "Reply, forward, pin, edit, delete messages",
      "Admin dashboard with RBAC",
      "Stripe billing integration",
      "Self-hosted & cloud deployment options",
    ],
  },
];

export default function Versions() {
  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      {/* Hero */}
      <section style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "#fff", padding: "80px 0 60px", textAlign: "center" }}>
        <div className="container">
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: 12 }}>Version History</h1>
          <p style={{ fontSize: "1.1rem", color: "#94a3b8", maxWidth: 560, margin: "0 auto" }}>
            Track every improvement. Every release brings TeamChatX closer to the most complete team communication platform.
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="container" style={{ padding: "60px 15px", maxWidth: 800 }}>
        {releases.map((r, i) => (
          <div key={r.version} style={{ position: "relative", paddingLeft: 36, paddingBottom: i < releases.length - 1 ? 40 : 0, borderLeft: i < releases.length - 1 ? "2px solid #e2e8f0" : "2px solid transparent", marginLeft: 12 }}>
            {/* Dot */}
            <div style={{ position: "absolute", left: -8, top: 0, width: 16, height: 16, borderRadius: "50%", background: i === 0 ? "#0162c4" : "#cbd5e1", border: "3px solid #f8fafc" }} />

            <div style={{ background: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>v{r.version}</h3>
                <span style={{ color: "#64748b", fontSize: 13 }}>{r.date}</span>
                {r.tag && (
                  <span style={{ background: "#dcfce7", color: "#16a34a", padding: "2px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                    {r.tag}
                  </span>
                )}
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, color: "#475569", fontSize: 14, lineHeight: 1.9 }}>
                {r.highlights.map((h, j) => (
                  <li key={j}>{h}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
