const crypto = require('crypto');
const {
  getUserById,
  getComplianceProfileByUserId,
  getCryptoBalancesByUserId,
  insertCryptoLedgerEntry,
  insertLocalMoneyOrder,
  updateLocalMoneyOrder,
  listLocalMoneyOrdersByUserId,
  getLocalMoneyOrderByReference,
  getLocalMoneyOrderByChargeId,
  isMissingTableError,
} = require('./db');
const { COMPLETED_STATUSES, fulfillLocalMoneyOrder } = require('./localMoneyFulfillment');
const { verifyUserTotp } = require('./totpVerify');
const { requireComplianceProfile } = require('./middleware/requireComplianceProfile');
const {
  getRegion,
  fiatFromUsdt,
  usdtFromFiat,
  normalizePhone,
  maskPhone,
  listPublicRegions,
  REGIONS,
} = require('./localMoneyRegions');
const flutterwave = require('./services/flutterwaveClient');
const { sendSms } = require('./services/twilioSms');
const {
  MIN_MOMO_USDT,
  totalUsdtFamilyAvailable,
  maxWithdrawableUsdt,
  minFiatForMomo,
  debitUsdtFamily,
  canonicalUsdtAsset,
} = require('./usdtBalances');

const SCHEMA_MSG =
  'Local money schema missing. Run backend/sql/migrations/20260519_local_mobile_money.sql in Supabase.';

function newId() {
  return crypto.randomUUID();
}

/** Map internal statuses to client-safe labels (no admin/approval wording). */
function toClientOrderStatus(row) {
  const s = String(row.status || '').toLowerCase();
  if (row.type === 'withdraw') {
    if (s === 'awaiting_approval' || s === 'pending') return 'submitted';
    if (s === 'processing') return 'processing';
    if (COMPLETED_STATUSES.has(s)) return 'completed';
    if (s === 'failed' || s === 'cancelled' || s === 'canceled' || s === 'rejected') return 'failed';
    return 'processing';
  }
  if (s === 'awaiting_approval') return 'pending';
  if (COMPLETED_STATUSES.has(s)) return 'completed';
  if (s === 'failed' || s === 'cancelled' || s === 'canceled') return 'failed';
  return s || 'pending';
}

function toPublicOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    countryCode: row.country_code,
    fiatCurrency: row.fiat_currency,
    fiatAmount: Number(row.fiat_amount),
    cryptoAsset: row.crypto_asset,
    cryptoAmount: row.crypto_amount != null ? Number(row.crypto_amount) : null,
    phoneMasked: maskPhone(row.phone),
    status: toClientOrderStatus(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function registerLocalMoneyRoutes(app, { authMiddleware }) {
  app.get('/local-money/regions', (_req, res) => {
    res.json({ regions: listPublicRegions() });
  });

  app.get('/local-money/config', authMiddleware, async (req, res) => {
    try {
      const countryCode = String(req.query.countryCode || req.query.country || '').toUpperCase();
      const region = getRegion(countryCode);
      if (!region) {
        return res.json({
          supported: false,
          countryCode,
          message: 'Phone money is not available in your region.',
          regions: listPublicRegions(),
        });
      }
      return res.json({
        supported: true,
        region,
        usdtPairLabel: `USDT / ${region.fiatLabel}`,
      });
    } catch (e) {
      return res.status(500).json({ message: e.message || 'Failed to load config' });
    }
  });

  app.get('/local-money/orders', authMiddleware, async (req, res) => {
    try {
      const rows = await listLocalMoneyOrdersByUserId(req.userId, 40);
      return res.json({ orders: rows.map(toPublicOrder) });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e.message || 'Failed to load orders' });
    }
  });

  app.post(
    '/local-money/deposit',
    authMiddleware,
    requireComplianceProfile,
    async (req, res) => {
      try {
        const countryCode = String(req.body.countryCode || '').toUpperCase();
        const regionDef = REGIONS[countryCode];
        const region = getRegion(countryCode);
        if (!region || !regionDef) {
          return res.status(400).json({ message: 'Pay-in is not available in your region.' });
        }

        const fiatAmount = Number(req.body.fiatAmount);
        const minFiat = minFiatForMomo(regionDef);
        if (!Number.isFinite(fiatAmount) || fiatAmount < minFiat) {
          return res.status(400).json({
            message: `Minimum pay-in is ${MIN_MOMO_USDT} USDT (~${minFiat.toLocaleString()} ${region.fiatLabel}).`,
          });
        }

        const profile = await getComplianceProfileByUserId(req.userId);
        const phoneRaw = String(req.body.phone || profile?.phone || '').trim();
        const phone = normalizePhone(phoneRaw, regionDef.dialCode);
        if (!phone) {
          return res.status(400).json({ message: 'Enter a valid mobile number.' });
        }

        const user = await getUserById(req.userId);
        const cryptoAmount = usdtFromFiat(fiatAmount, regionDef);
        if (!Number.isFinite(cryptoAmount) || cryptoAmount < MIN_MOMO_USDT) {
          return res.status(400).json({
            message: `Minimum pay-in is ${MIN_MOMO_USDT} USDT (~${minFiat.toLocaleString()} ${region.fiatLabel}).`,
          });
        }
        const orderId = newId();
        const reference = orderId;

        let order = await insertLocalMoneyOrder({
          id: orderId,
          user_id: req.userId,
          type: 'deposit',
          country_code: countryCode,
          fiat_currency: region.fiatCurrency,
          fiat_amount: fiatAmount,
          crypto_asset: 'usdt',
          crypto_amount: cryptoAmount,
          phone,
          status: 'pending',
          provider_reference: reference,
        });

        let chargeStatus = 'pending';
        let chargeId = null;
        try {
          const fw = await flutterwave.collectMobileMoneyDeposit({
            email: user?.email,
            phoneDigits: phone,
            dialCode: regionDef.dialCode,
            network: regionDef.mobileNetwork,
            amount: fiatAmount,
            currency: region.fiatCurrency,
            firstName: profile?.legal_first_name,
            lastName: profile?.legal_last_name,
          });
          chargeId = fw.chargeId;
          chargeStatus = fw.status || 'pending';
          order = await updateLocalMoneyOrder(orderId, {
            provider_charge_id: chargeId,
            provider_reference: fw.reference || reference,
            provider_payload: fw.raw || null,
            status: chargeStatus === 'successful' || chargeStatus === 'completed' ? 'completed' : 'awaiting_approval',
          });
        } catch (fwErr) {
          await updateLocalMoneyOrder(orderId, {
            status: 'failed',
            provider_payload: { error: String(fwErr.message || fwErr) },
          });
          return res.status(502).json({
            message: 'Could not start mobile payment. Try again in a moment.',
          });
        }

        const smsBody = `Min: Pay-in of ${fiatAmount} ${region.fiatLabel} started. Approve the prompt on your phone to finish.`;
        try {
          await sendSms(phone, smsBody);
        } catch {
          // non-fatal
        }

        if (COMPLETED_STATUSES.has(String(order.status).toLowerCase())) {
          await fulfillLocalMoneyOrder(order, 'completed');
        }

        return res.status(201).json({
          order: toPublicOrder(order),
          message:
            'Pay-in started. Approve the prompt on your phone. We text you when USDT is in your wallet.',
        });
      } catch (e) {
        if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
        return res.status(500).json({ message: e.message || 'Pay-in failed' });
      }
    }
  );

  app.post(
    '/local-money/withdraw',
    authMiddleware,
    requireComplianceProfile,
    async (req, res) => {
      try {
        const totp = await verifyUserTotp(req.userId, req.body.totpCode, { required: true });
        if (!totp.ok) {
          return res.status(totp.status || 400).json({
            message: totp.message,
            code: totp.code,
          });
        }

        const countryCode = String(req.body.countryCode || '').toUpperCase();
        const regionDef = REGIONS[countryCode];
        const region = getRegion(countryCode);
        if (!region || !regionDef) {
          return res.status(400).json({
            message: 'Cash-out to phone money is not available in your region.',
          });
        }

        let cryptoAmount = Number(req.body.cryptoAmount);
        const fiatInput = Number(req.body.fiatAmount);
        if ((!Number.isFinite(cryptoAmount) || cryptoAmount <= 0) && Number.isFinite(fiatInput) && fiatInput > 0) {
          cryptoAmount = usdtFromFiat(fiatInput, regionDef);
        }
        if (!Number.isFinite(cryptoAmount) || cryptoAmount < MIN_MOMO_USDT) {
          return res.status(400).json({
            message: `Minimum cash-out is ${MIN_MOMO_USDT} USDT.`,
          });
        }

        const balances = await getCryptoBalancesByUserId(req.userId);
        const available = totalUsdtFamilyAvailable(balances);
        const maxW = maxWithdrawableUsdt(available);
        if (cryptoAmount > maxW) {
          return res.status(400).json({
            message: `Not enough balance. You can cash out up to ${Math.floor(maxW)} USDT.`,
          });
        }

        const profile = await getComplianceProfileByUserId(req.userId);
        const phoneRaw = String(req.body.phone || profile?.phone || '').trim();
        const phone = normalizePhone(phoneRaw, regionDef.dialCode);
        if (!phone) {
          return res.status(400).json({ message: 'Enter a valid mobile number.' });
        }

        const fiatAmount = fiatFromUsdt(cryptoAmount, regionDef);
        if (!fiatAmount) {
          return res.status(400).json({ message: 'Could not convert amount.' });
        }

        const orderId = newId();
        let order = await insertLocalMoneyOrder({
          id: orderId,
          user_id: req.userId,
          type: 'withdraw',
          country_code: countryCode,
          fiat_currency: region.fiatCurrency,
          fiat_amount: fiatAmount,
          crypto_asset: 'usdt',
          crypto_amount: cryptoAmount,
          phone,
          status: 'awaiting_approval',
          provider_reference: orderId,
        });

        await debitUsdtFamily({
          userId: req.userId,
          amount: cryptoAmount,
          source: 'local_withdraw',
          sourceId: orderId,
          insertCryptoLedgerEntry,
          getCryptoBalancesByUserId,
          newId,
        });
        order = await updateLocalMoneyOrder(orderId, { ledger_posted: true });

        const smsBody = `Min: Cash-out request for about ${fiatAmount.toLocaleString()} ${region.fiatLabel} (${cryptoAmount} USDT) received. We text ${maskPhone(phone)} when the money is on the way.`;
        try {
          await sendSms(phone, smsBody);
        } catch {
          /* non-fatal */
        }

        return res.status(201).json({
          order: toPublicOrder(order),
          fiatAmount,
          fiatLabel: region.fiatLabel,
          message: `Cash-out queued. About ${fiatAmount.toLocaleString()} ${region.fiatLabel} will go to ${maskPhone(phone)}. Watch for an SMS update.`,
        });
      } catch (e) {
        if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
        return res.status(500).json({ message: e.message || 'Cash-out failed' });
      }
    }
  );

}

async function handleFlutterwaveWebhook(req, res) {
  const secret = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
  if (secret) {
    const provided = req.headers['verif-hash'] || req.headers['x-flutterwave-signature'];
    if (provided !== secret) return res.status(401).json({ message: 'Invalid signature' });
  }

  try {
    const body = req.body || {};
    const data = body.data || body;
    const chargeId = data.id || data.charge_id;
    const reference = data.reference || data.tx_ref;
    const status = String(data.status || body.status || '').toLowerCase();

    let order =
      (chargeId && (await getLocalMoneyOrderByChargeId(chargeId))) ||
      (reference && (await getLocalMoneyOrderByReference(reference)));

    if (!order) return res.json({ ok: true, ignored: true });

    if (COMPLETED_STATUSES.has(status)) {
      await fulfillLocalMoneyOrder(order, 'completed', body);
    } else if (['failed', 'cancelled', 'canceled'].includes(status)) {
      await fulfillLocalMoneyOrder(order, 'failed', body);
    } else {
      await updateLocalMoneyOrder(order.id, {
        status: status || 'processing',
        provider_payload: body,
      });
    }

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: e.message || 'Webhook failed' });
  }
}

module.exports = { registerLocalMoneyRoutes, handleFlutterwaveWebhook };
