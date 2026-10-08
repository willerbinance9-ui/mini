import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { HomeHero } from "@/components/HomeHero";
import { MarqueeStrip } from "@/components/MarqueeStrip";
import { CommissionBanner } from "@/components/CommissionBanner";
import { PricingPackages } from "@/components/PricingPackages";
import { AnimatedReveal, StaggerGrid, StaggerItem } from "@/components/AnimatedReveal";
import { services } from "@/content/services";

const faqs = [
  {
    q: "Who is this for?",
    a: "Teams building apps on top of Min — lending clubs, regional fintechs, community investment products. You need a backend that can call our API server-to-server.",
  },
  {
    q: "What can I embed?",
    a: "Live trading (wallet → MT5), airfarming drops, ghost account pools, and VIP farmers. Your package sets which scopes are enabled on your key.",
  },
  {
    q: "How do you charge?",
    a: "Monthly API package fee after approval, plus 5% on income that runs through your tenant. See pricing below — rates update 30 June 2026.",
  },
  {
    q: "How do I get access?",
    a: "Create an account, pass ID verification, submit the partnership form from your dashboard. We review manually; most applications are declined.",
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <HomeHero />
        <MarqueeStrip />

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <AnimatedReveal className="mb-10 max-w-2xl sm:mb-14">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted sm:text-xs">Programs</p>
            <h2 className="text-heading mt-3 font-bold">What you can embed</h2>
            <p className="mt-4 text-muted">
              Pick what fits your users. Each program has its own wallet flows and webhook events.
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
              All programs →
            </Link>
          </AnimatedReveal>
        </section>

        <CommissionBanner />

        <section id="pricing" className="border-y border-card-border bg-surface/30 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <AnimatedReveal className="mb-10 max-w-2xl sm:mb-12">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted sm:text-xs">Pricing</p>
              <h2 className="text-heading mt-3 font-bold">API packages</h2>
              <p className="mt-4 text-muted">
                Monthly fee after you are approved. Commission on embedded income is separate (5%).
              </p>
            </AnimatedReveal>
            <PricingPackages />
            <AnimatedReveal className="mt-10 text-center">
              <Link href="/pricing" className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
                Full pricing details →
              </Link>
            </AnimatedReveal>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid items-center gap-10 sm:gap-12 lg:grid-cols-2">
            <AnimatedReveal>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted sm:text-xs">Developers</p>
              <h2 className="text-heading mt-3 font-bold">API surface</h2>
              <p className="mt-4 text-muted leading-relaxed">
                REST under <code className="font-mono text-sm">/v1/partner</code>, user sessions as JWT, webhooks with
                HMAC. Same stack as the Min consumer app.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/docs/api-reference"
                  className="btn-shine rounded-full border border-foreground px-5 py-2.5 text-sm font-medium transition hover:bg-foreground hover:text-background"
                >
                  API Reference
                </Link>
                <Link href="/explorer" className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
                  Open explorer →
                </Link>
              </div>
            </AnimatedReveal>
            <AnimatedReveal delay={0.1}>
              <div className="glass-strong glow-ring rounded-2xl p-8">
                <p className="font-mono text-xs text-muted">POST /v1/partner/users</p>
                <p className="mt-4 text-sm text-muted">
                  Create a tenant user, fund the wallet, mint a session, subscribe to deposit and withdrawal webhooks.
                </p>
                <Link href="/docs/quickstart" className="mt-6 inline-block text-sm font-medium hover:underline">
                  Quickstart guide →
                </Link>
              </div>
            </AnimatedReveal>
          </div>
        </section>

        <section className="border-t border-card-border py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <AnimatedReveal className="text-center">
              <h2 className="text-heading-sm font-bold">Common questions</h2>
            </AnimatedReveal>
            <div className="mt-12 space-y-6">
              {faqs.map((f, i) => (
                <AnimatedReveal key={f.q} delay={i * 0.05}>
                  <div className="glass rounded-2xl border border-card-border p-6">
                    <h3 className="font-semibold">{f.q}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
                  </div>
                </AnimatedReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <AnimatedReveal>
            <div className="glass-strong glow-ring rounded-3xl p-8 sm:p-14">
              <h2 className="text-heading-sm font-bold">Need API access?</h2>
              <p className="mx-auto mt-4 max-w-lg text-muted">
                Sign up, verify ID, apply from your dashboard. Keys are issued after review.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href="/signup"
                  className="btn-shine rounded-full border border-foreground bg-foreground px-8 py-3.5 text-sm font-semibold text-background transition hover:opacity-90"
                >
                  Create account
                </Link>
                <Link href="/login" className="rounded-full border border-card-border px-8 py-3.5 text-sm text-muted">
                  Log in
                </Link>
              </div>
            </div>
          </AnimatedReveal>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
