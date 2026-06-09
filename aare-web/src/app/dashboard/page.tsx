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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Partner portal</p>
        <h1 className="mt-2 text-3xl font-bold">Dashboard</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Sign up, complete identity verification, and apply for API access from your account. Once approved, choose a
          package and manage users, balances, keys, and commission here.
        </p>
        <div className="mt-10">
          <PortalDashboard />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
