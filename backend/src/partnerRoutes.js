const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  isMissingTableError,
  isMissingColumnError,
  getPartnerById,
  getPartnerUserById,
  getPartnerUserByEmail,
  getPartnerUserByExternalRef,
  createPartnerUser,
  getComplianceProfileByUserId,
  upsertComplianceProfile,
  userIsBanned,
  listWhitelistedWalletsByUserId,
  insertWhitelistedWallet,
  deleteWhitelistedWalletForUser,
  getWhitelistedWalletForUser,
  MAX_WHITELISTED_WALLETS_PER_USER,
  getPartnerWebhookConfig,
  updatePartnerWebhookConfig,
  countPartnerUsers,
  getPartnerCommissionStats,
  listPlatformLiveTradingAccountsByUserId,
  ensureLiveTradingWalletRow,
} = require('./db');
const { partnerAuthMiddleware, requirePartnerScope } = require('./middleware/partnerAuth');
const {
  isComplianceProfileComplete,
  toPublicComplianceProfile,
  validateCompliancePayload,
} = require('./complianceProfile');
const {
  buildPartnerWalletSummary,
  createPartnerDeposit,
  getPartnerDeposit,
  listPartnerDeposits,
  createPartnerWithdrawal,
  getPartnerWithdrawal,
  listPartnerWithdrawals,
} = require('./partnerWalletService');
const { buildAirfarmingStatusResponse } = require('./airfarmingRoutes');
const { getVipSummary } = require('./vipFarmerService');
const { buildGhostAccountStatus } = require('./ghostAccountService');
const { computeLiveBalances } = require('./services/mt5BridgeService');
const { PARTNER_COMMISSION_RATE } = require('./platformRevenueService');
const { normalizeCurrency } = require('./currencyNormalize');
const { enforceWalletUniquenessOnAdd } = require('./walletDuplicateService');
const {
  PARTNER_WEBHOOK_EVENTS,
  generateWebhookSecret,
  maskWebhookSecret,
  isValidWebhookUrl,
  sendPartnerWebhookTest,
} = require('./partnerWebhookService');

function normalizePartnerEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function signPartnerUserToken(user) {
  return jwt.sign(
    { sub: user.id, partner_id: user.partner_id || null },
    process.env.JWT_SECRET || 'ema-dev-secret',
    { expiresIn: '7d' }
  );
}

function toPartnerUserPublic(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    externalRef: user.partner_external_ref || null,
    accountStatus: userIsBanned(user) ? 'banned' : user.account_status || 'active',
    createdAt: user.created_at,
  };
}

async function loadPartnerUser(req, res, userId) {
  const user = await getPartnerUserById(req.partnerId, userId);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return null;
  }
  return user;
}

function toWhitelistPublic(row) {
  return {
    id: row.id,
    label: row.label || '',
    currency: row.currency,
    address: row.address,
    createdAt: row.created_at,
  };
}

function handlePartnerRouteError(res, e, schemaMsg, fallback) {
  if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
  if (e?.statusCode) {
    const body = { message: e.message, code: e.code || undefined };
    if (e.details) Object.assign(body, e.details);
    return res.status(e.statusCode).json(body);
  }
  return res.status(500).json({ message: e?.message || fallback });
}

