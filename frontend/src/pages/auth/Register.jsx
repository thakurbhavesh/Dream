// src/pages/auth/Register.jsx
import { useMemo, useState } from "react";
import {
  Button,
  Stack,
  TextField,
  Typography,
  Link,
  FormHelperText,
  Snackbar,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
} from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import * as Yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { FcGoogle } from "react-icons/fc";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/material.css";
import AuthSplitLayout from "../../layouts/auth/AuthSplitLayout";
import { API_BASE_URL } from "../../config/apiBaseUrl";
import { fetchJson } from "../../utils/fetchJson";
import { extractOtpAttemptMeta } from "../../utils/otpAttempt";
import OtpAttemptStatus from "../../components/auth/OtpAttemptStatus";
import OtpCodeInput from "../../components/auth/OtpCodeInput";
import useOtpResendCooldown from "../../hooks/useOtpResendCooldown";

const readRetryAfterSeconds = (payload = {}) => {
  const source = payload?.errors && typeof payload.errors === "object" ? payload.errors : payload;
  const fromRetry = Number.parseInt(source?.retry_after_seconds, 10);
  const fromResend = Number.parseInt(source?.resend_available_in_seconds, 10);
  if (Number.isFinite(fromRetry) && fromRetry >= 0) return fromRetry;
  if (Number.isFinite(fromResend) && fromResend >= 0) return fromResend;
  return 0;
};

