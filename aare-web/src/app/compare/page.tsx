import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { serviceComparison } from "@/content/comparison";

export const metadata = {
  title: "Compare Services",
  description: "Compare live trading, airfarming, ghost account, and VIP farmers.",
};

export default function ComparePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold sm:text-4xl">Compare income programs</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Choose the right embedded product for your users. All programs earn partners a 5% commission on attributed
          income.
        </p>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="py-3 pr-4">Service</th>
                <th className="py-3 pr-4">Min deposit</th>
                <th className="py-3 pr-4">Risk profile</th>
                <th className="py-3 pr-4">API</th>
                <th className="py-3 pr-4">Commission</th>
                <th className="py-3 pr-4">User JWT</th>
                <th className="py-3">Best for</th>
              </tr>
            </thead>
            <tbody>
              {serviceComparison.map((row) => (
                <tr key={row.slug} className="border-b border-card-border/60">
                  <td className="py-4 pr-4 font-medium">
                    <Link href={`/services/${row.slug}`} className="hover:underline">
                      {row.service}
                    </Link>
                  </td>
                  <td className="py-4 pr-4 text-muted">{row.minDeposit}</td>
                  <td className="py-4 pr-4 text-muted">{row.risk}</td>
                  <td className="py-4 pr-4 text-muted">{row.apiType}</td>
                  <td className="py-4 pr-4 font-mono">{row.commission}</td>
                  <td className="py-4 pr-4">{row.userJwt ? "Yes" : "Partner only"}</td>
                  <td className="py-4 text-muted">{row.bestFor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
