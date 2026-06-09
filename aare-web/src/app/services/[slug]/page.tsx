import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AnimatedReveal } from "@/components/AnimatedReveal";
import { CodeBlock } from "@/components/CodeBlock";
import { serviceBySlug, services } from "@/content/services";

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = serviceBySlug[slug];
  if (!service) return {};
  return { title: service.title, description: service.summary };
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = serviceBySlug[slug];
  if (!service) notFound();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-card-border">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
            <Link href="/services" className="text-sm text-muted hover:text-foreground">
              ← All services
            </Link>
            <AnimatedReveal>
              <p className="mt-6 text-xs uppercase tracking-widest text-muted">{service.tagline}</p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">{service.title}</h1>
              <p className="mt-6 text-lg text-muted leading-relaxed">{service.description}</p>
            </AnimatedReveal>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold">How it works</h2>
          <ol className="mt-8 space-y-8">
            {service.howItWorks.map((item, i) => (
              <AnimatedReveal key={item.step} delay={i * 0.05}>
                <li className="flex gap-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-card-border text-sm font-semibold">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{item.step}</h3>
                    <p className="mt-2 text-muted leading-relaxed">{item.detail}</p>
                  </div>
                </li>
              </AnimatedReveal>
            ))}
          </ol>
        </section>

        <section className="border-y border-card-border bg-surface/30">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-bold">API access</h2>
            <p className="mt-4 text-muted leading-relaxed">{service.apiAccess}</p>
            <h3 className="mt-10 text-lg font-semibold">Typical flow</h3>
            <CodeBlock language="text" code={service.userFlow.join("\n")} />
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <p className="text-muted">
            Partners earn <strong className="text-foreground">5%</strong> commission on income from this program.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/docs"
              className="rounded-full border border-card-border px-6 py-2.5 text-sm font-medium transition hover:border-foreground"
            >
              Read documentation
            </Link>
            <Link
              href="/partnership"
              className="rounded-full border border-foreground bg-foreground px-6 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
            >
              Request access
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
