const { success } = require('../utils/response');
const model = require('../models/aiProviderModel');

// GET /ai-providers — list all providers
const listProviders = async (req, res, next) => {
  try {
    const providers = await model.getAllProviders();
    return success(res, { providers }, 'AI providers retrieved');
  } catch (err) {
    return next(err);
  }
};

// PATCH /ai-providers/:id — update provider (api_key, model, is_active)
const updateProvider = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) { const e = new Error('Invalid provider ID'); e.status = 400; throw e; }

    const { api_key, model: modelName, is_active } = req.body;
    const updated = await model.updateProvider(id, { api_key, model: modelName, is_active });

    if (!updated) { const e = new Error('Provider not found'); e.status = 404; throw e; }

    return success(res, { provider: updated }, 'Provider updated');
  } catch (err) {
    return next(err);
  }
};

// GET /ai-providers/active — get the currently active provider (for frontend display)
const getActive = async (req, res, next) => {
  try {
    const provider = await model.getActiveProvider();
    if (!provider) {
      return success(res, { provider: null }, 'No active provider');
    }
    return success(res, {
      provider: {
        provider_id: provider.provider_id,
        provider_key: provider.provider_key,
        display_name: provider.display_name,
        model: provider.model,
        is_active: provider.is_active,
        status: provider.status,
      }
    }, 'Active provider');
  } catch (err) {
    return next(err);
  }
};

module.exports = { listProviders, updateProvider, getActive };
