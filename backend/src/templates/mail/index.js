const { getVerificationOtpMailTemplate } = require('./auth/verificationOtpTemplate');
const { getForgotPasswordOtpMailTemplate } = require('./auth/forgotPasswordOtpTemplate');
const { getPasswordResetSuccessMailTemplate } = require('./auth/passwordResetSuccessTemplate');
const { getWelcomeMailTemplate } = require('./auth/welcomeTemplate');
const { getOrgUserAccountCreatedMailTemplate } = require('./orgUser/accountCreatedTemplate');
const { getOrgUserPasswordResetMailTemplate } = require('./orgUser/passwordResetTemplate');
const { getContactUsAdminNotificationTemplate } = require('./contactUs/adminNotificationTemplate');
const {
  getContactUsCustomerAcknowledgementTemplate,
} = require('./contactUs/customerAcknowledgementTemplate');
const { getBillingPaymentSuccessTemplate } = require('./billing/paymentSuccessTemplate');

module.exports = {
  getVerificationOtpMailTemplate,
  getForgotPasswordOtpMailTemplate,
  getPasswordResetSuccessMailTemplate,
  getWelcomeMailTemplate,
  getOrgUserAccountCreatedMailTemplate,
  getOrgUserPasswordResetMailTemplate,
  getContactUsAdminNotificationTemplate,
  getContactUsCustomerAcknowledgementTemplate,
  getBillingPaymentSuccessTemplate,
};

