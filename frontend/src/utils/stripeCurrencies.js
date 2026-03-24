const STRIPE_SUPPORTED_CURRENCY_CODES = [
  "USD", "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN",
  "BAM", "BBD", "BDT", "BGN", "BIF", "BMD", "BND", "BOB", "BRL", "BSD", "BWP",
  "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNY", "COP", "CRC", "CVE", "CZK",
  "DJF", "DKK", "DOP", "DZD", "EGP", "ETB", "EUR", "FJD", "FKP", "GBP", "GEL",
  "GIP", "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HRK", "HTG", "HUF", "IDR",
  "ILS", "INR", "ISK", "JMD", "JPY", "KES", "KGS", "KHR", "KMF", "KRW", "KYD",
  "KZT", "LAK", "LBP", "LKR", "LRD", "LSL", "MAD", "MDL", "MGA", "MKD", "MMK",
  "MNT", "MOP", "MUR", "MVR", "MWK", "MXN", "MYR", "MZN", "NAD", "NGN", "NIO",
  "NOK", "NPR", "NZD", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN", "PYG", "QAR",
  "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SEK", "SGD", "SHP", "SLE",
  "SOS", "SRD", "STD", "SZL", "THB", "TJS", "TOP", "TRY", "TTD", "TWD", "TZS",
  "UAH", "UGX", "UYU", "UZS", "VND", "VUV", "WST", "XAF", "XCD", "XCG", "XOF",
  "XPF", "YER", "ZAR", "ZMW",
];

const STRIPE_SUPPORTED_CURRENCY_SET = new Set(STRIPE_SUPPORTED_CURRENCY_CODES);

const displayNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "currency" })
    : null;

const getCurrencyDisplayName = (currencyCode) => {
  const normalized = String(currencyCode || "").trim().toUpperCase();
  if (!normalized) return "";
  try {
    return displayNames?.of(normalized) || normalized;
  } catch {
    return normalized;
  }
};

const normalizeCurrencyRow = (row = {}) => {
  const currencyCode = String(row?.currency_code || "").trim().toUpperCase();
  return {
    ...row,
    currency_code: currencyCode,
    currency_name: String(row?.currency_name || "").trim() || getCurrencyDisplayName(currencyCode),
  };
};

const isStripeSupportedCurrency = (currencyCode) =>
  STRIPE_SUPPORTED_CURRENCY_SET.has(String(currencyCode || "").trim().toUpperCase());

export const getStripeSupportedCurrencies = (rows = []) => {
  const normalizedMap = new Map();

  if (Array.isArray(rows)) {
    rows.forEach((row) => {
      const normalized = normalizeCurrencyRow(row);
      if (!isStripeSupportedCurrency(normalized.currency_code) || !normalized.currency_code) return;
      normalizedMap.set(normalized.currency_code, normalized);
    });
  }

  return STRIPE_SUPPORTED_CURRENCY_CODES.map((currencyCode) => (
    normalizedMap.get(currencyCode) || normalizeCurrencyRow({ currency_code: currencyCode })
  ));
};
