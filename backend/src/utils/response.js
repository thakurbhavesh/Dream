const success = (res, data, message = 'Success', status = 200) => {
  return res.status(status).json({
    status: 'success',
    message,
    data,
  });
};

const failure = (res, message = 'Something went wrong', status = 500, errors) => {
  return res.status(status).json({
    status: 'error',
    message,
    errors,
  });
};

module.exports = {
  success,
  failure,
};
