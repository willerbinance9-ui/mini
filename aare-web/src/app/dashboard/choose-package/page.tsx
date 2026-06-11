"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { PricingPackages } from "@/components/PricingPackages";
import { usePortalAuth } from "@/context/PortalAuthContext";
import { packageById, type ApiPackageId } from "@/content/api-packages";
import {
  portalCheckoutApiPackage,
  portalGetPackagePayment,
  type AppPreference,
  type PackagePayment,
} from "@/lib/portal";

const PENDING_STATUSES = new Set(["waiting", "confirming", "sending", "partially_paid"]);

export default function ChoosePackagePage() {
  const { me, loading, refresh } = usePortalAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<ApiPackageId | null>(null);
  const [appChoice, setAppChoice] = useState<"ours" | "own" | null>(null);
  const [ownBuilder, setOwnBuilder] = useState<"us" | "dev" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payment, setPayment] = useState<PackagePayment | null>(null);
  const [activated, setActivated] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(true);

  const checkPayment = useCallback(async () => {
    try {
      const res = await portalGetPackagePayment();
      setPayment(res.payment);
      if (res.apiPackage) {
        setActivated(true);
        await refresh();
      }
    } catch {
      // table may not exist yet; treat as no payment
    } finally {
      setCheckingPayment(false);
    }
  }, [refresh]);

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
    if (me.apiPackage) {
      setActivated(true);
      setCheckingPayment(false);
      return;
    }
    void checkPayment();
  }, [loading, me, router, checkPayment]);

  // While a payment is pending, poll for activation (covers returning from the NOWPayments page)
  useEffect(() => {
    if (activated || !payment || !PENDING_STATUSES.has(payment.status)) return;
    const timer = setInterval(() => void checkPayment(), 12_000);
    return () => clearInterval(timer);
  }, [payment, activated, checkPayment]);

  const appPreference: AppPreference | null =
    appChoice === "ours"
      ? "use_ours"
      : appChoice === "own" && ownBuilder === "us"
        ? "own_build_for_me"
        : appChoice === "own" && ownBuilder === "dev"
          ? "own_independent_dev"
          : null;

  async function buy() {
    if (!selected || !appPreference) return;
    setError("");
    setBusy(true);
    try {
      const res = await portalCheckoutApiPackage(selected, appPreference);
      setPayment(res.payment);
      if (res.payment.invoiceUrl) {
        window.location.href = res.payment.invoiceUrl;
      } else {
        setError("Could not open the payment page. Try again.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start checkout");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !me || checkingPayment) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-5xl flex-1 px-4 py-16 text-center text-muted">Loading…</main>
        <SiteFooter />
      </>
    );
  }

  if (activated) {
    const pkg = packageById(me.apiPackage || payment?.package || null);
    return (
      <>
        <SiteHeader />
        <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-10"
          >
            <p className="text-2xl font-bold text-emerald-300">Package active</p>
            <p className="mt-3 text-muted">
              {pkg?.name} — {pkg?.priceLabel}/month. Your package is locked in; the team will activate your API keys.
            </p>
            <Link href="/dashboard" className="mt-6 inline-block text-sm font-semibold hover:underline">
              Go to dashboard →
            </Link>
          </motion.div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const pendingPayment = payment && PENDING_STATUSES.has(payment.status) ? payment : null;
  const selectedPkg = packageById(selected);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-bold sm:text-3xl">Buy your API package</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Your application was approved. Pay for your package with crypto via NOWPayments to activate it.
        </p>

        <div className="mt-6 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-5 py-4">
          <p className="text-sm font-semibold text-rose-300">⚠ This purchase is final — choose wisely.</p>
          <p className="mt-1 text-sm text-rose-200/80">
            A package can only be bought once. After payment there is no changing, upgrading, or downgrading. Review
            the scopes carefully before you pay.
          </p>
        </div>

        {pendingPayment ? (
          <div className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4">
            <p className="text-sm font-semibold text-amber-300">
              Payment in progress — {packageById(pendingPayment.package)?.name} (${pendingPayment.amountUsd})
            </p>
            <p className="mt-1 text-sm text-amber-200/80">
              Status: {pendingPayment.status}. Your package activates automatically once the payment confirms.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {pendingPayment.invoiceUrl ? (
                <a
                  href={pendingPayment.invoiceUrl}
                  className="rounded-full border border-amber-400/60 px-4 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
                >
                  Open payment page
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => void checkPayment()}
                className="rounded-full border border-card-border px-4 py-2 text-xs text-muted hover:text-foreground"
              >
                Refresh status
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-10">
          <PricingPackages mode="select" selectedId={selected} onSelect={setSelected} busy={busy} />
        </div>

        {error ? <p className="mt-6 text-sm text-rose-400">{error}</p> : null}

        {selectedPkg ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 rounded-2xl border border-card-border bg-surface/40 p-6"
          >
            <p className="font-semibold">
              You are buying: {selectedPkg.name} — {selectedPkg.priceLabel}/month
            </p>

            <div className="mt-6">
              <p className="text-sm font-semibold">How will you use the API?</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setAppChoice("ours");
                    setOwnBuilder(null);
                  }}
                  className={`rounded-xl border p-4 text-left transition ${
                    appChoice === "ours" ? "border-foreground bg-surface" : "border-card-border hover:border-foreground/40"
                  }`}
                >
                  <p className="font-semibold">Use our app</p>
                  <p className="mt-1 text-xs text-muted">Run your users on the Aare app — no development needed.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setAppChoice("own")}
                  className={`rounded-xl border p-4 text-left transition ${
                    appChoice === "own" ? "border-foreground bg-surface" : "border-card-border hover:border-foreground/40"
                  }`}
                >
                  <p className="font-semibold">Create my own app</p>
                  <p className="mt-1 text-xs text-muted">Build your own product on top of the Partner API.</p>
                </button>
              </div>

              {appChoice === "own" ? (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                  <p className="text-sm font-semibold">Who will build it?</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setOwnBuilder("us")}
                      className={`rounded-xl border p-4 text-left transition ${
                        ownBuilder === "us" ? "border-foreground bg-surface" : "border-card-border hover:border-foreground/40"
                      }`}
                    >
                      <p className="font-semibold">Build it for me</p>
                      <p className="mt-1 text-xs text-muted">
                        Our team develops the app for you — we&apos;ll contact you with scope and pricing.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOwnBuilder("dev")}
                      className={`rounded-xl border p-4 text-left transition ${
                        ownBuilder === "dev" ? "border-foreground bg-surface" : "border-card-border hover:border-foreground/40"
                      }`}
                    >
                      <p className="font-semibold">I have my own developer</p>
                      <p className="mt-1 text-xs text-muted">
                        An independent developer integrates the API — we provide docs and support.
                      </p>
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </div>

            <p className="mt-6 text-sm text-muted">
              You will be redirected to NOWPayments to pay ${selectedPkg.priceMonthly} in crypto. Once paid, this
              package is permanently locked to your account — there is no coming back.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <button
                type="button"
                disabled={busy || !appPreference}
                onClick={() => void buy()}
                className="btn-shine rounded-full border border-foreground bg-foreground px-8 py-3 text-sm font-semibold text-background disabled:opacity-50"
              >
                {busy ? "Opening checkout…" : `Pay $${selectedPkg.priceMonthly} with crypto`}
              </button>
              {!appPreference ? (
                <p className="text-xs text-muted">Answer the app question above to continue.</p>
              ) : (
                <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
                  Back to dashboard
                </Link>
              )}
            </div>
          </motion.div>
        ) : (
          <p className="mt-8 text-sm text-muted">Select a package above to continue to payment.</p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
