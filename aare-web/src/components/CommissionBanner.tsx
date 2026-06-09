"use client";

import Link from "next/link";
import { PARTNER_COMMISSION_RATE } from "@/content/services";
import { AnimatedReveal } from "./AnimatedReveal";

export function CommissionBanner({ id }: { id?: string }) {
  const pct = `${PARTNER_COMMISSION_RATE * 100}%`;

  return (
    <section id={id} className="border-y border-card-border bg-surface/50 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <AnimatedReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Partner revenue</p>
            <h2 className="text-heading mt-3 font-bold">{pct} on embedded income</h2>
            <p className="mt-4 max-w-lg text-muted leading-relaxed">
              When your users earn through trading, airfarming, ghost pools, or VIP products, you receive {pct} of that
              income stream. Calculated on gross attributed to your tenant.
            </p>
            <Link
              href="/signup"
              className="btn-shine mt-8 inline-block rounded-full border border-foreground bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
            >
              Get started
            </Link>
          </AnimatedReveal>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { name: "Live trading", note: "MT5 wallet P/L" },
              { name: "Airfarming", note: "Drop yield" },
              { name: "Ghost account", note: "Pool lending" },
              { name: "VIP farmers", note: "Locked terms" },
            ].map((item, i) => (
              <AnimatedReveal key={item.name} delay={i * 0.05}>
                <div className="card-hover rounded-2xl border border-card-border bg-background/60 p-5 backdrop-blur-sm">
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="mt-1 text-xs text-muted">{item.note}</p>
                  <p className="mt-3 font-mono text-lg font-bold text-emerald-400">{pct}</p>
                </div>
              </AnimatedReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
