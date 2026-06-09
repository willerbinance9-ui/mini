export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type ApiEndpoint = {
  id: string;
  method: HttpMethod;
  path: string;
  scope?: string;
  summary: string;
  bodyTemplate?: string;
  queryParams?: string;
  pathParams?: string[];
};

export const endpoints: ApiEndpoint[] = [
  {
    id: "partner-me",
    method: "GET",
    path: "/v1/partner/me",
    summary: "Get authenticated partner metadata",
  },
  {
    id: "webhooks-get",
    method: "GET",
    path: "/v1/partner/webhooks",
    scope: "webhooks",
    summary: "Get webhook configuration",
  },
  {
    id: "webhooks-put",
    method: "PUT",
    path: "/v1/partner/webhooks",
    scope: "webhooks",
    summary: "Update webhook configuration",
    bodyTemplate: JSON.stringify(
      {
        url: "https://your-app.com/ema/webhooks",
        enabled: true,
        events: ["deposit.credited", "withdrawal.finished"],
      },
      null,
      2
    ),
  },
  {
    id: "webhooks-test",
    method: "POST",
    path: "/v1/partner/webhooks/test",
    scope: "webhooks",
    summary: "Send test webhook event",
  },
  {
    id: "users-create",
    method: "POST",
    path: "/v1/partner/users",
    scope: "users",
    summary: "Create partner user",
    bodyTemplate: JSON.stringify(
      {
        email: "user@partner.com",
        password: "secret12",
        externalRef: "usr_42",
      },
      null,
      2
    ),
  },
  {
    id: "users-by-ref",
    method: "GET",
    path: "/v1/partner/users",
    scope: "users",
    summary: "Lookup user by external ref",
    queryParams: "external_ref=usr_42",
  },
  {
    id: "users-get",
    method: "GET",
    path: "/v1/partner/users/{id}",
    scope: "users",
    summary: "Get user by id",
    pathParams: ["id"],
  },
  {
    id: "users-session",
    method: "POST",
    path: "/v1/partner/users/{id}/session",
    scope: "users",
    summary: "Mint user JWT session",
    pathParams: ["id"],
  },
  {
    id: "compliance-get",
    method: "GET",
    path: "/v1/partner/users/{id}/compliance",
    scope: "compliance",
    summary: "Get compliance profile",
    pathParams: ["id"],
  },
  {
    id: "compliance-put",
    method: "PUT",
    path: "/v1/partner/users/{id}/compliance",
    scope: "compliance",
    summary: "Submit compliance profile",
    pathParams: ["id"],
    bodyTemplate: JSON.stringify(
      {
        legalFirstName: "Jane",
        legalLastName: "Doe",
        country: "US",
        profession: "Engineer",
        sourceOfFunds: "employment",
        plannedInvestmentAmount: 5000,
        plannedInvestmentCurrency: "usd",
        plannedInvestmentDuration: "1_3y",
        acceptedTerms: true,
      },
      null,
      2
    ),
  },
  {
    id: "wallet-get",
    method: "GET",
    path: "/v1/partner/users/{id}/wallet",
    scope: "wallet",
    summary: "Wallet balances and activity",
    pathParams: ["id"],
  },
  {
    id: "deposits-list",
    method: "GET",
    path: "/v1/partner/users/{id}/deposits",
    scope: "deposits",
    summary: "List deposits",
    pathParams: ["id"],
    queryParams: "limit=20",
  },
  {
    id: "deposits-create",
    method: "POST",
    path: "/v1/partner/users/{id}/deposits",
    scope: "deposits",
    summary: "Create crypto deposit",
    pathParams: ["id"],
    bodyTemplate: JSON.stringify(
      {
        priceAmount: 100,
        priceCurrency: "usd",
        payCurrency: "usdttrc20",
      },
      null,
      2
    ),
  },
  {
    id: "deposits-get",
    method: "GET",
    path: "/v1/partner/users/{id}/deposits/{depositId}",
    scope: "deposits",
    summary: "Get deposit status",
    pathParams: ["id", "depositId"],
  },
  {
    id: "withdrawals-list",
    method: "GET",
    path: "/v1/partner/users/{id}/withdrawals",
    scope: "withdrawals",
    summary: "List withdrawals",
    pathParams: ["id"],
    queryParams: "limit=20",
  },
  {
    id: "withdrawals-create",
    method: "POST",
    path: "/v1/partner/users/{id}/withdrawals",
    scope: "withdrawals",
    summary: "Create withdrawal",
    pathParams: ["id"],
    bodyTemplate: JSON.stringify(
      {
        currency: "usdttrc20",
        address: "TYourTronAddress",
        amount: 50,
      },
      null,
      2
    ),
  },
  {
    id: "withdrawals-get",
    method: "GET",
    path: "/v1/partner/users/{id}/withdrawals/{withdrawalId}",
    scope: "withdrawals",
    summary: "Get withdrawal status",
    pathParams: ["id", "withdrawalId"],
  },
  {
    id: "whitelist-list",
    method: "GET",
    path: "/v1/partner/users/{id}/whitelist-wallets",
    scope: "wallet",
    summary: "List whitelisted wallets",
    pathParams: ["id"],
  },
  {
    id: "whitelist-create",
    method: "POST",
    path: "/v1/partner/users/{id}/whitelist-wallets",
    scope: "wallet",
    summary: "Add whitelisted wallet",
    pathParams: ["id"],
    bodyTemplate: JSON.stringify(
      {
        currency: "usdttrc20",
        address: "TYourTronAddress",
        label: "Main wallet",
      },
      null,
      2
    ),
  },
  {
    id: "whitelist-delete",
    method: "DELETE",
    path: "/v1/partner/users/{id}/whitelist-wallets/{walletId}",
    scope: "wallet",
    summary: "Remove whitelisted wallet",
    pathParams: ["id", "walletId"],
  },
  {
    id: "airfarming-status",
    method: "GET",
    path: "/v1/partner/users/{id}/airfarming/status",
    scope: "airfarming",
    summary: "Full airfarming drop status",
    pathParams: ["id"],
  },
  {
    id: "vip-get",
    method: "GET",
    path: "/v1/partner/users/{id}/vip",
    scope: "vip",
    summary: "VIP farmer summary",
    pathParams: ["id"],
  },
  {
    id: "partner-stats",
    method: "GET",
    path: "/v1/partner/stats",
    summary: "Partner tenant stats (user count, webhook, commission rate)",
  },
  {
    id: "partner-commission",
    method: "GET",
    path: "/v1/partner/commission",
    summary: "Partner commission accrual summary",
  },
  {
    id: "live-trading-partner",
    method: "GET",
    path: "/v1/partner/users/{id}/live-trading",
    scope: "wallet",
    summary: "Live trading account summaries for partner user",
    pathParams: ["id"],
  },
  {
    id: "ghost-partner",
    method: "GET",
    path: "/v1/partner/users/{id}/ghost-account",
    scope: "airfarming",
    summary: "Ghost account pool status for partner user",
    pathParams: ["id"],
  },
];

