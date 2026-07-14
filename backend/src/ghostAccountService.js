const crypto = require('crypto');
const {
  getGhostAccountByOwnerUserId,
  getGhostAccountById,
  insertGhostAccount,
  updateGhostAccount,
  listGhostAccountMembers,
  insertGhostAccountMember,
  deleteGhostAccountMember,
  getGhostAccountMemberByUserId,
  getGhostAccountLendByDropId,
  insertGhostAccountLend,
  updateGhostAccountLend,
  listGhostAccountLends,
  listGhostAccountLendsByStatus,
  sumCommittedGhostLendAmounts,
  sumGhostLendAmountsByStatus,
  sumAllActiveGhostLendAmountsByAccount,
  insertGhostAccountLedger,
  listGhostAccountLedger,
  ensureWalletForUser,
  setWalletBalance,
  getAirfarmingWalletByUserId,
  upsertAirfarmingWalletRow,
  insertAirfarmingTransfer,
  listScheduledAirfarmingDropsForUser,
  getAirfarmingDropById,
  getUserByEmail,
  getUserById,
  getUsersByIds,
  userIsBanned,
  getCryptoBalancesByUserId,
  updateAirfarmingAutoFundSetting,
  listAllGhostAccountsAdmin,
  listAllGhostAccountMembersAdmin,
  listRecalledGhostLendsAdmin,
  listRecalledGhostLendsForOwnerBetween,
  listRecalledGhostLendsForOwnerOnDate,
  listGhostAccountLendsForMember,
  listUsersAdmin,
  utcTodayYmd,
} = require('./db');
const { computeProfit } = require('./airfarmingDrops');
const { ELIGIBILITY_SNAPSHOT_MS, computeDropPhase } = require('./airfarmingDropUtils');
const { totalUsdtFamilyAvailable } = require('./usdtBalances');
const { getWithdrawalTrustScoreForUser } = require('./services/withdrawalTrustScore');
const { splitPlatformFee } = require('./platformRevenueService');

const GHOST_MIN_ELIGIBILITY_USD = 4900;
const GHOST_MIN_ALLOCATION_USD = 5000;
const PLATFORM_FEE_DROP_RATE = 0.1;

