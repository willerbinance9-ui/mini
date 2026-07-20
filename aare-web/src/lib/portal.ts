import { BACKEND_ORIGIN, getFetchApiBase } from "@/lib/constants";

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

export type ApiPackageId = "airfarming_only" | "airfarming_vip" | "full";

export type PortalAccount = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  phoneCountry: string | null;
  countryOfResidency: string | null;
  phoneVerified: boolean;
  partnerId: string | null;
  applicationId: string | null;
  apiPackage: ApiPackageId | null;
  apiPackageSelectedAt: string | null;
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
  apiPackage: ApiPackageId | null;
  needsPackageSelection: boolean;
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

const FETCH_TIMEOUT_MS = 45_000;

async function portalFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (!(init?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${getFetchApiBase()}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      throw new Error("Request timed out. The API may be waking up — try again in a few seconds.");
    }
    throw new Error(`Cannot reach API (${BACKEND_ORIGIN}). Try again in a moment.`);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `HTTP ${res.status}`);
  return body as T;
}

type PortalAuthPayload = {
  token: string;
  account: PortalAccount;
  application: PortalApplication | null;
  kyc: PortalKyc;
  canApplyForApi: boolean;
};

export function portalMeFromAuth(res: PortalAuthPayload): PortalMe {
  const approved = res.application?.status === "approved";
  return {
    account: res.account,
    application: res.application,
    partner: null,
    partnerId: res.account.partnerId,
    hasPartnerAccess: false,
    kyc: res.kyc,
    kycStatus: res.kyc.status,
    canApplyForApi: res.canApplyForApi,
    apiPackage: res.account.apiPackage ?? null,
    needsPackageSelection: Boolean(approved && !res.account.apiPackage),
  };
}

export type AppPreference = "use_ours" | "own_build_for_me" | "own_independent_dev";

export type PackagePayment = {
  id: string;
  package: ApiPackageId;
  appPreference: AppPreference | null;
  amountUsd: number;
  status: string;
  invoiceUrl: string | null;
  paidAt: string | null;
  createdAt: string;
};

/** Starts a one-time NOWPayments checkout for the package. The choice is final after payment. */
export async function portalCheckoutApiPackage(packageId: ApiPackageId, appPreference: AppPreference) {
  return portalFetch<{ payment: PackagePayment }>("/v1/portal/api-package/checkout", {
    method: "POST",
    body: JSON.stringify({ package: packageId, appPreference }),
  });
}

export async function portalGetPackagePayment() {
  return portalFetch<{ payment: PackagePayment | null; apiPackage: ApiPackageId | null }>(
    "/v1/portal/api-package/payment"
  );
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

export type WithdrawalMethod = "bank" | "crypto";
export type WithdrawalFrequency = "weekly" | "biweekly" | "monthly" | "trimester";

export type InvestorProfile = {
  id?: string;
  motivation: string | null;
  investmentAmount: number | null;
  withdrawalMethod: WithdrawalMethod | null;
  withdrawalPercent: number | null;
  withdrawalFrequency: WithdrawalFrequency | null;
  hasPhoto: boolean;
  completedAt: string | null;
  updatedAt: string | null;
};

export type InvestorProfileResponse = {
  profile: InvestorProfile;
  complete: boolean;
};

export async function portalGetInvestorProfile() {
  return portalFetch<InvestorProfileResponse>("/v1/portal/profile");
}

export async function portalSaveInvestorProfile(payload: {
  motivation: string;
  investmentAmount: number;
  withdrawalMethod: WithdrawalMethod;
  withdrawalPercent: number;
  withdrawalFrequency: WithdrawalFrequency;
}) {
  return portalFetch<InvestorProfileResponse>("/v1/portal/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function portalUploadProfilePhoto(file: File) {
  const form = new FormData();
  form.append("photo", file);
  return portalFetch<InvestorProfileResponse>("/v1/portal/profile/photo", {
    method: "POST",
    body: form,
  });
}

/** Fetches the profile photo as an object URL (endpoint requires auth header, so <img src> can't load it directly). */
export async function portalFetchProfilePhotoUrl(): Promise<string | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${getFetchApiBase()}/v1/portal/profile/photo`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
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

export type PortalChatMessage = {
  id: string;
  sender: "partner" | "admin" | "ai";
  body: string;
  readAt: string | null;
  createdAt: string;
  offerAgent?: boolean;
};

export async function portalGetMessages() {
  return portalFetch<{ messages: PortalChatMessage[]; humanRequested: boolean; offerAgent?: boolean }>(
    "/v1/portal/messages"
  );
}

export async function portalGetUnreadCount() {
  return portalFetch<{ unread: number }>("/v1/portal/messages/unread");
}

export async function portalSendMessage(body: string) {
  return portalFetch<{
    message: PortalChatMessage;
    aiReply?: PortalChatMessage;
    humanRequested?: boolean;
    offerAgent?: boolean;
    aiPending?: boolean;
  }>("/v1/portal/messages", {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function portalRequestHuman() {
  return portalFetch<{ messages: PortalChatMessage[]; humanRequested: boolean }>(
    "/v1/portal/messages/handoff",
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
