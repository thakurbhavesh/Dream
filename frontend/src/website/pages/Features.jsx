import React, { useCallback, useEffect, useMemo, useState } from "react";
import ChatDemoBox from "../components/ChatDemoBox.jsx";
import { Alert, CircularProgress } from "@mui/material";
import { API_BASE_URL } from "../../config/apiBaseUrl";
import { useSiteBranding } from "../../contexts/SiteBrandingContext.jsx";

const toSectionId = (value, fallbackId) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `feature-section-${fallbackId}`;
};

const isComingSoonCategory = (category) => {
  const key = String(category?.category_key || "").toLowerCase();
  const label = String(category?.category_label || "").toLowerCase();
  return key.endsWith("_cs") || label.includes("coming soon");
};

const stripComingSoonLabel = (label) =>
  String(label || "")
    .replace(/\s*\(coming soon\)\s*/i, "")
    .trim();

// Map category_key → emoji icon for visual variety
const CATEGORY_ICONS = {
  messaging: "\uD83D\uDCAC",
  group: "\uD83D\uDC65",
  audio_video: "\uD83C\uDFA5",
  collaboration: "\uD83E\uDD1D",
  productivity: "\u26A1",
  filters: "\uD83D\uDD0D",
  security: "\uD83D\uDD12",
  admin: "\uD83D\uDEE0\uFE0F",
  ai_features: "\u2728",
  integrations_cs: "\uD83D\uDD0C",
  automation_cs: "\uD83E\uDD16",
  mobile: "\uD83D\uDCF1",
  web_desktop: "\uD83D\uDCBB",
};

const getCategoryIcon = (key) => CATEGORY_ICONS[String(key || "").toLowerCase()] || "\u2B50";

const normalizeFeatureSections = (catalogRows = []) =>
  catalogRows
    .filter((category) => String(category?.status || "active").toLowerCase() !== "inactive")
    .map((category) => ({
      feature_category_id: category.feature_category_id,
      category_key: category.category_key,
      icon: getCategoryIcon(category.category_key),
      id: toSectionId(category.category_key || category.category_label, category.feature_category_id),
      title: stripComingSoonLabel(category.category_label || category.category_key || "Category"),
      comingSoon: isComingSoonCategory(category),
      display_order: Number(category.display_order || 0),
      features: (Array.isArray(category.items) ? category.items : [])
        .filter((item) => String(item?.status || "active").toLowerCase() !== "inactive")
        .sort((a, b) => Number(a?.display_order || 0) - Number(b?.display_order || 0))
        .map((item, index) => ({
          feature_item_id: item.feature_item_id || index + 1,
          title: String(item.title || "Feature").trim(),
          description: String(item.description || "").trim(),
        })),
    }))
    .sort((a, b) => a.display_order - b.display_order);

