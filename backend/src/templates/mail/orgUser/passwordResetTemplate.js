const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getOrgUserPasswordResetMailTemplate = ({
  name,
  tempPassword,
  appName = 'TeamChatX',
  supportEmail = 'support@teamchatx.com',
}) => {
  const safeName = escapeHtml(name || 'User');
  const safeTemp = escapeHtml(tempPassword || '');
  const safeAppName = escapeHtml(appName || 'TeamChatX');
  const safeSupport = escapeHtml(supportEmail || 'support@teamchatx.com');

  return {
    subject: `Your ${appName || 'TeamChatX'} password has been reset`,
    text: [
      `Hello ${name},`,
      '',
      `Your ${appName || 'TeamChatX'} password has been reset.`,
      `Temporary password: ${tempPassword}`,
      '',
      'Please login and change your password immediately.',
      `Support: ${supportEmail || 'support@teamchatx.com'}`,
      '',
      `${appName || 'TeamChatX'}`,
    ].join('\n'),
    html: `
      <div style="margin:0;padding:20px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;">
          <h2 style="margin:0 0 12px 0;font-size:18px;">Password Reset</h2>
          <p style="margin:0 0 12px 0;font-size:14px;">Hello <strong>${safeName}</strong>,</p>
          <p style="margin:0 0 14px 0;font-size:14px;">Your ${safeAppName} password has been reset.</p>
          <div style="padding:12px 14px;background:#f1f5f9;border:1px dashed #94a3b8;border-radius:8px;text-align:center;">
            <div style="font-size:12px;color:#475569;margin-bottom:6px;">Temporary Password</div>
            <div style="font-size:20px;font-family:'Courier New',monospace;font-weight:700;letter-spacing:1px;">${safeTemp}</div>
          </div>
          <p style="margin:14px 0 0 0;font-size:12px;color:#475569;">Please login and change your password immediately.</p>
          <p style="margin:10px 0 0 0;font-size:12px;color:#475569;">Support: <a href="mailto:${safeSupport}" style="color:#2563eb;text-decoration:none;">${safeSupport}</a></p>
        </div>
      </div>
    `,
  };
};

module.exports = {
  getOrgUserPasswordResetMailTemplate,
};

