import { formatExpiryDate, parseAppDate } from "./dateTime";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getSubscriptionCycleLabel = (periodMonths) =>
  toNumber(periodMonths, 1) >= 12 ? "Yearly" : "Monthly";

export const normalizeSubscriptionStatus = (value, fallback = "active") =>
  String(value || fallback).trim().toLowerCase() || fallback;

export const formatSubscriptionStatusLabel = (value, fallback = "active") =>
  normalizeSubscriptionStatus(value, fallback).toUpperCase();

export const buildSubscriptionView = (currentPlan = {}, options = {}) => {
  const activeUsers = Math.max(toNumber(options?.activeUsers, 0), 0);
  const fallbackName = options?.fallbackName || "--";
  const planName = String(currentPlan?.plan_name || currentPlan?.plan_key || fallbackName).trim() || fallbackName;
  const status = normalizeSubscriptionStatus(currentPlan?.subscription_status || currentPlan?.status, "active");
  const statusLabel = formatSubscriptionStatusLabel(status, "active");
  const startDate = currentPlan?.start_date || "";
  const endDate = currentPlan?.end_date || "";
  const maxUsers = Math.max(toNumber(currentPlan?.max_users, 0), 0);
  const maxStorageMb = Math.max(toNumber(currentPlan?.max_storage_mb, 0), 0);
  const periodMonths = Math.max(toNumber(currentPlan?.period_months || currentPlan?.interval_months, 1), 1);
  const cycleLabel = getSubscriptionCycleLabel(periodMonths);

  const start = parseAppDate(startDate);
  const end = parseAppDate(endDate);
  const now = new Date();
  const totalDaysRaw = start && end
    ? Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    : 30;
  const totalDays = Number.isFinite(totalDaysRaw) && totalDaysRaw > 0 ? totalDaysRaw : 30;
  const remainingDaysRaw = end
    ? Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 25;
  const remainingDays = Number.isFinite(remainingDaysRaw) ? Math.max(remainingDaysRaw, 0) : 25;
  const remainingPercent = totalDays
    ? Math.max(0, Math.min((remainingDays / totalDays) * 100, 100))
    : 0;

  return {
    planId: toNumber(currentPlan?.plan_id, 0) || null,
    subscriptionId: toNumber(currentPlan?.subscription_id, 0) || null,
    planName,
    planKey: String(currentPlan?.plan_key || "").trim(),
    status,
    statusLabel,
    startDate,
    endDate,
    expiryLabel: formatExpiryDate(endDate, "--"),
    maxUsers,
    activeUsers,
    unusedLicenses: Math.max(maxUsers - activeUsers, 0),
    licenseUsagePercent: Math.min((activeUsers / Math.max(maxUsers, 1)) * 100, 100),
    maxStorageMb,
    periodMonths,
    cycleLabel,
    totalDays,
    remainingDays,
    remainingPercent,
    usedPercent: 100 - remainingPercent,
  };
};
