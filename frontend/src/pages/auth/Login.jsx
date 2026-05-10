import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import {
  Link,
  Stack,
  Typography,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Snackbar,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
} from "@mui/material";
import { PiQrCode } from "react-icons/pi";
import { useForm, Controller } from "react-hook-form";
import * as Yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { FcGoogle } from "react-icons/fc";
import authStore from "../../utils/auth";
import AuthSplitLayout from "../../layouts/auth/AuthSplitLayout";
import { API_BASE_URL } from "../../config/apiBaseUrl";
import { fetchJson } from "../../utils/fetchJson";
import { extractOtpAttemptMeta } from "../../utils/otpAttempt";
import OtpAttemptStatus from "../../components/auth/OtpAttemptStatus";
import OtpCodeInput from "../../components/auth/OtpCodeInput";
import useOtpResendCooldown from "../../hooks/useOtpResendCooldown";
import { getOrCreateClientDeviceId } from "../../utils/deviceId";
import { useSiteBranding } from "../../contexts/SiteBrandingContext.jsx";

const decodeJwtPayload = (token) => {
  try {
    const base64Payload = token.split(".")[1];
    if (!base64Payload) return {};
    const normalized = base64Payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(normalized)
        .split("")
        .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return {};
  }
};

const resolveProfileFromMeResponse = (payload = {}) => {
  const data = payload?.data || {};
  const meUser = data?.user || data?.profile || data || {};
  const meOrg =
    data?.organization ||
    data?.organization_info ||
    data?.organization_details ||
    {};
  const memberInfo = data?.organization_member || {};
  const userRole = data?.user_role || {};

  return {
    name: meUser?.name || meUser?.owner_name || "",
    email: meUser?.email || "",
    organization:
      meOrg?.organization_id ??
      meOrg?.id ??
      meUser?.organization_id ??
      "",
    organizationName:
      meOrg?.organization_name ??
      meOrg?.name ??
      meUser?.organization_name ??
      "",
    roleId:
      meUser?.role_id ??
      data?.user_role?.role_id ??
      "",
    roleKey:
      meUser?.role_key ||
      userRole?.role_key ||
      "",
    roleName:
      userRole?.role_name ||
      memberInfo?.role_name ||
      "",
    mobile: meUser?.mobile || "",
    avatar: meUser?.profile_url || "",
    departmentName: memberInfo?.department_name || "",
    designationName: memberInfo?.designation_name || "",
    locationName: memberInfo?.location_name || "",
    lastLoginAt: meUser?.last_login_at || "",
  };
};

const readRetryAfterSeconds = (payload = {}) => {
  const source = payload?.errors && typeof payload.errors === "object" ? payload.errors : payload;
  const fromRetry = Number.parseInt(source?.retry_after_seconds, 10);
  const fromResend = Number.parseInt(source?.resend_available_in_seconds, 10);
  if (Number.isFinite(fromRetry) && fromRetry >= 0) return fromRetry;
  if (Number.isFinite(fromResend) && fromResend >= 0) return fromResend;
  return 0;
};

const buildClientDeviceMeta = () => {
  const platform =
    navigator.userAgentData?.platform ||
    navigator.platform ||
    "Unknown OS";
  const hostname =
    window.location?.hostname ||
    "localhost";
  return {
    os_name: String(platform).trim().slice(0, 120),
    hostname: String(hostname).trim().slice(0, 255),
  };
};

const GEO_CACHE_KEY = "chatx_login_geo_hint_v1";

const readCachedGeoHint = () => {
  try {
    const raw = window.sessionStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const ttlMs = 30 * 60 * 1000;
    if (!parsed.cachedAt || Date.now() - Number(parsed.cachedAt) > ttlMs) return null;
    return parsed;
  } catch {
    return null;
  }
};

const cacheGeoHint = (value) => {
  try {
    window.sessionStorage.setItem(
      GEO_CACHE_KEY,
      JSON.stringify({ ...value, cachedAt: Date.now() })
    );
  } catch {
    // Ignore storage errors.
  }
};

