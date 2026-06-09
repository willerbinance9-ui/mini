export type NavItem = {
  title: string;
  href: string;
  description?: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const docsNavigation: NavSection[] = [
  {
    title: "Getting started",
    items: [
      { title: "Introduction", href: "/docs", description: "Overview of the Partner API" },
      { title: "Quickstart", href: "/docs/quickstart" },
      { title: "Authentication", href: "/docs/authentication" },
      { title: "Partner commission", href: "/docs/commission" },
    ],
  },
  {
    title: "Services",
    items: [
      { title: "Live Trading", href: "/docs/live-trading" },
      { title: "Airfarming", href: "/docs/airfarming" },
      { title: "Ghost Account", href: "/docs/ghost-account" },
    ],
  },
  {
    title: "Guides",
    items: [
      { title: "Users", href: "/docs/users" },
      { title: "Compliance", href: "/docs/compliance" },
      { title: "Wallet", href: "/docs/wallet" },
      { title: "Deposits", href: "/docs/deposits" },
      { title: "Withdrawals", href: "/docs/withdrawals" },
      { title: "Airfarming", href: "/docs/airfarming" },
      { title: "VIP Farmers", href: "/docs/vip" },
      { title: "Webhooks", href: "/docs/webhooks" },
    ],
  },
  {
    title: "Reference",
    items: [
      { title: "API Reference", href: "/docs/api-reference" },
      { title: "Error codes", href: "/docs/errors" },
      { title: "Changelog", href: "/changelog" },
    ],
  },
  {
    title: "Tools",
    items: [
      { title: "API Explorer", href: "/explorer" },
      { title: "Partner Dashboard", href: "/dashboard" },
      { title: "Webhook Playground", href: "/webhooks/playground" },
      { title: "OpenAPI spec", href: "/openapi" },
      { title: "Postman collection", href: "/postman-collection.json" },
      { title: "Request Partnership", href: "/partnership" },
    ],
  },
  {
    title: "Resources",
    items: [
      { title: "Compare services", href: "/compare" },
      { title: "Pricing", href: "/pricing" },
      { title: "Case studies", href: "/case-studies" },
      { title: "Security", href: "/security" },
      { title: "Status", href: "/status" },
      { title: "Sandbox", href: "/docs/sandbox" },
      { title: "User JWT routes", href: "/docs/user-jwt" },
    ],
  },
];

export const allDocLinks = docsNavigation.flatMap((s) => s.items);
