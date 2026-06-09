"use client";

import Link from "next/link";
import { API_PACKAGES, PRICE_CHANGE_NOTICE, type ApiPackageId } from "@/content/api-packages";

type Props = {
  mode?: "marketing" | "select";
  selectedId?: ApiPackageId | null;
  onSelect?: (id: ApiPackageId) => void;
  busy?: boolean;
  showCta?: boolean;
};

export function PricingPackages({
  mode = "marketing",
  selectedId = null,
  onSelect,
  busy = false,
  showCta = true,
}: Props) {
  const isSelect = mode === "select";

  return (
    <div>
      <p className="rounded-lg border border-card-border bg-surface/50 px-4 py-3 text-sm text-muted">
        {PRICE_CHANGE_NOTICE}
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {API_PACKAGES.map((pkg) => {
          const selected = selectedId === pkg.id;
          const Card = isSelect ? "button" : "div";

          return (
            <Card
              key={pkg.id}
              type={isSelect ? "button" : undefined}
              disabled={isSelect ? busy : undefined}
              onClick={isSelect && onSelect ? () => onSelect(pkg.id) : undefined}
              className={`flex h-full flex-col rounded-xl border p-6 text-left ${
                selected ? "border-foreground bg-surface/60" : "border-card-border"
              } ${isSelect ? "cursor-pointer hover:border-foreground/30 disabled:opacity-60" : ""}`}
            >
              <h3 className="font-semibold">{pkg.name}</h3>
              <p className="mt-1 text-sm text-muted">{pkg.tagline}</p>
              <p className="mt-4">
                <span className="text-2xl font-bold">{pkg.priceLabel}</span>
                <span className="text-sm text-muted"> / month</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-muted">
                {pkg.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {isSelect ? (
                <p className="mt-5 text-sm font-medium">{selected ? "Selected" : "Select"}</p>
              ) : showCta ? (
                <Link
                  href="/signup"
                  className="mt-5 inline-block text-sm font-medium hover:underline"
                >
                  Create account
                </Link>
              ) : null}
            </Card>
          );
        })}
      </div>

      {!isSelect ? (
        <p className="mt-6 text-sm text-muted">
          Apply after signup and ID verification. Package is confirmed once your application is approved.
        </p>
      ) : null}
    </div>
  );
}
