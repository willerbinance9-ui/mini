const {
  insertPlatformRevenueEvent,
  getPlatformRevenueEventBySource,
  listPlatformRevenueEventsAdmin,
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
    if (totals.byType[type]) bump(totals.byType[type]);
  }

  return totals;
}

async function getPlatformRevenueAdminStats({ recentLimit = 80 } = {}) {
  const rows = await listPlatformRevenueEventsAdmin({ limit: 10000 });
  const recent = rows.slice(0, Math.min(recentLimit, rows.length));
  return {
    rates: {
      airfarmingDrop: PLATFORM_FEE_DROP_RATE,
      withdrawal: PLATFORM_FEE_WITHDRAW_RATE,
      vipAccrual: PLATFORM_FEE_VIP_RATE,
    },
    summary: aggregateRevenueRows(rows),
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
};
