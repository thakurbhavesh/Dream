import React, { useEffect, useMemo, useState } from "react";
import { PiCheckCircle, PiUser } from "react-icons/pi";
import { Link } from "react-router-dom";
import { Alert, CircularProgress } from "@mui/material";
import AntSwitch from "../../components/AntSwitch";
import { API_BASE_URL } from "../../config/apiBaseUrl";

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
  `Up to ${Number(plan?.max_users || 0) > 0 ? plan.max_users : "Custom"} users`,
  formatStorageLabel(plan?.max_storage_mb),
  `Billing cycle: every ${Number(plan?.interval_days || 30)} days`,
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

const PriceTableComponent = () => {
  const [billingType, setBillingType] = useState("Monthly");
  const [plans, setPlans] = useState([]);
  const [planFeatures, setPlanFeatures] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Fetch plans
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

        const rows = Array.isArray(payload?.data?.rows)
          ? payload.data.rows
          : [];

        const normalized = normalizePlans(rows);

        if (!ignore) {
          setPlans(normalized);
        }

        // fetch features for each plan
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

          const rows = Array.isArray(data?.data?.rows)
            ? data.data.rows
            : [];

          featureMap[plan.plan_id] = rows.map((f) => f.feature_name);
        }

        if (!ignore) {
          setPlanFeatures(featureMap);
        }
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
    const candidates = [...plans].filter(
      (plan) => Number(plan?.price || 0) > 0
    );
    if (!candidates.length) return null;
    return candidates[Math.floor(candidates.length / 2)]?.plan_id || null;
  }, [plans]);

  return (
    <section className="price-table-container ">
      <div className="container ">

        {/* Billing Toggle */}
        <div className="d-flex justify-content-center align-items-center gap-2 my-5">
          <span>Billed Monthly</span>
          <AntSwitch
            checked={billingType === "Yearly"}
            onChange={() =>
              setBillingType(
                billingType === "Monthly" ? "Yearly" : "Monthly"
              )
            }
          />
          <span>Yearly</span>
        </div>

        {loading && (
          <div className="d-flex justify-content-center my-3">
            <CircularProgress size={24} />
          </div>
        )}

        {loadError && (
          <div className="mb-3">
            <Alert severity="warning">{loadError}</Alert>
          </div>
        )}

        {!loading && !loadError && plans.length === 0 && (
          <div className="mb-3">
            <Alert severity="info">
              No active plans available right now.
            </Alert>
          </div>
        )}

        {/* Pricing Table */}
        <div className="row gy-5 gx-4 mx-md-4">
          {plans.map((plan) => {

            const features =
              planFeatures[plan.plan_id]?.length > 0
                ? planFeatures[plan.plan_id]
                : plan.perks;

            return (
              <div className="col-lg-3 col-md-6" key={plan.plan_id}>
                <div
                  className={`pricing-card ${
                    plan.plan_id === mostPopularPlanId
                      ? "most-popular"
                      : ""
                  }`}
                  style={{
                    border: "1px solid #e0e0e0",
                    borderRadius: "8px",
                    boxShadow:
                      "0 2px 4px rgba(0, 0, 0, 0.1)",
                    backgroundColor: "#ffffff",
                  }}
                >
                  {plan.plan_id === mostPopularPlanId && (
                    <div className="most-popular-label">
                      MOST POPULAR
                    </div>
                  )}

                  <div className="card-body">
                    <h2 className="card-title ">
                      {plan.plan_name || "Plan"}
                    </h2>

                    <p
                      className="card-subtitle text-muted"
                      style={{
                        fontSize: "0.9rem",
                        color: "#757575",
                      }}
                    >
                      {`Best for ${
                        Number(plan?.max_users || 0) > 0
                          ? `up to ${plan.max_users} users`
                          : "teams"
                      }`}
                    </p>

                    <h2 className="price mt-3">
                      <span className="currency-symbol">
                        {formatCurrencySymbol(
                          plan?.default_currency
                        )}
                      </span>

                      {billingType === "Monthly"
                        ? Number(plan?.price || 0).toFixed(0)
                        : (
                            Number(plan?.price || 0) * 12
                          ).toFixed(0)}

                      <small className=" ms-1">
                        <PiUser />/
                        {billingType === "Monthly"
                          ? "mo"
                          : "yr"}
                      </small>
                    </h2>

                    <p
                      className="text-muted"
                      style={{
                        fontSize: "0.9rem",
                        color: "#757575",
                      }}
                    >
                      {Number(plan?.price || 0) === 0
                        ? `Professional plan • per user pricing • billed every ${
                            Number(
                              plan?.interval_days || 30
                            )
                          } days`
                        : `Professional plan • per user pricing • billed every ${
                            Number(
                              plan?.interval_days || 30
                            )
                          } days`}
                    </p>

                    <Link
                      to={
                        Number(plan?.price || 0) === 0
                          ? "/auth/register"
                          : "/auth/register"
                      }
                      className={` mt-3 ${
                        Number(plan?.price || 0) === 0
                          ? "main-btn"
                          : "main-btn"
                      }`}
                    >
                      {Number(plan?.price || 0) === 0
                        ? "Sign Up"
                        : "Sign Up"}
                    </Link>
                  </div>

                  <hr
                    style={{
                      margin: "20px 0",
                      border: "1px solid #d4d4d7",
                    }}
                  />

                  <div className="card-footer">
                    <p
                      style={{
                        marginBottom: "20px",
                        textAlign: "start",
                        fontSize: "0.75rem",
                        fontWeight: 400,
                      }}
                    >
                      Key features:
                    </p>

                    <ul className="list-unstyled text-start">
                      {features.map((perk, i) => (
                        <li
                          key={i}
                          className="d-flex justify-content-start align-items-start gap-2 mb-4"
                          style={{
                            fontSize: "0.9rem",
                            color: "#000",
                          }}
                        >
                          <PiCheckCircle
                            size={20}
                            color="#4CAF50"
                          />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PriceTableComponent;