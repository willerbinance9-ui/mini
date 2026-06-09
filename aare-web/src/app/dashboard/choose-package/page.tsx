"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { PricingPackages } from "@/components/PricingPackages";
import { usePortalAuth } from "@/context/PortalAuthContext";
import { packageById, type ApiPackageId } from "@/content/api-packages";
import { portalSelectApiPackage } from "@/lib/portal";

export default function ChoosePackagePage() {
  const { me, loading, refresh } = usePortalAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<ApiPackageId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!me) {
      router.replace("/login");
      return;
    }
    if (me.application?.status !== "approved") {
      router.replace("/dashboard");
      return;
    }
    if (me.apiPackage && !me.needsPackageSelection) {
      router.replace("/dashboard");
    }
  }, [loading, me, router]);

  async function confirm() {
    if (!selected) return;
    setError("");
    setBusy(true);
    try {
      await portalSelectApiPackage(selected);
      await refresh();
      setDone(true);
      setTimeout(() => router.push("/dashboard"), 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save package");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !me) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-5xl flex-1 px-4 py-16 text-center text-muted">Loading…</main>
        <SiteFooter />
      </>
    );
  }

  if (done && selected) {
    const pkg = packageById(selected);
    return (
      <>
        <SiteHeader />
        <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-10"
          >
            <p className="text-2xl font-bold text-emerald-300">Package confirmed</p>
            <p className="mt-3 text-muted">
              {pkg?.name} — {pkg?.priceLabel}/month. Redirecting to your dashboard…
            </p>
          </motion.div>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-bold sm:text-3xl">Choose API package</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Your application was approved. Pick the monthly plan for the scopes you need. Billing starts when your key is
          active.
        </p>

        <div className="mt-10">
          <PricingPackages mode="select" selectedId={selected} onSelect={setSelected} busy={busy} />
        </div>

        {error ? <p className="mt-6 text-sm text-rose-400">{error}</p> : null}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={!selected || busy}
            onClick={() => void confirm()}
            className="rounded-full border border-foreground bg-foreground px-8 py-3 text-sm font-semibold text-background disabled:opacity-50"
          >
            {busy ? "Saving…" : "Confirm package"}
          </button>
          <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
            Back to dashboard
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
