import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import RemoveRedEyeOutlinedIcon from "@mui/icons-material/RemoveRedEyeOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { DataGrid } from "@mui/x-data-grid";
import { alpha } from "@mui/material/styles";
import FormCard from "../forms/FormCard";
import { formatAppDate, formatIsoDate } from "../../../utils/dateTime";
import { resolveSiteDetails } from "../../../utils/siteDetails";
import { buildSubscriptionView } from "../../../utils/subscription";
import { downloadInvoicePdf } from "../../../utils/invoicePdf";

const defaultPayments = [
  { id: 1, invoice: "INV-1023", amount: 2499, status: "Paid", date: "Jul 12" },
  { id: 2, invoice: "INV-1024", amount: 2499, status: "Due", date: "Aug 12" },
  { id: 3, invoice: "INV-1025", amount: 2499, status: "Processing", date: "Sep 12" },
];

const formatPaymentAmount = (amount, currency = "INR") => {
  const normalizedCurrency = String(currency || "INR").toUpperCase();
  const locale = normalizedCurrency === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: normalizedCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
};

const getStatusChip = (statusRaw) => {
  const normalized = String(statusRaw || "").toLowerCase();
  if (["success", "paid", "completed"].includes(normalized)) {
    return {
      label: "Success",
      sx: {
        backgroundColor: "rgba(34,197,94,0.12)",
        border: "1px solid rgba(34,197,94,0.44)",
        color: "#15803d",
        fontWeight: 700,
      },
    };
  }
  if (normalized === "failed") {
    return {
      label: "Failed",
      sx: {
        backgroundColor: "rgba(239,68,68,0.1)",
        border: "1px solid rgba(239,68,68,0.4)",
        color: "#dc2626",
        fontWeight: 700,
      },
    };
  }
  if (normalized === "refunded") {
    return {
      label: "Refunded",
      sx: {
        backgroundColor: "rgba(245,158,11,0.1)",
        border: "1px solid rgba(245,158,11,0.42)",
        color: "#b45309",
        fontWeight: 700,
      },
    };
  }
  if (normalized === "retried") {
    return {
      label: "Retried",
      sx: {
        backgroundColor: "rgba(148,163,184,0.12)",
        border: "1px solid rgba(148,163,184,0.4)",
        color: "#64748b",
        fontWeight: 700,
      },
    };
  }
  return {
    label: "Pending",
    sx: {
      backgroundColor: "rgba(245,158,11,0.1)",
      border: "1px solid rgba(245,158,11,0.42)",
      color: "#c2410c",
      fontWeight: 700,
    },
  };
};

const getGatewayLabel = (value) => {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .split(/[,\|/]/)[0]
    .split(":")[0]
    .trim();
  if (!key) return "Stripe";
  if (key === "paypal") return "PayPal";
  if (key === "stripe") return "Stripe";
  return key.charAt(0).toUpperCase() + key.slice(1);
};

const getPaymentMethodLabel = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "Card";
  if (raw.includes("paypal")) return "Paypal";
  if (raw.includes("card") || raw.includes("stripe")) return "Card";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const GatewayIcon = ({ gateway }) => {
  const key = String(gateway || "").trim().toLowerCase();
  if (key.includes("paypal")) {
    return (
      <Box
        component="img"
        src="https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://paypal.com&size=256"
        alt="PayPal"
        sx={{ width: 20, height: 20, display: "block" }}
      />
    );
  }
  if (key.includes("stripe") || key.includes("card")) {
    return (
      <Box
        component="img"
        src="https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://stripe.com&size=256"
        alt="Stripe"
        sx={{ width: 20, height: 20, display: "block" }}
      />
    );
  }
  return null;
};

const formatFailureReason = (failureReason) => {
  if (!failureReason) return "This payment attempt failed. Please try again.";
  let normalized = failureReason;
  if (typeof normalized === "string") {
    const rawText = normalized.trim();
    if (!rawText) return "This payment attempt failed. Please try again.";
    try {
      normalized = JSON.parse(rawText);
    } catch {
      return rawText;
    }
  }
  if (!normalized || typeof normalized !== "object") {
    return "This payment attempt failed. Please try again.";
  }

  const message = String(normalized?.message || "").trim();
  const stage = String(normalized?.stage || "").trim();
  const code = String(normalized?.code || "").trim();
  const type = String(normalized?.type || "").trim();
  const raw = normalized?.raw && typeof normalized.raw === "object" ? normalized.raw : null;

  const details = [];
  if (stage) details.push(`Stage: ${stage}`);
  if (code) details.push(`Code: ${code}`);
  if (type) details.push(`Type: ${type}`);
  if (raw?.decline_code) details.push(`Decline code: ${raw.decline_code}`);
  if (raw?.param) details.push(`Param: ${raw.param}`);
  if (raw?.checkout_status) details.push(`Checkout status: ${raw.checkout_status}`);
  if (raw?.payment_status) details.push(`Payment status: ${raw.payment_status}`);

  return [message || "This payment attempt failed. Please try again.", ...details].join(" ");
};