/** End-user routes (require session JWT minted via partner API). */
export const userJwtEndpoints: ApiEndpoint[] = [
  {
    id: "live-trading-accounts",
    method: "GET",
    path: "/live-trading/accounts",
    summary: "List user's MT5 live accounts",
  },
  {
    id: "live-trading-fund",
    method: "POST",
    path: "/live-trading/accounts/{accountId}/fund",
    summary: "Move cash wallet → live trading wallet",
    pathParams: ["accountId"],
    bodyTemplate: JSON.stringify({ amount: 500 }, null, 2),
  },
  {
    id: "ghost-status",
    method: "GET",
    path: "/ghost-account/status",
    summary: "Ghost account pool, members, lends",
  },
  {
    id: "ghost-enroll",
    method: "POST",
    path: "/ghost-account/enroll",
    summary: "Enroll in ghost account program",
    bodyTemplate: "{}",
  },
  {
    id: "airfarming-activate",
    method: "POST",
    path: "/airfarming/activate",
    summary: "Activate airfarming balance from cash",
    bodyTemplate: JSON.stringify({ amount: 1000 }, null, 2),
  },
];

export function buildCurl(
  base: string,
  method: HttpMethod,
  path: string,
  apiKey: string,
  body?: string
): string {
  const url = `${base}${path}`;
  let cmd = `curl -X ${method} '${url}' \\\n  -H 'Authorization: Bearer ${apiKey || "ema_pk_YOUR_KEY"}'`;
  if (body && method !== "GET" && method !== "DELETE") {
    cmd += ` \\\n  -H 'Content-Type: application/json' \\\n  -d '${body.replace(/'/g, "'\\''")}'`;
  }
  return cmd;
}
