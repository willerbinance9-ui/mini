const crypto = require('crypto');
const {
  getActiveVipInvestmentForUser,
  getVipInvestmentById,
  updateVipInvestment,
  ensureWalletForUser,
  setWalletBalance,
  createTransaction,
  insertVipExitRequest,
  getVipExitRequestById,
  updateVipExitRequest,
  listVipExitRequestsForUser,
  getPendingVipExitRequestForUser,
  listVipExitRequestsAdmin,
  getUsersByIds,
  getOpenVipLoanForUser,
  VIP_EXIT_REVENUE_PERCENTS,
  VIP_EXIT_PENALTY_RATE,
  VIP_EXIT_COMMISSION_RATE,
  VIP_GAS_RATE_PER_CHARGE,
  VIP_GAS_CHARGES_PER_DAY,
  VIP_GAS_REWARD_RATE,
  VIP_GAS_DEFAULT_WORKING_DAYS,
  VIP_INVESTMENT_EXTRA_CREDIT_USD,
  VIP_INVESTMENT_EXTRA_CREDIT_MIN_PRINCIPAL_USD,
  VIP_INVESTMENT_EXTRA_CREDIT_MIN_WORKING_DAYS,
  VIP_ACCRUAL_MAX_WORKING_DAYS,
  VIP_LOCK_DAYS_CALENDAR,
  vipPenaltyFreeToday,
  vipCalendarDaysSinceStart,
  vipInvestmentToApi,
  vipExitRequestToApi,
  createAppNotification,
} = require('./db');
const { deliverUserAlert } = require('./depositNotifications');

function newId() {
  return crypto.randomUUID();
}

