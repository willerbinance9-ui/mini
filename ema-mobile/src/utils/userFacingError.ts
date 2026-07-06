const INTERNAL_PATTERNS = [
  /\bsupabase\b/i,
  /\bmt5\b/i,
  /\bmetaapi\b/i,
  /\bwebhook\b/i,
  /\bema\b/i,
  /\bbridge\b/i,
  /\btelemetry\b/i,
  /expert advisor/i,
  /\bemawebhook\b/i,
  /\bpricefeed\b/i,
  /\bnowpayments\b/i,
  /\btatum\b/i,
  /render\.com/i,
  /schema missing/i,
  /\bmigration\b/i,
  /api base url/i,
  /server returned html/i,
  /backend route/i,
  /\bpostgresql\b/i,
  /jwt_secret/i,
  /\bprovisioning\b/i,
  /authorization header/i,
  /\bbearer\b/i,
  /\bjwt\b/i,
  /\bjwttoken\b/i,
  /payout_description/i,
  /is not allowed/i,
];

export function sanitizeUserFacingError(raw: string, fallback = 'Something went wrong. Please try again.'): string {
  const text = String(raw || '').trim();
  if (!text) return fallback;
  const lower = text.toLowerCase();
  if (INTERNAL_PATTERNS.some((p) => p.test(lower))) return fallback;
  if (text.length > 140) return fallback;
  if (lower.includes('network request failed') || lower.includes('failed to fetch')) {
    return 'Unable to reach Min right now. Check your connection and try again.';
  }
  if (lower.includes('cannot delete') || lower.includes('cannot post')) {
    return 'This action is not available yet. Update the app or try again after the server has been updated.';
  }
  return text;
}

export function formatNetworkLabel(code: string): string {
  const c = String(code || '').toLowerCase();
  const map: Record<string, string> = {
    usdttrc20: 'USDT (TRC20)',
    btc: 'Bitcoin',
    eth: 'Ethereum',
    ltc: 'Litecoin',
    trx: 'TRON',
  };
  return map[c] || code.toUpperCase();
}
