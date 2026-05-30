const crypto = require('crypto');
const {
  getP2pMerchantProfileByUserId,
  upsertP2pMerchantProfile,
  listEnabledP2pMerchantProfiles,
  insertP2pTrade,
  updateP2pTrade,
  getP2pTradeById,
  listP2pTradesByUserId,
  listActiveP2pTradesByUserId,
  incrementP2pMerchantCompletedTrades,
  getComplianceProfileByUserId,
  getUserById,
  getCryptoBalancesByUserId,
  isMissingTableError,
} = require('./db');
const { lockP2pEscrow, releaseP2pEscrow, refundP2pEscrow } = require('./p2pEscrow');
const { verifyUserTotp } = require('./totpVerify');
const { requireComplianceProfile } = require('./middleware/requireComplianceProfile');
const { REGIONS, getRegion } = require('./localMoneyRegions');
const { MIN_MOMO_USDT, totalUsdtFamilyAvailable, maxWithdrawableUsdt } = require('./usdtBalances');

const SCHEMA_MSG = 'P2P schema missing. Run backend/sql/migrations/20260611_p2p_marketplace.sql in Supabase.';

function newId() {
  return crypto.randomUUID();
}

function maskPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length < 4) return '';
  return `***${d.slice(-4)}`;
}

function toClientStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'awaiting_fiat') return 'pay_fiat';
  if (s === 'fiat_sent') return 'confirming';
  if (s === 'completed') return 'completed';
  if (s === 'cancelled') return 'cancelled';
  if (s === 'disputed') return 'disputed';
  return s;
}

function profileToApi(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    enabled: Boolean(row.enabled),
    side: row.side,
    pricePerUsdt: Number(row.price_per_usdt),
    fiatCurrency: row.fiat_currency,
    countryCode: row.country_code,
    limitMinFiat: Number(row.limit_min_fiat),
    limitMaxFiat: Number(row.limit_max_fiat),
    paymentName: row.payment_name,
    paymentPhone: row.payment_phone,
    bankName: row.bank_name,
    bankAccount: row.bank_account,
    notes: row.notes,
    completedTrades: Number(row.completed_trades || 0),
    updatedAt: row.updated_at,
  };
}

function tradeToApi(row, viewerId) {
  if (!row) return null;
  const isParticipant =
    viewerId && (String(row.merchant_user_id) === String(viewerId) || String(row.counterparty_user_id) === String(viewerId));
  const snapshot = row.fiat_payee_snapshot || {};
  return {
    id: row.id,
    merchantUserId: row.merchant_user_id,
    counterpartyUserId: row.counterparty_user_id,
    merchantSide: row.merchant_side,
    fiatAmount: Number(row.fiat_amount),
    cryptoAmount: Number(row.crypto_amount),
    pricePerUsdt: Number(row.price_per_usdt),
    fiatCurrency: row.fiat_currency,
    countryCode: row.country_code,
    status: toClientStatus(row.status),
    usdtSenderId: row.usdt_sender_id,
    usdtReceiverId: row.usdt_receiver_id,
    fiatPayerId: row.fiat_payer_id,
    fiatPayeeId: row.fiat_payee_id,
    fiatPayee: isParticipant ? snapshot : null,
    fiatSentAt: row.fiat_sent_at,
    completedAt: row.completed_at,
    disputedAt: row.disputed_at,
    disputeNote: row.dispute_note || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    viewerRole:
      viewerId && String(row.merchant_user_id) === String(viewerId)
        ? 'merchant'
        : viewerId && String(row.counterparty_user_id) === String(viewerId)
          ? 'counterparty'
          : null,
  };
}

async function displayNameForUser(userId) {
  const profile = await getComplianceProfileByUserId(userId);
  const first = String(profile?.legal_first_name || '').trim();
  const last = String(profile?.legal_last_name || '').trim();
  if (first) return last ? `${first} ${last.charAt(0)}.` : first;
  const user = await getUserById(userId);
  const email = user?.email || '';
  const local = email.split('@')[0] || 'Trader';
  return local.slice(0, 12);
}

