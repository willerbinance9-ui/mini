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
  isAddressWhitelistedForUser,
  utcTodayYmd,
  VIP_DAILY_RATE,
  VIP_ACCRUAL_MAX_WORKING_DAYS,
  VIP_LOAN_COMMISSION_RATE,
  VIP_LOAN_NEW_HAIRCUT_RATE,
  VIP_LOAN_NEW_COMMISSION_RATE,
  VIP_LOAN_MIN_ACCRUAL_DAYS,
  VIP_LOAN_EARNINGS_WINDOW_DAYS,
  VIP_LOAN_APPROVAL_MAX_BUSINESS_DAYS,
  VIP_LOAN_MIN_PRINCIPAL_USD,
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

function projectedMonthVipEarnings(principalUsd) {
  return roundUsd(Number(principalUsd || 0) * VIP_DAILY_RATE * VIP_ACCRUAL_MAX_WORKING_DAYS);
}

/**
 * Compute loan offer from VIP principal + month accrual.
 * - Standard (completed ≥1 VIP working month): loan = month accrual, commission 30%
 * - New (under one month): loan = month accrual × 50%, then commission 10%
 */
function buildVipLoanOffer({ principalUsd, monthCompleted, lastMonthEarningsUsd }) {
  const projectedMonthUsd = projectedMonthVipEarnings(principalUsd);
  const monthEarningsBaseUsd = monthCompleted
    ? roundUsd(Math.max(lastMonthEarningsUsd || 0, projectedMonthUsd || 0))
    : projectedMonthUsd;

  if (monthCompleted) {
    const amountUsd = monthEarningsBaseUsd;
    const commissionRate = VIP_LOAN_COMMISSION_RATE;
    const commissionUsd = roundUsd(amountUsd * commissionRate);
    const disbursedUsd = roundUsd(amountUsd - commissionUsd);
    return {
      borrowerTier: 'standard',
      monthCompleted: true,
      monthEarningsBaseUsd,
      projectedMonthUsd,
      lastMonthEarningsUsd: roundUsd(lastMonthEarningsUsd || 0),
      haircutRate: 0,
      amountUsd,
      maxLoanUsd: amountUsd,
      commissionRate,
      commissionUsd,
      disbursedUsd,
    };
  }

  const haircutRate = VIP_LOAN_NEW_HAIRCUT_RATE;
  const amountUsd = roundUsd(monthEarningsBaseUsd * haircutRate);
  const commissionRate = VIP_LOAN_NEW_COMMISSION_RATE;
  const commissionUsd = roundUsd(amountUsd * commissionRate);
  const disbursedUsd = roundUsd(amountUsd - commissionUsd);
  return {
    borrowerTier: 'new',
    monthCompleted: false,
    monthEarningsBaseUsd,
    projectedMonthUsd,
    lastMonthEarningsUsd: roundUsd(lastMonthEarningsUsd || 0),
    haircutRate,
    amountUsd,
    maxLoanUsd: amountUsd,
    commissionRate,
    commissionUsd,
    disbursedUsd,
  };
}

/**
 * Loan eligibility + offer for a VIP farmer.
 * Eligible when active VIP principal is above $2,500.
 */
async function getVipLoanStatus(userId) {
  const inv = await getActiveVipInvestmentForUser(userId);
  const accrualDays = await countVipAccrualDaysForUser(userId);
  const lastMonthEarningsUsd = await getLastMonthVipEarnings(userId);
  const monthCompleted = accrualDays >= VIP_LOAN_MIN_ACCRUAL_DAYS;
  const principalUsd = roundUsd(inv?.principal_usd || 0);
  const eligible = Boolean(inv) && principalUsd > VIP_LOAN_MIN_PRINCIPAL_USD;
  const openLoanRow = await getOpenVipLoanForUser(userId);
  const loans = await listVipLoansForUser(userId, 10);

  let ineligibleReason = null;
  if (!inv) {
    ineligibleReason = 'You need an active VIP Farmers investment to request a loan.';
  } else if (principalUsd <= VIP_LOAN_MIN_PRINCIPAL_USD) {
    ineligibleReason = `VIP loans require more than $${VIP_LOAN_MIN_PRINCIPAL_USD.toLocaleString()} in VIP farming principal. You have $${principalUsd.toFixed(2)}.`;
  }

  const offer = inv
    ? buildVipLoanOffer({
        principalUsd,
        monthCompleted,
        lastMonthEarningsUsd,
      })
    : null;

  return {
    eligible,
    ineligibleReason,
    monthCompleted,
    accrualDays,
    minAccrualDays: VIP_LOAN_MIN_ACCRUAL_DAYS,
    minPrincipalUsd: VIP_LOAN_MIN_PRINCIPAL_USD,
    principalUsd,
    lastMonthEarningsUsd,
    projectedMonthUsd: offer?.projectedMonthUsd || 0,
    monthEarningsBaseUsd: offer?.monthEarningsBaseUsd || 0,
    borrowerTier: offer?.borrowerTier || null,
    haircutRate: offer?.haircutRate || 0,
    maxLoanUsd: offer?.maxLoanUsd || 0,
    amountUsd: offer?.amountUsd || 0,
    commissionRate: offer?.commissionRate || VIP_LOAN_COMMISSION_RATE,
    commissionUsd: offer?.commissionUsd || 0,
    disbursedUsd: offer?.disbursedUsd || 0,
    minLoanUsd: VIP_LOAN_MIN_USD,
    approvalMaxBusinessDays: VIP_LOAN_APPROVAL_MAX_BUSINESS_DAYS,
    approvalMaxDays: VIP_LOAN_APPROVAL_MAX_BUSINESS_DAYS,
    openLoan: vipLoanToApi(openLoanRow),
    loans: loans.map((l) => vipLoanToApi(l)),
    usageNote:
      'After you accept, funds arrive within 3 business days to the wallet you choose. Withdrawals stay locked until the loan is fully repaid.',
  };
}

