// src/main.jsx (Vite)

import React, { StrictMode, useEffect, useLayoutEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Provider as ReduxProvider } from "react-redux";
import SettingsProvider from './contexts/SettingsContext.jsx';
import { store } from "./redux/store";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import App from "./App.jsx";
import "./index.css";
import { appBrandingAssets } from "./data/CommonData.js";
import authStore from "./utils/auth.js";
import { ensureCsrfCookie } from "./utils/csrf.js";
import { API_BASE_URL } from "./config/apiBaseUrl.js";

// Ensure dev environment stays clear of any previously installed SWs.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => registrations.forEach((registration) => registration.unregister()))
    .catch(() => {});
}

// Register SW only in production (Vite)
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const shareBrandingWithWorker = (worker) => {
    if (worker) {
      worker.postMessage({
        type: "APP_BRANDING_ASSETS",
        payload: appBrandingAssets,
      });
    }
  };

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        navigator.serviceWorker.ready
          .then((readyRegistration) => {
            shareBrandingWithWorker(readyRegistration.active);
          })
          .catch(() => {});

        if (registration.installing) {
          registration.installing.addEventListener("statechange", (event) => {
            if (event.target?.state === "activated") {
              shareBrandingWithWorker(registration.active);
            }
          });
        }

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          shareBrandingWithWorker(navigator.serviceWorker.controller);
        });
      })
      .catch(console.error);
  });
}

function ApplyGlobalStyles() {
  const location = useLocation();
  const isMessenger = useMemo(
    () => location.pathname.startsWith("/app"),
    [location.pathname]
  );
  const isElectron = Boolean(window?.electron?.isElectron);

  useEffect(() => {
    if (isElectron) {
      document.documentElement.classList.add("electron-shell");
      document.body.classList.add("electron-shell");
    } else {
      document.documentElement.classList.remove("electron-shell");
      document.body.classList.remove("electron-shell");
    }
    return () => {
      document.documentElement.classList.remove("electron-shell");
      document.body.classList.remove("electron-shell");
    };
  }, [isElectron]);

  useLayoutEffect(() => {
    const rootEl = document.getElementById("root");
    if (!rootEl) {
      return undefined;
    }
    const previous = {
      width: rootEl.style.width,
      height: rootEl.style.height,
      overflow: rootEl.style.overflow,
    };
    rootEl.style.width = "100%";
    rootEl.style.height = "100%";
    rootEl.style.overflow = isMessenger ? "hidden" : "";
    return () => {
      rootEl.style.width = previous.width;
      rootEl.style.height = previous.height;
      rootEl.style.overflow = previous.overflow;
    };
  }, [isMessenger]);

  return null;
}

function SessionLifecycle() {
  useEffect(() => {
    ensureCsrfCookie(API_BASE_URL).catch(() => false);
    authStore.ensureFreshSession().catch(() => {});
    const stopAutoRefresh = authStore.startAutoRefresh();
    return () => {
      stopAutoRefresh();
    };
  }, []);

  return null;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HelmetProvider>
      <ReduxProvider store={store}>
        <SettingsProvider>
          <BrowserRouter>
            <ApplyGlobalStyles />
            <SessionLifecycle />
              <App />
          </BrowserRouter>
        </SettingsProvider>
      </ReduxProvider>
    </HelmetProvider>
  </StrictMode>
);
