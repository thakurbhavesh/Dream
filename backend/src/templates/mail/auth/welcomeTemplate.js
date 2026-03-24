const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getWelcomeMailTemplate = ({ ownerName, appName = 'TeamChatX', supportEmail, loginUrl }) => {
  const safeOwner = escapeHtml(ownerName || 'User');
  const safeAppName = escapeHtml(appName || 'TeamChatX');
  const safeSupport = escapeHtml(supportEmail || 'support@teamchatx.com');
  const safeLoginUrl = loginUrl ? escapeHtml(loginUrl) : '';
  const hasLoginUrl = Boolean(String(loginUrl || '').trim());

  return {
    subject: `Welcome to ${appName || 'TeamChatX'} - Your workspace is ready`,
    text: [
      `Hello ${ownerName || 'User'},`,
      '',
      `Welcome to ${appName || 'TeamChatX'}! Your workspace is now ready.`,
      '',
      'What you can do next:',
      '- Login and complete your profile',
      '- Invite your team members',
      '- Configure roles and permissions',
      hasLoginUrl ? `- Login now: ${loginUrl}` : null,
      '',
      `Need help? Reach us at: ${supportEmail || 'support@teamchatx.com'}`,
      '',
      `${appName || 'TeamChatX'} Team`,
    ].filter(Boolean).join('\n'),
    html: `
      <div style="margin:0;padding:28px 16px;background:#eaf1ff;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dbe7ff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.08);">
          <tr>
            <td style="padding:24px 26px;background:linear-gradient(120deg,#0f172a 0%,#1d4ed8 55%,#2563eb 100%);color:#ffffff;">
              <div style="font-size:20px;font-weight:800;letter-spacing:0.2px;">${safeAppName}</div>
              <div style="margin-top:8px;font-size:13px;color:#dbeafe;">Welcome Aboard</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 26px 16px 26px;">
              <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;">Hello <strong>${safeOwner}</strong>,</p>
              <p style="margin:0 0 18px 0;font-size:14px;line-height:1.75;color:#334155;">
                Your account has been verified successfully and your <strong>${safeAppName}</strong> workspace is now active.
              </p>

              ${hasLoginUrl ? `
              <div style="margin:0 0 18px 0;">
                <a href="${safeLoginUrl}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:11px 18px;border-radius:10px;">
                  Login To Workspace
                </a>
              </div>
              ` : ''}

              <div style="margin:0 0 18px 0;padding:16px;background:#f5f9ff;border:1px solid #cfe0ff;border-radius:12px;">
                <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#1e3a8a;">Recommended next steps</p>
                <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.8;color:#1e293b;">
                  <li>Sign in and complete your profile.</li>
                  <li>Invite your team members.</li>
                  <li>Set up roles, departments, and permissions.</li>
                </ul>
              </div>
              <p style="margin:0 0 10px 0;font-size:13px;color:#475569;">
                Need help? Contact us at
                <a href="mailto:${safeSupport}" style="color:#1d4ed8;text-decoration:none;">${safeSupport}</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 26px;background:#f8fbff;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
              ${safeAppName} Team
            </td>
          </tr>
        </table>
      </div>
    `,
  };
};

module.exports = {
  getWelcomeMailTemplate,
};
