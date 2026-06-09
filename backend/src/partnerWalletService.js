const crypto = require('crypto');
const {
  insertNowpaymentsPayment,
  getNowpaymentsPaymentForUser,
  listNowpaymentsPaymentsByUserId,
  getNowpaymentsPayoutForUser,
  listNowpaymentsPayoutsByUserId,
  listCryptoLedgerEntriesByUserId,
  getCryptoBalancesByUserId,
  isAddressWhitelistedForUser,
  getComplianceProfileByUserId,
  isMissingTableError,
} = require('./db');
const np = require('./services/nowpaymentsClient');
const { normalizeCurrency } = require('./currencyNormalize');
const { getCombinedWithdrawable, getCashWalletUsd } = require('./walletFunding');
const { createPayoutAwaitingApproval } = require('./nowpaymentsPayoutFlow');
const { clearWithdrawalTrustScoreCache } = require('./services/withdrawalTrustScore');
const { buildWalletActivity, mapPublicActivity } = require('./walletActivity');
const { isComplianceProfileComplete } = require('./complianceProfile');
const {
  syncUncreditedPaymentsForUser,
  syncPaymentFromProvider,
  creditPaymentLedger,
  syncPendingPayoutsForUser,
  publicPayoutStatus,
  roundPayoutAmount,
  isPaymentFinished,
} = require('./nowpaymentsRoutes');

function newId() {
  return crypto.randomUUID();
}

function webhookBaseUrl() {
  return (process.env.APP_BASE_URL || '').replace(/\/+$/, '');
}

function paymentIpnUrl() {
  const base = webhookBaseUrl();
  return base ? `${base}/webhooks/nowpayments/payment` : '';
}

function mapDepositPublic(row) {
  return {
    id: row.id,
    paymentId: row.payment_id,
    orderId: row.order_id,
    status: row.payment_status,
    payCurrency: row.pay_currency,
    payAmount: row.pay_amount,
    payAddress: row.pay_address,
    priceAmount: row.price_amount,
    priceCurrency: row.price_currency,
    ledgerCredited: row.ledger_credited,
    createdAt: row.created_at,
  };
}

function mapWithdrawalPublic(row) {
  return {
    id: row.id,
    payoutId: row.payout_id,
    batchPayoutId: row.batch_payout_id,
    status: publicPayoutStatus(row.status),
    currency: row.currency,
    address: row.address,
    amount: row.amount,
    cashFunded: Number(row.cash_funded_amount || 0),
    createdAt: row.created_at,
  };
}

async function assertComplianceComplete(userId) {
  const row = await getComplianceProfileByUserId(userId);
  if (!isComplianceProfileComplete(row)) {
    const err = new Error('Complete compliance profile before withdrawing.');
    err.statusCode = 403;
    err.code = 'COMPLIANCE_PROFILE_REQUIRED';
    throw err;
  }
}

async function buildPartnerWalletSummary(userId) {
  if (np.configured()) {
    await syncUncreditedPaymentsForUser(userId);
    await syncPendingPayoutsForUser(userId);
  }
  const balances = await getCryptoBalancesByUserId(userId);
  const cashWalletUsd = await getCashWalletUsd(userId);
  const usdtFunding = await getCombinedWithdrawable(userId, 'usdttrc20');
  const payments = await listNowpaymentsPaymentsByUserId(userId, 20);
  const payouts = await listNowpaymentsPayoutsByUserId(userId, 20);
  const ledger = await listCryptoLedgerEntriesByUserId(userId, 40);
  const payoutsForActivity = payouts.map((p) => ({ ...p, status: publicPayoutStatus(p.status) }));
  const activity = buildWalletActivity({ ledger, payments, payouts: payoutsForActivity });
  return {
    balances,
    cashWalletUsd,
    maxWithdrawableUsdt: usdtFunding.maxWithdrawable,
    cashFundsCryptoWithdrawals: true,
    activity: activity.map(mapPublicActivity),
    payments: payments.map(mapDepositPublic),
    payouts: payouts.map(mapWithdrawalPublic),
    configured: np.configured(),
    payoutConfigured: np.payoutAuthConfigured(),
  };
}

