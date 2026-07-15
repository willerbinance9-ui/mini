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

export type VipLoan = {
  id: string;
  amountUsd: number;
  commissionRate: number;
  commissionUsd: number;
  disbursedUsd: number;
  lastMonthEarningsUsd: number;
  monthEarningsBaseUsd?: number;
  maxLoanUsd: number;
  outstandingUsd: number;
  repaidUsd: number;
  status: 'pending' | 'active' | 'repaid' | 'rejected';
  adminNote: string | null;
  payoutDestination?: 'platform' | 'direct_wallet';
  payoutWalletAddress?: string | null;
  borrowerTier?: 'standard' | 'new';
  haircutRate?: number;
  requestedAt: string;
  reviewedAt: string | null;
  disbursedAt: string | null;
  repaidAt: string | null;
  createdAt: string;
};

export type VipLoanStatus = {
  eligible: boolean;
  ineligibleReason: string | null;
  monthCompleted: boolean;
  accrualDays: number;
  minAccrualDays: number;
  minPrincipalUsd?: number;
  principalUsd?: number;
  lastMonthEarningsUsd: number;
  projectedMonthUsd?: number;
  monthEarningsBaseUsd?: number;
  borrowerTier?: 'standard' | 'new' | null;
  haircutRate?: number;
  maxLoanUsd: number;
  amountUsd?: number;
  commissionRate: number;
  commissionUsd?: number;
  disbursedUsd?: number;
  minLoanUsd: number;
  approvalMaxDays: number;
  approvalMaxBusinessDays?: number;
  openLoan: VipLoan | null;
  loans: VipLoan[];
  usageNote: string;
};

const REINVEST_COMMISSION_RATE = 0.3;

export function reinvestNetUsd(grossUsd: number) {
  return Math.round(grossUsd * (1 - REINVEST_COMMISSION_RATE) * 100) / 100;
}

export function reinvestCommissionUsd(grossUsd: number) {
  return Math.round(grossUsd * REINVEST_COMMISSION_RATE * 100) / 100;
}

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
  reinvest: (amount?: number) =>
    api.post<{
      investment: VipInvestment;
      cashWalletUsd: number;
      grossRevenueUsd: number;
      commissionUsd: number;
      reinvestedUsd: number;
      lockReset: boolean;
      message: string;
    }>('/vip-farmers/reinvest', amount != null ? { amount } : {}),
  getLoanStatus: () => api.get<VipLoanStatus>('/vip-farmers/loans/status'),
  requestLoan: (payload: {
    amount?: number;
    destination: 'platform' | 'direct_wallet';
    walletAddress?: string;
  }) => api.post<{ loan: VipLoan; message: string }>('/vip-farmers/loans/request', payload),
  repayLoan: (amount: number) =>
    api.post<{ loan: VipLoan; cashWalletUsd: number; fullyRepaid: boolean; message: string }>(
      '/vip-farmers/loans/repay',
      { amount }
    ),
};
