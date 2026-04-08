import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, CircularProgress } from "@mui/material";
import { API_BASE_URL } from "../../config/apiBaseUrl";

const YEARLY_DISCOUNT = 0.2; // 20% off when paid yearly

const formatCurrencySymbol = (currency) => {
  const normalized = String(currency || "USD").toUpperCase();
  if (normalized === "INR") return "\u20B9";
  if (normalized === "EUR") return "\u20AC";
  if (normalized === "GBP") return "\u00A3";
  return "$";
};

const formatStorageLabel = (mb) => {
  const value = Number(mb || 0);
  if (!Number.isFinite(value) || value <= 0) return "Storage as per plan";
  const gb = value / 1024;
  if (gb < 1) return `${value} MB storage`;
  if (gb < 1024) return `${Math.round(gb)} GB storage`;
  return `${(gb / 1024).toFixed(1)} TB storage`;
};

const mapPlanPerks = (plan) => [
  `Up to ${Number(plan?.max_users || 0) > 0 ? plan.max_users : "unlimited"} users`,
  formatStorageLabel(plan?.max_storage_mb),
  `Billing every ${Number(plan?.interval_days || 30)} days`,
];

const normalizePlans = (rows = []) =>
  rows
    .filter((row) => String(row?.status || "").toLowerCase() !== "inactive")
    .map((row) => ({
      ...row,
      perks:
        Array.isArray(row?.perks) && row.perks.length
          ? row.perks
          : mapPlanPerks(row),
    }))
    .sort((a, b) => Number(a?.price || 0) - Number(b?.price || 0));

// Tagline per plan tier
const getPlanTagline = (plan, index, total) => {
  const price = Number(plan?.price || 0);
  if (price === 0) return "For trying things out";
  if (index === 0) return "For solo founders & small teams";
  if (index === total - 1) return "For organizations at scale";
  return "Most teams start here";
};

