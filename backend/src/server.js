require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  getUserByEmail,
  getUserById,
  userIsBanned,
  createUser,
  updateUserTotpSecretEnc,
  setTotpEnabled,
  clearTotp,
  ensureWalletForUser,
  setWalletBalance,
  ensureUserTransferCode,
  lookupPeerTransferRecipient,
  rpcWalletPeerTransfer,
  createTransaction,
  getTransactionsByUserId,
  clearTransactionsByUserId,
  listMt5AccountsByUserId,
  getMt5AccountByIdForUser,
  createMt5AccountForUser,
  deleteMt5AccountForUser,
  setMt5AccountMetaApiId,
  updateMt5AccountSnapshot,
  insertMt5EaCommand,
  setMt5EaWebhookToken,
  checkDatabaseHealth,
  isMissingTableError,
  getComplianceProfileByUserId,
} = require('./db');
const { authMiddleware, totpPendingMiddleware, TOTP_PENDING_PURPOSE } = require('./middleware/auth');
const { encryptTotpSecret, decryptTotpSecret } = require('./totpCrypto');
const { mapTotpConfigurationError } = require('./totpErrors');
const { generateSecret, generateURI, verifySync } = require('otplib');
const {
  ensureMetaApiAccount,
  fetchMt5Balance,
  fetchMt5OpenPositions,
  placeMetaApiTrade,
  closeMt5Position,
  fetchMt5HistoryDeals,
  normalizeMt5Position,
  normalizeMt5Deal,
  extractErrorMessage,
} = require('./services/mt5Client');

const { registerCryptoRoutes, handleTatumWebhook } = require('./cryptoRoutes');
const { registerNowpaymentsRoutes, handlePaymentWebhook, handlePayoutWebhook } = require('./nowpaymentsRoutes');
const { registerAirfarmingRoutes } = require('./airfarmingRoutes');
const { registerPasswordResetRoutes } = require('./passwordReset');
const { registerAdminRoutes } = require('./adminRoutes');
const { registerAdminLiveTradingRoutes } = require('./adminLiveTradingRoutes');
const { registerAnnouncementRoutes } = require('./announcementRoutes');
const { adminAuthMiddleware } = require('./middleware/adminAuth');
const path = require('path');
const { registerContractRoutes } = require('./contractRoutes');
const { registerAiInternalRoutes } = require('./aiInternalRoutes');
const { registerVipFarmerRoutes } = require('./vipFarmerRoutes');
const { registerJournalRoutes } = require('./journalRoutes');
const { registerExpertRoutes } = require('./expertRoutes');
const { registerLiveTradingRoutes } = require('./liveTradingRoutes');
const { registerGhostAccountRoutes } = require('./ghostAccountRoutes');
const { registerPartnerRoutes, registerPartnerInternalRoutes } = require('./partnerRoutes');
const { registerPartnerApplicationRoutes } = require('./partnerApplicationRoutes');
const { registerPartnerPortalRoutes } = require('./partnerPortalRoutes');
const {
  registerPortalPackagePaymentRoutes,
  handlePackagePaymentWebhook,
} = require('./portalPackagePayments');
const { registerPublicStatusRoutes } = require('./publicStatusRoutes');
const { registerMt5EaWebhookRoutes } = require('./mt5EaWebhookRoutes');
const { registerComplianceRoutes } = require('./complianceRoutes');
const { registerWhitelistWalletRoutes } = require('./whitelistWalletRoutes');
const { registerNotificationRoutes } = require('./notificationRoutes');
const { registerNotificationPreferencesRoutes } = require('./notificationPreferencesRoutes');
const { registerSupportRoutes } = require('./supportRoutes');
const { notifyPeerTransfer } = require('./peerTransferNotifications');
const { registerLocalMoneyRoutes, handleFlutterwaveWebhook } = require('./localMoneyRoutes');
const { registerP2pRoutes } = require('./p2pRoutes');
const { requireComplianceProfile } = require('./middleware/requireComplianceProfile');
const { isComplianceProfileComplete } = require('./complianceProfile');
const {
  positionsFromAccountRow,
  useMt5Bridge,
  enqueueClosePositionCommand,
} = require('./services/mt5BridgeService');

