const jwt = require('jsonwebtoken');
const { getUserById, userIsBanned } = require('../db');

const TOTP_PENDING_PURPOSE = 'totp_pending';

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing token' });
  }

  try {
    const token = header.replace('Bearer ', '');
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'ema-dev-secret');
    if (payload.purpose === TOTP_PENDING_PURPOSE) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    req.userId = payload.sub;
    const user = await getUserById(req.userId);
    if (!user) return res.status(401).json({ message: 'Invalid token' });
    if (userIsBanned(user)) {
      return res.status(403).json({
        message: user.ban_reason || 'This account has been suspended.',
        code: 'ACCOUNT_BANNED',
        accountStatus: 'banned',
      });
    }
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function totpPendingMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing token' });
  }

  try {
    const token = header.replace('Bearer ', '');
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'ema-dev-secret');
    if (payload.purpose !== TOTP_PENDING_PURPOSE) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

module.exports = { authMiddleware, totpPendingMiddleware, TOTP_PENDING_PURPOSE };
