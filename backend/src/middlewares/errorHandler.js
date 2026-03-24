const { failure } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  if (process.env.NODE_ENV !== 'test') {
    console.error('Request failed', err);
  }

  return failure(res, message, status, err.details);
};

module.exports = errorHandler;
