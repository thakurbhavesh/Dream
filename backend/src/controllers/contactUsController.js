const contactUsModel = require('../models/contactUsModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');
const { sendMailAsync } = require('../utils/mail');
const { resolveMailBranding } = require('../utils/mailBranding');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');
const {
  getContactUsAdminNotificationTemplate,
  getContactUsCustomerAcknowledgementTemplate,
} = require('../templates/mail');

const parsePositiveId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('Valid id is required');
    err.status = 400;
    throw err;
  }
  return id;
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const runInBackground = (promise, context) => {
  if (!promise || typeof promise.then !== 'function') return;
  promise.catch((error) => {
    console.error(`Background task failed: ${context}`, {
      message: error.message,
    });
  });
};

const resolveNotifyRecipients = async (brandingOverride = null) => {
  const branding = brandingOverride || (await resolveMailBranding());
  const parsed = Array.isArray(branding.notifyRecipients)
    ? branding.notifyRecipients.filter((email) => isValidEmail(email))
    : [];
  return parsed.length ? parsed : [branding.supportEmail];
};

const dispatchAdminNotificationMail = async (payload) => {
  const branding = await resolveMailBranding();
  const recipients = await resolveNotifyRecipients(branding);
  if (!recipients.length) return;
  const template = getContactUsAdminNotificationTemplate(payload, {
    appName: branding.appName,
  });
  sendMailAsync({
    to: recipients.join(','),
    subject: template.subject,
    text: template.text,
    html: template.html,
    replyTo: payload.email_address,
  }, {
    onError: (error) => {
      console.error('ContactUs admin mail failed', {
        contact_request_id: payload.contact_request_id,
        to: recipients,
        message: error.message,
      });
    },
  });
};

const dispatchCustomerAcknowledgementMail = async (payload) => {
  const customerEmail = String(payload.email_address || '').trim().toLowerCase();
  if (!customerEmail) return;
  if (!isValidEmail(customerEmail)) return;

  const branding = await resolveMailBranding();
  const notifyRecipients = await resolveNotifyRecipients(branding);
  const primaryReplyTo = notifyRecipients[0] || branding.supportEmail;
  const template = getContactUsCustomerAcknowledgementTemplate(payload, {
    appName: branding.appName,
    supportEmail: branding.supportEmail,
  });
  sendMailAsync({
    to: customerEmail,
    subject: template.subject,
    text: template.text,
    html: template.html,
    replyTo: primaryReplyTo,
  }, {
    onError: (error) => {
      console.error('ContactUs customer mail failed', {
        contact_request_id: payload.contact_request_id,
        to: customerEmail,
        message: error.message,
      });
    },
  });
};

const createContactRequest = async (req, res, next) => {
  try {
    const created = await contactUsModel.createContactRequest(req.body);
    if (req.user?.sub) {
      const requestMeta = buildRequestMeta(req);
      const actor = buildActorFromRequest(req);
      await logActivitySafe({
        ...actor,
        ...requestMeta,
        context_organization_id: req.user?.org || null,
        target_type: 'contact_us_request',
        target_id: created.contact_request_id,
        action: 'contact_us_request.create',
        action_category: 'public_inbox',
        action_subtype: 'contact_form_submit',
        description: `Contact request ${created.contact_request_id} submitted`,
        new_values: created,
        is_successful: true,
        status: 'success',
      });
    }
    runInBackground(dispatchAdminNotificationMail(created), 'contact_us.admin_mail');
    runInBackground(dispatchCustomerAcknowledgementMail(created), 'contact_us.customer_mail');
    return success(res, created, 'Contact request submitted', 201);
  } catch (error) {
    return next(error);
  }
};

const getContactRequests = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const search = parseSearch(req.query);
    const status = req.query.status ? String(req.query.status).toLowerCase() : undefined;

    if (status && !['new', 'reviewed', 'closed'].includes(status)) {
      const err = new Error('status must be one of new, reviewed, closed');
      err.status = 400;
      throw err;
    }

    const data = await contactUsModel.findAll({
      search,
      status,
      limit,
      offset,
    });

    return success(res, { count: data.total, rows: data.rows }, 'Contact requests retrieved');
  } catch (error) {
    return next(error);
  }
};

const getContactRequestById = async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    const found = await contactUsModel.findById(id);
    if (!found) {
      const err = new Error('Contact request not found');
      err.status = 404;
      throw err;
    }
    return success(res, found, 'Contact request retrieved');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createContactRequest,
  getContactRequests,
  getContactRequestById,
};

