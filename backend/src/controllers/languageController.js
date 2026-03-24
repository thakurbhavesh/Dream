const languageModel = require('../models/languageModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');
const { withEntityCache, bumpEntityVersion } = require('../utils/cache');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');

const ENTITY = 'languages';

const createLanguage = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const language = await languageModel.createLanguage(req.body);
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'language',
      target_id: language.language_id,
      action: 'language.create',
      action_category: 'master_data',
      action_subtype: 'language_create',
      description: `Language ${language.language_code} created`,
      new_values: language,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, language, 'Language created', 201);
  } catch (error) {
    return next(error);
  }
};

const getLanguages = async (req, res, next) => {
  try {
    const data = await withEntityCache(ENTITY, req, async () => {
      const { limit, offset } = parsePagination(req.query);
      const search = parseSearch(req.query);
      const { rows, total } = await languageModel.findAll({ search, limit, offset });
      return { count: total, rows };
    });
    return success(res, data, 'Languages retrieved');
  } catch (error) {
    return next(error);
  }
};

const getLanguage = async (req, res, next) => {
  try {
    const language = await withEntityCache(ENTITY, req, async () => {
      const found = await languageModel.findById(req.params.id);
      if (!found) {
        const err = new Error('Language not found');
        err.status = 404;
        throw err;
      }
      return found;
    });

    return success(res, language, 'Language retrieved');
  } catch (error) {
    return next(error);
  }
};

const updateLanguage = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldLanguage = await languageModel.findById(req.params.id);
    const language = await languageModel.updateLanguagePartial(req.params.id, req.body);
    if (!language) {
      const err = new Error('Language not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'language',
      target_id: language.language_id,
      action: 'language.update',
      action_category: 'master_data',
      action_subtype: 'language_update',
      description: `Language ${language.language_code} updated`,
      old_values: oldLanguage,
      new_values: language,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, language, 'Language updated');
  } catch (error) {
    return next(error);
  }
};

const patchLanguage = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldLanguage = await languageModel.findById(req.params.id);
    const language = await languageModel.updateLanguagePartial(req.params.id, req.body);
    if (!language) {
      const err = new Error('Language not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'language',
      target_id: language.language_id,
      action: 'language.patch',
      action_category: 'master_data',
      action_subtype: 'language_patch',
      description: `Language ${language.language_code} patched`,
      old_values: oldLanguage,
      new_values: language,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, language, 'Language updated');
  } catch (error) {
    return next(error);
  }
};

const deleteLanguage = async (req, res, next) => {
  try {
    const deleted = await languageModel.deleteLanguage(req.params.id);
    if (!deleted) {
      const err = new Error('Language not found');
      err.status = 404;
      throw err;
    }
    bumpEntityVersion(ENTITY);
    return success(res, null, 'Language deleted');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createLanguage,
  getLanguages,
  getLanguage,
  updateLanguage,
  patchLanguage,
  deleteLanguage,
};
