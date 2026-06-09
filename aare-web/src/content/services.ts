export type Service = {
  slug: string;
  title: string;
  tagline: string;
  summary: string;
  description: string;
  howItWorks: { step: string; detail: string }[];
  apiAccess: string;
  userFlow: string[];
};

export const PARTNER_COMMISSION_RATE = 0.05;

export const PARTNER_COMMISSION_TEXT =
  "API partners earn a 5% commission on income generated through every income program embedded via the Partner API — live trading wallet activity, airfarming drops, ghost account lending, and VIP farmer accruals.";

export const services: Service[] = [
  {
    slug: "live-trading",
    title: "Live Trading",
    tagline: "Trade using your wallet",
    summary:
      "Fund MT5 live accounts from the user's cash wallet. Expert bots run positions; profits and balances sync back to your app.",
    description:
      "Live Trading connects each user's Min cash wallet to a provisioned MT5 account. Partners onboard users via the API, users deposit from wallet to their trading account, and automated expert advisors manage positions on live markets. Balances, open profit, and positions are available for dashboards you build.",
    howItWorks: [
      {
        step: "Fund the wallet",
        detail:
          "User deposits crypto via AarePaymentApi. Cash wallet balance is the source of funds for live trading.",
      },
      {
        step: "Open a live account",
        detail:
          "User creates a platform-provisioned MT5 account (login allocated automatically). Choose bot type and leverage within platform limits.",
      },
      {
        step: "Transfer to trading",
        detail:
          "Move USD from cash wallet into the live trading wallet linked to the MT5 account. Minimum deposit rules apply per bot.",
      },
      {
        step: "Bots trade live",
        detail:
          "Expert advisors execute on connected markets. Open positions, equity, and P/L update via the MT5 bridge.",
      },
      {
        step: "Return to cash",
        detail:
          "Users can close positions and return trading balance to cash wallet for withdrawals or other products.",
      },
    ],
    apiAccess:
      "Mint a user session JWT, then call /live-trading/accounts, fund, summary, positions, and prices. Partner API exposes wallet and deposit endpoints to fund users before trading.",
    userFlow: [
      "POST /v1/partner/users → create user",
      "POST /deposits → fund wallet",
      "POST /v1/partner/users/:id/session → mint JWT",
      "GET /live-trading/accounts → list accounts",
      "POST /live-trading/accounts/:id/fund → move cash to trading",
    ],
  },
  {
    slug: "airfarming",
    title: "Airfarming",
    tagline: "Scheduled yield drops",
    summary:
      "Users activate an airfarming balance from cash wallet. Weekly drops pay yield based on eligibility recorded 24h before each window.",
    description:
      "Airfarming is Min's core yield product. Users move funds from cash wallet into a dedicated airfarming balance. The platform schedules drops with AI-assisted allocation bands. Eligibility is snapshotted 24 hours before each drop window. Paid, missed, and upcoming drops are fully queryable for your custom UI.",
    howItWorks: [
      {
        step: "Activate balance",
        detail: "Transfer USD from cash wallet into the airfarming wallet. Users can also enable auto-fund from cash.",
      },
      {
        step: "Eligibility snapshot",
        detail:
          "24 hours before each drop, the platform records whether the user meets minimum balance and trust requirements.",
      },
      {
        step: "Drop window",
        detail:
          "During the scheduled window, the drop settles. Yield is credited to airfarming balance based on band percent and balance tier.",
      },
      {
        step: "Return or compound",
        detail: "Users can return airfarming balance to cash wallet or keep funds active for the next drop cycle.",
      },
      {
        step: "Partner visibility",
        detail:
          "GET /v1/partner/users/:id/airfarming/status returns nextDrop, history, trust score, and balances — same payload as the Min app.",
      },
    ],
    apiAccess:
      "Partner scope airfarming for server-side status. User JWT enables /airfarming/status, /airfarming/activate, /airfarming/return-to-cash, and auto-fund toggles.",
    userFlow: [
      "Fund cash wallet via deposits",
      "POST /airfarming/activate { amount }",
      "Poll GET /airfarming/status or partner airfarming/status",
      "POST /airfarming/return-to-cash when withdrawing yield",
    ],
  },
  {
    slug: "ghost-account",
    title: "Ghost Account",
    tagline: "Pool lending for member drops",
    summary:
      "Qualified owners fund a shared pool that automatically lends to member airfarming balances before drops — earning a share of member yield.",
    description:
      "Ghost Account is an advanced income program for high-balance partners. An owner enrolls when total USDT holdings exceed the platform threshold, allocates pool funds, and adds members. Before each member's scheduled drop, the pool lends the deficit needed so drops can settle. Lends are recalled with net profit returned to the pool.",
    howItWorks: [
      {
        step: "Enroll",
        detail:
          "Owner must hold more than $4,900 total USDT to enroll. A ghost account is created with pool_balance starting at zero.",
      },
      {
        step: "Allocate pool",
        detail: "Owner moves funds from cash wallet into the ghost pool (minimum allocation $5,000).",
      },
      {
        step: "Add members",
        detail:
          "Lookup members by email and attach them. Each member can only belong to one ghost account at a time.",
      },
      {
        step: "Automatic lends",
        detail:
          "Before each member drop, the system schedules a lend for any balance deficit. Pool funds top up the member's airfarming wallet.",
      },
      {
        step: "Recall & profit",
        detail:
          "After the drop settles, principal and net profit are recalled to the pool. Owner can deallocate or pause the account anytime.",
      },
    ],
    apiAccess:
      "User JWT routes: /ghost-account/status, enroll, allocate, deallocate, members CRUD, pause. Partner users created via API can enroll if they meet balance requirements.",
    userFlow: [
      "Meet USDT eligibility threshold",
      "POST /ghost-account/enroll",
      "POST /ghost-account/allocate { amount }",
      "POST /ghost-account/members { memberUserId }",
      "Monitor /ghost-account/status for lends and pool balance",
    ],
  },
  {
    slug: "vip-farmers",
    title: "VIP Farmers",
    tagline: "Locked-term investments",
    summary:
      "Users lock capital for a fixed term. Daily accruals compound until maturity. Partner API exposes portfolio summaries for dashboards.",
    description:
      "VIP Farmers is Min's locked-term investment product. Users commit funds for a defined period; the platform accrues daily interest until the lock completes. Partners query summaries server-side without holding user sessions for read-only portfolio views.",
    howItWorks: [
      {
        step: "Fund wallet",
        detail: "User deposits via partner API and holds sufficient cash or crypto balance.",
      },
      {
        step: "Open position",
        detail: "User enrolls in a VIP farmer product through the Min app or your embedded flow with user JWT.",
      },
      {
        step: "Daily accrual",
        detail: "Interest accrues each UTC day for the lock duration. Platform fee applies on accruals.",
      },
      {
        step: "Maturity",
        detail: "At lock end, principal and accrued yield return to the user's wallet per product rules.",
      },
      {
        step: "Partner API",
        detail: "GET /v1/partner/users/:id/vip returns position summary, days accrued, and projected totals.",
      },
    ],
    apiAccess:
      "Partner scope vip for GET /v1/partner/users/:id/vip. No separate user JWT guide required for read-only partner dashboards.",
    userFlow: [
      "Fund user wallet",
      "User enrolls via Min client (JWT)",
      "GET /v1/partner/users/:id/vip for dashboard",
    ],
  },
];

export const serviceBySlug = Object.fromEntries(services.map((s) => [s.slug, s])) as Record<
  string,
  Service
>;
