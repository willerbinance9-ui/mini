import Link from "next/link";

const columns = [
  {
    title: "Services",
    links: [
      { label: "Live Trading", href: "/services/live-trading" },
      { label: "Airfarming", href: "/services/airfarming" },
      { label: "Ghost Account", href: "/services/ghost-account" },
      { label: "Commission", href: "/services#commission" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "API reference", href: "/docs/api-reference" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "OpenAPI", href: "/openapi" },
    ],
  },
  {
    title: "Site",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Security", href: "/security" },
      { label: "Status", href: "/status" },
      { label: "Apply", href: "/partnership" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-card-border">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-semibold">Aare</p>
            <p className="mt-2 max-w-xs text-sm text-muted">
              Partner API documentation and onboarding for Min.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-medium text-muted">{col.title}</p>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-foreground/80 hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-10 border-t border-card-border pt-6 text-xs text-muted">© {new Date().getFullYear()} Aare</p>
      </div>
    </footer>
  );
}
