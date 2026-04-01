import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

const features = [
  { category: "Messaging", feature: "1-on-1 Chat", teamchatx: true, troop: true, desc: "Direct private messaging between users" },
  { category: "Messaging", feature: "Group Messaging", teamchatx: true, troop: true, desc: "Create group conversations with multiple members" },
  { category: "Messaging", feature: "Broadcast Messages", teamchatx: true, troop: true, desc: "Send one message to many contacts at once" },
  { category: "Messaging", feature: "Broadcast to Groups", teamchatx: true, troop: false, desc: "Broadcast messages directly to multiple groups" },
  { category: "Messaging", feature: "File & Image Sharing", teamchatx: true, troop: true, desc: "Share documents, images, and media files" },
  { category: "Messaging", feature: "Broadcast with File Attachments", teamchatx: true, troop: false, desc: "Attach files when broadcasting to contacts & groups" },
  { category: "Messaging", feature: "Voice-to-Text Messages", teamchatx: true, troop: false, desc: "Convert voice recordings to text automatically" },
  { category: "Messaging", feature: "GIF Picker (Tenor)", teamchatx: true, troop: false, desc: "Search and send animated GIFs in chat" },
  { category: "Messaging", feature: "Emoji Reactions", teamchatx: true, troop: true, desc: "React to messages with emojis" },
  { category: "Messaging", feature: "Reply / Forward / Pin", teamchatx: true, troop: true, desc: "Reply to, forward, or pin important messages" },
  { category: "Messaging", feature: "Edit & Delete Messages", teamchatx: true, troop: true, desc: "Edit sent messages or delete them" },
  { category: "Messaging", feature: "Disappearing Messages", teamchatx: true, troop: false, desc: "Auto-delete messages after a set timer" },
  { category: "Messaging", feature: "Read Receipts", teamchatx: true, troop: true, desc: "See when your message has been read" },
  { category: "Messaging", feature: "Typing Indicators", teamchatx: true, troop: true, desc: "See when someone is typing" },
  { category: "Messaging", feature: "End-to-End Encryption", teamchatx: true, troop: true, desc: "Messages encrypted at rest for security" },

  { category: "Audio & Video", feature: "1-on-1 Audio Call", teamchatx: true, troop: true, desc: "Voice calls between two users" },
  { category: "Audio & Video", feature: "1-on-1 Video Call", teamchatx: true, troop: true, desc: "Video calls between two users" },
  { category: "Audio & Video", feature: "Group Video Meeting", teamchatx: true, troop: true, desc: "Multi-participant video conferences" },
  { category: "Audio & Video", feature: "In-Meeting Chat", teamchatx: true, troop: false, desc: "Send text messages during a live meeting" },
  { category: "Audio & Video", feature: "Meeting Reactions & Hand Raise", teamchatx: true, troop: false, desc: "React with emojis and raise hand during meetings" },
  { category: "Audio & Video", feature: "Gallery / Speaker View", teamchatx: true, troop: false, desc: "Toggle between grid and speaker focus layouts" },
  { category: "Audio & Video", feature: "Pin / Spotlight Participant", teamchatx: true, troop: false, desc: "Pin a participant's video to focus on them" },
  { category: "Audio & Video", feature: "Privacy-First Camera/Mic", teamchatx: true, troop: false, desc: "Camera & mic only activate when you choose" },
  { category: "Audio & Video", feature: "Screen Sharing", teamchatx: true, troop: true, desc: "Share your screen during calls or meetings" },
  { category: "Audio & Video", feature: "Screen Annotation", teamchatx: true, troop: false, desc: "Draw and annotate on shared screens in real-time" },
  { category: "Audio & Video", feature: "Remote Desktop Control", teamchatx: true, troop: false, desc: "Take control of a shared screen remotely" },

  { category: "Meeting & Scheduling", feature: "Instant Meeting (1-Click)", teamchatx: true, troop: true, desc: "Start a meeting instantly with one click" },
  { category: "Meeting & Scheduling", feature: "Schedule Meeting", teamchatx: true, troop: true, desc: "Schedule meetings for a future date and time" },
  { category: "Meeting & Scheduling", feature: "Join by Meeting ID", teamchatx: true, troop: true, desc: "Join meetings using a unique meeting code" },
  { category: "Meeting & Scheduling", feature: "RSVP System", teamchatx: true, troop: true, desc: "Accept, decline, or tentatively respond to invites" },
  { category: "Meeting & Scheduling", feature: "Auto Chat Invite + Join Button", teamchatx: true, troop: false, desc: "Meeting invite card in chat with one-click join" },
  { category: "Meeting & Scheduling", feature: "Email Invitations", teamchatx: true, troop: true, desc: "Send meeting invites via professional HTML emails" },
  { category: "Meeting & Scheduling", feature: "Meeting Duration Tracker", teamchatx: true, troop: false, desc: "Track how long each meeting lasts" },

  { category: "AI & Smart Features", feature: "AI Live Assistant", teamchatx: true, troop: false, desc: "Built-in AI chatbot for instant answers" },
  { category: "AI & Smart Features", feature: "Smart Compose", teamchatx: true, troop: false, desc: "AI-powered auto-complete as you type" },
  { category: "AI & Smart Features", feature: "Grammar Check", teamchatx: true, troop: false, desc: "Automatic grammar correction before sending" },
  { category: "AI & Smart Features", feature: "Auto Translate", teamchatx: true, troop: false, desc: "Translate messages to any language instantly" },
  { category: "AI & Smart Features", feature: "Smart Reply Suggestions", teamchatx: true, troop: false, desc: "AI suggests quick replies based on context" },

  { category: "Privacy & Security", feature: "Chat Lock (PIN)", teamchatx: true, troop: false, desc: "Lock chats behind a PIN for extra privacy" },
  { category: "Privacy & Security", feature: "Mute / DND per Thread", teamchatx: true, troop: true, desc: "Mute notifications for specific conversations" },
  { category: "Privacy & Security", feature: "Custom Notification Sounds", teamchatx: true, troop: false, desc: "Set different sounds for different chats" },
  { category: "Privacy & Security", feature: "Presence Indicators", teamchatx: true, troop: true, desc: "See who's online, offline, or idle" },
  { category: "Privacy & Security", feature: "Organization Controls", teamchatx: true, troop: true, desc: "Admin-level feature controls per organization" },

  { category: "Admin & Management", feature: "Admin Dashboard", teamchatx: true, troop: true, desc: "Central dashboard for managing users and settings" },
  { category: "Admin & Management", feature: "Bulk User Upload", teamchatx: true, troop: false, desc: "Import hundreds of users via CSV at once" },
  { category: "Admin & Management", feature: "Role-Based Access", teamchatx: true, troop: true, desc: "Owner, Admin, Member role permissions" },
  { category: "Admin & Management", feature: "Department Management", teamchatx: true, troop: false, desc: "Organize users by departments and designations" },
  { category: "Admin & Management", feature: "Activity Logs", teamchatx: true, troop: true, desc: "Track user actions and system events" },

  { category: "Platform", feature: "Web App", teamchatx: true, troop: true, desc: "Access from any browser" },
  { category: "Platform", feature: "Windows Desktop App", teamchatx: true, troop: true, desc: "Native Windows application" },
  { category: "Platform", feature: "Self-Hosted Option", teamchatx: true, troop: true, desc: "Deploy on your own servers" },
  { category: "Platform", feature: "Multi-Organization", teamchatx: true, troop: false, desc: "Switch between multiple organizations" },
  { category: "Platform", feature: "S3 Cloud Storage", teamchatx: true, troop: false, desc: "AWS S3 integration for file storage" },
  { category: "Platform", feature: "Stripe Payments", teamchatx: true, troop: false, desc: "Built-in billing and subscription management" },
];

