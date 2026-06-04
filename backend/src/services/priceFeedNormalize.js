function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizePriceBatch(body) {
  const raw = Array.isArray(body?.prices) ? body.prices : [];
  const out = [];
  const seen = new Set();
  for (const row of raw.slice(0, 200)) {
    if (!row || typeof row !== 'object') continue;
    const symbol = String(row.symbol || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9._-]/g, '');
    if (!symbol || seen.has(symbol)) continue;
    const bid = Number(row.bid);
    const ask = Number(row.ask);
    if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0 || ask < bid) continue;
    let digits = Number(row.digits);
    if (!Number.isFinite(digits) || digits < 0 || digits > 8) digits = 5;
    seen.add(symbol);
    out.push({
      symbol,
      bid,
      ask,
      digits: Math.trunc(digits),
      dayHigh: numOrNull(row.dayHigh ?? row.day_high),
      dayLow: numOrNull(row.dayLow ?? row.day_low),
      dayOpen: numOrNull(row.dayOpen ?? row.day_open),
    });
  }
  return out;
}

function mapPriceRowForApi(p) {
  const bid = Number(p.bid);
  const ask = Number(p.ask);
  const digits = Number(p.digits || 5);
  const dayOpen = p.day_open != null ? Number(p.day_open) : null;
  const dayHigh = p.day_high != null ? Number(p.day_high) : null;
  const dayLow = p.day_low != null ? Number(p.day_low) : null;
  let changePts = null;
  let changePct = null;
  if (dayOpen != null && dayOpen > 0 && Number.isFinite(bid)) {
    changePts = bid - dayOpen;
    changePct = (changePts / dayOpen) * 100;
  }
  return {
    symbol: p.symbol,
    bid,
    ask,
    digits,
    spread: Math.round((ask - bid) * Math.pow(10, digits)) / Math.pow(10, digits),
    dayHigh,
    dayLow,
    dayOpen,
    changePts,
    changePct,
    updatedAt: p.updated_at,
  };
}

module.exports = { normalizePriceBatch, mapPriceRowForApi };
