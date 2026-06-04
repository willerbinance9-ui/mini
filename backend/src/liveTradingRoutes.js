const crypto = require('crypto');
const {
  ensureWalletForUser,
  setWalletBalance,
  getMt5AccountByIdForUser,
  allocateLiveTradingLogin,
  listPlatformLiveTradingAccountsByUserId,
  createPlatformLiveTradingAccount,
  ensureLiveTradingWalletRow,
  upsertLiveTradingWalletBalance,
  insertLiveTradingTransfer,
  insertMt5EaCommand,
  setMt5AccountMetaApiId,
  listMarketPrices,
  getLatestMarketPriceUpdate,
  isMissingTableError,
} = require('./db');
const {
  positionsFromAccountRow,
  useMt5Bridge,
  computeLiveBalances,
  enqueueClosePositionCommand,
} = require('./services/mt5BridgeService');
const { ensureMetaApiAccount } = require('./services/mt5Client');
const { mapPriceRowForApi } = require('./services/priceFeedNormalize');
const {
  validateTradingPassword,
  validateAccountName,
  normalizeBotType,
  botLabel,
  botMagic,
  VALID_LEVERAGES,
  getMinDeposit,
  minDepositMessage,
} = require('./services/liveTradingValidation');

const LIVE_NOT_CONNECTED_MSG = 'Live trading is not connected yet. Try again in a moment.';

const SCHEMA_MSG =
  'Live trading schema missing. Run backend/sql/migrations/20260614_live_trading_accounts.sql in Supabase.';

function newId() {
  return crypto.randomUUID();
}

function newEaToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getLiveServer() {
  return String(process.env.MT5_LIVE_SERVER || 'EMA-Live').trim() || 'EMA-Live';
}

function toLiveAccountSummary(account, wallet) {
  const botType = account.bot_type || null;
  const balances = computeLiveBalances(account, wallet);
  return {
    id: account.id,
    login: account.login,
    server: account.server,
    accountName: account.account_name || '',
    botType,
    botLabel: botLabel(botType),
    botMagic: botMagic(botType),
    leverage: Number(account.leverage || 100),
    isPlatformProvisioned: Boolean(account.is_platform_provisioned),
    internalBalance: balances.depositedBalance,
    depositedBalance: balances.depositedBalance,
    openProfit: balances.openProfit,
    displayBalance: balances.displayBalance,
    cachedBalance:
      account.cached_balance !== null && account.cached_balance !== undefined
        ? Number(account.cached_balance)
        : null,
    cachedEquity:
      account.cached_equity !== null && account.cached_equity !== undefined
        ? Number(account.cached_equity)
        : null,
    cachedCurrency: account.cached_currency || 'USD',
    balanceLastUpdatedAt: account.balance_last_updated_at || null,
    metaapiAccountId: account.metaapi_account_id || '',
    createdAt: account.created_at,
    updatedAt: account.updated_at,
  };
}

async function loadAccountWithWallet(userId, accountId) {
  const account = await getMt5AccountByIdForUser(userId, accountId);
  if (!account || !account.is_platform_provisioned) return null;
  const wallet = await ensureLiveTradingWalletRow(accountId);
  return { account, wallet };
}