async function createPartnerDeposit(userId, { priceAmount, priceCurrency, payCurrency }) {
  if (!np.configured()) {
    const err = new Error('NOWPayments is not configured on the server.');
    err.statusCode = 503;
    throw err;
  }

  const amount = Number(priceAmount);
  const priceCur = String(priceCurrency || 'usd').toLowerCase();
  const payCur = normalizeCurrency(payCurrency);
  if (!amount || amount <= 0) {
    const err = new Error('Invalid priceAmount');
    err.statusCode = 400;
    throw err;
  }
  if (!payCur) {
    const err = new Error('payCurrency is required');
    err.statusCode = 400;
    throw err;
  }

  const orderId = `ema-${userId}-${newId()}`;
  const ipnUrl = paymentIpnUrl();
  const npBody = {
    price_amount: amount,
    price_currency: priceCur,
    pay_currency: payCur,
    order_id: orderId,
    order_description: 'Partner wallet deposit',
  };
  if (ipnUrl) npBody.ipn_callback_url = ipnUrl;

  const created = await np.createPayment(npBody);
  const row = await insertNowpaymentsPayment({
    id: newId(),
    user_id: userId,
    payment_id: created.payment_id != null ? String(created.payment_id) : null,
    order_id: orderId,
    price_amount: amount,
    price_currency: priceCur,
    pay_currency: payCur,
    pay_amount: created.pay_amount != null ? String(created.pay_amount) : null,
    pay_address: created.pay_address || null,
    payment_status: created.payment_status || 'waiting',
    actually_paid: created.actually_paid != null ? String(created.actually_paid) : null,
    outcome_amount: created.outcome_amount != null ? String(created.outcome_amount) : null,
    outcome_currency: created.outcome_currency != null ? String(created.outcome_currency) : null,
    ledger_credited: false,
    raw_last_ipn: created,
  });

  return {
    deposit: mapDepositPublic(row),
    expirationEstimateDate: created.expiration_estimate_date || null,
  };
}

async function getPartnerDeposit(userId, depositId) {
  const row = await getNowpaymentsPaymentForUser(userId, depositId);
  if (!row) return null;

  if (np.configured() && row.payment_id) {
    try {
      const updated = await syncPaymentFromProvider(row);
      return mapDepositPublic(updated);
    } catch {
      // fall through
    }
  }

  if (isPaymentFinished(row.payment_status) && !row.ledger_credited) {
    const credited = await creditPaymentLedger(row);
    return mapDepositPublic(credited);
  }

  return mapDepositPublic(row);
}

async function listPartnerDeposits(userId, limit = 20) {
  const rows = await listNowpaymentsPaymentsByUserId(userId, limit);
  return rows.map(mapDepositPublic);
}

async function createPartnerWithdrawal(userId, { currency, address, amount: amountRaw }) {
  if (!np.configured()) {
    const err = new Error('NOWPayments is not configured on the server.');
    err.statusCode = 503;
    throw err;
  }
  if (!np.payoutAuthConfigured()) {
    const err = new Error('Withdrawals are not fully enabled on the server yet.');
    err.statusCode = 503;
    err.code = 'PAYOUT_NOT_CONFIGURED';
    throw err;
  }

  await assertComplianceComplete(userId);

  const cur = normalizeCurrency(currency);
  const addr = String(address || '').trim();
  const amount = roundPayoutAmount(amountRaw);
  if (!cur) {
    const err = new Error('currency is required');
    err.statusCode = 400;
    throw err;
  }
  if (!addr) {
    const err = new Error('address is required');
    err.statusCode = 400;
    throw err;
  }
  if (!amount) {
    const err = new Error('Invalid amount');
    err.statusCode = 400;
    throw err;
  }

  const whitelisted = await isAddressWhitelistedForUser(userId, cur, addr);
  if (!whitelisted) {
    const err = new Error('Withdrawal address must be whitelisted for this user.');
    err.statusCode = 400;
    err.code = 'WALLET_NOT_WHITELISTED';
    throw err;
  }

  const fundingPreview = await getCombinedWithdrawable(userId, cur);
  if (amount > fundingPreview.maxWithdrawable) {
    const err = new Error(
      `Not enough balance. Max withdrawable: ${fundingPreview.maxWithdrawable.toFixed(6)}.`
    );
    err.statusCode = 400;
    err.details = {
      available: fundingPreview.combinedAvailable,
      maxWithdrawable: fundingPreview.maxWithdrawable,
      cryptoAvailable: fundingPreview.cryptoAvailable,
      cashWalletUsd: fundingPreview.cashWalletUsd,
      requested: amount,
    };
    throw err;
  }

  let payoutRow;
  try {
    payoutRow = await createPayoutAwaitingApproval({
      userId,
      currency: cur,
      address: addr,
      amount,
    });
  } catch (e) {
    if (e.details) {
      const err = new Error(e.message || 'Insufficient balance after funding');
      err.statusCode = 400;
      err.details = e.details;
      throw err;
    }
    throw e;
  }

  clearWithdrawalTrustScoreCache(userId);

  return {
    withdrawal: mapWithdrawalPublic(payoutRow),
    message: 'Withdrawal submitted for processing.',
  };
}

async function getPartnerWithdrawal(userId, withdrawalId) {
  const row = await getNowpaymentsPayoutForUser(userId, withdrawalId);
  if (!row) return null;
  return mapWithdrawalPublic(row);
}

async function listPartnerWithdrawals(userId, limit = 20) {
  const rows = await listNowpaymentsPayoutsByUserId(userId, limit);
  return rows.map(mapWithdrawalPublic);
}

module.exports = {
  buildPartnerWalletSummary,
  createPartnerDeposit,
  getPartnerDeposit,
  listPartnerDeposits,
  createPartnerWithdrawal,
  getPartnerWithdrawal,
  listPartnerWithdrawals,
  isMissingTableError,
};
