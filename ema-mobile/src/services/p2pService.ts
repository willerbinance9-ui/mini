import { api } from './api';

export type P2pMerchantSide = 'sell_usdt' | 'buy_usdt';
export type P2pCounterpartyAction = 'buy' | 'sell';
export type P2pTradeStatus = 'pay_fiat' | 'confirming' | 'completed' | 'cancelled' | 'disputed';

export type P2pMerchantProfile = {
  userId: string;
  enabled: boolean;
  side: P2pMerchantSide;
  pricePerUsdt: number;
  fiatCurrency: string;
  countryCode: string;
  limitMinFiat: number;
  limitMaxFiat: number;
  paymentName: string;
  paymentPhone: string;
  bankName: string;
  bankAccount: string;
  notes: string;
  completedTrades: number;
  updatedAt?: string;
};

export type P2pOffer = {
  userId: string;
  displayName: string;
  merchantSide: P2pMerchantSide;
  counterpartyAction: P2pCounterpartyAction;
  pricePerUsdt: number;
  fiatCurrency: string;
  countryCode: string;
  limitMinFiat: number;
  limitMaxFiat: number;
  completedTrades: number;
  paymentMethods: string[];
};

export type FiatPayeeSnapshot = {
  name: string;
  phone: string;
  bankName?: string;
  bankAccount?: string;
  notes?: string;
};

export type P2pTrade = {
  id: string;
  merchantUserId: string;
  counterpartyUserId: string;
  merchantSide: P2pMerchantSide;
  fiatAmount: number;
  cryptoAmount: number;
  pricePerUsdt: number;
  fiatCurrency: string;
  countryCode: string;
  status: P2pTradeStatus;
  usdtSenderId: string;
  usdtReceiverId: string;
  fiatPayerId: string;
  fiatPayeeId: string;
  fiatPayee: FiatPayeeSnapshot | null;
  fiatSentAt?: string | null;
  completedAt?: string | null;
  disputedAt?: string | null;
  disputeNote?: string;
  createdAt: string;
  viewerRole: 'merchant' | 'counterparty' | null;
};

export type P2pMyProfileResponse = {
  profile: P2pMerchantProfile | null;
  /** Server P2P tables not deployed yet (503). */
  unavailable?: boolean;
};

async function fetchMyProfileSafe(): Promise<P2pMyProfileResponse> {
  try {
    return await api.get<P2pMyProfileResponse>('/p2p/my-profile');
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    if (err.status === 503) return { profile: null, unavailable: true };
    return { profile: null };
  }
}

export const p2pService = {
  getMyProfile: fetchMyProfileSafe,
  saveProfile: (body: Partial<P2pMerchantProfile> & { enabled: boolean; side: P2pMerchantSide }) =>
    api.put<{ profile: P2pMerchantProfile }>('/p2p/my-profile', body),
  listOffers: (countryCode?: string) =>
    api.get<{ offers: P2pOffer[] }>(
      countryCode ? `/p2p/offers?countryCode=${encodeURIComponent(countryCode)}` : '/p2p/offers'
    ),
  listTrades: () => api.get<{ trades: P2pTrade[]; active: P2pTrade[] }>('/p2p/trades'),
  getTrade: (id: string) => api.get<{ trade: P2pTrade }>(`/p2p/trades/${id}`),
  createTrade: (body: {
    merchantUserId: string;
    cryptoAmount?: number;
    fiatAmount?: number;
    totpCode: string;
    counterpartyPaymentName?: string;
    counterpartyPaymentPhone?: string;
    counterpartyBankName?: string;
    counterpartyBankAccount?: string;
  }) => api.post<{ trade: P2pTrade; message: string }>('/p2p/trades', body),
  markFiatSent: (id: string) => api.post<{ trade: P2pTrade; message: string }>(`/p2p/trades/${id}/mark-fiat-sent`, {}),
  confirmFiat: (id: string, totpCode: string) =>
    api.post<{ trade: P2pTrade; message: string }>(`/p2p/trades/${id}/confirm-fiat`, { totpCode }),
  cancelTrade: (id: string) => api.post<{ trade: P2pTrade; message: string }>(`/p2p/trades/${id}/cancel`, {}),
  disputeTrade: (id: string, note?: string) =>
    api.post<{ trade: P2pTrade; message: string }>(`/p2p/trades/${id}/dispute`, { note: note?.trim() || '' }),
};

export function isTotpRequiredError(e: unknown): boolean {
  const err = e as Error & { code?: string; status?: number };
  return err?.code === 'TOTP_REQUIRED' || (err?.status === 403 && /two-factor/i.test(String(err.message)));
}
