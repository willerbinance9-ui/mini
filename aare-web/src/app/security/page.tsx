import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: "Security",
  description: "Security practices for the Min Partner API.",
};

const sections = [
  {
    title: "API key handling",
    body: "Partner keys (ema_pk_...) are server-to-server credentials. Never embed them in mobile or browser apps. Proxy all partner calls through your backend.",
  },
  {
    title: "User session JWTs",
    body: "Mint 7-day JWTs via POST /v1/partner/users/:id/session for end-user clients. JWTs authorize standard Min user routes — not partner admin operations.",
  },
  {
    title: "Webhook verification",
    body: "All outbound webhooks include X-Ema-Signature (HMAC-SHA256). Verify signatures with your webhook secret before processing deposit.credited or withdrawal.finished events.",
  },
  {
    title: "Compliance gates",
    body: "Withdrawals require completed KYC profiles and whitelisted payout addresses. Partner API respects the same admin approval flows as the Min mobile app.",
  },
  {
    title: "Tenant isolation",
    body: "Partner users are scoped under partner_id. The same email can exist on the main Min app and under your tenant without conflict.",
  },
  {
    title: "Scopes",
    body: "API keys are issued with granular scopes: users, wallet, deposits, withdrawals, compliance, airfarming, vip, webhooks. Request only what you need.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold">Security</h1>
        <p className="mt-4 text-muted">How we protect partner integrations and end-user funds.</p>
        <div className="mt-12 space-y-8">
          {sections.map((s) => (
            <div key={s.title}>
              <h2 className="text-lg font-semibold">{s.title}</h2>
              <p className="mt-2 text-muted leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap gap-4">
          <Link href="/webhooks/playground" className="text-sm hover:underline">
            Webhook playground →
          </Link>
          <Link href="/docs/authentication" className="text-sm hover:underline">
            Authentication docs →
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
