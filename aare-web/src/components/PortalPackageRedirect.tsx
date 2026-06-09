"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePortalAuth } from "@/context/PortalAuthContext";

/** Sends approved partners without a package to the selection page. */
export function PortalPackageRedirect() {
  const { me, loading } = usePortalAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || !me?.needsPackageSelection) return;
    if (pathname?.startsWith("/dashboard/choose-package")) return;
    router.replace("/dashboard/choose-package");
  }, [loading, me?.needsPackageSelection, pathname, router]);

  return null;
}
