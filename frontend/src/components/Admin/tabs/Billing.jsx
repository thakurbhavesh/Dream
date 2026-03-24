import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { DataGrid } from "@mui/x-data-grid";
import PaymentHistory from "../sections/PaymentHistory";
import Settings from "../sections/Settings";
import { API_BASE_URL } from "../../../config/apiBaseUrl";
import { fetchWithAuth } from "../../../utils/authApi";
import { formatIsoDate } from "../../../utils/dateTime";
import { resolveSiteDetails } from "../../../utils/siteDetails";
import { buildSubscriptionView } from "../../../utils/subscription";
import { getStripeSupportedCurrencies } from "../../../utils/stripeCurrencies";

const billingTabs = ["Billing", "Payment History"];

const readLocalFirst = (keys = []) => {
  if (typeof window === "undefined") return "";
  for (const key of keys) {
    const value = String(window.localStorage.getItem(key) || "").trim();
    if (value) return value;
  }
  return "";
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePlan = (row = {}) => ({
  plan_id: toNumber(row?.plan_id, 0),
  plan_key: String(row?.plan_key || "").trim(),
  plan_name: String(row?.plan_name || "Untitled Plan").trim(),
  price: toNumber(row?.price, 0),
  default_currency:
    String(row?.default_currency || "INR")
      .trim()
      .toUpperCase() || "INR",
  interval_days: Math.max(toNumber(row?.interval_days, 30), 1),
  max_users: toNumber(row?.max_users, 0),
  max_storage_mb: toNumber(row?.max_storage_mb, 0),
  status: String(row?.status || "active")
    .trim()
    .toLowerCase(),
});

const isTrialPlan = (plan = {}) => {
  const key = String(plan?.plan_key || "")
    .trim()
    .toLowerCase();
  const name = String(plan?.plan_name || "")
    .trim()
    .toLowerCase();
  return key === "trial" || name === "trial";
};

const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const normalizeUserCountInput = (value, fallback = 1) => {
  const digitsOnly = String(value || "").replace(/[^\d]/g, "");
  if (!digitsOnly) return String(Math.max(toNumber(fallback, 1), 1));
  return String(Math.max(toNumber(digitsOnly, 1), 1));
};

const formatCurrency = (amount, currency) => {
  const normalized = String(currency || "INR").toUpperCase();
  const locale = normalized === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: normalized,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(amount, 0));
};

const PAYPAL_FAVICON_URL =
  "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://paypal.com&size=256";
const STRIPE_FAVICON_URL =
  "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://stripe.com&size=256";

const getGatewayFromMethod = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .split(/[,\|/]/)[0]
    .split(":")[0]
    .trim();

const normalizePlanSummary = (payload = {}) => {
  const data = payload?.data || {};
  const counts = data?.counts || {};
  const features = Array.isArray(data?.features) ? data.features : [];
  return {
    counts: {
      total: toNumber(counts?.total, 0),
      active: toNumber(counts?.active, 0),
      inactive: toNumber(counts?.inactive, 0),
    },
    features,
  };
};

const dedupeBillingAddresses = (rows = []) => {
  const list = Array.isArray(rows) ? rows : [];
  const seen = new Set();
  const output = [];
  for (const row of list) {
    const idPart = String(row?.billing_address_id || "").trim();
    const signature = [
      String(row?.full_name || "")
        .trim()
        .toLowerCase(),
      String(row?.email || "")
        .trim()
        .toLowerCase(),
      String(row?.mobile || "").trim(),
      String(row?.address_line1 || "")
        .trim()
        .toLowerCase(),
      String(row?.city || "")
        .trim()
        .toLowerCase(),
      String(row?.state || "")
        .trim()
        .toLowerCase(),
      String(row?.postal_code || "").trim(),
      String(row?.country || "")
        .trim()
        .toLowerCase(),
    ].join("|");
    const key = idPart || signature;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(row);
  }
  return output;
};

const statusChipSx = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (
    normalized === "active" ||
    normalized === "paid" ||
    normalized === "completed"
  ) {
    return {
      backgroundColor: "rgba(46, 125, 50, 0.14)",
      border: "1px solid rgba(46, 125, 50, 0.45)",
      color: "#1b5e20",
      fontWeight: 700,
    };
  }
  if (normalized === "inactive" || normalized === "failed") {
    return {
      backgroundColor: "rgba(211, 47, 47, 0.14)",
      border: "1px solid rgba(211, 47, 47, 0.45)",
      color: "#b71c1c",
      fontWeight: 700,
    };
  }
  return {
    backgroundColor: "rgba(71, 85, 105, 0.12)",
    border: "1px solid rgba(71, 85, 105, 0.4)",
    color: "#334155",
    fontWeight: 700,
  };
};

