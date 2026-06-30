const crypto = require('crypto');
const {
  ensureWalletForUser,
  setWalletBalance,
  getWalletByUserId,
  createTransaction,
  getActiveVipInvestmentForUser,
  getVipInvestmentById,
  createVipInvestment,
  updateVipInvestment,
  listActiveVipInvestments,
  getVipAccrualForInvestmentDay,
  insertVipAccrual,
  VIP_DAILY_RATE,
  VIP_LOCK_DAYS,
  VIP_LOCK_DAYS_CALENDAR,
  VIP_ACCRUAL_MAX_WORKING_DAYS,
  VIP_MIN_INVEST_USD,
  VIP_EARLY_PENALTY_RATE,
  vipInvestmentToApi,
  getPendingVipExitRequestForUser,
  vipExitRequestToApi,
  utcTodayYmd,
} = require('./db');
const {
  splitPlatformFee,
  recordPlatformRevenueIfNew,
  PLATFORM_FEE_VIP_RATE,
} = require('./platformRevenueService');

function newId() {
  return crypto.randomUUID();
}

function roundUsd(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function addDaysUtc(iso, days) {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** Saturday/Sunday UTC — no VIP daily payout. */
function isUtcWeekendYmd(ymd) {
  const parts = String(ymd || '').slice(0, 10).split('-').map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return false;
  const [y, m, d] = parts;
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
}

async function getVipSummary(userId) {
  const wallet = await ensureWalletForUser(userId);
  const cash = roundUsd(wallet?.balance);
  const inv = await getActiveVipInvestmentForUser(userId);
  const pendingExit = await getPendingVipExitRequestForUser(userId);
  return {
    cashWalletUsd: cash,
    minInvestUsd: VIP_MIN_INVEST_USD,
    dailyRate: VIP_DAILY_RATE,
    lockDays: VIP_LOCK_DAYS_CALENDAR,
    lockDaysCalendar: VIP_LOCK_DAYS_CALENDAR,
    lockDaysWorking: VIP_ACCRUAL_MAX_WORKING_DAYS,
    earlyPenaltyRate: VIP_EARLY_PENALTY_RATE,
    exitPenaltyRate: VIP_EARLY_PENALTY_RATE,
    investment: vipInvestmentToApi(inv),
    pendingExitRequest: pendingExit ? vipExitRequestToApi(pendingExit) : null,
  };
}

async function investVip(userId, amount) {
  const amt = roundUsd(amount);
  if (!Number.isFinite(amt) || amt < VIP_MIN_INVEST_USD) {
    const err = new Error(`Minimum investment is $${VIP_MIN_INVEST_USD}`);
    err.statusCode = 400;
    throw err;
  }

  const existing = await getActiveVipInvestmentForUser(userId);
  if (existing) {
    const err = new Error('You already have an active VIP Farmers investment');
    err.statusCode = 400;
    throw err;
  }

  const wallet = await ensureWalletForUser(userId);
  const cash = roundUsd(wallet?.balance);
  if (cash < amt) {
    const err = new Error('Insufficient cash wallet balance');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const maturesAt = addDaysUtc(now, VIP_LOCK_DAYS_CALENDAR);
  await setWalletBalance(userId, roundUsd(cash - amt));
  const row = await createVipInvestment({
    userId,
    principalUsd: amt,
    startedAt: now,
    maturesAt,
  });

  return { investment: vipInvestmentToApi(row), cashWalletUsd: roundUsd(cash - amt) };
}

async function addCapitalVip(userId, amount) {
  const amt = roundUsd(amount);
  if (!Number.isFinite(amt) || amt < VIP_MIN_INVEST_USD) {
    const err = new Error(`Minimum add is $${VIP_MIN_INVEST_USD}`);
    err.statusCode = 400;
    throw err;
  }

  const inv = await getActiveVipInvestmentForUser(userId);
  if (!inv) {
    const err = new Error('No active VIP investment to add capital to');
    err.statusCode = 400;
    throw err;
  }

  const wallet = await ensureWalletForUser(userId);
  const cash = roundUsd(wallet?.balance);
  if (cash < amt) {
    const err = new Error('Insufficient cash wallet balance');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const maturesAt = addDaysUtc(now, VIP_LOCK_DAYS_CALENDAR);
  const newPrincipal = roundUsd(Number(inv.principal_usd) + amt);
  await setWalletBalance(userId, roundUsd(cash - amt));
  const row = await updateVipInvestment(inv.id, {
    principalUsd: newPrincipal,
    startedAt: now,
    maturesAt,
    daysAccrued: 0,
    status: 'active',
  });

  return {
    investment: vipInvestmentToApi(row),
    cashWalletUsd: roundUsd(cash - amt),
    addedUsd: amt,
    lockReset: true,
  };
}

async function withdrawVipAtMaturity(userId) {
  const err = new Error('Use the VIP exit request flow in the app to withdraw.');
  err.statusCode = 400;
  throw err;
}

async function earlyWithdrawVip(userId) {
  const err = new Error('Use the VIP exit request flow in the app to withdraw.');
  err.statusCode = 400;
  throw err;
}

async function runVipDailyAccrual(planDate = utcTodayYmd()) {
  if (isUtcWeekendYmd(planDate)) {
    return {
      ok: true,
      planDate,
      weekendSkipped: true,
      investmentsChecked: 0,
      accrualsApplied: 0,
      skipped: 0,
    };
  }

  const rows = await listActiveVipInvestments();
  let applied = 0;
  let skipped = 0;

  for (const inv of rows) {
    if (Number(inv.days_accrued) >= VIP_ACCRUAL_MAX_WORKING_DAYS) {
      skipped += 1;
      continue;
    }
    const existing = await getVipAccrualForInvestmentDay(inv.id, planDate);
    if (existing) {
      skipped += 1;
      continue;
    }

    const principal = roundUsd(inv.principal_usd);
    const grossAmount = roundUsd(principal * VIP_DAILY_RATE);
    const { net: amount, fee: platformFee } = splitPlatformFee(grossAmount, PLATFORM_FEE_VIP_RATE);
    if (amount <= 0) {
      skipped += 1;
      continue;
    }

    const accrualId = newId();
    const wallet = await getWalletByUserId(inv.user_id);
    const cash = roundUsd(wallet?.balance);
    await setWalletBalance(inv.user_id, roundUsd(cash + amount));
    await createTransaction({
      userId: inv.user_id,
      type: 'deposit',
      amount,
      status: 'completed',
    });

    await insertVipAccrual({
      id: accrualId,
      investment_id: inv.id,
      user_id: inv.user_id,
      accrual_date: planDate,
      rate: VIP_DAILY_RATE,
      amount,
      created_at: new Date().toISOString(),
    });

    if (platformFee > 0) {
      await recordPlatformRevenueIfNew({
        eventType: 'vip_accrual',
        userId: inv.user_id,
        sourceId: accrualId,
        grossAmount,
        feeRate: PLATFORM_FEE_VIP_RATE,
        meta: { investmentId: inv.id, netPaidToUser: amount },
        eventAt: new Date().toISOString(),
      }).catch((e) => console.error('[platform-revenue/vip]', e));
    }

    await updateVipInvestment(inv.id, {
      totalAccruedUsd: roundUsd(Number(inv.total_accrued_usd) + amount),
      daysAccrued: Number(inv.days_accrued) + 1,
    });

    applied += 1;
  }

  return { ok: true, planDate, investmentsChecked: rows.length, accrualsApplied: applied, skipped };
}

module.exports = {
  getVipSummary,
  investVip,
  addCapitalVip,
  withdrawVipAtMaturity,
  earlyWithdrawVip,
  runVipDailyAccrual,
};
