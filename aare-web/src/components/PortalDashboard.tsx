"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePortalAuth } from "@/context/PortalAuthContext";
import { PortalKycWizard } from "@/components/PortalKycWizard";
import { PartnerApplicationForm } from "@/components/PartnerApplicationForm";
import { portalGetOverview, type PortalOverview } from "@/lib/portal";
import { packageById } from "@/content/api-packages";

function fmtUsd(n: number) {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function statusTone(status: string) {
  if (status === "approved") return "text-emerald-400";
  if (status === "rejected") return "text-rose-400";
  if (status === "reviewing") return "text-amber-400";
  return "text-muted";
}

export function PortalDashboard() {
  const { me, loading, logout, refresh } = usePortalAuth();
  const [overview, setOverview] = useState<PortalOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!me?.hasPartnerAccess) return;
    setOverviewLoading(true);
    portalGetOverview()
      .then(setOverview)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load overview"))
      .finally(() => setOverviewLoading(false));
  }, [me?.hasPartnerAccess, me?.partnerId]);

  if (loading) {
    return <p className="text-sm text-muted">Loading account…</p>;
  }

  if (!me) {
    return (
      <div className="rounded-2xl border border-card-border p-8 text-center">
        <p className="text-muted">Sign in to manage your partnership and API tenant.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="rounded-full border border-foreground bg-foreground px-6 py-2.5 text-sm font-semibold text-background"
          >
            Log in
          </Link>
          <Link href="/signup" className="rounded-full border border-card-border px-6 py-2.5 text-sm">
            Create account
          </Link>
        </div>
      </div>
    );
  }

  const app = me.application;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Signed in</p>
          <p className="mt-1 text-lg font-semibold">{me.account.fullName || me.account.email}</p>
          <p className="font-mono text-sm text-muted">{me.account.email}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-full border border-card-border px-4 py-2 text-sm text-muted hover:text-foreground"
        >
          Log out
        </button>
      </div>

      <PortalKycWizard kyc={me.kyc} onUpdated={() => void refresh()} />

      <div id="apply" className="rounded-2xl border border-card-border p-6 scroll-mt-24">
        <h2 className="text-lg font-semibold">Partnership application</h2>
        {!me.canApplyForApi ? (
          <div className="mt-4">
            <p className="text-sm text-muted">
              Complete identity verification above, then apply for API access here in your account.
            </p>
          </div>
        ) : !app ? (
          <div className="mt-4">
            <p className="mb-4 text-sm text-muted">
              Your identity is verified. Complete the partnership questionnaire below to request API access.
            </p>
            <PartnerApplicationForm embedded />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted">Status </span>
              <span className={`font-semibold capitalize ${statusTone(app.status)}`}>{app.status}</span>
            </div>
            <div>
              <span className="text-muted">Source </span>
              <span>{app.submittedFrom || "aare.cc"}</span>
            </div>
            <div>
              <span className="text-muted">Submitted </span>
              <span>{fmtDt(app.createdAt)}</span>
            </div>
            <div>
              <span className="text-muted">Intended investment </span>
              <span>{fmtUsd(app.intendedInvestment)}</span>
            </div>
            {app.status === "pending" || app.status === "reviewing" ? (
              <p className="sm:col-span-2 text-muted">
                Our team is reviewing your application. Fewer than 10% of applicants qualify — we will email you when
                there is an update.
              </p>
            ) : null}
            {app.status === "approved" && me.needsPackageSelection ? (
              <div className="sm:col-span-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-sm text-emerald-200">Your application is approved — choose your API package to continue.</p>
                <Link href="/dashboard/choose-package" className="mt-3 inline-block text-sm font-semibold hover:underline">
                  Choose package →
                </Link>
              </div>
            ) : null}
            {app.status === "approved" && me.apiPackage ? (
              <div className="sm:col-span-2">
                <span className="text-muted">API package </span>
                <span className="font-semibold">
                  {packageById(me.apiPackage)?.name} ({packageById(me.apiPackage)?.priceLabel}/mo)
                </span>
              </div>
            ) : null}
            {app.status === "rejected" ? (
              <p className="sm:col-span-2 text-rose-300">
                {app.adminNotes || "Your application was not approved at this time."}
              </p>
            ) : null}
          </div>
        )}
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>
      ) : null}

      {me.hasPartnerAccess && overview?.ready ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Partner" value={overview.partner?.name || "—"} sub={overview.partner?.slug} />
            <StatCard label="API users" value={String(overview.userCount ?? 0)} />
            <StatCard label="Total cash (users)" value={fmtUsd(overview.totalCashUsd ?? 0)} />
            <StatCard
              label="Commission"
              value={fmtUsd(overview.commission?.commissionUsd ?? 0)}
              sub={`${((overview.commissionRate ?? 0.05) * 100).toFixed(0)}% rate`}
            />
          </div>

          <div className="rounded-2xl border border-card-border p-6">
            <h2 className="text-lg font-semibold">API keys in use</h2>
            <p className="mt-2 text-sm text-muted">Key prefixes only — full secrets are shown once at issuance.</p>
            {(overview.apiKeys?.length ?? 0) > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-card-border text-muted">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Prefix</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2">Last used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.apiKeys!.map((k) => (
                      <tr key={k.id} className="border-b border-card-border/50">
                        <td className="py-2 pr-4">{k.name}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{k.keyPrefix}…</td>
                        <td className="py-2 pr-4">
                          {k.active ? (k.lastUsedAt ? "In use" : "Active") : "Revoked"}
                        </td>
                        <td className="py-2 text-muted">{fmtDt(k.lastUsedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">No API keys on file.</p>
            )}
          </div>

          <div className="rounded-2xl border border-card-border p-6">
            <h2 className="text-lg font-semibold">Your API users</h2>
            <p className="mt-2 text-sm text-muted">End users registered under your partner tenant.</p>
            {(overview.users?.length ?? 0) > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-card-border text-muted">
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">External ref</th>
                      <th className="py-2 pr-4">Cash balance</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.users!.map((u) => (
                      <tr key={u.id} className="border-b border-card-border/50">
                        <td className="py-2 pr-4">{u.email}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{u.externalRef || "—"}</td>
                        <td className="py-2 pr-4">{fmtUsd(u.cashWalletUsd)}</td>
                        <td className="py-2 pr-4 capitalize">{u.accountStatus}</td>
                        <td className="py-2 text-muted">{fmtDt(u.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">No users yet. Create users via the Partner API.</p>
            )}
            <Link href="/docs/quickstart" className="mt-4 inline-block text-sm hover:underline">
              Quickstart guide →
            </Link>
          </div>

          <div className="rounded-2xl border border-card-border p-6">
            <h2 className="text-lg font-semibold">Webhooks</h2>
            <p className="mt-2 text-sm text-muted">
              {overview.webhook?.enabled ? "Enabled" : "Disabled"}
              {overview.webhook?.url ? ` · ${overview.webhook.url}` : ""}
            </p>
            <Link href="/docs/webhooks" className="mt-4 inline-block text-sm hover:underline">
              Webhook documentation →
            </Link>
          </div>

          {(overview.commissionEvents?.length ?? 0) > 0 ? (
            <div className="rounded-2xl border border-card-border p-6">
              <h2 className="text-lg font-semibold">Recent commission events</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-card-border text-muted">
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Gross</th>
                      <th className="py-2 pr-4">Commission</th>
                      <th className="py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.commissionEvents!.map((ev) => (
                      <tr key={`${ev.event_type}-${ev.event_at}`} className="border-b border-card-border/50">
                        <td className="py-2 pr-4">{ev.event_type}</td>
                        <td className="py-2 pr-4">{fmtUsd(Number(ev.gross_amount))}</td>
                        <td className="py-2 pr-4">{fmtUsd(Number(ev.partner_commission_amount || 0))}</td>
                        <td className="py-2 text-muted">{String(ev.event_at).slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      ) : me.hasPartnerAccess && overviewLoading ? (
        <p className="text-sm text-muted">Loading partner data…</p>
      ) : app?.status === "approved" && !me.hasPartnerAccess ? (
        <p className="text-sm text-muted">Your application is approved — partner access is syncing. Refresh shortly.</p>
      ) : null}

      <div className="rounded-2xl border border-dashed border-card-border p-6">
        <h2 className="text-lg font-semibold">Developer tools</h2>
        <p className="mt-2 text-sm text-muted">Explore endpoints, webhooks, and OpenAPI from the docs.</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/explorer" className="hover:underline">
            API Explorer
          </Link>
          <Link href="/docs/api-reference" className="hover:underline">
            API Reference
          </Link>
          <Link href="/openapi" className="hover:underline">
            OpenAPI
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-card-border p-5">
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {sub ? <p className="mt-1 font-mono text-xs text-muted">{sub}</p> : null}
    </div>
  );
}
