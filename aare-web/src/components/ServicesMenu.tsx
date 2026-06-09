"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { services } from "@/content/services";

export function ServicesMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg px-3 py-2 text-muted transition hover:bg-surface hover:text-foreground"
        aria-expanded={open}
        aria-haspopup="true"
      >
        Services
        <svg
          viewBox="0 0 12 12"
          className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-card-border bg-background p-2 shadow-2xl">
          <Link
            href="/services"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface"
          >
            All services
          </Link>
          <div className="my-1 h-px bg-card-border" />
          <Link
            href="/compare"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2.5 text-sm text-muted transition hover:bg-surface hover:text-foreground"
          >
            Compare all services
          </Link>
          <div className="my-1 h-px bg-card-border" />
          {services.map((s) => (
            <Link
              key={s.slug}
              href={`/services/${s.slug}`}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 transition hover:bg-surface"
            >
              <span className="block text-sm font-medium text-foreground">{s.title}</span>
              <span className="block text-xs text-muted">{s.tagline}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
