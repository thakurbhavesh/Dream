import { useEffect, useRef, useState } from "react";
import { Alert, Box, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../../config/apiBaseUrl";
import { fetchWithAuth } from "../../utils/authApi";
import { showSystemNotification } from "../../utils/notificationBridge";
import { storeBillingCheckoutSuccess } from "../../utils/billingCheckoutSignal";

const BillingThankYou = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = String(searchParams.get("session_id") || searchParams.get("token") || "").trim();
  const gateway = String(searchParams.get("gateway") || "").trim().toLowerCase();
  const handledRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const run = async () => {
      if (!sessionId) {
        setError("Missing session_id.");
        setLoading(false);
        return;
      }

      try {
        const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/billing/checkout/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, gateway }),
        });

        if (!response.ok || payload?.status === "error") {
          throw new Error(payload?.message || "Payment verification failed");
        }

        const nextInvoiceNumber = String(payload?.data?.payment?.invoice_number || "").trim();
        setInvoiceNumber(nextInvoiceNumber);
        storeBillingCheckoutSuccess({
          invoiceNumber: nextInvoiceNumber,
          sessionId,
        });

        showSystemNotification({
          title: "Payment Successful",
          body: `Subscription updated${nextInvoiceNumber ? ` | Invoice: ${nextInvoiceNumber}` : ""}`,
        });

        setShowConfetti(true);
      } catch (e) {
        setError(e?.message || "Payment verification failed");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [gateway, sessionId]);

  useEffect(() => {
    if (loading || error) return undefined;
    const timer = setTimeout(() => {
      navigate("/app/admin?billing_checkout=success&celebrated=1", { replace: true });
    }, 2600);
    return () => clearTimeout(timer);
  }, [loading, error, navigate]);

  useEffect(() => {
    if (!showConfetti) return undefined;
    const timer = setTimeout(() => setShowConfetti(false), 2200);
    return () => clearTimeout(timer);
  }, [showConfetti]);

  return (
    <Box
      sx={{
        flex: 1,
        width: "100%",
        minHeight: "calc(100vh - 39px)",
        px: { xs: 2, md: 4 },
        py: { xs: 3, md: 5 },
        display: "grid",
        placeItems: "center",
        position: "relative",
        overflow: "hidden",
        background:
          "radial-gradient(circle at top, rgba(37,99,235,0.16) 0%, rgba(37,99,235,0.03) 28%, transparent 56%), linear-gradient(180deg, #f7fbff 0%, #edf6ff 48%, #f8fafc 100%)",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.5,
          backgroundImage:
            "linear-gradient(rgba(37,99,235,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.05) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          maskImage: "linear-gradient(180deg, rgba(0,0,0,0.82), rgba(0,0,0,0.2))",
        }}
      />

      {showConfetti ? (
        <Box
          sx={{
            pointerEvents: "none",
            position: "fixed",
            inset: 0,
            zIndex: 20,
            overflow: "hidden",
            "@keyframes billingThankYouConfetti": {
              "0%": { transform: "translate3d(0,-10vh,0) rotate(0deg)", opacity: 1 },
              "100%": { transform: "translate3d(0,110vh,0) rotate(720deg)", opacity: 0.18 },
            },
          }}
        >
          {Array.from({ length: 52 }, (_, index) => (
            <Box
              key={index}
              sx={{
                position: "absolute",
                top: "-12px",
                left: `${Math.random() * 100}%`,
                width: 8,
                height: 14,
                borderRadius: "2px",
                backgroundColor: ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#0f766e"][index % 5],
                transform: `rotate(${Math.floor(Math.random() * 360)}deg)`,
                animation: `billingThankYouConfetti ${(1.8 + Math.random() * 1.4).toFixed(2)}s linear ${(Math.random() * 0.6).toFixed(2)}s`,
              }}
            />
          ))}
        </Box>
      ) : null}

      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 760,
          mx: "auto",
          position: "relative",
          zIndex: 1,
          overflow: "hidden",
          p: { xs: 3, md: 5 },
          borderRadius: 6,
          border: "1px solid",
          borderColor: "rgba(148,163,184,0.25)",
          boxShadow: "0 36px 100px rgba(15,23,42,0.12)",
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.97) 0%, rgba(244,249,255,0.98) 58%, rgba(236,246,255,0.98) 100%)",
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at top right, rgba(34,197,94,0.16), transparent 34%), radial-gradient(circle at bottom left, rgba(37,99,235,0.12), transparent 30%)",
            pointerEvents: "none",
          },
        }}
      >
        <Stack spacing={2.5} alignItems="center" textAlign="center" sx={{ position: "relative", zIndex: 1 }}>
          <Box
            sx={{
              width: { xs: 92, md: 108 },
              height: { xs: 92, md: 108 },
              borderRadius: "32px",
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontSize: { xs: 40, md: 48 },
              fontWeight: 900,
              background: error
                ? "linear-gradient(145deg, #ef4444 0%, #dc2626 100%)"
                : loading
                  ? "linear-gradient(145deg, #2563eb 0%, #1d4ed8 100%)"
                  : "linear-gradient(145deg, #22c55e 0%, #16a34a 100%)",
              boxShadow: error
                ? "0 24px 50px rgba(239,68,68,0.28)"
                : loading
                  ? "0 24px 50px rgba(37,99,235,0.28)"
                  : "0 24px 60px rgba(34,197,94,0.28)",
            }}
          >
            {loading ? "..." : error ? "!" : "\u2713"}
          </Box>

          <Stack spacing={1} alignItems="center">
            <Typography
              sx={{
                fontSize: { xs: "1.8rem", md: "2.35rem" },
                lineHeight: 1.08,
                fontWeight: 900,
                color: "#0f172a",
                letterSpacing: "-0.03em",
              }}
            >
              {loading ? "Verifying your payment" : error ? "Payment verification failed" : "Payment successful"}
            </Typography>
            <Typography
              sx={{
                maxWidth: 560,
                color: "text.secondary",
                fontSize: { xs: "0.98rem", md: "1.05rem" },
              }}
            >
              {loading
                ? "We are updating your subscription, syncing payment history, and preparing your billing workspace."
                : error
                  ? "The payment could not be confirmed from this session. You can retry from Billing or review the failed entry in Payment History."
                  : "Your subscription has been updated successfully. Confetti and notification have already been triggered, and you will be redirected to Billing shortly."}
            </Typography>
          </Stack>

          <Box
            sx={{
              width: "100%",
              maxWidth: 620,
              p: { xs: 2, md: 2.5 },
              borderRadius: 4,
              border: "1px solid",
              borderColor: loading
                ? "rgba(37,99,235,0.18)"
                : error
                  ? "rgba(239,68,68,0.18)"
                  : "rgba(34,197,94,0.18)",
              background: loading
                ? "linear-gradient(180deg, rgba(239,246,255,0.92) 0%, rgba(248,250,252,0.92) 100%)"
                : error
                  ? "linear-gradient(180deg, rgba(254,242,242,0.95) 0%, rgba(255,255,255,0.98) 100%)"
                  : "linear-gradient(180deg, rgba(240,253,244,0.95) 0%, rgba(255,255,255,0.98) 100%)",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 1.8, sm: 2.5 }}
              alignItems="center"
              justifyContent="space-between"
            >
              <Stack spacing={0.5} alignItems={{ xs: "center", sm: "flex-start" }}>
                <Typography
                  variant="caption"
                  sx={{ letterSpacing: "0.12em", textTransform: "uppercase", color: "text.secondary", fontWeight: 800 }}
                >
                  {loading ? "Processing" : error ? "Status" : "Invoice"}
                </Typography>
                <Typography
                  sx={{
                    fontSize: { xs: "1rem", md: "1.1rem" },
                    fontWeight: 800,
                    color: "#0f172a",
                    wordBreak: "break-word",
                  }}
                >
                  {loading ? "Updating payment record" : error ? "Needs attention" : invoiceNumber || "Invoice is being finalized"}
                </Typography>
              </Stack>

              {!loading ? (
                <Stack spacing={0.5} alignItems={{ xs: "center", sm: "flex-end" }}>
                  <Typography
                    variant="caption"
                    sx={{ letterSpacing: "0.12em", textTransform: "uppercase", color: "text.secondary", fontWeight: 800 }}
                  >
                    Next step
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: { xs: "0.98rem", md: "1.05rem" },
                      fontWeight: 700,
                      color: error ? "#b91c1c" : "#166534",
                    }}
                  >
                    {error ? "Review billing and try again" : "Redirecting to Billing"}
                  </Typography>
                </Stack>
              ) : null}
            </Stack>
          </Box>

          {loading ? (
            <Stack direction="row" spacing={1.2} alignItems="center">
              <CircularProgress size={22} thickness={4.6} />
              <Typography sx={{ fontWeight: 600, color: "text.secondary" }}>
                Updating subscription and payment history...
              </Typography>
            </Stack>
          ) : null}

          {!loading && error ? (
            <Alert severity="error" sx={{ width: "100%", maxWidth: 620, textAlign: "left", borderRadius: 3 }}>
              {error}
            </Alert>
          ) : null}

          {!loading && !error ? (
            <Stack spacing={1.1} alignItems="center">
              <Alert severity="success" sx={{ width: "100%", maxWidth: 620, borderRadius: 3, textAlign: "left" }}>
                Payment completed and your billing records were updated successfully.
                {invoiceNumber ? ` Invoice: ${invoiceNumber}.` : ""}
              </Alert>
              <Typography variant="body2" color="text.secondary">
                Redirecting automatically after celebration.
              </Typography>
            </Stack>
          ) : null}
        </Stack>
      </Paper>
    </Box>
  );
};

export default BillingThankYou;
