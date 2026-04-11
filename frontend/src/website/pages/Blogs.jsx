import React from "react";
import { Link } from "react-router-dom";

const blogPosts = [
  {
    id: 1,
    title: "Why Self-Hosted Messaging Is the Future of Enterprise Communication",
    excerpt: "Cloud solutions are convenient, but self-hosted messaging gives enterprises full control over data sovereignty, compliance, and security. Learn why more companies are making the switch.",
    category: "Security",
    date: "Apr 8, 2026",
    readTime: "6 min read",
  },
  {
    id: 2,
    title: "10 Features Every Team Chat App Must Have in 2026",
    excerpt: "From AI-powered smart compose to end-to-end encryption — here are the non-negotiable features your team communication tool should offer.",
    category: "Product",
    date: "Mar 25, 2026",
    readTime: "5 min read",
  },
  {
    id: 3,
    title: "How TeamChatX Saves 60% Compared to Slack and Microsoft Teams",
    excerpt: "We break down the real costs of team communication — licensing, hosting, storage, and hidden fees — and show how self-hosting changes the equation.",
    category: "Pricing",
    date: "Mar 12, 2026",
    readTime: "4 min read",
  },
  {
    id: 4,
    title: "Setting Up TeamChatX on Your Own Server in Under 30 Minutes",
    excerpt: "A step-by-step guide to deploying TeamChatX on your infrastructure — from server requirements to SSL configuration and first login.",
    category: "Guide",
    date: "Feb 28, 2026",
    readTime: "8 min read",
  },
  {
    id: 5,
    title: "GDPR Compliance for Team Messaging: What You Need to Know",
    excerpt: "Understanding data processing agreements, user rights, data portability, and how TeamChatX helps you stay compliant with EU regulations.",
    category: "Compliance",
    date: "Feb 15, 2026",
    readTime: "7 min read",
  },
  {
    id: 6,
    title: "AI in Business Communication: Smart Compose, Translation, and Beyond",
    excerpt: "How artificial intelligence is transforming the way teams communicate — from grammar checks to auto-translation across 14 languages.",
    category: "AI",
    date: "Feb 1, 2026",
    readTime: "5 min read",
  },
];

const categoryColors = {
  Security: "#dc2626",
  Product: "#0162c4",
  Pricing: "#059669",
  Guide: "#7c3aed",
  Compliance: "#d97706",
  AI: "#0891b2",
};

export default function Blogs() {
  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      {/* Hero */}
      <section style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "#fff", padding: "80px 0 60px", textAlign: "center" }}>
        <div className="container">
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: 12 }}>Blog</h1>
          <p style={{ fontSize: "1.1rem", color: "#94a3b8", maxWidth: 560, margin: "0 auto" }}>
            Insights on team communication, security, productivity, and product updates.
          </p>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="container" style={{ padding: "60px 15px" }}>
        <div className="row g-4">
          {blogPosts.map((post) => (
            <div key={post.id} className="col-lg-4 col-md-6">
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden", height: "100%", display: "flex", flexDirection: "column" }}>
                {/* Placeholder image area */}
                <div style={{ height: 180, background: `linear-gradient(135deg, ${categoryColors[post.category]}22, ${categoryColors[post.category]}08)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 40, opacity: 0.3 }}>
                    {post.category === "Security" ? "🔒" : post.category === "Product" ? "🚀" : post.category === "Pricing" ? "💰" : post.category === "Guide" ? "📖" : post.category === "Compliance" ? "⚖️" : "🤖"}
                  </span>
                </div>
                <div style={{ padding: 24, flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ background: `${categoryColors[post.category]}14`, color: categoryColors[post.category], padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                      {post.category}
                    </span>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>{post.date}</span>
                  </div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a", marginBottom: 8, lineHeight: 1.4 }}>{post.title}</h3>
                  <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, marginBottom: 16, flex: 1 }}>{post.excerpt}</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>{post.readTime}</span>
                    <span style={{ color: "#0162c4", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      Read More &rarr;
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Coming Soon Note */}
        <div style={{ textAlign: "center", marginTop: 48, padding: "32px 0" }}>
          <p style={{ color: "#94a3b8", fontSize: 15 }}>More articles coming soon. Stay tuned for weekly updates.</p>
        </div>
      </section>
    </div>
  );
}
