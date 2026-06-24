const crypto = require('crypto');
const {
  ensureWalletForUser,
  setWalletBalance,
  ensureUserTradingWallet,
  upsertUserTradingWalletBalance,
  incrementUserTradingAllocatedTotal,
  getUserTradingWallet,
  listUserTradingDealsByUserId,
  getUserTradingDealById,
  insertUserTradingDeal,
  updateUserTradingDeal,
  deleteUserTradingDeal,
  isMissingTableError,
} = require('../db');

const SCHEMA_MSG =
  'Trading schema missing. Run backend/sql/migrations/20260703_user_trading.sql in Supabase.';

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function newTicket() {
  return String(Date.now()).slice(-10);
}

function dealToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    ticket: row.ticket,
    symbol: row.symbol,
    side: row.side,
    volume: Number(row.volume),
    openPrice: Number(row.open_price),
    closePrice: row.close_price != null ? Number(row.close_price) : null,
    profit: Number(row.profit),
    swap: Number(row.swap),
    commission: Number(row.commission),
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at || null,
  };
}

async function buildTradingStatus(userId) {
  const [cashWalletRow, tradingWallet, deals] = await Promise.all([
    ensureWalletForUser(userId),
    ensureUserTradingWallet(userId),
    listUserTradingDealsByUserId(userId),
  ]);

  const cashWallet = Number.parseFloat(String(cashWalletRow.balance ?? 0)) || 0;
  const balance = Number(tradingWallet.balance || 0);
  const openDeals = deals.filter((d) => d.status === 'open').map(dealToApi);
  const history = deals.filter((d) => d.status === 'closed').map(dealToApi);
  const openProfit = roundMoney(openDeals.reduce((s, d) => s + Number(d.profit || 0), 0));
  const equity = roundMoney(balance + openProfit);

  return {
    balance,
    equity,
    openProfit,
    allocatedTotal: Number(tradingWallet.allocated_total || 0),
    cashWallet,
    openDeals,
    history,
  };
}

async function allocateToTrading(userId, amount) {
  const amt = roundMoney(amount);
  if (!amt || amt <= 0) throw Object.assign(new Error('Invalid amount'), { status: 400 });

  const wallet = await ensureWalletForUser(userId);
  const cash = Number.parseFloat(String(wallet.balance ?? 0)) || 0;
  if (cash < amt) throw Object.assign(new Error('Insufficient cash wallet balance'), { status: 400 });

  const tradingWallet = await ensureUserTradingWallet(userId);
  const nextBal = roundMoney(Number(tradingWallet.balance || 0) + amt);

  await setWalletBalance(userId, cash - amt);
  await upsertUserTradingWalletBalance(userId, nextBal);
  await incrementUserTradingAllocatedTotal(userId, amt);

  return buildTradingStatus(userId);
}

async function withdrawFromTrading(userId, amount) {
  const amt = roundMoney(amount);
  if (!amt || amt <= 0) throw Object.assign(new Error('Invalid amount'), { status: 400 });

  const tradingWallet = await ensureUserTradingWallet(userId);
  const balance = Number(tradingWallet.balance || 0);
  if (balance < amt) throw Object.assign(new Error('Insufficient trading balance'), { status: 400 });

  const wallet = await ensureWalletForUser(userId);
  const cash = Number.parseFloat(String(wallet.balance ?? 0)) || 0;
  const nextBal = roundMoney(balance - amt);

  await upsertUserTradingWalletBalance(userId, nextBal);
  await setWalletBalance(userId, cash + amt);

  return buildTradingStatus(userId);
}

function parseDealInput(body, { requireStatus = true } = {}) {
  const symbol = String(body?.symbol || '').trim().toUpperCase();
  const side = String(body?.side || '').trim().toLowerCase();
  const volume = Number(body?.volume);
  const openPrice = Number(body?.openPrice ?? body?.open_price);
  const closePrice =
    body?.closePrice != null || body?.close_price != null
      ? Number(body?.closePrice ?? body?.close_price)
      : null;
  const profit = roundMoney(body?.profit ?? 0);
  const swap = roundMoney(body?.swap ?? 0);
  const commission = roundMoney(body?.commission ?? 0);
  const status = String(body?.status || 'open').trim().toLowerCase();
  const openedAt = body?.openedAt || body?.opened_at || new Date().toISOString();
  const closedAt = body?.closedAt || body?.closed_at || null;
  const ticket = String(body?.ticket || '').trim() || newTicket();

  if (!symbol) throw Object.assign(new Error('Symbol is required'), { status: 400 });
  if (!['buy', 'sell'].includes(side)) throw Object.assign(new Error('Side must be buy or sell'), { status: 400 });
  if (!volume || volume <= 0) throw Object.assign(new Error('Invalid volume'), { status: 400 });
  if (!openPrice || openPrice <= 0) throw Object.assign(new Error('Invalid open price'), { status: 400 });
  if (requireStatus && !['open', 'closed'].includes(status)) {
    throw Object.assign(new Error('Status must be open or closed'), { status: 400 });
  }
  if (status === 'closed' && (!closePrice || closePrice <= 0)) {
    throw Object.assign(new Error('Close price required for closed deals'), { status: 400 });
  }

  return {
    ticket,
    symbol,
    side,
    volume,
    open_price: openPrice,
    close_price: status === 'closed' ? closePrice : null,
    profit,
    swap,
    commission,
    status,
    opened_at: openedAt,
    closed_at: status === 'closed' ? closedAt || new Date().toISOString() : null,
  };
}

