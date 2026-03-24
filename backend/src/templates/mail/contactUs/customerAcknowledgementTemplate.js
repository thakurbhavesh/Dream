const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getContactUsCustomerAcknowledgementTemplate = (
  payload,
  { appName = 'TeamChatX', supportEmail = 'support@teamchatx.com' } = {}
) => {
  const safeAppName = escapeHtml(appName || 'TeamChatX');
  const safeSupport = escapeHtml(supportEmail || 'support@teamchatx.com');
  return {
    subject: `Thank you for contacting ${appName || 'TeamChatX'}`,
    text: [
      `Hi ${payload.name},`,
      '',
      `Thank you for contacting ${appName || 'TeamChatX'}.`,
      'Our team has received your request and will get back to you shortly.',
      `Support: ${supportEmail || 'support@teamchatx.com'}`,
      '',
      `${appName || 'TeamChatX'} Support`,
    ].join('\n'),
    html: `
      <div style="margin:0;padding:24px;background:#eef2ff;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dbe3ff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:18px 22px;background:linear-gradient(135deg,#0b132b,#1e3a8a);color:#ffffff;">
              <div style="font-size:18px;font-weight:700;">${safeAppName}</div>
              <div style="margin-top:6px;font-size:13px;opacity:.9;">Thank You For Contacting Us</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 22px;">
              <p style="margin:0 0 10px;font-size:15px;">Hi <strong>${escapeHtml(payload.name)}</strong>,</p>
              <p style="margin:0;color:#475569;line-height:1.7;">
                Thank you for contacting ${safeAppName}.
                Our team has received your request and will get back to you shortly.
              </p>
              <p style="margin:12px 0 0 0;color:#475569;font-size:13px;line-height:1.7;">
                Support: <a href="mailto:${safeSupport}" style="color:#1d4ed8;text-decoration:none;">${safeSupport}</a>
              </p>
            </td>
          </tr>
        </table>
      </div>
    `,
  };
};

module.exports = {
  getContactUsCustomerAcknowledgementTemplate,
};

