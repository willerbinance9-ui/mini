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

export type GhostBalanceBreakdown = {
  cashUsd: number;
  cryptoUsd: number;
  airfarmingUsd: number;
};

export type GhostAccountStatus = {
  enrolled: boolean;
  isMember?: boolean;
  membership?: GhostMembershipStatus | null;
  eligible: boolean;
  minEligibilityUsd: number;
  minAllocationUsd: number;
  totalUsdt: number;
  amountNeeded?: number;
  balanceBreakdown?: GhostBalanceBreakdown;
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

export type GhostMembershipStatus = {
  role: 'member';
  sponsorEmailMasked: string;
  sponsorAccountStatus: string;
  sponsorPoolBalance: number;
  sponsorPoolAvailable: number;
  joinedAt: string;
  activeLend: {
    lendId: string;
    status: string;
    lendAmount: number;
    dropId: string;
  } | null;
  recentLends: Array<{
    lendId: string;
    status: string;
    lendAmount: number;
    recalledProfitNet: number;
    recalledAt: string | null;
  }>;
};

export type GhostAccountBalance = {
  role: 'owner' | 'member' | 'none';
  owner: {
    accountId: string;
    status: string;
    poolBalance: number;
    poolAvailable: number;
    poolCommitted: number;
    allocatedTotal: number;
  } | null;
  member: GhostMembershipStatus | null;
};

function normalizeMembership(raw: any): GhostMembershipStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    role: 'member',
    sponsorEmailMasked: String(raw.sponsorEmailMasked || ''),
    sponsorAccountStatus: String(raw.sponsorAccountStatus || ''),
    sponsorPoolBalance: Number(raw.sponsorPoolBalance ?? 0),
    sponsorPoolAvailable: Number(raw.sponsorPoolAvailable ?? 0),
    joinedAt: String(raw.joinedAt || ''),
    activeLend: raw.activeLend
      ? {
          lendId: String(raw.activeLend.lendId),
          status: String(raw.activeLend.status),
          lendAmount: Number(raw.activeLend.lendAmount ?? 0),
          dropId: String(raw.activeLend.dropId),
        }
      : null,
    recentLends: Array.isArray(raw.recentLends)
      ? raw.recentLends.map((l: any) => ({
          lendId: String(l.lendId),
          status: String(l.status),
          lendAmount: Number(l.lendAmount ?? 0),
          recalledProfitNet: Number(l.recalledProfitNet ?? 0),
          recalledAt: l.recalledAt ? String(l.recalledAt) : null,
        }))
      : [],
  };
}

function normalizeBalance(raw: Record<string, unknown>): GhostAccountBalance {
  return {
    role: (raw.role as GhostAccountBalance['role']) || 'none',
    owner: raw.owner
      ? {
          accountId: String((raw.owner as any).accountId),
          status: String((raw.owner as any).status),
          poolBalance: Number((raw.owner as any).poolBalance ?? 0),
          poolAvailable: Number((raw.owner as any).poolAvailable ?? 0),
          poolCommitted: Number((raw.owner as any).poolCommitted ?? 0),
          allocatedTotal: Number((raw.owner as any).allocatedTotal ?? 0),
        }
      : null,
    member: normalizeMembership(raw.member),
  };
}

function normalizeStatus(raw: Record<string, unknown>): GhostAccountStatus {
  return {
    enrolled: Boolean(raw.enrolled),
    isMember: Boolean(raw.isMember),
    membership: normalizeMembership(raw.membership),
    eligible: Boolean(raw.eligible),
    minEligibilityUsd: Number(raw.minEligibilityUsd ?? 4900),
    minAllocationUsd: Number(raw.minAllocationUsd ?? 5000),
    totalUsdt: Number(raw.totalUsdt ?? 0),
    amountNeeded: Number(raw.amountNeeded ?? 0),
    balanceBreakdown: raw.balanceBreakdown
      ? {
          cashUsd: Number((raw.balanceBreakdown as any).cashUsd ?? 0),
          cryptoUsd: Number((raw.balanceBreakdown as any).cryptoUsd ?? 0),
          airfarmingUsd: Number((raw.balanceBreakdown as any).airfarmingUsd ?? 0),
        }
      : undefined,
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
  async getBalance(): Promise<GhostAccountBalance> {
    const data = await api.get<Record<string, unknown>>('/ghost-account/balance');
    return normalizeBalance(data);
  },

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
