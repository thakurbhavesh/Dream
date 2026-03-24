const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getPasswordResetSuccessMailTemplate = ({ ownerName, supportEmail, appName = 'TeamChatX' }) => {
  const safeOwner = escapeHtml(ownerName || 'User');
  const safeSupport = escapeHtml(supportEmail || 'support@teamchatx.com');
  const safeAppName = escapeHtml(appName || 'TeamChatX');

  return {
    subject: `Your ${appName || 'TeamChatX'} password was changed`,
    text: [
      `Hello ${ownerName || 'User'},`,
      '',
      `Your ${appName || 'TeamChatX'} account password has been reset successfully.`,
      'If this was not you, secure your account immediately and contact support.',
      `Support: ${supportEmail || 'support@teamchatx.com'}`,
      '',
      `${appName || 'TeamChatX'} Security`,
    ].join('\n'),
    html: `
      <div style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;background:#0f172a;color:#ffffff;">
              <div style="font-size:18px;font-weight:700;">${safeAppName}</div>
              <div style="margin-top:6px;font-size:13px;color:#cbd5e1;">Password Reset Successful</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;">Hello <strong>${safeOwner}</strong>,</p>
              <p style="margin:0 0 14px 0;font-size:14px;line-height:1.7;color:#334155;">
                Your ${safeAppName} account password has been changed successfully.
              </p>
              <div style="margin:0 0 16px 0;padding:12px 14px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;">
                <p style="margin:0;font-size:13px;line-height:1.7;color:#065f46;">
                  If you did not perform this action, please secure your account immediately and contact support.
                </p>
              </div>
              <p style="margin:0;font-size:13px;color:#475569;">Support: <a href="mailto:${safeSupport}" style="color:#0f766e;text-decoration:none;">${safeSupport}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;font-size:12px;color:#64748b;">
              ${safeAppName} Security
            </td>
          </tr>
        </table>
      </div>
    `,
  };
};

module.exports = {
  getPasswordResetSuccessMailTemplate,
};
