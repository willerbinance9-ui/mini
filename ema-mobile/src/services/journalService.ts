import { api } from './api';

export type JournalBreakdown = {
  airfarming: number;
  vip: number;
  contracts: number;
  ghost: number;
};

export type JournalGhostContext = {
  role: 'owner';
  poolBalance: number;
  poolAvailable: number;
  poolCommitted: number;
  allocatedTotal: number;
  accountStatus: string;
};

export type JournalDaySummary = {
  date: string;
  totalUsd: number;
  hasProfit: boolean;
  breakdown: JournalBreakdown;
};

export type JournalMonthResponse = {
  year: number;
  month: number;
  monthTotalUsd: number;
  monthVipProfitUsd?: number;
  monthGhostProfitUsd?: number;
  profitDays: number;
  bestDay: { date: string; totalUsd: number } | null;
  days: Record<string, JournalDaySummary>;
  ghost: JournalGhostContext | null;
};

export type JournalDayItem = {
  id: string;
  source: 'airfarming' | 'vip' | 'contracts' | 'ghost';
  label: string;
  amountUsd: number;
  at: string;
};

export type JournalDayResponse = {
  date: string;
  totalUsd: number;
  hasProfit: boolean;
  breakdown: JournalBreakdown;
  items: JournalDayItem[];
  ghost: JournalGhostContext | null;
};

export const journalService = {
  getMonth: (year: number, month: number) =>
    api.get<JournalMonthResponse>(`/journal/month?year=${year}&month=${month}`),
  getDay: (date: string) => api.get<JournalDayResponse>(`/journal/day?date=${encodeURIComponent(date)}`),
};
