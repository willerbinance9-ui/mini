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
    out.push({ symbol, bid, ask, digits: Math.trunc(digits) });
  }
  return out;
}

module.exports = { normalizePriceBatch };
