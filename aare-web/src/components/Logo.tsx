"use client";

import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
        <rect x="2" y="10" width="8" height="8" rx="1.5" fill="currentColor" className="text-foreground" />
        <rect x="18" y="10" width="8" height="8" rx="1.5" fill="currentColor" className="text-muted" />
        <path d="M10 14h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-muted" />
      </svg>
      <span className="text-lg font-bold tracking-tight text-foreground">Aare</span>
    </Link>
  );
}