async function requestVipLoan(userId, payload = {}) {
  const destination = String(payload.destination || payload.payoutDestination || 'platform')
    .trim()
    .toLowerCase();
  if (destination !== 'platform' && destination !== 'direct_wallet') {
    throw badRequest('Choose platform wallet or an external payout wallet.');
  }

  let walletAddress = String(payload.walletAddress || payload.payoutWalletAddress || '')
    .trim();
  if (destination === 'direct_wallet') {
    if (!walletAddress) throw badRequest('Enter or select the wallet that should receive the loan.');
    const ok = await isAddressWhitelistedForUser(userId, 'usdttrc20', walletAddress).catch(() => false);
    // Also allow usdt if currency stored differently
    const okAlt = ok || (await isAddressWhitelistedForUser(userId, 'USDTTRC20', walletAddress).catch(() => false));
    if (!ok && !okAlt) {
      // Check any currency match on exact address via list
      const { listWhitelistedWalletsByUserId } = require('./db');
      const wallets = await listWhitelistedWalletsByUserId(userId);
      const match = wallets.find(
        (w) => String(w.address || '').trim().toLowerCase() === walletAddress.toLowerCase()
      );
      if (!match) {
        throw badRequest('Payout wallet must be one of your whitelisted withdrawal addresses.');
      }
      walletAddress = String(match.address).trim();
    }
  } else {
    walletAddress = null;
  }

  const inv = await getActiveVipInvestmentForUser(userId);
  if (!inv) throw badRequest('You need an active VIP Farmers investment to request a loan.');

  const principalUsd = roundUsd(inv.principal_usd);
  if (principalUsd <= VIP_LOAN_MIN_PRINCIPAL_USD) {
    throw badRequest(
      `VIP loans require more than $${VIP_LOAN_MIN_PRINCIPAL_USD.toLocaleString()} in VIP farming principal.`
    );
  }

  const open = await getOpenVipLoanForUser(userId);
  if (open) {
    throw badRequest(
      open.status === 'pending'
        ? 'You already have a loan request awaiting disbursement.'
        : 'Repay your current loan in full before requesting a new one.'
    );
  }

  const accrualDays = await countVipAccrualDaysForUser(userId);
  const monthCompleted = accrualDays >= VIP_LOAN_MIN_ACCRUAL_DAYS;
  const lastMonthEarningsUsd = await getLastMonthVipEarnings(userId);
  const offer = buildVipLoanOffer({
    principalUsd,
    monthCompleted,
    lastMonthEarningsUsd,
  });

  if (offer.amountUsd < VIP_LOAN_MIN_USD || offer.disbursedUsd <= 0) {
    throw badRequest('Your calculated loan offer is too small to request right now.');
  }

  // Amount is fixed to the calculated offer (accept offer flow).
  const amt = offer.amountUsd;
  const row = await insertVipLoan({
    id: newId(),
    user_id: userId,
    investment_id: inv.id,
    amount_usd: amt,
    commission_rate: offer.commissionRate,
    commission_usd: offer.commissionUsd,
    disbursed_usd: offer.disbursedUsd,
    last_month_earnings_usd: offer.lastMonthEarningsUsd,
    month_earnings_base_usd: offer.monthEarningsBaseUsd,
    max_loan_usd: offer.maxLoanUsd,
    outstanding_usd: amt,
    repaid_usd: 0,
    status: 'pending',
    payout_destination: destination,
    payout_wallet_address: walletAddress,
    borrower_tier: offer.borrowerTier,
    haircut_rate: offer.haircutRate,
    requested_at: new Date().toISOString(),
  });

  const destLabel =
    destination === 'platform'
      ? 'your platform cash wallet'
      : `wallet ${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}`;

  return {
    loan: vipLoanToApi(row),
    message: `Loan accepted. You will receive $${offer.disbursedUsd.toFixed(2)} in ${destLabel} within ${VIP_LOAN_APPROVAL_MAX_BUSINESS_DAYS} business days.`,
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
  const destination = loan.payout_destination || 'platform';
  const now = new Date().toISOString();

  if (destination === 'platform') {
    const wallet = await ensureWalletForUser(loan.user_id);
    const cash = roundUsd(wallet?.balance);
    await setWalletBalance(loan.user_id, roundUsd(cash + disbursed));
    await createTransaction({
      userId: loan.user_id,
      type: 'deposit',
      amount: disbursed,
      status: 'completed',
    });
  }

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
      meta: {
        disbursedUsd: disbursed,
        payoutDestination: destination,
        borrowerTier: loan.borrower_tier || 'standard',
      },
      eventAt: now,
    }).catch((e) => console.error('[platform-revenue/vip-loan]', e));
  }

  const payoutMsg =
    destination === 'platform'
      ? `$${disbursed.toFixed(2)} was credited to your cash wallet.`
      : `$${disbursed.toFixed(2)} was sent to your selected wallet (${loan.payout_wallet_address || 'external'}).`;

  await notifyVipLoanOutcome(
    loan.user_id,
    'VIP loan disbursed',
    `Your VIP loan of $${roundUsd(loan.amount_usd).toFixed(2)} was approved. ${payoutMsg} Withdrawals stay locked until you repay $${roundUsd(loan.amount_usd).toFixed(2)} in full.`
  );

  return { loan: vipLoanToApi(updated), disbursedUsd: disbursed, payoutDestination: destination };
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
  buildVipLoanOffer,
};
