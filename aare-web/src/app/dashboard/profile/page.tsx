"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { InvestorProfileForm } from "@/components/InvestorProfileForm";
import { usePortalAuth } from "@/context/PortalAuthContext";

export default function InvestorProfilePage() {
  const { me, loading } = usePortalAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !me) router.replace("/login");
  }, [loading, me, router]);

  if (loading || !me) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl flex-1 px-4 py-16 text-center text-muted">Loading…</main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
          ← Dashboard
        </Link>
        <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Investor profile</h1>
        <p className="mt-3 max-w-xl text-sm text-muted">
          Tell us how you plan to invest and withdraw. The drops algorithm uses this profile to send you matching
          opportunities.
        </p>
        <div className="mt-10">
          <InvestorProfileForm />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