const app = express();
app.use(cors());
app.post(
  '/crypto/webhooks/tatum',
  express.json({
    limit: '2mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
  (req, res, next) => {
    handleTatumWebhook(req, res).catch(next);
  }
);
registerMt5EaWebhookRoutes(app);
app.post(
  '/webhooks/nowpayments/payment',
  express.json({
    limit: '2mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
  (req, res, next) => {
    handlePaymentWebhook(req, res).catch(next);
  }
);
app.post(
  '/webhooks/nowpayments/payout',
  express.json({
    limit: '2mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
  (req, res, next) => {
    handlePayoutWebhook(req, res).catch(next);
  }
);
app.post(
  '/webhooks/nowpayments/package',
  express.json({
    limit: '2mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
  (req, res, next) => {
    handlePackagePaymentWebhook(req, res).catch(next);
  }
);
app.post('/webhooks/flutterwave', express.json({ limit: '2mb' }), (req, res, next) => {
  handleFlutterwaveWebhook(req, res).catch(next);
});
app.use(express.json());

function mt5SafeErrorMessage(error, fallback) {
  const raw = String(extractErrorMessage(error, fallback) || fallback);
  const lower = raw.toLowerCase();
  if (lower.includes('mt5_metaapi_token is not configured')) return 'MT5 MetaApi token is missing on backend environment';
  if (lower.includes('timeout')) return 'MetaApi request timed out. Retry in a moment.';
  if (lower.includes('validation for trading account') && lower.includes('too many times')) {
    return 'MetaApi temporarily rate-limited this account validation. Retry in about 1 hour.';
  }
  if (lower.includes('failed to authenticate') || lower.includes('invalid account') || lower.includes('e_auth')) {
    return 'MT5 credentials or server are invalid. Verify login, password, and server name.';
  }
  return process.env.NODE_ENV === 'production' ? fallback : raw;
}

function signToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET || 'ema-dev-secret', { expiresIn: '7d' });
}

function signTotpPendingToken(userId) {
  return jwt.sign(
    { sub: userId, purpose: TOTP_PENDING_PURPOSE },
    process.env.JWT_SECRET || 'ema-dev-secret',
    { expiresIn: '5m' }
  );
}

function sendTotpRouteError(res, error, fallbackProd, logLabel) {
  const mapped = mapTotpConfigurationError(error);
  console.error(logLabel, error);
  if (mapped) return res.status(mapped.status).json({ message: mapped.message });
  const message =
    process.env.NODE_ENV === 'production' ? fallbackProd : error?.message || fallbackProd;
  return res.status(500).json({ message });
}

const currentUser = (req) => getUserById(req.userId);
const toMt5Summary = (account) => ({
  id: account.id,
  metaapiAccountId: account.metaapi_account_id || '',
  login: account.login,
  server: account.server,
  accountName: account.account_name || '',
  cachedBalance: account.cached_balance !== null && account.cached_balance !== undefined ? Number(account.cached_balance) : null,
  cachedEquity: account.cached_equity !== null && account.cached_equity !== undefined ? Number(account.cached_equity) : null,
  cachedCurrency: account.cached_currency || null,
  balanceLastUpdatedAt: account.balance_last_updated_at || null,
  updatedAt: account.updated_at,
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.get('/auth/email-confirmed', (_, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>All set</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #020617;
        color: #e2e8f0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .card {
        width: min(92vw, 520px);
        border: 1px solid #1e293b;
        background: #0f172a;
        border-radius: 16px;
        padding: 28px 22px;
        box-shadow: 0 20px 50px rgba(2, 6, 23, 0.45);
        text-align: center;
      }
      .dot {
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: #22c55e;
        margin: 0 auto 14px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 28px;
        color: #f8fafc;
      }
      p {
        margin: 0;
        color: #94a3b8;
        font-size: 15px;
        line-height: 1.45;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="dot"></div>
      <h1>All set</h1>
      <p>Your email is confirmed. You can close this page and open the Ema app now.</p>
    </main>
  </body>
</html>`);
});

app.get('/health/db', async (_, res) => {
  try {
    const counts = await checkDatabaseHealth();
    return res.json({ status: 'ok', database: 'connected', counts });
  } catch {
    return res.status(500).json({ status: 'error', database: 'unreachable' });
  }
});

app.post('/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || password.length < 6) return res.status(400).json({ message: 'Invalid credentials' });
    const existing = await getUserByEmail(email);
    if (existing) return res.status(400).json({ message: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({ email, passwordHash });
    return res.json({ token: signToken(user), user: { id: user.id, email: user.email } });
  } catch (error) {
    const isSchemaMissing = error?.code === 'PGRST205';
    const message = isSchemaMissing
      ? 'Database schema not initialized. Run backend/sql/schema.sql in Supabase SQL Editor.'
      : process.env.NODE_ENV === 'production'
        ? 'Registration failed'
        : error?.message || 'Registration failed';
    return res.status(500).json({ message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await getUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (userIsBanned(user)) {
      return res.status(403).json({
        message: user.ban_reason || 'This account has been suspended.',
        code: 'ACCOUNT_BANNED',
      });
    }
    if (user.totp_enabled) {
      return res.json({ requiresTotp: true, preAuthToken: signTotpPendingToken(user.id) });
    }
    return res.json({ token: signToken(user), user: { id: user.id, email: user.email } });
  } catch (error) {
    const message = process.env.NODE_ENV === 'production' ? 'Login failed' : error?.message || 'Login failed';
    return res.status(500).json({ message });
  }
});

app.post('/auth/totp/verify', totpPendingMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') return res.status(400).json({ message: 'Missing code' });
    const user = await getUserById(req.userId);
    if (!user || !user.totp_enabled || !user.totp_secret_enc) {
      return res.status(400).json({ message: 'Two-factor authentication is not enabled for this account' });
    }
    let secret;
    try {
      secret = decryptTotpSecret(user.totp_secret_enc);
    } catch {
      return res.status(500).json({ message: 'Server configuration error' });
    }
    const totpResult = verifySync({
      secret,
      token: String(code).replace(/\s/g, ''),
      epochTolerance: 1,
    });
    if (!totpResult.valid) {
      return res.status(401).json({ message: 'Invalid code' });
    }
    if (userIsBanned(user)) {
      return res.status(403).json({
        message: user.ban_reason || 'This account has been suspended.',
        code: 'ACCOUNT_BANNED',
      });
    }
    return res.json({ token: signToken(user), user: { id: user.id, email: user.email } });
  } catch (error) {
    return sendTotpRouteError(res, error, 'Verification failed', '[auth/totp/verify]');
  }
});

app.get('/auth/totp/status', authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const enabled = Boolean(user.totp_enabled);
    const setupPending = Boolean(!enabled && user.totp_secret_enc);
    return res.json({ enabled, setupPending });
  } catch (error) {
    return sendTotpRouteError(res, error, 'Failed to load status', '[auth/totp/status]');
  }
});

app.post('/auth/totp/setup/start', authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.totp_enabled) return res.status(400).json({ message: 'Two-factor authentication is already enabled' });
    const secret = generateSecret();
    const enc = encryptTotpSecret(secret);
    await updateUserTotpSecretEnc(user.id, enc);
    const otpauthUrl = generateURI({ issuer: 'EMA', label: user.email, secret });
    return res.json({ otpauthUrl, secretBase32: secret });
  } catch (error) {
    return sendTotpRouteError(res, error, 'Failed to start setup', '[auth/totp/setup/start]');
  }
});

app.post('/auth/totp/setup/confirm', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') return res.status(400).json({ message: 'Missing code' });
    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.totp_enabled) return res.status(400).json({ message: 'Two-factor authentication is already enabled' });
    if (!user.totp_secret_enc) return res.status(400).json({ message: 'No setup in progress' });
    let secret;
    try {
      secret = decryptTotpSecret(user.totp_secret_enc);
    } catch {
      return res.status(500).json({ message: 'Server configuration error' });
    }
    const confirmResult = verifySync({
      secret,
      token: String(code).replace(/\s/g, ''),
      epochTolerance: 1,
    });
    if (!confirmResult.valid) {
      return res.status(401).json({ message: 'Invalid code' });
    }
    await setTotpEnabled(user.id, true);
    return res.json({ success: true });
  } catch (error) {
    return sendTotpRouteError(res, error, 'Failed to confirm setup', '[auth/totp/setup/confirm]');
  }
});

app.post('/auth/totp/setup/cancel', authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.totp_enabled) {
      return res.status(400).json({ message: 'Cannot cancel while two-factor authentication is enabled' });
    }
    if (user.totp_secret_enc) await updateUserTotpSecretEnc(user.id, null);
    return res.json({ success: true });
  } catch (error) {
    return sendTotpRouteError(res, error, 'Failed to cancel setup', '[auth/totp/setup/cancel]');
  }
});

app.post('/auth/totp/disable', authMiddleware, async (req, res) => {
  try {
    const { password, code } = req.body;
    if (!password || typeof password !== 'string' || !code || typeof code !== 'string') {
      return res.status(400).json({ message: 'Missing password or code' });
    }
    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.totp_enabled || !user.totp_secret_enc) {
      return res.status(400).json({ message: 'Two-factor authentication is not enabled' });
    }
    if (!(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    let secret;
    try {
      secret = decryptTotpSecret(user.totp_secret_enc);
    } catch {
      return res.status(500).json({ message: 'Server configuration error' });
    }
    const disableResult = verifySync({
      secret,
      token: String(code).replace(/\s/g, ''),
      epochTolerance: 1,
    });
    if (!disableResult.valid) {
      return res.status(401).json({ message: 'Invalid code' });
    }
    await clearTotp(user.id);
    return res.json({ success: true });
  } catch (error) {
    return sendTotpRouteError(res, error, 'Failed to disable two-factor', '[auth/totp/disable]');
  }
});

app.get('/auth/me', authMiddleware, async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json({ user: { id: user.id, email: user.email } });
});

registerPasswordResetRoutes(app);

app.get('/profile', authMiddleware, async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(404).json({ message: 'User not found' });

  let complianceComplete = false;
  try {
    const compliance = await getComplianceProfileByUserId(req.userId);
    complianceComplete = isComplianceProfileComplete(compliance);
  } catch {
    complianceComplete = false;
  }

  return res.json({
    profile: {
      email: user.email,
      username: user.email.split('@')[0],
      accountStatus: 'active',
      complianceComplete,
    },
  });
});

registerCryptoRoutes(app, { authMiddleware });
registerNowpaymentsRoutes(app, { authMiddleware });
registerComplianceRoutes(app, { authMiddleware });
registerLocalMoneyRoutes(app, { authMiddleware });
registerP2pRoutes(app, { authMiddleware });
registerWhitelistWalletRoutes(app, { authMiddleware });
registerNotificationRoutes(app, { authMiddleware });
registerNotificationPreferencesRoutes(app, { authMiddleware });
registerSupportRoutes(app, { authMiddleware });
registerAirfarmingRoutes(app, { authMiddleware });
registerContractRoutes(app, { authMiddleware });
registerAiInternalRoutes(app);
registerVipFarmerRoutes(app, { authMiddleware });
registerJournalRoutes(app, { authMiddleware });
registerExpertRoutes(app, { authMiddleware });
registerLiveTradingRoutes(app, { authMiddleware });
registerGhostAccountRoutes(app, { authMiddleware });
registerPartnerRoutes(app);
registerPartnerInternalRoutes(app);
registerPartnerApplicationRoutes(app);
registerPartnerPortalRoutes(app);
registerPortalPackagePaymentRoutes(app);
registerPublicStatusRoutes(app);
registerAdminRoutes(app);
registerAdminLiveTradingRoutes(app);
registerAnnouncementRoutes(app, { adminAuthMiddleware });
app.use(
  '/admin',
  (req, res, next) => {
    if (req.path === '/' || req.path === '/index.html' || /\.html$/i.test(req.path)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
    next();
  },
  express.static(path.join(__dirname, '../public/admin'))
);

function mapRpcPeerTransferError(error) {
  const raw = `${String(error?.message || '')} ${String(error?.details || '')} ${String(error?.hint || '')}`;
  if (raw.includes('recipient_not_found')) {
    return { status: 404, message: 'No user found with this transfer ID' };
  }
  if (raw.includes('cannot_send_to_self')) {
    return { status: 400, message: 'Cannot send money to yourself' };
  }
  if (raw.includes('insufficient_funds')) {
    return { status: 400, message: 'Insufficient wallet balance' };
  }
  if (raw.includes('invalid_amount')) {
    return { status: 400, message: 'Invalid amount' };
  }
  if (raw.includes('invalid_recipient_code')) {
    return { status: 400, message: 'Recipient transfer ID is required' };
  }
  if (raw.includes('idempotency_mismatch')) {
    return { status: 409, message: 'Idempotency conflict' };
  }
  return null;
}

app.get('/wallet', authMiddleware, async (req, res) => {
  try {
    const wallet = await ensureWalletForUser(req.userId);
    const transactions = await getTransactionsByUserId(req.userId);
    const balance = Number.parseFloat(String(wallet.balance ?? 0)) || 0;
    return res.json({ balance, transactions });
  } catch {
    return res.status(500).json({ message: 'Failed to fetch wallet' });
  }
});

app.get('/wallet/transfer-code', authMiddleware, async (req, res) => {
  try {
    const transferCode = await ensureUserTransferCode(req.userId);
    if (!transferCode) return res.status(404).json({ message: 'User not found' });
    return res.json({ transferCode });
  } catch {
    return res.status(500).json({ message: 'Failed to resolve transfer ID' });
  }
});

app.get('/wallet/transfer-lookup', authMiddleware, async (req, res) => {
  try {
    const code = req.query?.code != null ? String(req.query.code).trim() : '';
    if (!code) return res.status(400).json({ message: 'Transfer ID is required' });
    const result = await lookupPeerTransferRecipient(req.userId, code);
    return res.json(result);
  } catch {
    return res.status(500).json({ message: 'Lookup failed' });
  }
});

app.post('/wallet/transfer', authMiddleware, requireComplianceProfile, async (req, res) => {
  try {
    const toTransferCode =
      req.body?.toTransferCode != null ? String(req.body.toTransferCode).trim() : '';
    const amount = Number(req.body?.amount);
    const rawIdem = req.body?.idempotencyKey != null ? String(req.body.idempotencyKey).trim() : '';

    if (!toTransferCode) return res.status(400).json({ message: 'Recipient transfer ID is required' });
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const roundedAmount = Math.round(amount * 100) / 100;

    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.totp_enabled) {
      const code = req.body?.totpCode != null ? String(req.body.totpCode).replace(/\s/g, '') : '';
      if (!code || code.length < 6) {
        return res.status(400).json({ message: 'Authenticator code is required for transfers' });
      }
      if (!user.totp_secret_enc) {
        return res.status(500).json({ message: 'Server configuration error' });
      }
      let secret;
      try {
        secret = decryptTotpSecret(user.totp_secret_enc);
      } catch {
        return res.status(500).json({ message: 'Server configuration error' });
      }
      const totpResult = verifySync({
        secret,
        token: code,
        epochTolerance: 1,
      });
      if (!totpResult.valid) {
        return res.status(401).json({ message: 'Invalid authenticator code' });
      }
    }

    const result = await rpcWalletPeerTransfer({
      fromUserId: req.userId,
      toTransferCode,
      amount: roundedAmount,
      idempotencyKey: rawIdem || null,
    });

    const fromBalance = Number.parseFloat(String(result?.from_balance ?? 0)) || 0;
    const recipientUserId = result?.to_user_id ? String(result.to_user_id) : null;
    const idempotent = Boolean(result?.idempotent);

    if (!idempotent && recipientUserId) {
      void notifyPeerTransfer({
        senderUserId: req.userId,
        recipientUserId,
        amount: roundedAmount,
        recipientCode: toTransferCode,
      });
    }

    return res.json({
      transferId: result?.transfer_id,
      balance: fromBalance,
      idempotent,
    });
  } catch (error) {
    const mapped = mapRpcPeerTransferError(error);
    if (mapped) return res.status(mapped.status).json({ message: mapped.message });
    return res.status(500).json({ message: 'Transfer failed' });
  }
});

app.post('/wallet/deposit', authMiddleware, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const method = req.body.method || 'bank_transfer';
    const referenceId = req.body.referenceId || `DEP-${Date.now()}`;
    if (method === 'crypto') {
      return res.status(400).json({
        message: 'Crypto deposits are available in Wallet -> Crypto tab.',
      });
    }
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });

    const wallet = await ensureWalletForUser(req.userId);

    const nextBalance = Number.parseFloat(String(wallet.balance ?? 0)) + amount;
    await setWalletBalance(req.userId, nextBalance);
    const transaction = await createTransaction({ userId: req.userId, type: 'deposit', amount, status: `completed:${method}:${referenceId}` });

    return res.json({ balance: nextBalance, transaction });
  } catch {
    return res.status(500).json({ message: 'Deposit failed' });
  }
});

app.post('/wallet/withdraw', authMiddleware, requireComplianceProfile, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const method = req.body.method || 'bank_transfer';
    const destinationAddress =
      req.body.destinationAddress != null ? String(req.body.destinationAddress).trim() : '';
    const network = req.body.network != null ? String(req.body.network).trim() : '';
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });

    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.totp_enabled) {
      const code =
        req.body?.totpCode != null ? String(req.body.totpCode).replace(/\s/g, '') : '';
      if (!code || code.length < 6) {
        return res.status(400).json({ message: 'Authenticator code is required for withdrawal' });
      }
      if (!user.totp_secret_enc) {
        return res.status(500).json({ message: 'Server configuration error' });
      }
      let secret;
      try {
        secret = decryptTotpSecret(user.totp_secret_enc);
      } catch {
        return res.status(500).json({ message: 'Server configuration error' });
      }
      const totpResult = verifySync({
        secret,
        token: code,
        epochTolerance: 1,
      });
      if (!totpResult.valid) {
        return res.status(401).json({ message: 'Invalid authenticator code' });
      }
    }

    const wallet = await ensureWalletForUser(req.userId);
    const current = Number.parseFloat(String(wallet.balance ?? 0)) || 0;
    if (current < amount) return res.status(400).json({ message: 'Insufficient wallet balance' });

    const nextBalance = current - amount;
    await setWalletBalance(req.userId, nextBalance);
    const statusMeta =
      network && destinationAddress
        ? `${method}:${JSON.stringify({ network, destinationAddress })}`
        : method;
    const transaction = await createTransaction({
      userId: req.userId,
      type: 'withdraw',
      amount,
      status: `pending:${statusMeta}`,
    });

    return res.json({
      balance: nextBalance,
      transaction,
      message: 'Withdrawal submitted for approval. Funds are held until an admin approves the request.',
    });
  } catch {
    return res.status(500).json({ message: 'Withdraw failed' });
  }
});

app.post('/wallet/reset', authMiddleware, async (req, res) => {
  try {
    const suppliedToken = req.headers['x-dev-reset-token'];
    const expectedToken = process.env.DEV_RESET_TOKEN;
    if (!expectedToken || suppliedToken !== expectedToken) {
      return res.status(403).json({ message: 'Invalid or missing reset token' });
    }
    await ensureWalletForUser(req.userId);
    await setWalletBalance(req.userId, 0);
    await clearTransactionsByUserId(req.userId);
    return res.json({ success: true, balance: 0 });
  } catch {
    return res.status(500).json({ message: 'Wallet reset failed' });
  }
});

app.get('/mt5/accounts', authMiddleware, async (req, res) => {
  try {
    const accounts = await listMt5AccountsByUserId(req.userId);
    return res.json({
      accounts: accounts.map(toMt5Summary),
    });
  } catch {
    return res.status(500).json({ message: 'Failed to fetch MT5 accounts' });
  }
});

app.post('/mt5/accounts', authMiddleware, async (req, res) => {
  try {
    const { login, password, server, accountName } = req.body;
    if (!login || !password || !server) {
      return res.status(400).json({ message: 'login, password and server are required' });
    }
    // Save credentials first; do not block save flow on MetaApi provisioning latency.
    // Provisioning happens later when user explicitly refreshes live balance.
    const saved = await createMt5AccountForUser(req.userId, {
      login: String(login),
      password: String(password),
      server: String(server),
      accountName: String(accountName || ''),
      metaapiAccountId: '',
    });
    return res.json({
      success: true,
      account: toMt5Summary(saved),
    });
  } catch (error) {
    return res.status(500).json({ message: extractErrorMessage(error, 'Failed to save MT5 account') });
  }
});

async function handleRemoveMt5Account(req, res) {
  try {
    const accountId = String(req.params.id || '').trim();
    if (!accountId) return res.status(400).json({ message: 'Account id is required' });

    const removed = await deleteMt5AccountForUser(req.userId, accountId);
    if (!removed) return res.status(404).json({ message: 'MT5 account not found' });

    const accounts = await listMt5AccountsByUserId(req.userId);
    return res.json({
      success: true,
      accounts: accounts.map(toMt5Summary),
    });
  } catch (error) {
    return res.status(500).json({ message: extractErrorMessage(error, 'Failed to remove MT5 account') });
  }
}

app.delete('/mt5/accounts/:id', authMiddleware, handleRemoveMt5Account);
app.post('/mt5/accounts/:id/remove', authMiddleware, handleRemoveMt5Account);

app.get('/mt5/accounts/:id/balance', authMiddleware, async (req, res) => {
  try {
    const account = await getMt5AccountByIdForUser(req.userId, req.params.id);
    if (!account) {
      return res.status(404).json({ message: 'MT5 account not found' });
    }
    return res.json({
      isLive: false,
      hasSnapshot: account.cached_balance !== null && account.cached_balance !== undefined,
      balance: account.cached_balance !== null && account.cached_balance !== undefined ? Number(account.cached_balance) : 0,
      equity: account.cached_equity !== null && account.cached_equity !== undefined ? Number(account.cached_equity) : 0,
      currency: account.cached_currency || 'USD',
      login: account.login,
      server: account.server,
      accountName: account.account_name || '',
      updatedAt: account.balance_last_updated_at || null,
    });
  } catch (error) {
    const message = process.env.NODE_ENV === 'production'
      ? 'Failed to fetch MT5 balance'
      : extractErrorMessage(error, 'Failed to fetch MT5 balance');
    return res.status(500).json({ message });
  }
});

app.post('/mt5/accounts/:id/refresh-balance', authMiddleware, async (req, res) => {
  try {
    const account = await getMt5AccountByIdForUser(req.userId, req.params.id);
    if (!account) return res.status(404).json({ message: 'MT5 account not found' });

    const { accountId } = await ensureMetaApiAccount({
      metaapiAccountId: account.metaapi_account_id,
      login: account.login,
      password: account.password,
      server: account.server,
      accountName: account.account_name || '',
    });
    if (accountId && accountId !== account.metaapi_account_id) {
      await setMt5AccountMetaApiId(req.userId, account.id, accountId);
    }

    const live = await fetchMt5Balance({ accountId });
    const updatedAt = new Date().toISOString();
    await updateMt5AccountSnapshot(req.userId, account.id, {
      balance: Number(live.balance || 0),
      equity: Number(live.equity || live.balance || 0),
      currency: String(live.currency || 'USD'),
      updatedAt,
    });

    return res.json({
      isLive: true,
      balance: Number(live.balance || 0),
      equity: Number(live.equity || live.balance || 0),
      currency: String(live.currency || 'USD'),
      login: live.login || account.login,
      server: live.server || account.server,
      accountName: live.name || account.account_name || '',
      updatedAt,
    });
  } catch (error) {
    const message = mt5SafeErrorMessage(error, 'Failed to refresh MT5 balance');
    return res.status(500).json({ message });
  }
});

app.get('/mt5/accounts/:id/positions', authMiddleware, async (req, res) => {
  try {
    const account = await getMt5AccountByIdForUser(req.userId, req.params.id);
    if (!account) {
      return res.status(404).json({ message: 'MT5 account not found' });
    }

    if (useMt5Bridge(account)) {
      const positions = positionsFromAccountRow(account);
      return res.json({ positions, source: 'mt5_bridge', snapshotAt: account.ea_snapshot_at || null });
    }

    const { accountId } = await ensureMetaApiAccount({
      metaapiAccountId: account.metaapi_account_id,
      login: account.login,
      password: account.password,
      server: account.server,
      accountName: account.account_name || '',
    });
    if (accountId && accountId !== account.metaapi_account_id) {
      await setMt5AccountMetaApiId(req.userId, account.id, accountId);
    }

    const raw = await fetchMt5OpenPositions({ accountId });
    const positions = (Array.isArray(raw) ? raw : []).map(normalizeMt5Position).filter((p) => p.id);
    return res.json({ positions });
  } catch (error) {
    const message = mt5SafeErrorMessage(error, 'Failed to fetch MT5 positions');
    return res.status(500).json({ message });
  }
});

async function resolveMt5MetaApiAccountId(account, userId) {
  const { accountId } = await ensureMetaApiAccount({
    metaapiAccountId: account.metaapi_account_id,
    login: account.login,
    password: account.password,
    server: account.server,
    accountName: account.account_name || '',
  });
  if (accountId && accountId !== account.metaapi_account_id) {
    await setMt5AccountMetaApiId(userId, account.id, accountId);
  }
  return accountId;
}

app.post('/mt5/accounts/:id/positions/close', authMiddleware, async (req, res) => {
  try {
    const account = await getMt5AccountByIdForUser(req.userId, req.params.id);
    if (!account) return res.status(404).json({ message: 'MT5 account not found' });
    const positionId = req.body?.positionId;
    if (!positionId) return res.status(400).json({ message: 'positionId is required' });

    if (useMt5Bridge(account) || account.ea_webhook_token) {
      const row = await enqueueClosePositionCommand(insertMt5EaCommand, account.id, positionId);
      return res.json({ ok: true, queued: true, commandId: row.id, source: 'mt5_bridge' });
    }

    const accountId = await resolveMt5MetaApiAccountId(account, req.userId);
    const result = await closeMt5Position({ accountId, positionId: String(positionId) });
    return res.json({ ok: true, result });
  } catch (error) {
    const message = mt5SafeErrorMessage(error, 'Failed to close position');
    const httpStatus = error?.response?.status;
    if (typeof httpStatus === 'number' && httpStatus >= 400 && httpStatus < 600) {
      return res.status(httpStatus).json({ message });
    }
    return res.status(500).json({ message });
  }
});

app.get('/mt5/accounts/:id/history', authMiddleware, async (req, res) => {
  try {
    const account = await getMt5AccountByIdForUser(req.userId, req.params.id);
    if (!account) return res.status(404).json({ message: 'MT5 account not found' });

    const days = Number(req.query.days) || 30;
    const limit = Number(req.query.limit) || 200;
    const offset = Number(req.query.offset) || 0;

    const accountId = await resolveMt5MetaApiAccountId(account, req.userId);
    const raw = await fetchMt5HistoryDeals({ accountId, days, limit, offset });
    const deals = (Array.isArray(raw) ? raw : []).map(normalizeMt5Deal).filter((d) => d.id);
    deals.sort((a, b) => {
      const ta = Date.parse(a.time || '') || 0;
      const tb = Date.parse(b.time || '') || 0;
      return tb - ta;
    });
    return res.json({ deals, days, limit, offset });
  } catch (error) {
    const message = mt5SafeErrorMessage(error, 'Failed to fetch trade history');
    return res.status(500).json({ message });
  }
});

app.post('/mt5/accounts/:id/ea-webhook-token', authMiddleware, async (req, res) => {
  try {
    const account = await getMt5AccountByIdForUser(req.userId, req.params.id);
    if (!account) return res.status(404).json({ message: 'MT5 account not found' });
    const token = crypto.randomBytes(32).toString('hex');
    await setMt5EaWebhookToken(req.userId, account.id, token);
    return res.json({ eaWebhookToken: token });
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.status(503).json({ message: 'MT5 EA schema not applied. Run migrations/20260513_mt5_ea_webhook.sql' });
    }
    const message = process.env.NODE_ENV === 'production' ? 'Failed to rotate EA token' : extractErrorMessage(error, 'Failed to rotate EA token');
    return res.status(500).json({ message });
  }
});

app.post('/mt5/accounts/:id/ea-commands', authMiddleware, async (req, res) => {
  try {
    const account = await getMt5AccountByIdForUser(req.userId, req.params.id);
    if (!account) return res.status(404).json({ message: 'MT5 account not found' });
    const { clientId, side, symbol, volume, stopLoss, takeProfit, magic } = req.body || {};
    if (!clientId || !side || !symbol || volume === undefined || volume === null) {
      return res.status(400).json({ message: 'clientId, side, symbol, and volume are required' });
    }
    const s = String(side).toLowerCase();
    if (s !== 'buy' && s !== 'sell') return res.status(400).json({ message: 'side must be buy or sell' });
    const vol = Number(volume);
    if (!Number.isFinite(vol) || vol <= 0) return res.status(400).json({ message: 'volume must be a positive number' });
    try {
      const row = await insertMt5EaCommand({
        id: crypto.randomUUID(),
        mt5_account_id: account.id,
        client_id: String(clientId),
        side: s,
        symbol: String(symbol).trim(),
        volume: vol,
        stop_loss: stopLoss != null && stopLoss !== '' && Number.isFinite(Number(stopLoss)) ? Number(stopLoss) : null,
        take_profit: takeProfit != null && takeProfit !== '' && Number.isFinite(Number(takeProfit)) ? Number(takeProfit) : null,
        magic: magic != null && magic !== '' && Number.isFinite(Number(magic)) ? Number(magic) : 0,
        status: 'pending',
      });
      return res.json({ id: row.id, clientId: row.client_id });
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(503).json({ message: 'MT5 EA schema not applied. Run migrations/20260513_mt5_ea_webhook.sql' });
      }
      if (error?.code === '23505') {
        return res.status(409).json({ message: 'Duplicate clientId for this MT5 account' });
      }
      throw error;
    }
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.status(503).json({ message: 'MT5 EA schema not applied. Run migrations/20260513_mt5_ea_webhook.sql' });
    }
    const message = process.env.NODE_ENV === 'production' ? 'Failed to enqueue EA command' : extractErrorMessage(error, 'Failed to enqueue EA command');
    return res.status(500).json({ message });
  }
});

app.post('/mt5/accounts/:id/orders', authMiddleware, async (req, res) => {
  try {
    const account = await getMt5AccountByIdForUser(req.userId, req.params.id);
    if (!account) return res.status(404).json({ message: 'MT5 account not found' });

    const { symbol, volume, side, stopLoss, takeProfit } = req.body || {};
    if (!symbol || volume === undefined || volume === null || !side) {
      return res.status(400).json({ message: 'symbol, volume, and side are required' });
    }
    const s = String(side).toLowerCase();
    if (s !== 'buy' && s !== 'sell') return res.status(400).json({ message: 'side must be buy or sell' });
    const vol = Number(volume);
    if (!Number.isFinite(vol) || vol <= 0) return res.status(400).json({ message: 'volume must be a positive number' });

    const { accountId } = await ensureMetaApiAccount({
      metaapiAccountId: account.metaapi_account_id,
      login: account.login,
      password: account.password,
      server: account.server,
      accountName: account.account_name || '',
    });
    if (accountId && accountId !== account.metaapi_account_id) {
      await setMt5AccountMetaApiId(req.userId, account.id, accountId);
    }

    const result = await placeMetaApiTrade({
      accountId,
      symbol: String(symbol).trim(),
      volume: vol,
      side: s,
      stopLoss,
      takeProfit,
    });
    return res.json({ ok: true, result });
  } catch (error) {
    const message = mt5SafeErrorMessage(error, 'Order placement failed');
    const httpStatus = error?.response?.status;
    if (typeof httpStatus === 'number' && httpStatus >= 400 && httpStatus < 600) {
      return res.status(httpStatus).json({ message });
    }
    return res.status(500).json({ message });
  }
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`Min backend listening on :${port}`));
