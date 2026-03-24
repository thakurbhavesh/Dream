import { Suspense, lazy, useMemo } from "react";
import { Navigate, Outlet, useRoutes } from "react-router-dom";

// layouts
import DashboardLayout from "../layouts/dashboard";
import LoadingScreen from "../components/LoadingScreen";

import authStore from "../utils/auth";

const GeneralApp = lazy(() => import("../pages/dashboard/GeneralApp.jsx"));
const Settings = lazy(() => import("../pages/dashboard/Settings.jsx"));
const BillingThankYou = lazy(() => import("../pages/dashboard/BillingThankYou.jsx"));
const LoginPage = lazy(() => import("../pages/auth/Login.jsx"));
const RegisterPage = lazy(() => import("../pages/auth/Register.jsx"));
const ResetPasswordPage = lazy(() => import("../pages/auth/ResetPassword.jsx"));
const NewPasswordPage = lazy(() => import("../pages/auth/NewPassword.jsx"));
const AdminPage = lazy(() => import("../pages/dashboard/Admin.jsx"));
const OwnerDashboard = lazy(() => import("../pages/dashboard/Owner/index.jsx"));
const Page404 = lazy(() => import("../pages/Page404.jsx"));
const WebsiteLayout = lazy(() => import("../website/index.jsx"));
const Home = lazy(() => import("../website/pages/home.jsx"));
const Pricing = lazy(() => import("../website/pages/Pricing.jsx"));
const Features = lazy(() => import("../website/pages/Features.jsx"));
const Demo = lazy(() => import("../website/pages/Demo.jsx"));
const Help = lazy(() => import("../website/pages/Help.jsx"));
const HowItworks = lazy(() => import("../website/pages/HowItworks.jsx"));
const Contact = lazy(() => import("../website/pages/Contact.jsx"));

export default function Router() {
  const authenticated = authStore.useAuthStatus();
  const roleId =
    authenticated && typeof window !== "undefined"
      ? Number(window.localStorage.getItem("role") || 0)
      : 0;
  const isOwner = roleId === 1;
  const defaultAuthedPath = isOwner ? "/owner-dashboard" : "/app";

  const routes = useMemo(
    () => [
      {
        path: "/auth",
        element: authenticated ? <Navigate to={defaultAuthedPath} replace /> : <Outlet />,
        children: [
          { path: "login", element: <LoginPage /> },
          { path: "register", element: <RegisterPage /> },
          { path: "reset-password", element: <ResetPasswordPage /> },
          { path: "new-password", element: <NewPasswordPage /> },
        ],
      },
      {
        path: "/owner-dashboard",
        element: authenticated
          ? (isOwner ? <OwnerDashboard /> : <Navigate to="/app" replace />)
          : <Navigate to="/auth/login" replace />,
      },
      {
        path: "/app",
        element: authenticated
          ? (isOwner ? <Navigate to="/owner-dashboard" replace /> : <DashboardLayout />)
          : <Navigate to="/auth/login" replace />,
        children: [
          { index: true, element: <GeneralApp /> },
          { path: "admin", element: <AdminPage /> },
          { path: "billing/thank-you", element: <BillingThankYou /> },
          { path: "settings", element: <Settings /> },
          { path: "*", element: <Page404 /> },
        ],
      },
      {
        path: "/",
        element: <WebsiteLayout />,
        children: [
          { index: true, element: <Home /> },
          { path: "home", element: <Home /> },
          { path: "pricing", element: <Pricing /> },
          { path: "features", element: <Features /> },
          { path: "demo", element: <Demo /> },
          { path: "help", element: <Help /> },
          { path: "how-it-works", element: <HowItworks /> },
          { path: "contact", element: <Contact /> },
        ],
      },
      {
        path: "*",
        element: <Navigate to={authenticated ? defaultAuthedPath : "/auth/login"} replace />,
      },
    ],
    [authenticated, defaultAuthedPath, isOwner]
  );

  const element = useRoutes(routes);

  return <Suspense fallback={<LoadingScreen />}>{element}</Suspense>;
}

