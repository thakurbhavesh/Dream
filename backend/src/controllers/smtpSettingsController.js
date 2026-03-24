const smtpSettingsModel = require('../models/smtpSettingsModel');
const { invalidateTransporterCache } = require('../utils/mail');
const { success } = require('../utils/response');

const parseId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('Valid smtp_settings_id is required');
    err.status = 400;
    throw err;
  }
  return id;
};

const validatePort = (port) => {
  const p = Number(port);
  if (!Number.isInteger(p) || p < 1 || p > 65535) {
    const err = new Error('port must be a valid port number (1–65535)');
    err.status = 400;
    throw err;
  }
  return p;
};

const getAllSmtpSettings = async (req, res, next) => {
  try {
    const rows = await smtpSettingsModel.findAll();
    return success(res, rows, 'SMTP settings retrieved');
  } catch (error) {
    return next(error);
  }
};

const createSmtpSettings = async (req, res, next) => {
  try {
    const { label, host, port, secure, smtp_user, smtp_pass, from_address, contact_notify_to } = req.body;

    if (!host || !String(host).trim()) {
      const err = new Error('host is required'); err.status = 400; throw err;
    }
    if (!smtp_user || !String(smtp_user).trim()) {
      const err = new Error('smtp_user is required'); err.status = 400; throw err;
    }

    const payload = {
      label: String(label || 'Default').trim(),
      host: String(host).trim(),
      port: port !== undefined ? validatePort(port) : 587,
      secure: secure === true || String(secure) === 'true',
      smtp_user: String(smtp_user).trim(),
      smtp_pass: smtp_pass ? String(smtp_pass) : '',
      from_address: from_address ? String(from_address).trim() : '',
      contact_notify_to: contact_notify_to ? String(contact_notify_to).trim() : '',
    };

    const created = await smtpSettingsModel.create(payload);
    return success(res, created, 'SMTP settings created', 201);
  } catch (error) {
    return next(error);
  }
};

const updateSmtpSettings = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const payload = {};
    const allowed = ['label', 'host', 'port', 'secure', 'smtp_user', 'smtp_pass', 'from_address', 'contact_notify_to', 'status'];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        payload[key] = req.body[key];
      }
    }

    // Keep existing password if client sends back the mask
    if (payload.smtp_pass === '********') delete payload.smtp_pass;

    if (payload.port !== undefined) payload.port = validatePort(payload.port);
    if (payload.secure !== undefined) payload.secure = payload.secure === true || String(payload.secure) === 'true';
    if (payload.label !== undefined) payload.label = String(payload.label).trim();
    if (payload.host !== undefined) payload.host = String(payload.host).trim();
    if (payload.smtp_user !== undefined) payload.smtp_user = String(payload.smtp_user).trim();
    if (payload.status !== undefined) {
      const normalizedStatus = String(payload.status || '').trim().toLowerCase();
      if (!['active', 'inactive'].includes(normalizedStatus)) {
        const err = new Error('status must be active or inactive');
        err.status = 400;
        throw err;
      }
      payload.status = normalizedStatus;
    }

    const requestedStatus = payload.status;
    if (requestedStatus === 'active') {
      delete payload.status;
    }

    const updated = await smtpSettingsModel.updateById(id, payload);
    if (!updated) {
      const err = new Error('SMTP config not found'); err.status = 404; throw err;
    }

    if (requestedStatus === 'active') {
      const rows = await smtpSettingsModel.activateById(id);
      if (!rows) {
        const err = new Error('SMTP config not found'); err.status = 404; throw err;
      }
      invalidateTransporterCache();
      const activeRow = rows.find((row) => row.smtp_settings_id === id) || updated;
      return success(res, activeRow, 'SMTP settings updated');
    }

    // Clear cache so next email picks up new settings if this was the active config
    invalidateTransporterCache();

    return success(res, updated, 'SMTP settings updated');
  } catch (error) {
    return next(error);
  }
};

const activateSmtpSettings = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const rows = await smtpSettingsModel.activateById(id);
    if (!rows) {
      const err = new Error('SMTP config not found'); err.status = 404; throw err;
    }

    // Clear cache so next email uses newly activated config
    invalidateTransporterCache();

    return success(res, rows, 'SMTP config activated');
  } catch (error) {
    return next(error);
  }
};

const deleteSmtpSettings = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    await smtpSettingsModel.deleteById(id);
    invalidateTransporterCache();
    return success(res, null, 'SMTP config deleted');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getAllSmtpSettings,
  createSmtpSettings,
  updateSmtpSettings,
  activateSmtpSettings,
  deleteSmtpSettings,
};
