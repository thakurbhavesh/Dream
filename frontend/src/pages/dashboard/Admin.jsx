import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Box,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
  useTheme,
} from "@mui/material";
import PulseLoader from "react-spinners/PulseLoader";
import { useLocation } from "react-router-dom";
import CustomScrollbars from "../../components/Scrollbar";
import useAdminDashboardData from "../../hooks/useAdminDashboardData";
import { API_BASE_URL } from "../../config/apiBaseUrl";
import { fetchWithAuth } from "../../utils/authApi";
import { showSystemNotification } from "../../utils/notificationBridge";
import { consumeBillingCheckoutSuccess, storeBillingCheckoutSuccess } from "../../utils/billingCheckoutSignal";

const Home = lazy(() => import("../../components/Admin/tabs/Home.jsx"));
const Users = lazy(() => import("../../components/Admin/tabs/Users.jsx"));
const Group = lazy(() => import("../../components/Admin/tabs/Group.jsx"));
const Controls = lazy(() => import("../../components/Admin/tabs/Controls.jsx"));
const Billing = lazy(() => import("../../components/Admin/tabs/Billing.jsx"));
const Advanced = lazy(() => import("../../components/Admin/tabs/Advanced.jsx"));
const ActivityLogs = lazy(() => import("../../components/Admin/tabs/ActivityLogs.jsx"));
const OtpVerifications = lazy(() => import("../../components/Admin/tabs/OtpVerifications.jsx"));

const preloadAdminTabs = () => {
  import("../../components/Admin/tabs/Users.jsx");
  import("../../components/Admin/tabs/Group.jsx");
  import("../../components/Admin/tabs/Controls.jsx");
  import("../../components/Admin/tabs/Billing.jsx");
  import("../../components/Admin/tabs/Advanced.jsx");
  import("../../components/Admin/tabs/ActivityLogs.jsx");
  import("../../components/Admin/tabs/OtpVerifications.jsx");
};

