import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CommissionBanner } from "@/components/CommissionBanner";
import { AnimatedReveal } from "@/components/AnimatedReveal";
import { services } from "@/content/services";

export const metadata = {
  title: "Services",
  description: "Live trading, airfarming, and ghost account income programs on the Min Partner API.",
};

export default function ServicesPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-card-border">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
            <AnimatedReveal>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Income programs</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Services for every investment strategy.
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-muted">
                Embed live trading, scheduled yield drops, and pool lending through the Partner API. Each program
                runs on shared Min infrastructure — you build the experience, we operate the rails.
              </p>
            </AnimatedReveal>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {services.map((s, i) => (
              <AnimatedReveal key={s.slug} delay={i * 0.08}>
                <Link
                  href={`/services/${s.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-card-border bg-background p-8 transition hover:border-foreground/40"
                >
                  <p className="text-xs uppercase tracking-widest text-muted">{s.tagline}</p>
                  <h2 className="mt-3 text-2xl font-bold text-foreground">{s.title}</h2>
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-muted">{s.summary}</p>
                  <span className="mt-6 text-sm font-medium text-foreground group-hover:underline">
                    How it works →
                  </span>
                </Link>
              </AnimatedReveal>
            ))}
          </div>
        </section>

        <CommissionBanner id="commission" />

        <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-2xl font-bold">Ready to embed these services?</h2>
          <p className="mt-4 text-muted">
            Request partnership access. Your application answers shape a personalized API scope and commission
            configuration.
          </p>
          <Link
            href="/partnership"
            className="btn-shine mt-8 inline-block rounded-full border border-foreground px-8 py-3 text-sm font-semibold transition hover:bg-foreground hover:text-background"
          >
            Request partnership
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
