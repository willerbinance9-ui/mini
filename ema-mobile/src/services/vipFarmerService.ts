import { api } from './api';

export type VipInvestment = {
  id: string;
  principalUsd: number;
  startedAt: string;
  maturesAt: string;
  status: string;
  totalAccruedUsd: number;
  revenueWithdrawnUsd?: number;
  availableRevenueUsd?: number;
  daysAccrued: number;
  workingDays?: number;
  calendarDays?: number;
  daysLeft: number;
  matured: boolean;
  penaltyFreeToday?: boolean;
  dailyRate: number;
  lockDays: number;
  lockDaysCalendar?: number;
  lockDaysWorking?: number;
};

export type VipExitRequest = {
  id: string;
  mode: 'full_stop' | 'partial_continue';
  revenuePercent: number;
  destination: 'platform' | 'direct_wallet';
  walletAddress: string | null;
  netTotalUsd: number;
  netRevenueUsd: number;
  principalReturnUsd: number;
  penaltyUsd: number;
  gasFeesUsd: number;
  commissionUsd: number;
  gasRewardUsd: number;
  investmentExtraCreditUsd?: number;
  status: string;
  createdAt: string;
};

export type VipExitQuote = {
  investment: VipInvestment;
  mode: 'full_stop' | 'partial_continue';
  revenuePercent: number;
  destination: 'platform' | 'direct_wallet';
  walletAddress: string | null;
  principalUsd: number;
  revenueBaseUsd: number;
  revenueSelectedUsd: number;
  penaltyUsd: number;
  gasFeesUsd: number;
  commissionUsd: number;
  gasRewardUsd: number;
  netRevenueUsd: number;
  principalReturnUsd: number;
  investmentExtraCreditUsd: number;
  investmentExtraCreditEligible?: boolean;
  netTotalUsd: number;
  workingDays: number;
  calendarDays: number;
  penaltyFree: boolean;
  gasWorkingDays: number;
  gasFeeDescription: string;
  commissionDescription: string;
  gasRewardDescription: string;
  investmentExtraCreditDescription: string;
  penaltyDescription: string;
  thankYouMessage: string;
};

export type VipSummary = {
  cashWalletUsd: number;
  minInvestUsd: number;
  dailyRate: number;
  lockDays: number;
  lockDaysCalendar?: number;
  lockDaysWorking?: number;
  earlyPenaltyRate: number;
  exitPenaltyRate?: number;
  investment: VipInvestment | null;
  pendingExitRequest?: VipExitRequest | null;
};

export type VipExitMode = 'full_stop' | 'partial_continue';
export type VipExitDestination = 'platform' | 'direct_wallet';
export const VIP_EXIT_REVENUE_PERCENTS = [50, 60, 70, 80, 90, 100] as const;

export const vipFarmerService = {
  getSummary: () => api.get<VipSummary>('/vip-farmers/summary'),
  invest: (amount: number) =>
    api.post<{ investment: VipInvestment; cashWalletUsd: number }>('/vip-farmers/invest', { amount }),
  addCapital: (amount: number) =>
    api.post<{ investment: VipInvestment; cashWalletUsd: number; addedUsd: number; lockReset: boolean }>(
      '/vip-farmers/add-capital',
      { amount }
    ),
  previewExit: (payload: {
    mode: VipExitMode;
    revenuePercent: number;
    destination: VipExitDestination;
    walletAddress?: string;
  }) => api.post<VipExitQuote>('/vip-farmers/exit/preview', payload),
  submitExitRequest: (payload: {
    mode: VipExitMode;
    revenuePercent: number;
    destination: VipExitDestination;
    walletAddress?: string;
  }) =>
    api.post<{ request: VipExitRequest; quote: VipExitQuote }>('/vip-farmers/exit/request', payload),
  listExitRequests: () => api.get<{ requests: VipExitRequest[] }>('/vip-farmers/exit/requests'),
};
