import Link from "next/link";
import { API_BASE, TAGLINE } from "@/lib/constants";
import { AnimatedReveal } from "@/components/AnimatedReveal";
import { services } from "@/content/services";

export default function DocsHomePage() {
  return (
    <article className="prose-aare max-w-3xl">
      <AnimatedReveal>
        <p className="not-prose text-xs font-semibold uppercase tracking-[0.2em] text-muted">Min Partner API · v1</p>
        <h1 className="not-prose mt-2 text-3xl font-bold sm:text-4xl">Introduction</h1>
      </AnimatedReveal>
      <p>
        {TAGLINE} The Min Partner API lets you register users, move funds, embed income programs, and receive
        webhooks — without rebuilding custody, compliance, or payout infrastructure.
      </p>

      <h2>Base URL</h2>
      <p>
        All partner routes: <code className="font-mono text-foreground">{API_BASE}/v1/partner/...</code>
      </p>

      <h2>Key concepts</h2>
      <table>
        <thead>
          <tr>
            <th>Term</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Platform user</td>
            <td>Min mobile app user (partner_id is null)</td>
          </tr>
          <tr>
            <td>Partner user</td>
            <td>User created under your partner tenant via API</td>
          </tr>
          <tr>
            <td>API key</td>
            <td>Server credential ema_pk_... with granular scopes</td>
          </tr>
          <tr>
            <td>User JWT</td>
            <td>7-day token for end-user clients on standard Min routes</td>
          </tr>
        </tbody>
      </table>

      <h2>Income programs</h2>
      <p>Embed these services in your app. Partners earn 5% commission on income from each program.</p>
      <ul>
        {services.map((s) => (
          <li key={s.slug}>
            <Link href={`/docs/${s.slug}`}>
              <strong>{s.title}</strong>
            </Link>{" "}
            — {s.summary}
          </li>
        ))}
        <li>
          <Link href="/docs/vip">
            <strong>VIP Farmers</strong>
          </Link>{" "}
          — locked-term investment summaries
        </li>
      </ul>

      <div className="not-prose mt-8 flex flex-wrap gap-3">
        <Link
          href="/docs/quickstart"
          className="rounded-full border border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Quickstart guide
        </Link>
        <Link
          href="/docs/commission"
          className="rounded-full border border-card-border px-4 py-2 text-sm text-foreground hover:border-foreground"
        >
          Partner commission
        </Link>
        <Link
          href="/explorer"
          className="rounded-full border border-card-border px-4 py-2 text-sm text-foreground hover:border-foreground"
        >
          API Explorer
        </Link>
      </div>

      <h2>Security</h2>
      <p>
        Never expose <code className="font-mono">ema_pk_</code> keys in client-side mobile apps. Proxy partner API
        calls through your backend. Store webhook secrets in environment variables.
      </p>
    </article>
  );
}
