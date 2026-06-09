import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { HomeHero } from "@/components/HomeHero";
import { MarqueeStrip } from "@/components/MarqueeStrip";
import { CommissionBanner } from "@/components/CommissionBanner";
import { AnimatedReveal, StaggerGrid, StaggerItem } from "@/components/AnimatedReveal";
import { services } from "@/content/services";

const trustStats = [
  { value: "22+", label: "Partner endpoints" },
  { value: "8", label: "API scopes" },
  { value: "5%", label: "Commission rate" },
  { value: "7d", label: "User session JWT" },
];

const faqs = [
  {
    q: "What is the Aare Partner API?",
    a: "Aare is the developer portal for the Min Partner API. You register users, move funds, embed income programs, and receive webhooks — without rebuilding custody or compliance.",
  },
  {
    q: "Which services can I embed?",
    a: "Live trading (wallet-funded MT5 accounts), airfarming (scheduled yield drops), and ghost accounts (pool lending for member drops). VIP farmers is also available for locked-term products.",
  },
  {
    q: "How does the 5% commission work?",
    a: "Partners earn 5% on income generated through embedded programs — trading profits attributed to users, airfarming drop yield, ghost pool returns, and VIP accruals flowing through your integration.",
  },
  {
    q: "Do I need API knowledge?",
    a: "Server-to-server integration is required. You can build in-house or hire a developer. Apply via the partnership form and we shape API scopes to your use case.",
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <HomeHero />
        <MarqueeStrip />

        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <AnimatedReveal className="mb-14 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Services</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Markets for every strategy.
            </h2>
            <p className="mt-4 text-muted">
              From live trading with wallet funding to automated yield drops and pool lending — choose the income
              program that matches how your users earn.
            </p>
          </AnimatedReveal>

          <StaggerGrid className="grid gap-6 lg:grid-cols-3">
            {services.map((s) => (
              <StaggerItem key={s.slug}>
                <Link
                  href={`/services/${s.slug}`}
                  className="card-hover flex h-full flex-col rounded-2xl border border-card-border p-8"
                >
                  <p className="text-xs uppercase tracking-widest text-muted">{s.tagline}</p>
                  <h3 className="mt-3 text-xl font-bold">{s.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{s.summary}</p>
                  <span className="mt-6 text-sm font-medium">Learn more →</span>
                </Link>
              </StaggerItem>
            ))}
          </StaggerGrid>

          <AnimatedReveal className="mt-10 text-center">
            <Link href="/services" className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
              View all services →
            </Link>
          </AnimatedReveal>
        </section>

        <CommissionBanner />

        <section className="border-y border-card-border bg-surface/30 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <AnimatedReveal className="mb-14 text-center">
              <h2 className="text-3xl font-bold tracking-tight">Trusted by design</h2>
              <p className="mx-auto mt-4 max-w-xl text-muted">
                Documented endpoints, HMAC webhooks, compliance gates, and admin-approved withdrawals — the same
                rails powering the Min mobile app.
              </p>
            </AnimatedReveal>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {trustStats.map((s) => (
                <AnimatedReveal key={s.label}>
                  <div className="text-center">
                    <p className="text-4xl font-bold tracking-tight">{s.value}</p>
                    <p className="mt-2 text-sm text-muted">{s.label}</p>
                  </div>
                </AnimatedReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <AnimatedReveal>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Developers</p>
              <h2 className="mt-3 text-3xl font-bold">Build with Aare</h2>
              <p className="mt-4 text-muted leading-relaxed">
                Launch lending, yield, and trading experiences with Min&apos;s integration stack. Interactive API
                reference, live explorer, and copy-paste guides — ship in days, not months.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/docs/api-reference"
                  className="rounded-full border border-foreground px-5 py-2.5 text-sm font-medium transition hover:bg-foreground hover:text-background"
                >
                  API Reference
                </Link>
                <Link href="/explorer" className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
                  Open explorer →
                </Link>
              </div>
            </AnimatedReveal>
            <AnimatedReveal delay={0.1}>
              <div className="rounded-2xl border border-card-border p-8">
                <p className="font-mono text-xs text-muted">POST /v1/partner/users</p>
                <p className="mt-4 text-sm text-muted">
                  Create isolated users, mint 7-day JWTs, fund wallets, poll airfarming status, and subscribe to
                  deposit.credited + withdrawal.finished webhooks.
                </p>
                <Link href="/docs/quickstart" className="mt-6 inline-block text-sm font-medium hover:underline">
                  Quickstart guide →
                </Link>
              </div>
            </AnimatedReveal>
          </div>
        </section>

        <section className="border-t border-card-border py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <AnimatedReveal className="text-center">
              <h2 className="text-3xl font-bold">FAQs</h2>
            </AnimatedReveal>
            <div className="mt-12 space-y-6">
              {faqs.map((f, i) => (
                <AnimatedReveal key={f.q} delay={i * 0.05}>
                  <div className="rounded-2xl border border-card-border p-6">
                    <h3 className="font-semibold">{f.q}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
                  </div>
                </AnimatedReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-28 text-center sm:px-6">
          <AnimatedReveal>
            <div className="rounded-3xl border border-card-border p-10 sm:p-14">
              <h2 className="text-2xl font-bold sm:text-3xl">Ready to integrate?</h2>
              <p className="mx-auto mt-4 max-w-lg text-muted">
                Request partnership access. API keys are issued after review — your answers shape a personalized
                scope and commission setup.
              </p>
              <Link
                href="/partnership"
                className="btn-shine mt-8 inline-block rounded-full border border-foreground bg-foreground px-8 py-3.5 text-sm font-semibold text-background transition hover:opacity-90"
              >
                Request partnership
              </Link>
            </div>
          </AnimatedReveal>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
