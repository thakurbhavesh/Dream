const geoModel = require('../models/geoModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getCountries = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const search = parseSearch(req.query);
    const data = await geoModel.findCountries({
      search,
      limit: Math.min(Math.max(toNumber(limit, 300), 1), 500),
      offset,
    });
    return success(res, { count: data.total, rows: data.rows }, 'Countries retrieved');
  } catch (error) {
    return next(error);
  }
};

const getStates = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const search = parseSearch(req.query);
    const country_id = req.query.country_id ? toNumber(req.query.country_id, 0) : undefined;
    const country_iso = req.query.country_iso
      ? String(req.query.country_iso).trim().toUpperCase()
      : undefined;
    const data = await geoModel.findStates({
      country_id: country_id > 0 ? country_id : undefined,
      country_iso,
      search,
      limit: Math.min(Math.max(toNumber(limit, 1000), 1), 3000),
      offset,
    });
    return success(res, { count: data.total, rows: data.rows }, 'States retrieved');
  } catch (error) {
    return next(error);
  }
};

const getCurrencies = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const search = parseSearch(req.query);
    const status = req.query.status ? String(req.query.status).trim().toLowerCase() : undefined;
    const data = await geoModel.findCurrencies({
      search,
      status,
      limit: Math.min(Math.max(toNumber(limit, 200), 1), 500),
      offset,
    });
    return success(res, { count: data.total, rows: data.rows }, 'Currencies retrieved');
  } catch (error) {
    return next(error);
  }
};

const getTopCountryCurrencies = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const search = parseSearch(req.query);
    const data = await geoModel.findTopCountryCurrencies({
      search,
      limit: Math.min(Math.max(toNumber(limit, 50), 1), 50),
      offset,
    });
    return success(res, { count: data.total, rows: data.rows }, 'Top country currencies retrieved');
  } catch (error) {
    return next(error);
  }
};

const createCountry = async (req, res, next) => {
  try {
    const iso_code = String(req.body?.iso_code || '').trim().toUpperCase();
    const name = String(req.body?.name || '').trim();
    if (!iso_code || !name) {
      const err = new Error('iso_code and name are required');
      err.status = 400;
      throw err;
    }
    const country = await geoModel.createCountry({
      iso_code,
      name,
      phonecode: req.body?.phonecode ? String(req.body.phonecode).trim() : null,
      currency_code: req.body?.currency_code ? String(req.body.currency_code).trim().toUpperCase() : null,
      currency_name: req.body?.currency_name ? String(req.body.currency_name).trim() : null,
      status: req.body?.status ? String(req.body.status).trim().toLowerCase() : 'active',
    });
    return success(res, country, 'Country created', 201);
  } catch (error) {
    return next(error);
  }
};

const patchCountry = async (req, res, next) => {
  try {
    const countryId = toNumber(req.params.id, 0);
    if (!countryId) {
      const err = new Error('Invalid country id');
      err.status = 400;
      throw err;
    }

    const patch = {};
    if (req.body?.iso_code !== undefined) patch.iso_code = String(req.body.iso_code || '').trim().toUpperCase();
    if (req.body?.name !== undefined) patch.name = String(req.body.name || '').trim();
    if (req.body?.phonecode !== undefined) patch.phonecode = req.body.phonecode ? String(req.body.phonecode).trim() : null;
    if (req.body?.currency_code !== undefined) patch.currency_code = req.body.currency_code ? String(req.body.currency_code).trim().toUpperCase() : null;
    if (req.body?.currency_name !== undefined) patch.currency_name = req.body.currency_name ? String(req.body.currency_name).trim() : null;
    if (req.body?.status !== undefined) patch.status = String(req.body.status || '').trim().toLowerCase();

    const updated = await geoModel.updateCountryPartial(countryId, patch);
    if (!updated) {
      const exists = await geoModel.findCountryById(countryId);
      if (!exists) {
        const err = new Error('Country not found');
        err.status = 404;
        throw err;
      }
      const err = new Error('No fields to update');
      err.status = 400;
      throw err;
    }
    return success(res, updated, 'Country updated');
  } catch (error) {
    return next(error);
  }
};

