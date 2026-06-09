import Link from "next/link";
import { TAGLINE } from "@/lib/constants";
import { HeroCodeTerminal } from "./HeroCodeTerminal";

export function HomeHero() {
  return (
    <section className="border-b border-card-border">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-sm text-muted">Min Partner API · v1</p>

            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Embed Min income products in your app
            </h1>

            <p className="mt-6 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
              {TAGLINE} Register users, run wallets and deposits, plug in airfarming, trading, or ghost accounts. You
              keep 5% commission on program income.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/docs/quickstart"
                className="rounded-full border border-foreground bg-foreground px-6 py-2.5 text-sm font-medium text-background"
              >
                Quickstart
              </Link>
              <Link
                href="/services"
                className="rounded-full border border-card-border px-6 py-2.5 text-sm text-muted hover:text-foreground"
              >
                What you can embed
              </Link>
            </div>

            <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-card-border pt-8 text-sm">
              <div>
                <dt className="text-muted">Endpoints</dt>
                <dd className="mt-1 text-xl font-semibold">22+</dd>
              </div>
              <div>
                <dt className="text-muted">Commission</dt>
                <dd className="mt-1 text-xl font-semibold">5%</dd>
              </div>
              <div>
                <dt className="text-muted">Programs</dt>
                <dd className="mt-1 text-xl font-semibold">3</dd>
              </div>
            </dl>
          </div>

          <HeroCodeTerminal />
        </div>
      </div>
    </section>
  );
}