function buildPayeeSnapshot({ name, phone, bankName, bankAccount, notes }) {
  return {
    name: String(name || '').trim(),
    phone: String(phone || '').trim(),
    bankName: String(bankName || '').trim(),
    bankAccount: String(bankAccount || '').trim(),
    notes: String(notes || '').trim(),
  };
}

function offerToApi(profileRow, displayName) {
  const counterpartyAction = profileRow.side === 'sell_usdt' ? 'buy' : 'sell';
  return {
    userId: profileRow.user_id,
    displayName,
    merchantSide: profileRow.side,
    counterpartyAction,
    pricePerUsdt: Number(profileRow.price_per_usdt),
    fiatCurrency: profileRow.fiat_currency,
    countryCode: profileRow.country_code,
    limitMinFiat: Number(profileRow.limit_min_fiat),
    limitMaxFiat: Number(profileRow.limit_max_fiat),
    completedTrades: Number(profileRow.completed_trades || 0),
    paymentMethods: ['Mobile money', 'Bank transfer'].filter(Boolean),
  };
}

function registerP2pRoutes(app, { authMiddleware }) {
  app.get('/p2p/my-profile', authMiddleware, async (req, res) => {
    try {
      const row = await getP2pMerchantProfileByUserId(req.userId);
      return res.json({ profile: profileToApi(row) });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e.message || 'Failed to load profile' });
    }
  });

  app.put('/p2p/my-profile', authMiddleware, requireComplianceProfile, async (req, res) => {
    try {
      const countryCode = String(req.body.countryCode || '').toUpperCase();
      const region = getRegion(countryCode);
      if (!region || !REGIONS[countryCode]) {
        return res.status(400).json({ message: 'P2P is not available in your region.' });
      }
      const side = req.body.side === 'buy_usdt' ? 'buy_usdt' : 'sell_usdt';
      const price = Number(req.body.pricePerUsdt);
      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ message: 'Enter a valid price per USDT.' });
      }
      const limitMin = Number(req.body.limitMinFiat ?? 0);
      const limitMax = Number(req.body.limitMaxFiat);
      if (!Number.isFinite(limitMax) || limitMax <= 0 || limitMax < limitMin) {
        return res.status(400).json({ message: 'Enter valid trade limits.' });
      }
      const enabled = Boolean(req.body.enabled);
      const paymentName = String(req.body.paymentName || '').trim();
      const paymentPhone = String(req.body.paymentPhone || '').trim();
      if (enabled && side === 'sell_usdt' && (!paymentName || !paymentPhone)) {
        return res.status(400).json({
          message: 'Payment name and phone are required when selling USDT (you receive fiat).',
        });
      }
      const row = await upsertP2pMerchantProfile({
        user_id: req.userId,
        enabled,
        side,
        price_per_usdt: price,
        fiat_currency: region.fiatCurrency,
        country_code: countryCode,
        limit_min_fiat: Math.max(0, limitMin),
        limit_max_fiat: limitMax,
        payment_name: paymentName,
        payment_phone: paymentPhone,
        bank_name: String(req.body.bankName || '').trim(),
        bank_account: String(req.body.bankAccount || '').trim(),
        notes: String(req.body.notes || '').trim(),
      });
      return res.json({ profile: profileToApi(row) });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e.message || 'Failed to save profile' });
    }
  });

  app.get('/p2p/offers', authMiddleware, async (req, res) => {
    try {
      const countryCode = req.query.countryCode ? String(req.query.countryCode).toUpperCase() : null;
      const rows = await listEnabledP2pMerchantProfiles({
        excludeUserId: req.userId,
        countryCode: countryCode || undefined,
      });
      const offers = [];
      for (const row of rows) {
        const name = await displayNameForUser(row.user_id);
        offers.push(offerToApi(row, name));
      }
      return res.json({ offers });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e.message || 'Failed to load offers' });
    }
  });

  app.get('/p2p/trades', authMiddleware, async (req, res) => {
    try {
      const rows = await listP2pTradesByUserId(req.userId, 50);
      const active = rows.filter((r) => ['awaiting_fiat', 'fiat_sent'].includes(String(r.status)));
      return res.json({
        trades: rows.map((r) => tradeToApi(r, req.userId)),
        active: active.map((r) => tradeToApi(r, req.userId)),
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e.message || 'Failed to load trades' });
    }
  });

  app.get('/p2p/trades/:id', authMiddleware, async (req, res) => {
    try {
      const row = await getP2pTradeById(req.params.id);
      if (!row) return res.status(404).json({ message: 'Trade not found' });
      if (row.merchant_user_id !== req.userId && row.counterparty_user_id !== req.userId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      return res.json({ trade: tradeToApi(row, req.userId) });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e.message || 'Failed to load trade' });
    }
  });

  app.post('/p2p/trades', authMiddleware, requireComplianceProfile, async (req, res) => {
    try {
      const totp = await verifyUserTotp(req.userId, req.body.totpCode, { required: true });
      if (!totp.ok) {
        return res.status(totp.status || 400).json({ message: totp.message, code: totp.code });
      }

      const merchantUserId = String(req.body.merchantUserId || '');
      if (!merchantUserId) return res.status(400).json({ message: 'Merchant is required' });
      if (merchantUserId === req.userId) {
        return res.status(400).json({ message: 'You cannot trade with your own offer.' });
      }

      const merchantProfile = await getP2pMerchantProfileByUserId(merchantUserId);
      if (!merchantProfile?.enabled) {
        return res.status(400).json({ message: 'This offer is no longer available.' });
      }

      const price = Number(merchantProfile.price_per_usdt);
      let cryptoAmount = Number(req.body.cryptoAmount);
      let fiatAmount = Number(req.body.fiatAmount);
      if (Number.isFinite(fiatAmount) && fiatAmount > 0 && (!Number.isFinite(cryptoAmount) || cryptoAmount <= 0)) {
        cryptoAmount = Math.round((fiatAmount / price) * 1e8) / 1e8;
      }
      if (Number.isFinite(cryptoAmount) && cryptoAmount > 0 && (!Number.isFinite(fiatAmount) || fiatAmount <= 0)) {
        fiatAmount = Math.round(cryptoAmount * price * 100) / 100;
      }
      if (!Number.isFinite(cryptoAmount) || cryptoAmount < MIN_MOMO_USDT) {
        return res.status(400).json({ message: `Minimum trade is ${MIN_MOMO_USDT} USDT.` });
      }
      if (!Number.isFinite(fiatAmount) || fiatAmount <= 0) {
        return res.status(400).json({ message: 'Invalid amount.' });
      }
      if (fiatAmount < Number(merchantProfile.limit_min_fiat) || fiatAmount > Number(merchantProfile.limit_max_fiat)) {
        return res.status(400).json({
          message: `Amount must be between ${merchantProfile.limit_min_fiat} and ${merchantProfile.limit_max_fiat} ${merchantProfile.fiat_currency}.`,
        });
      }

      const counterpartyId = req.userId;
      const merchantSide = merchantProfile.side;

      let usdtSenderId;
      let usdtReceiverId;
      let fiatPayerId;
      let fiatPayeeId;
      let fiatPayeeSnapshot;

      if (merchantSide === 'sell_usdt') {
        usdtSenderId = merchantUserId;
        usdtReceiverId = counterpartyId;
        fiatPayerId = counterpartyId;
        fiatPayeeId = merchantUserId;
        fiatPayeeSnapshot = buildPayeeSnapshot({
          name: merchantProfile.payment_name,
          phone: merchantProfile.payment_phone,
          bankName: merchantProfile.bank_name,
          bankAccount: merchantProfile.bank_account,
          notes: merchantProfile.notes,
        });
      } else {
        usdtSenderId = counterpartyId;
        usdtReceiverId = merchantUserId;
        fiatPayerId = merchantUserId;
        fiatPayeeId = counterpartyId;
        const cpProfile = await getComplianceProfileByUserId(counterpartyId);
        const payName =
          String(req.body.counterpartyPaymentName || '').trim() ||
          [cpProfile?.legal_first_name, cpProfile?.legal_last_name].filter(Boolean).join(' ');
        const payPhone = String(req.body.counterpartyPaymentPhone || '').trim() || String(cpProfile?.phone || '');
        const payBank = String(req.body.counterpartyBankName || '').trim();
        const payAccount = String(req.body.counterpartyBankAccount || '').trim();
        if (!payName || !payPhone) {
          return res.status(400).json({
            message: 'Enter your name and phone number to receive fiat payment.',
          });
        }
        fiatPayeeSnapshot = buildPayeeSnapshot({
          name: payName,
          phone: payPhone,
          bankName: payBank,
          bankAccount: payAccount,
          notes: '',
        });
      }

      const balances = await getCryptoBalancesByUserId(usdtSenderId);
      const maxW = maxWithdrawableUsdt(totalUsdtFamilyAvailable(balances));
      if (usdtSenderId === req.userId && cryptoAmount > maxW) {
        return res.status(400).json({
          message: `Insufficient balance. Maximum: ${Math.floor(maxW)} USDT.`,
        });
      }
      if (usdtSenderId !== req.userId) {
        const merchantBalances = await getCryptoBalancesByUserId(usdtSenderId);
        const merchantMax = maxWithdrawableUsdt(totalUsdtFamilyAvailable(merchantBalances));
        if (cryptoAmount > merchantMax) {
          return res.status(400).json({ message: 'Merchant has insufficient USDT for this trade.' });
        }
      }

      const tradeId = newId();
      await lockP2pEscrow({ userId: usdtSenderId, amount: cryptoAmount, tradeId, newId });

      const trade = await insertP2pTrade({
        id: tradeId,
        merchant_user_id: merchantUserId,
        counterparty_user_id: counterpartyId,
        merchant_side: merchantSide,
        fiat_amount: fiatAmount,
        crypto_amount: cryptoAmount,
        price_per_usdt: price,
        fiat_currency: merchantProfile.fiat_currency,
        country_code: merchantProfile.country_code,
        status: 'awaiting_fiat',
        usdt_sender_id: usdtSenderId,
        usdt_receiver_id: usdtReceiverId,
        fiat_payer_id: fiatPayerId,
        fiat_payee_id: fiatPayeeId,
        fiat_payee_snapshot: fiatPayeeSnapshot,
        ledger_escrow_posted: true,
      });

      return res.status(201).json({
        trade: tradeToApi(trade, req.userId),
        message: 'Trade started. Send fiat using the payment details shown, then mark when sent.',
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e.message || 'Failed to create trade' });
    }
  });

  app.post('/p2p/trades/:id/mark-fiat-sent', authMiddleware, async (req, res) => {
    try {
      const row = await getP2pTradeById(req.params.id);
      if (!row) return res.status(404).json({ message: 'Trade not found' });
      if (String(row.fiat_payer_id) !== String(req.userId)) {
        return res.status(403).json({ message: 'Only the fiat payer can mark payment sent.' });
      }
      if (row.status !== 'awaiting_fiat') {
        return res.status(400).json({ message: 'Trade is not awaiting fiat payment.' });
      }
      const updated = await updateP2pTrade(row.id, {
        status: 'fiat_sent',
        fiat_sent_at: new Date().toISOString(),
      });
      return res.json({
        trade: tradeToApi(updated, req.userId),
        message: 'Payment marked as sent. Waiting for the recipient to confirm.',
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e.message || 'Failed to update trade' });
    }
  });

  app.post('/p2p/trades/:id/confirm-fiat', authMiddleware, async (req, res) => {
    try {
      const totp = await verifyUserTotp(req.userId, req.body.totpCode, { required: true });
      if (!totp.ok) {
        return res.status(totp.status || 400).json({ message: totp.message, code: totp.code });
      }

      const row = await getP2pTradeById(req.params.id);
      if (!row) return res.status(404).json({ message: 'Trade not found' });
      if (String(row.fiat_payee_id) !== String(req.userId)) {
        return res.status(403).json({ message: 'Only the fiat recipient can confirm payment.' });
      }
      if (row.status !== 'fiat_sent') {
        return res.status(400).json({ message: 'Fiat must be marked sent before confirmation.' });
      }

      await releaseP2pEscrow({
        receiverId: row.usdt_receiver_id,
        amount: row.crypto_amount,
        tradeId: row.id,
        newId,
      });

      const updated = await updateP2pTrade(row.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
      await incrementP2pMerchantCompletedTrades(row.merchant_user_id);

      return res.json({
        trade: tradeToApi(updated, req.userId),
        message: 'Trade completed. USDT has been released.',
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e.message || 'Failed to complete trade' });
    }
  });

  app.post('/p2p/trades/:id/dispute', authMiddleware, async (req, res) => {
    try {
      const row = await getP2pTradeById(req.params.id);
      if (!row) return res.status(404).json({ message: 'Trade not found' });
      const isParty =
        String(row.merchant_user_id) === String(req.userId) ||
        String(row.counterparty_user_id) === String(req.userId);
      if (!isParty) return res.status(403).json({ message: 'Forbidden' });
      if (row.status === 'completed' || row.status === 'cancelled' || row.status === 'disputed') {
        return res.status(400).json({ message: 'This trade cannot be disputed.' });
      }
      if (row.status !== 'awaiting_fiat' && row.status !== 'fiat_sent') {
        return res.status(400).json({ message: 'This trade cannot be disputed in its current state.' });
      }

      const note = String(req.body.note || req.body.disputeNote || '').trim().slice(0, 500);
      const updated = await updateP2pTrade(row.id, {
        status: 'disputed',
        disputed_at: new Date().toISOString(),
        disputed_by_user_id: req.userId,
        dispute_note: note,
      });

      return res.json({
        trade: tradeToApi(updated, req.userId),
        message:
          'Your report was submitted. USDT stays in escrow while we review. You can also contact support with your trade ID.',
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e.message || 'Failed to open dispute' });
    }
  });

  app.post('/p2p/trades/:id/cancel', authMiddleware, async (req, res) => {
    try {
      const row = await getP2pTradeById(req.params.id);
      if (!row) return res.status(404).json({ message: 'Trade not found' });
      const isParty =
        String(row.merchant_user_id) === String(req.userId) ||
        String(row.counterparty_user_id) === String(req.userId);
      if (!isParty) return res.status(403).json({ message: 'Forbidden' });
      if (row.status === 'completed' || row.status === 'cancelled') {
        return res.status(400).json({ message: 'Trade cannot be cancelled.' });
      }
      if (row.status === 'fiat_sent') {
        return res.status(400).json({
          message: 'Fiat was already marked sent. Open a dispute on the trade screen if you need help.',
        });
      }

      if (row.ledger_escrow_posted) {
        await refundP2pEscrow({
          senderId: row.usdt_sender_id,
          amount: row.crypto_amount,
          tradeId: row.id,
          newId,
        });
      }

      const updated = await updateP2pTrade(row.id, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      });
      return res.json({
        trade: tradeToApi(updated, req.userId),
        message: 'Trade cancelled. USDT returned to the seller.',
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e.message || 'Failed to cancel trade' });
    }
  });
}

module.exports = { registerP2pRoutes, profileToApi, tradeToApi, toClientStatus };
