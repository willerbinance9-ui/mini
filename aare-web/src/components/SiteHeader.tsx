"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "./Logo";
import { ServicesMenu } from "./ServicesMenu";
import { useTheme } from "./ThemeProvider";
import { usePortalAuth } from "@/context/PortalAuthContext";

export function SiteHeader({ showSearch = false }: { showSearch?: boolean }) {
  const { theme, toggle } = useTheme();
  const { me, loading } = usePortalAuth();

  return (
    <motion.header
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-40 border-b border-card-border bg-background/90 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 text-sm md:flex">
          <ServicesMenu />
          {[
            { href: "/docs", label: "Documentation" },
            { href: "/docs/api-reference", label: "API Reference" },
            { href: "/explorer", label: "Explorer" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-muted transition hover:bg-surface hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {showSearch ? (
            <button
              type="button"
              className="glass hidden rounded-lg px-3 py-2 text-xs text-muted sm:inline-flex"
              onClick={() => window.dispatchEvent(new CustomEvent("aare-open-search"))}
            >
              Search <kbd className="ml-2 rounded bg-surface px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
            </button>
          ) : null}
          <button
            type="button"
            onClick={toggle}
            className="glass rounded-lg px-3 py-2 text-xs text-muted transition hover:text-foreground"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          {!loading && me ? (
            <Link
              href="/dashboard"
              className="hidden rounded-lg border border-card-border px-3 py-2 text-xs text-muted transition hover:text-foreground sm:inline-block"
            >
              Dashboard
            </Link>
          ) : !loading ? (
            <>
              <Link
                href="/login"
                className="hidden rounded-lg border border-card-border px-3 py-2 text-xs text-muted transition hover:text-foreground sm:inline-block"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="hidden rounded-lg border border-card-border px-3 py-2 text-xs text-muted transition hover:text-foreground md:inline-block"
              >
                Sign up
              </Link>
            </>
          ) : null}
          <Link
            href="/partnership"
            className="hidden rounded-lg border border-card-border px-3 py-2 text-xs text-muted transition hover:text-foreground md:inline-block"
          >
            Apply for API
          </Link>
          <Link
            href="/explorer"
            className="btn-shine rounded-full border border-foreground bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90"
          >
            Try API
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
