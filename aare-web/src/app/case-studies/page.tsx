import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { caseStudies } from "@/content/case-studies";

export const metadata = {
  title: "Case Studies",
  description: "Built with Aare — partner integration stories.",
};

export default function CaseStudiesPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl flex-1 px-4 py-12 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Built with Aare</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Case studies</h1>
        <p className="mt-4 max-w-2xl text-muted">
          How investment-oriented partners embed Min income programs through the Partner API.
        </p>
        <div className="mt-12 space-y-8">
          {caseStudies.map((c) => (
            <article key={c.slug} className="rounded-2xl border border-card-border p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <h2 className="text-xl font-bold">{c.company}</h2>
                <span className="font-mono text-sm text-muted">{c.metric}</span>
              </div>
              <p className="mt-2 text-lg font-medium">{c.headline}</p>
              <p className="mt-4 text-muted leading-relaxed">{c.summary}</p>
              <p className="mt-4 text-sm italic text-muted">&ldquo;{c.quote}&rdquo;</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {c.services.map((s) => (
                  <span key={s} className="rounded-full border border-card-border px-3 py-1 text-xs">
                    {s}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
        <Link href="/partnership" className="mt-12 inline-block text-sm font-medium hover:underline">
          Start your integration →
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
