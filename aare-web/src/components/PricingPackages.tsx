"use client";

import Link from "next/link";
import { motion } from "framer-motion";
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
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
        {PRICE_CHANGE_NOTICE}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {API_PACKAGES.map((pkg, i) => {
          const selected = selectedId === pkg.id;
          const Card = isSelect ? "button" : "div";

          return (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
            >
              <Card
                type={isSelect ? "button" : undefined}
                disabled={isSelect ? busy : undefined}
                onClick={isSelect && onSelect ? () => onSelect(pkg.id) : undefined}
                className={`flex h-full flex-col rounded-2xl border p-8 text-left transition ${
                  pkg.highlighted ? "border-accent/50 glow-ring" : "border-card-border"
                } ${selected ? "border-emerald-400/60 bg-emerald-500/10 ring-2 ring-emerald-400/40" : ""} ${
                  isSelect ? "cursor-pointer hover:border-foreground/40 disabled:opacity-60" : ""
                }`}
              >
                {pkg.highlighted ? (
                  <span className="mb-3 inline-block w-fit rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                    Popular
                  </span>
                ) : null}
                <p className="text-xs uppercase tracking-widest text-muted">Package {i + 1}</p>
                <h3 className="mt-2 text-xl font-bold">{pkg.name}</h3>
                <p className="mt-1 text-sm text-muted">{pkg.tagline}</p>
                <p className="mt-5">
                  <span className="text-3xl font-bold">{pkg.priceLabel}</span>
                  <span className="text-sm text-muted"> / month</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm text-muted">
                  {pkg.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-emerald-400">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {isSelect ? (
                  <p className="mt-6 text-sm font-semibold text-foreground">
                    {selected ? "Selected" : "Choose this package →"}
                  </p>
                ) : showCta ? (
                  <Link
                    href="/signup"
                    className={`mt-6 inline-block rounded-full border px-5 py-2.5 text-center text-sm font-semibold transition ${
                      pkg.highlighted
                        ? "border-foreground bg-foreground text-background"
                        : "border-card-border hover:border-foreground"
                    }`}
                  >
                    Get started
                  </Link>
                ) : null}
              </Card>
            </motion.div>
          );
        })}
      </div>

      {!isSelect ? (
        <p className="mt-8 text-center text-sm text-muted">
          Apply for API access after signup. Approved partners choose a package before keys are activated.
        </p>
      ) : null}
    </div>
  );
}
