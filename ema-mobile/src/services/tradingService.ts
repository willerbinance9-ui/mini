import { api } from './api';

export type TradingDeal = {
  id: string;
  ticket: string;
  symbol: string;
  side: 'buy' | 'sell';
  volume: number;
  openPrice: number;
  closePrice: number | null;
  profit: number;
  swap: number;
  commission: number;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt: string | null;
};

export type TradingStatus = {
  balance: number;
  equity: number;
  openProfit: number;
  allocatedTotal: number;
  cashWallet: number;
  openDeals: TradingDeal[];
  history: TradingDeal[];
};

export const tradingService = {
  getStatus: () => api.get<TradingStatus>('/trading/status'),
  allocate: (amount: number) => api.post<TradingStatus>('/trading/allocate', { amount }),
  withdraw: (amount: number) => api.post<TradingStatus>('/trading/withdraw', { amount }),
};
