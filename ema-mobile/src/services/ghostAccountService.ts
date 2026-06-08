import { api } from './api';

export type GhostAccountMember = {
  memberUserId: string;
  emailMasked: string;
  addedAt: string;
};

export type GhostUpcomingLend = {
  lendId: string;
  memberUserId: string;
  memberEmailMasked: string;
  dropId: string;
  dueAt: string | null;
  minBalance: number | null;
  maxBalance: number | null;
  percent: number | null;
  lendAmount: number;
  projectedProfitGross: number;
  projectedProfitNet: number;
  lendStatus: string;
  failReason: string | null;
  recalledPrincipal: number;
  recalledProfitNet: number;
  poolAvailableAfterLend: number | null;
};

export type GhostAccountStatus = {
  enrolled: boolean;
  eligible: boolean;
  minEligibilityUsd: number;
  minAllocationUsd: number;
  totalUsdt: number;
  account?: {
    id: string;
    status: string;
    poolBalance: number;
    allocatedTotal: number;
    poolCommitted: number;
    poolAvailable: number;
  };
  members?: GhostAccountMember[];
  upcomingLends?: GhostUpcomingLend[];
  recallHistory?: GhostUpcomingLend[];
  ledger?: Array<{
    id: string;
    direction: string;
    amount: number;
    createdAt: string;
    meta: Record<string, unknown>;
  }>;
  warnings?: Array<{ lendId: string; message: string }>;
  pollIntervalSec?: number;
};

export type GhostMemberLookup = {
  found: boolean;
  memberUserId: string;
  displayEmail: string;
};

function normalizeStatus(raw: Record<string, unknown>): GhostAccountStatus {
  return {
    enrolled: Boolean(raw.enrolled),
    eligible: Boolean(raw.eligible),
    minEligibilityUsd: Number(raw.minEligibilityUsd ?? 4900),
    minAllocationUsd: Number(raw.minAllocationUsd ?? 5000),
    totalUsdt: Number(raw.totalUsdt ?? 0),
    account: raw.account
      ? {
          id: String((raw.account as any).id),
          status: String((raw.account as any).status),
          poolBalance: Number((raw.account as any).poolBalance ?? 0),
          allocatedTotal: Number((raw.account as any).allocatedTotal ?? 0),
          poolCommitted: Number((raw.account as any).poolCommitted ?? 0),
          poolAvailable: Number((raw.account as any).poolAvailable ?? 0),
        }
      : undefined,
    members: Array.isArray(raw.members)
      ? raw.members.map((m: any) => ({
          memberUserId: String(m.memberUserId),
          emailMasked: String(m.emailMasked),
          addedAt: String(m.addedAt),
        }))
      : [],
    upcomingLends: Array.isArray(raw.upcomingLends)
      ? raw.upcomingLends.map(normalizeLend)
      : [],
    recallHistory: Array.isArray(raw.recallHistory)
      ? raw.recallHistory.map(normalizeLend)
      : [],
    ledger: Array.isArray(raw.ledger)
      ? raw.ledger.map((e: any) => ({
          id: String(e.id),
          direction: String(e.direction),
          amount: Number(e.amount ?? 0),
          createdAt: String(e.createdAt),
          meta: (e.meta as Record<string, unknown>) || {},
        }))
      : [],
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.map((w: any) => ({
          lendId: String(w.lendId),
          message: String(w.message),
        }))
      : [],
    pollIntervalSec: Number(raw.pollIntervalSec ?? 45),
  };
}

function normalizeLend(row: any): GhostUpcomingLend {
  return {
    lendId: String(row.lendId),
    memberUserId: String(row.memberUserId),
    memberEmailMasked: String(row.memberEmailMasked),
    dropId: String(row.dropId),
    dueAt: row.dueAt ? String(row.dueAt) : null,
    minBalance: row.minBalance != null ? Number(row.minBalance) : null,
    maxBalance: row.maxBalance != null ? Number(row.maxBalance) : null,
    percent: row.percent != null ? Number(row.percent) : null,
    lendAmount: Number(row.lendAmount ?? 0),
    projectedProfitGross: Number(row.projectedProfitGross ?? 0),
    projectedProfitNet: Number(row.projectedProfitNet ?? 0),
    lendStatus: String(row.lendStatus),
    failReason: row.failReason ? String(row.failReason) : null,
    recalledPrincipal: Number(row.recalledPrincipal ?? 0),
    recalledProfitNet: Number(row.recalledProfitNet ?? 0),
    poolAvailableAfterLend:
      row.poolAvailableAfterLend != null ? Number(row.poolAvailableAfterLend) : null,
  };
}

export const ghostAccountService = {
  async getStatus(): Promise<GhostAccountStatus> {
    const data = await api.get<Record<string, unknown>>('/ghost-account/status');
    return normalizeStatus(data);
  },

  async enroll(): Promise<GhostAccountStatus> {
    const data = await api.post<{ status: Record<string, unknown> }>('/ghost-account/enroll', {});
    return normalizeStatus(data.status);
  },

  async allocate(amount: number): Promise<GhostAccountStatus> {
    const data = await api.post<{ status: Record<string, unknown> }>('/ghost-account/allocate', {
      amount,
    });
    return normalizeStatus(data.status);
  },

  async deallocate(amount: number): Promise<GhostAccountStatus> {
    const data = await api.post<{ status: Record<string, unknown> }>('/ghost-account/deallocate', {
      amount,
    });
    return normalizeStatus(data.status);
  },

  async lookupMember(email: string): Promise<GhostMemberLookup> {
    return api.post<GhostMemberLookup>('/ghost-account/members/lookup', { email });
  },

  async addMember(memberUserId: string): Promise<GhostAccountStatus> {
    const data = await api.post<{ status: Record<string, unknown> }>('/ghost-account/members', {
      memberUserId,
    });
    return normalizeStatus(data.status);
  },

  async removeMember(memberUserId: string): Promise<GhostAccountStatus> {
    const data = await api.delete<{ status: Record<string, unknown> }>(
      `/ghost-account/members/${memberUserId}`
    );
    return normalizeStatus(data.status);
  },

  async setPaused(paused: boolean): Promise<GhostAccountStatus> {
    const data = await api.patch<{ status: Record<string, unknown> }>('/ghost-account/pause', {
      paused,
    });
    return normalizeStatus(data.status);
  },
};
