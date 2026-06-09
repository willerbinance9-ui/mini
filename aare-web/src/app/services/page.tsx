import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CommissionBanner } from "@/components/CommissionBanner";
import { services } from "@/content/services";

export const metadata = {
  title: "Services",
  description: "Live trading, airfarming, and ghost account programs on the Min Partner API.",
};

export default function ServicesPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-card-border">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <h1 className="max-w-2xl text-3xl font-bold sm:text-4xl">Programs you can embed</h1>
            <p className="mt-4 max-w-2xl text-muted">
              Each runs on Min infrastructure. You handle UX and user accounts; we run wallets, compliance, and
              settlement.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid gap-5 lg:grid-cols-3">
            {services.map((s) => (
              <Link
                key={s.slug}
                href={`/services/${s.slug}`}
                className="flex h-full flex-col rounded-xl border border-card-border p-6 hover:border-foreground/25"
              >
                <h2 className="font-semibold">{s.title}</h2>
                <p className="mt-2 text-xs text-muted">{s.tagline}</p>
                <p className="mt-3 flex-1 text-sm text-muted">{s.summary}</p>
              </Link>
            ))}
          </div>
        </section>

        <CommissionBanner id="commission" />

        <section className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
          <p className="text-muted">Need API access? Sign up and apply from your dashboard.</p>
          <Link href="/signup" className="mt-4 inline-block rounded-full border border-foreground px-6 py-2.5 text-sm font-medium">
            Create account
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
