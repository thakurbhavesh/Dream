import React from "react";
import { Link } from "react-router-dom";

const benefits = [
  { title: "Revenue Sharing", desc: "Earn competitive commissions on every customer you refer. Recurring revenue for recurring subscriptions.", icon: "💰" },
  { title: "Sales & Marketing Support", desc: "Access co-branded materials, product demos, and dedicated partner manager support.", icon: "📊" },
  { title: "Priority Technical Support", desc: "Get priority access to our engineering team for deployment assistance and custom integrations.", icon: "🛠️" },
  { title: "Exclusive Pricing", desc: "Offer your clients special partner pricing that's not available through direct channels.", icon: "🏷️" },
  { title: "Training & Certification", desc: "Comprehensive product training and official TeamChatX partner certification.", icon: "🎓" },
  { title: "Deal Registration", desc: "Register your deals for pipeline protection and enhanced support during the sales cycle.", icon: "🤝" },
];

const partnerTypes = [
  { title: "Reseller Partner", desc: "Purchase TeamChatX licenses at discounted rates and resell to your clients with full margin control.", best: "IT companies, system integrators, managed service providers" },
  { title: "Referral Partner", desc: "Refer qualified leads and earn a commission on every successful conversion. No technical involvement required.", best: "Consultants, agencies, industry influencers" },
  { title: "Technology Partner", desc: "Integrate your product with TeamChatX to offer joint solutions. Co-market to combined audiences.", best: "SaaS companies, productivity tool vendors, security providers" },
];

export default function ChannelPartner() {
  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      {/* Hero */}
      <section style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "#fff", padding: "80px 0 60px", textAlign: "center" }}>
        <div className="container">
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: 12 }}>Channel Partner Program</h1>
          <p style={{ fontSize: "1.1rem", color: "#94a3b8", maxWidth: 600, margin: "0 auto 28px" }}>
            Grow your business by partnering with TeamChatX. Help enterprises adopt secure, self-hosted communication — and earn while doing it.
          </p>
          <Link to="/contact" style={{ display: "inline-block", background: "#0162c4", color: "#fff", padding: "12px 32px", borderRadius: 8, fontWeight: 600, textDecoration: "none" }}>
            Apply to Partner Program
          </Link>
        </div>
      </section>

      {/* Partner Types */}
      <section className="container" style={{ padding: "60px 15px" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 32, color: "#0f172a", textAlign: "center" }}>Choose Your Partnership</h2>
        <div className="row g-4">
          {partnerTypes.map((pt) => (
            <div key={pt.title} className="col-lg-4">
              <div style={{ background: "#fff", borderRadius: 12, padding: 28, border: "1px solid #e2e8f0", height: "100%" }}>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>{pt.title}</h3>
                <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>{pt.desc}</p>
                <p style={{ color: "#64748b", fontSize: 13 }}><strong>Best for:</strong> {pt.best}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section style={{ background: "#fff", padding: "60px 0" }}>
        <div className="container">
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 32, color: "#0f172a", textAlign: "center" }}>Partner Benefits</h2>
          <div className="row g-4">
            {benefits.map((b) => (
              <div key={b.title} className="col-lg-4 col-md-6">
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 28 }}>{b.icon}</span>
                  <div>
                    <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{b.title}</h4>
                    <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.5, margin: 0 }}>{b.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "#0f172a", color: "#fff", padding: "48px 0", textAlign: "center" }}>
        <div className="container">
          <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Ready to Partner?</h3>
          <p style={{ color: "#94a3b8", marginBottom: 24, maxWidth: 500, margin: "0 auto 24px" }}>
            Get in touch with our partnerships team. We'll walk you through the program details and get you set up.
          </p>
          <Link to="/contact" style={{ display: "inline-block", background: "#0162c4", color: "#fff", padding: "12px 32px", borderRadius: 8, fontWeight: 600, textDecoration: "none" }}>
            Contact Us
          </Link>
        </div>
      </section>
    </div>
  );
}
