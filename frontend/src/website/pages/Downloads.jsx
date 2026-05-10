import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../../config/apiBaseUrl";
import { useSiteBranding } from "../../contexts/SiteBrandingContext.jsx";

const platforms = [
  {
    name: "Windows",
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 12V6.75l7-1.02V12H3zm8-1.18V5.55l10-1.55V12H11V10.82zM3 13h7v6.27l-7-1.02V13zm8 0h10v7l-10-1.55V13z" />
      </svg>
    ),
    desc: "Windows 10 / 11 (64-bit)",
    size: "~85 MB",
    format: ".exe installer",
  },
  {
    name: "macOS",
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
    ),
    desc: "macOS 12+ (Apple Silicon & Intel)",
    size: "~92 MB",
    format: ".dmg installer",
  },
  {
    name: "Linux",
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.04 1.241.027 1.664.164a1.751 1.751 0 001.21.925c.76.19 1.69-.037 2.59-.525.898-.468 1.94-.536 2.744-.736.404-.132.764-.267.933-.6.167-.334.126-.794-.113-1.457-.088-.24-.032-.528.04-.863.067-.334.136-.603.055-.868a.456.456 0 00-.104-.164c.124-.796 0-1.64-.277-2.472-.587-1.77-1.83-3.47-2.715-4.52-.755-1.068-.98-1.93-1.05-3.02-.065-1.49 1.049-5.965-3.17-6.298A5.145 5.145 0 0012.504 0z" />
      </svg>
    ),
    desc: "Ubuntu 20.04+ / Debian / Fedora",
    size: "~78 MB",
    format: ".AppImage / .deb",
  },
];

const mobileApps = [
  {
    name: "Android",
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.523 15.341a.996.996 0 01-.998-.998.996.996 0 01.998-.998.996.996 0 01.998.998.996.996 0 01-.998.998m-11.046 0a.996.996 0 01-.998-.998.996.996 0 01.998-.998.996.996 0 01.998.998.996.996 0 01-.998.998m11.405-6.02l1.997-3.46a.416.416 0 00-.152-.567.416.416 0 00-.567.152L17.12 8.95c-1.46-.669-3.093-1.043-4.87-1.043-1.777 0-3.41.374-4.87 1.043L5.34 5.446a.416.416 0 00-.567-.152.416.416 0 00-.152.567l1.997 3.46C3.042 11.301 1 14.48 1 18.141h22c0-3.661-2.042-6.84-5.618-8.82" />
      </svg>
    ),
    desc: "Android 8.0+ (API 26)",
    stores: ["Google Play", "Direct APK"],
  },
  {
    name: "iOS",
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
    ),
    desc: "iOS 15.0+",
    stores: ["App Store"],
  },
];

// GitHub Releases is the source of truth for desktop installers — switched
// to it from a backend endpoint that didn't exist (was returning 404 on
// every page load). The latest release page works without auth and is
// updated automatically by the desktop-release CI workflow.
const RELEASES_API = "https://api.github.com/repos/thakurbhavesh/Dream/releases/latest";
const RELEASES_PAGE = "https://github.com/thakurbhavesh/Dream/releases/latest";

