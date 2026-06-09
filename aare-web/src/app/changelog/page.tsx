import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: "Changelog",
};

export default function ChangelogPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <article className="prose-aare">
          <h1>Changelog</h1>
          <h2>v1.1.0 — June 2026</h2>
          <ul>
            <li>Partnership application form + admin review workflow</li>
            <li>Partner dashboard, commission tracking (5%), stats endpoints</li>
            <li>Live trading + ghost account partner shortcuts</li>
            <li>Service pages, comparison, pricing, security, status, case studies</li>
            <li>OpenAPI spec, Postman collection, webhook playground</li>
            <li>User JWT route documentation</li>
          </ul>
          <h2>v1.0.0 — June 2026</h2>
          <ul>
            <li>Initial Partner API release under /v1/partner/</li>
            <li>Users, compliance, wallet, deposits, withdrawals</li>
            <li>Airfarming status and VIP summary endpoints</li>
            <li>Outbound webhooks: deposit.credited, withdrawal.finished</li>
            <li>Granular API key scopes</li>
          </ul>
          <p>
            <Link href="/docs">View documentation →</Link>
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
