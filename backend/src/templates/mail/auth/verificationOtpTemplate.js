const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getVerificationOtpMailTemplate = ({
  ownerName,
  otpCode,
  otpExpiresMinutes = 10,
  appName = 'TeamChatX',
  purpose = 'verification',
  supportEmail = 'support@teamchatx.com',
}) => {
  const safeOwner = escapeHtml(ownerName || 'User');
  const safeOtp = escapeHtml(otpCode || '');
  const safeMinutes = escapeHtml(otpExpiresMinutes);
  const safeAppName = escapeHtml(appName || 'TeamChatX');
  const safeSupport = escapeHtml(supportEmail || 'support@teamchatx.com');
  const isLoginPurpose = String(purpose || '').trim().toLowerCase() === 'login';
  const subject = isLoginPurpose
    ? `Your ${appName || 'TeamChatX'} login verification code`
    : `Your ${appName || 'TeamChatX'} verification code`;
  const contextLabel = isLoginPurpose ? 'Login Verification' : 'Account Verification';
  const instructionText = isLoginPurpose
    ? `Use the following one-time password (OTP) to sign in to ${safeAppName}.`
    : `Use the following one-time password (OTP) to verify your ${safeAppName} account.`;

  return {
    subject,
    text: [
      `Hello ${ownerName},`,
      '',
      isLoginPurpose
        ? `Your ${appName || 'TeamChatX'} login verification code is: ${otpCode}`
        : `Your ${appName || 'TeamChatX'} verification code is: ${otpCode}`,
      `This code expires in ${otpExpiresMinutes} minutes.`,
      '',
      'If you did not request this, please ignore this email.',
      `Support: ${supportEmail || 'support@teamchatx.com'}`,
      '',
      `${appName || 'TeamChatX'} Security`,
    ].join('\n'),
    html: `
      <div style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;background:#0f172a;color:#ffffff;">
              <div style="font-size:18px;font-weight:700;letter-spacing:0.3px;">${safeAppName}</div>
              <div style="margin-top:6px;font-size:13px;color:#cbd5e1;">${contextLabel}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;">Hello <strong>${safeOwner}</strong>,</p>
              <p style="margin:0 0 16px 0;font-size:14px;line-height:1.7;color:#334155;">
                ${instructionText}
              </p>
              <div style="margin:0 0 16px 0;padding:14px 16px;background:#f8fafc;border:1px dashed #94a3b8;border-radius:10px;text-align:center;">
                <div style="font-size:12px;color:#64748b;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:6px;">Verification Code</div>
                <div style="font-size:34px;line-height:1;font-weight:700;letter-spacing:7px;color:#0f172a;font-family:'Courier New',monospace;">${safeOtp}</div>
              </div>
          
              <p style="margin:0 0 14px 0;font-size:13px;color:#475569;">
                This code will expire in <strong>${safeMinutes} minutes</strong>.
              </p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
                If you did not request this verification, you can safely ignore this email.
              </p>
              <p style="margin:10px 0 0 0;font-size:12px;color:#64748b;">
                Need help? Contact <a href="mailto:${safeSupport}" style="color:#1d4ed8;text-decoration:none;">${safeSupport}</a>
              </p>
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
  getVerificationOtpMailTemplate,
};

