import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PortalDashboard } from "@/components/PortalDashboard";

export const metadata = {
  title: "Partner Dashboard",
  description: "Your Aare partner account — application status, API users, keys, and balances.",
};

export default function DashboardPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          KYC, partnership application, package selection, and API tenant details.
        </p>
        <div className="mt-10">
          <PortalDashboard />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
