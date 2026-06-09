import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { pricingTiers, commissionPayoutNotes } from "@/content/pricing";

export const metadata = {
  title: "Pricing",
  description: "Partner API pricing and 5% commission model.",
};

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold sm:text-4xl">Pricing</h1>
        <p className="mt-4 text-muted">Transparent partnership model — no hidden platform fees on API access.</p>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {pricingTiers.map((tier) => (
            <div key={tier.name} className="flex flex-col rounded-2xl border border-card-border p-8">
              <h2 className="text-lg font-semibold">{tier.name}</h2>
              <p className="mt-2 text-2xl font-bold">{tier.price}</p>
              <p className="mt-3 text-sm text-muted">{tier.description}</p>
              <ul className="mt-6 flex-1 space-y-2 text-sm text-muted">
                {tier.features.map((f) => (
                  <li key={f}>— {f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <section className="mt-16">
          <h2 className="text-xl font-semibold">Commission payouts</h2>
          <ul className="mt-4 space-y-2 text-muted">
            {commissionPayoutNotes.map((n) => (
              <li key={n}>• {n}</li>
            ))}
          </ul>
        </section>
        <Link
          href="/partnership"
          className="btn-shine mt-10 inline-block rounded-full border border-foreground bg-foreground px-8 py-3 text-sm font-semibold text-background"
        >
          Apply for access
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
