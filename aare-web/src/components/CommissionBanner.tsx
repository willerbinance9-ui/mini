import Link from "next/link";
import { PARTNER_COMMISSION_RATE, PARTNER_COMMISSION_TEXT } from "@/content/services";

export function CommissionBanner({ id }: { id?: string }) {
  const pct = `${PARTNER_COMMISSION_RATE * 100}%`;

  return (
    <section id={id} className="border-y border-card-border bg-surface/50 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Partner revenue</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              {pct} commission on every income program
            </h2>
            <p className="mt-4 max-w-lg text-muted leading-relaxed">{PARTNER_COMMISSION_TEXT}</p>
            <Link
              href="/partnership"
              className="btn-shine mt-8 inline-block rounded-full border border-foreground bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
            >
              Apply for API access
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { name: "Live Trading", note: "Wallet-funded MT5 accounts & bot P/L" },
              { name: "Airfarming", note: "Scheduled drop yield credited to users" },
              { name: "Ghost Account", note: "Pool lending profit on member drops" },
              { name: "VIP Farmers", note: "Locked-term accrual income" },
            ].map((item) => (
              <div
                key={item.name}
                className="rounded-2xl border border-card-border bg-background p-5 transition hover:border-foreground/30"
              >
                <p className="text-sm font-semibold text-foreground">{item.name}</p>
                <p className="mt-1 text-xs text-muted">{item.note}</p>
                <p className="mt-3 font-mono text-lg font-bold text-foreground">{pct}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
