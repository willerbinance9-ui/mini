import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PricingPackages } from "@/components/PricingPackages";
import { AnimatedReveal } from "@/components/AnimatedReveal";
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
        <AnimatedReveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Plans</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Pricing</h1>
          <p className="mt-3 max-w-xl text-muted">
            Monthly API fee by program scope. 5% commission on income through your tenant is additional.
          </p>
        </AnimatedReveal>

        <div className="mt-10">
          <PricingPackages />
        </div>

        <AnimatedReveal className="mt-14">
          <h2 className="text-lg font-semibold">Commission</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {commissionPayoutNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </AnimatedReveal>

        <AnimatedReveal className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="btn-shine rounded-full border border-foreground bg-foreground px-6 py-2.5 text-sm font-semibold text-background"
          >
            Create account
          </Link>
          <Link href="/docs" className="rounded-full border border-card-border px-6 py-2.5 text-sm text-muted hover:border-foreground">
            Documentation
          </Link>
        </AnimatedReveal>
      </main>
      <SiteFooter />
    </>
  );
}