function registerLiveTradingRoutes(app, { authMiddleware }) {
  app.get('/live-trading/accounts', authMiddleware, async (req, res) => {
    try {
      const accounts = await listPlatformLiveTradingAccountsByUserId(req.userId);
      const rows = await Promise.all(
        accounts.map(async (acc) => {
          const wallet = await ensureLiveTradingWalletRow(acc.id);
          return toLiveAccountSummary(acc, wallet);
        })
      );
      return res.json({ accounts: rows, server: getLiveServer() });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to list live accounts' });
    }
  });

  app.post('/live-trading/accounts', authMiddleware, async (req, res) => {
    try {
      const botType = normalizeBotType(req.body?.botType);
      if (!botType) return res.status(400).json({ message: 'Choose Synthetix EA or Quantix EA.' });

      const nameCheck = validateAccountName(req.body?.accountName);
      if (!nameCheck.ok) return res.status(400).json({ message: nameCheck.message });

      const pwCheck = validateTradingPassword(req.body?.password);
      if (!pwCheck.ok) return res.status(400).json({ message: pwCheck.message });

      let leverage = Number(req.body?.leverage);
      if (!VALID_LEVERAGES.includes(leverage)) leverage = 100;

      const login = await allocateLiveTradingLogin();
      const server = getLiveServer();
      const eaToken = newEaToken();

      const account = await createPlatformLiveTradingAccount(req.userId, {
        login,
        password: String(req.body.password),
        server,
        accountName: nameCheck.value,
        botType,
        leverage,
        platformLoginSeq: Number(login),
        eaWebhookToken: eaToken,
      });

      await ensureLiveTradingWalletRow(account.id);

      // Non-blocking MetaApi provisioning
      ensureMetaApiAccount({
        metaapiAccountId: '',
        login: account.login,
        password: account.password,
        server: account.server,
        accountName: account.account_name,
      })
        .then(({ accountId }) => setMt5AccountMetaApiId(req.userId, account.id, accountId))
        .catch((err) => console.warn('[live-trading] MetaApi provision deferred:', err?.message || err));

      const wallet = await ensureLiveTradingWalletRow(account.id);
      return res.status(201).json({
        success: true,
        account: toLiveAccountSummary(account, wallet),
        message: 'Live trading account created. Save your login, server, and trading password.',
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      console.error('[live-trading/create]', e);
      return res.status(500).json({ message: e?.message || 'Failed to create live account' });
    }
  });

  app.get('/live-trading/accounts/:id/summary', authMiddleware, async (req, res) => {
    try {
      const loaded = await loadAccountWithWallet(req.userId, req.params.id);
      if (!loaded) return res.status(404).json({ message: 'Live account not found' });

      const cashWallet = await ensureWalletForUser(req.userId);
      return res.json({
        account: toLiveAccountSummary(loaded.account, loaded.wallet),
        cashWallet: Number.parseFloat(String(cashWallet.balance ?? 0)) || 0,
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to load account summary' });
    }
  });

  app.post('/live-trading/accounts/:id/fund', authMiddleware, async (req, res) => {
    try {
      const amount = Number(req.body?.amount);
      if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });

      const loaded = await loadAccountWithWallet(req.userId, req.params.id);
      if (!loaded) return res.status(404).json({ message: 'Live account not found' });

      const minDeposit = getMinDeposit(loaded.account.bot_type);
      if (minDeposit > 0 && amount < minDeposit) {
        return res.status(400).json({ message: minDepositMessage(loaded.account.bot_type) });
      }

      const wallet = await ensureWalletForUser(req.userId);
      const cash = Number.parseFloat(String(wallet.balance ?? 0)) || 0;
      if (cash < amount) return res.status(400).json({ message: 'Insufficient cash wallet balance' });

      const liveBal = Number(loaded.wallet?.balance || 0);
      const nextLive = liveBal + amount;

      await setWalletBalance(req.userId, cash - amount);
      const row = await upsertLiveTradingWalletBalance(loaded.account.id, nextLive);
      await insertLiveTradingTransfer({
        id: newId(),
        mt5_account_id: loaded.account.id,
        user_id: req.userId,
        direction: 'to_live',
        amount,
      });

      return res.json({
        cashWallet: cash - amount,
        internalBalance: Number(row.balance || 0),
        account: toLiveAccountSummary(loaded.account, row),
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Funding live account failed' });
    }
  });

  app.post('/live-trading/accounts/:id/return-to-cash', authMiddleware, async (req, res) => {
    try {
      const amount = Number(req.body?.amount);
      if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });

      const loaded = await loadAccountWithWallet(req.userId, req.params.id);
      if (!loaded) return res.status(404).json({ message: 'Live account not found' });

      const liveBal = Number(loaded.wallet?.balance || 0);
      if (liveBal < amount) return res.status(400).json({ message: 'Insufficient live account balance' });

      const wallet = await ensureWalletForUser(req.userId);
      const cash = Number.parseFloat(String(wallet.balance ?? 0)) || 0;
      const nextLive = liveBal - amount;

      await setWalletBalance(req.userId, cash + amount);
      const row = await upsertLiveTradingWalletBalance(loaded.account.id, nextLive);
      await insertLiveTradingTransfer({
        id: newId(),
        mt5_account_id: loaded.account.id,
        user_id: req.userId,
        direction: 'to_cash',
        amount,
      });

      return res.json({
        cashWallet: cash + amount,
        internalBalance: Number(row.balance || 0),
        account: toLiveAccountSummary(loaded.account, row),
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Return to cash failed' });
    }
  });

  app.get('/live-trading/accounts/:id/positions', authMiddleware, async (req, res) => {
    try {
      const loaded = await loadAccountWithWallet(req.userId, req.params.id);
      if (!loaded) return res.status(404).json({ message: 'Live account not found' });
      if (!useMt5Bridge(loaded.account)) {
        return res.status(503).json({ message: LIVE_NOT_CONNECTED_MSG });
      }
      const positions = positionsFromAccountRow(loaded.account);
      return res.json({
        positions,
        source: 'mt5_bridge',
        snapshotAt: loaded.account.ea_snapshot_at || null,
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to load positions' });
    }
  });

  app.post('/live-trading/accounts/:id/positions/close', authMiddleware, async (req, res) => {
    try {
      const loaded = await loadAccountWithWallet(req.userId, req.params.id);
      if (!loaded) return res.status(404).json({ message: 'Live account not found' });
      const positionId = req.body?.positionId ?? req.body?.ticket;
      if (!positionId) return res.status(400).json({ message: 'positionId is required' });
      if (!useMt5Bridge(loaded.account) && !loaded.account.ea_webhook_token) {
        return res.status(503).json({ message: LIVE_NOT_CONNECTED_MSG });
      }
      const row = await enqueueClosePositionCommand(insertMt5EaCommand, loaded.account.id, positionId);
      return res.json({ ok: true, queued: true, commandId: row.id });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to queue close' });
    }
  });

  app.get('/live-trading/prices', authMiddleware, async (req, res) => {
    try {
      const search = req.query.search ? String(req.query.search) : '';
      const limit = req.query.limit ? Number(req.query.limit) : 200;
      const prices = await listMarketPrices({ search, limit });
      const lastUpdated = await getLatestMarketPriceUpdate();
      return res.json({
        prices: prices.map(mapPriceRowForApi),
        lastUpdated,
        count: prices.length,
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to load prices' });
    }
  });
}

module.exports = { registerLiveTradingRoutes, toLiveAccountSummary, botLabel, botMagic };
