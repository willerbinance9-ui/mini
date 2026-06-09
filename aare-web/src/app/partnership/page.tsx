import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AmbientBackground } from "@/components/AmbientBackground";
import { PartnerApplicationForm } from "@/components/PartnerApplicationForm";
import { PartnershipPageRedirect } from "@/components/PartnershipPageRedirect";
import { AnimatedReveal } from "@/components/AnimatedReveal";
import { PARTNERSHIP_DISCLAIMER } from "@/content/partnership-terms";

export const metadata = {
  title: "Request Partnership",
  description: "Apply for access to the Min Partner API through Aare.",
};

export default function PartnershipPage() {
  return (
    <>
      <AmbientBackground variant="subtle" />
      <SiteHeader />
      <PartnershipPageRedirect />
      <main className="relative mx-auto max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <AnimatedReveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Partner API access</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Partnership application</h1>
          <p className="mt-4 text-muted">{PARTNERSHIP_DISCLAIMER}</p>
        </AnimatedReveal>
        <div className="mt-10">
          <PartnerApplicationForm />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
