"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { TAGLINE } from "@/lib/constants";
import { HeroCodeTerminal } from "./HeroCodeTerminal";
import { InteractiveSphere } from "./InteractiveSphere";

export function HomeHero() {
  return (
    <section className="relative overflow-hidden border-b border-card-border">
      <div className="ambient-grid pointer-events-none absolute inset-0 opacity-40" />

      {/* Desktop sphere — ambient behind terminal */}
      <div className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 lg:block lg:w-[48%] xl:w-[42%]">
        <div className="pointer-events-auto mx-auto aspect-square w-full max-w-[420px] opacity-90">
          <InteractiveSphere className="h-full w-full" size={420} />
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:py-32 xl:py-40">
        <div className="grid items-end gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            {/* Mobile / tablet interactive sphere */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="mb-8 flex justify-center lg:hidden"
            >
              <div className="aspect-square w-full max-w-[min(72vw,280px)]">
                <InteractiveSphere className="h-full w-full" size={280} particleCount={80} />
              </div>
              <p className="sr-only">Interactive sphere — drag or touch to rotate</p>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted sm:text-xs sm:tracking-[0.25em]"
            >
              Min Partner API · v1
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="text-display mt-4 font-bold sm:mt-6"
            >
              Embed Min income products in your app
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="text-lead mt-5 max-w-lg text-muted sm:mt-8"
            >
              {TAGLINE} Register users, run wallets and deposits, plug in airfarming, trading, or ghost accounts. You
              keep 5% commission on program income.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8 flex flex-wrap gap-3 sm:mt-10 sm:gap-4"
            >
              <Link
                href="/docs/quickstart"
                className="btn-shine rounded-full border border-foreground bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 sm:px-7 sm:py-3"
              >
                Quickstart
              </Link>
              <Link
                href="/services"
                className="rounded-full border border-card-border px-5 py-2.5 text-sm font-medium transition hover:border-foreground sm:px-7 sm:py-3"
              >
                What you can embed
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-10 grid grid-cols-3 gap-4 border-t border-card-border pt-8 sm:mt-14 sm:gap-8 sm:pt-10"
            >
              {[
                { n: "22+", l: "Endpoints" },
                { n: "5%", l: "Commission" },
                { n: "3", l: "Programs" },
              ].map((s) => (
                <div key={s.l}>
                  <p className="text-stat font-bold">{s.n}</p>
                  <p className="mt-0.5 text-[0.65rem] uppercase tracking-wider text-muted sm:mt-1 sm:text-xs">{s.l}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="relative hidden lg:block"
          >
            <HeroCodeTerminal />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
