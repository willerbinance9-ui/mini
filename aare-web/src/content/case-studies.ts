export type CaseStudy = {
  slug: string;
  company: string;
  headline: string;
  metric: string;
  summary: string;
  services: string[];
  quote: string;
};

export const caseStudies: CaseStudy[] = [
  {
    slug: "yieldvault",
    company: "YieldVault",
    headline: "Embedded airfarming in 12 days",
    metric: "4,200+ users",
    summary:
      "YieldVault integrated partner user onboarding, crypto deposits, and airfarming status polling to offer scheduled yield inside their savings app — without building drop infrastructure.",
    services: ["Users API", "Deposits", "Airfarming", "Webhooks"],
    quote: "We shipped yield dashboards in two sprints. The Partner API handled compliance and payouts.",
  },
  {
    slug: "tradepulse",
    company: "TradePulse",
    headline: "Wallet-funded live trading",
    metric: "$2.1M deposited",
    summary:
      "TradePulse mints user sessions server-side, funds wallets via AarePaymentApi, and surfaces MT5 live account summaries for their trading community.",
    services: ["Live Trading", "Wallet", "Session JWT"],
    quote: "Our users fund from crypto and trade live without us touching MT5 provisioning.",
  },
  {
    slug: "poolline",
    company: "Poolline Capital",
    headline: "Ghost account for member networks",
    metric: "38 members funded",
    summary:
      "Poolline enrolled qualified owners into ghost accounts, allocating pools that automatically lend before member airfarming drops settle.",
    services: ["Ghost Account", "Airfarming", "Partner commission"],
    quote: "Pool lending used to be manual. Ghost accounts made it programmatic.",
  },
];
