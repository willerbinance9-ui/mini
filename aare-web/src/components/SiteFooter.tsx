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
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-x-8 lg:grid-cols-4 lg:gap-8">
          <div className="col-span-2 lg:col-span-1">
            <p className="text-sm font-semibold sm:text-base">Aare</p>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted sm:text-sm">
              Partner API documentation and onboarding for Min.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-medium text-muted sm:text-sm">{col.title}</p>
              <ul className="mt-2 space-y-1.5 sm:mt-3 sm:space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-xs text-foreground/80 hover:text-foreground sm:text-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-8 border-t border-card-border pt-5 text-[0.7rem] text-muted sm:mt-10 sm:pt-6 sm:text-xs">
          © {new Date().getFullYear()} Aare
        </p>
      </div>
    </footer>
  );
}
