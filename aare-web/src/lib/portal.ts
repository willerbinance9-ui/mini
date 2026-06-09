import { API_BASE } from "@/lib/constants";

export const PORTAL_TOKEN_KEY = "aare_portal_token";

export type PortalKyc = {
  id?: string;
  status: string;
  residenceCountry: string | null;
  residenceScope: string | null;
  documentType: string | null;
  hasFront: boolean;
  hasBack: boolean;
  rejectionReason: string | null;
  aiConfidence: number | null;
  submittedAt: string | null;
  reviewedAt: string | null;
};

export type PortalAccount = {
  id: string;
  email: string;
  fullName: string | null;
  phoneCountry: string | null;
  countryOfResidency: string | null;
  phoneVerified: boolean;
  partnerId: string | null;
  applicationId: string | null;
  createdAt: string;
};

export type PortalApplication = {
  id: string;
  status: string;
  fullName: string;
  email: string;
  country: string;
  intendedInvestment: number;
  paymentPreference: string;
  hasApiKnowledge: boolean;
  apiPlan: string | null;
  partnerId: string | null;
  adminNotes: string | null;
  source: string;
  submittedFrom: string;
  createdAt: string;
  updatedAt: string;
};

export type PortalMe = {
  account: PortalAccount;
  application: PortalApplication | null;
  partner: { id: string; name: string; slug: string; status: string } | null;
  partnerId: string | null;
  hasPartnerAccess: boolean;
  kyc: PortalKyc;
  kycStatus: string;
  canApplyForApi: boolean;
};

export type PortalOverview = {
  ready: boolean;
  message?: string;
  partner?: { id: string; name: string; slug: string; status: string };
  userCount?: number;
  commissionRate?: number;
  commission?: { commissionUsd: number; grossUsd: number; count: number };
  commissionEvents?: {
    event_type: string;
    gross_amount: number;
    partner_commission_amount: number;
    event_at: string;
  }[];
  totalCashUsd?: number;
  webhook?: { enabled: boolean; url: string | null; events: string[] };
  apiKeys?: {
    id: string;
    name: string;
    keyPrefix: string;
    scopes: string[];
    active: boolean;
    lastUsedAt: string | null;
    createdAt: string;
  }[];
  users?: {
    id: string;
    email: string;
    externalRef: string | null;
    accountStatus: string;
    createdAt: string;
    cashWalletUsd: number;
  }[];
};

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PORTAL_TOKEN_KEY);
}

export function setPortalToken(token: string) {
  localStorage.setItem(PORTAL_TOKEN_KEY, token);
}

export function clearPortalToken() {
  localStorage.removeItem(PORTAL_TOKEN_KEY);
}

async function portalFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (!(init?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `HTTP ${res.status}`);
  return body as T;
}

export async function portalRegister(payload: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  phoneCountry: string;
  countryOfResidency: string;
}) {
  return portalFetch<{
    token: string;
    account: PortalAccount;
    application: PortalApplication | null;
    kyc: PortalKyc;
    canApplyForApi: boolean;
  }>("/v1/public/portal/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function portalLogin(email: string, password: string) {
  return portalFetch<{
    token: string;
    account: PortalAccount;
    application: PortalApplication | null;
    kyc: PortalKyc;
    canApplyForApi: boolean;
  }>("/v1/public/portal/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function portalLoginStart(email: string, password: string) {
  return portalFetch<{ challengeId: string; maskedPhone: string; expiresInSec: number }>(
    "/v1/public/portal/login/start",
    { method: "POST", body: JSON.stringify({ email, password }) }
  );
}

export async function portalLoginVerify(challengeId: string, code: string) {
  return portalFetch<{
    token: string;
    account: PortalAccount;
    application: PortalApplication | null;
    kyc: PortalKyc;
    canApplyForApi: boolean;
  }>("/v1/public/portal/login/verify", {
    method: "POST",
    body: JSON.stringify({ challengeId, code }),
  });
}

export async function portalGetMe() {
  return portalFetch<PortalMe>("/v1/portal/me");
}

export async function portalGetOverview() {
  return portalFetch<PortalOverview>("/v1/portal/overview");
}

export async function portalGetKyc() {
  return portalFetch<{ kyc: PortalKyc; canApplyForApi: boolean }>("/v1/portal/kyc");
}

export async function portalSaveKycDraft(payload: {
  residenceCountry?: string;
  residenceScope?: string;
  documentType?: string;
}) {
  return portalFetch<{ kyc: PortalKyc }>("/v1/portal/kyc", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function portalUploadKycImages(form: FormData) {
  return portalFetch<{ kyc: PortalKyc }>("/v1/portal/kyc/upload", {
    method: "POST",
    body: form,
  });
}

export async function portalSubmitKyc() {
  return portalFetch<{ kyc: PortalKyc; canApplyForApi: boolean; aiReview?: { verdict: string; reasons: string[] } }>(
    "/v1/portal/kyc/submit",
    { method: "POST", body: JSON.stringify({}) }
  );
}

export const COUNTRY_OPTIONS = [
  { code: "US", name: "United States", dial: "1" },
  { code: "CA", name: "Canada", dial: "1" },
  { code: "GB", name: "United Kingdom", dial: "44" },
  { code: "UG", name: "Uganda", dial: "256" },
  { code: "RW", name: "Rwanda", dial: "250" },
  { code: "KE", name: "Kenya", dial: "254" },
  { code: "NG", name: "Nigeria", dial: "234" },
  { code: "ZA", name: "South Africa", dial: "27" },
  { code: "IN", name: "India", dial: "91" },
  { code: "AE", name: "United Arab Emirates", dial: "971" },
  { code: "DE", name: "Germany", dial: "49" },
  { code: "FR", name: "France", dial: "33" },
];
