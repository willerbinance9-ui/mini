/** User-facing labels — never expose payment provider names. */
export function formatLedgerSource(source: string): string {
  const s = String(source || '').toLowerCase();
  if (!s || s.includes('nowpayment') || s.includes('np_')) return 'Wallet';
  if (s.includes('local_deposit')) return 'Phone pay-in';
  if (s.includes('local_withdraw')) return 'Phone cash-out';
  if (s.includes('cash_wallet')) return 'Cash wallet';
  if (s.includes('deposit')) return 'Added funds';
  if (s.includes('withdraw') || s.includes('payout')) return 'Cash out';
  if (s.includes('airfarm')) return 'Airfarming';
  if (s.includes('contract')) return 'Contracts';
  if (s.includes('p2p_escrow_lock')) return 'P2P escrow';
  if (s.includes('p2p_escrow_release')) return 'P2P received';
  if (s.includes('p2p_escrow_refund')) return 'P2P refund';
  if (s.includes('p2p')) return 'P2P';
  return 'Transfer';
}

export const GAS_RESERVE_PERCENT = 0.05;
export const MIN_MOMO_USDT = 2;

export type WalletBalanceRow = { asset: string; available: string; reserved?: string };

export function isUsdtFamilyAsset(asset: string): boolean {
  const a = asset.toLowerCase();
  return a === 'usdt' || a.includes('usdt');
}

/** Whole units only in wallet UI (10.9999 → 10). */
export function formatWalletBalance(value: string | number): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '0';
  return String(Math.floor(n));
}

export function maxWithdrawableAmount(availableBalance: number): number {
  if (!Number.isFinite(availableBalance) || availableBalance <= 0) return 0;
  return Math.max(0, availableBalance * (1 - GAS_RESERVE_PERCENT));
}

export function sumUsdtFamilyAvailable(
  balances: { asset: string; available: string }[] | undefined,
  cashWalletUsd?: number
): number {
  let total = Number(cashWalletUsd ?? 0) || 0;
  for (const b of balances || []) {
    if (isUsdtFamilyAsset(b.asset)) total += Number(b.available ?? 0) || 0;
  }
  return total;
}

/** One USDT line (TRC20 + generic USDT + cash USD); other assets unchanged. */
export function aggregateBalancesForDisplay(
  balances: WalletBalanceRow[] | undefined,
  cashWalletUsd?: number
): WalletBalanceRow[] {
  const cash = Number(cashWalletUsd ?? 0) || 0;
  let usdtAvailable = cash;
  let usdtReserved = 0;
  let sawUsdtFamily = false;
  const other: WalletBalanceRow[] = [];

  for (const b of balances || []) {
    if (isUsdtFamilyAsset(b.asset)) {
      sawUsdtFamily = true;
      usdtAvailable += Number(b.available ?? 0) || 0;
      usdtReserved += Number(b.reserved ?? 0) || 0;
    } else {
      other.push({
        asset: b.asset,
        available: formatWalletBalance(b.available),
        reserved:
          b.reserved != null && Number(b.reserved) > 0 ? formatWalletBalance(b.reserved) : undefined,
      });
    }
  }

  const merged: WalletBalanceRow[] = [];
  if (sawUsdtFamily || cash > 0 || usdtReserved > 0) {
    merged.push({
      asset: 'usdt',
      available: formatWalletBalance(usdtAvailable),
      reserved: usdtReserved > 0 ? formatWalletBalance(usdtReserved) : undefined,
    });
  }

  return [...merged, ...other];
}

export function minFiatForMomo(usdtToFiatRate: number): number {
  const rate = Number(usdtToFiatRate);
  if (!Number.isFinite(rate) || rate <= 0) return 100;
  return Math.ceil(MIN_MOMO_USDT * rate);
}

export function findBalanceForNetwork(
  balances: { asset: string; available: string }[] | undefined,
  networkCode: string
): number {
  const code = networkCode.toLowerCase();
  if (code.includes('usdt')) {
    return sumUsdtFamilyAvailable(balances);
  }
  if (!balances?.length) return 0;
  const row =
    balances.find((b) => b.asset.toLowerCase() === code) ||
    balances.find((b) => b.asset.toLowerCase().includes(code));
  return Number(row?.available ?? 0) || 0;
}

/** Crypto ledger + cash wallet (USD) for USDT-family networks. */
export function combinedWithdrawableForNetwork(
  summary: { balances?: { asset: string; available: string }[]; cashWalletUsd?: number } | null | undefined,
  networkCode: string
): number {
  const code = networkCode.toLowerCase();
  if (code.includes('usdt')) {
    return sumUsdtFamilyAvailable(summary?.balances, summary?.cashWalletUsd);
  }
  return findBalanceForNetwork(summary?.balances, networkCode);
}