export default function Downloads() {
  const { brandName } = useSiteBranding();
  const [appUrl, setAppUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.assets) return;
        // Prefer the .exe asset; fall back to the release page link so
        // users still land somewhere useful even if the asset name shifts.
        const winInstaller = data.assets.find((a) => /\.exe$/i.test(a.name));
        setAppUrl(winInstaller?.browser_download_url || RELEASES_PAGE);
      })
      .catch(() => {
        // Fall back to the release page if the API is unreachable.
        if (!cancelled) setAppUrl(RELEASES_PAGE);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      {/* Hero */}
      <section style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "#fff", padding: "80px 0 60px", textAlign: "center" }}>
        <div className="container">
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: 12 }}>Download {brandName}</h1>
          <p style={{ fontSize: "1.1rem", color: "#94a3b8", maxWidth: 560, margin: "0 auto" }}>
            Available on every platform. Install once, communicate everywhere with your team.
          </p>
        </div>
      </section>

      {/* Desktop Apps */}
      <section className="container" style={{ padding: "60px 15px" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8, color: "#0f172a" }}>Desktop Apps</h2>
        <p style={{ color: "#64748b", marginBottom: 32 }}>Full-featured desktop clients with native notifications, screen sharing, and deep OS integration.</p>

        <div className="row g-4">
          {platforms.map((p) => (
            <div key={p.name} className="col-lg-4 col-md-6">
              <div style={{ background: "#fff", borderRadius: 12, padding: 32, border: "1px solid #e2e8f0", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <div style={{ color: "#0162c4", marginBottom: 16 }}>{p.icon}</div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8, color: "#0f172a" }}>{p.name}</h3>
                <p style={{ color: "#64748b", fontSize: 14, marginBottom: 4 }}>{p.desc}</p>
                <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>{p.size} &middot; {p.format}</p>
                <div style={{ marginTop: "auto" }}>
                  {p.name === "Windows" && appUrl ? (
                    <a href={appUrl} style={{ display: "inline-block", background: "#0162c4", color: "#fff", padding: "10px 28px", borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
                      Download for {p.name}
                    </a>
                  ) : (
                    <span style={{ display: "inline-block", background: "#e2e8f0", color: "#64748b", padding: "10px 28px", borderRadius: 8, fontWeight: 600, fontSize: 14 }}>
                      Coming Soon
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mobile Apps */}
      <section style={{ background: "#fff", padding: "60px 0" }}>
        <div className="container">
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8, color: "#0f172a" }}>Mobile Apps</h2>
          <p style={{ color: "#64748b", marginBottom: 32 }}>Stay connected on the go. Full feature parity with desktop — messaging, calls, admin panel, and more.</p>

          <div className="row g-4 justify-content-center">
            {mobileApps.map((m) => (
              <div key={m.name} className="col-lg-4 col-md-6">
                <div style={{ background: "#f8fafc", borderRadius: 12, padding: 32, border: "1px solid #e2e8f0", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                  <div style={{ color: "#0162c4", marginBottom: 16 }}>{m.icon}</div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8, color: "#0f172a" }}>{m.name}</h3>
                  <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>{m.desc}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: "auto" }}>
                    {m.stores.map((s) => (
                      <span key={s} style={{ background: "#e2e8f0", color: "#64748b", padding: "8px 20px", borderRadius: 8, fontWeight: 600, fontSize: 13 }}>
                        {s} — Coming Soon
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* System Requirements */}
      <section className="container" style={{ padding: "60px 15px" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 24, color: "#0f172a" }}>System Requirements</h2>
        <div className="row g-4">
          <div className="col-md-6">
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e2e8f0" }}>
              <h4 style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 16, color: "#0f172a" }}>Desktop</h4>
              <ul style={{ color: "#475569", fontSize: 14, lineHeight: 2, paddingLeft: 20 }}>
                <li>Windows 10 or later (64-bit)</li>
                <li>macOS 12 Monterey or later</li>
                <li>Ubuntu 20.04+ / Debian 11+ / Fedora 36+</li>
                <li>4 GB RAM minimum, 8 GB recommended</li>
                <li>200 MB free disk space</li>
                <li>Webcam &amp; microphone for video calls</li>
              </ul>
            </div>
          </div>
          <div className="col-md-6">
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e2e8f0" }}>
              <h4 style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 16, color: "#0f172a" }}>Mobile</h4>
              <ul style={{ color: "#475569", fontSize: 14, lineHeight: 2, paddingLeft: 20 }}>
                <li>Android 8.0 (Oreo) or later</li>
                <li>iOS 15.0 or later</li>
                <li>100 MB free storage</li>
                <li>Active internet connection</li>
                <li>Camera &amp; microphone permissions for calls</li>
                <li>Biometric hardware for fingerprint / Face ID login</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "#0f172a", color: "#fff", padding: "48px 0", textAlign: "center" }}>
        <div className="container">
          <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Prefer the browser?</h3>
          <p style={{ color: "#94a3b8", marginBottom: 24 }}>No download needed. Access {brandName} directly from your browser.</p>
          <Link to="/auth/register" style={{ display: "inline-block", background: "#0162c4", color: "#fff", padding: "12px 32px", borderRadius: 8, fontWeight: 600, textDecoration: "none" }}>
            Open Web App
          </Link>
        </div>
      </section>
    </div>
  );
}
