import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PricingPackages } from "@/components/PricingPackages";
import { commissionPayoutNotes } from "@/content/pricing";

export const metadata = {
  title: "Pricing",
  description: "Partner API monthly packages — airfarming, VIP, and full platform access.",
};

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold sm:text-4xl">Pricing</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Monthly API packages for approved partners. Commission on embedded income programs is separate at 5%.
        </p>

        <div className="mt-12">
          <PricingPackages />
        </div>

        <section className="mt-16">
          <h2 className="text-xl font-semibold">Commission payouts</h2>
          <ul className="mt-4 space-y-2 text-muted">
            {commissionPayoutNotes.map((n) => (
              <li key={n}>• {n}</li>
            ))}
          </ul>
        </section>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/signup"
            className="btn-shine rounded-full border border-foreground bg-foreground px-8 py-3 text-sm font-semibold text-background"
          >
            Create account
          </Link>
          <Link href="/partnership" className="rounded-full border border-card-border px-8 py-3 text-sm">
            Apply for access
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
