import { api } from './api';
import type { Mt5Position } from '../types';

export type LiveTradingBotType = 'synthetix_ea' | 'quantix_ea';

export type LiveTradingAccount = {
  id: string;
  login: string;
  server: string;
  accountName: string;
  botType: LiveTradingBotType | null;
  botLabel: string;
  botMagic: number;
  leverage: number;
  isPlatformProvisioned: boolean;
  internalBalance: number;
  depositedBalance?: number;
  openProfit?: number;
  displayBalance?: number;
  cachedBalance: number | null;
  cachedEquity: number | null;
  cachedCurrency: string;
  balanceLastUpdatedAt: string | null;
  metaapiAccountId: string;
  createdAt: string;
  updatedAt: string;
};

export type MarketPriceRow = {
  symbol: string;
  bid: number;
  ask: number;
  digits: number;
  spread: number;
  dayHigh?: number | null;
  dayLow?: number | null;
  dayOpen?: number | null;
  changePts?: number | null;
  changePct?: number | null;
  updatedAt: string;
};

export const LIVE_TRADING_BOTS: { id: LiveTradingBotType; title: string; description: string; minDeposit: number }[] = [
  {
    id: 'synthetix_ea',
    title: 'Synthetix EA',
    description: 'Synthetic indices & derived markets automation',
    minDeposit: 1000,
  },
  {
    id: 'quantix_ea',
    title: 'Quantix EA',
    description: 'FX & metals quant strategy automation',
    minDeposit: 200,
  },
];

export const LIVE_TRADING_LEVERAGES = [50, 100, 200, 500, 1000, 2000] as const;

export const LIVE_TRADING_MIN_DEPOSIT: Record<LiveTradingBotType, number> = {
  synthetix_ea: 1000,
  quantix_ea: 200,
};

export function liveTradingMinDeposit(botType: LiveTradingBotType | null | undefined) {
  if (!botType) return 0;
  return LIVE_TRADING_MIN_DEPOSIT[botType] ?? 0;
}

export function accountDisplayBalance(acc: LiveTradingAccount) {
  return acc.displayBalance ?? acc.internalBalance ?? 0;
}

export const liveTradingService = {
  listAccounts: () =>
    api.get<{ accounts: LiveTradingAccount[]; server: string }>('/live-trading/accounts'),
  createAccount: (payload: {
    botType: LiveTradingBotType;
    accountName: string;
    password: string;
    leverage?: number;
  }) =>
    api.post<{ success: boolean; account: LiveTradingAccount; message: string }>(
      '/live-trading/accounts',
      payload
    ),
  getSummary: (accountId: string) =>
    api.get<{ account: LiveTradingAccount; cashWallet: number }>(
      `/live-trading/accounts/${encodeURIComponent(accountId)}/summary`
    ),
  fund: (accountId: string, amount: number) =>
    api.post<{ cashWallet: number; internalBalance: number; account: LiveTradingAccount }>(
      `/live-trading/accounts/${encodeURIComponent(accountId)}/fund`,
      { amount }
    ),
  returnToCash: (accountId: string, amount: number) =>
    api.post<{ cashWallet: number; internalBalance: number; account: LiveTradingAccount }>(
      `/live-trading/accounts/${encodeURIComponent(accountId)}/return-to-cash`,
      { amount }
    ),
  listPrices: (search?: string) => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return api.get<{ prices: MarketPriceRow[]; lastUpdated: string | null; count: number }>(
      `/live-trading/prices${q}`
    );
  },
  getPositions: (accountId: string) =>
    api.get<{ positions: Mt5Position[]; source?: string; snapshotAt?: string | null }>(
      `/live-trading/accounts/${encodeURIComponent(accountId)}/positions`
    ),
  closePosition: (accountId: string, positionId: string) =>
    api.post<{ ok: boolean; queued?: boolean }>(
      `/live-trading/accounts/${encodeURIComponent(accountId)}/positions/close`,
      { positionId }
    ),
};
