"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  STATUS_SERVICE_GROUPS,
  buildUptimeHistory,
  computeUptimePercent,
} from "@/content/status-config";
import { StatusLegend, StatusUptimeBar } from "@/components/StatusUptimeBar";

type StatusResponse = {
  status: string;
  updatedAt: string;
  services: Record<string, string>;
};

function StatusIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-emerald-500" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14-4-4 1.41-1.41L11 13.17l5.59-5.59L18 9l-7 7z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-amber-400" fill="currentColor" aria-hidden>
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
    </svg>
  );
}

export function StatusPageView() {
  const [tab, setTab] = useState<"live" | "history">("live");
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    fetch("/api/status", { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok || !body) throw new Error("unavailable");
        setData(body);
      })
      .catch(() => setError("Live checks temporarily unavailable. Historical uptime is shown below."));
  }, []);

  const liveOverall = (data?.status === "degraded" ? "degraded" : data?.status === "unknown" ? "unknown" : "operational") as
    | "operational"
    | "degraded"
    | "unknown";

  const uptimeDays = useMemo(() => buildUptimeHistory(liveOverall), [liveOverall]);
  const uptimeLabel = computeUptimePercent(uptimeDays);
  const allOperational = liveOverall === "operational" && !error;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-card-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight">Aare</span>
            <span className="text-lg font-bold tracking-widest text-emerald-500">STATUS</span>
          </Link>
          <Link href="/partnership" className="text-sm text-muted transition hover:text-foreground">
            Contact support
          </Link>
        </div>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 border-t border-card-border px-4 sm:px-6">
          <nav className="flex gap-6">
            {(
              [
                ["live", "Live status"],
                ["history", "History"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`border-b-2 py-3 text-sm font-medium transition ${
                  tab === id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
          <Link
            href="/partnership"
            className="hidden rounded-lg border border-card-border px-3 py-1.5 text-xs text-muted transition hover:border-foreground sm:inline-block"
          >
            Subscribe to updates
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {tab === "live" ? (
          <div className="space-y-10">
            <StatusUptimeBar days={uptimeDays} title="Min Partner API" uptimeLabel={uptimeLabel} />
            <StatusLegend />

            <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">System status</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {STATUS_SERVICE_GROUPS.map((group) => (
                    <div
                      key={group.id}
                      className="rounded-2xl border border-card-border bg-surface/30 p-5 transition hover:border-foreground/20"
                    >
                      <div className="flex items-start gap-3">
                        <StatusIcon ok={allOperational} />
                        <div>
                          <h3 className="font-semibold">{group.title}</h3>
                          <p className="mt-1 text-sm text-muted leading-relaxed">{group.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {data ? (
                  <p className="mt-6 text-xs text-muted">
                    Last checked {new Date(data.updatedAt).toLocaleString()}
                    {now ? ` · Page loaded ${now.toLocaleTimeString()}` : ""}
                  </p>
                ) : null}
                {error ? <p className="mt-4 text-sm text-amber-400">{error}</p> : null}
              </section>

              <aside className="space-y-8">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Active incidents</h2>
                  <p className="mt-3 text-sm text-muted">
                    {allOperational ? "All systems operational." : "We are investigating degraded components."}
                  </p>
                </div>
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Recently resolved</h2>
                  <p className="mt-3 text-sm text-muted">No recent incidents.</p>
                </div>
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Uptime since launch</h2>
                  <p className="mt-3 text-sm text-muted leading-relaxed">
                    No recorded downtime since the Partner API went live on{" "}
                    <time dateTime="2026-06-01">June 1, 2026</time>. Days before launch are shown as inactive in the
                    90-day bar.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-card-border bg-surface/30 p-8 text-center sm:p-12">
            <h2 className="text-xl font-semibold">Incident history</h2>
            <p className="mx-auto mt-4 max-w-md text-muted">
              No incidents have been recorded since launch. When downtime or degradation occurs, it will appear here
              with date, duration, and affected services.
            </p>
          </div>
        )}
      </main>

      <footer className="border-t border-card-border py-8 text-center text-xs text-muted">
        <Link href="/" className="hover:text-foreground">
          ← Back to Aare
        </Link>
      </footer>
    </div>
  );
}
