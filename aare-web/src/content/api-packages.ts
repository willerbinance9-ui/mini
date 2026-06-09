export const PRICE_CHANGE_NOTICE =
  "Listed prices are valid until 30 June 2026. We will email active partners before any change.";

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
    tagline: "Yield drops only",
    features: [
      "Airfarming programs",
      "Users, wallets, deposits",
      "Withdrawals & webhooks",
      "Compliance endpoints",
    ],
    scopes: ["users", "wallet", "airfarming", "deposits", "withdrawals", "compliance", "webhooks"],
  },
  {
    id: "airfarming_vip",
    name: "Airfarming + VIP",
    priceMonthly: 500,
    priceLabel: "$500",
    tagline: "Drops and VIP farmers",
    features: [
      "Everything in Airfarming",
      "VIP farmer products",
      "Same wallet & webhook stack",
    ],
    scopes: ["users", "wallet", "airfarming", "vip", "deposits", "withdrawals", "compliance", "webhooks"],
    highlighted: true,
  },
  {
    id: "full",
    name: "Full",
    priceMonthly: 700,
    priceLabel: "$700",
    tagline: "All programs",
    features: [
      "Airfarming + VIP",
      "Live trading (MT5)",
      "Ghost account pools",
      "Full API scopes",
    ],
    scopes: ["users", "wallet", "airfarming", "vip", "deposits", "withdrawals", "compliance", "webhooks", "live_trading", "ghost_account"],
  },
];

export function packageById(id: string | null | undefined): ApiPackage | null {
  return API_PACKAGES.find((p) => p.id === id) ?? null;
}