function roundUsd(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function isValidTrc20Address(addr) {
  const s = String(addr || '').trim();
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(s);
}

function normalizePayload(body = {}) {
  const mode = String(body.mode || '').trim().toLowerCase();
  const revenuePercent = Number(body.revenuePercent ?? body.revenue_percent);
  const destination = String(body.destination || '').trim().toLowerCase();
  const walletAddress = body.walletAddress != null ? String(body.walletAddress).trim() : '';
  return { mode, revenuePercent, destination, walletAddress };
}

function validatePayload({ mode, revenuePercent, destination, walletAddress }) {
  if (!['full_stop', 'partial_continue'].includes(mode)) {
    throw badRequest('mode must be full_stop or partial_continue');
  }
  if (!VIP_EXIT_REVENUE_PERCENTS.includes(revenuePercent)) {
    throw badRequest('revenuePercent must be one of 50, 60, 70, 80, 90, 100');
  }
  if (!['platform', 'direct_wallet'].includes(destination)) {
    throw badRequest('destination must be platform or direct_wallet');
  }
  if (destination === 'direct_wallet' && !isValidTrc20Address(walletAddress)) {
    throw badRequest('Enter a valid TRC20 wallet address');
  }
}

function qualifiesForInvestmentExtraCredit(principalUsd, workingDays) {
  return (
    Number(principalUsd) > VIP_INVESTMENT_EXTRA_CREDIT_MIN_PRINCIPAL_USD &&
    Number(workingDays) > VIP_INVESTMENT_EXTRA_CREDIT_MIN_WORKING_DAYS
  );
}

function computeBreakdown(inv, { mode, revenuePercent }) {
  const principal = roundUsd(inv.principal_usd);
  const workingDays = Number(inv.days_accrued || 0);
  const calendarDays = vipCalendarDaysSinceStart(inv.started_at);
  const penaltyFree = vipPenaltyFreeToday(inv);
  const revenueWithdrawn = roundUsd(inv.revenue_withdrawn_usd || 0);
  const revenueBase = roundUsd(Math.max(0, Number(inv.total_accrued_usd || 0) - revenueWithdrawn));
  const revenueSelected = roundUsd((revenueBase * revenuePercent) / 100);

  if (revenueSelected <= 0 && mode === 'partial_continue') {
    throw badRequest('No revenue available to withdraw');
  }

  const penalty = penaltyFree ? 0 : roundUsd(revenueSelected * VIP_EXIT_PENALTY_RATE);
  const gasWorkingDays = workingDays > 0 ? workingDays : VIP_GAS_DEFAULT_WORKING_DAYS;
  const gasFees = roundUsd(
    principal * VIP_GAS_RATE_PER_CHARGE * VIP_GAS_CHARGES_PER_DAY * gasWorkingDays
  );
  const commission = roundUsd(revenueSelected * VIP_EXIT_COMMISSION_RATE);
  const gasReward = roundUsd(gasFees * VIP_GAS_REWARD_RATE);
  const netRevenue = roundUsd(
    Math.max(0, revenueSelected - penalty - gasFees - commission + gasReward)
  );
  const principalReturn = mode === 'full_stop' ? principal : 0;
  const investmentExtraCreditUsd = qualifiesForInvestmentExtraCredit(principal, workingDays)
    ? VIP_INVESTMENT_EXTRA_CREDIT_USD
    : 0;
  const netTotal = roundUsd(netRevenue + principalReturn + investmentExtraCreditUsd);

  return {
    principalUsd: principal,
    revenueBaseUsd: revenueBase,
    revenueSelectedUsd: revenueSelected,
    penaltyUsd: penalty,
    gasFeesUsd: gasFees,
    commissionUsd: commission,
    gasRewardUsd: gasReward,
    netRevenueUsd: netRevenue,
    principalReturnUsd: principalReturn,
    investmentExtraCreditUsd,
    investmentExtraCreditEligible: investmentExtraCreditUsd > 0,
    netTotalUsd: netTotal,
    workingDays,
    calendarDays,
    penaltyFree,
    gasWorkingDays,
    lockDaysWorking: VIP_ACCRUAL_MAX_WORKING_DAYS,
    lockDaysCalendar: VIP_LOCK_DAYS_CALENDAR,
  };
}

function investmentExtraCreditDescription(breakdown) {
  if (breakdown.investmentExtraCreditUsd > 0) {
    return `You earn ${fmtUsdLabel(breakdown.investmentExtraCreditUsd)} investment extra credit — a bonus for investing with us (principal over ${fmtUsdLabel(VIP_INVESTMENT_EXTRA_CREDIT_MIN_PRINCIPAL_USD)} and more than ${VIP_INVESTMENT_EXTRA_CREDIT_MIN_WORKING_DAYS} working days). This is not part of your locked principal and is included in your total payout.`;
  }
  return `Investment extra credit of ${fmtUsdLabel(VIP_INVESTMENT_EXTRA_CREDIT_USD)} applies when your initial investment is over ${fmtUsdLabel(VIP_INVESTMENT_EXTRA_CREDIT_MIN_PRINCIPAL_USD)} and you have more than ${VIP_INVESTMENT_EXTRA_CREDIT_MIN_WORKING_DAYS} working accrual days. You do not qualify on this exit.`;
}

function quoteToApi(breakdown, inv, extras = {}) {
  return {
    investment: vipInvestmentToApi(inv),
    mode: extras.mode,
    revenuePercent: extras.revenuePercent,
    destination: extras.destination,
    walletAddress: extras.walletAddress || null,
    ...breakdown,
    gasFeeDescription:
      'We charge 0.0396% forty times per working day, reflecting the $2.30 TRC20 network cost of returning crypto to your wallet daily.',
    commissionDescription: '30% commission on the revenue amount you withdraw.',
    gasRewardDescription: '30% reward on gas fees charged during your investment period.',
    investmentExtraCreditDescription: investmentExtraCreditDescription(breakdown),
    penaltyDescription: breakdown.penaltyFree
      ? 'No penalty today — you are on a penalty-free exit day (day 22 working or day 38 calendar).'
      : `A 30% penalty on withdrawn revenue may apply because today is not day ${VIP_ACCRUAL_MAX_WORKING_DAYS} (working) or day ${VIP_LOCK_DAYS_CALENDAR} (calendar). Penalty fees may be lifted when your request is reviewed.`,
    thankYouMessage: 'Thank you for investing with us.',
  };
}

function fmtUsdLabel(n) {
  return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

async function assertNoOpenVipLoan(userId) {
  const open = await getOpenVipLoanForUser(userId);
  if (!open) return;
  throw badRequest(
    open.status === 'pending'
      ? 'VIP farming withdrawals are locked while your VIP loan request is awaiting disbursement. Wait until the loan is repaid to exit VIP.'
      : `VIP farming withdrawals are locked until your VIP loan is fully repaid ($${roundUsd(open.outstanding_usd).toFixed(2)} outstanding).`
  );
}

async function computeVipExitQuote(userId, body) {
  const payload = normalizePayload(body);
  validatePayload(payload);

  await assertNoOpenVipLoan(userId);

  const inv = await getActiveVipInvestmentForUser(userId);
  if (!inv) throw badRequest('No active VIP investment');

  const pending = await getPendingVipExitRequestForUser(userId);
  if (pending) throw badRequest('You already have a withdrawal request being processed');

  const breakdown = computeBreakdown(inv, payload);
  return quoteToApi(breakdown, inv, payload);
}

async function submitVipExitRequest(userId, body) {
  await assertNoOpenVipLoan(userId);
  const quote = await computeVipExitQuote(userId, body);
  const inv = await getActiveVipInvestmentForUser(userId);
  if (!inv) throw badRequest('No active VIP investment');

  const row = await insertVipExitRequest({
    id: newId(),
    user_id: userId,
    investment_id: inv.id,
    mode: quote.mode,
    revenue_percent: quote.revenuePercent,
    destination: quote.destination,
    wallet_address: quote.destination === 'direct_wallet' ? quote.walletAddress : null,
    principal_usd: quote.principalUsd,
    revenue_base_usd: quote.revenueBaseUsd,
    revenue_selected_usd: quote.revenueSelectedUsd,
    penalty_usd: quote.penaltyUsd,
    gas_fees_usd: quote.gasFeesUsd,
    commission_usd: quote.commissionUsd,
    gas_reward_usd: quote.gasRewardUsd,
    net_revenue_usd: quote.netRevenueUsd,
    principal_return_usd: quote.principalReturnUsd,
    net_total_usd: quote.netTotalUsd,
    investment_extra_credit_usd: quote.investmentExtraCreditUsd,
    working_days: quote.workingDays,
    calendar_days: quote.calendarDays,
    penalty_free: quote.penaltyFree,
    status: 'pending',
  });

  return {
    request: vipExitRequestToApi(row),
    quote,
  };
}

async function listUserVipExitRequests(userId, limit = 20) {
  const rows = await listVipExitRequestsForUser(userId, limit);
  return { requests: rows.map((r) => vipExitRequestToApi(r)) };
}

async function listAdminVipExitRequests({ status = 'pending', limit = 200 } = {}) {
  const rows = await listVipExitRequestsAdmin({ status, limit });
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const users = await getUsersByIds(userIds);
  const emailById = new Map(users.map((u) => [u.id, u.email]));
  return {
    requests: rows.map((r) => vipExitRequestToApi(r, emailById.get(r.user_id))),
  };
}

function parseChargeOptions(body = {}) {
  return {
    applyPenalty: body.applyPenalty !== false,
    applyGasFees: body.applyGasFees !== false,
    applyCommission: body.applyCommission !== false,
    applyGasReward: body.applyGasReward !== false,
    applyInvestmentExtraCredit: body.applyInvestmentExtraCredit !== false,
  };
}

function readAppliedAmount(body, amountKey, applyKey, quoted) {
  if (body[applyKey] === false) return 0;
  if (body[amountKey] != null && body[amountKey] !== '') {
    const n = roundUsd(body[amountKey]);
    if (!Number.isFinite(n) || n < 0) {
      throw badRequest(`${amountKey} must be a non-negative amount`);
    }
    return n;
  }
  return roundUsd(quoted);
}

function resolveAppliedAmounts(req, body = {}) {
  const revenueSelected = roundUsd(req.revenue_selected_usd);
  const penalty = readAppliedAmount(body, 'penaltyUsd', 'applyPenalty', req.penalty_usd);
  const gasFees = readAppliedAmount(body, 'gasFeesUsd', 'applyGasFees', req.gas_fees_usd);
  const commission = readAppliedAmount(body, 'commissionUsd', 'applyCommission', req.commission_usd);
  const gasReward = readAppliedAmount(body, 'gasRewardUsd', 'applyGasReward', req.gas_reward_usd);
  const extraCredit = readAppliedAmount(
    body,
    'investmentExtraCreditUsd',
    'applyInvestmentExtraCredit',
    req.investment_extra_credit_usd
  );
  const principalReturn = req.mode === 'full_stop' ? roundUsd(req.principal_return_usd) : 0;
  const netRevenue = roundUsd(Math.max(0, revenueSelected - penalty - gasFees - commission + gasReward));
  const netTotal = roundUsd(netRevenue + principalReturn + extraCredit);
  return {
    revenueSelected,
    penalty,
    gasFees,
    commission,
    gasReward,
    extraCredit,
    principalReturn,
    netRevenue,
    netTotal,
  };
}

function computeApprovedTotals(req, chargeInput = {}) {
  const applied = resolveAppliedAmounts(req, chargeInput);
  return {
    ...applied,
    chargeOptions: parseChargeOptions(chargeInput),
  };
}

function formatUsd(n) {
  return '$' + Number(n || 0).toFixed(2);
}

function buildApprovalNotificationBody(req, applied) {
  const parts = ['Your VIP exit request was approved and processed.'];
  if (applied.revenueSelected > 0) {
    parts.push(`Revenue: ${formatUsd(applied.revenueSelected)}.`);
  }
  const deductions = [];
  if (applied.penalty > 0) deductions.push(`penalty ${formatUsd(applied.penalty)}`);
  if (applied.gasFees > 0) deductions.push(`gas fees ${formatUsd(applied.gasFees)}`);
  if (applied.commission > 0) deductions.push(`commission ${formatUsd(applied.commission)}`);
  if (deductions.length) parts.push(`Deductions applied: ${deductions.join(', ')}.`);
  const credits = [];
  if (applied.gasReward > 0) credits.push(`gas reward ${formatUsd(applied.gasReward)}`);
  if (applied.extraCredit > 0) credits.push(`investment credit ${formatUsd(applied.extraCredit)}`);
  if (credits.length) parts.push(`Credits applied: ${credits.join(', ')}.`);
  if (req.mode === 'full_stop' && applied.principalReturn > 0) {
    parts.push(`Principal returned: ${formatUsd(applied.principalReturn)}.`);
  }
  parts.push(`Net payout: ${formatUsd(applied.netTotal)}.`);
  if (req.destination === 'platform') {
    parts.push('Credited to your cash wallet.');
  } else {
    parts.push('Will be sent to your TRC20 wallet.');
  }
  return parts.join(' ');
}

function buildRejectionNotificationBody(adminNote) {
  const parts = ['Your VIP exit request was not approved.'];
  if (adminNote) parts.push(String(adminNote).trim());
  parts.push('Your VIP investment is unchanged. You may submit a new request when ready.');
  return parts.join(' ');
}

async function notifyVipExitOutcome(userId, title, body) {
  try {
    await deliverUserAlert({ userId, title, body });
  } catch (err) {
    console.error('[vip-exit] notification failed:', err.message);
    try {
      await createAppNotification({ userId, title, body });
    } catch (innerErr) {
      console.error('[vip-exit] in-app notification fallback failed:', innerErr.message);
    }
  }
}

async function previewApproveVipExitRequest(requestId, chargeOptionsInput = {}) {
  const req = await getVipExitRequestById(requestId);
  if (!req) throw badRequest('Request not found');
  if (req.status !== 'pending') throw badRequest('Request is not pending');
  const chargeOptions = parseChargeOptions(chargeOptionsInput);
  const applied = computeApprovedTotals(req, chargeOptions);
  return { request: vipExitRequestToApi(req), applied };
}

async function approveVipExitRequest(requestId, chargeOptionsInput = {}) {
  const req = await getVipExitRequestById(requestId);
  if (!req) throw badRequest('Request not found');
  if (req.status !== 'pending') throw badRequest('Request is not pending');

  const chargeOptions = parseChargeOptions(chargeOptionsInput);
  const applied = computeApprovedTotals(req, chargeOptions);
  const netTotal = applied.netTotal;
  const revenueSelected = applied.revenueSelected;

  const inv = await getVipInvestmentById(req.investment_id);
  if (!inv) throw badRequest('Investment not found');

  if (req.destination === 'platform' && netTotal > 0) {
    const wallet = await ensureWalletForUser(req.user_id);
    const cash = roundUsd(wallet?.balance);
    const nextCash = roundUsd(cash + netTotal);
    await setWalletBalance(req.user_id, nextCash);
    await createTransaction({
      userId: req.user_id,
      type: 'deposit',
      amount: netTotal,
      status: 'completed',
    });
  }

  const newRevenueWithdrawn = roundUsd(Number(inv.revenue_withdrawn_usd || 0) + revenueSelected);
  const invPatch = { revenueWithdrawnUsd: newRevenueWithdrawn };

  if (req.mode === 'full_stop') {
    invPatch.status = req.penalty_free ? 'closed' : 'early_withdrawn';
  }

  await updateVipInvestment(inv.id, invPatch);
  const reviewedAt = new Date().toISOString();
  await updateVipExitRequest(requestId, {
    status: 'completed',
    reviewedAt,
    appliedPenaltyUsd: applied.penalty,
    appliedGasFeesUsd: applied.gasFees,
    appliedCommissionUsd: applied.commission,
    appliedGasRewardUsd: applied.gasReward,
    appliedInvestmentExtraCreditUsd: applied.extraCredit,
    appliedNetRevenueUsd: applied.netRevenue,
    appliedNetTotalUsd: applied.netTotal,
  });

  await notifyVipExitOutcome(
    req.user_id,
    'VIP exit processed',
    buildApprovalNotificationBody(req, applied)
  );

  const updated = await getVipExitRequestById(requestId);
  return { request: vipExitRequestToApi(updated), applied, payout: netTotal };
}

async function rejectVipExitRequest(requestId, note) {
  const req = await getVipExitRequestById(requestId);
  if (!req) throw badRequest('Request not found');
  if (req.status !== 'pending') throw badRequest('Request is not pending');

  const adminNote = note ? String(note).trim() : null;
  const reviewedAt = new Date().toISOString();
  const updated = await updateVipExitRequest(requestId, {
    status: 'rejected',
    adminNote,
    reviewedAt,
  });

  await notifyVipExitOutcome(
    req.user_id,
    'VIP exit request declined',
    buildRejectionNotificationBody(adminNote)
  );

  return { request: vipExitRequestToApi(updated) };
}

module.exports = {
  computeVipExitQuote,
  submitVipExitRequest,
  listUserVipExitRequests,
  listAdminVipExitRequests,
  previewApproveVipExitRequest,
  approveVipExitRequest,
  rejectVipExitRequest,
  computeApprovedTotals,
  parseChargeOptions,
  resolveAppliedAmounts,
  VIP_EXIT_REVENUE_PERCENTS,
};
