const crypto = require('crypto');
const {
  ensureWalletForUser,
  setWalletBalance,
  createTransaction,
  getActiveVipInvestmentForUser,
  countVipAccrualDaysForUser,
  listVipAccrualsForUserBetween,
  getOpenVipLoanForUser,
  getVipLoanById,
  insertVipLoan,
  updateVipLoan,
  listVipLoansForUser,
  listVipLoansAdmin,
  insertVipLoanFundTransfer,
  sumActiveLoanTaintForRecipient,
  sumUserDepositsUsdBetween,
  getUsersByIds,
  vipLoanToApi,
  createAppNotification,
  isSchemaError,
  isMissingTableError,
  utcTodayYmd,
  VIP_LOAN_COMMISSION_RATE,
  VIP_LOAN_MIN_ACCRUAL_DAYS,
  VIP_LOAN_EARNINGS_WINDOW_DAYS,
  VIP_LOAN_APPROVAL_MAX_DAYS,
  VIP_LOAN_MIN_USD,
  VIP_LOAN_RECIPIENT_EXEMPT_DEPOSIT_USD,
  VIP_LOAN_RECIPIENT_DEPOSIT_WINDOW_DAYS,
} = require('./db');
const { recordPlatformRevenueIfNew } = require('./platformRevenueService');
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

function ymdDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Sum of VIP daily earnings over the last 30 days. */
async function getLastMonthVipEarnings(userId) {
  const rows = await listVipAccrualsForUserBetween(
    userId,
    ymdDaysAgo(VIP_LOAN_EARNINGS_WINDOW_DAYS),
    utcTodayYmd()
  );
  let total = 0;
  for (const row of rows) total += Number(row.amount || 0);
  return roundUsd(total);
}

/**
 * Loan eligibility + limits for a VIP farmer.
 * Eligible when they hold an active VIP investment and have completed at least
 * one full VIP working month (22 accrual days).
 */
async function getVipLoanStatus(userId) {
  const inv = await getActiveVipInvestmentForUser(userId);
  const accrualDays = await countVipAccrualDaysForUser(userId);
  const lastMonthEarningsUsd = await getLastMonthVipEarnings(userId);
  const monthCompleted = accrualDays >= VIP_LOAN_MIN_ACCRUAL_DAYS;
  const eligible = Boolean(inv) && monthCompleted && lastMonthEarningsUsd >= VIP_LOAN_MIN_USD;
  const openLoanRow = await getOpenVipLoanForUser(userId);
  const loans = await listVipLoansForUser(userId, 10);

  let ineligibleReason = null;
  if (!inv) {
    ineligibleReason = 'You need an active VIP Farmers investment to request a loan.';
  } else if (!monthCompleted) {
    ineligibleReason = `Loans unlock after a full VIP month (${VIP_LOAN_MIN_ACCRUAL_DAYS} working days). You have ${accrualDays}.`;
  } else if (lastMonthEarningsUsd < VIP_LOAN_MIN_USD) {
    ineligibleReason = 'You have no VIP earnings in the last month to borrow against.';
  }

  return {
    eligible,
    ineligibleReason,
    monthCompleted,
    accrualDays,
    minAccrualDays: VIP_LOAN_MIN_ACCRUAL_DAYS,
    lastMonthEarningsUsd,
    maxLoanUsd: lastMonthEarningsUsd,
    commissionRate: VIP_LOAN_COMMISSION_RATE,
    minLoanUsd: VIP_LOAN_MIN_USD,
    approvalMaxDays: VIP_LOAN_APPROVAL_MAX_DAYS,
    openLoan: vipLoanToApi(openLoanRow),
    loans: loans.map((l) => vipLoanToApi(l)),
    usageNote:
      'Loans are for use on the platform (farming, trading, or VIP). Withdrawals stay locked until the loan is fully repaid.',
  };
}

