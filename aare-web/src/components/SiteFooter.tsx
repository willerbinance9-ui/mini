import Link from "next/link";

const columns = [
  {
    title: "Services",
    links: [
      { label: "Live Trading", href: "/services/live-trading" },
      { label: "Airfarming", href: "/services/airfarming" },
      { label: "Ghost Account", href: "/services/ghost-account" },
      { label: "Partner commission", href: "/services#commission" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "API Reference", href: "/docs/api-reference" },
      { label: "Partner Dashboard", href: "/dashboard" },
      { label: "Webhook Playground", href: "/webhooks/playground" },
      { label: "OpenAPI", href: "/openapi" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Case studies", href: "/case-studies" },
      { label: "Security", href: "/security" },
      { label: "Status", href: "/status" },
      { label: "Request partnership", href: "/partnership" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-card-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-lg font-semibold tracking-tight text-foreground">Aare</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
              Build on Min. Embed live trading, airfarming, and ghost accounts through one Partner API.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">{col.title}</p>
              <ul className="mt-4 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-foreground/80 transition hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-card-border pt-8 text-xs text-muted sm:flex-row">
          <span>Powered by Aare</span>
          <span>Partner API infrastructure for investment-oriented builders</span>
        </div>
      </div>
    </footer>
  );
}
