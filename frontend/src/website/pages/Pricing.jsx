import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PriceTableComponent from "../components/PriceTableComponent";
import { useSiteBranding } from "../../contexts/SiteBrandingContext.jsx";

const TRUST_LOGOS = [
  { label: "AES-256-GCM", icon: "\uD83D\uDD12" },
  { label: "SOC 2 Ready", icon: "\u2705" },
  { label: "GDPR Compliant", icon: "\uD83C\uDDEA\uD83C\uDDFA" },
  { label: "99.9% Uptime", icon: "\u26A1" },
  { label: "24/7 Support", icon: "\uD83D\uDC9A" },
];

const Pricing = () => {
  const { brandName } = useSiteBranding();
  const [openFaq, setOpenFaq] = useState(0);

  const FAQS = useMemo(
    () => [
      {
        q: "Can I change plans anytime?",
        a: "Yes. Upgrade or downgrade whenever you like — pro-rated automatically. No long-term contracts or hidden fees.",
      },
      {
        q: "Is there a free trial?",
        a: "Every paid plan comes with a 14-day free trial. No credit card required to start. Cancel anytime, no questions asked.",
      },
      {
        q: "What payment methods do you accept?",
        a: "All major credit cards, debit cards, and UPI through Stripe. Enterprise plans also support invoicing and bank transfer.",
      },
      {
        q: "Do you offer a money-back guarantee?",
        a: `Yes — 30 days. If ${brandName} doesn't fit your team, we'll refund every paisa, no questions asked.`,
      },
      {
        q: `Can I self-host ${brandName}?`,
        a: "Absolutely. Self-hosted deployment is included on the Enterprise plan. You get the full source bundle, deployment scripts, and white-glove setup support.",
      },
      {
        q: "How does per-user billing work?",
        a: "You're billed only for active seats. Add or remove users mid-cycle and your next invoice is automatically pro-rated.",
      },
    ],
    [brandName]
  );

  return (
    <div className="pricing-page" style={{ fontFamily: "'Manrope', sans-serif", background: "#fafbff" }}>
      <style>{`
        @keyframes pricingFadeIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pricing-faq-item {
          animation: pricingFadeIn 0.4s ease both;
        }
        .pricing-trust-badge {
          transition: transform 0.2s ease, background 0.2s ease;
        }
        .pricing-trust-badge:hover {
          transform: translateY(-2px);
          background: rgba(255,255,255,0.18) !important;
        }
      `}</style>

      {/* ─── Hero ────────────────────────────────────────────── */}
      <section
        style={{
          background: "linear-gradient(135deg, #0a1628 0%, #0d2137 40%, #0f3460 100%)",
          color: "#fff",
          padding: "90px 0 70px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative blobs */}
        <div style={{ position: "absolute", top: -150, right: -100, width: 540, height: 540, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: -180, left: -120, width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 70%)" }} />

        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <p
            style={{
              display: "inline-block",
              background: "rgba(99,102,241,0.2)",
              border: "1px solid rgba(99,102,241,0.4)",
              borderRadius: 999,
              padding: "6px 18px",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.5,
              marginBottom: 22,
              color: "#a5b4fc",
              textTransform: "uppercase",
            }}
          >
            Simple, transparent pricing
          </p>
          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 56px)",
              fontWeight: 800,
              lineHeight: 1.1,
              marginBottom: 18,
              letterSpacing: "-0.02em",
            }}
          >
            Pick the plan that <br />
            <span
              style={{
                background: "linear-gradient(135deg, #6366f1, #ec4899)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              fits your team
            </span>
          </h1>
          <p
            style={{
              fontSize: 18,
              color: "#94a3b8",
              maxWidth: 600,
              margin: "0 auto 36px",
              lineHeight: 1.6,
            }}
          >
            Start free for 14 days. No credit card required. Cancel anytime,
            keep all your data. Switch plans whenever your team grows.
          </p>

          {/* Trust signals */}
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "center",
              maxWidth: 720,
              margin: "0 auto",
            }}
          >
            {TRUST_LOGOS.map((t) => (
              <div
                key={t.label}
                className="pricing-trust-badge"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 999,
                  padding: "8px 16px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#cbd5e1",
                  backdropFilter: "blur(8px)",
                }}
              >
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                <span>{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing Cards ───────────────────────────────────── */}
      <PriceTableComponent />

      {/* ─── Money-Back Guarantee ────────────────────────────── */}
      <section style={{ padding: "30px 0 60px", background: "#fafbff" }}>
        <div className="container">
          <div
            style={{
              maxWidth: 760,
              margin: "0 auto",
              background: "linear-gradient(135deg, #fff, #f8fafc)",
              border: "1.5px solid #e2e8f0",
              borderRadius: 18,
              padding: "28px 32px",
              display: "flex",
              alignItems: "center",
              gap: 24,
              flexWrap: "wrap",
              boxShadow: "0 8px 24px -12px rgba(15,23,42,0.08)",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: "linear-gradient(135deg, #10b981, #059669)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                flexShrink: 0,
                boxShadow: "0 8px 18px -6px rgba(16,185,129,0.45)",
              }}
            >
              {"\uD83D\uDEE1\uFE0F"}
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
                30-day money-back guarantee
              </h3>
              <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, margin: 0 }}>
                Try {brandName} risk-free. If it doesn't fit your team in the first 30 days, we'll refund every paisa — no forms, no awkward calls.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────────── */}
      <section style={{ padding: "60px 0 90px", background: "#fff" }}>
        <div className="container" style={{ maxWidth: 820 }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p
              style={{
                display: "inline-block",
                background: "#eef2ff",
                color: "#4f46e5",
                borderRadius: 999,
                padding: "5px 14px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.2,
                marginBottom: 14,
                textTransform: "uppercase",
              }}
            >
              FAQ
            </p>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>
              Questions, answered
            </h2>
            <p style={{ fontSize: 15, color: "#64748b" }}>
              Everything you need to know before you sign up.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {FAQS.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={i}
                  className="pricing-faq-item"
                  style={{
                    background: "#fff",
                    border: isOpen ? "1.5px solid #6366f1" : "1.5px solid #e2e8f0",
                    borderRadius: 14,
                    overflow: "hidden",
                    transition: "all 0.2s ease",
                    boxShadow: isOpen ? "0 8px 24px -12px rgba(99,102,241,0.25)" : "none",
                    animationDelay: `${i * 0.05}s`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : i)}
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      padding: "18px 22px",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                      {faq.q}
                    </span>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: isOpen ? "#6366f1" : "#f1f5f9",
                        color: isOpen ? "#fff" : "#64748b",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        fontWeight: 700,
                        flexShrink: 0,
                        transition: "all 0.2s",
                        transform: isOpen ? "rotate(45deg)" : "rotate(0)",
                      }}
                    >
                      +
                    </span>
                  </button>
                  {isOpen && (
                    <div
                      style={{
                        padding: "0 22px 20px",
                        fontSize: 14,
                        color: "#475569",
                        lineHeight: 1.65,
                        animation: "pricingFadeIn 0.25s ease both",
                      }}
                    >
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ──────────────────────────────────────── */}
      <section
        style={{
          background: "linear-gradient(135deg, #0a1628, #0f3460)",
          padding: "80px 0",
          textAlign: "center",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 60%)",
          }}
        />
        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <h2
            style={{
              fontSize: "clamp(26px, 4vw, 42px)",
              fontWeight: 800,
              marginBottom: 16,
              lineHeight: 1.2,
            }}
          >
            Ready to give your team a better workspace?
          </h2>
          <p style={{ fontSize: 17, color: "#94a3b8", maxWidth: 540, margin: "0 auto 32px", lineHeight: 1.6 }}>
            Start your free 14-day trial. No credit card required. Be up and running in 2 minutes.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              to="/auth/register"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff",
                padding: "16px 36px",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 16,
                textDecoration: "none",
                boxShadow: "0 12px 32px -8px rgba(99,102,241,0.5)",
              }}
            >
              Start Free Trial
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              to="/compare"
              style={{
                display: "inline-block",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
                padding: "16px 36px",
                borderRadius: 12,
                fontWeight: 600,
                fontSize: 16,
                textDecoration: "none",
              }}
            >
              Compare Plans
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Pricing;
