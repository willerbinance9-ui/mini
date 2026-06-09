const crypto = require('crypto');
const { getPartnerByApiKeyPrefix, touchPartnerApiKeyLastUsed } = require('../db');

function hashPartnerApiKey(rawKey) {
  return crypto.createHash('sha256').update(String(rawKey)).digest('hex');
}

function extractPartnerApiKey(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token.startsWith('ema_pk_')) return token;
  }
  const direct = req.headers['x-partner-api-key'];
  if (direct && String(direct).startsWith('ema_pk_')) return String(direct).trim();
  return null;
}

async function partnerAuthMiddleware(req, res, next) {
  const rawKey = extractPartnerApiKey(req);
  if (!rawKey) {
    return res.status(401).json({ message: 'Missing partner API key' });
  }

  const prefix = rawKey.slice(0, 16);
  try {
    const row = await getPartnerByApiKeyPrefix(prefix);
    if (!row || row.revoked_at) {
      return res.status(401).json({ message: 'Invalid partner API key' });
    }
    const expected = hashPartnerApiKey(rawKey);
    const got = Buffer.from(expected, 'hex');
    const stored = Buffer.from(String(row.key_hash || ''), 'hex');
    if (got.length !== stored.length || !crypto.timingSafeEqual(got, stored)) {
      return res.status(401).json({ message: 'Invalid partner API key' });
    }
    if (row.partner_status !== 'active') {
      return res.status(403).json({ message: 'Partner account suspended' });
    }

    req.partnerId = row.partner_id;
    req.partnerApiKeyId = row.id;
    req.partnerScopes = row.scopes || [];
    touchPartnerApiKeyLastUsed(row.id).catch(() => {});
    return next();
  } catch (e) {
    return res.status(500).json({ message: e?.message || 'Partner auth failed' });
  }
}

function requirePartnerScope(scope) {
  return (req, res, next) => {
    const scopes = req.partnerScopes || [];
    if (!scopes.includes(scope) && !scopes.includes('*')) {
      return res.status(403).json({ message: `Missing scope: ${scope}` });
    }
    return next();
  };
}

module.exports = { partnerAuthMiddleware, requirePartnerScope, hashPartnerApiKey, extractPartnerApiKey };