const Check = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="11" fill="#dcfce7" />
    <path d="M7 12.5l3 3 7-7" stroke="#16a34a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PriceTableComponent = () => {
  const [billingType, setBillingType] = useState("Yearly"); // default Yearly to highlight savings
  const [plans, setPlans] = useState([]);
  const [planFeatures, setPlanFeatures] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let ignore = false;

    const loadPlans = async () => {
      if (!API_BASE_URL) return;

      setLoading(true);
      setLoadError("");

      try {
        const response = await fetch(`${API_BASE_URL}/plans?limit=50&offset=0`, {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "include",
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.message || "Unable to load plans");
        }

        const rows = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
        const normalized = normalizePlans(rows);

        if (!ignore) setPlans(normalized);

        const featureMap = {};
        for (const plan of normalized) {
          const res = await fetch(
            `${API_BASE_URL}/plan-features?plan_id=${plan.plan_id}&limit=100&offset=0`,
            {
              method: "GET",
              headers: { Accept: "application/json" },
              credentials: "include",
            }
          );
          const data = await res.json().catch(() => ({}));
          const featRows = Array.isArray(data?.data?.rows) ? data.data.rows : [];
          featureMap[plan.plan_id] = featRows.map((f) => f.feature_name);
        }

        if (!ignore) setPlanFeatures(featureMap);
      } catch (error) {
        if (!ignore) {
          setLoadError(error?.message || "Unable to load plans right now.");
          setPlans([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadPlans();
    return () => {
      ignore = true;
    };
  }, []);

  const mostPopularPlanId = useMemo(() => {
    const candidates = [...plans].filter((plan) => Number(plan?.price || 0) > 0);
    if (!candidates.length) return null;
    return candidates[Math.floor(candidates.length / 2)]?.plan_id || null;
  }, [plans]);

  const isYearly = billingType === "Yearly";

  const getDisplayPrice = (plan) => {
    const monthly = Number(plan?.price || 0);
    if (monthly === 0) return { current: 0, original: 0, savings: 0 };
    if (isYearly) {
      const yearlyTotal = monthly * 12 * (1 - YEARLY_DISCOUNT);
      const perMonth = yearlyTotal / 12;
      return {
        current: Math.round(perMonth),
        original: monthly,
        savings: Math.round(monthly * 12 - yearlyTotal),
      };
    }
    return { current: monthly, original: 0, savings: 0 };
  };

  return (
    <section
      className="price-table-container"
      style={{ padding: "60px 0 30px", background: "#fafbff" }}
    >
      <style>{`
        @keyframes priceCardFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tcx-price-card {
          animation: priceCardFadeIn 0.5s ease both;
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .tcx-price-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 40px -16px rgba(15,23,42,0.18);
        }
        .tcx-price-card.popular {
          transform: scale(1.03);
        }
        .tcx-price-card.popular:hover {
          transform: scale(1.03) translateY(-6px);
        }
        .tcx-billing-toggle {
          display: inline-flex;
          background: #fff;
          border: 1.5px solid #e2e8f0;
          border-radius: 999px;
          padding: 4px;
          position: relative;
          gap: 0;
          box-shadow: 0 2px 8px rgba(15,23,42,0.04);
        }
        .tcx-billing-toggle button {
          position: relative;
          padding: 10px 24px;
          background: transparent;
          border: none;
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          border-radius: 999px;
          transition: color 0.2s;
          z-index: 1;
        }
        .tcx-billing-toggle button.active {
          color: #fff;
        }
        .tcx-billing-toggle .slider {
          position: absolute;
          top: 4px;
          bottom: 4px;
          width: calc(50% - 4px);
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 999px;
          transition: transform 0.3s ease;
          box-shadow: 0 4px 12px -2px rgba(99,102,241,0.5);
          z-index: 0;
        }
        .tcx-billing-toggle .slider.yearly {
          transform: translateX(100%);
        }
      `}</style>

      <div className="container">
        {/* ─── Billing Toggle ─────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 50 }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <div className="tcx-billing-toggle">
              <span className={`slider ${isYearly ? "yearly" : ""}`} />
              <button
                type="button"
                className={!isYearly ? "active" : ""}
                onClick={() => setBillingType("Monthly")}
              >
                Monthly
              </button>
              <button
                type="button"
                className={isYearly ? "active" : ""}
                onClick={() => setBillingType("Yearly")}
              >
                Yearly
              </button>
            </div>
            {/* Save badge */}
            <span
              style={{
                position: "absolute",
                top: -14,
                right: -42,
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 800,
                padding: "4px 10px",
                borderRadius: 999,
                whiteSpace: "nowrap",
                letterSpacing: 0.5,
                boxShadow: "0 4px 12px -2px rgba(16,185,129,0.5)",
                transform: "rotate(8deg)",
              }}
            >
              SAVE 20%
            </span>
          </div>
        </div>

        {loading && (
          <div className="d-flex justify-content-center my-4">
            <CircularProgress size={32} />
          </div>
        )}

        {loadError && (
          <div className="mb-3" style={{ maxWidth: 600, margin: "0 auto" }}>
            <Alert severity="warning">{loadError}</Alert>
          </div>
        )}

        {!loading && !loadError && plans.length === 0 && (
          <div className="mb-3" style={{ maxWidth: 600, margin: "0 auto" }}>
            <Alert severity="info">No active plans available right now.</Alert>
          </div>
        )}

        {/* ─── Pricing Grid ───────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 24,
            maxWidth: 1200,
            margin: "0 auto",
            alignItems: "stretch",
          }}
        >
          {plans.map((plan, index) => {
            const features =
              planFeatures[plan.plan_id]?.length > 0
                ? planFeatures[plan.plan_id]
                : plan.perks;

            const isPopular = plan.plan_id === mostPopularPlanId;
            const isFree = Number(plan?.price || 0) === 0;
            const { current, original, savings } = getDisplayPrice(plan);
            const symbol = formatCurrencySymbol(plan?.default_currency);

            return (
              <div
                key={plan.plan_id}
                className={`tcx-price-card ${isPopular ? "popular" : ""}`}
                style={{
                  background: "#fff",
                  borderRadius: 20,
                  padding: 32,
                  position: "relative",
                  border: isPopular ? "none" : "1.5px solid #e2e8f0",
                  boxShadow: isPopular
                    ? "0 20px 50px -16px rgba(99,102,241,0.4)"
                    : "0 4px 12px -4px rgba(15,23,42,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  animationDelay: `${index * 0.1}s`,
                  ...(isPopular
                    ? {
                        backgroundImage:
                          "linear-gradient(#fff, #fff), linear-gradient(135deg, #6366f1, #8b5cf6)",
                        backgroundOrigin: "border-box",
                        backgroundClip: "padding-box, border-box",
                        border: "2px solid transparent",
                      }
                    : {}),
                }}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <div
                    style={{
                      position: "absolute",
                      top: -14,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "6px 14px",
                      borderRadius: 999,
                      letterSpacing: 1,
                      boxShadow: "0 6px 16px -4px rgba(99,102,241,0.5)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {"\u2B50 MOST POPULAR"}
                  </div>
                )}

                {/* Plan Name + Tagline */}
                <div style={{ marginBottom: 24 }}>
                  <h3
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: "#0f172a",
                      marginBottom: 6,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {plan.plan_name || "Plan"}
                  </h3>
                  <p style={{ fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.5 }}>
                    {getPlanTagline(plan, index, plans.length)}
                  </p>
                </div>

                {/* Price */}
                <div style={{ marginBottom: 8 }}>
                  {isFree ? (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span
                        style={{
                          fontSize: 48,
                          fontWeight: 800,
                          color: "#0f172a",
                          lineHeight: 1,
                          letterSpacing: "-0.03em",
                        }}
                      >
                        Free
                      </span>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 22, fontWeight: 700, color: "#475569" }}>
                          {symbol}
                        </span>
                        <span
                          style={{
                            fontSize: 48,
                            fontWeight: 800,
                            color: "#0f172a",
                            lineHeight: 1,
                            letterSpacing: "-0.03em",
                          }}
                        >
                          {current}
                        </span>
                        <span style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>
                          /user/mo
                        </span>
                      </div>
                      {isYearly && original > 0 && (
                        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: 13,
                              color: "#94a3b8",
                              textDecoration: "line-through",
                            }}
                          >
                            {symbol}
                            {original}/mo
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#16a34a",
                              background: "#dcfce7",
                              padding: "2px 8px",
                              borderRadius: 999,
                            }}
                          >
                            Save {symbol}{savings}/yr
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <p
                  style={{
                    fontSize: 12,
                    color: "#94a3b8",
                    marginBottom: 24,
                    lineHeight: 1.5,
                  }}
                >
                  {isYearly
                    ? `Billed annually \u00B7 ${symbol}${current * 12}/yr per user`
                    : `Billed monthly \u00B7 cancel anytime`}
                </p>

                {/* CTA */}
                <Link
                  to="/auth/register"
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "13px 20px",
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 14,
                    textDecoration: "none",
                    marginBottom: 26,
                    transition: "all 0.2s ease",
                    ...(isPopular
                      ? {
                          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                          color: "#fff",
                          boxShadow: "0 8px 20px -6px rgba(99,102,241,0.5)",
                        }
                      : isFree
                      ? {
                          background: "#0f172a",
                          color: "#fff",
                        }
                      : {
                          background: "#fff",
                          color: "#0f172a",
                          border: "1.5px solid #e2e8f0",
                        }),
                  }}
                >
                  {isFree ? "Get Started Free" : "Start 14-day Trial"}
                </Link>

                {/* Divider */}
                <div
                  style={{
                    height: 1,
                    background: "linear-gradient(90deg, transparent, #e2e8f0, transparent)",
                    marginBottom: 22,
                  }}
                />

                {/* Features */}
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#64748b",
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      marginBottom: 14,
                    }}
                  >
                    {isPopular ? "Everything in lower plans, plus:" : "What's included:"}
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {features.map((perk, i) => (
                      <li
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          marginBottom: 12,
                          fontSize: 13.5,
                          color: "#334155",
                          lineHeight: 1.5,
                        }}
                      >
                        <Check />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footnote */}
        {plans.length > 0 && (
          <p
            style={{
              textAlign: "center",
              fontSize: 13,
              color: "#94a3b8",
              marginTop: 36,
              maxWidth: 600,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            All plans include unlimited messages, end-to-end encryption, and 24/7 email support.
            Need a custom plan?{" "}
            <Link
              to="/contact-us"
              style={{ color: "#6366f1", fontWeight: 600, textDecoration: "none" }}
            >
              {"Contact sales \u2192"}
            </Link>
          </p>
        )}
      </div>
    </section>
  );
};

export default PriceTableComponent;