async function requestVipLoan(userId, amount) {
  const amt = roundUsd(amount);
  if (!Number.isFinite(amt) || amt < VIP_LOAN_MIN_USD) {
    throw badRequest(`Minimum loan is $${VIP_LOAN_MIN_USD}`);
  }

  const inv = await getActiveVipInvestmentForUser(userId);
  if (!inv) throw badRequest('You need an active VIP Farmers investment to request a loan.');

  const accrualDays = await countVipAccrualDaysForUser(userId);
  if (accrualDays < VIP_LOAN_MIN_ACCRUAL_DAYS) {
    throw badRequest(
      `Loans unlock after a full VIP month (${VIP_LOAN_MIN_ACCRUAL_DAYS} working days). You have ${accrualDays}.`
    );
  }

  const open = await getOpenVipLoanForUser(userId);
  if (open) {
    throw badRequest(
      open.status === 'pending'
        ? 'You already have a loan request awaiting approval.'
        : 'Repay your current loan in full before requesting a new one.'
    );
  }

  const lastMonthEarningsUsd = await getLastMonthVipEarnings(userId);
  if (amt > lastMonthEarningsUsd) {
    throw badRequest(
      `Maximum loan is your last month's VIP earnings ($${lastMonthEarningsUsd.toFixed(2)}).`
    );
  }

  const commission = roundUsd(amt * VIP_LOAN_COMMISSION_RATE);
  const disbursed = roundUsd(amt - commission);

  const row = await insertVipLoan({
    id: newId(),
    user_id: userId,
    investment_id: inv.id,
    amount_usd: amt,
    commission_rate: VIP_LOAN_COMMISSION_RATE,
    commission_usd: commission,
    disbursed_usd: disbursed,
    last_month_earnings_usd: lastMonthEarningsUsd,
    max_loan_usd: lastMonthEarningsUsd,
    outstanding_usd: amt,
    repaid_usd: 0,
    status: 'pending',
    requested_at: new Date().toISOString(),
  });

  return {
    loan: vipLoanToApi(row),
    message: `Loan request submitted. Approval can take up to ${VIP_LOAN_APPROVAL_MAX_DAYS} days. You will receive $${disbursed.toFixed(2)} after the 30% commission.`,
  };
}

async function repayVipLoan(userId, amount) {
  const open = await getOpenVipLoanForUser(userId);
  if (!open || open.status !== 'active') throw badRequest('No active loan to repay');

  const outstanding = roundUsd(open.outstanding_usd);
  const amt = Math.min(roundUsd(amount), outstanding);
  if (!Number.isFinite(amt) || amt <= 0) throw badRequest('Invalid repayment amount');

  const wallet = await ensureWalletForUser(userId);
  const cash = roundUsd(wallet?.balance);
  if (cash < amt) throw badRequest('Insufficient cash wallet balance');

  await setWalletBalance(userId, roundUsd(cash - amt));
  await createTransaction({
    userId,
    type: 'withdraw',
    amount: amt,
    status: `completed:vip_loan_repayment:${open.id}`,
  });

  const newOutstanding = roundUsd(outstanding - amt);
  const fullyRepaid = newOutstanding <= 0;
  const updated = await updateVipLoan(open.id, {
    outstandingUsd: newOutstanding,
    repaidUsd: roundUsd(Number(open.repaid_usd || 0) + amt),
    ...(fullyRepaid ? { status: 'repaid', repaidAt: new Date().toISOString() } : {}),
  });

  return {
    loan: vipLoanToApi(updated),
    cashWalletUsd: roundUsd(cash - amt),
    fullyRepaid,
    message: fullyRepaid
      ? 'Loan fully repaid. Withdrawals are unlocked again.'
      : `Repaid $${amt.toFixed(2)}. Remaining $${newOutstanding.toFixed(2)}.`,
  };
}

async function notifyVipLoanOutcome(userId, title, body) {
  try {
    await deliverUserAlert({ userId, title, body });
  } catch (err) {
    console.error('[vip-loan] notification failed:', err.message);
    try {
      await createAppNotification({ userId, title, body });
    } catch (innerErr) {
      console.error('[vip-loan] in-app notification fallback failed:', innerErr.message);
    }
  }
}

async function approveVipLoan(loanId) {
  const loan = await getVipLoanById(loanId);
  if (!loan) throw badRequest('Loan not found');
  if (loan.status !== 'pending') throw badRequest('Loan is not pending');

  const disbursed = roundUsd(loan.disbursed_usd);
  const wallet = await ensureWalletForUser(loan.user_id);
  const cash = roundUsd(wallet?.balance);
  await setWalletBalance(loan.user_id, roundUsd(cash + disbursed));
  await createTransaction({
    userId: loan.user_id,
    type: 'deposit',
    amount: disbursed,
    status: 'completed',
  });

  const now = new Date().toISOString();
  const updated = await updateVipLoan(loanId, {
    status: 'active',
    reviewedAt: now,
    disbursedAt: now,
  });

  const commission = roundUsd(loan.commission_usd);
  if (commission > 0) {
    await recordPlatformRevenueIfNew({
      eventType: 'vip_loan_commission',
      userId: loan.user_id,
      sourceId: loan.id,
      grossAmount: roundUsd(loan.amount_usd),
      feeRate: Number(loan.commission_rate) || VIP_LOAN_COMMISSION_RATE,
      meta: { disbursedUsd: disbursed },
      eventAt: now,
    }).catch((e) => console.error('[platform-revenue/vip-loan]', e));
  }

  await notifyVipLoanOutcome(
    loan.user_id,
    'VIP loan approved',
    `Your VIP loan of $${roundUsd(loan.amount_usd).toFixed(2)} was approved. $${disbursed.toFixed(2)} (after 30% commission) was credited to your cash wallet for use on the platform. Withdrawals stay locked until you repay $${roundUsd(loan.amount_usd).toFixed(2)} in full.`
  );

  return { loan: vipLoanToApi(updated), disbursedUsd: disbursed };
}