const Check = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" fill="#e8f5e9" stroke="#4caf50" strokeWidth="1.5" />
    <path d="M7 12.5l3 3 7-7" stroke="#4caf50" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Cross = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" fill="#fce4ec" stroke="#ef5350" strokeWidth="1.5" />
    <path d="M8 8l8 8M16 8l-8 8" stroke="#ef5350" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Animated counter
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
  "AI & Smart Features": "\uD83E\uDDE0",
  "Privacy & Security": "\uD83D\uDD12",
  "Admin & Management": "\u2699\uFE0F",
  "Platform": "\uD83D\uDE80",
};

const whySwitchReasons = [
  { icon: "\uD83E\uDDE0", title: "AI-Powered", desc: "Smart compose, grammar check, auto-translate, and AI assistant — features no other team chat offers." },
  { icon: "\uD83D\uDD12", title: "Privacy First", desc: "Chat lock with PIN, disappearing messages, on-demand camera/mic — your privacy is our priority." },
  { icon: "\uD83C\uDFA5", title: "Advanced Meetings", desc: "In-meeting chat, reactions, hand raise, screen annotation, remote control — beyond basic video calls." },
  { icon: "\uD83D\uDCB0", title: "Better Value", desc: "More features at a competitive price. Self-hosted option means no per-user cloud fees." },
];

