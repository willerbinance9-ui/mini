import { BACKEND_ORIGIN } from "@/lib/constants";

export const dynamic = "force-dynamic";

type StatusPayload = {
  status: string;
  updatedAt: string;
  services: Record<string, string>;
  environment?: string;
  source?: string;
};

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

async function statusFromLegacyHealth(): Promise<StatusPayload> {
  const [health, dbHealth] = await Promise.all([
    fetchJson(`${BACKEND_ORIGIN}/health`),
    fetchJson(`${BACKEND_ORIGIN}/health/db`),
  ]);

  const apiOk = health?.status === "ok";
  const dbOk = dbHealth?.status === "ok" && dbHealth?.database === "connected";

  const services: Record<string, string> = {
    api: apiOk ? "ok" : "degraded",
    database: dbOk ? "ok" : health ? "degraded" : "unknown",
    partnerApi: dbOk ? "ok" : "unknown",
    applications: dbOk ? "ok" : "unknown",
  };

  const overall =
    services.api === "ok" && services.database === "ok"
      ? "operational"
      : services.api === "degraded" || services.database === "degraded"
        ? "degraded"
        : "unknown";

  return {
    status: overall,
    updatedAt: new Date().toISOString(),
    services,
    source: "health-fallback",
  };
}

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_ORIGIN}/v1/public/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    if (res.ok) {
      const data = (await res.json()) as StatusPayload;
      return Response.json({ ...data, source: "v1/public/status" });
    }

    const fallback = await statusFromLegacyHealth();
    return Response.json(fallback);
  } catch {
    const fallback = await statusFromLegacyHealth();
    return Response.json(
      fallback.status === "unknown"
        ? { ...fallback, status: "degraded", services: { ...fallback.services, api: "degraded" } }
        : fallback
    );
  }
}
