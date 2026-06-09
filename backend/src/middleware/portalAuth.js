const jwt = require('jsonwebtoken');
const { getPortalAccountById } = require('../db');

const PORTAL_JWT_PURPOSE = 'partner_portal';

function signPortalToken(account) {
  return jwt.sign(
    { sub: account.id, type: PORTAL_JWT_PURPOSE },
    process.env.JWT_SECRET || 'ema-dev-secret',
    { expiresIn: '30d' }
  );
}

function portalAuthMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return res.status(401).json({ message: 'Portal authentication required' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET || 'ema-dev-secret');
  } catch (_) {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
  if (payload.type !== PORTAL_JWT_PURPOSE || !payload.sub) {
    return res.status(401).json({ message: 'Invalid portal session' });
  }

  getPortalAccountById(payload.sub)
    .then((account) => {
      if (!account) return res.status(401).json({ message: 'Portal account not found' });
      req.portalAccount = account;
      req.portalAccountId = account.id;
      req.partnerId = account.partner_id || null;
      next();
    })
    .catch((e) => res.status(500).json({ message: e?.message || 'Auth failed' }));
}

module.exports = { portalAuthMiddleware, signPortalToken, PORTAL_JWT_PURPOSE };
