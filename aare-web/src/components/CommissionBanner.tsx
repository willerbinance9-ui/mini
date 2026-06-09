import Link from "next/link";
import { PARTNER_COMMISSION_RATE } from "@/content/services";

export function CommissionBanner({ id }: { id?: string }) {
  const pct = `${PARTNER_COMMISSION_RATE * 100}%`;

  return (
    <section id={id} className="border-y border-card-border bg-surface/30 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">{pct} on embedded income</h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
              When your users earn through trading, airfarming, ghost pools, or VIP products, you receive {pct} of that
              income stream. Calculated on gross attributed to your tenant.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-block rounded-full border border-foreground px-5 py-2 text-sm font-medium"
            >
              Get started
            </Link>
          </div>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {[
              ["Live trading", "MT5 wallet P/L"],
              ["Airfarming", "Drop yield"],
              ["Ghost account", "Pool lending"],
              ["VIP farmers", "Locked terms"],
            ].map(([name, note]) => (
              <li key={name} className="rounded-lg border border-card-border px-4 py-3">
                <span className="font-medium">{name}</span>
                <span className="mt-0.5 block text-xs text-muted">{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
