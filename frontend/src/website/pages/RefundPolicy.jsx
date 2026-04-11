import React from "react";
import { Link } from "react-router-dom";

const lastUpdated = "April 1, 2026";

const sections = [
  {
    title: "1. Money-Back Guarantee",
    content: `TeamChatX offers a 30-day money-back guarantee on all paid plans. If you're not satisfied with the service within the first 30 days of your initial subscription, you can request a full refund — no questions asked.`,
  },
  {
    title: "2. Eligibility for Refund",
    content: `Refunds are available under the following conditions:`,
    list: [
      "First-time subscription: Full refund if requested within 30 days of initial purchase",
      "Annual plan cancellation: Pro-rated refund for unused months if cancelled within the first 90 days",
      "Service outage: Credit or refund for extended service interruptions (exceeding 99.9% SLA)",
      "Billing errors: Full refund for any duplicate or incorrect charges",
      "Unauthorized charges: Immediate refund upon verification",
    ],
  },
  {
    title: "3. Non-Refundable Items",
    content: null,
    list: [
      "Monthly subscriptions after the 30-day money-back period",
      "Annual subscriptions after the 90-day cancellation window (unless required by local law)",
      "Custom development, integration, or consulting services",
      "On-premise deployment and setup fees once deployment is completed",
      "Domain or SSL certificate costs purchased through TeamChatX",
    ],
  },
  {
    title: "4. How to Request a Refund",
    content: `To request a refund:`,
    list: [
      "Email billing@teamchatx.com with your account email and reason for refund",
      "Or contact us through the Contact page on our website",
      "Include your transaction ID or invoice number (found in Admin Panel > Payments)",
      "Refund requests are processed within 5 business days",
      "Refunds are issued to the original payment method via Stripe",
    ],
  },
  {
    title: "5. Cancellation Policy",
    content: null,
    list: [
      "Monthly Plans: Cancel anytime. Service continues until the end of the current billing cycle. No partial-month refunds.",
      "Annual Plans: Cancel anytime. If within 90 days, receive a pro-rated refund. After 90 days, service continues until the end of the annual term.",
      "Self-Hosted Licenses: Perpetual licenses are non-cancellable. Annual support and update subscriptions can be cancelled at renewal.",
    ],
  },
  {
    title: "6. Plan Changes",
    content: null,
    list: [
      "Upgrades: Pro-rated billing — you pay only the difference for the remaining period",
      "Downgrades: Applied at the next billing cycle. No refund for the current period difference.",
      "User Count Changes: Added users billed immediately (pro-rated). Removed users reflected at next billing cycle.",
    ],
  },
  {
    title: "7. Free Trial",
    content: `TeamChatX offers a free trial period. No payment information is required to start a trial. You will not be charged unless you explicitly choose a paid plan after the trial ends.`,
  },
  {
    title: "8. Dispute Resolution",
    content: `If you disagree with a refund decision, please contact us at billing@teamchatx.com with additional details. We will review your case within 10 business days and provide a final resolution.`,
  },
  {
    title: "9. Changes to This Policy",
    content: `We may update this refund policy. Changes will be communicated via email to billing contacts. The policy in effect at the time of your purchase applies to that transaction.`,
  },
];

export default function RefundPolicy() {
  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <section style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "#fff", padding: "80px 0 60px", textAlign: "center" }}>
        <div className="container">
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: 12 }}>Refund Policy</h1>
          <p style={{ fontSize: "1rem", color: "#94a3b8" }}>30-Day Money-Back Guarantee &middot; Last updated: {lastUpdated}</p>
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
            Need help with billing? <Link to="/contact" style={{ color: "#0162c4", fontWeight: 600 }}>Contact us</Link> or email billing@teamchatx.com.
          </p>
        </div>
      </section>
    </div>
  );
}
