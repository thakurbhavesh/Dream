import React from "react";
import { Link } from "react-router-dom";

const lastUpdated = "April 1, 2026";

const sections = [
  {
    title: "1. Our Commitment",
    content: `TeamChatX is committed to protecting the privacy and rights of individuals in accordance with the General Data Protection Regulation (GDPR). Whether you use our cloud-hosted service or deploy on-premise, we provide the tools and transparency required for full GDPR compliance.`,
  },
  {
    title: "2. Lawful Basis for Processing",
    content: `We process personal data under the following legal bases:`,
    list: [
      "Contract Performance: Processing necessary to provide the TeamChatX service as agreed in our Terms of Service",
      "Legitimate Interest: Security monitoring, fraud prevention, and service improvement",
      "Consent: Marketing communications and optional analytics (you can withdraw consent at any time)",
      "Legal Obligation: Tax records, financial reporting, and responding to legal requests",
    ],
  },
  {
    title: "3. Your Rights Under GDPR",
    content: `As a data subject, you have the following rights:`,
    list: [
      "Right of Access (Art. 15): Request a copy of all personal data we hold about you",
      "Right to Rectification (Art. 16): Correct inaccurate personal data via your profile settings",
      "Right to Erasure (Art. 17): Delete your account and all data from Settings > Delete Account",
      "Right to Data Portability (Art. 20): Export your chat history as text files from the app",
      "Right to Restrict Processing (Art. 18): Request limited processing of your data",
      "Right to Object (Art. 21): Object to processing based on legitimate interests",
      "Right to Withdraw Consent (Art. 7): Withdraw consent at any time without affecting prior processing",
    ],
  },
  {
    title: "4. Data Processing Agreement (DPA)",
    content: `For organizations using TeamChatX cloud service, we offer a Data Processing Agreement that covers:`,
    list: [
      "Scope and purpose of data processing",
      "Types of personal data processed",
      "Duration of processing",
      "Sub-processor list and notification of changes",
      "Technical and organizational security measures",
      "Data breach notification procedures (within 72 hours)",
      "Audit rights and inspection provisions",
      "Data return and deletion upon contract termination",
    ],
  },
  {
    title: "5. Data Protection Measures",
    content: null,
    list: [
      "AES-256-GCM encryption for all messages at rest",
      "TLS 1.3 for all data in transit",
      "Role-based access control with admin audit trails",
      "Device limit enforcement (max 3 simultaneous sessions)",
      "IP and platform restrictions for access control",
      "Server-side XSS sanitization on all user input",
      "Automated blocking of dangerous file types",
      "Regular security assessments and penetration testing",
    ],
  },
  {
    title: "6. Data Transfers",
    content: `For cloud-hosted deployments, data may be processed in data centers outside the EU. We ensure adequate protection through Standard Contractual Clauses (SCCs) approved by the European Commission. For on-premise and air-gapped deployments, all data remains within your chosen jurisdiction — no international transfers occur.`,
  },
  {
    title: "7. Data Breach Notification",
    content: `In the event of a personal data breach affecting cloud-hosted customers, we will:`,
    list: [
      "Notify affected organizations within 72 hours of becoming aware of the breach",
      "Provide details of the nature of the breach, categories of data affected, and approximate number of records",
      "Describe the measures taken to address and mitigate the breach",
      "Cooperate with supervisory authorities as required",
    ],
  },
  {
    title: "8. Sub-Processors",
    content: `Current sub-processors for cloud-hosted TeamChatX:`,
    list: [
      "AWS (Amazon Web Services): Cloud infrastructure and S3 file storage",
      "Stripe: Payment processing",
      "Neon: Database hosting",
      "Tenor (Google): GIF search API (search queries only)",
    ],
  },
  {
    title: "9. Self-Hosted Compliance",
    content: `Organizations deploying TeamChatX on-premise or in air-gapped environments act as independent Data Controllers. TeamChatX provides the software tools for GDPR compliance (account deletion, data export, access controls) but the organization is responsible for implementing appropriate data protection policies for their deployment.`,
  },
  {
    title: "10. Data Protection Officer",
    content: `For GDPR-related inquiries, data subject requests, or to request a Data Processing Agreement, contact our Data Protection team at dpo@teamchatx.com.`,
  },
];

export default function Gdpr() {
  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <section style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "#fff", padding: "80px 0 60px", textAlign: "center" }}>
        <div className="container">
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: 12 }}>GDPR Compliance</h1>
          <p style={{ fontSize: "1rem", color: "#94a3b8" }}>General Data Protection Regulation &middot; Last updated: {lastUpdated}</p>
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

        <div style={{ background: "#f1f5f9", borderRadius: 12, padding: 24, marginTop: 24 }}>
          <p style={{ color: "#475569", fontSize: 14, margin: 0 }}>
            Need a Data Processing Agreement or have a GDPR inquiry? <Link to="/contact" style={{ color: "#0162c4", fontWeight: 600 }}>Contact us</Link> or email dpo@teamchatx.com.
          </p>
        </div>
      </section>
    </div>
  );
}
