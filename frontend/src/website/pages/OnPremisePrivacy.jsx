import React from "react";

const lastUpdated = "April 1, 2026";

const sections = [
  {
    title: "1. Introduction",
    content: `This Privacy Policy applies to the on-premise (self-hosted) deployment of TeamChatX. When you deploy TeamChatX on your own infrastructure, your organization acts as the Data Controller. TeamChatX (the company) acts solely as the software provider and does not access, process, or store any of your communication data.`,
  },
  {
    title: "2. Your Data, Your Control",
    content: `With on-premise deployment:`,
    list: [
      "All data remains on YOUR servers — messages, files, user profiles, and logs never leave your infrastructure",
      "TeamChatX has zero access to your data, conversations, or user information",
      "Your IT team controls backups, retention policies, and data deletion",
      "No telemetry, analytics, or usage data is sent to TeamChatX servers",
      "Database credentials, encryption keys, and API secrets are managed entirely by your organization",
    ],
  },
  {
    title: "3. Data Processed by TeamChatX (Limited)",
    content: `The only data TeamChatX processes in an on-premise deployment:`,
    list: [
      "License Key: Your organization's license key for activation and validation",
      "Update Checks: Periodic version checks (can be disabled in air-gapped environments)",
      "Support Requests: Only information you voluntarily provide when contacting our support team",
    ],
  },
  {
    title: "4. Your Responsibilities as Data Controller",
    content: `As the operator of a self-hosted TeamChatX instance, your organization is responsible for:`,
    list: [
      "Complying with applicable data protection laws (GDPR, CCPA, etc.)",
      "Implementing appropriate security measures (firewalls, SSL, access controls)",
      "Managing user consent and privacy notices for your employees",
      "Handling data subject requests (access, deletion, portability)",
      "Configuring data retention and backup policies",
      "Maintaining server security patches and TeamChatX updates",
    ],
  },
  {
    title: "5. Security Recommendations",
    content: `We recommend the following security measures for on-premise deployments:`,
    list: [
      "Deploy behind a reverse proxy with TLS 1.3",
      "Enable AES-256-GCM encryption for messages at rest",
      "Restrict database access to the application server only",
      "Enable IP and platform restrictions from the admin panel",
      "Configure device limits and trusted device management",
      "Enable XSS sanitization and dangerous file blocking (enabled by default)",
      "Perform regular backups and test restore procedures",
      "Monitor activity logs and OTP verification logs from the admin panel",
    ],
  },
  {
    title: "6. Third-Party Services",
    content: `On-premise TeamChatX may optionally connect to external services that you configure:`,
    list: [
      "STUN/TURN Servers: For WebRTC calls (configurable, can use your own servers)",
      "Tenor API: For GIF search (can be disabled)",
      "SMTP Server: For email notifications (your own SMTP server)",
      "S3-Compatible Storage: For file uploads (can be your own MinIO/S3 instance)",
    ],
  },
  {
    title: "7. Updates & Patches",
    content: `Software updates are provided as downloadable packages. No automatic updates are pushed to your servers. Your IT team controls when and how updates are applied. Security patches are communicated via email to the registered admin contact.`,
  },
  {
    title: "8. Contact",
    content: `For questions about on-premise privacy or deployment assistance, contact us at privacy@teamchatx.com.`,
  },
];

export default function OnPremisePrivacy() {
  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <section style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "#fff", padding: "80px 0 60px", textAlign: "center" }}>
        <div className="container">
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: 12 }}>On-Premise Privacy Policy</h1>
          <p style={{ fontSize: "1rem", color: "#94a3b8" }}>Self-Hosted Deployment &middot; Last updated: {lastUpdated}</p>
        </div>
      </section>

      <section className="container" style={{ padding: "48px 15px", maxWidth: 800 }}>
        {sections.map((s, i) => (
          <div key={i} style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>{s.title}</h2>
            {s.content && <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.7 }}>{s.content}</p>}
            {s.list && (
              <ul style={{ color: "#475569", fontSize: 15, lineHeight: 1.8, paddingLeft: 20 }}>
                {s.list.map((item, j) => <li key={j}>{item}</li>)}
              </ul>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
