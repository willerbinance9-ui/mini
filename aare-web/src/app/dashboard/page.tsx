import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PartnerDashboard } from "@/components/PartnerDashboard";

export const metadata = {
  title: "Partner Dashboard",
  description: "View stats, commission, and webhook config with your Partner API key.",
};

export default function DashboardPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl flex-1 px-4 py-12 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Partners</p>
        <h1 className="mt-2 text-3xl font-bold">Partner dashboard</h1>
        <p className="mt-4 max-w-xl text-muted">
          Connect with your <code className="font-mono text-sm">ema_pk_</code> key to view tenant stats, commission
          accruals, and webhook configuration.
        </p>
        <div className="mt-10">
          <PartnerDashboard />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