const DetailRow = ({ label, value, emphasis = false, color = "text.primary" }) => (
  <Stack spacing={0.35}>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography
      fontWeight={emphasis ? 800 : 700}
      color={color}
      sx={{ wordBreak: "break-word" }}
    >
      {value || "--"}
    </Typography>
  </Stack>
);

const PaymentHistory = ({
  payments = defaultPayments,
  siteProfile = null,
  organizationName = "",
  currentPlan = null,
  onManagePlans,
  onRepay,
  repayLoadingId = null,
  onResume,
  resumeLoadingId = null,
}) => {
  const theme = useTheme();
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [gatewayFilter, setGatewayFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const company = useMemo(
    () => resolveSiteDetails(siteProfile, organizationName),
    [organizationName, siteProfile],
  );
  const subscriptionView = useMemo(
    () => buildSubscriptionView(currentPlan, { fallbackName: "--" }),
    [currentPlan],
  );
  const paymentRows = Array.isArray(payments) ? payments : [];
  const filteredPayments = useMemo(() => {
    const normalizedSearch = String(searchText || "").trim().toLowerCase();
    return paymentRows.filter((row) => {
      const normalizedStatus = String(row?.statusRaw || row?.status || "").trim().toLowerCase();
      const normalizedGateway = String(row?.gateway_key || row?.payment_method || "")
        .trim()
        .toLowerCase()
        .split(/[,\|/]/)[0]
        .split(":")[0]
        .trim();
      const normalizedMethod = getPaymentMethodLabel(row?.payment_method || row?.gateway_key)
        .trim()
        .toLowerCase();
      const rawDate = row?.payment_date || row?.date || "";
      const parsedDate = rawDate ? new Date(rawDate) : null;
      const isValidDate = parsedDate && !Number.isNaN(parsedDate.getTime());
      const monthValue = isValidDate ? String(parsedDate.getMonth() + 1).padStart(2, "0") : "";
      const localIsoDate = isValidDate
        ? `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`
        : "";

      if (statusFilter !== "all" && normalizedStatus !== statusFilter) return false;
      if (gatewayFilter !== "all" && normalizedGateway !== gatewayFilter) return false;
      if (methodFilter !== "all" && normalizedMethod !== methodFilter) return false;
      if (monthFilter !== "all" && monthValue !== monthFilter) return false;
      if (dateFrom && localIsoDate && localIsoDate < dateFrom) return false;
      if (dateTo && localIsoDate && localIsoDate > dateTo) return false;

      if (!normalizedSearch) return true;
      const haystack = [
        row?.plan_name,
        row?.invoice,
        row?.transaction_id,
        row?.billing_name,
        row?.billing_email,
        row?.amountLabel,
        row?.currency,
        row?.date,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return haystack.includes(normalizedSearch);
    });
  }, [dateFrom, dateTo, gatewayFilter, methodFilter, monthFilter, paymentRows, searchText, statusFilter]);

  const statusOptions = useMemo(() => {
    const values = new Set(
      paymentRows
        .map((row) => String(row?.statusRaw || row?.status || "").trim().toLowerCase())
        .filter(Boolean),
    );
    return Array.from(values);
  }, [paymentRows]);

  const gatewayOptions = useMemo(() => {
    const values = new Set(
      paymentRows
        .map((row) =>
          String(row?.gateway_key || row?.payment_method || "")
            .trim()
            .toLowerCase()
            .split(/[,\|/]/)[0]
            .split(":")[0]
            .trim(),
        )
        .filter(Boolean),
    );
    return Array.from(values);
  }, [paymentRows]);

  const methodOptions = useMemo(() => {
    const values = new Set(
      paymentRows
        .map((row) => getPaymentMethodLabel(row?.payment_method || row?.gateway_key).trim().toLowerCase())
        .filter(Boolean),
    );
    return Array.from(values);
  }, [paymentRows]);

  const handleDownloadInvoice = async (payment) => {
    if (!payment) return;
    try {
      await downloadInvoicePdf({
        payment: {
          invoice: payment?.invoice,
          payment_date: payment?.payment_date || payment?.date,
          status: payment?.statusRaw || payment?.status,
          transaction_id: payment?.transaction_id || payment?.stripe_payment_intent,
          plan_name: payment?.plan_name,
          user_count: payment?.user_count,
          period_months: payment?.period_months,
          amount: payment?.amount,
          currency: payment?.currency,
          discount_amount: payment?.discount_amount,
          coupon_code: payment?.coupon_code,
        },
        company,
      });
    }
    catch (error) {
      console.error("Invoice generation failed", error);
    }
  };

  return (
    <>
      <FormCard title="Payment History" contentProps={{ sx: { p: 0 } }}>
        <Paper
          elevation={0}
          sx={{
            m: 1.2,
            p: { xs: 1.4, md: 2 },
            borderRadius: 2.2,
            border: "1px solid",
            borderColor: "divider",
            backgroundColor: "background.paper",
          }}
        >
          <Stack spacing={1.3}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
              <Stack spacing={0.35}>
                <Typography variant="h6" fontWeight={800}>
                  Subscription and payments
                </Typography>
                <Typography color="text.secondary">
                  Track your subscription, payment history, and purchase details for {company.name || organizationName || "your organization"}.
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshRoundedIcon fontSize="small" />}
                  sx={{
                    minWidth: 112,
                    height: 38,
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 700,
                    borderWidth: 1.4,
                    "&:hover": { borderWidth: 1.4 },
                  }}
                >
                  Refresh
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                  onClick={() => onManagePlans?.()}
                  sx={{
                    minWidth: 148,
                    height: 38,
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 800,
                    letterSpacing: 0.2,
                    boxShadow: "0 6px 16px rgba(91,33,182,0.28)",
                    background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 60%, #4c1d95 100%)",
                    "&:hover": {
                      boxShadow: "0 8px 18px rgba(91,33,182,0.34)",
                      background: "linear-gradient(135deg, #6d28d9 0%, #5b21b6 60%, #3b0764 100%)",
                    },
                  }}
                >
                  Manage plans
                </Button>
              </Stack>
            </Stack>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "1.3fr repeat(3, minmax(0, 1fr))" },
                gap: 1,
              }}
            >
              <Paper
                variant="outlined"
                sx={{
                  p: 1.4,
                  borderRadius: 1.6,
                  borderColor: alpha("#8b5cf6", 0.22),
                  background: alpha("#8b5cf6", 0.04),
                }}
              >
                <Stack direction="row" spacing={1.2} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: 1.2,
                      backgroundColor: alpha("#8b5cf6", 0.14),
                      display: "grid",
                      placeItems: "center",
                      color: "#6d28d9",
                      fontWeight: 900,
                    }}
                  >
                    ⬡
                  </Box>
                  <Stack spacing={0.35}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="h4" fontWeight={900} lineHeight={1.05}>
                        {subscriptionView.planName}
                      </Typography>
                      <Chip
                        size="small"
                        label={subscriptionView.statusLabel === "ACTIVE" ? "Active" : subscriptionView.statusLabel}
                        sx={{
                          bgcolor: alpha("#22c55e", 0.14),
                          color: "#166534",
                          border: "1px solid rgba(34,197,94,0.34)",
                          fontWeight: 700,
                        }}
                      />
                    </Stack>
                    <Typography color="text.secondary">
                      Advanced features for growing teams
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1.6, borderColor: alpha("#10b981", 0.35), background: alpha("#10b981", 0.08) }}>
                <Typography variant="caption" sx={{ letterSpacing: "0.14em", textTransform: "uppercase", color: "text.secondary", fontWeight: 800 }}>
                  Current Amount
                </Typography>
                <Typography variant="h5" fontWeight={900} sx={{ mt: 1.4 }}>
                  {formatPaymentAmount(currentPlan?.price || currentPlan?.amount || 0, currentPlan?.default_currency || "USD")}
                </Typography>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1.6, borderColor: alpha("#0ea5e9", 0.35), background: alpha("#0ea5e9", 0.06) }}>
                <Typography variant="caption" sx={{ letterSpacing: "0.14em", textTransform: "uppercase", color: "text.secondary", fontWeight: 800 }}>
                  Billing Cycle
                </Typography>
                <Typography variant="h5" fontWeight={900} sx={{ mt: 1.4 }}>
                  {subscriptionView.cycleLabel}
                </Typography>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1.6, borderColor: alpha("#f59e0b", 0.35), background: alpha("#f59e0b", 0.06) }}>
                <Typography variant="caption" sx={{ letterSpacing: "0.14em", textTransform: "uppercase", color: "text.secondary", fontWeight: 800 }}>
                  Renewal / Expiry
                </Typography>
                <Typography variant="h6" fontWeight={800} sx={{ mt: 1.2, lineHeight: 1.25 }}>
                  {subscriptionView.expiryLabel}
                </Typography>
              </Paper>
            </Box>
          </Stack>
        </Paper>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          sx={{ px: 1.2, pb: 1.2 }}
          alignItems={{ xs: "stretch", md: "center" }}
        >
          <TextField
            size="small"
            fullWidth
            label="Search payments"
            placeholder="Plan, invoice, txn, email..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(String(event.target.value || "all").toLowerCase())}
            sx={{ minWidth: { xs: "100%", md: 150 } }}
          >
            <MenuItem value="all">All</MenuItem>
            {statusOptions.map((value) => (
              <MenuItem key={value} value={value}>
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Gateway"
            value={gatewayFilter}
            onChange={(event) => setGatewayFilter(String(event.target.value || "all").toLowerCase())}
            sx={{ minWidth: { xs: "100%", md: 150 } }}
          >
            <MenuItem value="all">All</MenuItem>
            {gatewayOptions.map((value) => (
              <MenuItem key={value} value={value}>
                {getGatewayLabel(value)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Month"
            value={monthFilter}
            onChange={(event) => setMonthFilter(String(event.target.value || "all"))}
            sx={{ minWidth: { xs: "100%", md: 120 } }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="01">Jan</MenuItem>
            <MenuItem value="02">Feb</MenuItem>
            <MenuItem value="03">Mar</MenuItem>
            <MenuItem value="04">Apr</MenuItem>
            <MenuItem value="05">May</MenuItem>
            <MenuItem value="06">Jun</MenuItem>
            <MenuItem value="07">Jul</MenuItem>
            <MenuItem value="08">Aug</MenuItem>
            <MenuItem value="09">Sep</MenuItem>
            <MenuItem value="10">Oct</MenuItem>
            <MenuItem value="11">Nov</MenuItem>
            <MenuItem value="12">Dec</MenuItem>
          </TextField>
          <TextField
            size="small"
            type="date"
            label="From"
            value={dateFrom}
            onChange={(event) => setDateFrom(String(event.target.value || ""))}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: "100%", md: 145 } }}
          />
          <TextField
            size="small"
            type="date"
            label="To"
            value={dateTo}
            onChange={(event) => setDateTo(String(event.target.value || ""))}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: "100%", md: 145 } }}
          />

          <Button
            variant="outlined"
            onClick={() => {
              setSearchText("");
              setStatusFilter("all");
              setGatewayFilter("all");
              setMethodFilter("all");
              setMonthFilter("all");
              setDateFrom("");
              setDateTo("");
            }}
            sx={{ minWidth: { xs: "100%", md: 96 }, height: 40 }}
          >
            Reset
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ px: 2.2, pb: 0.4 }}>
          Showing {filteredPayments.length} of {paymentRows.length} payments
        </Typography>
        <Stack sx={{ height: 460 }}>
          <DataGrid
            rows={filteredPayments}
            getRowId={(row) => row.id}
            disableRowSelectionOnClick
            rowHeight={72}
            pageSizeOptions={[10, 25, 50, 100]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10, page: 0 } },
              sorting: { sortModel: [{ field: "payment_date", sort: "desc" }] },
            }}
            sx={{
              border: 0,
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor:
                  theme.palette.mode === "light"
                    ? alpha(theme.palette.primary.main, 0.04)
                    : alpha(theme.palette.primary.light, 0.08),
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
              },
              "& .MuiDataGrid-columnHeaderTitle": {
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: 0.2,
              },
              "& .MuiDataGrid-cell": {
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                alignItems: "center",
                display: "flex",
              },
              "& .MuiDataGrid-cellContent": {
                width: "100%",
              },
              "& .MuiDataGrid-row:hover": {
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
              },
            }}
            columns={[

              {
                field: "payment_id",
                headerName: "Payment ID",
                minWidth: 130,
                flex: 0.7,
                renderCell: ({ row }) => (
                  <Typography fontWeight={700} color="text.secondary">
                    {typeof row.id === "string" && row.id.startsWith("pending-") ? "—" : `#${row.id}`}
                  </Typography>
                ),
              },
              {
                field: "plan_name",
                headerName: "Plan",
                minWidth: 150,
                flex: 0.9,
                renderCell: ({ row }) => (
                  <Stack spacing={0.25} justifyContent="center" sx={{ py: 0.4, width: "100%" }}>
                    <Typography fontWeight={800}>{row.plan_name || "--"}</Typography>
                  </Stack>
                ),
              },
              
             
              {
                field: "gateway_amount",
                headerName: "Gateway / amount",
                minWidth: 190,
                flex: 1,
                renderCell: ({ row }) => (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: 1.5,
                        border: "1px solid",
                        borderColor: "divider",
                        display: "grid",
                        placeItems: "center",
                        backgroundColor:
                          String(row.gateway_key || row.payment_method || "").toLowerCase().includes("paypal")
                            ? alpha("#0ea5e9", 0.08)
                            : alpha("#7c3aed", 0.08),
                      }}
                    >
                      <GatewayIcon gateway={row.gateway_key || row.payment_method} />
                    </Box>
                    <Stack spacing={0.1}>
                      <Typography fontWeight={900} sx={{ fontVariantNumeric: "tabular-nums" }}>
                        {row.amountLabel}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {getGatewayLabel(row.gateway_key || row.payment_method)}
                      </Typography>
                    </Stack>
                  </Stack>
                ),
              },
              {
                field: "created",
                headerName: "Created",
                minWidth: 170,
                flex: 0.85,
                renderCell: ({ row }) => (
                  <Stack spacing={0.2} justifyContent="center" sx={{ py: 0.4 }}>
                    <Typography fontWeight={800}>
                      {formatAppDate(row.payment_date || row.date, { includeTime: false, fallback: "--" })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatAppDate(row.payment_date || row.date, { includeTime: true, fallback: "--" }).split(", ").slice(1).join(", ") || "--"}
                    </Typography>
                  </Stack>
                ),
              },
              {
                field: "status",
                headerName: "Status",
                minWidth: 140,
                flex: 0.6,
                align: "center",
                headerAlign: "center",
                renderCell: ({ row }) => {
                  const status = getStatusChip(row.statusRaw || row.status);
                  return <Chip label={status.label} size="small" sx={status.sx} />;
                },
              },
              {
                field: "actions",
                headerName: "Action",
                minWidth: 240,
                flex: 0.95,
                align: "center",
                headerAlign: "center",
                sortable: false,
                filterable: false,
                renderCell: ({ row }) => {
                  const normalizedStatus = String(row.statusRaw || row.status || "").toLowerCase();
                  const isFailed = normalizedStatus === "failed";
                  const isPending = normalizedStatus === "pending";
                  const canDownloadInvoice = !isFailed && !isPending;
                  const isRepaying = repayLoadingId === row.id;
                  const isResuming = resumeLoadingId === row.id;
                  return (
                    <Stack direction="row" spacing={0.8} justifyContent="center" alignItems="center" sx={{ width: "100%" }}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<RemoveRedEyeOutlinedIcon fontSize="small" />}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedPayment({ ...row });
                        }}
                        sx={{
                          minWidth: 80,
                          borderRadius: 999,
                          textTransform: "none",
                          fontWeight: 800,
                          px: 1.4,
                          boxShadow: "none",
                        }}
                      >
                        View
                      </Button>
                      {canDownloadInvoice ? (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<DownloadOutlinedIcon fontSize="small" />}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDownloadInvoice({ ...row });
                          }}
                          sx={{
                            minWidth: 100,
                            borderRadius: 999,
                            textTransform: "none",
                            fontWeight: 800,
                            px: 1.4,
                            borderWidth: 1.5,
                            "&:hover": { borderWidth: 1.5 },
                          }}
                        >
                          Invoice
                        </Button>
                      ) : null}
                      {isFailed && typeof onRepay === "function" ? (
                        <Button
                          size="small"
                          variant="contained"
                          color="error"
                          startIcon={isRepaying ? null : <ReplayRoundedIcon fontSize="small" />}
                          disabled={isRepaying}
                          onClick={(event) => {
                            event.stopPropagation();
                            onRepay({ ...row });
                          }}
                          sx={{
                            minWidth: 90,
                            borderRadius: 999,
                            textTransform: "none",
                            fontWeight: 800,
                            px: 1.4,
                            boxShadow: "none",
                          }}
                        >
                          {isRepaying ? "..." : "Repay"}
                        </Button>
                      ) : null}
                      {isPending && row.checkout_session_id && typeof onResume === "function" ? (
                        <Button
                          size="small"
                          variant="contained"
                          color="warning"
                          startIcon={isResuming ? null : <OpenInNewRoundedIcon fontSize="small" />}
                          disabled={isResuming}
                          onClick={(event) => {
                            event.stopPropagation();
                            onResume({ ...row });
                          }}
                          sx={{
                            minWidth: 100,
                            borderRadius: 999,
                            textTransform: "none",
                            fontWeight: 800,
                            px: 1.4,
                            boxShadow: "none",
                          }}
                        >
                          {isResuming ? "..." : "Resume"}
                        </Button>
                      ) : null}
                    </Stack>
                  );
                },
              },
            ]}
            localeText={{ noRowsLabel: "No payment records found." }}
          />
        </Stack>
      </FormCard>

      <Dialog
        open={Boolean(selectedPayment)}
        onClose={() => setSelectedPayment(null)}
        fullWidth
        maxWidth="lg"
        PaperProps={{
          sx: {
            width: "min(1120px, calc(100vw - 24px))",
            maxWidth: "min(1120px, calc(100vw - 24px))",
            borderRadius: 3,
            overflow: "hidden",
            backgroundImage:
              theme.palette.mode === "light"
                ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${theme.palette.background.paper} 32%)`
                : `linear-gradient(180deg, ${alpha(theme.palette.primary.light, 0.12)} 0%, ${theme.palette.background.paper} 32%)`,
          },
        }}
      >
        <DialogTitle sx={{ px: { xs: 1.5, sm: 2.5 }, pt: 2.2, pb: 1, fontWeight: 800 }}>
          Payment Details
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 1.2, sm: 2.5 }, pb: { xs: 1.5, sm: 2.5 } }}>
          <Stack
            spacing={2}
            sx={{
              width: "100%",
              mx: "auto",
              p: { xs: 1, sm: 1.2 },
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: { xs: 1.5, sm: 2.2 },
                borderRadius: 3,
                color: theme.palette.mode === "dark" ? theme.palette.common.white : theme.palette.text.primary,
                background:
                  theme.palette.mode === "light"
                    ? `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 58%, ${theme.palette.primary.light} 100%)`
                    : `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.92)} 0%, ${alpha(theme.palette.primary.main, 0.96)} 58%, ${alpha(theme.palette.primary.light, 0.9)} 100%)`,
                boxShadow: `0 22px 48px ${alpha(theme.palette.common.black, theme.palette.mode === "light" ? 0.18 : 0.32)}`,
              }}
            >
              <Stack spacing={1.8}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
                  <Stack direction="row" spacing={1.2} alignItems="center">
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        display: "grid",
                        placeItems: "center",
                        backgroundColor: alpha(theme.palette.common.white, 0.16),
                        border: `1px solid ${alpha(theme.palette.common.white, 0.24)}`,
                        flexShrink: 0,
                      }}
                    >
                      <ReceiptLongOutlinedIcon />
                    </Box>
                    <Stack spacing={0.35}>
                      <Typography variant="overline" sx={{ color: alpha(theme.palette.common.white, 0.72), lineHeight: 1.1 }}>
                        Invoice Preview
                      </Typography>
                      <Typography
                        variant="h5"
                        fontWeight={900}
                        sx={{
                          lineHeight: 1.15,
                          maxWidth: { xs: "100%", md: 420 },
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {selectedPayment?.invoice || "--"}
                      </Typography>
                      <Typography variant="body2" sx={{ color: alpha(theme.palette.common.white, 0.82) }}>
                        {selectedPayment?.plan_name || "Subscription"}{company.name ? ` for ${company.name}` : ""}
                      </Typography>
                    </Stack>
                  </Stack>
                  <Stack alignItems={{ xs: "flex-start", sm: "flex-end" }} spacing={0.5}>
                    <Chip
                      size="small"
                      label={getStatusChip(selectedPayment?.statusRaw || selectedPayment?.status).label}
                      sx={{
                        bgcolor: alpha(theme.palette.common.white, 0.18),
                        color: theme.palette.common.white,
                        fontWeight: 800,
                        border: `1px solid ${alpha(theme.palette.common.white, 0.28)}`,
                      }}
                    />
                    <Typography variant="caption" sx={{ color: alpha(theme.palette.common.white, 0.78) }}>
                      {String(selectedPayment?.statusRaw || selectedPayment?.status || "").toLowerCase() === "pending"
                        ? `Initiated on ${formatAppDate(selectedPayment?.payment_date || selectedPayment?.date, { includeTime: true })}`
                        : `Paid on ${formatAppDate(selectedPayment?.payment_date || selectedPayment?.date, { includeTime: true })}`}
                    </Typography>
                    <Typography
                      variant="h4"
                      fontWeight={900}
                      sx={{
                        lineHeight: 1,
                        textAlign: { xs: "left", sm: "right" },
                        wordBreak: "break-word",
                        fontSize: { xs: 32, sm: 40 },
                      }}
                    >
                      {selectedPayment?.amountLabel || formatPaymentAmount(selectedPayment?.amount, selectedPayment?.currency)}
                    </Typography>
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip
                    size="small"
                    label={`Billing Type: ${String(selectedPayment?.billing_type || "--").replace(/^./, (m) => m.toUpperCase())}`}
                    sx={{
                      bgcolor: alpha(theme.palette.common.white, 0.12),
                      color: theme.palette.common.white,
                      border: `1px solid ${alpha(theme.palette.common.white, 0.2)}`,
                    }}
                  />
                  <Chip
                    size="small"
                    label={`Users: ${selectedPayment?.user_count || "--"}`}
                    sx={{
                      bgcolor: alpha(theme.palette.common.white, 0.12),
                      color: theme.palette.common.white,
                      border: `1px solid ${alpha(theme.palette.common.white, 0.2)}`,
                    }}
                  />
                  <Chip
                    size="small"
                    label={`Cycle: ${Number(selectedPayment?.period_months || 1) >= 12 ? "Yearly" : "Monthly"}`}
                    sx={{
                      bgcolor: alpha(theme.palette.common.white, 0.12),
                      color: theme.palette.common.white,
                      border: `1px solid ${alpha(theme.palette.common.white, 0.2)}`,
                    }}
                  />
                  <Chip
                    size="small"
                    label={selectedPayment?.transaction_id ? `Txn ID: ${selectedPayment.transaction_id}` : "Txn ID: Not available"}
                    sx={{
                      bgcolor: alpha(theme.palette.common.white, 0.12),
                      color: theme.palette.common.white,
                      border: `1px solid ${alpha(theme.palette.common.white, 0.2)}`,
                    }}
                  />
                </Stack>
              </Stack>
            </Paper>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "1.35fr 0.95fr" },
                gap: 2,
                alignItems: "start",
              }}
            >
              <Stack spacing={2}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 1.4, sm: 1.8 },
                    borderRadius: 2.5,
                    borderColor: alpha(theme.palette.divider, 0.9),
                  }}
                >
                  <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.4 }}>
                    Invoice & Subscription
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                      gap: 1.5,
                    }}
                  >
                    <DetailRow
                      label="Invoice Number"
                      value={selectedPayment?.invoice}
                      emphasis
                    />
                    <DetailRow
                      label="Invoice Date"
                      value={formatAppDate(selectedPayment?.payment_date || selectedPayment?.date, { includeTime: true })}
                    />
                    <DetailRow
                      label="Plan"
                      value={selectedPayment?.plan_name}
                    />
                    <DetailRow
                      label="Status"
                      value={String(selectedPayment?.statusRaw || selectedPayment?.status || "--").toUpperCase()}
                    />
                    <DetailRow
                      label="Users / Cycle"
                      value={`${selectedPayment?.user_count || "--"} / ${Number(selectedPayment?.period_months || 1) >= 12 ? "Yearly" : "Monthly"}`}
                    />
                    <DetailRow
                      label="Transaction ID"
                      value={selectedPayment?.transaction_id || "--"}
                    />
                  </Box>
                </Paper>

                {String(selectedPayment?.statusRaw || selectedPayment?.status || "").toLowerCase() === "failed" ? (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: { xs: 1.4, sm: 1.8 },
                      borderRadius: 2.5,
                      borderColor: alpha(theme.palette.error.main, 0.26),
                      backgroundColor: alpha(theme.palette.error.main, theme.palette.mode === "light" ? 0.04 : 0.08),
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
                      Failure Reason
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                      {formatFailureReason(selectedPayment?.failure_reason)}
                    </Typography>
                  </Paper>
                ) : null}

                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 1.4, sm: 1.8 },
                    borderRadius: 2.5,
                    borderColor: alpha(theme.palette.divider, 0.9),
                  }}
                >
                  <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.4 }}>
                    Billing Parties
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                      gap: 1.5,
                    }}
                  >
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.4,
                        borderRadius: 2,
                        backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === "light" ? 0.04 : 0.1),
                      }}
                    >
                      <Typography variant="overline" color="text.secondary">
                        Billed By
                      </Typography>
                      <Stack spacing={0.8} sx={{ mt: 0.4 }}>
                        <DetailRow label="Company" value={company.name} emphasis />
                        <DetailRow label="Email" value={company.email || "--"} />
                        <DetailRow label="Phone" value={company.phone || "--"} />
                        <DetailRow label="Address" value={company.address || "--"} />
                      </Stack>
                    </Paper>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.4,
                        borderRadius: 2,
                        backgroundColor: alpha(theme.palette.success.main, theme.palette.mode === "light" ? 0.05 : 0.1),
                      }}
                    >
                      <Typography variant="overline" color="text.secondary">
                        Billing To
                      </Typography>
                      <Stack spacing={0.8} sx={{ mt: 0.4 }}>
                        <DetailRow label="Name" value={selectedPayment?.billing_name || "--"} emphasis />
                        <DetailRow label="Email" value={selectedPayment?.billing_email || "--"} />
                        <DetailRow
                          label="Address"
                          value={
                            [
                              selectedPayment?.address_line1,
                              selectedPayment?.city,
                              selectedPayment?.state,
                              selectedPayment?.postal_code,
                              selectedPayment?.country,
                            ].filter(Boolean).join(", ") || "--"
                          }
                        />
                      </Stack>
                    </Paper>
                  </Box>
                </Paper>
              </Stack>

              <Paper
                variant="outlined"
                sx={{
                  p: { xs: 1.4, sm: 1.8 },
                  borderRadius: 2.5,
                  borderColor: alpha(theme.palette.divider, 0.9),
                  position: { lg: "sticky" },
                  top: { lg: 16 },
                }}
              >
                <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.4 }}>
                  Amount Summary
                </Typography>
                <Stack spacing={1.1}>
                  <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Typography color="text.secondary">Sub Total</Typography>
                    <Typography fontWeight={800} sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatPaymentAmount(
                        Number(selectedPayment?.amount || 0) + Math.max(Number(selectedPayment?.discount_amount || 0), 0),
                        selectedPayment?.currency,
                      )}
                    </Typography>
                  </Stack>
                  {Number(selectedPayment?.discount_amount || 0) > 0 ? (
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                      <Typography color="text.secondary">
                        Discount {selectedPayment?.coupon_code ? `(${selectedPayment.coupon_code})` : ""}
                      </Typography>
                      <Typography fontWeight={800} color="success.main" sx={{ fontVariantNumeric: "tabular-nums" }}>
                        -{formatPaymentAmount(Number(selectedPayment?.discount_amount || 0), selectedPayment?.currency)}
                      </Typography>
                    </Stack>
                  ) : null}
                  <Divider sx={{ my: 0.2 }} />
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: 2.2,
                      background:
                        theme.palette.mode === "light"
                          ? `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.12)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)`
                          : `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.18)} 0%, ${alpha(theme.palette.primary.main, 0.14)} 100%)`,
                      border: "1px solid",
                      borderColor: alpha(theme.palette.success.main, 0.22),
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Grand Total
                    </Typography>
                    <Typography
                      fontWeight={900}
                      sx={{
                        mt: 0.4,
                        fontSize: { xs: 28, sm: 34 },
                        lineHeight: 1.05,
                        fontVariantNumeric: "tabular-nums",
                        wordBreak: "break-word",
                      }}
                    >
                      {selectedPayment?.amountLabel || formatPaymentAmount(selectedPayment?.amount, selectedPayment?.currency)}
                    </Typography>
                  </Paper>
                  <Divider sx={{ my: 0.2 }} />
                  <DetailRow label="Currency" value={String(selectedPayment?.currency || "INR").toUpperCase()} />
                  <DetailRow
                    label="Billing Type"
                    value={String(selectedPayment?.billing_type || "--").replace(/^./, (m) => m.toUpperCase())}
                  />
                  <DetailRow
                    label="Invoice Date"
                    value={formatIsoDate(selectedPayment?.payment_date || selectedPayment?.date)}
                  />
                </Stack>
              </Paper>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            px: { xs: 1.5, sm: 2.5 },
            py: 1.5,
            borderTop: "1px solid",
            borderColor: "divider",
            backgroundColor: alpha(theme.palette.background.default, 0.72),
            backdropFilter: "blur(10px)",
          }}
        >
          <Button onClick={() => setSelectedPayment(null)} variant="text">
            Close
          </Button>
          {String(selectedPayment?.statusRaw || selectedPayment?.status || "").toLowerCase() === "failed" && typeof onRepay === "function" ? (
            <Button
              variant="contained"
              color="error"
              startIcon={repayLoadingId === selectedPayment?.id ? null : <ReplayRoundedIcon />}
              disabled={repayLoadingId === selectedPayment?.id}
              onClick={() => {
                onRepay({ ...selectedPayment });
                setSelectedPayment(null);
              }}
              sx={{ fontWeight: 800 }}
            >
              {repayLoadingId === selectedPayment?.id ? "Starting..." : "Repay"}
            </Button>
          ) : String(selectedPayment?.statusRaw || selectedPayment?.status || "").toLowerCase() === "pending" && selectedPayment?.checkout_session_id && typeof onResume === "function" ? (
            <Button
              variant="contained"
              color="warning"
              startIcon={resumeLoadingId === selectedPayment?.id ? null : <OpenInNewRoundedIcon />}
              disabled={resumeLoadingId === selectedPayment?.id}
              onClick={() => {
                onResume({ ...selectedPayment });
                setSelectedPayment(null);
              }}
              sx={{ fontWeight: 800 }}
            >
              {resumeLoadingId === selectedPayment?.id ? "Loading..." : "Resume Payment"}
            </Button>
          ) : (
            <Button variant="contained" startIcon={<DownloadOutlinedIcon />} onClick={() => handleDownloadInvoice(selectedPayment)}>
              Download Invoice
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PaymentHistory;
