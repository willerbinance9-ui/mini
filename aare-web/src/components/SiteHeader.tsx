"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { ServicesMenu } from "./ServicesMenu";
import { useTheme } from "./ThemeProvider";
import { usePortalAuth } from "@/context/PortalAuthContext";
import { services } from "@/content/services";

const NAV_LINKS = [
  { href: "/docs", label: "Documentation" },
  { href: "/docs/api-reference", label: "API Reference" },
  { href: "/explorer", label: "Explorer" },
];

export function SiteHeader({ showSearch = false }: { showSearch?: boolean }) {
  const { theme, toggle } = useTheme();
  const { me, loading } = usePortalAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <motion.header
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-40 border-b border-card-border bg-background/90 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-1 text-sm md:flex">
          <ServicesMenu />
          {NAV_LINKS.map((link) => (
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
            href={!loading && me?.canApplyForApi && !me.application ? "/dashboard#apply" : "/partnership"}
            className="hidden rounded-lg border border-card-border px-3 py-2 text-xs text-muted transition hover:text-foreground lg:inline-block"
          >
            Apply for API
          </Link>
          <Link
            href="/explorer"
            className="btn-shine hidden rounded-full border border-foreground bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90 sm:inline-block"
          >
            Try API
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-card-border text-muted transition hover:text-foreground md:hidden"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            />
            <motion.nav
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="absolute left-0 right-0 top-16 z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-card-border bg-background px-4 py-4 shadow-2xl md:hidden"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Services</p>
              <div className="space-y-1">
                <Link
                  href="/services"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-surface"
                >
                  All services
                </Link>
                {services.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/services/${s.slug}`}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-surface hover:text-foreground"
                  >
                    {s.title}
                  </Link>
                ))}
              </div>

              <div className="my-4 h-px bg-card-border" />

              <div className="space-y-1">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-surface hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  href={!loading && me?.canApplyForApi && !me.application ? "/dashboard#apply" : "/partnership"}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-surface hover:text-foreground"
                >
                  Apply for API
                </Link>
                <Link
                  href="/explorer"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-surface"
                >
                  Try API
                </Link>
              </div>

              <div className="my-4 h-px bg-card-border" />

              <div className="flex flex-col gap-2">
                {!loading && me ? (
                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-full border border-foreground bg-foreground px-4 py-2.5 text-center text-sm font-semibold text-background"
                  >
                    Dashboard
                  </Link>
                ) : !loading ? (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMenuOpen(false)}
                      className="rounded-full border border-card-border px-4 py-2.5 text-center text-sm"
                    >
                      Log in
                    </Link>
                    <Link
                      href="/signup"
                      onClick={() => setMenuOpen(false)}
                      className="rounded-full border border-foreground bg-foreground px-4 py-2.5 text-center text-sm font-semibold text-background"
                    >
                      Sign up
                    </Link>
                  </>
                ) : null}
              </div>
            </motion.nav>
          </>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
