import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CommissionBanner } from "@/components/CommissionBanner";
import { AnimatedReveal, StaggerGrid, StaggerItem } from "@/components/AnimatedReveal";
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
        <section className="relative border-b border-card-border">
          <div className="ambient-grid pointer-events-none absolute inset-0 opacity-30" />
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <AnimatedReveal className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Programs</p>
              <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Programs you can embed</h1>
              <p className="mt-4 text-muted">
                Each runs on Min infrastructure. You handle UX and user accounts; we run wallets, compliance, and
                settlement.
              </p>
            </AnimatedReveal>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <StaggerGrid className="grid gap-6 lg:grid-cols-3">
            {services.map((s) => (
              <StaggerItem key={s.slug}>
                <Link
                  href={`/services/${s.slug}`}
                  className="card-hover flex h-full flex-col rounded-2xl border border-card-border p-8"
                >
                  <p className="text-xs uppercase tracking-widest text-muted">{s.tagline}</p>
                  <h2 className="mt-3 text-xl font-bold">{s.title}</h2>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{s.summary}</p>
                  <span className="mt-6 text-sm font-medium">Learn more →</span>
                </Link>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </section>

        <CommissionBanner id="commission" />

        <section className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
          <AnimatedReveal>
            <div className="glass-strong glow-ring rounded-3xl p-10">
              <p className="text-muted">Need API access? Sign up and apply from your dashboard.</p>
              <Link
                href="/signup"
                className="btn-shine mt-6 inline-block rounded-full border border-foreground bg-foreground px-8 py-3 text-sm font-semibold text-background"
              >
                Create account
              </Link>
            </div>
          </AnimatedReveal>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
