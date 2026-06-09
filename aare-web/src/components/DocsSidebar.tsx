"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { docsNavigation } from "@/lib/navigation";

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      <nav className="glass sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl p-4 text-sm">
        {docsNavigation.map((section) => (
          <div key={section.title} className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              {section.title}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block rounded-md px-2 py-1.5 transition-colors ${
                        active
                          ? "bg-accent/15 font-medium text-accent"
                          : "text-muted hover:bg-surface hover:text-foreground"
                      }`}
                    >
                      {item.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