function registerPartnerRoutes(app) {
  const schemaMsg =
    'Partner API schema missing. Run backend/sql/migrations/20260619_partners_api.sql in Supabase.';

  const webhookSchemaMsg =
    'Partner webhooks schema missing. Run backend/sql/migrations/20260621_partner_webhooks.sql in Supabase.';

  app.get('/v1/partner/me', partnerAuthMiddleware, async (req, res) => {
    try {
      const partner = await getPartnerById(req.partnerId);
      if (!partner) return res.status(404).json({ message: 'Partner not found' });
      return res.json({
        id: partner.id,
        name: partner.name,
        slug: partner.slug,
        status: partner.status,
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      return res.status(500).json({ message: e?.message || 'Failed to load partner' });
    }
  });

  app.get(
    '/v1/partner/webhooks',
    partnerAuthMiddleware,
    requirePartnerScope('webhooks'),
    async (req, res) => {
      try {
        const config = await getPartnerWebhookConfig(req.partnerId);
        if (!config) return res.status(404).json({ message: 'Partner not found' });
        return res.json({
          url: config.webhook_url || null,
          enabled: Boolean(config.webhook_enabled),
          events: config.webhook_events || [],
          hasSecret: Boolean(config.webhook_secret),
          secretPreview: maskWebhookSecret(config.webhook_secret),
          supportedEvents: PARTNER_WEBHOOK_EVENTS.filter((e) => e !== 'webhook.test'),
        });
      } catch (e) {
        if (isMissingTableError(e) || isMissingColumnError(e, 'webhook_url')) {
          return res.status(503).json({ message: webhookSchemaMsg });
        }
        return res.status(500).json({ message: e?.message || 'Failed to load webhook config' });
      }
    }
  );

  app.put(
    '/v1/partner/webhooks',
    partnerAuthMiddleware,
    requirePartnerScope('webhooks'),
    async (req, res) => {
      try {
        const existing = await getPartnerWebhookConfig(req.partnerId);
        if (!existing) return res.status(404).json({ message: 'Partner not found' });

        const url = req.body?.url != null ? String(req.body.url).trim() : existing.webhook_url;
        const enabled =
          req.body?.enabled != null ? Boolean(req.body.enabled) : Boolean(existing.webhook_enabled);
        let secret = req.body?.secret != null ? String(req.body.secret).trim() : existing.webhook_secret;
        const rotateSecret = Boolean(req.body?.rotateSecret);
        if (rotateSecret || (enabled && url && !secret)) {
          secret = generateWebhookSecret();
        }

        if (url && !isValidWebhookUrl(url)) {
          return res.status(400).json({
            message: 'Webhook url must be HTTPS (http://localhost allowed in development).',
          });
        }

        let events = existing.webhook_events || ['deposit.credited', 'withdrawal.finished'];
        if (Array.isArray(req.body?.events)) {
          const filtered = req.body.events
            .map((e) => String(e).trim())
            .filter((e) => PARTNER_WEBHOOK_EVENTS.includes(e) && e !== 'webhook.test');
          if (!filtered.length) {
            return res.status(400).json({ message: 'At least one valid event is required' });
          }
          events = filtered;
        }

        if (enabled && !url) {
          return res.status(400).json({ message: 'url is required when webhooks are enabled' });
        }

        const updated = await updatePartnerWebhookConfig(req.partnerId, {
          webhookUrl: url || null,
          webhookSecret: secret || null,
          webhookEnabled: enabled,
          webhookEvents: events,
        });

        const response = {
          url: updated.webhook_url || null,
          enabled: Boolean(updated.webhook_enabled),
          events: updated.webhook_events || [],
          hasSecret: Boolean(updated.webhook_secret),
          secretPreview: maskWebhookSecret(updated.webhook_secret),
        };
        if (rotateSecret || (req.body?.secret == null && secret && secret !== existing.webhook_secret)) {
          response.secret = secret;
          response.warning = 'Store webhook secret securely; it is shown only when created or rotated.';
        }
        return res.json(response);
      } catch (e) {
        if (isMissingTableError(e) || isMissingColumnError(e, 'webhook_url')) {
          return res.status(503).json({ message: webhookSchemaMsg });
        }
        return res.status(500).json({ message: e?.message || 'Failed to update webhook config' });
      }
    }
  );

  app.post(
    '/v1/partner/webhooks/test',
    partnerAuthMiddleware,
    requirePartnerScope('webhooks'),
    async (req, res) => {
      try {
        const config = await getPartnerWebhookConfig(req.partnerId);
        if (!config?.webhook_url) {
          return res.status(400).json({ message: 'Configure webhook url before testing' });
        }
        const result = await sendPartnerWebhookTest(req.partnerId);
        return res.json(result);
      } catch (e) {
        if (isMissingTableError(e) || isMissingColumnError(e, 'webhook_url')) {
          return res.status(503).json({ message: webhookSchemaMsg });
        }
        return res.status(500).json({ message: e?.message || 'Webhook test failed' });
      }
    }
  );

  app.post(
    '/v1/partner/users',
    partnerAuthMiddleware,
    requirePartnerScope('users'),
    async (req, res) => {
      try {
        const email = normalizePartnerEmail(req.body?.email);
        const password = String(req.body?.password || '');
        const externalRef = req.body?.externalRef != null ? String(req.body.externalRef).trim() : null;

        if (!email || !email.includes('@')) {
          return res.status(400).json({ message: 'Valid email is required' });
        }
        if (!password || password.length < 6) {
          return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        if (externalRef) {
          const byRef = await getPartnerUserByExternalRef(req.partnerId, externalRef);
          if (byRef) return res.status(400).json({ message: 'externalRef already in use' });
        }

        const existing = await getPartnerUserByEmail(req.partnerId, email);
        if (existing) return res.status(400).json({ message: 'Email already in use' });

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await createPartnerUser({
          partnerId: req.partnerId,
          email,
          passwordHash,
          externalRef: externalRef || null,
        });
        return res.status(201).json({ user: toPartnerUserPublic(user) });
      } catch (e) {
        if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
        if (e?.code === '23505') return res.status(400).json({ message: 'User already exists' });
        return res.status(500).json({ message: e?.message || 'Failed to create user' });
      }
    }
  );

  app.get(
    '/v1/partner/users/:id',
    partnerAuthMiddleware,
    requirePartnerScope('users'),
    async (req, res) => {
      try {
        const user = await loadPartnerUser(req, res, req.params.id);
        if (!user) return;
        return res.json({ user: toPartnerUserPublic(user) });
      } catch (e) {
        if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
        return res.status(500).json({ message: e?.message || 'Failed to load user' });
      }
    }
  );

  app.get(
    '/v1/partner/users',
    partnerAuthMiddleware,
    requirePartnerScope('users'),
    async (req, res) => {
      try {
        const externalRef = req.query?.external_ref != null ? String(req.query.external_ref).trim() : '';
        if (!externalRef) {
          return res.status(400).json({ message: 'external_ref query parameter is required' });
        }
        const user = await getPartnerUserByExternalRef(req.partnerId, externalRef);
        if (!user) return res.status(404).json({ message: 'User not found' });
        return res.json({ user: toPartnerUserPublic(user) });
      } catch (e) {
        if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
        return res.status(500).json({ message: e?.message || 'Failed to load user' });
      }
    }
  );

  app.post(
    '/v1/partner/users/:id/session',
    partnerAuthMiddleware,
    requirePartnerScope('users'),
    async (req, res) => {
      try {
        const user = await loadPartnerUser(req, res, req.params.id);
        if (!user) return;
        if (userIsBanned(user)) {
          return res.status(403).json({
            message: user.ban_reason || 'This account has been suspended.',
            code: 'ACCOUNT_BANNED',
          });
        }
        return res.json({
          token: signPartnerUserToken(user),
          user: toPartnerUserPublic(user),
        });
      } catch (e) {
        if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
        return res.status(500).json({ message: e?.message || 'Failed to create session' });
      }
    }
  );

  app.get(
    '/v1/partner/users/:id/compliance',
    partnerAuthMiddleware,
    requirePartnerScope('compliance'),
    async (req, res) => {
      try {
        const user = await loadPartnerUser(req, res, req.params.id);
        if (!user) return;
        const row = await getComplianceProfileByUserId(user.id);
        const profile = toPublicComplianceProfile(row);
        return res.json({
          userId: user.id,
          profile,
          complete: isComplianceProfileComplete(row),
        });
      } catch (e) {
        if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
        return res.status(500).json({ message: e?.message || 'Failed to load compliance' });
      }
    }
  );

  app.put(
    '/v1/partner/users/:id/compliance',
    partnerAuthMiddleware,
    requirePartnerScope('compliance'),
    async (req, res) => {
      try {
        const user = await loadPartnerUser(req, res, req.params.id);
        if (!user) return;
        const validation = validateCompliancePayload(req.body || {});
        if (!validation.ok) {
          return res.status(400).json({ message: 'Validation failed', errors: validation.errors });
        }
        const row = await upsertComplianceProfile(user.id, validation.normalized);
        const profile = toPublicComplianceProfile(row);
        return res.json({
          userId: user.id,
          profile,
          complete: isComplianceProfileComplete(row),
        });
      } catch (e) {
        return handlePartnerRouteError(res, e, schemaMsg, 'Failed to save compliance');
      }
    }
  );

  app.get(
    '/v1/partner/users/:id/wallet',
    partnerAuthMiddleware,
    requirePartnerScope('wallet'),
    async (req, res) => {
      try {
        const user = await loadPartnerUser(req, res, req.params.id);
        if (!user) return;
        const summary = await buildPartnerWalletSummary(user.id);
        return res.json({ userId: user.id, ...summary });
      } catch (e) {
        return handlePartnerRouteError(res, e, schemaMsg, 'Failed to load wallet');
      }
    }
  );

  app.get(
    '/v1/partner/users/:id/deposits',
    partnerAuthMiddleware,
    requirePartnerScope('deposits'),
    async (req, res) => {
      try {
        const user = await loadPartnerUser(req, res, req.params.id);
        if (!user) return;
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
        const deposits = await listPartnerDeposits(user.id, limit);
        return res.json({ userId: user.id, deposits });
      } catch (e) {
        return handlePartnerRouteError(res, e, schemaMsg, 'Failed to list deposits');
      }
    }
  );

  app.post(
    '/v1/partner/users/:id/deposits',
    partnerAuthMiddleware,
    requirePartnerScope('deposits'),
    async (req, res) => {
      try {
        const user = await loadPartnerUser(req, res, req.params.id);
        if (!user) return;
        const result = await createPartnerDeposit(user.id, {
          priceAmount: req.body?.priceAmount,
          priceCurrency: req.body?.priceCurrency,
          payCurrency: req.body?.payCurrency,
        });
        return res.status(201).json({ userId: user.id, ...result });
      } catch (e) {
        return handlePartnerRouteError(res, e, schemaMsg, 'Failed to create deposit');
      }
    }
  );

  app.get(
    '/v1/partner/users/:id/deposits/:depositId',
    partnerAuthMiddleware,
    requirePartnerScope('deposits'),
    async (req, res) => {
      try {
        const user = await loadPartnerUser(req, res, req.params.id);
        if (!user) return;
        const deposit = await getPartnerDeposit(user.id, req.params.depositId);
        if (!deposit) return res.status(404).json({ message: 'Deposit not found' });
        return res.json({ userId: user.id, deposit });
      } catch (e) {
        return handlePartnerRouteError(res, e, schemaMsg, 'Failed to load deposit');
      }
    }
  );

  app.get(
    '/v1/partner/users/:id/withdrawals',
    partnerAuthMiddleware,
    requirePartnerScope('withdrawals'),
    async (req, res) => {
      try {
        const user = await loadPartnerUser(req, res, req.params.id);
        if (!user) return;
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
        const withdrawals = await listPartnerWithdrawals(user.id, limit);
        return res.json({ userId: user.id, withdrawals });
      } catch (e) {
        return handlePartnerRouteError(res, e, schemaMsg, 'Failed to list withdrawals');
      }
    }
  );

  app.post(
    '/v1/partner/users/:id/withdrawals',
    partnerAuthMiddleware,
    requirePartnerScope('withdrawals'),
    async (req, res) => {
      try {
        const user = await loadPartnerUser(req, res, req.params.id);
        if (!user) return;
        const result = await createPartnerWithdrawal(user.id, {
          currency: req.body?.currency,
          address: req.body?.address,
          amount: req.body?.amount,
        });
        return res.status(201).json({ userId: user.id, ...result });
      } catch (e) {
        return handlePartnerRouteError(res, e, schemaMsg, 'Failed to create withdrawal');
      }
    }
  );

  app.get(
    '/v1/partner/users/:id/withdrawals/:withdrawalId',
    partnerAuthMiddleware,
    requirePartnerScope('withdrawals'),
    async (req, res) => {
      try {
        const user = await loadPartnerUser(req, res, req.params.id);
        if (!user) return;
        const withdrawal = await getPartnerWithdrawal(user.id, req.params.withdrawalId);
        if (!withdrawal) return res.status(404).json({ message: 'Withdrawal not found' });
        return res.json({ userId: user.id, withdrawal });
      } catch (e) {
        return handlePartnerRouteError(res, e, schemaMsg, 'Failed to load withdrawal');
      }
    }
  );

  app.get(
    '/v1/partner/users/:id/whitelist-wallets',
    partnerAuthMiddleware,
    requirePartnerScope('wallet'),
    async (req, res) => {
      try {
        const user = await loadPartnerUser(req, res, req.params.id);
        if (!user) return;
        const rows = await listWhitelistedWalletsByUserId(user.id);
        return res.json({
          userId: user.id,
          wallets: rows.map(toWhitelistPublic),
          maxWallets: MAX_WHITELISTED_WALLETS_PER_USER,
        });
      } catch (e) {
        return handlePartnerRouteError(res, e, schemaMsg, 'Failed to list whitelisted wallets');
      }
    }
  );

  app.post(
    '/v1/partner/users/:id/whitelist-wallets',
    partnerAuthMiddleware,
    requirePartnerScope('wallet'),
    async (req, res) => {
      try {
        const user = await loadPartnerUser(req, res, req.params.id);
        if (!user) return;
        const currency = normalizeCurrency(req.body?.currency);
        const address = String(req.body?.address || '').trim();
        const label = req.body?.label != null ? String(req.body.label).trim() : '';
        if (!currency) return res.status(400).json({ message: 'currency is required' });
        if (!address) return res.status(400).json({ message: 'address is required' });

        const row = await insertWhitelistedWallet({
          id: crypto.randomUUID(),
          user_id: user.id,
          label: label || null,
          currency,
          address,
        });
        const dup = await enforceWalletUniquenessOnAdd(user.id, currency, address);
        if (dup.banned) {
          return res.status(403).json({
            message: dup.reason || 'Account suspended: wallet already used on another account.',
            code: 'ACCOUNT_BANNED',
            linkedEmail: dup.linkedEmail || null,
          });
        }
        const rows = await listWhitelistedWalletsByUserId(user.id);
        return res.json({
          userId: user.id,
          wallet: toWhitelistPublic(row),
          wallets: rows.map(toWhitelistPublic),
          maxWallets: MAX_WHITELISTED_WALLETS_PER_USER,
        });
      } catch (e) {
        if (e.code === 'WHITELIST_WALLET_LIMIT') {
          return res.status(400).json({ message: e.message, code: 'WHITELIST_WALLET_LIMIT' });
        }
        if (e.code === 'WHITELIST_WALLET_DUPLICATE') {
          return res.status(400).json({ message: e.message, code: 'WHITELIST_WALLET_DUPLICATE' });
        }
        return handlePartnerRouteError(res, e, schemaMsg, 'Failed to add whitelisted wallet');
      }
    }
  );

  app.delete(
    '/v1/partner/users/:id/whitelist-wallets/:walletId',
    partnerAuthMiddleware,
    requirePartnerScope('wallet'),
    async (req, res) => {
      try {
        const user = await loadPartnerUser(req, res, req.params.id);
        if (!user) return;
        const existing = await getWhitelistedWalletForUser(user.id, req.params.walletId);
        if (!existing) return res.status(404).json({ message: 'Wallet not found' });
        await deleteWhitelistedWalletForUser(user.id, req.params.walletId);
        const rows = await listWhitelistedWalletsByUserId(user.id);
        return res.json({
          userId: user.id,
          success: true,
          wallets: rows.map(toWhitelistPublic),
          maxWallets: MAX_WHITELISTED_WALLETS_PER_USER,
        });
      } catch (e) {
        return handlePartnerRouteError(res, e, schemaMsg, 'Failed to remove whitelisted wallet');
      }
    }
  );

  async function airfarmingStatusHandler(req, res) {
    try {
      const user = await loadPartnerUser(req, res, req.params.id);
      if (!user) return;
      const status = await buildAirfarmingStatusResponse(user.id);
      return res.json({ userId: user.id, ...status });
    } catch (e) {
      return handlePartnerRouteError(res, e, schemaMsg, 'Failed to load airfarming status');
    }
  }

  app.get(
    '/v1/partner/users/:id/airfarming/status',
    partnerAuthMiddleware,
    requirePartnerScope('airfarming'),
    airfarmingStatusHandler
  );

  app.get(
    '/v1/partner/users/:id/airfarming',
    partnerAuthMiddleware,
    requirePartnerScope('airfarming'),
    airfarmingStatusHandler
  );

  app.get(
    '/v1/partner/users/:id/vip',
    partnerAuthMiddleware,
    requirePartnerScope('vip'),
    async (req, res) => {
      try {
        const user = await loadPartnerUser(req, res, req.params.id);
        if (!user) return;
        const summary = await getVipSummary(user.id);
        return res.json({ userId: user.id, ...summary });
      } catch (e) {
        return handlePartnerRouteError(res, e, schemaMsg, 'Failed to load VIP summary');
      }
    }
  );

  app.get('/v1/partner/stats', partnerAuthMiddleware, async (req, res) => {
    try {
      const userCount = await countPartnerUsers(req.partnerId);
      const webhook = await getPartnerWebhookConfig(req.partnerId);
      return res.json({
        partnerId: req.partnerId,
        userCount,
        webhookEnabled: Boolean(webhook?.webhook_enabled),
        commissionRate: PARTNER_COMMISSION_RATE,
      });
    } catch (e) {
      return handlePartnerRouteError(res, e, schemaMsg, 'Failed to load partner stats');
    }
  });

  app.get('/v1/partner/commission', partnerAuthMiddleware, async (req, res) => {
    try {
      const stats = await getPartnerCommissionStats(req.partnerId);
      return res.json({
        partnerId: req.partnerId,
        rate: PARTNER_COMMISSION_RATE,
        ...stats,
      });
    } catch (e) {
      return handlePartnerRouteError(res, e, schemaMsg, 'Failed to load commission stats');
    }
  });

  app.get(
    '/v1/partner/users/:id/live-trading',
    partnerAuthMiddleware,
    requirePartnerScope('wallet'),
    async (req, res) => {
      try {
        const user = await loadPartnerUser(req, res, req.params.id);
        if (!user) return;
        const accounts = await listPlatformLiveTradingAccountsByUserId(user.id);
        const summaries = await Promise.all(
          accounts.map(async (acc) => {
            const wallet = await ensureLiveTradingWalletRow(acc.id);
            const balances = computeLiveBalances(acc, wallet);
            return {
              id: acc.id,
              login: acc.login,
              server: acc.server,
              accountName: acc.account_name || '',
              botType: acc.bot_type || null,
              depositedBalance: balances.depositedBalance,
              openProfit: balances.openProfit,
              displayBalance: balances.displayBalance,
              cachedEquity: acc.cached_equity != null ? Number(acc.cached_equity) : null,
              balanceLastUpdatedAt: acc.balance_last_updated_at || null,
            };
          })
        );
        return res.json({ userId: user.id, accounts: summaries });
      } catch (e) {
        return handlePartnerRouteError(res, e, schemaMsg, 'Failed to load live trading summary');
      }
    }
  );

  app.get(
    '/v1/partner/users/:id/ghost-account',
    partnerAuthMiddleware,
    requirePartnerScope('airfarming'),
    async (req, res) => {
      try {
        const user = await loadPartnerUser(req, res, req.params.id);
        if (!user) return;
        const status = await buildGhostAccountStatus(user.id);
        return res.json({ userId: user.id, ...status });
      } catch (e) {
        return handlePartnerRouteError(res, e, schemaMsg, 'Failed to load ghost account status');
      }
    }
  );
}

function registerPartnerInternalRoutes(app) {
  const { createPartnerWithApiKey } = require('./db');
  const { hashPartnerApiKey } = require('./middleware/partnerAuth');

  function requireCronSecret(req) {
    const expected = process.env.INTERNAL_CRON_SECRET;
    if (!expected) return false;
    const got = req.headers['x-internal-cron-secret'] || req.body?.secret;
    return String(got || '') === String(expected);
  }

  app.post('/internal/partners/create', async (req, res) => {
    if (!requireCronSecret(req)) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
      const name = String(req.body?.name || '').trim();
      const slug = String(req.body?.slug || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const keyName = String(req.body?.keyName || 'default').trim() || 'default';

      if (!name || !slug) {
        return res.status(400).json({ message: 'name and slug are required' });
      }

      const rawKey = `ema_pk_${crypto.randomBytes(24).toString('base64url')}`;
      const result = await createPartnerWithApiKey({
        name,
        slug,
        keyName,
        keyPrefix: rawKey.slice(0, 16),
        keyHash: hashPartnerApiKey(rawKey),
      });

      return res.status(201).json({
        partner: {
          id: result.partner.id,
          name: result.partner.name,
          slug: result.partner.slug,
        },
        apiKey: rawKey,
        apiKeyPrefix: rawKey.slice(0, 16),
        warning: 'Store apiKey securely; it is shown only once.',
      });
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.status(503).json({
          message: 'Partner API schema missing. Run backend/sql/migrations/20260619_partners_api.sql in Supabase.',
        });
      }
      if (e?.code === '23505') return res.status(400).json({ message: 'Partner slug already exists' });
      return res.status(500).json({ message: e?.message || 'Failed to create partner' });
    }
  });
}

module.exports = { registerPartnerRoutes, registerPartnerInternalRoutes };
