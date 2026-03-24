// src/pages/auth/ResetPassword.jsx
import React, { useEffect, useState } from "react";
import {
  Stack,
  Link,
  TextField,
  Button,
  Snackbar,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
} from "@mui/material";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { PiCaretLeft } from "react-icons/pi";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import AuthSplitLayout from "../../layouts/auth/AuthSplitLayout";
import { API_BASE_URL } from "../../config/apiBaseUrl";
import { fetchJson } from "../../utils/fetchJson";
import { extractOtpAttemptMeta } from "../../utils/otpAttempt";
import OtpAttemptStatus from "../../components/auth/OtpAttemptStatus";
import OtpCodeInput from "../../components/auth/OtpCodeInput";
import useOtpResendCooldown from "../../hooks/useOtpResendCooldown";

const isValidEmail = (value = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());

const parseApiMessage = (payload, fallback) => {
  if (payload?.message) return payload.message;
  if (payload?.error) return payload.error;
  return fallback;
};

const readRetryAfterSeconds = (payload = {}) => {
  const source = payload?.errors && typeof payload.errors === "object" ? payload.errors : payload;
  const fromRetry = Number.parseInt(source?.retry_after_seconds, 10);
  const fromResend = Number.parseInt(source?.resend_available_in_seconds, 10);
  if (Number.isFinite(fromRetry) && fromRetry >= 0) return fromRetry;
  if (Number.isFinite(fromResend) && fromResend >= 0) return fromResend;
  return 0;
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [otpAttemptMeta, setOtpAttemptMeta] = useState(null);
  const [showOtpAttempts, setShowOtpAttempts] = useState(false);
  const resendCooldown = useOtpResendCooldown(0);
  const otpAttemptsLeft = Number(otpAttemptMeta?.attemptsLeft);
  const isOtpLocked = Number.isFinite(otpAttemptsLeft) && otpAttemptsLeft <= 0;

  useEffect(() => {
    const tokenFromQuery = String(
      searchParams.get("reset_token") || searchParams.get("token") || ""
    ).trim();
    const emailFromQuery = String(searchParams.get("email") || "").trim();

    if (emailFromQuery) {
      setEmail(emailFromQuery);
    }

    if (tokenFromQuery) {
      setResetToken(tokenFromQuery);
      setStep(3);
    }
  }, [searchParams]);

  const showToast = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleClose = (_, reason) => {
    if (reason === "clickaway") return;
    setSnackbar((s) => ({ ...s, open: false }));
  };

  const handleRequestOtp = async (event) => {
    event.preventDefault();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      showToast("Enter a valid email", "error");
      return;
    }

    setLoading(true);
    try {
      const { response, payload: result } = await fetchJson(`${API_BASE_URL}/users/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      if (!response.ok || result?.status === "error") {
        throw new Error(parseApiMessage(result, "Unable to send OTP"));
      }

      setEmail(normalizedEmail);
      setOtpAttemptMeta(null);
      setShowOtpAttempts(false);
      resendCooldown.start(
        Number.parseInt(result?.data?.resend_available_in_seconds, 10) || 30
      );
      setStep(2);
      showToast(parseApiMessage(result, "OTP sent to your email"), "success");
    } catch (error) {
      showToast(error?.message || "Unable to send OTP", "error");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpCode = async (rawOtp) => {
    const normalizedOtp = String(rawOtp ?? otpCode ?? "").trim();

    if (!/^\d{6}$/.test(normalizedOtp)) {
      setOtpCode("");
      showToast("OTP must be 6 digits", "error");
      return;
    }

    setLoading(true);
    try {
      const { response, payload: result } = await fetchJson(`${API_BASE_URL}/users/forgot-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(email || "").trim().toLowerCase(),
          otp_code: normalizedOtp,
        }),
      });

      if (!response.ok || result?.status === "error") {
        setOtpCode("");
        const attemptMeta = extractOtpAttemptMeta(result);
        setOtpAttemptMeta(attemptMeta);
        setShowOtpAttempts(Boolean(attemptMeta));
        const retryAfter = readRetryAfterSeconds(result);
        if (retryAfter > 0) {
          resendCooldown.start(retryAfter);
        }
        throw new Error(parseApiMessage(result, "Invalid OTP"));
      }

      const token = result?.data?.reset_token || result?.reset_token || "";
      if (!token) {
        throw new Error("reset_token not received from forgot-verify");
      }

      setResetToken(String(token));
      setOtpAttemptMeta(null);
      setShowOtpAttempts(false);
      resendCooldown.reset();
      setStep(3);
      showToast("OTP verified. Set your new password.", "success");
    } catch (error) {
      showToast(error?.message || "Unable to verify OTP", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    await verifyOtpCode(otpCode);
  };

  const handleResendOtp = async () => {
    if (loading || resendCooldown.secondsLeft > 0) return;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      showToast("Enter a valid email", "error");
      return;
    }

    setLoading(true);
    try {
      const { response, payload: result } = await fetchJson(`${API_BASE_URL}/users/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      if (!response.ok || result?.status === "error") {
        const retryAfter = readRetryAfterSeconds(result);
        if (retryAfter > 0) {
          resendCooldown.start(retryAfter);
        }
        throw new Error(parseApiMessage(result, "Unable to resend OTP"));
      }
      setOtpCode("");
      setOtpAttemptMeta(null);
      setShowOtpAttempts(false);
      resendCooldown.start(
        Number.parseInt(result?.data?.resend_available_in_seconds, 10) || 30
      );
      showToast("OTP resent successfully", "success");
    } catch (error) {
      showToast(error?.message || "Unable to resend OTP", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();

    if (!resetToken) {
      showToast("Reset token missing. Verify OTP again.", "error");
      return;
    }

    if (String(newPassword).length < 8) {
      showToast("New password must be at least 8 characters", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }

    setLoading(true);
    try {
      const { response, payload: result } = await fetchJson(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reset_token: resetToken,
          new_password: newPassword,
        }),
      });

      if (!response.ok || result?.status === "error") {
        throw new Error(parseApiMessage(result, "Unable to reset password"));
      }

      showToast(parseApiMessage(result, "Password reset successful"), "success");
      setTimeout(() => {
        navigate("/auth/login", {
          replace: true,
          state: {
            toast: {
              message: "Password reset successful. Please login.",
              severity: "success",
            },
          },
        });
      }, 1000);
    } catch (error) {
      showToast(error?.message || "Unable to reset password", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout
      title="Forgot your password?"
      subtitle={
        step === 1
          ? "Enter the email address linked to your workspace and we'll send an OTP."
          : step === 2
          ? "Enter OTP sent to your email to verify reset request."
          : "Set your new password to complete reset."
      }
      footer={
        <Link
          component={RouterLink}
          to="/auth/login"
          color="inherit"
          variant="subtitle2"
          sx={{ alignItems: "center", display: "inline-flex" }}
        >
          <PiCaretLeft size={24} />
          Return to sign in
        </Link>
      }
    >
      <>
        {step === 1 && (
          <form onSubmit={handleRequestOtp} noValidate>
            <Stack spacing={2}>
              <TextField
                label="Email Address"
                type="email"
                fullWidth
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />

              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={loading}
                sx={{
                  bgcolor: "text.primary",
                  color: (t) => (t.palette.mode === "light" ? "common.white" : "grey.800"),
                  "&:hover": {
                    bgcolor: "text.primary",
                    color: (t) => (t.palette.mode === "light" ? "common.white" : "grey.800"),
                  },
                  mt: 1,
                }}
              >
                {loading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Processing...
                  </>
                ) : (
                  "Send OTP"
                )}
              </Button>
            </Stack>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOtp} noValidate>
            <Stack spacing={2}>
              <OtpCodeInput
                value={otpCode}
                onChange={setOtpCode}
                disabled={loading || isOtpLocked}
                autoFocus
              />
              {showOtpAttempts ? <OtpAttemptStatus meta={otpAttemptMeta} /> : null}

              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Alert
                  icon={false}
                  severity="info"
                  sx={{
                    p: 0,
                    border: "none",
                    bgcolor: "transparent",
                    color: "text.secondary",
                    "& .MuiAlert-message": { p: 0 },
                  }}
                >
                  {resendCooldown.secondsLeft > 0
                    ? `Resend available in ${resendCooldown.secondsLeft}s`
                    : "Didn't receive OTP?"}
                </Alert>
                <Button
                  type="button"
                  variant="text"
                  size="small"
                  disabled={loading || resendCooldown.secondsLeft > 0}
                  onClick={handleResendOtp}
                >
                  Resend OTP
                </Button>
              </Stack>

              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={loading || isOtpLocked || String(otpCode || "").trim().length !== 6}
                sx={{
                  bgcolor: "text.primary",
                  color: (t) => (t.palette.mode === "light" ? "common.white" : "grey.800"),
                  "&:hover": {
                    bgcolor: "text.primary",
                    color: (t) => (t.palette.mode === "light" ? "common.white" : "grey.800"),
                  },
                  mt: 1,
                }}
              >
                {loading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Verifying...
                  </>
                ) : (
                  "Verify OTP"
                )}
              </Button>

              <Button
                type="button"
                variant="text"
                onClick={() => {
                  setOtpAttemptMeta(null);
                  setShowOtpAttempts(false);
                  setStep(1);
                }}
                disabled={loading}
              >
                Use different email
              </Button>
            </Stack>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleResetPassword} noValidate>
            <Stack spacing={2}>
              <TextField
                label="New Password"
                type={showPassword ? "text" : "password"}
                fullWidth
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((prev) => !prev)}
                        edge="end"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Confirm New Password"
                type={showConfirmPassword ? "text" : "password"}
                fullWidth
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        edge="end"
                        aria-label={
                          showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                        }
                      >
                        {showConfirmPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                fullWidth
                size="large"
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{
                  mt: 1,
                  bgcolor: "text.primary",
                  color: (t) => (t.palette.mode === "light" ? "common.white" : "grey.800"),
                  "&:hover": {
                    bgcolor: "text.primary",
                    color: (t) => (t.palette.mode === "light" ? "common.white" : "grey.800"),
                  },
                }}
              >
                {loading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Updating...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </Stack>
          </form>
        )}

        <Snackbar
          open={snackbar.open}
          autoHideDuration={2500}
          onClose={handleClose}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Alert onClose={handleClose} severity={snackbar.severity} sx={{ width: "100%" }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </>
    </AuthSplitLayout>
  );
};

export default ResetPassword;