const normalizeTenDigitPhone = (value = "") => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.slice(-10);
};

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [otpAttemptMeta, setOtpAttemptMeta] = useState(null);
  const [showOtpAttempts, setShowOtpAttempts] = useState(false);
  const resendCooldown = useOtpResendCooldown(0);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const stepOneSchema = useMemo(
    () =>
      Yup.object().shape({
        companyName: Yup.string().required("Company name is required"),
        name: Yup.string().required("Your name is required"),
        mobile: Yup.string()
          .required("Mobile is required")
          .test(
            "is-10-digit",
            "Mobile number must be exactly 10 digits",
            (value) => /^\d{10}$/.test(normalizeTenDigitPhone(value || ""))
          ),
        email: Yup.string()
          .required("Email is required")
          .email("Enter a valid email"),
        password: Yup.string()
          .required("Password is required")
          .min(8, "Password must be at least 8 characters"),
        confirmPassword: Yup.string()
          .required("Confirm password is required")
          .oneOf([Yup.ref("password")], "Passwords must match"),
      }),
    []
  );

  const stepTwoSchema = useMemo(
    () =>
      Yup.object().shape({
        otp: Yup.string()
          .required("OTP is required")
          .matches(/^[0-9]{6}$/, "Enter a valid 6-digit OTP"),
      }),
    []
  );

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm({
    mode: "onBlur",
    resolver: yupResolver(step === 1 ? stepOneSchema : stepTwoSchema),
    defaultValues: {
      companyName: "",
      name: "",
      mobile: "",
      email: "",
      password: "",
      confirmPassword: "",
      otp: "",
    },
  });

  const closeSnackbar = (_, reason) => {
    if (reason === "clickaway") return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      if (step === 1) {
        const normalizedEmail = String(data.email || "").trim().toLowerCase();
        const normalizedPhone = normalizeTenDigitPhone(data.mobile);

        const payload = {
          company_name: String(data.companyName || "").trim(),
          owner_name: String(data.name || "").trim(),
          email: normalizedEmail,
          phone: normalizedPhone,
          password: String(data.password || ""),
        };

        const { response, payload: result } = await fetchJson(`${API_BASE_URL}/auth/create-account`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok || result?.status === "error") {
          throw new Error(result?.message || "Unable to create account");
        }

        setRegisteredEmail(normalizedEmail);
        setValue("otp", "");
        setOtpAttemptMeta(null);
        setShowOtpAttempts(false);
        resendCooldown.start(
          Number.parseInt(result?.data?.resend_available_in_seconds, 10) || 30
        );
        setStep(2);
        setSnackbar({
          open: true,
          severity: "success",
          message: "Account created. OTP sent to your email.",
        });
        return;
      }

      const verifyPayload = {
        email: registeredEmail || String(data.email || "").trim().toLowerCase(),
        otp_code: String(data.otp || "").trim(),
      };

      const { response: verifyResponse, payload: verifyResult } = await fetchJson(
        `${API_BASE_URL}/auth/verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(verifyPayload),
        }
      );
      if (!verifyResponse.ok || verifyResult?.status === "error") {
        setValue("otp", "");
        const attemptMeta = extractOtpAttemptMeta(verifyResult);
        setOtpAttemptMeta(attemptMeta);
        setShowOtpAttempts(Boolean(attemptMeta));
        const retryAfter = readRetryAfterSeconds(verifyResult);
        if (retryAfter > 0) {
          resendCooldown.start(retryAfter);
        }
        throw new Error(verifyResult?.message || "OTP verification failed");
      }
      setOtpAttemptMeta(null);
      setShowOtpAttempts(false);
      resendCooldown.reset();

      setSnackbar({
        open: true,
        severity: "success",
        message: "OTP verified successfully. Redirecting to login...",
      });

      setTimeout(() => {
        navigate("/auth/login", {
          replace: true,
          state: {
            toast: {
              severity: "success",
              message: "Account verified successfully. Please log in.",
            },
          },
        });
      }, 900);
    } catch (error) {
      setSnackbar({
        open: true,
        severity: "error",
        message: error?.message || "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  const title = step === 1 ? "Create New Account" : "Verify OTP";
  const subtitle =
    step === 1
      ? "We only need the essentials to spin up your workspace."
      : "Enter the one-time code we just sent to your inbox.";
  const otpAttemptsLeft = Number(otpAttemptMeta?.attemptsLeft);
  const isOtpLocked = Number.isFinite(otpAttemptsLeft) && otpAttemptsLeft <= 0;

  const handleResendOtp = async () => {
    if (loading || resendCooldown.secondsLeft > 0) return;
    try {
      setLoading(true);
      setValue("otp", "");
      const email = String(registeredEmail || "").trim().toLowerCase();
      const { response, payload: result } = await fetchJson(`${API_BASE_URL}/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok || result?.status === "error") {
        const retryAfter = readRetryAfterSeconds(result);
        if (retryAfter > 0) {
          resendCooldown.start(retryAfter);
        }
        throw new Error(result?.message || "Unable to resend OTP");
      }
      const cooldown = Number.parseInt(result?.data?.resend_available_in_seconds, 10) || 30;
      resendCooldown.start(cooldown);
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
      title={title}
      subtitle={subtitle}
      footer={
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="center"
        >
          <Typography variant="body2">Already have an account?</Typography>
          <Link component={RouterLink} to="/auth/login" variant="subtitle2">
            Login
          </Link>
        </Stack>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={3}>
          {step === 1 ? (
            <>
              <Controller
                name="companyName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Company Name"
                    fullWidth
                    error={!!errors.companyName}
                    helperText={errors.companyName?.message}
                  />
                )}
              />

              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Your Name"
                    fullWidth
                    error={!!errors.name}
                    helperText={errors.name?.message}
                  />
                )}
              />

              <Controller
                name="mobile"
                control={control}
                render={({ field }) => (
                  <Stack spacing={0.5}>
                    <PhoneInput
                      country="us"
                      enableSearch
                      value={field.value}
                      onChange={(value) => field.onChange(value)}
                      onBlur={field.onBlur}
                      inputProps={{ name: field.name, required: true }}
                      containerStyle={{ width: "100%" }}
                      inputStyle={{
                        width: "100%",
                        height: 56,
                        borderRadius: 8,
                        fontSize: 16,
                        border: `1px solid ${errors.mobile ? "#d32f2f" : "#c4c4c4"}`,
                        backgroundColor: "transparent",
                      }}
                      buttonStyle={{
                        border: "none",
                        background: "transparent",
                      }}
                      dropdownStyle={{
                        zIndex: 1600,
                      }}
                    />
                    {errors.mobile ? (
                      <FormHelperText error>{errors.mobile.message}</FormHelperText>
                    ) : null}
                  </Stack>
                )}
              />

              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Email"
                    type="email"
                    fullWidth
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
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    fullWidth
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

              <Controller
                name="confirmPassword"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Confirm Password"
                    type={showConfirmPassword ? "text" : "password"}
                    fullWidth
                    error={!!errors.confirmPassword}
                    helperText={errors.confirmPassword?.message}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowConfirmPassword((prev) => !prev)}
                            edge="end"
                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                          >
                            {showConfirmPassword ? <AiOutlineEye /> : <AiOutlineEyeInvisible />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />

              <Button
                type="submit"
                size="large"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{
                  bgcolor: "primary.main",
                  color: "#fff",
                  "&:hover": {
                    bgcolor: "text.primary",
                    color: (t) =>
                      t.palette.mode === "light" ? "common.white" : "grey.800",
                  },
                  mt: 1,
                }}
              >
                {loading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1, color: "inherit" }} />
                    Creating...
                  </>
                ) : (
                  "Register"
                )}
              </Button>

              <Button
                fullWidth
                size="large"
                variant="outlined"
                startIcon={<FcGoogle />}
                sx={{
                  bgcolor: "background.default",
                  borderColor: (t) => t.palette.grey[500],
                  color: "text.primary",
                  textTransform: "capitalize",
                  "&:hover": {
                    borderColor: "primary.main",
                    bgcolor: "common.white",
                    color: "text.secondary",
                  },
                }}
              >
                Sign up with Google
              </Button>
            </>
          ) : (
            <>
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
                  onClick={handleResendOtp}
                  disabled={loading || resendCooldown.secondsLeft > 0}
                >
                  Resend OTP
                </Button>
              </Stack>

              <Button
                type="submit"
                size="large"
                fullWidth
                variant="contained"
                disabled={loading || isOtpLocked || String(getValues("otp") || "").trim().length !== 6}
                sx={{
                  bgcolor: "text.primary",
                  color: (t) =>
                    t.palette.mode === "light" ? "common.white" : "grey.800",
                  "&:hover": {
                    bgcolor: "text.primary",
                    color: (t) =>
                      t.palette.mode === "light" ? "common.white" : "grey.800",
                  },
                }}
              >
                {loading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1, color: "inherit" }} />
                    Verifying...
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
            </>
          )}
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
    </AuthSplitLayout>
  );
}
