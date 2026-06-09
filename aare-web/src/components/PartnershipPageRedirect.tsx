"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePortalAuth } from "@/context/PortalAuthContext";

/** Logged-in users with KYC apply from the dashboard instead of /partnership. */
export function PartnershipPageRedirect() {
  const { me, loading } = usePortalAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !me) return;
    if (me.canApplyForApi && !me.application) {
      router.replace("/dashboard#apply");
    }
  }, [loading, me, router]);

  return null;
}
