"use client";

import { useEffect, useState } from "react";
import { getFetchApiBase } from "@/lib/constants";

const KEY_STORAGE = "aare_partner_api_key";

type PartnerMe = { id: string; name: string; slug: string; status: string };
type Stats = { userCount: number; webhookEnabled: boolean; commissionRate: number };
type Commission = {
  rate: number;
  totals: { commissionUsd: number; grossUsd: number; count: number };
  events: { event_type: string; gross_amount: number; partner_commission_amount: number; event_at: string }[];
};
type WebhookConfig = { url?: string; enabled?: boolean; events?: string[] };

export function PartnerDashboard() {
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [me, setMe] = useState<PartnerMe | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [commission, setCommission] = useState<Commission | null>(null);
  const [webhook, setWebhook] = useState<WebhookConfig | null>(null);

  useEffect(() => {
    const k = sessionStorage.getItem(KEY_STORAGE) || "";
    if (k) {
      setApiKey(k);
      setSaved(true);
      void loadAll(k);
    }
  }, []);

  async function partnerGet(key: string, path: string) {
    const res = await fetch(`${getFetchApiBase()}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || `HTTP ${res.status}`);
    return body;
  }

  async function loadAll(key: string) {
    setLoading(true);
    setError("");
    try {
      const [meRes, statsRes, commRes, whRes] = await Promise.all([
        partnerGet(key, "/v1/partner/me"),
        partnerGet(key, "/v1/partner/stats"),
        partnerGet(key, "/v1/partner/commission"),
        partnerGet(key, "/v1/partner/webhooks"),
      ]);
      setMe(meRes);
      setStats(statsRes);
      setCommission(commRes);
      setWebhook(whRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  function saveKey() {
    sessionStorage.setItem(KEY_STORAGE, apiKey.trim());
    setSaved(true);
    void loadAll(apiKey.trim());
  }

  function clearKey() {
    sessionStorage.removeItem(KEY_STORAGE);
    setApiKey("");
    setSaved(false);
    setMe(null);
    setStats(null);
    setCommission(null);
    setWebhook(null);
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-card-border p-6">
        <h2 className="text-lg font-semibold">API key</h2>
        <p className="mt-2 text-sm text-muted">Stored in sessionStorage only — never committed to git.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            type="password"
            className="min-w-[280px] flex-1 rounded-xl border border-card-border bg-surface px-4 py-2.5 font-mono text-sm"
            placeholder="ema_pk_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button
            type="button"
            onClick={saveKey}
            className="rounded-full border border-foreground bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
          >
            {saved ? "Reload" : "Connect"}
          </button>
          {saved ? (
            <button type="button" onClick={clearKey} className="rounded-full border border-card-border px-5 py-2.5 text-sm">
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p> : null}
      {loading ? <p className="text-sm text-muted">Loading…</p> : null}

      {me ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-card-border p-5">
            <p className="text-xs uppercase tracking-widest text-muted">Partner</p>
            <p className="mt-2 font-semibold">{me.name}</p>
            <p className="font-mono text-xs text-muted">{me.slug}</p>
          </div>
          <div className="rounded-2xl border border-card-border p-5">
            <p className="text-xs uppercase tracking-widest text-muted">Users</p>
            <p className="mt-2 text-2xl font-bold">{stats?.userCount ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-card-border p-5">
            <p className="text-xs uppercase tracking-widest text-muted">Commission rate</p>
            <p className="mt-2 text-2xl font-bold">{((stats?.commissionRate ?? 0.05) * 100).toFixed(0)}%</p>
          </div>
          <div className="rounded-2xl border border-card-border p-5">
            <p className="text-xs uppercase tracking-widest text-muted">Webhooks</p>
            <p className="mt-2 font-semibold">{webhook?.enabled ? "Enabled" : "Disabled"}</p>
          </div>
        </div>
      ) : null}

      {commission ? (
        <div className="rounded-2xl border border-card-border p-6">
          <h2 className="text-lg font-semibold">Commission summary</h2>
          <p className="mt-2 text-sm text-muted">
            Accrued: <strong className="text-foreground">${commission.totals.commissionUsd.toFixed(2)}</strong> on $
            {commission.totals.grossUsd.toFixed(2)} gross ({commission.totals.count} events)
          </p>
          {commission.events.length > 0 ? (
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
                  {commission.events.slice(0, 10).map((ev) => (
                    <tr key={`${ev.event_type}-${ev.event_at}`} className="border-b border-card-border/50">
                      <td className="py-2 pr-4">{ev.event_type}</td>
                      <td className="py-2 pr-4">${Number(ev.gross_amount).toFixed(2)}</td>
                      <td className="py-2 pr-4">${Number(ev.partner_commission_amount || 0).toFixed(2)}</td>
                      <td className="py-2 text-muted">{String(ev.event_at).slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">No commission events yet for partner users.</p>
          )}
        </div>
      ) : null}

      {webhook ? (
        <div className="rounded-2xl border border-card-border p-6">
          <h2 className="text-lg font-semibold">Webhook config</h2>
          <p className="mt-2 font-mono text-sm text-muted break-all">{webhook.url || "Not configured"}</p>
          <p className="mt-2 text-sm text-muted">Events: {(webhook.events || []).join(", ") || "—"}</p>
          <a href="/docs/webhooks" className="mt-4 inline-block text-sm hover:underline">
            Webhook documentation →
          </a>
        </div>
      ) : null}
    </div>
  );
}
