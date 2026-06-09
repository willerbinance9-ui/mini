import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PricingPackages } from "@/components/PricingPackages";
import { commissionPayoutNotes } from "@/content/pricing";

export const metadata = {
  title: "Pricing",
  description: "Monthly API packages for Min partner integrations.",
};

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold">Pricing</h1>
        <p className="mt-3 max-w-xl text-muted">
          Monthly API fee by program scope. 5% commission on income through your tenant is additional.
        </p>

        <div className="mt-10">
          <PricingPackages />
        </div>

        <section className="mt-14">
          <h2 className="text-lg font-semibold">Commission</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {commissionPayoutNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="rounded-full border border-foreground bg-foreground px-6 py-2.5 text-sm font-medium text-background"
          >
            Create account
          </Link>
          <Link href="/docs" className="rounded-full border border-card-border px-6 py-2.5 text-sm text-muted">
            Documentation
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
