import React, { useCallback, useEffect, useMemo, useState } from "react";
import ChatDemoBox from "../components/ChatDemoBox.jsx";
import { Alert, CircularProgress } from "@mui/material";
import { API_BASE_URL } from "../../config/apiBaseUrl";

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

const normalizeFeatureSections = (catalogRows = []) =>
  catalogRows
    .filter((category) => String(category?.status || "active").toLowerCase() !== "inactive")
    .map((category) => ({
      feature_category_id: category.feature_category_id,
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
  const [featureSections, setFeatureSections] = useState([]);
  const [activeTab, setActiveTab] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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

  const sectionIds = useMemo(() => featureSections.map((section) => section.id), [featureSections]);

  const handleScroll = useCallback(() => {
    sectionIds.forEach((sectionId) => {
      const sectionElement = document.getElementById(sectionId);
      if (
        sectionElement &&
        sectionElement.getBoundingClientRect().top <= 150 &&
        sectionElement.getBoundingClientRect().bottom >= 150
      ) {
        setActiveTab(sectionId);
      }
    });
  }, [sectionIds]);

  const scrollToSection = (id) => {
    const section = document.getElementById(id);
    if (section) {
      window.scrollTo({
        top: section.offsetTop - 80, // Adjust offset for navbar height
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

  return (
    <div className="features-page">
      {/* Navigation Tabs */}
      <nav className="sticky-top bg-white  py-3">
        <div className="container">
          <ul className="nav nav-tabs justify-content-center">
            {featureSections.map((section) => (
              <li className="nav-item" key={section.id}>
                <button
                  className={`nav-link ${
                    activeTab === section.id ? "active" : ""
                  }`}
                  onClick={() => scrollToSection(section.id)}
                >
                  {section.title}
                  {section.comingSoon && (
                    <span
                      className="badge ms-2"
                      style={{
                        backgroundColor: "#f59e0b",
                        color: "#fff",
                        fontSize: "0.65rem",
                        verticalAlign: "middle",
                      }}
                    >
                      Coming Soon
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      {isLoading ? (
        <div className="text-center my-4">
          <CircularProgress size={28} />
        </div>
      ) : null}
      {errorMessage ? (
        <div className="container mt-3">
          <Alert severity="warning">{errorMessage}</Alert>
        </div>
      ) : null}
      {!isLoading && !errorMessage && featureSections.length === 0 ? (
        <div className="container mt-3">
          <Alert severity="info">No feature categories/items available right now.</Alert>
        </div>
      ) : null}

      {/* Feature Sections */}
      <div className="container mt-4">
        {featureSections.map((section) => (
          <div key={section.id} id={section.id} className="mb-5">
            <h2 className="section-title d-flex align-items-center flex-wrap">
              <span>{section.title}</span>
              {section.comingSoon && (
                <span
                  className="badge ms-3"
                  style={{
                    backgroundColor: "#f59e0b",
                    color: "#fff",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "0.35rem 0.7rem",
                    borderRadius: "999px",
                    verticalAlign: "middle",
                  }}
                >
                  Coming Soon
                </span>
              )}
            </h2>
            {section.comingSoon && (
              <p className="text-muted mb-3" style={{ fontStyle: "italic" }}>
                These features are under active development and will be available in an upcoming release.
              </p>
            )}
            <div
              className="features-list border rounded-4 p-4"
              style={section.comingSoon ? { opacity: 0.75, backgroundColor: "#fffbeb" } : undefined}
            >
              {section.features.map((feature) => (
                <div
                  key={feature.feature_item_id}
                  className="feature-item d-flex align-items-start mb-4"
                >
                  <div className="feature-number bg-light text-center rounded-circle me-3">
                    <span>{feature.feature_item_id}</span>
                  </div>
                  <div>
                    <h5 className="feature-title mb-2">{feature.title}</h5>
                    <p className="feature-description mb-0">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <ChatDemoBox/>
    </div>
  );
};

export default Features;