const BillingPanel = ({
  adminData,
  plans,
  planSummaries,
  planComparisonRows,
  comparisonLoading,
  currencies,
  currenciesLoading,
  couponCodes,
  paymentGateways,
  gatewaysLoading,
  siteProfile,
  savedBillingAddress,
  recentBillingAddresses,
  billingAddressLoading,
  billingAddressSaving,
  onSaveBillingAddress,
  loadingPlans,
  plansError,
  quote,
  quoteLoading,
  quoteError,
  checkoutMessage,
  checkoutLoading,
  onRefreshPlans,
  onEnsurePlanSummary,
  onRequestQuote,
  onStartCheckout,
}) => {
  const theme = useTheme();
  const summary = adminData?.organizationSummary || {};
  const counts = summary?.counts || {};
  const currentPlan = summary?.current_plan || {};
  const subscriptionView = buildSubscriptionView(currentPlan, {
    activeUsers: Math.max(toNumber(counts?.active_members, 0), 1),
    fallbackName: "-",
  });
  const currentPlanId = toNumber(currentPlan?.plan_id, 0);
  const activeUsers = Math.max(toNumber(counts?.active_members, 0), 1);
  const invitedUsers = toNumber(counts?.invited_members, 0);
  const siteDetails = useMemo(
    () => resolveSiteDetails(siteProfile, summary?.organization?.name || ""),
    [siteProfile, summary?.organization?.name],
  );
  const defaultCompany = String(
    siteDetails.name ||
      summary?.organization?.name ||
      readLocalFirst(["company", "organization_name", "org_name"]) ||
      "",
  ).trim();
  const defaultName = String(
    readLocalFirst(["name", "user_name", "full_name"]) || "",
  ).trim();
  const defaultEmail = String(
    readLocalFirst(["email", "user_email"]) || siteDetails.email || "",
  )
    .trim()
    .toLowerCase();

  const [cycle, setCycle] = useState("month");
  const [selectedPlanId, setSelectedPlanId] = useState(0);
  const [selectedUsers, setSelectedUsers] = useState(
    String(activeUsers + invitedUsers || 1),
  );
  const [currency, setCurrency] = useState("INR");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const [selectedGateway, setSelectedGateway] = useState("stripe");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [addressMode, setAddressMode] = useState("new");
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [couponToast, setCouponToast] = useState({
    open: false,
    message: "",
    severity: "error",
  });
  const addressAutoSelectRef = useRef(false);
  const [billingAddress, setBillingAddress] = useState({
    full_name: defaultName,
    company: defaultCompany,
    address_line1: "",
    city: "",
    state: "",
    postal_code: "",
    country: "India",
    email: defaultEmail,
    mobile: "",
  });

  const resolvedUserCount = Math.max(toNumber(selectedUsers, 1), 1);
  const enabledGateways = useMemo(() => {
    const rows = Array.isArray(paymentGateways) ? paymentGateways : [];
    const filtered = rows
      .filter((row) => {
        const status = String(row?.status || "")
          .trim()
          .toLowerCase();
        return Boolean(row?.is_enabled) && (status === "active" || !status);
      })
      .sort(
        (a, b) => toNumber(a.display_order, 0) - toNumber(b.display_order, 0),
      );
    if (filtered.length) return filtered;
    return [
      {
        gateway_key: "stripe",
        gateway_name: "Stripe",
        provider: "stripe",
        is_enabled: true,
        display_order: 1,
        config_json: {},
      },
    ];
  }, [paymentGateways]);

  useEffect(() => {
    if (!enabledGateways.length) return;
    const hasSelected = enabledGateways.some(
      (row) =>
        String(row?.gateway_key || "")
          .trim()
          .toLowerCase() ===
        String(selectedGateway || "")
          .trim()
          .toLowerCase(),
    );
    if (!hasSelected) {
      setSelectedGateway(
        String(enabledGateways[0]?.gateway_key || "stripe")
          .trim()
          .toLowerCase() || "stripe",
      );
    }
  }, [enabledGateways, selectedGateway]);

  useEffect(() => {
    setBillingAddress((prev) => ({
      ...prev,
      company: prev.company || defaultCompany,
      full_name: prev.full_name || defaultName,
      email: prev.email || defaultEmail,
    }));
  }, [defaultCompany, defaultEmail, defaultName]);

  useEffect(() => {
    if (!savedBillingAddress) return;
    setBillingAddress((prev) => ({
      ...prev,
      full_name: String(savedBillingAddress.full_name || prev.full_name || ""),
      company: String(savedBillingAddress.company_name || prev.company || ""),
      email: String(savedBillingAddress.email || prev.email || ""),
      mobile: String(savedBillingAddress.mobile || prev.mobile || ""),
      address_line1: String(
        savedBillingAddress.address_line1 || prev.address_line1 || "",
      ),
      address_line2: String(
        savedBillingAddress.address_line2 || prev.address_line2 || "",
      ),
      city: String(savedBillingAddress.city || prev.city || ""),
      state: String(savedBillingAddress.state || prev.state || ""),
      postal_code: String(
        savedBillingAddress.postal_code || prev.postal_code || "",
      ),
      country: String(savedBillingAddress.country || prev.country || ""),
    }));
  }, [savedBillingAddress]);

  useEffect(() => {
    if (
      !Array.isArray(recentBillingAddresses) ||
      !recentBillingAddresses.length
    ) {
      addressAutoSelectRef.current = false;
      return;
    }
    if (addressAutoSelectRef.current) return;
    const defaultRow =
      recentBillingAddresses.find((row) => Boolean(row?.is_default)) ||
      recentBillingAddresses[0];
    const nextId = String(defaultRow?.billing_address_id || "");
    if (!nextId) return;
    setAddressMode("saved");
    setSelectedAddressId(nextId);
    addressAutoSelectRef.current = true;
  }, [recentBillingAddresses]);

  useEffect(() => {
    if (
      Array.isArray(recentBillingAddresses) &&
      recentBillingAddresses.length > 0
    )
      return;
    setAddressMode("new");
    setSelectedAddressId("");
  }, [recentBillingAddresses]);

  useEffect(() => {
    if (addressMode !== "saved" || !selectedAddressId) return;
    const selected = Array.isArray(recentBillingAddresses)
      ? recentBillingAddresses.find(
          (row) =>
            String(row?.billing_address_id || "") === String(selectedAddressId),
        )
      : null;
    if (!selected) return;
    setBillingAddress((prev) => ({
      ...prev,
      full_name: String(selected.full_name || prev.full_name || ""),
      company: String(selected.company_name || prev.company || ""),
      email: String(selected.email || prev.email || ""),
      mobile: String(selected.mobile || prev.mobile || ""),
      address_line1: String(selected.address_line1 || prev.address_line1 || ""),
      address_line2: String(selected.address_line2 || prev.address_line2 || ""),
      city: String(selected.city || prev.city || ""),
      state: String(selected.state || prev.state || ""),
      postal_code: String(selected.postal_code || prev.postal_code || ""),
      country: String(selected.country || prev.country || ""),
    }));
  }, [addressMode, selectedAddressId, recentBillingAddresses]);

  useEffect(() => {
    if (!plans.length) return;
    const hasSelected = plans.some((plan) => plan.plan_id === selectedPlanId);
    if (hasSelected) return;

    const hasCurrentPlan =
      currentPlanId > 0 && plans.some((plan) => plan.plan_id === currentPlanId);
    if (hasCurrentPlan) {
      setSelectedPlanId(currentPlanId);
      return;
    }

    setSelectedPlanId(plans[0].plan_id);
  }, [selectedPlanId, currentPlanId, plans]);

  useEffect(() => {
    if (!selectedPlanId) return;
    onEnsurePlanSummary(selectedPlanId);
  }, [selectedPlanId, onEnsurePlanSummary]);

  useEffect(() => {
    if (!selectedPlanId) return;
    const userCount = resolvedUserCount;
    onRequestQuote({
      plan_id: selectedPlanId,
      user_count: userCount,
      cycle,
      country: billingAddress.country || "",
      currency,
      coupon_code: String(appliedCouponCode || "")
        .trim()
        .toUpperCase(),
    });
  }, [
    selectedPlanId,
    resolvedUserCount,
    cycle,
    billingAddress.country,
    currency,
    appliedCouponCode,
    onRequestQuote,
  ]);

  useEffect(() => {
    const hasAppliedCoupon = Boolean(String(appliedCouponCode || "").trim());
    if (!hasAppliedCoupon || !quoteError) return;
    setCouponToast({
      open: true,
      message: String(quoteError || "Invalid coupon code"),
      severity: "error",
    });
  }, [quoteError, appliedCouponCode]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.plan_id === selectedPlanId) || null,
    [plans, selectedPlanId],
  );

  useEffect(() => {
    if (!selectedPlan?.default_currency) return;
    setCurrency(String(selectedPlan.default_currency || "INR").toUpperCase());
  }, [selectedPlan?.default_currency]);

  useEffect(() => {
    if (!currencies.length) return;
    const exists = currencies.some(
      (item) =>
        String(item?.currency_code || "").toUpperCase() ===
        String(currency || "").toUpperCase(),
    );
    if (exists) return;
    const fallbackCode = String(
      selectedPlan?.default_currency || "INR",
    ).toUpperCase();
    const fallback =
      currencies.find(
        (item) =>
          String(item?.currency_code || "").toUpperCase() === fallbackCode,
      ) ||
      currencies.find(
        (item) => String(item?.currency_code || "").toUpperCase() === "INR",
      ) ||
      currencies[0];
    setCurrency(String(fallback?.currency_code || "INR").toUpperCase());
  }, [currencies, currency, selectedPlan?.default_currency]);

  const totalSeats = selectedPlan?.max_users > 0 ? selectedPlan.max_users : 0;
  const seatUsagePercent =
    totalSeats > 0
      ? Math.min(Math.round((activeUsers / totalSeats) * 100), 100)
      : 0;
  const selectedFeatures =
    planSummaries[selectedPlanId]?.counts?.active ?? "--";
  const billingType =
    selectedPlanId && currentPlanId && selectedPlanId === currentPlanId
      ? "renewal"
      : "upgrade";
  const discountAmount = toNumber(quote?.discount_amount, 0);
  const totalBeforeDiscount = toNumber(
    quote?.total_before_discount ?? quote?.subtotal ?? quote?.total,
    0,
  );
  const grandTotalAmount = toNumber(quote?.total, 0);
  const discountPercent =
    totalBeforeDiscount > 0
      ? Number(((discountAmount / totalBeforeDiscount) * 100).toFixed(2))
      : 0;
  const normalizedInputCoupon = String(couponInput || "")
    .trim()
    .toUpperCase();
  const normalizedAppliedCoupon = String(appliedCouponCode || "")
    .trim()
    .toUpperCase();
  const couponDirty = normalizedInputCoupon !== normalizedAppliedCoupon;
  const hasAppliedCoupon = Boolean(normalizedAppliedCoupon);
  const resolveGatewayUi = (gatewayRow) => {
    const key = String(gatewayRow?.gateway_key || "")
      .trim()
      .toLowerCase();
    const isPaypal = key === "paypal";
    const isStripe = key === "stripe";
    return {
      key,
      label: String(
        gatewayRow?.gateway_name || gatewayRow?.gateway_key || "Gateway",
      )
        .trim()
        .toUpperCase(),
      iconLetter: isPaypal ? "P" : isStripe ? "S" : "G",
      iconUrl: isPaypal
        ? PAYPAL_FAVICON_URL
        : isStripe
          ? STRIPE_FAVICON_URL
          : "",
      iconBg: isPaypal
        ? "linear-gradient(135deg, #e6f4ff 0%, #bfdbfe 100%)"
        : isStripe
          ? "linear-gradient(135deg, #e9e7ff 0%, #c4b5fd 100%)"
          : "linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)",
      iconColor: isPaypal ? "#0369a1" : isStripe ? "#4c1d95" : "#334155",
      cardBorder: isPaypal
        ? "rgba(14,116,144,0.34)"
        : isStripe
          ? "rgba(76,29,149,0.34)"
          : "rgba(51,65,85,0.28)",
      cardBg: isPaypal
        ? "rgba(240,249,255,0.95)"
        : isStripe
          ? "rgba(245,243,255,0.95)"
          : "rgba(248,250,252,0.96)",
      testBg: isPaypal ? "rgba(251,191,36,0.2)" : "rgba(251,191,36,0.2)",
      testColor: "#92400e",
    };
  };

  const handleApplyCoupon = () => {
    const value = String(couponInput || "")
      .trim()
      .toUpperCase();
    if (!value) {
      setCouponToast({
        open: true,
        message: "Coupon code is required",
        severity: "error",
      });
      return;
    }
    const isMatched = Array.isArray(couponCodes)
      ? couponCodes.some(
          (code) =>
            String(code || "")
              .trim()
              .toUpperCase() === value,
        )
      : false;
    if (!isMatched) {
      setCouponToast({
        open: true,
        message: "Invalid coupon code",
        severity: "error",
      });
      return;
    }
    setAppliedCouponCode(value);
    setCouponInput(value);
    setCouponToast({
      open: true,
      message: `${value} matched`,
      severity: "success",
    });
  };

  const handleClearCoupon = () => {
    setCouponInput("");
    setAppliedCouponCode("");
  };

  const stepValid =
    currentStep === 1
      ? Boolean(selectedPlanId && resolvedUserCount)
      : currentStep === 2
        ? addressMode === "saved"
          ? Boolean(
              String(selectedAddressId || "").trim() || savedBillingAddress,
            )
          : Boolean(
              String(billingAddress.full_name || "").trim() &&
                String(billingAddress.company || "").trim() &&
                String(billingAddress.address_line1 || "").trim() &&
                String(billingAddress.city || "").trim() &&
                String(billingAddress.state || "").trim() &&
                String(billingAddress.postal_code || "").trim() &&
                String(billingAddress.country || "").trim() &&
                String(billingAddress.mobile || "").trim() &&
                isValidEmail(billingAddress.email),
            )
        : agreeTerms;

  const handleCheckout = async () => {
    if (!agreeTerms) return;
    const userCount = resolvedUserCount;
    const selectedCountry = String(billingAddress.country || "").trim();
    await onStartCheckout({
      gateway: selectedGateway,
      plan_id: selectedPlanId,
      user_count: userCount,
      cycle,
      country: selectedCountry,
      currency,
      coupon_code: normalizedAppliedCoupon,
      billing_type: billingType,
      billing_email: billingAddress.email,
      address: {
        ...billingAddress,
        country: selectedCountry,
      },
    });
  };

  const handleSaveAddress = async () => {
    if (addressMode === "saved") return true;
    if (typeof onSaveBillingAddress !== "function") return true;
    return onSaveBillingAddress({
      ...billingAddress,
      country: String(billingAddress.country || "").trim(),
      create_new: addressMode === "new",
    });
  };

  const handleUsersChange = (event) => {
    const nextValue = String(event.target.value || "");
    if (!/^\d*$/.test(nextValue)) return;
    setSelectedUsers(nextValue);
  };

  const handleUsersBlur = () => {
    setSelectedUsers((prev) =>
      normalizeUserCountInput(prev, activeUsers + invitedUsers || 1),
    );
  };

  const handleNextStep = async () => {
    if (currentStep === 2) {
      const ok = await handleSaveAddress();
      if (!ok) return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  };

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
      }}
    >
      <Box sx={{ p: { xs: 1.4, md: 2 } }}>
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 1.4, md: 1.8 },
            borderRadius: 2.2,
            borderColor: alpha(theme.palette.divider, 0.9),
            background:
              theme.palette.mode === "light"
                ? "#fff"
                : alpha(theme.palette.background.paper, 0.88),
          }}
        >
          <Typography variant="h5" fontWeight={800}>
            Billing Overview
          </Typography>
        </Paper>
      </Box>
      <Stack spacing={2.2} sx={{ p: 2.4 }}>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip
            label={`Step 1: Plan`}
            color={currentStep === 1 ? "primary" : "default"}
          />
          <Chip
            label={`Step 2: Address`}
            color={currentStep === 2 ? "primary" : "default"}
          />
          <Chip
            label={`Step 3: Checkout`}
            color={currentStep === 3 ? "primary" : "default"}
          />
        </Stack>

        {currentStep === 1 ? (
          <Box sx={{ width: "100%", maxWidth: "1460px", mx: "auto" }}>
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 1.2, md: 1.5 },
                mb: 1.5,
                borderRadius: 1.8,
                borderColor: alpha(theme.palette.divider, 0.9),
                background:
                  theme.palette.mode === "light"
                    ? "#fff"
                    : alpha(theme.palette.background.paper, 0.85),
              }}
            >
              <Stack
                direction={{ xs: "column", lg: "row" }}
                spacing={1.2}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", lg: "flex-start" }}
              >
                <Grid container spacing={1.2} sx={{ flex: 1 }}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      select
                      size="small"
                      label="Select Plan"
                      fullWidth
                      value={String(selectedPlanId || "")}
                      onChange={(event) =>
                        setSelectedPlanId(toNumber(event.target.value, 0))
                      }
                    >
                      {plans.map((plan) => (
                        <MenuItem
                          key={plan.plan_id}
                          value={String(plan.plan_id)}
                        >
                          {plan.plan_name}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      size="small"
                      label="No. of Users"
                      type="number"
                      fullWidth
                      inputProps={{ min: 1 }}
                      value={selectedUsers}
                      onChange={handleUsersChange}
                      onBlur={handleUsersBlur}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      select
                      size="small"
                      label="Currency"
                      fullWidth
                      disabled={currenciesLoading}
                      value={
                        currencies.some(
                          (item) =>
                            String(item?.currency_code || "").toUpperCase() ===
                            String(currency || "").toUpperCase(),
                        )
                          ? currency
                          : ""
                      }
                      onChange={(event) =>
                        setCurrency(
                          String(
                            event.target.value ||
                              selectedPlan?.default_currency ||
                              "INR",
                          ).toUpperCase(),
                        )
                      }
                      helperText={`Default: ${String(selectedPlan?.default_currency || "INR").toUpperCase()}`}
                    >
                      {!currencies.length ? (
                        <MenuItem value="" disabled>
                          {currenciesLoading
                            ? "Loading currencies..."
                            : "No currency available"}
                        </MenuItem>
                      ) : null}
                      {currencies.map((item) => (
                        <MenuItem
                          key={String(item.currency_code || "").toUpperCase()}
                          value={String(item.currency_code || "").toUpperCase()}
                        >
                          {String(item.currency_code || "").toUpperCase()} -{" "}
                          {item.currency_name}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                </Grid>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "stretch", sm: "center" }}
                  sx={{ minWidth: { lg: 380 } }}
                >
                  <ToggleButtonGroup
                    exclusive
                    value={cycle}
                    onChange={(_, value) => value && setCycle(value)}
                    size="small"
                    sx={{ width: { xs: "100%", sm: "auto" } }}
                  >
                    <ToggleButton value="month">Monthly</ToggleButton>
                    <ToggleButton value="year">Yearly</ToggleButton>
                  </ToggleButtonGroup>
                  <Button
                    variant="outlined"
                    onClick={() => setShowCompare(true)}
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    Compare Plans
                  </Button>
                  <Button
                    variant="text"
                    onClick={onRefreshPlans}
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    Refresh
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            {loadingPlans ? <LinearProgress /> : null}
            {quoteLoading ? null : null}
            {plansError ? <Alert severity="error">{plansError}</Alert> : null}
            {quoteError && !String(appliedCouponCode || "").trim() ? (
              <Alert severity="error">{quoteError}</Alert>
            ) : null}
            {checkoutMessage ? (
              <Alert severity="info">{checkoutMessage}</Alert>
            ) : null}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 12, lg: 12 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2, md: 2.4 },
                    borderRadius: 2.6,
                    border: "1px solid",
                    borderColor: "divider",
                    width: "100%",
                    maxWidth: "100%",
                    background:
                      theme.palette.mode === "light"
                        ? "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)"
                        : "linear-gradient(180deg, rgba(15,23,42,0.45) 0%, rgba(15,23,42,0.25) 100%)",
                  }}
                >
                  <Stack spacing={1.2}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography variant="subtitle2" fontWeight={800}>
                        Price Summary
                      </Typography>
                      <Chip
                        size="small"
                        label={String(
                          quote?.currency || currency || "INR",
                        ).toUpperCase()}
                        variant="outlined"
                        sx={{ fontWeight: 700 }}
                      />
                    </Stack>

                    <Box
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1.5,
                        overflow: "hidden",
                      }}
                    >
                      <Box sx={{ overflowX: "auto" }}>
                        <Box sx={{ minWidth: 780 }}>
                          <Box
                            sx={{
                              display: "grid",
                              gridTemplateColumns:
                                "70px 1.1fr 1fr 1.2fr 1fr 1.2fr",
                              backgroundColor: "action.hover",
                              borderBottom: "1px solid",
                              borderColor: "divider",
                            }}
                          >
                            {[
                              "S.NO",
                              "PLAN",
                              "NO.OF USERS",
                              "PER USER PRICE/MONTH",
                              "PERIOD (MONTHS)",
                              "EXTENDED PRICE",
                            ].map((label) => (
                              <Typography
                                key={label}
                                variant="caption"
                                fontWeight={800}
                                sx={{ p: 1.1 }}
                              >
                                {label}
                              </Typography>
                            ))}
                          </Box>
                          <Box
                            sx={{
                              display: "grid",
                              gridTemplateColumns:
                                "70px 1.1fr 1fr 1.2fr 1fr 1.2fr",
                            }}
                          >
                            <Typography sx={{ p: 1.1 }}>1</Typography>
                            <Typography sx={{ p: 1.1 }}>
                              {selectedPlan?.plan_name || "-"}
                            </Typography>
                            <Typography sx={{ p: 1.1 }}>
                              {resolvedUserCount}
                            </Typography>
                            <Typography
                              sx={{
                                p: 1.1,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {formatCurrency(
                                quote?.per_user_monthly,
                                quote?.currency || currency,
                              )}
                            </Typography>
                            <Typography sx={{ p: 1.1 }}>
                              {cycle === "year" ? 12 : 1}
                            </Typography>
                            <Typography
                              sx={{
                                p: 1.1,
                                fontWeight: 800,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {formatCurrency(
                                totalBeforeDiscount,
                                quote?.currency || currency,
                              )}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Box>

                    <Box
                      sx={{
                        ml: "auto",
                        width: { xs: "100%", sm: 360 },
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1.3,
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          borderBottom: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography sx={{ p: 1.1, fontWeight: 700 }}>
                          Sub Total
                        </Typography>
                        <Typography
                          sx={{
                            p: 1.1,
                            fontWeight: 800,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {formatCurrency(
                            totalBeforeDiscount,
                            quote?.currency || currency,
                          )}
                        </Typography>
                      </Box>
                      {discountAmount > 0 ? (
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            borderBottom: "1px solid",
                            borderColor: "divider",
                          }}
                        >
                          <Typography sx={{ p: 1.1, fontWeight: 700 }}>
                            Discount{" "}
                            {quote?.coupon?.coupon_code
                              ? `(${quote.coupon.coupon_code})`
                              : ""}
                          </Typography>
                          <Typography
                            sx={{
                              p: 1.1,
                              fontWeight: 800,
                              color: "success.main",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            -
                            {formatCurrency(
                              discountAmount,
                              quote?.currency || currency,
                            )}
                          </Typography>
                        </Box>
                      ) : null}
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          backgroundColor: "action.hover",
                        }}
                      >
                        <Typography sx={{ p: 1.1, fontWeight: 900 }}>
                          Grand Total
                        </Typography>
                        <Typography
                          sx={{
                            p: 1.1,
                            fontWeight: 900,
                            fontVariantNumeric: "tabular-nums",
                            fontSize: { xs: 24, sm: 28 },
                          }}
                        >
                          {formatCurrency(
                            grandTotalAmount,
                            quote?.currency || currency,
                          )}
                        </Typography>
                      </Box>
                    </Box>

                    {discountAmount > 0 ? (
                      <Typography
                        variant="caption"
                        color="success.main"
                        fontWeight={700}
                      >
                        You save{" "}
                        {formatCurrency(
                          discountAmount,
                          quote?.currency || currency,
                        )}{" "}
                        ({discountPercent}%)
                      </Typography>
                    ) : null}
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        ) : null}

        {currentStep === 2 ? (
          <Box sx={{ width: "100%", maxWidth: "100%" }}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 1.25, md: 1.8 },
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2.2,
                background:
                  theme.palette.mode === "light"
                    ? "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)"
                    : "linear-gradient(180deg, rgba(15,23,42,0.45) 0%, rgba(15,23,42,0.25) 100%)",
              }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                alignItems={{ xs: "flex-start", md: "center" }}
                justifyContent="space-between"
                spacing={1}
                sx={{ mb: 1.1 }}
              >
                <Typography variant="subtitle1" fontWeight={800}>
                  Billing Address
                </Typography>
                <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap">
                  <Chip
                    size="small"
                    label={billingType === "renewal" ? "Renewal" : "Upgrade"}
                    sx={{
                      textTransform: "capitalize",
                      ...statusChipSx("active"),
                    }}
                  />
                </Stack>
              </Stack>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.1}
                sx={{ mb: 1.1 }}
              >
                <TextField
                  select
                  size="small"
                  fullWidth
                  label="Select Previous Address"
                  value={
                    addressMode === "saved"
                      ? String(selectedAddressId || "")
                      : ""
                  }
                  onChange={(event) => {
                    setAddressMode("saved");
                    setSelectedAddressId(String(event.target.value || ""));
                  }}
                  disabled={
                    !Array.isArray(recentBillingAddresses) ||
                    recentBillingAddresses.length === 0
                  }
                >
                  {(Array.isArray(recentBillingAddresses)
                    ? recentBillingAddresses
                    : []
                  )
                    .slice(0, 2)
                    .map((row) => (
                      <MenuItem
                        key={String(row.billing_address_id)}
                        value={String(row.billing_address_id)}
                      >
                        {`${row.full_name || "User"} - ${row.address_line1 || ""}, ${row.city || ""}`}
                      </MenuItem>
                    ))}
                </TextField>
                <Button
                  variant={addressMode === "new" ? "contained" : "outlined"}
                  onClick={() => {
                    setAddressMode("new");
                    setSelectedAddressId("");
                    setBillingAddress((prev) => ({
                      ...prev,
                      full_name: prev.full_name || defaultName,
                      company: prev.company || defaultCompany,
                      email: prev.email || defaultEmail,
                      mobile: prev.mobile || "",
                      address_line1: "",
                      address_line2: "",
                      city: "",
                      state: "",
                      postal_code: "",
                      country: prev.country || "India",
                    }));
                  }}
                  sx={{
                    whiteSpace: "nowrap",
                    minWidth: 170,
                    height: 40,
                  }}
                >
                  Add New Address
                </Button>
              </Stack>
              {addressMode === "saved" ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 1.6, md: 2 },
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    background:
                      theme.palette.mode === "light"
                        ? "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)"
                        : "linear-gradient(180deg, rgba(15,23,42,0.55) 0%, rgba(15,23,42,0.35) 100%)",
                  }}
                >
                  <Stack spacing={1}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Typography variant="subtitle2" fontWeight={800}>
                        Saved Billing Address
                      </Typography>
                      <Chip
                        size="small"
                        label="Using Selected Address"
                        sx={{
                          alignSelf: "flex-start",
                          ...statusChipSx("active"),
                        }}
                      />
                    </Stack>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "1fr",
                          md: "repeat(2, minmax(0, 1fr))",
                        },
                        gap: 1,
                      }}
                    >
                      <Paper
                        variant="outlined"
                        sx={{ p: 1.2, borderRadius: 1.5 }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Name
                        </Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {billingAddress.full_name || "-"}
                        </Typography>
                      </Paper>
                      <Paper
                        variant="outlined"
                        sx={{ p: 1.2, borderRadius: 1.5 }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Company
                        </Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {billingAddress.company || "-"}
                        </Typography>
                      </Paper>
                      <Paper
                        variant="outlined"
                        sx={{ p: 1.2, borderRadius: 1.5 }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Address
                        </Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {billingAddress.address_line1 || "-"}
                        </Typography>
                      </Paper>
                      <Paper
                        variant="outlined"
                        sx={{ p: 1.2, borderRadius: 1.5 }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Country / State / City / Postal
                        </Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {[
                            billingAddress.country || "-",
                            billingAddress.state || "-",
                            billingAddress.city || "-",
                            billingAddress.postal_code || "-",
                          ].join(" / ")}
                        </Typography>
                      </Paper>
                      <Paper
                        variant="outlined"
                        sx={{ p: 1.2, borderRadius: 1.5 }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Email
                        </Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {billingAddress.email || "-"}
                        </Typography>
                      </Paper>
                      <Paper
                        variant="outlined"
                        sx={{ p: 1.2, borderRadius: 1.5 }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Mobile
                        </Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {billingAddress.mobile || "-"}
                        </Typography>
                      </Paper>
                    </Box>
                  </Stack>
                </Paper>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(2, minmax(0, 1fr))",
                    },
                    gap: 1.2,
                  }}
                >
                  <TextField
                    fullWidth
                    size="small"
                    label="Full Name"
                    value={billingAddress.full_name}
                    onChange={(event) =>
                      setBillingAddress((prev) => ({
                        ...prev,
                        full_name: event.target.value,
                      }))
                    }
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Company"
                    value={billingAddress.company}
                    onChange={(event) =>
                      setBillingAddress((prev) => ({
                        ...prev,
                        company: event.target.value,
                      }))
                    }
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Address"
                    value={billingAddress.address_line1}
                    onChange={(event) =>
                      setBillingAddress((prev) => ({
                        ...prev,
                        address_line1: event.target.value,
                      }))
                    }
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Address Line 2"
                    value={billingAddress.address_line2 || ""}
                    onChange={(event) =>
                      setBillingAddress((prev) => ({
                        ...prev,
                        address_line2: event.target.value,
                      }))
                    }
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="City"
                    value={billingAddress.city}
                    onChange={(event) =>
                      setBillingAddress((prev) => ({
                        ...prev,
                        city: event.target.value,
                      }))
                    }
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Postal Code"
                    value={billingAddress.postal_code}
                    onChange={(event) =>
                      setBillingAddress((prev) => ({
                        ...prev,
                        postal_code: event.target.value,
                      }))
                    }
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Country"
                    value={billingAddress.country}
                    onChange={(event) =>
                      setBillingAddress((prev) => ({
                        ...prev,
                        country: event.target.value,
                      }))
                    }
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="State"
                    value={billingAddress.state}
                    onChange={(event) =>
                      setBillingAddress((prev) => ({
                        ...prev,
                        state: event.target.value,
                      }))
                    }
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Email"
                    type="email"
                    value={billingAddress.email}
                    onChange={(event) =>
                      setBillingAddress((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Mobile"
                    value={billingAddress.mobile}
                    onChange={(event) =>
                      setBillingAddress((prev) => ({
                        ...prev,
                        mobile: event.target.value,
                      }))
                    }
                  />
                </Box>
              )}
            </Paper>
          </Box>
        ) : null}

        {currentStep === 3 ? (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 1.8, md: 2.5 },
              borderRadius: 2.6,
              border: "1px solid",
              borderColor: "divider",
              background:
                theme.palette.mode === "light"
                  ? "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)"
                  : "linear-gradient(180deg, rgba(15,23,42,0.55) 0%, rgba(15,23,42,0.28) 100%)",
              boxShadow:
                theme.palette.mode === "light"
                  ? "0 14px 40px rgba(15,23,42,0.06)"
                  : "none",
            }}
          >
            <Stack spacing={1.6}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                alignItems={{ xs: "flex-start", md: "center" }}
                justifyContent="space-between"
                spacing={1}
              >
                <Typography variant="h6" fontWeight={900}>
                  Checkout Summary
                </Typography>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "stretch", sm: "center" }}
                >
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setCurrentStep(1)}
                    sx={{
                      textTransform: "none",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Edit Plan & Users
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setCurrentStep(2)}
                    sx={{
                      textTransform: "none",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Edit Address
                  </Button>
                  <Chip
                    size="small"
                    label={`${selectedPlan?.plan_name || "Plan"} | ${cycle === "year" ? "Yearly" : "Monthly"}`}
                    sx={{
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                      color: "text.primary",
                      fontWeight: 700,
                    }}
                  />
                </Stack>
              </Stack>

              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1.6,
                  overflow: "hidden",
                }}
              >
                <Box sx={{ overflowX: "auto" }}>
                  <Box sx={{ minWidth: 820 }}>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "80px 1.2fr 1fr 1.2fr 1fr 1.2fr",
                        backgroundColor: "action.hover",
                        borderBottom: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      {[
                        "S.NO",
                        "PLAN",
                        "NO.OF USERS",
                        "PER USER PRICE/MONTH",
                        "PERIOD (MONTHS)",
                        "EXTENDED PRICE",
                      ].map((label) => (
                        <Typography
                          key={label}
                          variant="caption"
                          fontWeight={800}
                          sx={{ p: 1.2 }}
                        >
                          {label}
                        </Typography>
                      ))}
                    </Box>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "80px 1.2fr 1fr 1.2fr 1fr 1.2fr",
                      }}
                    >
                      <Typography sx={{ p: 1.2 }}>1</Typography>
                      <Typography sx={{ p: 1.2 }}>
                        {selectedPlan?.plan_name || "-"}
                      </Typography>
                      <Typography sx={{ p: 1.2 }}>
                        {resolvedUserCount}
                      </Typography>
                      <Typography sx={{ p: 1.2 }}>
                        {formatCurrency(
                          quote?.per_user_monthly,
                          quote?.currency || currency,
                        )}
                      </Typography>
                      <Typography sx={{ p: 1.2 }}>
                        {cycle === "year" ? 12 : 1}
                      </Typography>
                      <Typography sx={{ p: 1.2, fontWeight: 700 }}>
                        {formatCurrency(
                          totalBeforeDiscount,
                          quote?.currency || currency,
                        )}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>

              <Grid container spacing={2} alignItems="stretch">
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper
                    variant="outlined"
                    sx={{ p: 1.4, borderRadius: 1.4, height: "100%" }}
                  >
                    <Stack spacing={1}>
                      <Typography variant="subtitle2" fontWeight={700}>
                        Coupon
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        label="Coupon Code"
                        value={couponInput}
                        onChange={(event) => setCouponInput(event.target.value)}
                        placeholder="Optional"
                      />
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={handleApplyCoupon}
                          disabled={!normalizedInputCoupon || !couponDirty}
                        >
                          Apply
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          onClick={handleClearCoupon}
                          disabled={!hasAppliedCoupon && !normalizedInputCoupon}
                        >
                          Clear
                        </Button>
                      </Stack>
                      {discountAmount > 0 ? (
                        <Typography
                          variant="caption"
                          color="success.main"
                          fontWeight={700}
                        >
                          You save{" "}
                          {formatCurrency(
                            discountAmount,
                            quote?.currency || currency,
                          )}{" "}
                          ({discountPercent}%)
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Enter coupon and click apply.
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: { xs: "stretch", md: "flex-end" },
                      height: "100%",
                    }}
                  >
                    <Box
                      sx={{
                        width: "100%",
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1.2,
                        overflow: "hidden",
                        backgroundColor: "background.paper",
                      }}
                    >
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          borderBottom: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography sx={{ p: 1.2 }} fontWeight={700}>
                          Sub Total
                        </Typography>
                        <Typography
                          sx={{
                            p: 1.2,
                            fontWeight: 700,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {formatCurrency(
                            totalBeforeDiscount,
                            quote?.currency || currency,
                          )}
                        </Typography>
                      </Box>
                      {discountAmount > 0 ? (
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            borderBottom: "1px solid",
                            borderColor: "divider",
                          }}
                        >
                          <Typography sx={{ p: 1.2 }} fontWeight={800}>
                            Discount{" "}
                            {quote?.coupon?.coupon_code
                              ? `(${quote.coupon.coupon_code})`
                              : ""}
                          </Typography>
                          <Typography
                            sx={{
                              p: 1.2,
                              fontWeight: 800,
                              color: "success.main",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            -
                            {formatCurrency(
                              discountAmount,
                              quote?.currency || currency,
                            )}
                          </Typography>
                        </Box>
                      ) : null}
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          backgroundColor: "action.hover",
                        }}
                      >
                        <Typography sx={{ p: 1.2 }} fontWeight={900}>
                          Grand Total
                        </Typography>
                        <Typography
                          sx={{
                            p: 1.2,
                            fontWeight: 900,
                            fontVariantNumeric: "tabular-nums",
                            fontSize: 30,
                          }}
                        >
                          {formatCurrency(
                            grandTotalAmount,
                            quote?.currency || currency,
                          )}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Grid>
              </Grid>

              <Paper
                variant="outlined"
                sx={{ p: { xs: 1.2, md: 1.5 }, borderRadius: 1.6 }}
              >
                <Typography
                  variant="subtitle2"
                  fontWeight={800}
                  sx={{ mb: 0.8 }}
                >
                  TERM
                </Typography>
                <Typography variant="body2">
                  1. You can add or remove users before upgrade/renewal
                  confirmation.
                </Typography>
                <Typography variant="body2">
                  2. Discount applies only to current billing cycle.
                </Typography>
              </Paper>

              <Stack spacing={1.5}>
                {/* Express Checkout — gateway button selector */}
                <Box
                  sx={{
                    position: "relative",
                    border: "1.5px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 1.5,
                    pt: 2.2,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      position: "absolute",
                      top: -10,
                      left: 10,
                      backgroundColor: "background.paper",
                      px: 0.8,
                      fontWeight: 700,
                      color: "text.secondary",
                      fontSize: "0.72rem",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Express Checkout
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {enabledGateways.map((gateway) => {
                      const ui = resolveGatewayUi(gateway);
                      const isSelected =
                        String(gateway?.gateway_key || "")
                          .trim()
                          .toLowerCase() ===
                        String(selectedGateway || "")
                          .trim()
                          .toLowerCase();
                      const mode = String(
                        gateway?.config_json?.active_mode ||
                          gateway?.config_json?.activeMode ||
                          "sandbox",
                      ).toLowerCase();
                      return (
                        <Box
                          key={ui.key}
                          onClick={() => {
                            if (!checkoutLoading && !gatewaysLoading)
                              setSelectedGateway(ui.key);
                          }}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            px: 2,
                            py: 0.9,
                            borderRadius: 2,
                            border: "2px solid",
                            borderColor: isSelected
                              ? ui.cardBorder
                              : "rgba(148,163,184,0.28)",
                            background: isSelected ? ui.cardBg : "#fff",
                            cursor:
                              checkoutLoading || gatewaysLoading
                                ? "not-allowed"
                                : "pointer",
                            opacity: checkoutLoading ? 0.6 : 1,
                            transition: "all .15s ease",
                            boxShadow: isSelected
                              ? `0 0 0 2px ${ui.cardBorder}`
                              : "none",
                            "&:hover": {
                              borderColor: ui.cardBorder,
                              background: ui.cardBg,
                            },
                          }}
                        >
                          {ui.iconUrl ? (
                            <Box
                              component="img"
                              src={ui.iconUrl}
                              alt={ui.label}
                              sx={{
                                width: 18,
                                height: 18,
                                objectFit: "contain",
                              }}
                            />
                          ) : (
                            <Box
                              sx={{
                                width: 18,
                                height: 18,
                                borderRadius: 0.8,
                                background: ui.iconBg,
                                display: "grid",
                                placeItems: "center",
                                fontSize: "0.68rem",
                                fontWeight: 900,
                                color: ui.iconColor,
                              }}
                            >
                              {ui.iconLetter}
                            </Box>
                          )}
                          <Typography
                            sx={{
                              fontSize: "0.82rem",
                              fontWeight: 900,
                              letterSpacing: "0.06em",
                            }}
                          >
                            {ui.label}
                          </Typography>
                          <Chip
                            size="small"
                            label={mode === "live" ? "Live" : "Test"}
                            sx={{
                              height: 18,
                              fontSize: "0.65rem",
                              fontWeight: 700,
                              backgroundColor:
                                mode === "live"
                                  ? "#dcfce7"
                                  : "rgba(251,191,36,0.22)",
                              color: mode === "live" ? "#15803d" : "#92400e",
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>

                {/* Checkbox + Pay button row */}
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  spacing={1}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <input
                      id="billing-terms"
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(event) => setAgreeTerms(event.target.checked)}
                    />
                    <Typography
                      component="label"
                      htmlFor="billing-terms"
                      variant="body2"
                      sx={{ cursor: "pointer", userSelect: "none" }}
                    >
                      I agree Terms and Conditions
                    </Typography>
                  </Stack>
                  <Button
                    variant="contained"
                    color="success"
                    size="large"
                    disabled={
                      !agreeTerms ||
                      checkoutLoading ||
                      !selectedPlanId ||
                      !selectedGateway
                    }
                    onClick={handleCheckout}
                  >
                    {checkoutLoading
                      ? "Redirecting..."
                      : `Pay with ${String(
                          enabledGateways.find(
                            (gateway) =>
                              String(gateway?.gateway_key || "")
                                .trim()
                                .toLowerCase() ===
                              String(selectedGateway || "")
                                .trim()
                                .toLowerCase(),
                          )?.gateway_name ||
                            selectedGateway ||
                            "Gateway",
                        )}`}
                  </Button>
                </Stack>
              </Stack>
            </Stack>
          </Paper>
        ) : null}

        <Dialog
          open={showCompare}
          onClose={() => setShowCompare(false)}
          fullWidth
          maxWidth={false}
          PaperProps={{
            sx: {
              width: "min(1220px, calc(100vw - 32px))",
              maxWidth: "1220px",
              m: 0,
              borderRadius: 2.2,
              border: "1px solid",
              borderColor: "divider",
              background:
                theme.palette.mode === "light"
                  ? "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)"
                  : "linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.85) 100%)",
            },
          }}
        >
          <DialogTitle sx={{ fontWeight: 800 }}>Compare Plans</DialogTitle>

          <DialogContent sx={{ pt: 0.5 }}>
            <Stack spacing={1.2}>
              {comparisonLoading ? <LinearProgress /> : null}

              <Box sx={{ height: { xs: 420, md: 520 } }}>
                <DataGrid
                  rows={planComparisonRows.map((row, index) => ({
                    id: `${row.plan_id}-${row.feature_item_id}-${index}`,
                    plan: row.plan_name,
                    category: row.category_label,
                    feature: row.feature_item_title,
                    description: row.feature_item_description,
                    status:
                      row.feature_item_status ||
                      row.plan_feature_status ||
                      "inactive",
                  }))}
                  columns={[
                    { field: "plan", headerName: "Plan", flex: 1 },

                    { field: "category", headerName: "Category", flex: 1 },

                    { field: "feature", headerName: "Feature", flex: 1.2 },

                    {
                      field: "description",
                      headerName: "Description",
                      flex: 1.6,
                    },

                    {
                      field: "status",
                      headerName: "Status",
                      width: 130,
                      align: "center",
                      headerAlign: "center",
                      renderCell: ({ value }) => (
                        <Chip
                          size="small"
                          label={String(value || "inactive")}
                          sx={{
                            textTransform: "capitalize",
                            ...statusChipSx(value),
                          }}
                        />
                      ),
                    },
                  ]}
                  disableRowSelectionOnClick
                  disableColumnMenu
                  hideFooter
                />
              </Box>

              <Stack direction="row" justifyContent="flex-end">
                <Button
                  variant="contained"
                  onClick={() => setShowCompare(false)}
                >
                  Close
                </Button>
              </Stack>
            </Stack>
          </DialogContent>
        </Dialog>

        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Button
            variant="outlined"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 1))}
          >
            Back
          </Button>
          {currentStep < 3 ? (
            <Button
              variant="contained"
              disabled={
                !stepValid || billingAddressSaving || billingAddressLoading
              }
              onClick={handleNextStep}
            >
              {currentStep === 2 && billingAddressSaving ? "Saving..." : "Next"}
            </Button>
          ) : null}
        </Stack>
      </Stack>
      <Snackbar
        open={couponToast.open}
        autoHideDuration={2800}
        onClose={() => setCouponToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() => setCouponToast((prev) => ({ ...prev, open: false }))}
          severity={couponToast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {couponToast.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

const Billing = ({ adminData }) => {
  const [currentTab, setCurrentTab] = useState(billingTabs[0]);
  const [plans, setPlans] = useState([]);
  const [planSummaries, setPlanSummaries] = useState({});
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [paymentRows, setPaymentRows] = useState([]);
  const [paymentError, setPaymentError] = useState("");
  const [repayLoadingId, setRepayLoadingId] = useState(null);
  const [resumeLoadingId, setResumeLoadingId] = useState(null);
  const [currencies, setCurrencies] = useState([]);
  const [currenciesLoading, setCurrenciesLoading] = useState(false);
  const [paymentGateways, setPaymentGateways] = useState([]);
  const [gatewaysLoading, setGatewaysLoading] = useState(false);
  const [couponCodes, setCouponCodes] = useState([]);
  const [savedBillingAddress, setSavedBillingAddress] = useState(null);
  const [recentBillingAddresses, setRecentBillingAddresses] = useState([]);
  const [billingAddressLoading, setBillingAddressLoading] = useState(false);
  const [billingAddressSaving, setBillingAddressSaving] = useState(false);
  const [siteProfile, setSiteProfile] = useState(null);
  const [planComparisonRows, setPlanComparisonRows] = useState([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const loadingSummaryRef = useRef(new Set());
  const summaryLoadedRef = useRef(new Set());

  const fetchPlans = useCallback(async () => {
    setLoadingPlans(true);
    setPlansError("");
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/plans?limit=100&offset=0`,
        { method: "GET" },
      );
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Unable to load plans");
      }
      const rows = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
      const normalizedAll = rows
        .map(normalizePlan)
        .filter((item) => item.plan_id > 0);
      const nonTrial = normalizedAll.filter((item) => !isTrialPlan(item));
      const normalized = nonTrial.length ? nonTrial : normalizedAll;
      normalized.sort(
        (a, b) => toNumber(b.plan_id, 0) - toNumber(a.plan_id, 0),
      );
      setPlans(normalized);
      setPlanSummaries({});
      summaryLoadedRef.current.clear();
      loadingSummaryRef.current.clear();
      return normalized;
    } catch (error) {
      setPlansError(error?.message || "Unable to load plans");
      setPlans([]);
      return [];
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  const ensurePlanSummary = useCallback(async (planId) => {
    const normalizedPlanId = toNumber(planId, 0);
    if (!normalizedPlanId) return;
    if (summaryLoadedRef.current.has(normalizedPlanId)) return;
    if (loadingSummaryRef.current.has(normalizedPlanId)) return;
    loadingSummaryRef.current.add(normalizedPlanId);
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/plan-features/plan/${normalizedPlanId}/summary?status=all`,
        { method: "GET" },
      );
      if (!response.ok || payload?.status === "error") {
        throw new Error(
          payload?.message || "Unable to load plan feature summary",
        );
      }
      summaryLoadedRef.current.add(normalizedPlanId);
      setPlanSummaries((prev) => ({
        ...prev,
        [normalizedPlanId]: normalizePlanSummary(payload),
      }));
    } catch {
      summaryLoadedRef.current.add(normalizedPlanId);
      setPlanSummaries((prev) => ({
        ...prev,
        [normalizedPlanId]: {
          counts: { total: 0, active: 0, inactive: 0 },
          features: [],
        },
      }));
    } finally {
      loadingSummaryRef.current.delete(normalizedPlanId);
    }
  }, []);

  const fetchPaymentHistory = useCallback(async () => {
    setPaymentError("");
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/billing/payment-history?limit=100&offset=0`,
        { method: "GET" },
      );
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Unable to load payment history");
      }
      const rows = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
      const mappedRows = rows.map((row, index) => {
        const rowCurrency =
          String(row?.currency_code || "")
            .trim()
            .toUpperCase() || "INR";
        const statusRaw =
          String(row?.payment_status || "")
            .trim()
            .toLowerCase() || "pending";
        return {
          id: row?.payment_id
            ? toNumber(row.payment_id, index + 1)
            : `pending-${row?.checkout_session_id || index}`,
          invoice: String(
            row?.invoice_number ||
              (row?.payment_id
                ? `INV-TCX${100 + toNumber(row?.payment_id, index + 1)}`
                : "Pending"),
          ),
          amount: toNumber(row?.amount, 0),
          statusRaw,
          status: statusRaw,
          date: formatIsoDate(row?.payment_date),
          payment_date: row?.payment_date || null,
          transaction_id: String(row?.transaction_id || "").trim() || "",
          payment_method: String(row?.payment_method || "").trim() || "",
          gateway_key:
            getGatewayFromMethod(row?.payment_method || "") || "stripe",
          currency: rowCurrency,
          amountLabel: formatCurrency(toNumber(row?.amount, 0), rowCurrency),
          plan_name: String(row?.plan_name || "").trim() || "",
          plan_id: toNumber(row?.plan_id, 0) || null,
          user_count: toNumber(row?.user_count, 0) || null,
          billing_type:
            String(row?.billing_type || "")
              .trim()
              .toLowerCase() || "upgrade",
          coupon_code:
            String(row?.coupon_code || "")
              .trim()
              .toUpperCase() || "",
          discount_amount: toNumber(row?.discount_amount, 0),
          period_months: Math.max(toNumber(row?.period_months, 1), 1),
          country: String(row?.country || "").trim() || "",
          state: String(row?.state || "").trim() || "",
          city: String(row?.city || "").trim() || "",
          postal_code: String(row?.postal_code || "").trim() || "",
          billing_name: String(row?.billing_name || "").trim() || "",
          billing_email:
            String(row?.billing_email || "")
              .trim()
              .toLowerCase() || "",
          company_name: String(row?.company_name || "").trim() || "",
          address_line1: String(row?.address_line1 || "").trim() || "",
          failure_reason: row?.failure_reason || null,
          checkout_session_id:
            String(row?.checkout_session_id || "").trim() || null,
        };
      });
      setPaymentRows(mappedRows);
    } catch (error) {
      setPaymentError(error?.message || "Unable to load payment history");
      setPaymentRows([]);
    }
  }, []);

  const fetchSiteProfile = useCallback(async () => {
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/site-details`,
        { method: "GET" },
      );
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Unable to load site details");
      }
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      setSiteProfile(rows[0] || null);
    } catch {
      setSiteProfile(null);
    }
  }, []);

  const fetchBillingAddress = useCallback(async () => {
    setBillingAddressLoading(true);
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/billing/address`,
        {
          method: "GET",
        },
      );
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Unable to load billing address");
      }
      setSavedBillingAddress(payload?.data || null);
      return payload?.data || null;
    } catch {
      setSavedBillingAddress(null);
      return null;
    } finally {
      setBillingAddressLoading(false);
    }
  }, []);

  const fetchRecentBillingAddresses = useCallback(async () => {
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/billing/addresses?limit=2`,
        {
          method: "GET",
        },
      );
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Unable to load billing addresses");
      }
      const rows = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
      const deduped = dedupeBillingAddresses(rows).slice(0, 2);
      setRecentBillingAddresses(deduped);
      return deduped;
    } catch {
      setRecentBillingAddresses([]);
      return [];
    }
  }, []);

  const fetchCurrencies = useCallback(async () => {
    setCurrenciesLoading(true);
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/geo/currencies?status=active&limit=500&offset=0`,
        { method: "GET" },
      );
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Unable to load currencies");
      }
      const rows = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
      setCurrencies(getStripeSupportedCurrencies(rows));
    } catch {
      setCurrencies(getStripeSupportedCurrencies());
    } finally {
      setCurrenciesLoading(false);
    }
  }, []);

  const fetchCoupons = useCallback(async () => {
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/coupons?status=active&limit=500&offset=0`,
        { method: "GET" },
      );
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Unable to load coupons");
      }
      const rows = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
      setCouponCodes(
        rows
          .map((row) =>
            String(row?.coupon_code || "")
              .trim()
              .toUpperCase(),
          )
          .filter(Boolean),
      );
    } catch {
      setCouponCodes([]);
    }
  }, []);

  const fetchPaymentGateways = useCallback(async () => {
    setGatewaysLoading(true);
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/billing/payment-gateways`,
        {
          method: "GET",
        },
      );
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Unable to load payment gateways");
      }
      const rows = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
      const normalized = rows
        .map((row) => ({
          gateway_key: String(row?.gateway_key || "")
            .trim()
            .toLowerCase(),
          gateway_name: String(
            row?.gateway_name || row?.gateway_key || "",
          ).trim(),
          provider: String(row?.provider || "")
            .trim()
            .toLowerCase(),
          is_enabled: Boolean(row?.is_enabled),
          status:
            String(row?.status || "")
              .trim()
              .toLowerCase() || "active",
          display_order: toNumber(row?.display_order, 0),
          config_json:
            row?.config_json && typeof row.config_json === "object"
              ? row.config_json
              : {},
        }))
        .filter((row) => row.gateway_key)
        .sort((a, b) => a.display_order - b.display_order);
      setPaymentGateways(
        normalized.length
          ? normalized
          : [
              {
                gateway_key: "stripe",
                gateway_name: "Stripe",
                provider: "stripe",
                is_enabled: true,
                status: "active",
                display_order: 1,
              },
            ],
      );
    } catch {
      setPaymentGateways([
        {
          gateway_key: "stripe",
          gateway_name: "Stripe",
          provider: "stripe",
          is_enabled: true,
          status: "active",
          display_order: 1,
        },
      ]);
    } finally {
      setGatewaysLoading(false);
    }
  }, []);

  const saveBillingAddress = useCallback(
    async (addressPayload) => {
      setBillingAddressSaving(true);
      setCheckoutMessage("");
      try {
        const { response, payload } = await fetchWithAuth(
          `${API_BASE_URL}/billing/address`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(addressPayload),
          },
        );
        if (!response.ok || payload?.status === "error") {
          throw new Error(payload?.message || "Unable to save billing address");
        }
        setSavedBillingAddress(payload?.data || null);
        await fetchRecentBillingAddresses();
        return true;
      } catch (error) {
        setCheckoutMessage(error?.message || "Unable to save billing address");
        return false;
      } finally {
        setBillingAddressSaving(false);
      }
    },
    [fetchRecentBillingAddresses],
  );

  const fetchPlanComparison = useCallback(async () => {
    setComparisonLoading(true);
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/billing/plan-comparison?status=active&limit_plans=12`,
        {
          method: "GET",
        },
      );
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Unable to load plan comparison");
      }
      const rows = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
      setPlanComparisonRows(rows);
    } catch {
      setPlanComparisonRows([]);
    } finally {
      setComparisonLoading(false);
    }
  }, []);

  const requestQuote = useCallback(async (payload) => {
    if (!payload?.plan_id) return;
    setQuoteLoading(true);
    setQuoteError("");
    try {
      const { response, payload: responsePayload } = await fetchWithAuth(
        `${API_BASE_URL}/billing/quote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok || responsePayload?.status === "error") {
        throw new Error(
          responsePayload?.message || "Unable to calculate quote",
        );
      }
      setQuote(responsePayload?.data || null);
    } catch (error) {
      setQuote(null);
      setQuoteError(error?.message || "Unable to calculate quote");
    } finally {
      setQuoteLoading(false);
    }
  }, []);

  const startCheckout = useCallback(async (payload) => {
    setCheckoutLoading(true);
    setCheckoutMessage("");
    try {
      const { response, payload: responsePayload } = await fetchWithAuth(
        `${API_BASE_URL}/billing/checkout-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok || responsePayload?.status === "error") {
        throw new Error(responsePayload?.message || "Unable to start checkout");
      }
      const checkoutUrl = String(
        responsePayload?.data?.checkout_url || "",
      ).trim();
      if (!checkoutUrl) {
        throw new Error("Checkout URL missing in response");
      }
      window.location.href = checkoutUrl;
    } catch (error) {
      setCheckoutMessage(error?.message || "Unable to start checkout");
    } finally {
      setCheckoutLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const loadedPlans = await fetchPlans();
      if (!active) return;
      const currentPlanId = toNumber(
        adminData?.organizationSummary?.current_plan?.plan_id,
        0,
      );
      const preload = new Set(
        loadedPlans.slice(0, 4).map((plan) => plan.plan_id),
      );
      if (currentPlanId > 0) preload.add(currentPlanId);
      for (const planId of preload) {
        await ensurePlanSummary(planId);
      }
      await Promise.all([
        fetchBillingAddress(),
        fetchRecentBillingAddresses(),
        fetchCurrencies(),
        fetchCoupons(),
        fetchPaymentGateways(),
      ]);
      await fetchPaymentHistory();
      await fetchPlanComparison();
      await fetchSiteProfile();
    };
    load();
    return () => {
      active = false;
    };
  }, [
    adminData?.organizationSummary?.current_plan?.plan_id,
    fetchPlans,
    ensurePlanSummary,
    fetchPaymentHistory,
    fetchPlanComparison,
    fetchBillingAddress,
    fetchRecentBillingAddresses,
    fetchCurrencies,
    fetchCoupons,
    fetchPaymentGateways,
    fetchSiteProfile,
  ]);

  const handleRepay = useCallback(
    async (payment) => {
      const planId = toNumber(payment?.plan_id, 0);
      if (!planId) {
        setPaymentError(
          "Re-pay not possible: missing plan_id in payment record.",
        );
        return;
      }

      const fallbackAddress = savedBillingAddress
        ? {
            full_name: savedBillingAddress.full_name,
            company_name: savedBillingAddress.company_name,
            email: savedBillingAddress.email,
            mobile: savedBillingAddress.mobile,
            address_line1: savedBillingAddress.address_line1,
            address_line2: savedBillingAddress.address_line2,
            city: savedBillingAddress.city,
            state: savedBillingAddress.state,
            postal_code: savedBillingAddress.postal_code,
            country: savedBillingAddress.country,
          }
        : null;

      const address = {
        full_name: String(
          payment?.billing_name || fallbackAddress?.full_name || "",
        ).trim(),
        company: String(
          payment?.company_name || fallbackAddress?.company_name || "",
        ).trim(),
        email: String(payment?.billing_email || fallbackAddress?.email || "")
          .trim()
          .toLowerCase(),
        mobile: String(fallbackAddress?.mobile || "").trim(),
        address_line1: String(
          payment?.address_line1 || fallbackAddress?.address_line1 || "",
        ).trim(),
        address_line2: String(fallbackAddress?.address_line2 || "").trim(),
        city: String(payment?.city || fallbackAddress?.city || "").trim(),
        state: String(payment?.state || fallbackAddress?.state || "").trim(),
        postal_code: String(
          payment?.postal_code || fallbackAddress?.postal_code || "",
        ).trim(),
        country: String(
          payment?.country || fallbackAddress?.country || "India",
        ).trim(),
      };

      if (
        !address.full_name ||
        !address.email ||
        !address.address_line1 ||
        !address.city ||
        !address.country
      ) {
        setPaymentError(
          "Re-pay needs complete billing address. Please open Billing tab and update address.",
        );
        setCurrentTab("Billing");
        return;
      }

      const cycle = Number(payment?.period_months) >= 12 ? "year" : "month";
      const gatewayFromPayment = getGatewayFromMethod(
        payment?.payment_method || "",
      );
      const enabledGatewayKeys = new Set(
        (Array.isArray(paymentGateways) ? paymentGateways : [])
          .filter(
            (row) =>
              Boolean(row?.is_enabled) &&
              String(row?.status || "").toLowerCase() === "active",
          )
          .map((row) =>
            String(row?.gateway_key || "")
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      );
      const gateway =
        (gatewayFromPayment && enabledGatewayKeys.has(gatewayFromPayment)
          ? gatewayFromPayment
          : "") ||
        (enabledGatewayKeys.has("stripe")
          ? "stripe"
          : Array.from(enabledGatewayKeys)[0] || "stripe");
      const payload = {
        gateway,
        plan_id: planId,
        user_count: Math.max(toNumber(payment?.user_count, 1), 1),
        cycle,
        currency: String(payment?.currency || "INR").toUpperCase(),
        country: address.country,
        billing_type: String(payment?.billing_type || "upgrade").toLowerCase(),
        coupon_code: String(payment?.coupon_code || "")
          .trim()
          .toUpperCase(),
        billing_email: address.email,
        address,
        failed_payment_id: payment.id,
      };

      setRepayLoadingId(payment.id);
      setPaymentError("");
      try {
        await startCheckout(payload);
      } finally {
        setRepayLoadingId(null);
      }
    },
    [paymentGateways, savedBillingAddress, startCheckout],
  );

  const handleResume = useCallback(async (payment) => {
    const sessionId = payment?.checkout_session_id;
    if (!sessionId) return;
    setResumeLoadingId(payment.id);
    setPaymentError("");
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/billing/checkout/resume?session_id=${encodeURIComponent(sessionId)}`,
        { method: "GET" },
      );
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message || "Unable to get resume URL");
      }
      const checkoutUrl = payload?.data?.checkout_url;
      if (!checkoutUrl) throw new Error("No checkout URL returned");
      window.location.href = checkoutUrl;
    } catch (error) {
      setPaymentError(
        error?.message ||
          "Unable to resume checkout. Please start a new payment.",
      );
    } finally {
      setResumeLoadingId(null);
    }
  }, []);

  return (
    <Stack spacing={3}>
      <Paper
        elevation={0}
        sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}
      >
        <Tabs
          value={currentTab}
          onChange={(_, value) => setCurrentTab(value)}
          variant="scrollable"
          TabIndicatorProps={{
            sx: { backgroundColor: "primary.main", height: 3, borderRadius: 3 },
          }}
          sx={{ px: 2 }}
        >
          {billingTabs.map((tab) => (
            <Tab
              key={tab}
              value={tab}
              label={tab}
              sx={{ fontWeight: 600, textTransform: "none" }}
            />
          ))}
        </Tabs>
      </Paper>

      {currentTab === "Billing" && (
        <BillingPanel
          adminData={adminData}
          plans={plans}
          planSummaries={planSummaries}
          loadingPlans={loadingPlans}
          plansError={plansError}
          quote={quote}
          quoteLoading={quoteLoading}
          quoteError={quoteError}
          checkoutMessage={checkoutMessage}
          checkoutLoading={checkoutLoading}
          onRefreshPlans={fetchPlans}
          onEnsurePlanSummary={ensurePlanSummary}
          onRequestQuote={requestQuote}
          onStartCheckout={startCheckout}
          planComparisonRows={planComparisonRows}
          comparisonLoading={comparisonLoading}
          currencies={currencies}
          currenciesLoading={currenciesLoading}
          couponCodes={couponCodes}
          paymentGateways={paymentGateways}
          gatewaysLoading={gatewaysLoading}
          siteProfile={siteProfile}
          savedBillingAddress={savedBillingAddress}
          recentBillingAddresses={recentBillingAddresses}
          billingAddressLoading={billingAddressLoading}
          billingAddressSaving={billingAddressSaving}
          onSaveBillingAddress={saveBillingAddress}
        />
      )}

      {currentTab === "Payment History" && (
        <Stack spacing={1}>
          {paymentError ? <Alert severity="error">{paymentError}</Alert> : null}
          <PaymentHistory
            payments={paymentRows}
            siteProfile={siteProfile}
            organizationName={String(
              adminData?.organizationSummary?.organization?.name || "",
            ).trim()}
            currentPlan={adminData?.organizationSummary?.current_plan || null}
            onManagePlans={() => setCurrentTab("Billing")}
            onRepay={handleRepay}
            repayLoadingId={repayLoadingId}
            onResume={handleResume}
            resumeLoadingId={resumeLoadingId}
          />
        </Stack>
      )}

      {loadingPlans && currentTab !== "Billing" ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            Syncing billing plans from API...
          </Typography>
        </Stack>
      ) : null}
    </Stack>
  );
};

export default Billing;