async function rejectVipLoan(loanId, note) {
  const loan = await getVipLoanById(loanId);
  if (!loan) throw badRequest('Loan not found');
  if (loan.status !== 'pending') throw badRequest('Loan is not pending');

  const adminNote = note ? String(note).trim() : null;
  const updated = await updateVipLoan(loanId, {
    status: 'rejected',
    adminNote,
    reviewedAt: new Date().toISOString(),
    outstandingUsd: 0,
  });

  const parts = ['Your VIP loan request was not approved.'];
  if (adminNote) parts.push(adminNote);
  parts.push('You may submit a new request when ready.');
  await notifyVipLoanOutcome(loan.user_id, 'VIP loan declined', parts.join(' '));

  return { loan: vipLoanToApi(updated) };
}

async function listAdminVipLoans({ status = 'pending', limit = 200 } = {}) {
  const rows = await listVipLoansAdmin({ status, limit });
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const users = await getUsersByIds(userIds);
  const emailById = new Map(users.map((u) => [u.id, u.email]));
  return { loans: rows.map((r) => vipLoanToApi(r, emailById.get(r.user_id))) };
}

/**
 * Withdrawal restrictions from VIP loans:
 * - A borrower with a pending or outstanding loan cannot withdraw at all.
 * - A user who received loan funds via peer transfer cannot withdraw that
 *   portion while the loan is outstanding, unless they deposited >= $5,000 in
 *   the 3 days before the loan was disbursed.
 */
async function getVipLoanWithdrawalRestriction(userId) {
  try {
    const open = await getOpenVipLoanForUser(userId);
    if (open) {
      return {
        blocked: true,
        restrictedUsd: 0,
        reason:
          open.status === 'pending'
            ? 'Withdrawals are locked while you have a VIP loan request in review.'
            : `Withdrawals are locked until your VIP loan is fully repaid ($${roundUsd(open.outstanding_usd).toFixed(2)} outstanding).`,
      };
    }
    const restrictedUsd = await sumActiveLoanTaintForRecipient(userId);
    if (restrictedUsd > 0) {
      return {
        blocked: false,
        restrictedUsd,
        reason: `$${restrictedUsd.toFixed(2)} of your balance came from an outstanding VIP loan and cannot be withdrawn until that loan is repaid.`,
      };
    }
    return { blocked: false, restrictedUsd: 0, reason: null };
  } catch (e) {
    if (isSchemaError(e) || isMissingTableError(e)) {
      return { blocked: false, restrictedUsd: 0, reason: null };
    }
    throw e;
  }
}

/**
 * Record a peer transfer made while the sender has an outstanding VIP loan so
 * the moved funds stay withdrawal-restricted for the recipient. Call after a
 * successful (non-idempotent) transfer.
 */
async function recordVipLoanFundTransfer({ fromUserId, toUserId, amountUsd, transferId }) {
  try {
    const loan = await getOpenVipLoanForUser(fromUserId);
    if (!loan || loan.status !== 'active') return null;

    const taint = Math.min(roundUsd(amountUsd), roundUsd(loan.outstanding_usd));
    if (taint <= 0) return null;

    const disbursedAt = loan.disbursed_at || loan.created_at;
    const windowStart = new Date(
      new Date(disbursedAt).getTime() - VIP_LOAN_RECIPIENT_DEPOSIT_WINDOW_DAYS * 24 * 3600 * 1000
    ).toISOString();
    const recentDeposits = await sumUserDepositsUsdBetween(toUserId, windowStart, disbursedAt);
    const recipientExempt = recentDeposits >= VIP_LOAN_RECIPIENT_EXEMPT_DEPOSIT_USD;

    return await insertVipLoanFundTransfer({
      id: newId(),
      loan_id: loan.id,
      transfer_id: transferId || null,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      amount_usd: taint,
      recipient_exempt: recipientExempt,
    });
  } catch (e) {
    if (isSchemaError(e) || isMissingTableError(e)) return null;
    console.error('[vip-loan] failed to record loan fund transfer:', e.message);
    return null;
  }
}

module.exports = {
  getVipLoanStatus,
  requestVipLoan,
  repayVipLoan,
  approveVipLoan,
  rejectVipLoan,
  listAdminVipLoans,
  getVipLoanWithdrawalRestriction,
  recordVipLoanFundTransfer,
};