function newId() {
  return crypto.randomUUID();
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function mondayUtcYmd(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = d.getUTCDay();
  const offset = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function maskEmail(email) {
  const e = String(email || '').trim();
  const at = e.indexOf('@');
  if (at <= 0) return '—';
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const maskedLocal = local.length <= 1 ? '*' : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
}

async function computeEligibilityBreakdown(userId) {
  const [wallet, cryptoBalances, af] = await Promise.all([
    ensureWalletForUser(userId),
    getCryptoBalancesByUserId(userId),
    getAirfarmingWalletByUserId(userId),
  ]);
  const cashUsd = roundMoney(Number.parseFloat(String(wallet.balance ?? 0)) || 0);
  const cryptoUsd = roundMoney(totalUsdtFamilyAvailable(cryptoBalances));
  const airfarmingUsd = roundMoney(Number.parseFloat(String(af?.balance ?? 0)) || 0);
  const totalUsdt = roundMoney(cashUsd + cryptoUsd + airfarmingUsd);
  const eligible = totalUsdt > GHOST_MIN_ELIGIBILITY_USD;
  const amountNeeded = eligible
    ? 0
    : roundMoney(Math.max(0.01, GHOST_MIN_ELIGIBILITY_USD + 0.01 - totalUsdt));

  return {
    cashUsd,
    cryptoUsd,
    airfarmingUsd,
    totalUsdt,
    eligible,
    amountNeeded,
  };
}

async function computeTotalUsdtForUser(userId) {
  const breakdown = await computeEligibilityBreakdown(userId);
  return breakdown.totalUsdt;
}

async function isGhostEnrollmentEligible(userId) {
  const breakdown = await computeEligibilityBreakdown(userId);
  return breakdown.eligible;
}

async function enrollGhostAccount(ownerUserId) {
  const existing = await getGhostAccountByOwnerUserId(ownerUserId);
  if (existing) return existing;

  const eligible = await isGhostEnrollmentEligible(ownerUserId);
  if (!eligible) {
    throw new Error(`Ghost Account requires more than $${GHOST_MIN_ELIGIBILITY_USD.toLocaleString()} total USDT balance`);
  }

  const now = new Date().toISOString();
  return insertGhostAccount({
    id: newId(),
    owner_user_id: ownerUserId,
    pool_balance: 0,
    allocated_total: 0,
    status: 'active',
    created_at: now,
    updated_at: now,
  });
}

async function allocateToPool(ownerUserId, amount) {
  const account = await getGhostAccountByOwnerUserId(ownerUserId);
  if (!account) throw new Error('Ghost Account not found. Enroll first.');
  if (account.status !== 'active') throw new Error('Ghost Account is paused');

  const amt = roundMoney(amount);
  if (!Number.isFinite(amt) || amt <= 0) throw new Error('Invalid amount');

  const isFirstAllocation = Number(account.allocated_total || 0) <= 0 && Number(account.pool_balance || 0) <= 0;
  if (isFirstAllocation && amt < GHOST_MIN_ALLOCATION_USD) {
    throw new Error(`First allocation must be at least $${GHOST_MIN_ALLOCATION_USD.toLocaleString()}`);
  }

  const wallet = await ensureWalletForUser(ownerUserId);
  const cash = Number.parseFloat(String(wallet.balance ?? 0)) || 0;
  if (cash < amt) throw new Error('Insufficient cash wallet balance');

  const now = new Date().toISOString();
  await setWalletBalance(ownerUserId, roundMoney(cash - amt));
  const updated = await updateGhostAccount(account.id, {
    pool_balance: roundMoney(Number(account.pool_balance || 0) + amt),
    allocated_total: roundMoney(Number(account.allocated_total || 0) + amt),
  });
  await insertGhostAccountLedger({
    id: newId(),
    ghost_account_id: account.id,
    direction: 'allocate',
    amount: amt,
    related_lend_id: null,
    meta: {},
    created_at: now,
  });
  return updated;
}

async function deallocateFromPool(ownerUserId, amount) {
  const account = await getGhostAccountByOwnerUserId(ownerUserId);
  if (!account) throw new Error('Ghost Account not found');

  const amt = roundMoney(amount);
  if (!Number.isFinite(amt) || amt <= 0) throw new Error('Invalid amount');

  const committed = await sumCommittedGhostLendAmounts(account.id);
  const available = roundMoney(Number(account.pool_balance || 0) - committed);
  if (amt > available) {
    throw new Error(`Only $${available.toLocaleString()} is available to withdraw (committed to upcoming lends)`);
  }
  if (amt > Number(account.pool_balance || 0)) throw new Error('Insufficient pool balance');

  const wallet = await ensureWalletForUser(ownerUserId);
  const cash = Number.parseFloat(String(wallet.balance ?? 0)) || 0;
  const now = new Date().toISOString();

  await setWalletBalance(ownerUserId, roundMoney(cash + amt));
  const updated = await updateGhostAccount(account.id, {
    pool_balance: roundMoney(Number(account.pool_balance || 0) - amt),
  });
  await insertGhostAccountLedger({
    id: newId(),
    ghost_account_id: account.id,
    direction: 'deallocate',
    amount: amt,
    related_lend_id: null,
    meta: {},
    created_at: now,
  });
  return updated;
}

async function lookupMemberByExactEmail(ownerUserId, email) {
  const normalized = String(email || '').trim();
  if (!normalized || !normalized.includes('@')) return null;

  const user = await getUserByEmail(normalized);
  if (!user) return null;
  if (user.id === ownerUserId) return { error: 'Cannot add yourself as a member' };

  const existingMember = await getGhostAccountMemberByUserId(user.id);
  if (existingMember) return { error: 'User is already in a Ghost Account' };

  return {
    found: true,
    memberUserId: user.id,
    displayEmail: user.email,
  };
}

async function addGhostMember(ownerUserId, memberUserId) {
  const account = await getGhostAccountByOwnerUserId(ownerUserId);
  if (!account) throw new Error('Ghost Account not found');
  if (account.status !== 'active') throw new Error('Ghost Account is paused');
  if (memberUserId === ownerUserId) throw new Error('Cannot add yourself');

  const member = await getUserById(memberUserId);
  if (!member) throw new Error('User not found');
  if (userIsBanned(member)) throw new Error('User account is not eligible');

  const existing = await getGhostAccountMemberByUserId(memberUserId);
  if (existing) throw new Error('User is already in a Ghost Account');

  const row = await insertGhostAccountMember({
    id: newId(),
    ghost_account_id: account.id,
    member_user_id: memberUserId,
    added_by: ownerUserId,
    created_at: new Date().toISOString(),
  });

  await syncScheduledLendsForAccount(account.id);
  return row;
}

async function removeGhostMember(ownerUserId, memberUserId) {
  const account = await getGhostAccountByOwnerUserId(ownerUserId);
  if (!account) throw new Error('Ghost Account not found');

  const lends = await listGhostAccountLends(account.id, { limit: 200 });
  const active = lends.find(
    (l) => l.member_user_id === memberUserId && l.status === 'lent'
  );
  if (active) throw new Error('Cannot remove member while a lend is active');

  await deleteGhostAccountMember(account.id, memberUserId);

  const scheduled = lends.filter(
    (l) => l.member_user_id === memberUserId && l.status === 'scheduled'
  );
  for (const lend of scheduled) {
    await updateGhostAccountLend(lend.id, { status: 'failed', fail_reason: 'member_removed' });
  }
}

async function setGhostAccountPaused(ownerUserId, paused) {
  const account = await getGhostAccountByOwnerUserId(ownerUserId);
  if (!account) throw new Error('Ghost Account not found');
  return updateGhostAccount(account.id, { status: paused ? 'paused' : 'active' });
}

async function computeLendDeficit(memberUserId, drop) {
  const af = await getAirfarmingWalletByUserId(memberUserId);
  const memberBal = roundMoney(Number.parseFloat(String(af?.balance ?? 0)) || 0);
  const minBal = Number(drop.min_balance);
  const maxBal = Number(drop.max_balance);

  if (memberBal > maxBal) return { needed: 0, memberBal, targetBal: memberBal };
  if (memberBal >= minBal && memberBal <= maxBal) return { needed: 0, memberBal, targetBal: memberBal };
  return { needed: roundMoney(minBal - memberBal), memberBal, targetBal: minBal };
}

async function syncScheduledLendsForAccount(ghostAccountId) {
  const account = await getGhostAccountById(ghostAccountId);
  if (!account || account.status !== 'active') return [];

  const members = await listGhostAccountMembers(ghostAccountId);
  const weekStart = mondayUtcYmd();
  const created = [];

  for (const member of members) {
    const drops = await listScheduledAirfarmingDropsForUser(member.member_user_id, weekStart, 5);
    const nextDrop = drops[0];
    if (!nextDrop?.id) continue;

    const existing = await getGhostAccountLendByDropId(nextDrop.id);
    if (existing) continue;

    const { needed } = await computeLendDeficit(member.member_user_id, nextDrop);
    const eligibilityBal = needed > 0 ? Number(nextDrop.min_balance) : Number(nextDrop.min_balance);
    const projectedGross = await computeProfit(eligibilityBal, nextDrop.percent);

    const lend = await insertGhostAccountLend({
      id: newId(),
      ghost_account_id: ghostAccountId,
      member_user_id: member.member_user_id,
      drop_id: nextDrop.id,
      lend_amount: needed,
      projected_profit_gross: projectedGross,
      status: 'scheduled',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    created.push(lend);
  }

  return created;
}

async function executeGhostLend(lend, account, drop) {
  if (lend.status !== 'scheduled') return lend;
  if (account.status !== 'active') {
    return updateGhostAccountLend(lend.id, {
      status: 'failed',
      fail_reason: 'account_paused',
    });
  }

  const member = await getUserById(lend.member_user_id);
  if (userIsBanned(member)) {
    return updateGhostAccountLend(lend.id, {
      status: 'failed',
      fail_reason: 'member_banned',
    });
  }

  const trust = await getWithdrawalTrustScoreForUser(lend.member_user_id);
  if (trust.dropsBlocked) {
    return updateGhostAccountLend(lend.id, {
      status: 'failed',
      fail_reason: 'member_drops_blocked',
    });
  }

  const { needed } = await computeLendDeficit(lend.member_user_id, drop);
  const now = new Date().toISOString();

  if (needed <= 0) {
    return updateGhostAccountLend(lend.id, {
      lend_amount: 0,
      status: 'lent',
      lent_at: now,
    });
  }

  if (Number(account.pool_balance || 0) < needed) {
    return updateGhostAccountLend(lend.id, {
      lend_amount: needed,
      status: 'failed',
      fail_reason: 'insufficient_pool',
    });
  }

  const af = await getAirfarmingWalletByUserId(lend.member_user_id);
  const memberBal = roundMoney(Number.parseFloat(String(af?.balance ?? 0)) || 0);
  const nextMemberBal = roundMoney(memberBal + needed);
  const nextPool = roundMoney(Number(account.pool_balance || 0) - needed);

  await updateGhostAccount(account.id, { pool_balance: nextPool });
  await upsertAirfarmingWalletRow({
    user_id: lend.member_user_id,
    balance: nextMemberBal,
    updated_at: now,
  });
  await insertAirfarmingTransfer({
    id: newId(),
    user_id: lend.member_user_id,
    direction: 'to_airfarming',
    amount: needed,
    created_at: now,
  });
  await insertGhostAccountLedger({
    id: newId(),
    ghost_account_id: account.id,
    direction: 'lend',
    amount: needed,
    related_lend_id: lend.id,
    meta: { dropId: drop.id, memberUserId: lend.member_user_id },
    created_at: now,
  });

  await updateAirfarmingAutoFundSetting(lend.member_user_id, false).catch(() => {});

  account.pool_balance = nextPool;
  return updateGhostAccountLend(lend.id, {
    lend_amount: needed,
    status: 'lent',
    lent_at: now,
  });
}

async function processGhostLendQueue(ghostAccountId) {
  const account = await getGhostAccountById(ghostAccountId);
  if (!account) return { processed: 0 };

  await syncScheduledLendsForAccount(ghostAccountId);

  const lends = await listGhostAccountLendsByStatus(['scheduled'], 200);
  const accountLends = lends.filter((l) => l.ghost_account_id === ghostAccountId);
  const nowMs = Date.now();
  let processed = 0;

  for (const lend of accountLends) {
    const drop = await getAirfarmingDropById(lend.drop_id);
    if (!drop || drop.status !== 'scheduled') continue;

    const dueMs = new Date(drop.due_at).getTime();
    if (nowMs < dueMs - ELIGIBILITY_SNAPSHOT_MS) continue;

    await executeGhostLend(lend, account, drop);
    processed += 1;
  }

  return { processed };
}

async function processAllGhostLendQueues() {
  const lends = await listGhostAccountLendsByStatus(['scheduled'], 500);
  const accountIds = [...new Set(lends.map((l) => l.ghost_account_id))];
  let total = 0;
  for (const id of accountIds) {
    const r = await processGhostLendQueue(id);
    total += r.processed;
  }
  await processGhostRecallQueue();
  return { processed: total };
}

async function recallGhostLend(lend, { netProfit = 0 } = {}) {
  if (!lend || lend.status !== 'lent') return lend;

  const account = await getGhostAccountById(lend.ghost_account_id);
  if (!account) return lend;

  const principal = roundMoney(Number(lend.lend_amount || 0));
  const profitNet =
    principal > 0 ? roundMoney(Math.max(0, Number(netProfit || 0))) : 0;
  const sweepTotal = roundMoney(principal + profitNet);

  if (sweepTotal <= 0) {
    return updateGhostAccountLend(lend.id, {
      status: 'recalled',
      recalled_at: new Date().toISOString(),
      recalled_principal: 0,
      recalled_profit_net: 0,
    });
  }

  const af = await getAirfarmingWalletByUserId(lend.member_user_id);
  const memberBal = roundMoney(Number.parseFloat(String(af?.balance ?? 0)) || 0);

  if (memberBal < sweepTotal) {
    return updateGhostAccountLend(lend.id, {
      status: 'failed',
      fail_reason: 'recall_insufficient_member_balance',
    });
  }

  const now = new Date().toISOString();
  const nextMemberBal = roundMoney(memberBal - sweepTotal);
  const nextPool = roundMoney(Number(account.pool_balance || 0) + sweepTotal);

  await upsertAirfarmingWalletRow({
    user_id: lend.member_user_id,
    balance: nextMemberBal,
    updated_at: now,
  });

  await updateGhostAccount(account.id, { pool_balance: nextPool });

  if (sweepTotal > 0) {
    await insertGhostAccountLedger({
      id: newId(),
      ghost_account_id: account.id,
      direction: 'recall',
      amount: sweepTotal,
      related_lend_id: lend.id,
      meta: { principal, profitNet, dropId: lend.drop_id },
      created_at: now,
    });
  }

  return updateGhostAccountLend(lend.id, {
    status: 'recalled',
    recalled_at: now,
    recalled_principal: principal,
    recalled_profit_net: profitNet,
  });
}

async function recallLendForDrop(dropId, { netProfit } = {}) {
  const lend = await getGhostAccountLendByDropId(dropId);
  if (!lend || lend.status !== 'lent') return null;
  return recallGhostLend(lend, { netProfit });
}

async function processGhostRecallQueue() {
  const lends = await listGhostAccountLendsByStatus(['lent'], 200);
  let recalled = 0;

  for (const lend of lends) {
    const drop = await getAirfarmingDropById(lend.drop_id);
    if (!drop) continue;

    if (drop.status === 'missed') {
      await recallGhostLend(lend, { netProfit: 0 });
      recalled += 1;
      continue;
    }

    if (drop.status === 'paid' && Number(lend.lend_amount || 0) > 0) {
      const profit = Number(drop.profit_amount || 0);
      const { net } = splitPlatformFee(profit, PLATFORM_FEE_DROP_RATE);
      await recallGhostLend(lend, { netProfit: net });
      recalled += 1;
    } else if (drop.status === 'paid') {
      await recallGhostLend(lend, { netProfit: 0 });
      recalled += 1;
    }
  }

  return { recalled };
}

async function isDropGhostFunded(dropId) {
  const lend = await getGhostAccountLendByDropId(dropId);
  return Boolean(lend && ['scheduled', 'lent'].includes(lend.status));
}

async function getGhostSponsorAccountIdForMember(memberUserId) {
  const row = await getGhostAccountMemberByUserId(memberUserId);
  return row?.ghost_account_id || null;
}

async function buildScheduleRow(lend, drop, emailByUserId, poolBalanceRef) {
  const email = emailByUserId.get(lend.member_user_id) || '';
  const { needed } = drop
    ? await computeLendDeficit(lend.member_user_id, drop)
    : { needed: Number(lend.lend_amount || 0) };

  const projectedGross = drop
    ? await computeProfit(
        needed > 0 ? Number(drop.min_balance) : Number(drop.min_balance),
        drop.percent
      )
    : Number(lend.projected_profit_gross || 0);
  const projectedNet = roundMoney(projectedGross * (1 - PLATFORM_FEE_DROP_RATE));

  const lendAmount = lend.status === 'scheduled' ? needed : Number(lend.lend_amount || 0);
  if (lend.status === 'scheduled' && poolBalanceRef) {
    poolBalanceRef.available = roundMoney(poolBalanceRef.available - lendAmount);
  }

  return {
    lendId: lend.id,
    memberUserId: lend.member_user_id,
    memberEmailMasked: maskEmail(email),
    dropId: lend.drop_id,
    dueAt: drop?.due_at || null,
    minBalance: drop ? Number(drop.min_balance) : null,
    maxBalance: drop ? Number(drop.max_balance) : null,
    percent: drop ? Number(drop.percent) : null,
    lendAmount,
    projectedProfitGross: projectedGross,
    projectedProfitNet: projectedNet,
    lendStatus: lend.status,
    failReason: lend.fail_reason || null,
    recalledPrincipal: Number(lend.recalled_principal || 0),
    recalledProfitNet: Number(lend.recalled_profit_net || 0),
    poolAvailableAfterLend:
      lend.status === 'scheduled' && poolBalanceRef
        ? poolBalanceRef.available
        : null,
  };
}

async function buildGhostMembershipStatus(memberUserId) {
  const membership = await getGhostAccountMemberByUserId(memberUserId);
  if (!membership) return null;

  const ghostAccount = membership.ghost_accounts;
  if (!ghostAccount) return null;

  const owner = await getUserById(ghostAccount.owner_user_id);
  const lends = await listGhostAccountLendsForMember(memberUserId, 10);
  const activeLend = lends.find((l) => ['scheduled', 'lent'].includes(l.status)) || null;
  const committed = await sumCommittedGhostLendAmounts(ghostAccount.id);
  const poolBalance = Number(ghostAccount.pool_balance || 0);

  return {
    role: 'member',
    sponsorEmailMasked: maskEmail(owner?.email),
    sponsorAccountStatus: ghostAccount.status,
    sponsorPoolBalance: poolBalance,
    sponsorPoolAvailable: roundMoney(poolBalance - committed),
    joinedAt: membership.created_at,
    activeLend: activeLend
      ? {
          lendId: activeLend.id,
          status: activeLend.status,
          lendAmount: Number(activeLend.lend_amount || 0),
          dropId: activeLend.drop_id,
        }
      : null,
    recentLends: lends.slice(0, 5).map((l) => ({
      lendId: l.id,
      status: l.status,
      lendAmount: Number(l.lend_amount || 0),
      recalledProfitNet: Number(l.recalled_profit_net || 0),
      recalledAt: l.recalled_at,
    })),
  };
}

async function getGhostAccountBalance(userId) {
  const account = await getGhostAccountByOwnerUserId(userId);
  if (account) {
    const committed = await sumCommittedGhostLendAmounts(account.id);
    const poolBalance = Number(account.pool_balance || 0);
    return {
      role: 'owner',
      owner: {
        accountId: account.id,
        status: account.status,
        poolBalance,
        poolAvailable: roundMoney(poolBalance - committed),
        poolCommitted: roundMoney(committed),
        allocatedTotal: Number(account.allocated_total || 0),
      },
      member: null,
    };
  }

  const membership = await buildGhostMembershipStatus(userId);
  if (membership) {
    return {
      role: 'member',
      owner: null,
      member: membership,
    };
  }

  return { role: 'none', owner: null, member: null };
}

async function buildGhostAccountStatus(ownerUserId) {
  let account = await getGhostAccountByOwnerUserId(ownerUserId);
  const breakdown = await computeEligibilityBreakdown(ownerUserId);
  const { totalUsdt, eligible, cashUsd, cryptoUsd, airfarmingUsd, amountNeeded } = breakdown;

  const eligibilityPayload = {
    eligible,
    minEligibilityUsd: GHOST_MIN_ELIGIBILITY_USD,
    minAllocationUsd: GHOST_MIN_ALLOCATION_USD,
    totalUsdt,
    amountNeeded,
    balanceBreakdown: {
      cashUsd,
      cryptoUsd,
      airfarmingUsd,
    },
    pollIntervalSec: 45,
  };

  if (!account) {
    const membership = await buildGhostMembershipStatus(ownerUserId);
    return {
      enrolled: false,
      isMember: Boolean(membership),
      membership,
      ...eligibilityPayload,
    };
  }

  if (account.status === 'active') {
    try {
      await processGhostLendQueue(account.id);
      account = await getGhostAccountById(account.id);
    } catch (err) {
      console.error('[ghost-account/status] lend queue', err?.message || err);
    }
  }

  const members = await listGhostAccountMembers(account.id);
  const memberIds = members.map((m) => m.member_user_id);
  const users = await getUsersByIds(memberIds);
  const emailByUserId = new Map(users.map((u) => [u.id, u.email]));

  const lends = await listGhostAccountLends(account.id, { limit: 100 });
  const committed = await sumCommittedGhostLendAmounts(account.id);
  const poolBalance = Number(account.pool_balance || 0);
  const poolAvailable = roundMoney(poolBalance - committed);

  const poolBalanceRef = { available: poolAvailable };
  const upcoming = [];
  const history = [];

  for (const lend of lends) {
    const drop = await getAirfarmingDropById(lend.drop_id);
    const row = await buildScheduleRow(lend, drop, emailByUserId, poolBalanceRef);

    if (['scheduled', 'lent'].includes(lend.status)) {
      upcoming.push(row);
    } else if (lend.status === 'recalled') {
      history.push(row);
    } else if (lend.status === 'failed') {
      upcoming.push(row);
    }
  }

  upcoming.sort((a, b) => {
    const ta = a.dueAt ? new Date(a.dueAt).getTime() : 0;
    const tb = b.dueAt ? new Date(b.dueAt).getTime() : 0;
    return ta - tb;
  });

  const ledger = await listGhostAccountLedger(account.id, 30);
  const warnings = upcoming
    .filter((r) => r.lendStatus === 'failed' || r.failReason)
    .map((r) => ({
      lendId: r.lendId,
      message:
        r.failReason === 'insufficient_pool'
          ? `Insufficient pool for ${r.memberEmailMasked} (needs $${r.lendAmount})`
          : r.failReason || 'Lend failed',
    }));

  return {
    enrolled: true,
    ...eligibilityPayload,
    account: {
      id: account.id,
      status: account.status,
      poolBalance,
      allocatedTotal: Number(account.allocated_total || 0),
      poolCommitted: committed,
      poolAvailable,
    },
    members: members.map((m) => ({
      memberUserId: m.member_user_id,
      emailMasked: maskEmail(emailByUserId.get(m.member_user_id)),
      addedAt: m.created_at,
    })),
    upcomingLends: upcoming,
    recallHistory: history.slice(0, 20),
    ledger: ledger.map((e) => ({
      id: e.id,
      direction: e.direction,
      amount: Number(e.amount),
      createdAt: e.created_at,
      meta: e.meta || {},
    })),
    warnings,
    pollIntervalSec: 45,
  };
}

function startOfUtcMonthYmd() {
  const today = utcTodayYmd();
  return `${today.slice(0, 7)}-01`;
}

function monthBoundsUtc(year, month) {
  const y = Number(year);
  const m = Number(month);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return {
    year: y,
    month: m,
    startYmd: start.toISOString().slice(0, 10),
    endYmd: end.toISOString().slice(0, 10),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    daysInMonth: end.getUTCDate(),
  };
}

async function buildOwnerGhostSnapshot(ownerUserId) {
  const account = await getGhostAccountByOwnerUserId(ownerUserId);
  if (!account) return null;
  const committed = await sumCommittedGhostLendAmounts(account.id);
  const poolBalance = roundMoney(Number(account.pool_balance || 0));
  return {
    id: account.id,
    label: 'Ghost Account',
    status: account.status,
    poolBalance,
    poolAvailable: roundMoney(poolBalance - committed),
    poolCommitted: roundMoney(committed),
    allocatedTotal: roundMoney(Number(account.allocated_total || 0)),
  };
}

async function getGhostOwnerJournalMonth(ownerUserId, year, month) {
  const bounds = monthBoundsUtc(year, month);
  const account = await getGhostAccountByOwnerUserId(ownerUserId);
  if (!account) {
    return {
      year: bounds.year,
      month: bounds.month,
      enrolled: false,
      monthProfitUsd: 0,
      profitDays: 0,
      bestDay: null,
      days: {},
      ghosts: [],
    };
  }

  const rows = await listRecalledGhostLendsForOwnerBetween(ownerUserId, bounds.startIso, bounds.endIso);
  const days = {};
  for (let d = 1; d <= bounds.daysInMonth; d += 1) {
    const ymd = `${bounds.year}-${String(bounds.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days[ymd] = { date: ymd, profitUsd: 0, recallCount: 0, hasProfit: false };
  }

  for (const row of rows) {
    const ymd = String(row.recalled_at || '').slice(0, 10);
    if (!days[ymd]) continue;
    const profit = roundMoney(Number(row.recalled_profit_net || 0));
    if (profit <= 0) continue;
    days[ymd].profitUsd = roundMoney(days[ymd].profitUsd + profit);
    days[ymd].recallCount += 1;
    days[ymd].hasProfit = days[ymd].profitUsd > 0;
  }

  const dayList = Object.values(days);
  const monthProfitUsd = roundMoney(dayList.reduce((s, d) => s + d.profitUsd, 0));
  const profitDays = dayList.filter((d) => d.hasProfit).length;
  let bestDay = null;
  for (const d of dayList) {
    if (!d.hasProfit) continue;
    if (!bestDay || d.profitUsd > bestDay.profitUsd) bestDay = { date: d.date, profitUsd: d.profitUsd };
  }

  const snapshot = await buildOwnerGhostSnapshot(ownerUserId);
  return {
    year: bounds.year,
    month: bounds.month,
    enrolled: true,
    monthProfitUsd,
    profitDays,
    bestDay,
    days,
    ghosts: snapshot ? [snapshot] : [],
  };
}

async function getGhostOwnerJournalDay(ownerUserId, dateYmd) {
  const date = String(dateYmd || '').slice(0, 10);
  const account = await getGhostAccountByOwnerUserId(ownerUserId);
  if (!account) {
    return { date, enrolled: false, profitUsd: 0, ghosts: [] };
  }

  const rows = await listRecalledGhostLendsForOwnerOnDate(ownerUserId, date);
  let profitUsd = 0;
  let principalUsd = 0;
  let recallCount = 0;
  const recalls = [];
  for (const row of rows) {
    const profit = roundMoney(Number(row.recalled_profit_net || 0));
    const principal = roundMoney(Number(row.recalled_principal || 0));
    if (profit <= 0 && principal <= 0) continue;
    profitUsd = roundMoney(profitUsd + profit);
    principalUsd = roundMoney(principalUsd + principal);
    recallCount += 1;
    recalls.push({
      id: row.id,
      profitUsd: profit,
      principalUsd: principal,
      recalledAt: row.recalled_at,
    });
  }

  const snapshot = await buildOwnerGhostSnapshot(ownerUserId);
  return {
    date,
    enrolled: true,
    profitUsd,
    ghosts: snapshot
      ? [
          {
            ...snapshot,
            profitUsd,
            principalUsd,
            recallCount,
            recalls,
          },
        ]
      : [],
  };
}

function aggregateGhostRecallRows(rows) {
  const empty = () => ({ count: 0, profitUsd: 0, principalUsd: 0, totalSweepUsd: 0 });
  const totals = { all: empty(), today: empty(), month: empty() };
  const today = utcTodayYmd();
  const monthStart = startOfUtcMonthYmd();

  for (const row of rows || []) {
    const profit = roundMoney(Number(row.recalled_profit_net || 0));
    const principal = roundMoney(Number(row.recalled_principal || 0));
    const sweep = roundMoney(profit + principal);
    const at = String(row.recalled_at || '').slice(0, 10);

    const bump = (bucket) => {
      bucket.count += 1;
      bucket.profitUsd = roundMoney(bucket.profitUsd + profit);
      bucket.principalUsd = roundMoney(bucket.principalUsd + principal);
      bucket.totalSweepUsd = roundMoney(bucket.totalSweepUsd + sweep);
    };

    bump(totals.all);
    if (at === today) bump(totals.today);
    if (at >= monthStart) bump(totals.month);
  }

  return totals;
}

async function getGhostRevenueAdminStats({ recentLimit = 50 } = {}) {
  const rows = await listRecalledGhostLendsAdmin(10000);
  const recentSlice = rows.slice(0, Math.min(recentLimit, rows.length));

  const userIds = new Set();
  for (const row of recentSlice) {
    const ownerId = row.ghost_accounts?.owner_user_id;
    if (ownerId) userIds.add(ownerId);
    if (row.member_user_id) userIds.add(row.member_user_id);
  }
  const users = await getUsersByIds([...userIds]);
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  return {
    summary: aggregateGhostRecallRows(rows),
    recent: recentSlice.map((row) => {
      const ownerUserId = row.ghost_accounts?.owner_user_id || null;
      const profit = roundMoney(Number(row.recalled_profit_net || 0));
      const principal = roundMoney(Number(row.recalled_principal || 0));
      return {
        id: row.id,
        ghostAccountId: row.ghost_account_id,
        dropId: row.drop_id,
        ownerUserId,
        ownerEmail: ownerUserId ? emailById.get(ownerUserId) || '—' : '—',
        memberUserId: row.member_user_id,
        memberEmail: row.member_user_id ? emailById.get(row.member_user_id) || '—' : '—',
        recalledAt: row.recalled_at,
        profitUsd: profit,
        principalUsd: principal,
        totalSweepUsd: roundMoney(profit + principal),
      };
    }),
  };
}

async function listGhostAccountsAdminSummary() {
  const emptyBreakdown = { scheduledUsd: 0, lentUsd: 0, committedUsd: 0, activeCount: 0 };
  const [rows, allMembers, lendByAccount] = await Promise.all([
    listAllGhostAccountsAdmin(200),
    listAllGhostAccountMembersAdmin(2000),
    sumAllActiveGhostLendAmountsByAccount(),
  ]);

  if (!rows.length) {
    return {
      accounts: [],
      count: 0,
      totals: {
        poolBalanceUsd: 0,
        poolAvailableUsd: 0,
        poolInUseUsd: 0,
        scheduledUsd: 0,
        allocatedTotalUsd: 0,
        memberCount: 0,
      },
    };
  }

  const ownerIds = rows.map((r) => r.owner_user_id);
  const owners = await getUsersByIds(ownerIds);
  const emailById = new Map(owners.map((u) => [u.id, u.email]));

  const memberCountByAccount = new Map();
  for (const m of allMembers) {
    const gid = m.ghost_account_id;
    memberCountByAccount.set(gid, (memberCountByAccount.get(gid) || 0) + 1);
  }

  const accounts = [];
  let poolBalanceUsd = 0;
  let poolAvailableUsd = 0;
  let poolInUseUsd = 0;
  let scheduledUsdTotal = 0;
  let allocatedTotalUsd = 0;
  let memberCountTotal = 0;

  for (const row of rows) {
    const lendBreakdown = lendByAccount.get(row.id) || emptyBreakdown;
    const poolBalance = Number(row.pool_balance || 0);
    const allocatedTotal = Number(row.allocated_total || 0);
    const poolAvailable = roundMoney(poolBalance - lendBreakdown.committedUsd);
    const memberCount = memberCountByAccount.get(row.id) || 0;

    poolBalanceUsd = roundMoney(poolBalanceUsd + poolBalance);
    poolAvailableUsd = roundMoney(poolAvailableUsd + poolAvailable);
    poolInUseUsd = roundMoney(poolInUseUsd + lendBreakdown.lentUsd);
    scheduledUsdTotal = roundMoney(scheduledUsdTotal + lendBreakdown.scheduledUsd);
    allocatedTotalUsd = roundMoney(allocatedTotalUsd + allocatedTotal);
    memberCountTotal += memberCount;

    accounts.push({
      id: row.id,
      ownerUserId: row.owner_user_id,
      ownerEmail: emailById.get(row.owner_user_id) || '—',
      memberCount,
      poolBalance,
      poolAvailable,
      poolCommitted: lendBreakdown.committedUsd,
      poolInUse: lendBreakdown.lentUsd,
      scheduledUsd: lendBreakdown.scheduledUsd,
      allocatedTotal,
      activeLendCount: lendBreakdown.activeCount,
      status: row.status,
      createdAt: row.created_at,
    });
  }

  accounts.sort((a, b) => b.poolBalance - a.poolBalance);

  return {
    accounts,
    count: accounts.length,
    totals: {
      poolBalanceUsd,
      poolAvailableUsd,
      poolInUseUsd,
      scheduledUsd: scheduledUsdTotal,
      allocatedTotalUsd,
      memberCount: memberCountTotal,
    },
  };
}

async function buildMemberNetworkNode(memberUserId, email, ghostAccountId) {
  const weekStart = mondayUtcYmd();
  const drops = await listScheduledAirfarmingDropsForUser(memberUserId, weekStart, 1);
  const drop = drops[0] || null;
  const af = await getAirfarmingWalletByUserId(memberUserId);
  const airfarmingBalance = roundMoney(Number.parseFloat(String(af?.balance ?? 0)) || 0);

  let needed = 0;
  let dropId = null;
  let dueAt = null;
  let secondsRemaining = null;
  let dropPhase = 'idle';
  let dropStatus = null;
  let minBalance = null;
  let maxBalance = null;
  let percent = null;
  let lendStatus = null;
  let lendAmount = null;

  if (drop) {
    const deficit = await computeLendDeficit(memberUserId, drop);
    needed = deficit.needed;
    dropId = drop.id;
    dueAt = drop.due_at;
    dropStatus = drop.status;
    minBalance = Number(drop.min_balance);
    maxBalance = Number(drop.max_balance);
    percent = Number(drop.percent);
    const nowMs = Date.now();
    const dueMs = new Date(drop.due_at).getTime();
    secondsRemaining = Math.max(0, Math.floor((dueMs - nowMs) / 1000));
    dropPhase = computeDropPhase(drop, nowMs);

    const lends = await listGhostAccountLends(ghostAccountId, { limit: 50 });
    const lend = lends.find((l) => l.drop_id === drop.id);
    if (lend) {
      lendStatus = lend.status;
      lendAmount = Number(lend.lend_amount || 0);
    }
  }

  const hasDrop = Boolean(drop && drop.status === 'scheduled');
  const servingSoon =
    hasDrop &&
    dropStatus === 'scheduled' &&
    (dropPhase === 'preparing' || (secondsRemaining != null && secondsRemaining <= 300));

  return {
    userId: memberUserId,
    email: email || '—',
    airfarmingBalance,
    needed,
    hasDrop,
    dropId,
    dueAt,
    secondsRemaining,
    dropPhase,
    dropStatus,
    minBalance,
    maxBalance,
    percent,
    lendStatus,
    lendAmount,
    servingSoon,
  };
}

async function buildGhostNetworkAdmin(ghostAccountId) {
  let account = await getGhostAccountById(ghostAccountId);
  if (!account) throw new Error('Ghost account not found');

  if (account.status === 'active') {
    await processGhostLendQueue(account.id);
    account = await getGhostAccountById(ghostAccountId);
  }

  const owner = await getUserById(account.owner_user_id);
  const members = await listGhostAccountMembers(account.id);
  const memberIds = members.map((m) => m.member_user_id);
  const users = await getUsersByIds(memberIds);
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  const memberNodes = [];
  for (const m of members) {
    memberNodes.push(
      await buildMemberNetworkNode(
        m.member_user_id,
        emailById.get(m.member_user_id),
        account.id
      )
    );
  }

  const committed = await sumCommittedGhostLendAmounts(account.id);
  const poolBalance = Number(account.pool_balance || 0);

  return {
    account: {
      id: account.id,
      ownerUserId: account.owner_user_id,
      ownerEmail: owner?.email || '—',
      poolBalance,
      poolAvailable: roundMoney(poolBalance - committed),
      poolCommitted: committed,
      status: account.status,
      memberCount: members.length,
    },
    owner: {
      userId: account.owner_user_id,
      email: owner?.email || '—',
      poolBalance,
    },
    members: memberNodes,
    pollIntervalSec: 5,
  };
}

async function buildGhostParticleNetworkAdmin({ userLimit = 500 } = {}) {
  await processAllGhostLendQueues();

  const cap = Math.min(500, Math.max(50, Number(userLimit) || 500));
  const users = await listUsersAdmin({ limit: cap });
  const ghostAccounts = await listAllGhostAccountsAdmin(200);
  const ghostMembers = await listAllGhostAccountMembersAdmin(500);

  const ownerByUserId = new Map();
  const memberMetaByUserId = new Map();
  for (const ga of ghostAccounts) {
    ownerByUserId.set(ga.owner_user_id, ga);
  }
  for (const row of ghostMembers) {
    const ga = row.ghost_accounts || {};
    memberMetaByUserId.set(row.member_user_id, {
      ghostAccountId: row.ghost_account_id,
      ownerUserId: ga.owner_user_id,
    });
  }

  const edges = [];
  for (const row of ghostMembers) {
    const ga = row.ghost_accounts || {};
    const ownerUserId = ga.owner_user_id;
    if (!ownerUserId) continue;
    const memberNode = await buildMemberNetworkNode(
      row.member_user_id,
      null,
      row.ghost_account_id
    );
    memberNode.email =
      memberNode.email === '—'
        ? (users.find((u) => u.id === row.member_user_id)?.email || '—')
        : memberNode.email;

    edges.push({
      fromUserId: ownerUserId,
      toUserId: row.member_user_id,
      ghostAccountId: row.ghost_account_id,
      lendAmount: memberNode.lendAmount,
      needed: memberNode.needed,
      lendStatus: memberNode.lendStatus,
      pendingTransfer: memberNode.lendStatus === 'scheduled',
      activeTransfer: memberNode.lendStatus === 'lent',
      servingSoon: memberNode.servingSoon,
      dueAt: memberNode.dueAt,
      airfarmingBalance: memberNode.airfarmingBalance,
    });
  }

  const nodes = users.map((u) => {
    const ownerGa = ownerByUserId.get(u.id);
    const memberMeta = memberMetaByUserId.get(u.id);
    let ghostRole = 'none';
    let connected = false;
    let ghostAccountId = null;
    const base = {
      userId: u.id,
      email: u.email || '—',
      ghostRole,
      connected,
      ghostAccountId,
    };

    if (ownerGa) {
      ghostRole = 'owner';
      connected = true;
      ghostAccountId = ownerGa.id;
      const memberCount = ghostMembers.filter(
        (m) => m.ghost_account_id === ownerGa.id
      ).length;
      return {
        ...base,
        ghostRole,
        connected,
        ghostAccountId,
        poolBalance: Number(ownerGa.pool_balance || 0),
        memberCount,
        accountStatus: ownerGa.status,
      };
    }

    if (memberMeta) {
      ghostRole = 'member';
      connected = true;
      ghostAccountId = memberMeta.ghostAccountId;
      const edge = edges.find((e) => e.toUserId === u.id);
      return {
        ...base,
        ghostRole,
        connected,
        ghostAccountId,
        ownerUserId: memberMeta.ownerUserId,
        airfarmingBalance: edge?.airfarmingBalance ?? 0,
        needed: edge?.needed ?? 0,
        lendAmount: edge?.lendAmount ?? null,
        lendStatus: edge?.lendStatus ?? null,
        pendingTransfer: edge?.pendingTransfer ?? false,
        activeTransfer: edge?.activeTransfer ?? false,
        servingSoon: edge?.servingSoon ?? false,
        dueAt: edge?.dueAt ?? null,
        hasDrop: Boolean(edge?.dueAt),
      };
    }

    return base;
  });

  const ghostOwnerCount = ghostAccounts.length;
  const ghostMemberCount = ghostMembers.length;
  const pendingTransfers = edges.filter((e) => e.pendingTransfer).length;
  const servingSoonCount = edges.filter((e) => e.servingSoon).length;

  return {
    nodes,
    edges,
    stats: {
      totalUsers: nodes.length,
      ghostOwners: ghostOwnerCount,
      ghostMembers: ghostMemberCount,
      unconnected: nodes.filter((n) => !n.connected).length,
      pendingTransfers,
      servingSoonCount,
    },
    pollIntervalSec: 5,
  };
}

module.exports = {
  GHOST_MIN_ELIGIBILITY_USD,
  GHOST_MIN_ALLOCATION_USD,
  enrollGhostAccount,
  allocateToPool,
  deallocateFromPool,
  lookupMemberByExactEmail,
  addGhostMember,
  removeGhostMember,
  setGhostAccountPaused,
  buildGhostAccountStatus,
  getGhostAccountBalance,
  buildGhostMembershipStatus,
  processGhostLendQueue,
  processAllGhostLendQueues,
  recallLendForDrop,
  processGhostRecallQueue,
  isDropGhostFunded,
  getGhostSponsorAccountIdForMember,
  syncScheduledLendsForAccount,
  maskEmail,
  listGhostAccountsAdminSummary,
  getGhostRevenueAdminStats,
  buildGhostNetworkAdmin,
  buildGhostParticleNetworkAdmin,
  getGhostOwnerJournalMonth,
  getGhostOwnerJournalDay,
};
