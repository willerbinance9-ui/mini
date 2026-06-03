const crypto = require('crypto');
const express = require('express');
const {
  getMt5AccountByEaWebhookToken,
  getMt5AccountByLoginAndServer,
  insertMt5EaTelemetry,
  listPendingMt5EaCommands,
  ackMt5EaCommand,
  upsertMarketPricesBatch,
  isMissingTableError,
} = require('./db');

function parseBearer(req) {
  const h = req.headers.authorization;
  if (!h || typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function hmacSha256HexValid(secret, rawBuf, sigHeader) {
  if (!secret || !rawBuf || !sigHeader) return false;
  const mac = crypto.createHmac('sha256', secret).update(rawBuf).digest('hex');
  const provided = String(sigHeader)
    .replace(/^sha256=/i, '')
    .trim()
    .toLowerCase();
  if (provided.length !== mac.length || provided.length !== 64) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(mac, 'hex'));
  } catch {
    return false;
  }
}

async function resolveEaAccountForPost(req) {
  const bearer = parseBearer(req);
  if (bearer) {
    const row = await getMt5AccountByEaWebhookToken(bearer);
    if (row) return row;
  }
  const secret = process.env.MT5_EA_WEBHOOK_SECRET;
  const sig = req.headers['x-mt5-ea-signature'];
  if (!secret || !sig || !req.rawMt5EaBody) return null;
  if (!hmacSha256HexValid(secret, req.rawMt5EaBody, sig)) return null;
  const login = req.body?.login;
  const server = req.body?.server;
  if (!login || !server) return null;
  return getMt5AccountByLoginAndServer(login, server);
}

function resolvePriceFeedSecret() {
  return String(process.env.MT5_PRICE_FEED_SECRET || process.env.MT5_EA_WEBHOOK_SECRET || '').trim();
}

function authorizePriceFeed(req) {
  const secret = resolvePriceFeedSecret();
  if (!secret) return false;
  const bearer = parseBearer(req);
  if (!bearer) return false;
  if (bearer.length !== secret.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(bearer), Buffer.from(secret));
  } catch {
    return bearer === secret;
  }
}

const priceFeedLastByIp = new Map();

function priceFeedRateOk(req) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const last = priceFeedLastByIp.get(ip) || 0;
  if (now - last < 900) return false;
  priceFeedLastByIp.set(ip, now);
  return true;
}

const { normalizePriceBatch } = require('./services/priceFeedNormalize');

function registerMt5EaWebhookRoutes(app) {
  const router = express.Router();

  router.post(
    '/telemetry',
    express.json({
      limit: '512kb',
      verify: (req, res, buf) => {
        req.rawMt5EaBody = buf;
      },
    }),
    async (req, res) => {
      try {
        const account = await resolveEaAccountForPost(req);
        if (!account) return res.status(401).json({ message: 'Unauthorized' });
        const payload = req.body && typeof req.body === 'object' ? req.body : {};
        await insertMt5EaTelemetry({ mt5AccountId: account.id, payload });
        return res.json({ ok: true });
      } catch (e) {
        if (isMissingTableError(e)) {
          return res.status(503).json({
            message: 'MT5 EA tables missing. Run backend/sql/migrations/20260513_mt5_ea_webhook.sql in Supabase.',
          });
        }
        console.error('mt5-ea telemetry', e);
        return res.status(500).json({ message: e?.message || 'telemetry failed' });
      }
    }
  );

  router.get('/commands', async (req, res) => {
    try {
      const bearer = parseBearer(req);
      if (!bearer) return res.status(401).json({ message: 'Authorization Bearer token required' });
      const account = await getMt5AccountByEaWebhookToken(bearer);
      if (!account) return res.status(401).json({ message: 'Invalid or unset EA token. POST /mt5/accounts/:id/ea-webhook-token from the app.' });
      const rows = await listPendingMt5EaCommands(account.id, 50);
      return res.json({
        commands: rows.map((r) => ({
          id: r.id,
          clientId: r.client_id,
          side: r.side,
          symbol: r.symbol,
          volume: Number(r.volume),
          stopLoss: r.stop_loss != null ? Number(r.stop_loss) : null,
          takeProfit: r.take_profit != null ? Number(r.take_profit) : null,
          magic: r.magic,
          createdAt: r.created_at,
        })),
      });
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.status(503).json({ message: 'MT5 EA tables missing. Run migrations/20260513_mt5_ea_webhook.sql' });
      }
      console.error('mt5-ea commands list', e);
      return res.status(500).json({ message: e?.message || 'list failed' });
    }
  });

  router.post('/commands/:commandId/ack', express.json({ limit: '128kb' }), async (req, res) => {
    try {
      const bearer = parseBearer(req);
      if (!bearer) return res.status(401).json({ message: 'Authorization Bearer token required' });
      const account = await getMt5AccountByEaWebhookToken(bearer);
      if (!account) return res.status(401).json({ message: 'Invalid token' });
      const commandId = req.params.commandId;
      const status = String(req.body?.status || '').toLowerCase();
      if (status !== 'acked' && status !== 'failed') {
        return res.status(400).json({ message: 'body.status must be "acked" or "failed"' });
      }
      const updated = await ackMt5EaCommand(account.id, commandId, {
        status,
        ackTicket: req.body?.ticket != null ? Number(req.body.ticket) : null,
        ackError: req.body?.error != null ? String(req.body.error) : null,
        ackMeta: req.body?.meta && typeof req.body.meta === 'object' ? req.body.meta : null,
      });
      if (!updated) return res.status(404).json({ message: 'Command not found or not pending' });
      return res.json({ ok: true });
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.status(503).json({ message: 'MT5 EA tables missing. Run migrations/20260513_mt5_ea_webhook.sql' });
      }
      console.error('mt5-ea ack', e);
      return res.status(500).json({ message: e?.message || 'ack failed' });
    }
  });

  router.post('/prices', express.json({ limit: '512kb' }), async (req, res) => {
    try {
      if (!authorizePriceFeed(req)) {
        return res.status(401).json({ message: 'Unauthorized price feed' });
      }
      if (!priceFeedRateOk(req)) {
        return res.status(429).json({ message: 'Rate limit: wait before next price batch' });
      }
      const rows = normalizePriceBatch(req.body);
      if (!rows.length) {
        return res.status(400).json({ message: 'Provide prices: [{ symbol, bid, ask, digits? }]' });
      }
      await upsertMarketPricesBatch(rows);
      return res.json({ ok: true, count: rows.length });
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.status(503).json({
          message: 'market_prices table missing. Run migrations/20260614_live_trading_accounts.sql',
        });
      }
      console.error('mt5-ea prices', e);
      return res.status(500).json({ message: e?.message || 'price upsert failed' });
    }
  });

  app.use('/webhooks/mt5-ea', router);
}

module.exports = { registerMt5EaWebhookRoutes, authorizePriceFeed };
