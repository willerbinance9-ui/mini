const jwt = require('jsonwebtoken');
const { getPortalAccountById, touchPortalAccountLastSeen } = require('../db');

const LAST_SEEN_THROTTLE_MS = 60_000;

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

      const lastSeen = account.last_seen_at ? new Date(account.last_seen_at).getTime() : 0;
      if (Date.now() - lastSeen > LAST_SEEN_THROTTLE_MS) {
        void touchPortalAccountLastSeen(account.id).catch(() => {});
      }
      next();
    })
    .catch((e) => res.status(500).json({ message: e?.message || 'Auth failed' }));
}

module.exports = { portalAuthMiddleware, signPortalToken, PORTAL_JWT_PURPOSE };