const Compare = () => {
  const [activeCategory, setActiveCategory] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);

  const teamchatxCount = features.filter((f) => f.teamchatx).length;
  const troopCount = features.filter((f) => f.troop).length;
  const exclusiveCount = features.filter((f) => f.teamchatx && !f.troop).length;

  const filteredFeatures = activeCategory
    ? features.filter((f) => f.category === activeCategory)
    : features;

  return (
    <div style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section
        style={{
          background: "linear-gradient(135deg, #0a1628 0%, #0d2137 40%, #0f3460 100%)",
          color: "#fff",
          padding: "100px 0 70px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -120, right: -80, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(1,98,196,0.12) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: -150, left: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,109,0,0.08) 0%, transparent 70%)" }} />

        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <p style={{ display: "inline-block", background: "rgba(1,98,196,0.2)", border: "1px solid rgba(1,98,196,0.4)", borderRadius: 20, padding: "6px 20px", fontSize: 13, fontWeight: 600, letterSpacing: 1.5, marginBottom: 24, color: "#64b5f6", textTransform: "uppercase" }}>
            Feature Comparison
          </p>
          <h1 style={{ fontSize: "clamp(30px, 5vw, 56px)", fontWeight: 800, marginBottom: 16, lineHeight: 1.15 }}>
            TeamChatX <span style={{ color: "#64b5f6" }}>vs</span> Troop Messenger
          </h1>
          <p style={{ fontSize: 18, color: "#94a3b8", maxWidth: 620, margin: "0 auto 50px", lineHeight: 1.6 }}>
            More features. Smarter AI. Better privacy. See the complete side-by-side comparison and discover why teams are switching to TeamChatX.
          </p>

          {/* Score cards */}
          <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap", marginBottom: 20 }}>
            <div style={{ background: "linear-gradient(135deg, #0162c4, #0288d1)", borderRadius: 20, padding: "32px 44px", minWidth: 200, boxShadow: "0 12px 40px rgba(1,98,196,0.35)", transform: "translateY(-4px)", transition: "transform 0.3s" }}>
              <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1 }}><AnimatedNumber target={teamchatxCount} /></div>
              <div style={{ fontSize: 14, opacity: 0.9, marginTop: 8, fontWeight: 500 }}>TeamChatX Features</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "32px 44px", minWidth: 200 }}>
              <div style={{ fontSize: 56, fontWeight: 800, color: "#64748b", lineHeight: 1 }}><AnimatedNumber target={troopCount} /></div>
              <div style={{ fontSize: 14, color: "#64748b", marginTop: 8, fontWeight: 500 }}>Troop Messenger</div>
            </div>
            <div style={{ background: "linear-gradient(135deg, #e65100, #ff6d00)", borderRadius: 20, padding: "32px 44px", minWidth: 200, boxShadow: "0 12px 40px rgba(230,81,0,0.3)", transform: "translateY(-4px)" }}>
              <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1 }}><AnimatedNumber target={exclusiveCount} /></div>
              <div style={{ fontSize: 14, opacity: 0.9, marginTop: 8, fontWeight: 500 }}>Only in TeamChatX</div>
            </div>
          </div>

          {/* Win percentage bar */}
          <div style={{ maxWidth: 500, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#94a3b8" }}>
              <span>TeamChatX {Math.round((teamchatxCount / features.length) * 100)}%</span>
              <span>Troop {Math.round((troopCount / features.length) * 100)}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.1)", overflow: "hidden", display: "flex" }}>
              <div style={{ width: `${(teamchatxCount / features.length) * 100}%`, background: "linear-gradient(90deg, #0162c4, #42a5f5)", borderRadius: 4, transition: "width 1.5s ease" }} />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Why Switch Section ───────────────────────────────── */}
      <section style={{ padding: "70px 0", background: "#f8fafc" }}>
        <div className="container">
          <h2 style={{ textAlign: "center", fontSize: "clamp(22px, 3vw, 36px)", fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>
            Why Teams Choose TeamChatX
          </h2>
          <p style={{ textAlign: "center", color: "#64748b", fontSize: 16, marginBottom: 48, maxWidth: 500, marginLeft: "auto", marginRight: "auto" }}>
            {exclusiveCount} features you won't find anywhere else
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
            {whySwitchReasons.map((r, i) => (
              <div
                key={i}
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: "32px 28px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  border: "1px solid #e2e8f0",
                  transition: "transform 0.25s, box-shadow 0.25s",
                  cursor: "default",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"; }}
              >
                <div style={{ fontSize: 36, marginBottom: 16 }}>{r.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{r.title}</h3>
                <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, margin: 0 }}>{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Category Stats ──────────────────────────────────── */}
      <section style={{ padding: "60px 0", background: "#fff" }}>
        <div className="container">
          <h2 style={{ textAlign: "center", fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 800, color: "#0f172a", marginBottom: 40 }}>
            Category Breakdown
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {categories.map((cat) => {
              const catFeatures = features.filter((f) => f.category === cat);
              const tcx = catFeatures.filter((f) => f.teamchatx).length;
              const trp = catFeatures.filter((f) => f.troop).length;
              const pct = Math.round((tcx / catFeatures.length) * 100);
              return (
                <div key={cat} style={{ background: "#f8fafc", borderRadius: 12, padding: "20px 24px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                      {categoryIcons[cat]} {cat}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#0162c4", background: "#e8f0fe", padding: "2px 10px", borderRadius: 10 }}>
                      {tcx} vs {trp}
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "#e2e8f0", overflow: "hidden", marginBottom: 6 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "linear-gradient(90deg, #4caf50, #66bb6a)" : "linear-gradient(90deg, #0162c4, #42a5f5)", borderRadius: 3, transition: "width 1s ease" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>
                    TeamChatX leads {tcx - trp > 0 ? `by ${tcx - trp} feature${tcx - trp > 1 ? "s" : ""}` : "equally"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Category Filter (Sticky) ────────────────────────── */}
      <section style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", borderTop: "1px solid #e2e8f0", padding: "14px 0", position: "sticky", top: 55, zIndex: 100 }}>
        <div className="container" style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={() => setActiveCategory(null)}
            style={{ padding: "8px 20px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: !activeCategory ? "#0162c4" : "#f1f5f9", color: !activeCategory ? "#fff" : "#475569", transition: "all 0.2s" }}
          >
            All ({features.length})
          </button>
          {categories.map((cat) => {
            const count = features.filter((f) => f.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{ padding: "8px 20px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: activeCategory === cat ? "#0162c4" : "#f1f5f9", color: activeCategory === cat ? "#fff" : "#475569", transition: "all 0.2s" }}
              >
                {categoryIcons[cat]} {cat} ({count})
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── Comparison Table ─────────────────────────────────── */}
      <section style={{ padding: "40px 0 80px", background: "#fff" }}>
        <div className="container">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 15 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "16px 20px", background: "#f1f5f9", borderRadius: "12px 0 0 0", fontWeight: 700, color: "#334155", width: "45%" }}>
                    Feature
                  </th>
                  <th style={{ textAlign: "center", padding: "16px 20px", background: "#e8f0fe", fontWeight: 700, color: "#0162c4", width: "20%" }}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <span style={{ background: "#0162c4", color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 10, fontWeight: 700 }}>WINNER</span>
                      TeamChatX
                    </span>
                  </th>
                  <th style={{ textAlign: "center", padding: "16px 20px", background: "#f1f5f9", borderRadius: "0 12px 0 0", fontWeight: 700, color: "#64748b", width: "20%" }}>
                    Troop Messenger
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredFeatures.map((f, i) => {
                  const isFirstInCategory = i === 0 || filteredFeatures[i - 1]?.category !== f.category;
                  const isExclusive = f.teamchatx && !f.troop;
                  const rowKey = `${f.category}-${f.feature}`;
                  const isHovered = hoveredRow === rowKey;
                  return (
                    <React.Fragment key={rowKey}>
                      {isFirstInCategory && !activeCategory && (
                        <tr>
                          <td colSpan={3} style={{ padding: "20px 20px 10px", fontWeight: 800, fontSize: 13, letterSpacing: 1.5, color: "#0162c4", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>
                            {categoryIcons[f.category]} {f.category}
                          </td>
                        </tr>
                      )}
                      <tr
                        onMouseEnter={() => setHoveredRow(rowKey)}
                        onMouseLeave={() => setHoveredRow(null)}
                        style={{
                          background: isHovered
                            ? isExclusive ? "#fff8e1" : "#f0f7ff"
                            : isExclusive
                            ? "linear-gradient(90deg, #fffde7 0%, #fff 40%)"
                            : i % 2 === 0 ? "#fff" : "#fafbfc",
                          transition: "background 0.15s",
                          cursor: "default",
                        }}
                      >
                        <td style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9", color: "#334155" }}>
                          <div style={{ fontWeight: 600 }}>
                            {f.feature}
                            {isExclusive && (
                              <span style={{ display: "inline-block", marginLeft: 8, background: "linear-gradient(135deg, #ff6d00, #ff9100)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10, verticalAlign: "middle", letterSpacing: 0.5 }}>
                                EXCLUSIVE
                              </span>
                            )}
                          </div>
                          {isHovered && f.desc && (
                            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, lineHeight: 1.4 }}>{f.desc}</div>
                          )}
                        </td>
                        <td style={{ textAlign: "center", padding: "14px 20px", borderBottom: "1px solid #f1f5f9", background: "rgba(1,98,196,0.02)" }}>
                          {f.teamchatx ? <Check /> : <Cross />}
                        </td>
                        <td style={{ textAlign: "center", padding: "14px 20px", borderBottom: "1px solid #f1f5f9" }}>
                          {f.troop ? <Check /> : <Cross />}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── Testimonial / Quote ──────────────────────────────── */}
      <section style={{ padding: "70px 0", background: "#f0f7ff" }}>
        <div className="container" style={{ textAlign: "center", maxWidth: 700 }}>
          <div style={{ fontSize: 60, color: "#0162c4", lineHeight: 1, marginBottom: 16, opacity: 0.3 }}>"</div>
          <p style={{ fontSize: 22, fontWeight: 600, color: "#1e293b", lineHeight: 1.6, fontStyle: "italic", marginBottom: 24 }}>
            We switched from Troop Messenger to TeamChatX and haven't looked back. The AI features alone save our team hours every week, and the meeting experience is miles ahead.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #0162c4, #42a5f5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 18 }}>
              R
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Rajesh Kumar</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>CTO, TechVista Solutions</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────── */}
      <section style={{ background: "linear-gradient(135deg, #0a1628, #0f3460)", padding: "90px 0", textAlign: "center", color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(1,98,196,0.1) 0%, transparent 60%)" }} />
        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <p style={{ display: "inline-block", background: "rgba(255,109,0,0.2)", border: "1px solid rgba(255,109,0,0.4)", borderRadius: 20, padding: "6px 20px", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, marginBottom: 24, color: "#ffab40", textTransform: "uppercase" }}>
            Make the switch today
          </p>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 44px)", fontWeight: 800, marginBottom: 16, lineHeight: 1.2 }}>
            {exclusiveCount} features they don't have.<br />Zero reasons to wait.
          </h2>
          <p style={{ fontSize: 17, color: "#94a3b8", maxWidth: 520, margin: "0 auto 36px", lineHeight: 1.6 }}>
            Join thousands of teams who already made the switch. Start with a free trial — no credit card required.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              to="/auth/register"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #ff4842, #ff6d00)", color: "#fff", padding: "16px 40px", borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: "none", boxShadow: "0 8px 28px rgba(255,72,66,0.35)", transition: "transform 0.2s, box-shadow 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 36px rgba(255,72,66,0.45)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(255,72,66,0.35)"; }}
            >
              Start Free Trial
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
            <Link
              to="/pricing"
              style={{ display: "inline-block", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "16px 40px", borderRadius: 10, fontWeight: 600, fontSize: 16, textDecoration: "none", transition: "background 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
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
