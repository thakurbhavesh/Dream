import React from "react";

const lastUpdated = "April 1, 2026";

const sections = [
  {
    title: "1. Introduction",
    content: `This Privacy Policy applies to air-gapped deployments of TeamChatX — installations that operate on isolated networks with no internet connectivity. Air-gapped deployment offers the highest level of data security for organizations handling classified, sensitive, or regulated information.`,
  },
  {
    title: "2. Complete Data Isolation",
    content: `In an air-gapped deployment:`,
    list: [
      "Zero data leaves your network — no outbound connections of any kind",
      "No telemetry, no update checks, no external API calls",
      "TeamChatX operates 100% offline after initial installation",
      "All features work without internet: messaging, calls, file sharing, admin panel",
      "GIF search and external integrations are disabled by design",
      "WebRTC calls route through your internal TURN server only",
    ],
  },
  {
    title: "3. Data Collection by TeamChatX",
    content: `In an air-gapped environment, TeamChatX (the company) collects absolutely NO data from your deployment. We have no technical capability to access your systems. The only interaction is the initial license key validation, which can be performed offline via a signed license file.`,
  },
  {
    title: "4. Deployment Architecture",
    content: `Air-gapped TeamChatX runs entirely within your secure network:`,
    list: [
      "Application server deployed on your internal infrastructure",
      "PostgreSQL database on your internal database server",
      "File storage on local disk or internal S3-compatible storage (MinIO)",
      "Internal STUN/TURN server for WebRTC calls",
      "Internal SMTP server for email notifications (optional)",
      "No CDN, no cloud dependencies, no external DNS lookups",
    ],
  },
  {
    title: "5. Updates & Maintenance",
    content: `Software updates are delivered via secure offline media (USB, secure file transfer). Your security team can review all update packages before deployment. No automatic updates — your team has full control over the update cycle and timing.`,
  },
  {
    title: "6. Compliance",
    content: `Air-gapped TeamChatX is designed for environments requiring:`,
    list: [
      "Government and military classified networks",
      "Healthcare organizations (HIPAA compliance)",
      "Financial institutions with strict data residency requirements",
      "Research facilities with intellectual property protection needs",
      "Organizations operating under ITAR, FedRAMP, or similar frameworks",
    ],
  },
  {
    title: "7. Your Responsibilities",
    content: `As the operator of an air-gapped deployment, your organization is solely responsible for all data protection, access control, backup management, user privacy, incident response, and compliance with applicable regulations within your network perimeter.`,
  },
  {
    title: "8. Contact",
    content: `For air-gapped deployment support, contact us at enterprise@teamchatx.com. We offer on-site deployment assistance for enterprise customers.`,
  },
];

export default function AirGappedPrivacy() {
  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <section style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "#fff", padding: "80px 0 60px", textAlign: "center" }}>
        <div className="container">
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: 12 }}>Air-Gapped Privacy Policy</h1>
          <p style={{ fontSize: "1rem", color: "#94a3b8" }}>Isolated Network Deployment &middot; Last updated: {lastUpdated}</p>
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
