"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { TAGLINE } from "@/lib/constants";
import { HeroCodeTerminal } from "./HeroCodeTerminal";

export function HomeHero() {
  return (
    <section className="relative border-b border-card-border">
      <div className="ambient-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:py-40">
        <div className="grid items-end gap-16 lg:grid-cols-2">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-semibold uppercase tracking-[0.25em] text-muted"
            >
              Min Partner API · v1 Live
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
            >
              Income infrastructure for everyone.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="mt-8 max-w-lg text-lg leading-relaxed text-muted"
            >
              {TAGLINE} Embed live trading, airfarming, and ghost accounts — earn 5% on every income program your
              users join.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-10 flex flex-wrap gap-4"
            >
              <Link
                href="/services"
                className="btn-shine rounded-full border border-foreground bg-foreground px-7 py-3 text-sm font-semibold text-background transition hover:opacity-90"
              >
                Explore services
              </Link>
              <Link
                href="/docs/quickstart"
                className="rounded-full border border-card-border px-7 py-3 text-sm font-medium transition hover:border-foreground"
              >
                Start building
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-14 grid grid-cols-3 gap-8 border-t border-card-border pt-10"
            >
              {[
                { n: "22+", l: "Endpoints" },
                { n: "5%", l: "Partner commission" },
                { n: "3", l: "Income programs" },
              ].map((s) => (
                <div key={s.l}>
                  <p className="text-2xl font-bold">{s.n}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-muted">{s.l}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <HeroCodeTerminal />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
