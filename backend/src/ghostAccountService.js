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
} = require('./db');
const { computeProfit } = require('./airfarmingDrops');
const { ELIGIBILITY_SNAPSHOT_MS } = require('./airfarmingDropUtils');
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

async function computeTotalUsdtForUser(userId) {
  const [wallet, cryptoBalances] = await Promise.all([
    ensureWalletForUser(userId),
    getCryptoBalancesByUserId(userId),
  ]);
  const cash = Number.parseFloat(String(wallet.balance ?? 0)) || 0;
  const crypto = totalUsdtFamilyAvailable(cryptoBalances);
  return roundMoney(cash + crypto);
}

async function isGhostEnrollmentEligible(userId) {
  const total = await computeTotalUsdtForUser(userId);
  return total > GHOST_MIN_ELIGIBILITY_USD;
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

async function buildGhostAccountStatus(ownerUserId) {
  let account = await getGhostAccountByOwnerUserId(ownerUserId);
  const totalUsdt = await computeTotalUsdtForUser(ownerUserId);
  const eligible = totalUsdt > GHOST_MIN_ELIGIBILITY_USD;

  if (!account) {
    return {
      enrolled: false,
      eligible,
      minEligibilityUsd: GHOST_MIN_ELIGIBILITY_USD,
      minAllocationUsd: GHOST_MIN_ALLOCATION_USD,
      totalUsdt,
    };
  }

  if (account.status === 'active') {
    await processGhostLendQueue(account.id);
    account = await getGhostAccountById(account.id);
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
    eligible,
    minEligibilityUsd: GHOST_MIN_ELIGIBILITY_USD,
    minAllocationUsd: GHOST_MIN_ALLOCATION_USD,
    totalUsdt,
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
  processGhostLendQueue,
  processAllGhostLendQueues,
  recallLendForDrop,
  processGhostRecallQueue,
  isDropGhostFunded,
  getGhostSponsorAccountIdForMember,
  syncScheduledLendsForAccount,
  maskEmail,
};