const ensureDeviceId = () => {
  if (typeof window === "undefined") return null;
  let deviceId = window.localStorage.getItem("deviceId");
  if (deviceId) return deviceId;
  deviceId =
    crypto?.randomUUID?.() ??
    `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  window.localStorage.setItem("deviceId", deviceId);
  return deviceId;
};

const TabContentBoundary = ({ children, onReady }) => {
  useEffect(() => {
    let active = true;
    const finish = () => {
      if (active) {
        onReady?.();
      }
    };

    if (
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      const rafId = window.requestAnimationFrame(finish);
      return () => {
        active = false;
        window.cancelAnimationFrame(rafId);
      };
    }

    const timeoutId = setTimeout(finish, 0);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [onReady]);

  return children;
};

const Admin = () => {
  const theme = useTheme();
  const [value, setValue] = useState(0);
  const [usersTab, setUsersTab] = useState("Users");
  const [deviceVerified, setDeviceVerified] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [paymentToast, setPaymentToast] = useState({
    open: false,
    severity: "success",
    message: "",
  });
  const location = useLocation();
  const handledCheckoutSessionsRef = useRef(new Set());
  const checkoutDismissedRef = useRef(false);
  const checkoutAbortRef = useRef(null);
  const role = useMemo(
    () => (typeof window !== "undefined" ? (localStorage.getItem("role") ?? "1") : "1"),
    [],
  );
  const adminData = useAdminDashboardData();

  useEffect(() => {
    ensureDeviceId();
    setDeviceVerified(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const warmup = () => preloadAdminTabs();
    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(warmup, { timeout: 1200 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timeoutId = setTimeout(warmup, 450);
    return () => clearTimeout(timeoutId);
  }, []);

  const tabItems = useMemo(() => {
    const tabs = ["Home", "Users", "Groups", "Controls", "Billing", "Activity Logs", "OTP Verifications"];
    if (role === "1") {
      tabs.push("Advanced");
    }
    return tabs;
  }, [role]);

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 56 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${(Math.random() * 0.7).toFixed(2)}s`,
        duration: `${(1.7 + Math.random() * 1.8).toFixed(2)}s`,
        rotate: `${Math.floor(Math.random() * 360)}deg`,
      })),
    []
  );

  const triggerPaymentCelebration = useCallback((invoiceNumber = "") => {
    const normalizedInvoice = String(invoiceNumber || "").trim();
    setValue(0);
    setShowConfetti(true);
    const notificationResult = showSystemNotification({
      title: "Payment Successful",
      body: `Subscription updated${normalizedInvoice ? ` | Invoice: ${normalizedInvoice}` : ""}`,
    });
    setPaymentToast({
      open: true,
      severity: "success",
      message: normalizedInvoice
        ? `Payment successful. Invoice: ${normalizedInvoice}${notificationResult?.ok ? "" : " | Notification shown in app"}`
        : `Payment successful. Subscription updated${notificationResult?.ok ? "" : " | Notification shown in app"}.`,
    });
    const confettiTimer = setTimeout(() => setShowConfetti(false), 2600);
    setTimeout(() => clearTimeout(confettiTimer), 2800);
  }, []);

  useEffect(() => {
    if (value > tabItems.length - 1) {
      setValue(0);
      setTabLoading(true);
    }
  }, [tabItems.length, value]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    const billingStatus = String(params.get("billing_checkout") || "").trim().toLowerCase();
    const sessionId = String(params.get("session_id") || params.get("token") || "").trim();
    const gateway = String(params.get("gateway") || "").trim().toLowerCase();
    const alreadyCelebrated = String(params.get("celebrated") || "").trim() === "1";
    if (billingStatus !== "success") return undefined;

    if (!sessionId) {
      const pendingSuccess = consumeBillingCheckoutSuccess();
      if (!alreadyCelebrated && (pendingSuccess?.invoiceNumber || pendingSuccess?.sessionId)) {
        triggerPaymentCelebration(pendingSuccess.invoiceNumber);
        if (typeof adminData?.refresh === "function") {
          Promise.resolve(adminData.refresh()).catch((refreshError) => {
            console.warn("Admin dashboard refresh after stored payment success failed", refreshError);
          });
        }
      } else if (typeof adminData?.refresh === "function") {
        Promise.resolve(adminData.refresh()).catch((refreshError) => {
          console.warn("Admin dashboard refresh after celebrated payment redirect failed", refreshError);
        });
      }
      params.delete("billing_checkout");
      params.delete("celebrated");
      const nextQuery = params.toString();
      window.history.replaceState({}, "", `/app/admin${nextQuery ? `?${nextQuery}` : ""}`);
      return undefined;
    }
    if (handledCheckoutSessionsRef.current.has(sessionId)) return undefined;
    handledCheckoutSessionsRef.current.add(sessionId);
    checkoutDismissedRef.current = false;
    let active = true;

    const run = async () => {
      const controller = new AbortController();
      checkoutAbortRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      try {
        const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/billing/checkout/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ session_id: sessionId, gateway }),
        });
        if (checkoutDismissedRef.current) return;
        if (!response.ok || payload?.status === "error") {
          throw new Error(payload?.message || "Payment verification failed");
        }
        if (!active) return;
        const invoiceNumber = String(payload?.data?.payment?.invoice_number || "").trim();
        storeBillingCheckoutSuccess({ invoiceNumber, sessionId });
        triggerPaymentCelebration(invoiceNumber);
        if (typeof adminData?.refresh === "function") {
          Promise.resolve(adminData.refresh()).catch((refreshError) => {
            console.warn("Admin dashboard refresh after payment failed", refreshError);
          });
        }
      } catch (error) {
        if (!active) return;
        if (checkoutDismissedRef.current) return;
        handledCheckoutSessionsRef.current.delete(sessionId);
        setPaymentToast({
          open: true,
          severity: "error",
          message:
            error?.name === "AbortError"
              ? "Payment verification timed out. Please retry from Billing > Payment History."
              : String(error?.message || "Payment verification failed"),
        });
      } finally {
        clearTimeout(timeoutId);
        checkoutAbortRef.current = null;
        params.delete("billing_checkout");
        params.delete("session_id");
        params.delete("token");
        params.delete("gateway");
        const nextQuery = params.toString();
        window.history.replaceState({}, "", `/app/admin${nextQuery ? `?${nextQuery}` : ""}`);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [adminData, location.search, triggerPaymentCelebration]);

  useEffect(() => {
    if (!tabLoading) return undefined;
    const fallbackId = setTimeout(() => setTabLoading(false), 4000);
    return () => clearTimeout(fallbackId);
  }, [tabLoading]);

  const handleTabReady = useCallback(() => {
    setTabLoading(false);
  }, []);

  const handleChange = (_, newValue) => {
    if (newValue === value) return;
    setTabLoading(true);
    setValue(newValue);
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/app/admin");
    }
  };

  const renderContent = () => {
    switch (value) {
      case 0:
        return (
          <Home
            setValue={setValue}
            setUsersTab={setUsersTab}
            adminData={adminData}
          />
        );
      case 1:
        return <Users adminData={adminData} initialTab={usersTab} />;
      case 2:
        return <Group adminData={adminData} />;
      case 3:
        return <Controls />;
      case 4:
        return <Billing adminData={adminData} />;
      case 5:
        return <ActivityLogs />;
      case 6:
        return <OtpVerifications />;
      case 7:
        return role === "1" ? <Advanced /> : null;
      default:
        return null;
    }
  };

  const content = renderContent();

  if (!deviceVerified) {
    return (
      <Stack
        height="100%"
        width="100%"
        alignItems="center"
        justifyContent="center"
        bgcolor={theme.palette.background.paper}
      >
        <Typography variant="body2" color="text.secondary">
          Checking device security.
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack
      sx={{
        overflow: "hidden",
        height: "100%",
        width: "100%",
        position: "relative",
        background:
          theme.palette.mode === "light"
            ? "linear-gradient(180deg, #edf4ff 0%, #f7fbff 50%, #f4f8ff 100%)"
            : theme.palette.background.default,
      }}
    >
      {showConfetti ? (
        <Box
          sx={{
            pointerEvents: "none",
            position: "absolute",
            inset: 0,
            zIndex: 60,
            overflow: "hidden",
            "@keyframes adminConfettiFall": {
              "0%": { transform: "translate3d(0,-10vh,0) rotate(0deg)", opacity: 1 },
              "100%": { transform: "translate3d(0,110vh,0) rotate(720deg)", opacity: 0.2 },
            },
          }}
        >
          {confettiPieces.map((piece) => (
            <Box
              key={piece.id}
              sx={{
                position: "absolute",
                top: "-12px",
                left: piece.left,
                width: 8,
                height: 14,
                borderRadius: "2px",
                transform: `rotate(${piece.rotate})`,
                backgroundColor: ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#7c3aed"][piece.id % 5],
                animation: `adminConfettiFall ${piece.duration} linear ${piece.delay}`,
              }}
            />
          ))}
        </Box>
      ) : null}

      <Paper
        elevation={0}
        sx={{
          m: 1.2,
          p: 0.6,
          borderRadius: 3,
          border: "1px solid rgba(145, 158, 171, 0.2)",
          background:
            theme.palette.mode === "light"
              ? "linear-gradient(130deg, #ffffff 0%, #f3f8ff 70%)"
              : theme.palette.background.paper,
          boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
        }}
      >
        <Box
          sx={{
            borderRadius: 2,
            overflow: "hidden",
            border: "1px solid rgba(145, 158, 171, 0.2)",
            background:
              theme.palette.mode === "light"
                ? "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)"
                : theme.palette.background.paper,
          }}
        >
          <Tabs
            value={value}
            onChange={handleChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              px: 0.8,
              "& .MuiTabs-indicator": {
                height: 3,
                borderRadius: 2,
              },
              "& .MuiTab-root": {
                textTransform: "none",
                fontWeight: 700,
                minHeight: 48,
                borderRadius: 1.5,
                mx: 0.5,
              },
            }}
          >
            {tabItems.map((label) => (
              <Tab key={label} label={label} disableRipple />
            ))}
          </Tabs>
        </Box>
      </Paper>

            <Box
        sx={{
          width: "100%",
          px: 1.2,
          pb: 1.2,
          minHeight: 0,
          flex: 1,
        }}
      >
        <CustomScrollbars>
          <Stack
            sx={{
              height: "100%",
              position: "relative",
              flexGrow: 1,
              backgroundColor:
                theme.palette.mode === "light"
                  ? "transparent"
                  : theme.palette.background.default,
              borderRadius: "5px",
              padding: 0.4,
            }}
          >
            <TabContentBoundary key={value} onReady={handleTabReady}>
              <Suspense
                fallback={
                  <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
                    <PulseLoader color={theme.palette.primary.main} size={12} />
                  </Box>
                }
              >
                {content}
              </Suspense>
            </TabContentBoundary>

            {tabLoading && (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    theme.palette.mode === "light"
                      ? "rgba(255, 255, 255, 0.8)"
                      : "rgba(0, 0, 0, 0.6)",
                  zIndex: 5,
                }}
              >
                <PulseLoader color={theme.palette.primary.main} size={14} />
              </Box>
            )}
          </Stack>
        </CustomScrollbars>
      </Box>
      <Snackbar
        open={paymentToast.open}
        autoHideDuration={3600}
        onClose={() => setPaymentToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          severity={paymentToast.severity}
          variant="filled"
          sx={{ width: "100%" }}
          onClose={() => setPaymentToast((prev) => ({ ...prev, open: false }))}
        >
          {paymentToast.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export default Admin;



