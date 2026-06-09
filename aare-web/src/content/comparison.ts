export type ComparisonRow = {
  service: string;
  slug: string;
  minDeposit: string;
  risk: string;
  apiType: string;
  commission: string;
  userJwt: boolean;
  bestFor: string;
};

export const serviceComparison: ComparisonRow[] = [
  {
    service: "Live Trading",
    slug: "live-trading",
    minDeposit: "Bot-specific (from $100)",
    risk: "Market exposure",
    apiType: "Partner + User JWT",
    commission: "5%",
    userJwt: true,
    bestFor: "Active traders funding MT5 from wallet",
  },
  {
    service: "Airfarming",
    slug: "airfarming",
    minDeposit: "Platform minimum balance",
    risk: "Scheduled yield",
    apiType: "Partner + User JWT",
    commission: "5%",
    userJwt: true,
    bestFor: "Passive yield with weekly drop cycles",
  },
  {
    service: "Ghost Account",
    slug: "ghost-account",
    minDeposit: "$5,000 pool allocation",
    risk: "Pool lending",
    apiType: "User JWT",
    commission: "5%",
    userJwt: true,
    bestFor: "High-balance owners funding member drops",
  },
  {
    service: "VIP Farmers",
    slug: "vip-farmers",
    minDeposit: "Product minimum",
    risk: "Locked term",
    apiType: "Partner API",
    commission: "5%",
    userJwt: false,
    bestFor: "Long-horizon locked investments",
  },
];
