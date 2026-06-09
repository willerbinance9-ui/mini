import { API_PACKAGES, PRICE_CHANGE_NOTICE } from "@/content/api-packages";

export { PRICE_CHANGE_NOTICE };

export const pricingTiers = API_PACKAGES.map((p) => ({
  name: p.name,
  price: `${p.priceLabel} / month`,
  description: p.tagline,
  features: p.features,
}));

export const commissionPayoutNotes = [
  "Monthly package fee covers API access to selected service scopes.",
  "Partners also earn 5% commission on income generated through embedded programs.",
  "View accrued commission in the Partner Dashboard when your API key is active.",
];
