export const PRICE_CHANGE_NOTICE =
  "Prices shown are current as of today and may change on 30 June 2026. Existing partners will be notified before any adjustment.";

export type ApiPackageId = "airfarming_only" | "airfarming_vip" | "full";

export type ApiPackage = {
  id: ApiPackageId;
  name: string;
  priceMonthly: number;
  priceLabel: string;
  tagline: string;
  features: string[];
  scopes: string[];
  highlighted?: boolean;
};

export const API_PACKAGES: ApiPackage[] = [
  {
    id: "airfarming_only",
    name: "Airfarming",
    priceMonthly: 300,
    priceLabel: "$300",
    tagline: "Scheduled yield drops only",
    features: [
      "Airfarming drop programs",
      "User & wallet API",
      "Deposits & withdrawals",
      "Webhooks & compliance",
    ],
    scopes: ["users", "wallet", "airfarming", "deposits", "withdrawals", "compliance", "webhooks"],
  },
  {
    id: "airfarming_vip",
    name: "Airfarming + VIP",
    priceMonthly: 500,
    priceLabel: "$500",
    tagline: "Yield drops plus locked-term VIP farmers",
    features: [
      "Everything in Airfarming",
      "VIP farmer products",
      "Extended yield programs",
      "Priority onboarding support",
    ],
    scopes: ["users", "wallet", "airfarming", "vip", "deposits", "withdrawals", "compliance", "webhooks"],
    highlighted: true,
  },
  {
    id: "full",
    name: "Full platform",
    priceMonthly: 700,
    priceLabel: "$700",
    tagline: "Complete income stack for power partners",
    features: [
      "Everything in Airfarming + VIP",
      "Live trading (wallet-funded MT5)",
      "Ghost account pool lending",
      "All API scopes enabled",
    ],
    scopes: ["users", "wallet", "airfarming", "vip", "deposits", "withdrawals", "compliance", "webhooks", "live_trading", "ghost_account"],
  },
];

export function packageById(id: string | null | undefined): ApiPackage | null {
  return API_PACKAGES.find((p) => p.id === id) ?? null;
}
