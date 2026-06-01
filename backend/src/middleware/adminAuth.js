const jwt = require('jsonwebtoken');

const ADMIN_PURPOSE = 'admin';
const ROLE_SUPERADMIN = 'superadmin';
const ROLE_ADMIN = 'admin';

function adminAuthMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Admin login required' });
  }
  try {
    const token = header.replace('Bearer ', '');
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'ema-dev-secret');
    if (payload.purpose !== ADMIN_PURPOSE) {
      return res.status(401).json({ message: 'Invalid admin session' });
    }
    req.adminUser = payload.sub || 'admin';
    req.adminRole =
      payload.role === ROLE_SUPERADMIN ? ROLE_SUPERADMIN : ROLE_ADMIN;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired admin session' });
  }
}

function requireSuperAdmin(req, res, next) {
  if (req.adminRole !== ROLE_SUPERADMIN) {
    return res.status(403).json({ message: 'Superadmin required for this action' });
  }
  return next();
}

module.exports = {
  adminAuthMiddleware,
  requireSuperAdmin,
  ADMIN_PURPOSE,
  ROLE_SUPERADMIN,
  ROLE_ADMIN,
};
