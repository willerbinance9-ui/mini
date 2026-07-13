const crypto = require('crypto');
const {
  insertPlatformRevenueEvent,
  getPlatformRevenueEventBySource,
  listPlatformRevenueEventsAdmin,
  insertPlatformProfitWithdrawal,
  listPlatformProfitWithdrawalsAdmin,
  sumPlatformProfitWithdrawalsUsd,
  getUserById,
  utcTodayYmd,
} = require('./db');

const PLATFORM_FEE_DROP_RATE = 0.1;
const PLATFORM_FEE_WITHDRAW_RATE = 0.05;
const PLATFORM_FEE_VIP_RATE = 0.03;
const PARTNER_COMMISSION_RATE = 0.05;

function roundUsd(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function splitPlatformFee(grossAmount, feeRate) {
  const gross = roundUsd(grossAmount);
  if (gross <= 0) {
    return { gross: 0, fee: 0, net: 0, rate: feeRate };
  }
  const fee = roundUsd(gross * feeRate);
  const net = roundUsd(Math.max(0, gross - fee));
  return { gross, fee, net, rate: feeRate };
}

async function recordPlatformRevenueIfNew({
  eventType,
  userId,
  sourceId,
  grossAmount,
  feeRate,
  currency = 'USD',
  meta = null,
  eventAt = null,
}) {
  const sid = String(sourceId || '').trim();
  if (!sid) return null;
  const existing = await getPlatformRevenueEventBySource(eventType, sid);
  if (existing) return existing;

  const { gross, fee, net } = splitPlatformFee(grossAmount, feeRate);
  if (fee <= 0 && gross <= 0) return null;

  let partnerId = null;
  let partnerCommissionAmount = null;
  if (userId) {
    const user = await getUserById(userId).catch(() => null);
    if (user?.partner_id) {
      partnerId = user.partner_id;
      partnerCommissionAmount = roundUsd(gross * PARTNER_COMMISSION_RATE);
    }
  }

  return insertPlatformRevenueEvent({
    event_type: eventType,
    user_id: userId || null,
    partner_id: partnerId,
    partner_commission_amount: partnerCommissionAmount,
    source_id: sid,
    gross_amount: gross,
    fee_rate: feeRate,
    fee_amount: fee,
    net_amount: net,
    currency: String(currency || 'USD').toUpperCase(),
    meta,
    event_at: eventAt || new Date().toISOString(),
  });
}

function startOfUtcMonthYmd() {
  const today = utcTodayYmd();
  return `${today.slice(0, 7)}-01`;
}

function aggregateRevenueRows(rows) {
  const empty = () => ({ count: 0, grossUsd: 0, feeUsd: 0 });
  const totals = {
    all: empty(),
    today: empty(),
    month: empty(),
    byType: {
      airfarming_drop: empty(),
      withdrawal: empty(),
      vip_accrual: empty(),
      vip_loan_commission: empty(),
      vip_reinvest_commission: empty(),
    },
  };

  const today = utcTodayYmd();
  const monthStart = startOfUtcMonthYmd();

  for (const row of rows || []) {
    const fee = Number(row.fee_amount || 0);
    const gross = Number(row.gross_amount || 0);
    const at = String(row.event_at || '').slice(0, 10);
    const type = row.event_type;

    const bump = (bucket) => {
      bucket.count += 1;
      bucket.feeUsd = roundUsd(bucket.feeUsd + fee);
      bucket.grossUsd = roundUsd(bucket.grossUsd + gross);
    };

    bump(totals.all);
    if (at === today) bump(totals.today);
    if (at >= monthStart) bump(totals.month);
    if (!totals.byType[type]) totals.byType[type] = empty();
    bump(totals.byType[type]);
  }

  return totals;
}

async function getPlatformProfitBalance() {
  const rows = await listPlatformRevenueEventsAdmin({ limit: 10000 });
  const totalFeesUsd = roundUsd(rows.reduce((s, r) => s + Number(r.fee_amount || 0), 0));
  const withdrawnUsd = roundUsd(await sumPlatformProfitWithdrawalsUsd());
  const availableUsd = roundUsd(Math.max(0, totalFeesUsd - withdrawnUsd));
  return { totalFeesUsd, withdrawnUsd, availableUsd };
}

async function withdrawPlatformProfit({ amount, note, adminUsername }) {
  const amt = roundUsd(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    const err = new Error('Enter a valid amount greater than 0');
    err.statusCode = 400;
    throw err;
  }

  const balance = await getPlatformProfitBalance();
  if (amt > balance.availableUsd) {
    const err = new Error(
      `Insufficient platform profit. Available ${balance.availableUsd.toFixed(2)}, requested ${amt.toFixed(2)}.`
    );
    err.statusCode = 400;
    throw err;
  }

  const row = await insertPlatformProfitWithdrawal({
    id: crypto.randomUUID(),
    amount_usd: amt,
    note: note ? String(note).trim().slice(0, 500) : null,
    admin_username: String(adminUsername || 'superadmin').trim() || 'superadmin',
  });

  const next = await getPlatformProfitBalance();
  return {
    withdrawal: {
      id: row.id,
      amountUsd: Number(row.amount_usd),
      note: row.note,
      adminUsername: row.admin_username,
      createdAt: row.created_at,
    },
    balance: next,
    message: `Withdrew $${amt.toFixed(2)} from platform profit. Remaining available: $${next.availableUsd.toFixed(2)}.`,
  };
}

async function getPlatformRevenueAdminStats({ recentLimit = 80 } = {}) {
  const rows = await listPlatformRevenueEventsAdmin({ limit: 10000 });
  const recent = rows.slice(0, Math.min(recentLimit, rows.length));
  const withdrawals = await listPlatformProfitWithdrawalsAdmin({ limit: 50 });
  const balance = await getPlatformProfitBalance();

  return {
    rates: {
      airfarmingDrop: PLATFORM_FEE_DROP_RATE,
      withdrawal: PLATFORM_FEE_WITHDRAW_RATE,
      vipAccrual: PLATFORM_FEE_VIP_RATE,
    },
    summary: aggregateRevenueRows(rows),
    profitBalance: balance,
    recentWithdrawals: withdrawals.map((w) => ({
      id: w.id,
      amountUsd: Number(w.amount_usd),
      note: w.note,
      adminUsername: w.admin_username,
      createdAt: w.created_at,
    })),
    recent: recent.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      userId: r.user_id,
      sourceId: r.source_id,
      grossAmount: Number(r.gross_amount),
      feeRate: Number(r.fee_rate),
      feeAmount: Number(r.fee_amount),
      netAmount: Number(r.net_amount),
      currency: r.currency,
      eventAt: r.event_at,
      meta: r.meta || null,
    })),
  };
}

module.exports = {
  PLATFORM_FEE_DROP_RATE,
  PLATFORM_FEE_WITHDRAW_RATE,
  PLATFORM_FEE_VIP_RATE,
  PARTNER_COMMISSION_RATE,
  splitPlatformFee,
  recordPlatformRevenueIfNew,
  getPlatformRevenueAdminStats,
  getPlatformProfitBalance,
  withdrawPlatformProfit,
};
