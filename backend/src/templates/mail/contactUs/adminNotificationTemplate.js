const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeHeader = (value) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();

const getContactUsAdminNotificationTemplate = (payload, { appName = 'TeamChatX' } = {}) => {
  const submittedAt = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const requirementPreview = String(payload.requirement_details || '')
    .trim()
    .slice(0, 160);
  const safeCompanyForSubject = sanitizeHeader(payload.company_name) || 'Unknown Company';
  const safeAppName = escapeHtml(appName || 'TeamChatX');

  return {
    subject: `New ${appName || 'TeamChatX'} Contact Request - ${safeCompanyForSubject}`,
    text: [
      'New contact request received.',
      `Name: ${payload.name}`,
      `Email: ${payload.email_address}`,
      `Company: ${payload.company_name}`,
      `Users: ${payload.total_users}`,
      `Submitted At: ${submittedAt}`,
    ].join('\n'),
    html: `
      <div style="margin:0;padding:24px;background:#eef2ff;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dbe3ff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:18px 22px;background:linear-gradient(135deg,#0b132b,#1e3a8a);color:#ffffff;">
              <div style="font-size:18px;font-weight:700;">${safeAppName}</div>
              <div style="margin-top:6px;font-size:13px;opacity:.9;">New Contact Us Request</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 22px;">
              <div style="display:inline-block;background:#eef2ff;color:#1d4ed8;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700;">REQ-${escapeHtml(payload.contact_request_id)}</div>
              <h3 style="margin:12px 0 6px;font-size:18px;">${escapeHtml(payload.company_name)}</h3>
              <p style="margin:0 0 14px;color:#475569;">${escapeHtml(payload.name)} submitted a new inquiry.</p>
              <div style="font-size:14px;color:#334155;line-height:1.8;">
                <div><strong>Email:</strong> ${escapeHtml(payload.email_address)}</div>
                <div><strong>Phone:</strong> ${escapeHtml(payload.country_code)} ${escapeHtml(payload.mobile_number)}</div>
                <div><strong>Total Users:</strong> ${escapeHtml(payload.total_users)}</div>
                <div><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</div>
              </div>
              ${requirementPreview ? `<div style="margin-top:14px;padding:12px;background:#f8fafc;border-radius:10px;font-size:13px;color:#334155;"><strong>Requirement:</strong> ${escapeHtml(requirementPreview)}</div>` : ''}
            </td>
          </tr>
        </table>
      </div>
    `,
  };
};

module.exports = {
  getContactUsAdminNotificationTemplate,
};

