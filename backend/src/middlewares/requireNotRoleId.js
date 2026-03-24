const requireNotRoleId = (blockedRoleId) => (req, res, next) => {
  const user = req.user;
  if (!user) {
    const err = new Error('Unauthorized');
    err.status = 401;
    return next(err);
  }

  if (Number(user.role_id) === Number(blockedRoleId)) {
    const err = new Error('Access denied');
    err.status = 403;
    return next(err);
  }

  return next();
};

module.exports = requireNotRoleId;
