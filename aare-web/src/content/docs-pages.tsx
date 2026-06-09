import Link from "next/link";
import { CodeBlock } from "@/components/CodeBlock";
import { API_BASE } from "@/lib/constants";
import { PARTNER_COMMISSION_TEXT, serviceBySlug } from "@/content/services";
import { API_BASE as SANDBOX_NOTE } from "@/lib/constants";
import { isSandboxConfigured, SANDBOX_API_BASE } from "@/lib/sandbox";

export type DocPage = {
  title: string;
  description: string;
  content: React.ReactNode;
};

export const docPages: Record<string, DocPage> = {
  quickstart: {
    title: "Quickstart",
    description: "Integrate with the Min Partner API in five minutes.",
    content: (
      <>
        <p>Get a partner API key from Min platform operations, then verify and create your first user.</p>
        <h2>1. Verify your key</h2>
        <CodeBlock
          language="curl"
          code={`curl '${API_BASE}/v1/partner/me' \\\n  -H 'Authorization: Bearer ema_pk_YOUR_KEY'`}
        />
        <h2>2. Create a user</h2>
        <CodeBlock
          language="curl"
          code={`curl -X POST '${API_BASE}/v1/partner/users' \\\n  -H 'Authorization: Bearer ema_pk_YOUR_KEY' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"email":"dev@yourapp.com","password":"secret12","externalRef":"usr_1"}'`}
        />
        <h2>3. Mint a session for your client app</h2>
        <CodeBlock
          language="curl"
          code={`curl -X POST '${API_BASE}/v1/partner/users/USER_ID/session' \\\n  -H 'Authorization: Bearer ema_pk_YOUR_KEY'`}
        />
        <h2>4. Next steps</h2>
        <ul>
          <li>
            <a href="/docs/deposits">Deposits</a> — fund the user wallet with crypto
          </li>
          <li>
            <a href="/docs/compliance">Compliance</a> — submit KYC before withdrawals
          </li>
          <li>
            <a href="/docs/webhooks">Webhooks</a> — receive deposit and withdrawal events
          </li>
        </ul>
      </>
    ),
  },
  authentication: {
    title: "Authentication",
    description: "API keys, scopes, and user session JWTs.",
    content: (
      <>
        <h2>Partner API key</h2>
        <p>
          Server-to-server credential. Never embed in mobile apps — proxy through your backend. Format:{" "}
          <code className="font-mono text-foreground">ema_pk_...</code>
        </p>
        <CodeBlock
          code={`Authorization: Bearer ema_pk_...\n# or\nX-Partner-Api-Key: ema_pk_...`}
          language="http"
        />
        <h2>Scopes</h2>
        <table>
          <thead>
            <tr>
              <th>Scope</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>users</td>
              <td>Create/read users, mint sessions</td>
            </tr>
            <tr>
              <td>compliance</td>
              <td>Read/write KYC profiles</td>
            </tr>
            <tr>
              <td>wallet</td>
              <td>Balances, whitelist addresses</td>
            </tr>
            <tr>
              <td>deposits</td>
              <td>Crypto deposits</td>
            </tr>
            <tr>
              <td>withdrawals</td>
              <td>Crypto withdrawals</td>
            </tr>
            <tr>
              <td>airfarming</td>
              <td>Drop schedule status</td>
            </tr>
            <tr>
              <td>vip</td>
              <td>VIP farmer summary</td>
            </tr>
            <tr>
              <td>webhooks</td>
              <td>Configure outbound webhooks</td>
            </tr>
          </tbody>
        </table>
        <h2>User session JWT</h2>
        <p>
          Mint via <code className="font-mono">POST /v1/partner/users/:id/session</code>. Valid 7 days. Use on
          standard Min user routes with <code className="font-mono">Authorization: Bearer &lt;jwt&gt;</code>.
        </p>
      </>
    ),
  },
  users: {
    title: "Users",
    description: "Register and manage partner-scoped users.",
    content: (
      <>
        <p>
          Partner users are isolated under your <code className="font-mono">partner_id</code>. The same email can
          exist on the main Min app and under your tenant without conflict.
        </p>
        <h2>Create user</h2>
        <p>
          <code className="font-mono">POST /v1/partner/users</code> — requires scope <code>users</code>. Creates
          wallet and transfer code automatically.
        </p>
        <h2>Lookup</h2>
        <ul>
          <li>
            <code className="font-mono">GET /v1/partner/users/:id</code>
          </li>
          <li>
            <code className="font-mono">GET /v1/partner/users?external_ref=...</code>
          </li>
        </ul>
        <h2>Session</h2>
        <p>
          <code className="font-mono">POST /v1/partner/users/:id/session</code> returns a JWT for client apps.
        </p>
      </>
    ),
  },
  compliance: {
    title: "Compliance",
    description: "KYC profiles required before withdrawals.",
    content: (
      <>
        <p>Submit compliance via partner API before users can withdraw funds.</p>
        <h2>Enums</h2>
        <p>
          <strong>sourceOfFunds:</strong> employment, business, savings, investment_returns, inheritance, other
          (requires sourceOfFundsDetail)
        </p>
        <p>
          <strong>plannedInvestmentDuration:</strong> under_1y, 1_3y, 3_5y, over_5y
        </p>
        <CodeBlock
          language="json"
          title="PUT /v1/partner/users/:id/compliance"
          code={JSON.stringify(
            {
              legalFirstName: "Jane",
              legalLastName: "Doe",
              country: "US",
              profession: "Engineer",
              sourceOfFunds: "employment",
              plannedInvestmentAmount: 5000,
              plannedInvestmentCurrency: "usd",
              plannedInvestmentDuration: "1_3y",
              acceptedTerms: true,
            },
            null,
            2
          )}
        />
      </>
    ),
  },
  wallet: {
    title: "Wallet",
    description: "Balances, activity, and whitelist addresses.",
    content: (
      <>
        <p>
          <code className="font-mono">GET /v1/partner/users/:id/wallet</code> returns crypto balances, USD cash
          wallet, max withdrawable USDT, and recent activity.
        </p>
        <h2>Whitelist wallets</h2>
        <p>Withdrawals require a saved payout address:</p>
        <ul>
          <li>GET /v1/partner/users/:id/whitelist-wallets</li>
          <li>POST /v1/partner/users/:id/whitelist-wallets</li>
          <li>DELETE /v1/partner/users/:id/whitelist-wallets/:walletId</li>
        </ul>
      </>
    ),
  },
  deposits: {
    title: "Deposits",
    description: "Crypto deposits via AarePaymentApi.",
    content: (
      <>
        <div className="rounded-lg border border-card-border bg-surface p-4 font-mono text-xs text-muted">
          Partner → POST /deposits → show payAddress → user sends crypto → poll GET /deposits/:id or webhook
          deposit.credited
        </div>
        <h2>Create deposit</h2>
        <CodeBlock
          language="json"
          code={JSON.stringify(
            { priceAmount: 100, priceCurrency: "usd", payCurrency: "usdttrc20" },
            null,
            2
          )}
        />
        <p>Response includes payAddress and payAmount. Poll until ledgerCredited is true.</p>
      </>
    ),
  },
  withdrawals: {
    title: "Withdrawals",
    description: "Crypto cash-out with admin approval.",
    content: (
      <>
        <h2>Prerequisites</h2>
        <ol className="list-decimal space-y-1 pl-5 text-muted">
          <li>Compliance profile complete</li>
          <li>Payout address whitelisted</li>
          <li>Sufficient combined crypto + cash balance</li>
        </ol>
        <h2>Flow</h2>
        <div className="rounded-lg border border-card-border bg-surface p-4 font-mono text-xs text-muted">
          PUT /compliance → POST /whitelist-wallets → POST /withdrawals → poll or webhook withdrawal.finished
        </div>
        <p>Partner API skips user TOTP. Admin approval flow is unchanged from the main Min app.</p>
      </>
    ),
  },
  commission: {
    title: "Partner commission",
    description: "5% revenue share on embedded income programs.",
    content: (
      <>
        <p>{PARTNER_COMMISSION_TEXT}</p>
        <h2>Covered programs</h2>
        <ul>
          <li>
            <strong>Live Trading</strong> — income attributed to wallet-funded MT5 accounts
          </li>
          <li>
            <strong>Airfarming</strong> — yield credited on scheduled drops
          </li>
          <li>
            <strong>Ghost Account</strong> — net profit recalled to owner pools
          </li>
          <li>
            <strong>VIP Farmers</strong> — daily accruals on locked-term positions
          </li>
        </ul>
        <p>
          Commission is calculated on gross income flowing through your partner tenant. Payout terms are defined in
          your partnership agreement after application review.
        </p>
        <p>
          <Link href="/services#commission">View commission overview →</Link>
        </p>
      </>
    ),
  },
  "live-trading": {
    title: "Live Trading",
    description: "Wallet-funded MT5 live accounts and expert bots.",
    content: (
      <>
        <p>{serviceBySlug["live-trading"].description}</p>
        <h2>How it works</h2>
        <ol className="list-decimal space-y-2 pl-5 text-muted">
          {serviceBySlug["live-trading"].howItWorks.map((s) => (
            <li key={s.step}>
              <strong className="text-foreground">{s.step}</strong> — {s.detail}
            </li>
          ))}
        </ol>
        <h2>User routes (JWT)</h2>
        <CodeBlock
          language="text"
          code={serviceBySlug["live-trading"].userFlow.join("\n")}
        />
        <p>
          <Link href="/services/live-trading">Full service guide →</Link>
        </p>
      </>
    ),
  },
  airfarming: {
    title: "Airfarming",
    description: "Scheduled yield drops for partner users.",
    content: (
      <>
        <p>{serviceBySlug.airfarming.description}</p>
        <h2>How it works</h2>
        <ol className="list-decimal space-y-2 pl-5 text-muted">
          {serviceBySlug.airfarming.howItWorks.map((s) => (
            <li key={s.step}>
              <strong className="text-foreground">{s.step}</strong> — {s.detail}
            </li>
          ))}
        </ol>
        <h2>Partner endpoint</h2>
        <p>
          <code className="font-mono">GET /v1/partner/users/:id/airfarming/status</code> returns nextDrop,
          upcomingDrops, history, withdrawalTrustScore, and balances.
        </p>
        <p>
          <Link href="/services/airfarming">Full service guide →</Link>
        </p>
      </>
    ),
  },
  "ghost-account": {
    title: "Ghost Account",
    description: "Pool lending that funds member airfarming drops.",
    content: (
      <>
        <p>{serviceBySlug["ghost-account"].description}</p>
        <h2>How it works</h2>
        <ol className="list-decimal space-y-2 pl-5 text-muted">
          {serviceBySlug["ghost-account"].howItWorks.map((s) => (
            <li key={s.step}>
              <strong className="text-foreground">{s.step}</strong> — {s.detail}
            </li>
          ))}
        </ol>
        <h2>User routes (JWT)</h2>
        <CodeBlock
          language="text"
          code={serviceBySlug["ghost-account"].userFlow.join("\n")}
        />
        <p>
          <Link href="/services/ghost-account">Full service guide →</Link>
        </p>
      </>
    ),
  },
  vip: {
    title: "VIP Farmers",
    description: "Locked-term investment product summary.",
    content: (
      <>
        <p>
          <code className="font-mono">GET /v1/partner/users/:id/vip</code> returns VIP farmer position summary for
          the user. Use for dashboards and portfolio views in your app.
        </p>
      </>
    ),
  },
  webhooks: {
    title: "Webhooks",
    description: "Outbound callbacks for deposit credited and withdrawal finished.",
    content: (
      <>
        <h2>Configure</h2>
        <CodeBlock
          language="json"
          code={JSON.stringify(
            {
              url: "https://your-app.com/ema/webhooks",
              enabled: true,
              events: ["deposit.credited", "withdrawal.finished"],
            },
            null,
            2
          )}
        />
        <h2>Verify signatures</h2>
        <CodeBlock
          language="javascript"
          title="Node.js"
          code={`const crypto = require('crypto');

function verify(rawBody, signatureHeader, secret) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
}`}
        />
        <h2>Events</h2>
        <ul>
          <li>
            <strong>deposit.credited</strong> — crypto deposit credited to ledger
          </li>
          <li>
            <strong>withdrawal.finished</strong> — payout completed on-chain
          </li>
        </ul>
        <p>Deliveries are idempotent per (partner, event, source_id). Respond with 2xx quickly.</p>
      </>
    ),
  },
  sandbox: {
    title: "Sandbox",
    description: "Test against a separate API base URL.",
    content: (
      <>
        <p>
          Production base URL: <code className="font-mono">{SANDBOX_NOTE}</code>
        </p>
        {isSandboxConfigured ? (
          <p>
            Sandbox base URL: <code className="font-mono">{SANDBOX_API_BASE}</code>
          </p>
        ) : (
          <p>
            Set <code className="font-mono">NEXT_PUBLIC_SANDBOX_API_BASE</code> in your Aare deployment to show a
            dedicated sandbox URL. Until then, use production with test partners only.
          </p>
        )}
        <h2>Recommended flow</h2>
        <ol className="list-decimal space-y-2 pl-5 text-muted">
          <li>Apply via the partnership form and receive a test API key after approval.</li>
          <li>Use the API Explorer or hello-partner example with your key.</li>
          <li>Configure webhooks to a staging endpoint (HTTPS or localhost in dev).</li>
          <li>Never use production keys in client-side code.</li>
        </ol>
        <p>
          <Link href="/explorer">Open API Explorer →</Link>
        </p>
      </>
    ),
  },
  "user-jwt": {
    title: "User JWT routes",
    description: "Live trading, ghost account, and airfarming via end-user sessions.",
    content: (
      <>
        <p>
          Some income programs require a <strong>user session JWT</strong> minted server-side. Your backend calls the
          partner API; your client calls Min user routes with the JWT.
        </p>
        <h2>Mint a session</h2>
        <CodeBlock
          language="curl"
          code={`curl -X POST '${API_BASE}/v1/partner/users/USER_ID/session' \\\n  -H 'Authorization: Bearer ema_pk_YOUR_KEY'`}
        />
        <h2>Live trading</h2>
        <ul>
          <li>
            <code className="font-mono">GET /live-trading/accounts</code>
          </li>
          <li>
            <code className="font-mono">POST /live-trading/accounts/:id/fund</code>
          </li>
          <li>
            Partner shortcut: <code className="font-mono">GET /v1/partner/users/:id/live-trading</code>
          </li>
        </ul>
        <h2>Ghost account</h2>
        <ul>
          <li>
            <code className="font-mono">GET /ghost-account/status</code>
          </li>
          <li>
            <code className="font-mono">POST /ghost-account/enroll</code>
          </li>
          <li>
            Partner shortcut: <code className="font-mono">GET /v1/partner/users/:id/ghost-account</code>
          </li>
        </ul>
        <h2>Airfarming (user client)</h2>
        <ul>
          <li>
            <code className="font-mono">POST /airfarming/activate</code>
          </li>
          <li>
            <code className="font-mono">GET /airfarming/status</code>
          </li>
        </ul>
        <p>
          <Link href="/docs/api-reference">Full API reference →</Link>
        </p>
      </>
    ),
  },
  errors: {
    title: "Error codes",
    description: "HTTP status and application error codes.",
    content: (
      <>
        <table>
          <thead>
            <tr>
              <th>HTTP</th>
              <th>Code</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>400</td>
              <td>—</td>
              <td>Validation failed</td>
            </tr>
            <tr>
              <td>401</td>
              <td>—</td>
              <td>Missing or invalid API key</td>
            </tr>
            <tr>
              <td>403</td>
              <td>ACCOUNT_BANNED</td>
              <td>User suspended</td>
            </tr>
            <tr>
              <td>403</td>
              <td>COMPLIANCE_PROFILE_REQUIRED</td>
              <td>KYC incomplete</td>
            </tr>
            <tr>
              <td>403</td>
              <td>Missing scope</td>
              <td>API key lacks permission</td>
            </tr>
            <tr>
              <td>400</td>
              <td>WALLET_NOT_WHITELISTED</td>
              <td>Address not saved</td>
            </tr>
            <tr>
              <td>404</td>
              <td>—</td>
              <td>Resource not found</td>
            </tr>
            <tr>
              <td>503</td>
              <td>—</td>
              <td>Service or schema not configured</td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },
};
