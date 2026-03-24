const requireOwner = (req, res, next) => {
  const user = req.user;
  if (!user) {
    const err = new Error('Unauthorized');
    err.status = 401;
    return next(err);
  }

  const isOwnerRoleId = Number(user.role_id) === 1;
  if (!isOwnerRoleId) {
    const err = new Error('Access denied');
    err.status = 403;
    return next(err);
  }

  return next();
};

module.exports = requireOwner;
