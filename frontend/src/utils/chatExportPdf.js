/**
 * Export chat messages as a PDF using jsPDF (already installed).
 * Follows the same pattern as invoicePdf.js.
 */
export const exportChatAsPdf = async (messages = [], chatLabel = "Chat", currentUserName = "You") => {
  const jsPdfModule = await import("jspdf");
  const jsPDF = jsPdfModule?.jsPDF || jsPdfModule?.default;
  if (typeof jsPDF !== "function") {
    throw new Error("PDF generator is unavailable.");
  }

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  const addPage = () => {
    doc.addPage();
    y = 16;
  };

  const checkPageBreak = (needed = 12) => {
    if (y + needed > pageHeight - 16) {
      addPage();
    }
  };

  // ─── Header ──────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(25, 118, 210);
  doc.text(chatLabel, margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Exported: ${new Date().toLocaleString()}`, margin, y);
  doc.text(`Messages: ${messages.length}`, pageWidth - margin, y, { align: "right" });
  y += 4;

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ─── Messages ────────────────────────────────────────────────────
  for (const msg of messages) {
    checkPageBreak(18);

    const isOwn = msg.direction === "outgoing";
    const senderName = isOwn ? currentUserName : (msg.author?.name || "Unknown");
    const timestamp = msg.createdAt
      ? new Date(msg.createdAt).toLocaleString()
      : "";
    const msgType = msg.type || "text";

    // Sender name + time
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(isOwn ? 25 : 76, isOwn ? 118 : 76, isOwn ? 210 : 76);
    doc.text(senderName, margin, y);

    if (timestamp) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(160, 160, 160);
      doc.text(timestamp, pageWidth - margin, y, { align: "right" });
    }
    y += 4.5;

    // Message content
    let text = "";
    if (msgType === "text") {
      text = msg.content?.text || msg.message || "";
    } else if (msgType === "file" || msgType === "image" || msgType === "video" || msgType === "audio") {
      text = `[${msgType.toUpperCase()}] ${msg.content?.fileName || msg.content?.caption || ""}`;
    } else if (msgType === "poll") {
      text = `[POLL] ${msg.content?.question || ""}`;
    } else if (msgType === "system") {
      text = `[System] ${msg.content?.text || ""}`;
    } else {
      text = msg.content?.text || msg.message || `[${msgType}]`;
    }

    if (text) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);

      const lines = doc.splitTextToSize(text.trim(), contentWidth);
      for (const line of lines) {
        checkPageBreak(5);
        doc.text(line, margin, y);
        y += 4.2;
      }
    }

    y += 3;
  }

  // ─── Save ────────────────────────────────────────────────────────
  const safeName = chatLabel.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  doc.save(`chat-export-${safeName}.pdf`);
};