const Features = () => {
  const { brandName } = useSiteBranding();
  const [featureSections, setFeatureSections] = useState([]);
  const [activeTab, setActiveTab] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let ignore = false;

    const loadCatalog = async () => {
      if (!API_BASE_URL) return;
      setIsLoading(true);
      setErrorMessage("");
      try {
        const response = await fetch(`${API_BASE_URL}/product-features/catalog?status=active`, {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "include",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || "Unable to load features");
        }

        const rows = Array.isArray(payload?.data) ? payload.data : [];
        const normalized = normalizeFeatureSections(rows);
        if (!ignore) {
          setFeatureSections(normalized);
          setActiveTab(normalized[0]?.id || "");
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(error?.message || "Unable to load features right now.");
          setFeatureSections([]);
          setActiveTab("");
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    loadCatalog();
    return () => {
      ignore = true;
    };
  }, []);

  // Client-side filter
  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return featureSections;
    return featureSections
      .map((section) => ({
        ...section,
        features: section.features.filter(
          (f) =>
            f.title.toLowerCase().includes(q) ||
            f.description.toLowerCase().includes(q)
        ),
      }))
      .filter((section) => section.features.length > 0);
  }, [searchQuery, featureSections]);

  const totalFeatures = useMemo(
    () => featureSections.reduce((sum, s) => sum + s.features.length, 0),
    [featureSections]
  );
  const liveCategories = useMemo(
    () => featureSections.filter((s) => !s.comingSoon).length,
    [featureSections]
  );

  const sectionIds = useMemo(() => filteredSections.map((section) => section.id), [filteredSections]);

  const handleScroll = useCallback(() => {
    sectionIds.forEach((sectionId) => {
      const sectionElement = document.getElementById(sectionId);
      if (
        sectionElement &&
        sectionElement.getBoundingClientRect().top <= 200 &&
        sectionElement.getBoundingClientRect().bottom >= 200
      ) {
        setActiveTab(sectionId);
      }
    });
  }, [sectionIds]);

  const scrollToSection = (id) => {
    const section = document.getElementById(id);
    if (section) {
      window.scrollTo({
        top: section.offsetTop - 140,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="features-page" style={{ backgroundColor: "#fafbff" }}>
      <style>{`
        @keyframes featureFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tcx-feature-card {
          animation: featureFadeIn 0.4s ease both;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .tcx-feature-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px -10px rgba(79, 70, 229, 0.18);
          border-color: #6366f1 !important;
        }
        .tcx-tab-pill {
          transition: all 0.2s ease;
          border: 1px solid transparent !important;
          background: transparent;
        }
        .tcx-tab-pill:hover {
          background: #eef2ff;
          color: #4338ca !important;
        }
        .tcx-tab-pill.active {
          background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
          color: #fff !important;
          box-shadow: 0 6px 14px -4px rgba(99, 102, 241, 0.5);
        }
        .tcx-search-input:focus {
          outline: none;
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
        }
        .tcx-hero-stat {
          transition: transform 0.2s ease;
        }
        .tcx-hero-stat:hover { transform: scale(1.05); }
      `}</style>

      {/* ─── Hero ──────────────────────────────────────────── */}
      <section
        style={{
          background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%)",
          color: "#fff",
          padding: "4rem 1rem 5rem",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15) 0, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1) 0, transparent 50%)",
            pointerEvents: "none",
          }}
        />
        <div className="container position-relative">
          <span
            className="badge mb-3"
            style={{
              backgroundColor: "rgba(255,255,255,0.18)",
              backdropFilter: "blur(8px)",
              padding: "0.5rem 1rem",
              borderRadius: "999px",
              fontSize: "0.8rem",
              fontWeight: 600,
              letterSpacing: "0.5px",
            }}
          >
            EVERYTHING YOUR TEAM NEEDS
          </span>
          <h1
            className="fw-bold mb-3"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", lineHeight: 1.15 }}
          >
            Powerful features for modern teams
          </h1>
          <p
            className="mx-auto mb-4"
            style={{
              fontSize: "1.15rem",
              maxWidth: "640px",
              opacity: 0.92,
              lineHeight: 1.6,
            }}
          >
            Messaging, calls, AI, security, and admin controls — all in one
            workspace built to keep your team in flow.
          </p>

          {/* Stats */}
          {!isLoading && featureSections.length > 0 && (
            <div className="d-flex justify-content-center gap-4 flex-wrap mt-4">
              {[
                { value: totalFeatures, label: "Features" },
                { value: liveCategories, label: "Live Categories" },
                { value: "100%", label: "End-to-End Encrypted" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="tcx-hero-stat"
                  style={{
                    minWidth: "140px",
                    padding: "1rem 1.25rem",
                    borderRadius: "16px",
                    backgroundColor: "rgba(255,255,255,0.13)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255,255,255,0.22)",
                  }}
                >
                  <div className="fw-bold" style={{ fontSize: "1.75rem" }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: "0.8rem", opacity: 0.85, letterSpacing: "0.3px" }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── Why TeamChatX — Value Strip ──────────────────── */}
      {!isLoading && featureSections.length > 0 && (
        <section style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "48px 0" }}>
          <div className="container">
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <h2 style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 800, color: "#111827", marginBottom: 8 }}>
                More features. Lower price. Full control.
              </h2>
              <p style={{ color: "#6b7280", fontSize: "0.95rem", maxWidth: 560, margin: "0 auto" }}>
                See how {brandName} stacks up against Slack and Microsoft Teams — on features, pricing, and deployment.
              </p>
            </div>

            {/* Feature count bars */}
            <div style={{ maxWidth: 700, margin: "0 auto 32px" }}>
              {[
                { name: brandName, features: totalFeatures, price: "$3", color: "#6366f1", isUs: true },
                { name: "Slack", features: Math.round(totalFeatures * 0.58), price: "$8.75", color: "#4A154B" },
                { name: "MS Teams", features: Math.round(totalFeatures * 0.62), price: "$4", color: "#4b53bc" },
                { name: "Troop Messenger", features: Math.round(totalFeatures * 0.48), price: "$2.5", color: "#64748b" },
              ].map((c) => {
                const pct = Math.round((c.features / totalFeatures) * 100);
                return (
                  <div key={c.name} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: c.isUs ? c.color : "#374151" }}>
                        {c.isUs && "★ "}{c.name}
                      </span>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>{c.features} features</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: c.isUs ? "#16a34a" : "#374151", minWidth: 50, textAlign: "right" }}>
                          {c.price}/mo
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, background: "#f3f4f6", overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: c.isUs ? "linear-gradient(90deg, #6366f1, #8b5cf6)" : c.color,
                        opacity: c.isUs ? 1 : 0.5,
                        borderRadius: 999,
                        transition: "width 1s ease",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Key differentiators */}
            <div className="row g-3 justify-content-center" style={{ maxWidth: 900, margin: "0 auto" }}>
              {[
                { icon: "🔒", title: "Self-Hosted Option", desc: "Deploy on your servers — full data ownership, zero cloud dependency" },
                { icon: "💰", title: "Lowest Price", desc: "Starting at $3/user/mo — 65% cheaper than Slack Pro" },
                { icon: "📱", title: "Mobile + Web + Desktop", desc: "55+ mobile screens, full web app, Windows desktop — complete parity" },
                { icon: "🤖", title: "Built-in AI Suite", desc: "9 AI features included — smart compose, translate, tone adjust, call notes" },
              ].map((d) => (
                <div key={d.title} className="col-6 col-lg-3">
                  <div style={{
                    background: "#fafbff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: "18px 16px",
                    textAlign: "center",
                    height: "100%",
                  }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{d.icon}</div>
                    <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#111827", marginBottom: 4 }}>{d.title}</h4>
                    <p style={{ fontSize: "0.75rem", color: "#6b7280", margin: 0, lineHeight: 1.4 }}>{d.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{ textAlign: "center", marginTop: 28 }}>
              <a
                href="/compare"
                style={{
                  display: "inline-block",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: "#fff",
                  padding: "10px 28px",
                  borderRadius: 999,
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  textDecoration: "none",
                }}
              >
                See Full Comparison →
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ─── Sticky Search + Tabs ──────────────────────────── */}
      <div
        className="sticky-top"
        style={{
          backgroundColor: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #e5e7eb",
          padding: "1rem 0",
          marginTop: "-1.5rem",
          zIndex: 1020,
        }}
      >
        <div className="container">
          {/* Search */}
          <div className="d-flex justify-content-center mb-3">
            <div style={{ position: "relative", width: "100%", maxWidth: "480px" }}>
              <input
                type="text"
                className="tcx-search-input form-control"
                placeholder="Search features (e.g. encryption, polls, AI)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "0.75rem 1rem 0.75rem 2.75rem",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: "999px",
                  fontSize: "0.95rem",
                  backgroundColor: "#fff",
                  transition: "all 0.2s ease",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  left: "1rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "1.1rem",
                  pointerEvents: "none",
                }}
              >
                {"\uD83D\uDD0D"}
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "0.5rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "#f3f4f6",
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    color: "#6b7280",
                  }}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          {!isSearching && filteredSections.length > 0 && (
            <div
              className="d-flex justify-content-center flex-wrap gap-2"
              style={{ overflowX: "auto" }}
            >
              {filteredSections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={`tcx-tab-pill ${activeTab === section.id ? "active" : ""}`}
                  onClick={() => scrollToSection(section.id)}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "999px",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "#4b5563",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  <span>{section.icon}</span>
                  <span>{section.title}</span>
                  {section.comingSoon && (
                    <span
                      style={{
                        backgroundColor: "#f59e0b",
                        color: "#fff",
                        fontSize: "0.6rem",
                        padding: "0.15rem 0.45rem",
                        borderRadius: "999px",
                        fontWeight: 700,
                      }}
                    >
                      SOON
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="text-center my-5">
          <CircularProgress size={36} />
        </div>
      )}
      {errorMessage && (
        <div className="container mt-4">
          <Alert severity="warning">{errorMessage}</Alert>
        </div>
      )}
      {!isLoading && !errorMessage && featureSections.length === 0 && (
        <div className="container mt-4">
          <Alert severity="info">No features available right now.</Alert>
        </div>
      )}

      {/* ─── Empty Search State ────────────────────────────── */}
      {isSearching && filteredSections.length === 0 && !isLoading && (
        <div className="container text-center py-5">
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>{"\uD83D\uDD0E"}</div>
          <h4 className="fw-bold">No features match "{searchQuery}"</h4>
          <p className="text-muted">Try a different keyword or browse all categories.</p>
          <button
            className="btn"
            onClick={() => setSearchQuery("")}
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "#fff",
              padding: "0.6rem 1.5rem",
              borderRadius: "999px",
              fontWeight: 600,
              border: "none",
            }}
          >
            Clear search
          </button>
        </div>
      )}

      {/* ─── Feature Sections ──────────────────────────────── */}
      <div className="container py-5">
        {filteredSections.map((section, sectionIdx) => (
          <section key={section.id} id={section.id} className="mb-5">
            {/* Section Header */}
            <div className="d-flex align-items-center mb-4 flex-wrap" style={{ gap: "0.75rem" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "14px",
                  background: section.comingSoon
                    ? "linear-gradient(135deg, #fbbf24, #f59e0b)"
                    : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.6rem",
                  boxShadow: section.comingSoon
                    ? "0 8px 18px -6px rgba(245, 158, 11, 0.45)"
                    : "0 8px 18px -6px rgba(99, 102, 241, 0.45)",
                }}
              >
                {section.icon}
              </div>
              <div className="flex-grow-1">
                <h2
                  className="fw-bold mb-0 d-flex align-items-center flex-wrap"
                  style={{ fontSize: "1.75rem", color: "#111827", gap: "0.6rem" }}
                >
                  {section.title}
                  {section.comingSoon && (
                    <span
                      style={{
                        backgroundColor: "#fef3c7",
                        color: "#b45309",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "0.3rem 0.7rem",
                        borderRadius: "999px",
                        border: "1px solid #fcd34d",
                        letterSpacing: "0.5px",
                      }}
                    >
                      COMING SOON
                    </span>
                  )}
                </h2>
                <p className="text-muted mb-0" style={{ fontSize: "0.9rem" }}>
                  {section.comingSoon
                    ? "Under active development — coming in an upcoming release."
                    : `${section.features.length} feature${section.features.length === 1 ? "" : "s"} available`}
                </p>
              </div>
            </div>

            {/* Cards Grid */}
            <div
              className="row g-3"
              style={section.comingSoon ? { opacity: 0.78 } : undefined}
            >
              {section.features.map((feature, idx) => (
                <div className="col-12 col-md-6 col-lg-4" key={feature.feature_item_id}>
                  <div
                    className="tcx-feature-card h-100 p-3"
                    style={{
                      backgroundColor: "#fff",
                      border: "1.5px solid #e5e7eb",
                      borderRadius: "16px",
                      animationDelay: `${Math.min(idx, 8) * 0.04}s`,
                    }}
                  >
                    <div className="d-flex align-items-start" style={{ gap: "0.85rem" }}>
                      <div
                        style={{
                          minWidth: "38px",
                          height: "38px",
                          borderRadius: "10px",
                          background: section.comingSoon
                            ? "linear-gradient(135deg, #fef3c7, #fde68a)"
                            : "linear-gradient(135deg, #eef2ff, #ede9fe)",
                          color: section.comingSoon ? "#b45309" : "#4f46e5",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                        }}
                      >
                        {feature.feature_item_id}
                      </div>
                      <div className="flex-grow-1" style={{ minWidth: 0 }}>
                        <h5
                          className="fw-bold mb-1"
                          style={{ fontSize: "0.98rem", color: "#111827", lineHeight: 1.3 }}
                        >
                          {feature.title}
                        </h5>
                        <p
                          className="mb-0"
                          style={{
                            fontSize: "0.83rem",
                            color: "#6b7280",
                            lineHeight: 1.5,
                          }}
                        >
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <ChatDemoBox />
    </div>
  );
};

export default Features;