async function applyProfitDelta(userId, delta) {
  const d = roundMoney(delta);
  if (!d) return;
  const tradingWallet = await ensureUserTradingWallet(userId);
  const next = roundMoney(Number(tradingWallet.balance || 0) + d);
  if (next < 0) throw Object.assign(new Error('Trading balance would go negative'), { status: 400 });
  await upsertUserTradingWalletBalance(userId, next);
}

async function adminCreateDeal(userId, body) {
  const row = parseDealInput(body);
  await ensureUserTradingWallet(userId);
  const deal = await insertUserTradingDeal({ user_id: userId, ...row });
  if (row.status === 'closed') {
    await applyProfitDelta(userId, row.profit);
  }
  return dealToApi(deal);
}

async function adminUpdateDeal(userId, dealId, body) {
  const existing = await getUserTradingDealById(dealId, userId);
  if (!existing) throw Object.assign(new Error('Deal not found'), { status: 404 });

  const patch = {};
  if (body?.symbol != null) patch.symbol = String(body.symbol).trim().toUpperCase();
  if (body?.side != null) {
    const side = String(body.side).trim().toLowerCase();
    if (!['buy', 'sell'].includes(side)) throw Object.assign(new Error('Side must be buy or sell'), { status: 400 });
    patch.side = side;
  }
  if (body?.volume != null) {
    const volume = Number(body.volume);
    if (!volume || volume <= 0) throw Object.assign(new Error('Invalid volume'), { status: 400 });
    patch.volume = volume;
  }
  if (body?.openPrice != null || body?.open_price != null) {
    const openPrice = Number(body.openPrice ?? body.open_price);
    if (!openPrice || openPrice <= 0) throw Object.assign(new Error('Invalid open price'), { status: 400 });
    patch.open_price = openPrice;
  }
  if (body?.closePrice != null || body?.close_price != null) {
    patch.close_price = Number(body.closePrice ?? body.close_price);
  }
  if (body?.profit != null) patch.profit = roundMoney(body.profit);
  if (body?.swap != null) patch.swap = roundMoney(body.swap);
  if (body?.commission != null) patch.commission = roundMoney(body.commission);
  if (body?.openedAt != null || body?.opened_at != null) {
    patch.opened_at = body.openedAt || body.opened_at;
  }

  const nextStatus = body?.status != null ? String(body.status).trim().toLowerCase() : existing.status;
  if (!['open', 'closed'].includes(nextStatus)) {
    throw Object.assign(new Error('Status must be open or closed'), { status: 400 });
  }
  patch.status = nextStatus;

  if (nextStatus === 'closed') {
    const closePrice =
      patch.close_price != null ? patch.close_price : Number(existing.close_price || 0);
    if (!closePrice || closePrice <= 0) {
      throw Object.assign(new Error('Close price required for closed deals'), { status: 400 });
    }
    patch.close_price = closePrice;
    patch.closed_at =
      body?.closedAt || body?.closed_at || existing.closed_at || new Date().toISOString();
  } else {
    patch.close_price = null;
    patch.closed_at = null;
  }

  const wasClosed = existing.status === 'closed';
  const willClose = nextStatus === 'closed';
  const oldProfit = Number(existing.profit || 0);
  const newProfit = patch.profit != null ? patch.profit : oldProfit;

  if (wasClosed && willClose) {
    await applyProfitDelta(userId, newProfit - oldProfit);
  } else if (!wasClosed && willClose) {
    await applyProfitDelta(userId, newProfit);
  } else if (wasClosed && !willClose) {
    await applyProfitDelta(userId, -oldProfit);
  }

  patch.updated_at = new Date().toISOString();
  const deal = await updateUserTradingDeal(dealId, userId, patch);
  return dealToApi(deal);
}

async function adminDeleteDeal(userId, dealId) {
  const existing = await getUserTradingDealById(dealId, userId);
  if (!existing) throw Object.assign(new Error('Deal not found'), { status: 404 });
  if (existing.status === 'closed') {
    await applyProfitDelta(userId, -Number(existing.profit || 0));
  }
  await deleteUserTradingDeal(dealId, userId);
  return { ok: true };
}

async function adminGetTradingDesk(userId) {
  const status = await buildTradingStatus(userId);
  return status;
}

module.exports = {
  SCHEMA_MSG,
  isMissingTableError,
  buildTradingStatus,
  allocateToTrading,
  withdrawFromTrading,
  adminGetTradingDesk,
  adminCreateDeal,
  adminUpdateDeal,
  adminDeleteDeal,
  dealToApi,
};