const createState = async (req, res, next) => {
  try {
    const country_id = toNumber(req.body?.country_id, 0);
    const name = String(req.body?.name || '').trim();
    if (!country_id || !name) {
      const err = new Error('country_id and name are required');
      err.status = 400;
      throw err;
    }

    const state = await geoModel.createState({
      country_id,
      iso_code: req.body?.iso_code ? String(req.body.iso_code).trim().toUpperCase() : null,
      name,
      status: req.body?.status ? String(req.body.status).trim().toLowerCase() : 'active',
    });
    return success(res, state, 'State created', 201);
  } catch (error) {
    return next(error);
  }
};

const patchState = async (req, res, next) => {
  try {
    const stateId = toNumber(req.params.id, 0);
    if (!stateId) {
      const err = new Error('Invalid state id');
      err.status = 400;
      throw err;
    }

    const patch = {};
    if (req.body?.country_id !== undefined) patch.country_id = toNumber(req.body.country_id, 0);
    if (req.body?.iso_code !== undefined) patch.iso_code = req.body.iso_code ? String(req.body.iso_code).trim().toUpperCase() : null;
    if (req.body?.name !== undefined) patch.name = String(req.body.name || '').trim();
    if (req.body?.status !== undefined) patch.status = String(req.body.status || '').trim().toLowerCase();

    const updated = await geoModel.updateStatePartial(stateId, patch);
    if (!updated) {
      const exists = await geoModel.findStateById(stateId);
      if (!exists) {
        const err = new Error('State not found');
        err.status = 404;
        throw err;
      }
      const err = new Error('No fields to update');
      err.status = 400;
      throw err;
    }
    return success(res, updated, 'State updated');
  } catch (error) {
    return next(error);
  }
};

const createCurrency = async (req, res, next) => {
  try {
    const currency_code = String(req.body?.currency_code || '').trim().toUpperCase();
    const currency_name = String(req.body?.currency_name || '').trim();
    if (!currency_code || !currency_name) {
      const err = new Error('currency_code and currency_name are required');
      err.status = 400;
      throw err;
    }

    const currency = await geoModel.createCurrency({
      currency_code,
      currency_name,
      currency_symbol: req.body?.currency_symbol ? String(req.body.currency_symbol).trim() : null,
      decimal_places: req.body?.decimal_places !== undefined ? toNumber(req.body.decimal_places, 2) : 2,
      status: req.body?.status ? String(req.body.status).trim().toLowerCase() : 'active',
    });
    return success(res, currency, 'Currency created', 201);
  } catch (error) {
    return next(error);
  }
};

const patchCurrency = async (req, res, next) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    if (!code) {
      const err = new Error('Invalid currency code');
      err.status = 400;
      throw err;
    }

    const patch = {};
    if (req.body?.currency_name !== undefined) patch.currency_name = String(req.body.currency_name || '').trim();
    if (req.body?.currency_symbol !== undefined) patch.currency_symbol = req.body.currency_symbol ? String(req.body.currency_symbol).trim() : null;
    if (req.body?.decimal_places !== undefined) patch.decimal_places = toNumber(req.body.decimal_places, 2);
    if (req.body?.status !== undefined) patch.status = String(req.body.status || '').trim().toLowerCase();

    const updated = await geoModel.updateCurrencyPartial(code, patch);
    if (!updated) {
      const exists = await geoModel.findCurrencyByCode(code);
      if (!exists) {
        const err = new Error('Currency not found');
        err.status = 404;
        throw err;
      }
      const err = new Error('No fields to update');
      err.status = 400;
      throw err;
    }
    return success(res, updated, 'Currency updated');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getCountries,
  getStates,
  getCurrencies,
  getTopCountryCurrencies,
  createCountry,
  patchCountry,
  createState,
  patchState,
  createCurrency,
  patchCurrency,
};