const resolveGeoHint = async () => {
  const cached = readCachedGeoHint();
  if (cached) {
    return {
      country: cached.country || "",
      city: cached.city || "",
      latitude: cached.latitude ?? null,
      longitude: cached.longitude ?? null,
      accuracy_radius: cached.accuracy_radius ?? null,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 2500);
    const response = await fetch("https://ipapi.co/json/", { signal: controller.signal });
    window.clearTimeout(timeoutId);
    if (!response.ok) {
      return {};
    }
    const payload = await response.json().catch(() => ({}));
    const resolved = {
      country: payload?.country_name || payload?.country || "",
      city: payload?.city || "",
      latitude:
        payload?.latitude !== undefined && payload?.latitude !== null
          ? Number(payload.latitude)
          : null,
      longitude:
        payload?.longitude !== undefined && payload?.longitude !== null
          ? Number(payload.longitude)
          : null,
      accuracy_radius:
        payload?.accuracy !== undefined && payload?.accuracy !== null
          ? Number(payload.accuracy)
          : null,
    };
    cacheGeoHint(resolved);
    return resolved;
  } catch {
    return {};
  }
};

const Login = () => {
  const { brandName } = useSiteBranding();
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [otpAttemptMeta, setOtpAttemptMeta] = useState(null);
  const [showOtpAttempts, setShowOtpAttempts] = useState(false);
  const resendCooldown = useOtpResendCooldown(0);
  const location = useLocation();
  const navigate = useNavigate();

  // ─── QR Code Login ───
  const [showQr, setShowQr] = useState(false);
  const [qrData, setQrData] = useState(null); // { qrId, qrToken }
  const [qrStatus, setQrStatus] = useState("idle"); // idle | loading | ready | polling | linked | expired | error
  const qrPollRef = useRef(null);

  const startQrLogin = useCallback(async () => {
    setShowQr(true);
    setQrStatus("loading");
    try {
      const { payload: res } = await fetchJson(`${API_BASE_URL}/auth/qr`, {}, 60000);
      const d = res?.data || res;
      if (d?.qrId && d?.qrToken) {
        setQrData(d);
        setQrStatus("ready");
        // Start polling
        qrPollRef.current = setInterval(async () => {
          try {
            const { payload: poll } = await fetchJson(`${API_BASE_URL}/auth/qr/status?qrId=${d.qrId}`, {}, 30000);
            const pd = poll?.data || poll;
            if (pd?.status === "linked" && pd?.accessToken) {
              clearInterval(qrPollRef.current);
              setQrStatus("linked");
              // Auto login with received token
              const decoded = decodeJwtPayload(pd.accessToken);
              const u = pd.user || {};
              await authStore.login({
                token: pd.accessToken,
                refreshToken: pd.refreshToken || "",
                id: decoded.sub || u.id,
                email: decoded.email || u.email,
                name: decoded.name || u.name,
                organization: String(decoded.org || ""),
                role: decoded.role || "",
              });
              setTimeout(() => navigate("/app", { replace: true }), 500);
            } else if (pd?.status === "expired") {
              clearInterval(qrPollRef.current);
              setQrStatus("expired");
            }
          } catch {}
        }, 2000);
      } else {
        setQrStatus("error");
      }
    } catch {
      setQrStatus("error");
    }
  }, [navigate]);

  // Cleanup polling on unmount or close
  useEffect(() => {
    return () => { if (qrPollRef.current) clearInterval(qrPollRef.current); };
  }, []);

  const closeQr = () => {
    if (qrPollRef.current) clearInterval(qrPollRef.current);
    setShowQr(false);
    setQrData(null);
    setQrStatus("idle");
  };

  const schema = useMemo(
    () =>
      Yup.object().shape({
        email: Yup.string().required("Email is required").email("Enter a valid email"),
        password: Yup.string().required("Password is required"),
        otp: step === 2
          ? Yup.string()
              .required("OTP is required")
              .matches(/^[0-9]{6}$/, "Enter a valid 6-digit OTP")
          : Yup.string().optional(),
      }),
    [step]
  );

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { email: "", password: "", otp: "" },
    mode: "onBlur",
  });

  const closeSnackbar = (_, reason) => {
    if (reason === "clickaway") return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  useEffect(() => {
    const toast = location.state?.toast;
    if (!toast) return;
    setSnackbar({
      open: true,
      message: toast.message || "Done",
      severity: toast.severity || "success",
    });
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  const finalizeLogin = async ({ access_token = "", refresh_token = "", user = {} }) => {
    const jwtPayload = access_token ? decodeJwtPayload(access_token) : {};
    let resolvedName = user?.name || jwtPayload?.name || jwtPayload?.email || "User";
    let resolvedEmail = user?.email || jwtPayload?.email || "";
    let resolvedOrganization = user?.organization_id ?? jwtPayload?.org ?? "";
    let resolvedOrganizationName = user?.organization_name || "";
    let resolvedRoleKey = user?.role_key || jwtPayload?.role || "";
    let parsedRole = Number(user?.role_id ?? jwtPayload?.role_id ?? 0);
    let resolvedRoleName = "";
    let resolvedMobile = "";
    let resolvedAvatar = "";
    let resolvedDepartmentName = "";
    let resolvedDesignationName = "";
    let resolvedLocationName = "";
    let resolvedLastLoginAt = "";

    try {
      const { response: meResponse, payload: meJson } = await fetchJson(`${API_BASE_URL}/auth/me`, {
        method: "GET",
      });
      if (meResponse.ok && meJson?.status !== "error") {
        const meProfile = resolveProfileFromMeResponse(meJson);
        resolvedName = meProfile.name || resolvedName;
        resolvedEmail = meProfile.email || resolvedEmail;
        resolvedOrganization =
          meProfile.organization !== "" ? meProfile.organization : resolvedOrganization;
        resolvedOrganizationName =
          meProfile.organizationName || resolvedOrganizationName;
        resolvedRoleKey = meProfile.roleKey || resolvedRoleKey;
        parsedRole = Number(meProfile.roleId || parsedRole || 0);
        resolvedRoleName = meProfile.roleName || resolvedRoleName;
        resolvedMobile = meProfile.mobile || resolvedMobile;
        resolvedAvatar = meProfile.avatar || resolvedAvatar;
        resolvedDepartmentName = meProfile.departmentName || resolvedDepartmentName;
        resolvedDesignationName = meProfile.designationName || resolvedDesignationName;
        resolvedLocationName = meProfile.locationName || resolvedLocationName;
        resolvedLastLoginAt = meProfile.lastLoginAt || resolvedLastLoginAt;
      }
    } catch {
      // Keep JWT/login response fallbacks when /auth/me is not available.
    }

    const resolvedRole = Number.isFinite(parsedRole) && parsedRole > 0 ? parsedRole : 3;

    await authStore.login({
      token: access_token,
      refreshToken: refresh_token,
      username: resolvedName,
      id: jwtPayload?.sub || user?.user_id || "1",
      name: resolvedName,
      email: resolvedEmail,
      organization: resolvedOrganization,
      organizationName: resolvedOrganizationName,
      role: resolvedRole,
      roleKey: resolvedRoleKey,
      lastLoginAt: resolvedLastLoginAt,
      planExpired: Boolean(user?.plan_expired),
      profile: {
        mobile: resolvedMobile,
        avatar: resolvedAvatar,
        roleName: resolvedRoleName,
        departmentName: resolvedDepartmentName,
        designationName: resolvedDesignationName,
        locationName: resolvedLocationName,
      },
    });
    navigate(resolvedRole === 1 ? "/owner-dashboard" : "/app", { replace: true });
  };

  const onValid = async (values) => {
    try {
      setLoading(true);
      const clientDeviceId = getOrCreateClientDeviceId();
      const deviceMeta = buildClientDeviceMeta();
      const geoHint = await resolveGeoHint();
      const payload = {
        email: values.email.trim().toLowerCase(),
        password: values.password,
        client_device_id: clientDeviceId,
        device_type: "desktop",
        device_name: "Web Browser",
        os_name: deviceMeta.os_name,
        hostname: deviceMeta.hostname,
        country: geoHint.country || undefined,
        city: geoHint.city || undefined,
        latitude: geoHint.latitude ?? undefined,
        longitude: geoHint.longitude ?? undefined,
        accuracy_radius: geoHint.accuracy_radius ?? undefined,
      };

      if (step === 2) {
        payload.otp_code = String(values.otp || "").trim();
      }

      const { response, payload: result } = await fetchJson(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Id": clientDeviceId,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok || result?.status === "error") {
        const attemptMeta = extractOtpAttemptMeta(result);
        if (step === 2) {
          setValue("otp", "");
          setOtpAttemptMeta(attemptMeta);
          setShowOtpAttempts(Boolean(attemptMeta));
          const retryAfter = readRetryAfterSeconds(result);
          if (retryAfter > 0) {
            resendCooldown.start(retryAfter);
          }
        }
        throw new Error(result?.message || "Login failed");
      }

      const data = result?.data || {};
      if (step === 1 && data?.otp_required) {
        setStep(2);
        setValue("otp", "");
        setOtpAttemptMeta(null);
        setShowOtpAttempts(false);
        resendCooldown.start(
          Number.parseInt(data?.resend_available_in_seconds, 10) || 30
        );
        setSnackbar({
          open: true,
          severity: "success",
          message: "OTP sent to your email. Enter OTP to continue.",
        });
        return;
      }

      if (step === 2 || data?.access_token || data?.user) {
        setOtpAttemptMeta(null);
        setShowOtpAttempts(false);
        resendCooldown.reset();
        await finalizeLogin(data);
        return;
      }

      throw new Error("Unexpected login response");
    } catch (error) {
      setSnackbar({
        open: true,
        message: error?.message || "Something went wrong",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const onInvalid = () => {
    const firstError = Object.values(errors)[0]?.message || "Please fix the errors and try again.";
    setSnackbar({ open: true, message: firstError, severity: "error" });
  };

  const heading = step === 1 ? "Log in" : "Verify Login OTP";
  const subtitle =
    step === 1
      ? "Enter your email and password."
      : `Enter the OTP sent to ${getValues("email") || "your email"}.`;
  const otpAttemptsLeft = Number(otpAttemptMeta?.attemptsLeft);
  const isOtpLocked = Number.isFinite(otpAttemptsLeft) && otpAttemptsLeft <= 0;

  const handleResendOtp = async () => {
    if (loading || resendCooldown.secondsLeft > 0) return;
    try {
      setLoading(true);
      setValue("otp", "");
      const clientDeviceId = getOrCreateClientDeviceId();
      const deviceMeta = buildClientDeviceMeta();
      const geoHint = await resolveGeoHint();
      const payload = {
        email: String(getValues("email") || "").trim().toLowerCase(),
        password: String(getValues("password") || ""),
        client_device_id: clientDeviceId,
        device_type: "desktop",
        device_name: "Web Browser",
        os_name: deviceMeta.os_name,
        hostname: deviceMeta.hostname,
        country: geoHint.country || undefined,
        city: geoHint.city || undefined,
        latitude: geoHint.latitude ?? undefined,
        longitude: geoHint.longitude ?? undefined,
        accuracy_radius: geoHint.accuracy_radius ?? undefined,
      };
      const { response, payload: result } = await fetchJson(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Id": clientDeviceId,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok || result?.status === "error") {
        const retryAfter = readRetryAfterSeconds(result);
        if (retryAfter > 0) {
          resendCooldown.start(retryAfter);
        }
        throw new Error(result?.message || "Unable to resend OTP");
      }
      const data = result?.data || {};
      resendCooldown.start(Number.parseInt(data?.resend_available_in_seconds, 10) || 30);
      setValue("otp", "");
      setSnackbar({
        open: true,
        severity: "success",
        message: "OTP resent successfully.",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        severity: "error",
        message: error?.message || "Unable to resend OTP",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout
      title={heading}
      subtitle={subtitle}
      footer={
        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
          <Typography variant="body2">New user?</Typography>
          <Link to="/auth/register" component={RouterLink} variant="subtitle2">
            Create an account
          </Link>
        </Stack>
      }
    >
      <>
        <form onSubmit={handleSubmit(onValid, onInvalid)} noValidate>
          <Stack spacing={3}>
            {step === 1 ? (
              <>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Email"
                      placeholder="Enter your email"
                      fullWidth
                      disabled={loading}
                      error={!!errors.email}
                      helperText={errors.email?.message}
                    />
                  )}
                />

                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      type={showPassword ? "text" : "password"}
                      label="Password"
                      fullWidth
                      disabled={loading}
                      error={!!errors.password}
                      helperText={errors.password?.message}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword((prev) => !prev)}
                              edge="end"
                              aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                              {showPassword ? <AiOutlineEye /> : <AiOutlineEyeInvisible />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </>
            ) : null}

            {step === 2 ? (
              <Stack spacing={1.5}>
                {showOtpAttempts ? <OtpAttemptStatus meta={otpAttemptMeta} /> : null}

                <Controller
                  name="otp"
                  control={control}
                  render={({ field }) => (
                    <OtpCodeInput
                      value={field.value || ""}
                      onChange={field.onChange}
                      disabled={loading || isOtpLocked}
                      error={!!errors.otp}
                      helperText={errors.otp?.message}
                      autoFocus
                    />
                  )}
                />

                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    {resendCooldown.secondsLeft > 0
                      ? `Resend available in ${resendCooldown.secondsLeft}s`
                      : "Didn't receive OTP?"}
                  </Typography>
                  <Button
                    variant="text"
                    size="small"
                    disabled={loading || resendCooldown.secondsLeft > 0}
                    onClick={handleResendOtp}
                  >
                    Resend OTP
                  </Button>
                </Stack>
              </Stack>
            ) : null}

            {step === 1 ? (
              <Stack alignItems="flex-end">
                <Link component={RouterLink} to="/auth/reset-password" variant="body2" underline="always">
                  Forgot password?
                </Link>
              </Stack>
            ) : null}

            <Stack spacing={2}>
              <Button
                fullWidth
                color="inherit"
                size="large"
                type="submit"
                variant="contained"
                disabled={
                  loading ||
                  (step === 2 &&
                    (isOtpLocked || String(getValues("otp") || "").trim().length !== 6))
                }
                sx={{
                  bgcolor: "primary.main",
                  color: "#fff",
                  "&:hover": {
                    bgcolor: "text.primary",
                    color: (t) => (t.palette.mode === "light" ? "common.white" : "grey.800"),
                  },
                }}
              >
                {loading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    {step === 1 ? "Sending OTP..." : "Verifying..."}
                  </>
                ) : step === 1 ? (
                  "CONTINUE"
                ) : (
                  "VERIFY & LOGIN"
                )}
              </Button>

              {step === 1 ? (
                <>
                  {/* Google Sign-In — hidden until OAuth configured */}
                  {/* <Button fullWidth size="large" variant="outlined" startIcon={<FcGoogle />}
                    sx={{ bgcolor: "background.default", borderColor: (t) => t.palette.grey[300], color: "text.primary", textTransform: "capitalize" }}>
                    Sign in with Google
                  </Button> */}

                  <Button
                    fullWidth
                    size="large"
                    variant="outlined"
                    startIcon={<PiQrCode size={20} />}
                    onClick={startQrLogin}
                    sx={{
                      borderColor: (t) => t.palette.grey[300],
                      color: "text.primary",
                      textTransform: "capitalize",
                      "&:hover": {
                        borderColor: "primary.main",
                        bgcolor: "primary.lighter",
                      },
                    }}
                  >
                    Login via QR Code
                  </Button>
                </>
              ) : null}
            </Stack>
          </Stack>
        </form>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={2500}
          onClose={closeSnackbar}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Alert onClose={closeSnackbar} severity={snackbar.severity} sx={{ width: "100%" }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </>

      {/* ─── QR Code Login Dialog ─── */}
      <Dialog open={showQr} onClose={closeQr} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 4, p: 2, textAlign: "center" } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 20 }}>
          Login via QR Code
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Scan this QR code with the {brandName} mobile app
          </Typography>
        </DialogTitle>
        <DialogContent>
          {qrStatus === "loading" && (
            <Box sx={{ py: 6 }}>
              <CircularProgress />
              <Typography variant="body2" sx={{ mt: 2 }}>Generating QR code...</Typography>
            </Box>
          )}

          {qrStatus === "ready" && qrData && (
            <Box sx={{ py: 2 }}>
              {/* QR Code rendered as SVG using simple encoding */}
              <Box sx={{
                width: 220, height: 220, mx: "auto", mb: 2, p: 2,
                border: "2px solid", borderColor: "divider", borderRadius: 3,
                display: "flex", alignItems: "center", justifyContent: "center",
                bgcolor: "#fff",
              }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(JSON.stringify({ qrToken: qrData.qrToken }))}`}
                  alt="QR Code"
                  style={{ width: 200, height: 200 }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                Open {brandName} app → Login → QR Code
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 1 }}>
                QR expires in 5 minutes
              </Typography>
            </Box>
          )}

          {qrStatus === "linked" && (
            <Box sx={{ py: 4 }}>
              <Typography variant="h5" sx={{ color: "success.main", fontWeight: 800 }}>
                ✓ Login Successful!
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Redirecting...
              </Typography>
            </Box>
          )}

          {qrStatus === "expired" && (
            <Box sx={{ py: 4 }}>
              <Typography variant="body1" color="error" sx={{ fontWeight: 700 }}>
                QR Code Expired
              </Typography>
              <Button variant="outlined" onClick={() => { closeQr(); startQrLogin(); }} sx={{ mt: 2 }}>
                Generate New QR
              </Button>
            </Box>
          )}

          {qrStatus === "error" && (
            <Box sx={{ py: 4 }}>
              <Typography variant="body1" color="error" sx={{ fontWeight: 700 }}>
                Failed to generate QR
              </Typography>
              <Button variant="outlined" onClick={() => { closeQr(); startQrLogin(); }} sx={{ mt: 2 }}>
                Try Again
              </Button>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </AuthSplitLayout>
  );
};

export default Login;
