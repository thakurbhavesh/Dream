import { formatAppDate } from "./dateTime";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatPdfAmount = (amount, currency = "INR") => {
  const normalizedCurrency = String(currency || "INR").toUpperCase();
  const numeric = toNumber(amount, 0);
  const formatted = numeric.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${normalizedCurrency} ${formatted}`;
};

export const downloadInvoicePdf = async ({ payment = {}, company = {} } = {}) => {
  const jsPdfModule = await import("jspdf");
  const jsPDF = jsPdfModule?.jsPDF || jsPdfModule?.default;
  if (typeof jsPDF !== "function") {
    throw new Error("Invoice generator is unavailable.");
  }

  const currency = String(payment.currency || "INR").toUpperCase();
  const discountAmount = toNumber(payment.discount_amount, 0);
  const grandTotal = toNumber(payment.amount, 0);
  const subTotal = Number((grandTotal + Math.max(discountAmount, 0)).toFixed(2));

  const subTotalLabel = formatPdfAmount(subTotal, currency);
  const discountLabel = formatPdfAmount(discountAmount, currency);
  const amountLabel = formatPdfAmount(grandTotal, currency);
  const invoiceNo = String(payment.invoice || "invoice").trim() || "invoice";

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  const drawLabelValue = (label, value, valueBold = false) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 98, 112);
    doc.text(label, margin + 2, y);
    doc.setFont("helvetica", valueBold ? "bold" : "normal");
    doc.setTextColor(17, 24, 39);
    doc.text(String(value || "--"), pageWidth - margin - 2, y, { align: "right" });
    y += 7;
  };

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, y - 6, contentWidth, 20, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Tax Invoice", margin + 4, y + 4);
  y += 20;

  doc.setDrawColor(220, 226, 235);
  doc.roundedRect(margin, y, contentWidth, 34, 2, 2, "S");
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(String(company.name || "--"), margin + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(67, 76, 92);
  const companyAddressLines = doc.splitTextToSize(String(company.address || "--"), contentWidth - 8);
  doc.text(companyAddressLines, margin + 4, y + 12);
  doc.text(`${company.email || "--"}${company.phone ? ` | ${company.phone}` : ""}`, margin + 4, y + 24);
  y += 40;

  doc.setDrawColor(220, 226, 235);
  doc.roundedRect(margin, y, contentWidth, 34, 2, 2, "S");
  y += 6;
  drawLabelValue("Invoice No.", invoiceNo, true);
  drawLabelValue(
    "Date",
    formatAppDate(payment.payment_date || payment.date, { includeTime: true, fallback: "--" }),
    false,
  );
  drawLabelValue("Status", String(payment.status || "--").toUpperCase(), true);
  drawLabelValue("Transaction ID", payment.transaction_id || "--", false);
  y += 2;

  doc.setDrawColor(220, 226, 235);
  doc.roundedRect(margin, y, contentWidth, 28, 2, 2, "S");
  doc.setFillColor(246, 248, 252);
  doc.rect(margin + 0.2, y + 0.2, contentWidth - 0.4, 7.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text("Description", margin + 3, y + 5.2);
  doc.text("Users", margin + 78, y + 5.2);
  doc.text("Cycle", margin + 104, y + 5.2);
  doc.text("Amount", pageWidth - margin - 3, y + 5.2, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(String(payment.plan_name || "Subscription"), margin + 3, y + 14.5);
  doc.text(String(payment.user_count || "--"), margin + 78, y + 14.5);
  doc.text(Number(payment.period_months || 1) >= 12 ? "Yearly" : "Monthly", margin + 104, y + 14.5);
  doc.text(amountLabel, pageWidth - margin - 3, y + 14.5, { align: "right" });
  y += 34;

  doc.setDrawColor(220, 226, 235);
  doc.roundedRect(margin, y, contentWidth, discountAmount > 0 ? 28 : 20, 2, 2, "S");
  y += 6;
  drawLabelValue("Sub Total", subTotalLabel, true);
  if (discountAmount > 0) {
    drawLabelValue(
      `Discount${payment?.coupon_code ? ` (${payment.coupon_code})` : ""}`,
      `-${discountLabel}`,
      true,
    );
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text("Grand Total", margin + 2, y + 1);
  doc.text(amountLabel, pageWidth - margin - 2, y + 1, { align: "right" });
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text("This is a system-generated invoice.", margin, Math.min(286, y + 8));

  doc.save(`${invoiceNo}.pdf`);
};

