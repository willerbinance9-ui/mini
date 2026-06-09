import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { HomeHero } from "@/components/HomeHero";
import { CommissionBanner } from "@/components/CommissionBanner";
import { PricingPackages } from "@/components/PricingPackages";
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

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold sm:text-3xl">Programs</h2>
            <p className="mt-3 text-muted">
              Pick what fits your users. Each program has its own wallet flows and webhook events.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {services.map((s) => (
              <Link
                key={s.slug}
                href={`/services/${s.slug}`}
                className="flex h-full flex-col rounded-xl border border-card-border p-6 transition hover:border-foreground/25"
              >
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{s.summary}</p>
                <span className="mt-4 text-sm text-muted">Details</span>
              </Link>
            ))}
          </div>

          <p className="mt-8">
            <Link href="/services" className="text-sm text-muted hover:text-foreground">
              All programs
            </Link>
          </p>
        </section>

        <CommissionBanner />

        <section id="pricing" className="border-y border-card-border py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold sm:text-3xl">API packages</h2>
              <p className="mt-3 text-muted">
                Monthly fee after you are approved. Commission on embedded income is separate (5%).
              </p>
            </div>
            <div className="mt-10">
              <PricingPackages />
            </div>
            <p className="mt-8">
              <Link href="/pricing" className="text-sm text-muted hover:text-foreground">
                Pricing page
              </Link>
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold">API surface</h2>
              <p className="mt-3 text-muted leading-relaxed">
                REST under <code className="font-mono text-sm">/v1/partner</code>, user sessions as JWT, webhooks with
                HMAC. Same stack as the Min consumer app — withdrawals and compliance are gated on our side.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <Link href="/docs/api-reference" className="rounded-full border border-card-border px-4 py-2">
                  Reference
                </Link>
                <Link href="/explorer" className="text-muted hover:text-foreground">
                  Explorer
                </Link>
              </div>
            </div>
            <div className="rounded-xl border border-card-border p-6 font-mono text-sm text-muted">
              <p>POST /v1/partner/users</p>
              <p className="mt-3 font-sans text-muted">
                Create a tenant user, fund the wallet, mint a session, subscribe to deposit and withdrawal webhooks.
              </p>
              <Link href="/docs/quickstart" className="mt-4 inline-block font-sans text-sm hover:text-foreground">
                Quickstart
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-card-border py-20">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <h2 className="text-2xl font-bold">Common questions</h2>
            <dl className="mt-8 space-y-6">
              {faqs.map((f) => (
                <div key={f.q} className="border-b border-card-border pb-6 last:border-0">
                  <dt className="font-medium">{f.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-xl font-bold sm:text-2xl">Need API access?</h2>
          <p className="mt-3 text-sm text-muted">
            Sign up, verify ID, apply from your dashboard. Keys are issued after review.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-full border border-foreground bg-foreground px-6 py-2.5 text-sm font-medium text-background"
            >
              Create account
            </Link>
            <Link href="/login" className="rounded-full border border-card-border px-6 py-2.5 text-sm text-muted">
              Log in
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
