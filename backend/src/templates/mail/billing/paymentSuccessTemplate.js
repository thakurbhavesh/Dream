const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getBillingPaymentSuccessTemplate = (
  payload = {},
  { appName = 'TeamChatX', supportEmail = 'support@teamchatx.com' } = {},
) => {
  const orgName = escapeHtml(payload.organization_name || 'Your Workspace');
  const planName = escapeHtml(payload.plan_name || 'Selected Plan');
  const amount = escapeHtml(payload.amount_label || '');
  const currency = escapeHtml(payload.currency || 'INR');
  const userCount = escapeHtml(payload.user_count || '-');
  const cycle = escapeHtml(payload.cycle_label || 'Monthly');
  const billingType = escapeHtml(payload.billing_type || 'upgrade');
  const invoiceNumber = escapeHtml(payload.invoice_number || '-');
  const transactionId = escapeHtml(payload.transaction_id || '-');
  const paymentDate = escapeHtml(payload.payment_date || '-');
  const billingEmail = escapeHtml(payload.billing_email || '-');
  const billingName = escapeHtml(payload.billing_name || '-');
  const companyName = escapeHtml(payload.company_name || '-');
  const addressLine1 = escapeHtml(payload.billing_address_line1 || '-');
  const billingCity = escapeHtml(payload.billing_city || '');
  const billingState = escapeHtml(payload.billing_state || '');
  const billingCountry = escapeHtml(payload.billing_country || '');
  const billingPostalCode = escapeHtml(payload.billing_postal_code || '');
  const couponCode = escapeHtml(payload.coupon_code || '');
  const subtotalLabel = escapeHtml(payload.subtotal_label || amount);
  const discountLabel = escapeHtml(payload.discount_label || '0.00');
  const totalLabel = escapeHtml(payload.total_label || amount);
  const appLabel = escapeHtml(appName || 'TeamChatX');
  const support = escapeHtml(supportEmail || 'support@teamchatx.com');
  const addressJoined = [addressLine1, billingCity, billingState, billingCountry, billingPostalCode]
    .filter((x) => x && x !== '-')
    .join(', ');
  const money = (value) => `${value} ${currency}`;

  const subject = `${appLabel} payment successful - Invoice ${invoiceNumber}`;
  const text = [
    `Hello ${billingName !== '-' ? billingName : 'there'},`,
    ``,
    `Your ${billingType} payment has been successfully processed.`,
    `Organization: ${orgName}`,
    `Plan: ${planName}`,
    `Users: ${userCount}`,
    `Cycle: ${cycle}`,
    `Sub Total: ${money(subtotalLabel)}`,
    `Discount: ${money(discountLabel)}${couponCode ? ` (${couponCode})` : ''}`,
    `Grand Total: ${money(totalLabel)}`,
    `Invoice: ${invoiceNumber}`,
    `Transaction ID: ${transactionId}`,
    `Payment Date: ${paymentDate}`,
    `Billing Email: ${billingEmail}`,
    `Billing Address: ${addressJoined || '-'}`,
    ``,
    `Thanks for choosing ${appLabel}. Your subscription is active now.`,
    `Support: ${support}`,
  ].join('\n');

  const html = `
    <div style="background:#eef3fb;padding:24px 12px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:840px;margin:0 auto;background:#ffffff;border:1px solid #dbe3ef;border-radius:20px;overflow:hidden;">
        <div style="padding:24px;background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 55%,#60a5fa 100%);color:#ffffff;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="vertical-align:top;">
                <div style="display:inline-block;width:50px;height:50px;line-height:50px;text-align:center;border-radius:14px;background:rgba(255,255,255,0.16);font-size:28px;font-weight:700;">✓</div>
              </td>
              <td style="padding-left:14px;vertical-align:top;">
                <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.8;">Invoice Preview</div>
                <div style="font-size:28px;font-weight:800;line-height:1.15;margin-top:4px;">${invoiceNumber}</div>
                <div style="margin-top:6px;font-size:14px;opacity:.9;">${planName} for ${orgName}</div>
              </td>
              <td style="text-align:right;vertical-align:top;">
                <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.24);font-size:12px;font-weight:700;">PAYMENT SUCCESSFUL</div>
                <div style="margin-top:14px;font-size:13px;opacity:.8;">Paid on ${paymentDate}</div>
                <div style="margin-top:8px;font-size:32px;font-weight:800;line-height:1;">${money(totalLabel)}</div>
              </td>
            </tr>
          </table>
          <div style="margin-top:16px;">
            <span style="display:inline-block;margin:0 8px 8px 0;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);font-size:12px;">Billing Type: ${billingType}</span>
            <span style="display:inline-block;margin:0 8px 8px 0;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);font-size:12px;">Users: ${userCount}</span>
            <span style="display:inline-block;margin:0 8px 8px 0;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);font-size:12px;">Cycle: ${cycle}</span>
            <span style="display:inline-block;margin:0 8px 8px 0;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);font-size:12px;">Txn ID: ${transactionId}</span>
          </div>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 18px 0;">Hello <strong>${billingName !== '-' ? billingName : orgName}</strong>, your payment has been processed successfully and your subscription is now active.</p>

          <table style="width:100%;border-collapse:separate;border-spacing:0 16px;">
            <tr>
              <td style="width:62%;vertical-align:top;padding-right:12px;">
                <div style="border:1px solid #e2e8f0;border-radius:16px;padding:18px;">
                  <div style="font-size:18px;font-weight:800;margin-bottom:14px;">Invoice & Subscription</div>
                  <table style="width:100%;border-collapse:separate;border-spacing:0 12px;">
                    <tr><td style="font-size:12px;color:#64748b;width:42%;">Invoice Number</td><td style="font-size:14px;font-weight:700;">${invoiceNumber}</td></tr>
                    <tr><td style="font-size:12px;color:#64748b;">Invoice Date</td><td style="font-size:14px;font-weight:700;">${paymentDate}</td></tr>
                    <tr><td style="font-size:12px;color:#64748b;">Plan</td><td style="font-size:14px;font-weight:700;">${planName}</td></tr>
                    <tr><td style="font-size:12px;color:#64748b;">Status</td><td style="font-size:14px;font-weight:700;">SUCCESS</td></tr>
                    <tr><td style="font-size:12px;color:#64748b;">Users / Cycle</td><td style="font-size:14px;font-weight:700;">${userCount} / ${cycle}</td></tr>
                    <tr><td style="font-size:12px;color:#64748b;">Transaction ID</td><td style="font-size:14px;font-weight:700;">${transactionId}</td></tr>
                  </table>
                </div>

                <div style="border:1px solid #e2e8f0;border-radius:16px;padding:18px;margin-top:16px;">
                  <div style="font-size:18px;font-weight:800;margin-bottom:14px;">Billing Parties</div>
                  <table style="width:100%;border-collapse:separate;border-spacing:0 14px;">
                    <tr>
                      <td style="width:50%;vertical-align:top;padding-right:8px;">
                        <div style="border:1px solid #dbeafe;background:#f8fbff;border-radius:14px;padding:14px;">
                          <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">Billed By</div>
                          <div style="margin-top:8px;font-size:14px;font-weight:800;">${appLabel}</div>
                          <div style="margin-top:6px;font-size:13px;color:#475569;">${support}</div>
                        </div>
                      </td>
                      <td style="width:50%;vertical-align:top;padding-left:8px;">
                        <div style="border:1px solid #dcfce7;background:#f8fffb;border-radius:14px;padding:14px;">
                          <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">Billing To</div>
                          <div style="margin-top:8px;font-size:14px;font-weight:800;">${billingName}</div>
                          <div style="margin-top:6px;font-size:13px;color:#475569;">${billingEmail}</div>
                          <div style="margin-top:6px;font-size:13px;color:#475569;">${companyName}</div>
                          <div style="margin-top:6px;font-size:13px;color:#475569;">${addressJoined || '-'}</div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </div>
              </td>
              <td style="width:38%;vertical-align:top;padding-left:12px;">
                <div style="border:1px solid #e2e8f0;border-radius:16px;padding:18px;">
                  <div style="font-size:18px;font-weight:800;margin-bottom:14px;">Amount Summary</div>
                  <table style="width:100%;border-collapse:separate;border-spacing:0 12px;">
                    <tr><td style="font-size:13px;color:#64748b;">Sub Total</td><td style="text-align:right;font-size:14px;font-weight:700;">${money(subtotalLabel)}</td></tr>
                    <tr><td style="font-size:13px;color:#64748b;">Discount${couponCode ? ` (${couponCode})` : ''}</td><td style="text-align:right;font-size:14px;font-weight:700;color:#15803d;">-${money(discountLabel)}</td></tr>
                  </table>
                  <div style="margin-top:14px;padding:16px;border-radius:16px;background:linear-gradient(135deg,#ecfdf5 0%,#eff6ff 100%);border:1px solid #bbf7d0;">
                    <div style="font-size:12px;color:#64748b;">Grand Total</div>
                    <div style="margin-top:6px;font-size:30px;font-weight:800;line-height:1.05;color:#0f172a;">${money(totalLabel)}</div>
                  </div>
                  <table style="width:100%;border-collapse:separate;border-spacing:0 12px;margin-top:14px;">
                    <tr><td style="font-size:13px;color:#64748b;">Currency</td><td style="text-align:right;font-size:14px;font-weight:700;">${currency}</td></tr>
                    <tr><td style="font-size:13px;color:#64748b;">Billing Type</td><td style="text-align:right;font-size:14px;font-weight:700;text-transform:capitalize;">${billingType}</td></tr>
                    <tr><td style="font-size:13px;color:#64748b;">Status</td><td style="text-align:right;font-size:14px;font-weight:700;">SUCCESS</td></tr>
                  </table>
                </div>
              </td>
            </tr>
          </table>

          <div style="margin-top:18px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;color:#475569;">
            Need help? Contact our billing support at
            <a href="mailto:${support}" style="color:#1d4ed8;text-decoration:none;">${support}</a>.
          </div>
        </div>
      </div>
    </div>
  `;

  return { subject, text, html };
};

module.exports = {
  getBillingPaymentSuccessTemplate,
};
