import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PartnerApplicationForm } from "@/components/PartnerApplicationForm";
import { PartnershipPageRedirect } from "@/components/PartnershipPageRedirect";
import { PARTNERSHIP_DISCLAIMER } from "@/content/partnership-terms";

export const metadata = {
  title: "Request Partnership",
  description: "Apply for access to the Min Partner API through Aare.",
};

export default function PartnershipPage() {
  return (
    <>
      <SiteHeader />
      <PartnershipPageRedirect />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Partnership application</h1>
          <p className="mt-3 text-sm text-muted">{PARTNERSHIP_DISCLAIMER}</p>
        </div>
        <div className="mt-10">
          <PartnerApplicationForm />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
