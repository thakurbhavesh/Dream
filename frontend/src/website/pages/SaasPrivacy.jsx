import React from "react";

const lastUpdated = "April 1, 2026";

const sections = [
  {
    title: "1. Introduction",
    content: `This Privacy Policy describes how TeamChatX ("we", "our", or "us") collects, uses, and protects your personal information when you use our cloud-hosted (SaaS) messaging platform. By using TeamChatX, you agree to the practices described in this policy.`,
  },
  {
    title: "2. Information We Collect",
    content: null,
    list: [
      "Account Information: Name, email address, phone number, organization name, and role provided during registration.",
      "Profile Data: Avatar image, display name, status, and designation.",
      "Communication Data: Messages, files, images, voice recordings, and other content shared through the platform. All data is encrypted at rest using AES-256-GCM.",
      "Usage Data: Login timestamps, device information, IP addresses, browser type, and feature usage analytics.",
      "Payment Data: Billing address and payment method details processed securely through Stripe. We do not store credit card numbers on our servers.",
      "Device Data: Device identifiers for trusted device management, biometric verification status, and push notification tokens.",
    ],
  },
  {
    title: "3. How We Use Your Information",
    content: null,
    list: [
      "Provide and maintain the TeamChatX messaging service",
      "Authenticate users and manage device sessions (max 3 devices)",
      "Process payments and manage subscriptions",
      "Send transactional emails (OTP verification, meeting invitations, password resets)",
      "Improve product features and user experience through aggregated analytics",
      "Enforce security measures including XSS prevention, file blocking, and rate limiting",
      "Comply with legal obligations and respond to lawful requests",
    ],
  },
  {
    title: "4. Data Storage & Security",
    content: `Your data is stored on secure cloud infrastructure with the following protections:`,
    list: [
      "AES-256-GCM encryption for all messages at rest",
      "TLS 1.3 encryption for all data in transit",
      "File storage on AWS S3 with server-side encryption",
      "Database backups encrypted and stored in geographically separate locations",
      "Role-based access control (RBAC) for administrative functions",
      "Server-side input sanitization to prevent XSS and injection attacks",
      "Dangerous file type blocking (.exe, .bat, .sh, macros)",
      "JWT-based authentication with secure token management",
    ],
  },
  {
    title: "5. Data Sharing",
    content: `We do not sell your personal data. We may share data with:`,
    list: [
      "Stripe: For payment processing (PCI-DSS compliant)",
      "AWS: For file storage and hosting infrastructure",
      "Tenor/Google: For GIF search functionality (search queries only, no personal data)",
      "Law Enforcement: When required by law, court order, or to protect our legal rights",
    ],
  },
  {
    title: "6. Data Retention",
    content: `We retain your data for as long as your account is active or as needed to provide services. Upon account deletion (available in Settings > Delete Account), we permanently remove all personal data including messages, files, and profile information within 30 days. Backup copies are purged within 90 days.`,
  },
  {
    title: "7. Your Rights",
    content: null,
    list: [
      "Access: Request a copy of your personal data",
      "Rectification: Update or correct inaccurate information through your profile settings",
      "Deletion: Delete your account and all associated data from Settings",
      "Portability: Export your chat history as text files",
      "Restriction: Request limited processing of your data",
      "Objection: Object to processing based on legitimate interests",
    ],
  },
  {
    title: "8. Cookies & Tracking",
    content: `TeamChatX uses essential cookies for authentication and session management. We do not use third-party advertising cookies or cross-site tracking. Analytics data is collected in aggregate form and cannot identify individual users.`,
  },
  {
    title: "9. Children's Privacy",
    content: `TeamChatX is designed for business use and is not intended for individuals under 16 years of age. We do not knowingly collect personal information from children.`,
  },
  {
    title: "10. Changes to This Policy",
    content: `We may update this Privacy Policy periodically. We will notify registered users of material changes via email or in-app notification. Continued use of the service after changes constitutes acceptance of the updated policy.`,
  },
  {
    title: "11. Contact",
    content: `For privacy-related inquiries, contact us at privacy@teamchatx.com or through the Contact page on our website.`,
  },
];

export default function SaasPrivacy() {
  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <section style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "#fff", padding: "80px 0 60px", textAlign: "center" }}>
        <div className="container">
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: 12 }}>SaaS Privacy Policy</h1>
          <p style={{ fontSize: "1rem", color: "#94a3b8" }}>Cloud-Hosted Platform &middot; Last updated: {lastUpdated}</p>
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
